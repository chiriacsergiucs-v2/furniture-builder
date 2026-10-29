import {
  newShareId,
  type AccountUser,
  type AuthResult,
  type Backend,
  type RemoteRecord,
  type ShareLink,
  type SharedItem,
} from '../core/account';
import { decodeRow, encodeRow } from '../core/backup';
import { t } from '../core/i18n';
import { newId, validateDesign } from '../core/design';
import { validateLocalTemplate, type LocalTemplate } from '../core/catalog/local';
import type { Design } from '../core/types';
import {
  contentHash,
  itemState,
  planSync,
  TABLE_OF,
  type AccountLink,
  type ItemSyncState,
  type LocalItem,
  type LocalTable,
} from '../core/sync';
import { zipStore } from '../core/zip';
import { db, saveDesign, saveTemplate, type StoredImage } from '../persist/db';
import { onSavedChange } from '../persist/events';
import { onlineConfigured } from './origins';

/**
 * Everything online, in one lazily loaded chunk (ADR-126, G-215): sign-in (ADR-134, ADR-135, ADR-136), saving pieces,
 * templates and their pictures to the account (ADR-137) with the sync rules of ADR-129, share links (ADR-138) and
 * the privacy actions (ADR-130). The app reaches it only through `import('../online/client')`.
 */

let backend: Backend | null = null;

/** Tests and the fake backend set it; the app makes the Supabase one on first use. */
export function setBackend(b: Backend | null): void {
  backend = b;
}

const appUrl = () =>
  typeof location === 'undefined' ? '' : `${location.origin}${import.meta.env.BASE_URL ?? '/'}`;

export async function getBackend(): Promise<Backend> {
  if (backend) return backend;
  const url = import.meta.env.VITE_SUPABASE_URL;
  const key = import.meta.env.VITE_SUPABASE_ANON_KEY;
  if (!onlineConfigured(url) || !key) throw new Error(t('Accounts are not set up in this build.'));
  const { supabaseBackend } = await import('./supabase');
  backend = supabaseBackend(url!, key, appUrl());
  return backend;
}

// ---- Sync status, read by the account store (ADR-139) --------------------------------------------------------------

export interface SyncStatus {
  state: 'idle' | 'syncing' | 'offline' | 'error';
  /** Items saved here and not yet in the account. */
  waiting: number;
  conflicts: string[];
  lastSyncAt?: string;
  error?: string;
  /** Per saved item (`table:id`), its badge. */
  items: Record<string, ItemSyncState>;
  /** Account records not on this device (ADR-137 "In your account"). */
  elsewhere: RemoteRecord[];
}
let status: SyncStatus = { state: 'idle', waiting: 0, conflicts: [], items: {}, elsewhere: [] };
const statusListeners = new Set<(s: SyncStatus) => void>();
export function onSyncStatus(l: (s: SyncStatus) => void): () => void {
  statusListeners.add(l);
  l(status);
  return () => statusListeners.delete(l);
}
const setStatus = (s: Partial<SyncStatus>) => {
  status = { ...status, ...s };
  for (const l of statusListeners) l(status);
};

// ---- Local items -----------------------------------------------------------------------------------------------------

const imageIdsIn = (v: unknown, out: Set<string>): Set<string> => {
  if (Array.isArray(v)) for (const x of v) imageIdsIn(x, out);
  else if (v && typeof v === 'object') {
    for (const [k, x] of Object.entries(v)) {
      if (
        k === 'image' &&
        x &&
        typeof x === 'object' &&
        typeof (x as { id?: unknown }).id === 'string'
      )
        out.add((x as { id: string }).id);
      else imageIdsIn(x, out);
    }
  }
  return out;
};

const imageBody = (img: StoredImage): unknown => JSON.parse(encodeRow(img));

/** Library pieces, local templates and the pictures they use (G-221); unreadable rows are left alone. */
export async function localItems(): Promise<LocalItem[]> {
  const items: LocalItem[] = [];
  const pics = new Set<string>();
  for (const r of await db.designs.toArray()) {
    if (validateDesign(r.design).length) continue;
    items.push({
      table: 'designs',
      id: r.id,
      name: r.design.name,
      body: r.design,
      bodySchema: r.design.schemaVersion,
      hash: contentHash(r.design),
    });
    imageIdsIn(r.design, pics);
  }
  for (const r of await db.templates.toArray()) {
    if (validateLocalTemplate(r.template).length) continue;
    items.push({
      table: 'templates',
      id: r.id,
      name: r.template.family.name,
      body: r.template,
      bodySchema: 1,
      hash: contentHash(r.template),
    });
    imageIdsIn(r.template, pics);
  }
  for (const img of await db.images.bulkGet([...pics])) {
    if (!img) continue;
    const body = imageBody(img);
    items.push({
      table: 'images',
      id: img.id,
      name: img.name,
      body,
      bodySchema: 1,
      hash: contentHash(body),
    });
  }
  return items;
}

const links = (accountId: string) => db.accountLinks.where('accountId').equals(accountId).toArray();
const putLink = (l: AccountLink) => db.accountLinks.put(l);
const dropLink = (l: AccountLink) => db.accountLinks.delete([l.accountId, l.table, l.localId]);

/** Store a downloaded body as a local row; validated first, never thrown. Returns the stored body or null. */
async function storeLocal(
  table: LocalTable,
  localId: string,
  body: unknown,
  name?: string,
): Promise<unknown | null> {
  if (table === 'designs') {
    const d = { ...(body as Design), id: localId, ...(name ? { name } : {}) };
    if (validateDesign(d).length) return null;
    await saveDesign(d);
    return d;
  }
  if (table === 'templates') {
    const t = { ...(body as LocalTemplate), id: localId };
    if (validateLocalTemplate(t).length) return null;
    await saveTemplate(t);
    return t;
  }
  const img = decodeRow(JSON.stringify(body)) as StoredImage;
  if (!img || typeof img !== 'object' || !(img.bytes instanceof ArrayBuffer)) return null;
  // Pictures keep their id: designs refer to them by it. One already here is never overwritten.
  if (!(await db.images.get(img.id))) await db.images.put(img);
  return JSON.parse(encodeRow(img));
}

// ---- Sync (ADR-129) --------------------------------------------------------------------------------------------------

let running: Promise<void> | null = null;
let again = false;

/** One sync now; a call during a sync runs one more after it. Offline or failing, the items wait here (G-225). */
export function sync(): Promise<void> {
  if (running) {
    again = true;
    return running;
  }
  running = (async () => {
    do {
      again = false;
      await syncOnce();
    } while (again);
  })().finally(() => {
    running = null;
  });
  return running;
}

async function syncOnce(): Promise<void> {
  const b = await getBackend();
  const user = await b.currentUser();
  if (!user) return;
  setStatus({ state: 'syncing', error: undefined });
  try {
    await b.purgeTrash().catch(() => 0);
    // Items that belong to another account on this device are not this account's to upload (ADR-142).
    const [all, remotes, ls, others] = await Promise.all([
      localItems(),
      b.listRecords(),
      links(user.id),
      otherAccountsItems(user.id),
    ]);
    const locals = all.filter((i) => !others.has(`${i.table}:${i.id}`));
    // Items kept twice stay listed until the user has seen them in Account (G-226).
    const conflicts = [...status.conflicts];
    for (const a of planSync(locals, remotes, ls, user.id)) {
      if (a.type === 'create') {
        const r = await b.saveRecord({
          kind: kindOf(a.item.table),
          name: a.item.name,
          body: a.item.body,
          bodySchema: a.item.bodySchema,
        });
        if (r.ok)
          await putLink({
            accountId: user.id,
            table: a.item.table,
            localId: a.item.id,
            remoteId: r.record.id,
            revision: r.record.revision,
            syncedHash: a.item.hash,
          });
      } else if (a.type === 'update') {
        const r = await b.saveRecord({
          id: a.link.remoteId,
          kind: kindOf(a.item.table),
          name: a.item.name,
          body: a.item.body,
          bodySchema: a.item.bodySchema,
          baseRevision: a.link.revision,
        });
        if (r.ok)
          await putLink({ ...a.link, revision: r.record.revision, syncedHash: a.item.hash });
        else if (r.conflict) again = true; // the next round sees the newer revision and keeps both
      } else if (a.type === 'pull') {
        const stored = await storeLocal(a.item.table, a.item.id, a.remote.body);
        if (stored)
          await putLink({
            ...a.link,
            revision: a.remote.revision,
            syncedHash: contentHash(stored),
          });
      } else if (a.type === 'conflict') {
        // Keep both (G-226): the account's version becomes a new copy here, linked to its record; this device's
        // version is uploaded as a new record on the next round.
        const copyId = a.item.table === 'images' ? a.item.id : newId();
        const stored =
          a.item.table === 'images'
            ? a.item.body
            : await storeLocal(
                a.item.table,
                copyId,
                a.remote.body,
                a.item.table === 'designs' ? `${a.remote.name} (from your account)` : undefined,
              );
        await dropLink(a.link);
        if (stored && a.item.table !== 'images')
          await putLink({
            accountId: user.id,
            table: a.item.table,
            localId: copyId,
            remoteId: a.remote.id,
            revision: a.remote.revision,
            syncedHash: contentHash(stored),
          });
        conflicts.push(a.item.name);
        again = true;
      } else if (a.type === 'trash') {
        await b.trashRecord(a.link.remoteId!, true);
        await dropLink(a.link);
      } else {
        // Trashed or gone from the account: the item stays here, now only on this device.
        const here = locals.some((i) => i.table === a.link.table && i.id === a.link.localId);
        if (here)
          await putLink({
            accountId: a.link.accountId,
            table: a.link.table,
            localId: a.link.localId,
            deviceOnly: true,
          });
        else await dropLink(a.link);
      }
    }
    await refreshStatus(user, conflicts);
    setStatus({ state: 'idle', lastSyncAt: new Date().toISOString() });
  } catch (e) {
    const offline = typeof navigator !== 'undefined' && navigator.onLine === false;
    await refreshStatus(user, status.conflicts, false).catch(() => {});
    setStatus({
      state:
        offline ||
        /connection/i.test(String(e)) ||
        String(e).includes(t('Check your connection and try again.'))
          ? 'offline'
          : 'error',
      error: (e as Error).message,
    });
  }
}

const kindOf = (t: LocalTable) =>
  t === 'designs' ? 'design' : t === 'templates' ? 'template' : 'image';

async function refreshStatus(user: AccountUser, conflicts: string[], online = true): Promise<void> {
  const [all, ls, others] = await Promise.all([
    localItems(),
    links(user.id),
    otherAccountsItems(user.id),
  ]);
  const locals = all.filter((i) => !others.has(`${i.table}:${i.id}`));
  const byKey = new Map(ls.map((l) => [`${l.table}:${l.localId}`, l]));
  const items: Record<string, ItemSyncState> = {};
  let waiting = 0;
  for (const i of locals) {
    const s = itemState(i, byKey.get(`${i.table}:${i.id}`));
    items[`${i.table}:${i.id}`] = s;
    if (s === 'waiting') waiting++;
  }
  let elsewhere = status.elsewhere;
  if (online) {
    const remotes = await (await getBackend()).listRecords();
    const linked = new Set(ls.map((l) => l.remoteId));
    elsewhere = remotes.filter((r) => !r.deletedAt && r.kind !== 'image' && !linked.has(r.id));
  }
  setStatus({ items, waiting, conflicts, elsewhere });
}

let stopAuto: (() => void) | null = null;
/** Sync after saves (debounced), when the connection comes back, and once now. */
export function startAutoSync(delayMs = 3000): void {
  stopAuto?.();
  let t: ReturnType<typeof setTimeout> | undefined;
  const later = () => {
    clearTimeout(t);
    t = setTimeout(() => void sync(), delayMs);
  };
  const off = onSavedChange((c) => {
    if (c.table === 'designs' || c.table === 'templates' || c.table === 'images') later();
  });
  const onOnline = () => void sync();
  if (typeof window !== 'undefined') window.addEventListener('online', onOnline);
  stopAuto = () => {
    off();
    clearTimeout(t);
    if (typeof window !== 'undefined') window.removeEventListener('online', onOnline);
  };
  void sync();
}
/** The user has seen the items kept twice (the Account panel closed). */
export function clearConflicts(): void {
  if (status.conflicts.length) setStatus({ conflicts: [] });
}

export function stopAutoSync(): void {
  stopAuto?.();
  stopAuto = null;
}

/** "Keep on this device only" (G-255), and back. */
export async function setDeviceOnly(
  accountId: string,
  table: LocalTable,
  localId: string,
  on: boolean,
): Promise<void> {
  const cur = await db.accountLinks.get([accountId, table, localId]);
  if (on) {
    if (cur?.remoteId) await (await getBackend()).trashRecord(cur.remoteId, true);
    await putLink({ accountId, table, localId, deviceOnly: true });
  } else if (cur) await dropLink(cur);
  void sync();
}

/** Remove from account: the record goes to the account Trash; the item stays here, only on this device. */
export const removeFromAccount = (accountId: string, table: LocalTable, localId: string) =>
  setDeviceOnly(accountId, table, localId, true);

const KIND_WORD: Record<RemoteRecord['kind'], string> = {
  design: t('design'),
  template: t('template'),
  image: t('image'),
};

/** Open an account record that is not on this device: a validated local copy, linked to it (ADR-137). */
export async function openFromAccount(
  remote: RemoteRecord,
): Promise<{ ok: true; table: LocalTable; id: string } | { ok: false; error: string }> {
  const b = await getBackend();
  const user = await b.currentUser();
  if (!user) return { ok: false, error: t('Sign in first.') };
  const table = TABLE_OF[remote.kind];
  // Pictures it uses come too, when they are in the account and missing here.
  const want = imageIdsIn(remote.body, new Set());
  if (want.size)
    for (const r of await b.listRecords())
      if (r.kind === 'image' && !r.deletedAt) {
        const pid = (r.body as { id?: string })?.id;
        if (pid && want.has(pid)) {
          const s = await storeLocal('images', pid, r.body);
          if (s)
            await putLink({
              accountId: user.id,
              table: 'images',
              localId: pid,
              remoteId: r.id,
              revision: r.revision,
              syncedHash: contentHash(s),
            });
        }
      }
  const id = newId();
  const stored = await storeLocal(table, id, remote.body);
  if (!stored)
    return {
      ok: false,
      error: t('“{name}” could not be opened: it is not a valid {kind}.', {
        name: remote.name,
        kind: KIND_WORD[remote.kind],
      }),
    };
  await putLink({
    accountId: user.id,
    table,
    localId: id,
    remoteId: remote.id,
    revision: remote.revision,
    syncedHash: contentHash(stored),
  });
  await refreshStatus(user, status.conflicts).catch(() => {});
  return { ok: true, table, id };
}

// ---- Sign-in (ADR-134, ADR-135, ADR-136) -----------------------------------------------------------------------------

export async function currentUser(): Promise<AccountUser | null> {
  try {
    return await (await getBackend()).currentUser();
  } catch {
    return null;
  }
}
export const signIn = async (email: string, password: string): Promise<AuthResult> =>
  (await getBackend()).signInWithPassword(email, password);
export const signUp = async (email: string, password: string): Promise<AuthResult> =>
  (await getBackend()).signUp(email, password);
export const signInWithGoogle = async () => (await getBackend()).signInWithGoogle();
export const sendReset = async (email: string) => (await getBackend()).sendPasswordReset(email);
export const updatePassword = async (password: string) =>
  (await getBackend()).updatePassword(password);

/** Sign out. With `removeCopies`, this device's copies of the account's items go too (G-227; default keep). */
export async function signOut(accountId: string, removeCopies = false): Promise<void> {
  stopAutoSync();
  if (removeCopies) {
    for (const l of await links(accountId)) {
      if (!l.remoteId) continue;
      if (l.table === 'designs') await db.designs.delete(l.localId);
      else if (l.table === 'templates') await db.templates.delete(l.localId);
      await dropLink(l);
    }
  }
  await (await getBackend()).signOut();
  setStatus({ state: 'idle', waiting: 0, conflicts: [], items: {}, elsewhere: [] });
}

/** Local items that belong to another account than this one (ADR-142): hidden, never removed. */
export async function otherAccountsItems(accountId: string | null): Promise<Set<string>> {
  const all = await db.accountLinks.toArray();
  const mine = new Set(
    all.filter((l) => l.accountId === accountId).map((l) => `${l.table}:${l.localId}`),
  );
  return new Set(
    all
      .filter(
        (l) => l.accountId !== accountId && l.remoteId && !mine.has(`${l.table}:${l.localId}`),
      )
      .map((l) => `${l.table}:${l.localId}`),
  );
}

// ---- Share links (ADR-132, ADR-138) ----------------------------------------------------------------------------------

/** A link for a saved item that is in the account; the item is uploaded first when needed. */
export async function createShare(
  table: LocalTable,
  localId: string,
): Promise<{ ok: true; share: ShareLink } | { ok: false; error: string }> {
  const b = await getBackend();
  const user = await b.currentUser();
  if (!user) return { ok: false, error: t('Sign in to share a link.') };
  let link = await db.accountLinks.get([user.id, table, localId]);
  if (!link?.remoteId) {
    await sync();
    link = await db.accountLinks.get([user.id, table, localId]);
  }
  if (!link?.remoteId) return { ok: false, error: t('Save to account first to share a link.') };
  try {
    return { ok: true, share: await b.createShare(link.remoteId, newShareId()) };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

export async function listShares(): Promise<(ShareLink & { name: string })[]> {
  const b = await getBackend();
  const [shares, records] = await Promise.all([b.listShares(), b.listRecords()]);
  const names = new Map(records.map((r) => [r.id, r.name]));
  return shares.map((s) => ({ ...s, name: names.get(s.recordId) ?? '' }));
}
export const stopShare = async (id: string) => (await getBackend()).stopShare(id);
/** The local item's record id in the current account, for "Shared links" per item. */
export async function remoteIdOf(table: LocalTable, localId: string): Promise<string | undefined> {
  const user = await currentUser();
  return user ? (await db.accountLinks.get([user.id, table, localId]))?.remoteId : undefined;
}

/** Open a shared item (anyone with the link, G-236): what the server returns, not yet stored. */
export async function openShare(
  id: string,
): Promise<{ ok: true; item: SharedItem } | { ok: false; error: string }> {
  try {
    const item = await (await getBackend()).openShare(id);
    return item
      ? { ok: true, item }
      : { ok: false, error: t('This link no longer works. Ask the owner for a new one.') };
  } catch (e) {
    const offline = typeof navigator !== 'undefined' && navigator.onLine === false;
    return {
      ok: false,
      error: offline
        ? t('You are offline. Open this link when you are back online.')
        : (e as Error).message,
    };
  }
}

// ---- Privacy (ADR-130) -----------------------------------------------------------------------------------------------

/** Every record of the account as the files the app imports, plus the account fields, in one .zip. */
export async function exportMyData(): Promise<{ blob: Blob; name: string }> {
  const b = await getBackend();
  const user = await b.currentUser();
  if (!user) throw new Error(t('Sign in first.'));
  const enc = new TextEncoder();
  const records = await b.listRecords();
  const shares = await b.listShares();
  const files = [
    { name: 'account.json', data: enc.encode(JSON.stringify({ user, shares }, null, 2)) },
    ...records.map((r) => ({
      name: `${TABLE_OF[r.kind]}/${r.id}.json`,
      data: enc.encode(JSON.stringify(r.body, null, 2)),
    })),
  ];
  return {
    blob: new Blob([zipStore(files, new Date()) as BlobPart], { type: 'application/zip' }),
    name: `furniture-builder-account-${new Date().toISOString().slice(0, 10)}.zip`,
  };
}

/** Delete my account: every record and share link, at once (G-232). This device's rows stay. */
export async function deleteMyAccount(
  accountId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  stopAutoSync();
  const r = await (await getBackend()).deleteAccount();
  if (r.ok) {
    for (const l of await links(accountId)) await dropLink(l);
    setStatus({ state: 'idle', waiting: 0, conflicts: [], items: {}, elsewhere: [] });
  }
  return r;
}
