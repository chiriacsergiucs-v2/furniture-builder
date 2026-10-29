import type { RecordKind, RemoteRecord } from './account';
import { t } from './i18n';

/**
 * What a sync does, decided from three lists: the items saved on this device, the account's records and the links
 * between them (ADR-129). Pure; `src/online/client.ts` carries the actions out. Rules:
 * - an item with no link is uploaded (G-224: everything, silently; G-255: automatic), unless kept on this device only;
 * - an item changed here since the last sync is uploaded when the account still has the revision it started from,
 *   else both are kept (G-226);
 * - an item unchanged here takes the account's newer revision;
 * - an item deleted here moves its record to the account Trash (G-228);
 * - a record trashed or gone from the account leaves the item here, now only on this device.
 * No action ever deletes a saved row on this device, and only an item unchanged since the last sync is replaced.
 */

export type LocalTable = 'designs' | 'templates' | 'images';
export const KIND_OF: Record<LocalTable, RecordKind> = {
  designs: 'design',
  templates: 'template',
  images: 'image',
};
export const TABLE_OF: Record<RecordKind, LocalTable> = {
  design: 'designs',
  template: 'templates',
  image: 'images',
};

export interface LocalItem {
  table: LocalTable;
  id: string;
  name: string;
  body: unknown;
  bodySchema: number;
  /** `contentHash(body)`. */
  hash: string;
}

/** One row of the `accountLinks` table: a saved item and its record in one account (ADR-128, G-222). */
export interface AccountLink {
  accountId: string;
  table: LocalTable;
  localId: string;
  remoteId?: string;
  /** The record's revision when last in step. */
  revision?: number;
  /** The item's hash when last in step. */
  syncedHash?: string;
  /** "Keep on this device only" (G-255): never uploaded. */
  deviceOnly?: boolean;
}

export type SyncAction =
  | { type: 'create'; item: LocalItem }
  | { type: 'update'; item: LocalItem; link: AccountLink; remote: RemoteRecord }
  | { type: 'pull'; item: LocalItem; link: AccountLink; remote: RemoteRecord }
  | { type: 'conflict'; item: LocalItem; link: AccountLink; remote: RemoteRecord }
  | { type: 'trash'; link: AccountLink }
  | { type: 'unlink'; link: AccountLink };

/** FNV-1a over the JSON text: enough to tell "changed since the last sync". */
export function contentHash(body: unknown): string {
  const s = JSON.stringify(body) ?? '';
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, '0') + s.length.toString(16);
}

const linkKey = (table: string, id: string) => `${table}:${id}`;

export function planSync(
  locals: LocalItem[],
  remotes: RemoteRecord[],
  links: AccountLink[],
  accountId: string,
): SyncAction[] {
  const actions: SyncAction[] = [];
  const mine = links.filter((l) => l.accountId === accountId);
  const byLocal = new Map(mine.map((l) => [linkKey(l.table, l.localId), l]));
  const byRemote = new Map(remotes.map((r) => [r.id, r]));
  const present = new Set(locals.map((i) => linkKey(i.table, i.id)));
  for (const item of locals) {
    const link = byLocal.get(linkKey(item.table, item.id));
    if (link?.deviceOnly) continue;
    if (!link?.remoteId) {
      actions.push({ type: 'create', item });
      continue;
    }
    const remote = byRemote.get(link.remoteId);
    if (!remote || remote.deletedAt) {
      actions.push({ type: 'unlink', link });
      continue;
    }
    const changedHere = item.hash !== link.syncedHash;
    const changedThere = remote.revision !== link.revision;
    if (changedHere && !changedThere) actions.push({ type: 'update', item, link, remote });
    else if (changedHere && changedThere) actions.push({ type: 'conflict', item, link, remote });
    else if (changedThere) actions.push({ type: 'pull', item, link, remote });
  }
  for (const link of mine) {
    if (!link.remoteId || link.deviceOnly || present.has(linkKey(link.table, link.localId)))
      continue;
    const remote = byRemote.get(link.remoteId);
    if (remote && !remote.deletedAt) actions.push({ type: 'trash', link });
    else actions.push({ type: 'unlink', link });
  }
  return actions;
}

/** The badge an item shows while signed in (ADR-137, ADR-139). */
export type ItemSyncState = 'in-account' | 'waiting' | 'device-only' | 'conflict';

export function itemState(item: LocalItem, link: AccountLink | undefined): ItemSyncState {
  if (link?.deviceOnly) return 'device-only';
  if (!link?.remoteId || item.hash !== link.syncedHash) return 'waiting';
  return 'in-account';
}

export const STATE_LABEL: Record<ItemSyncState, string> = {
  'in-account': t('In your account'),
  waiting: t('Waiting to upload'),
  'device-only': t('Only on this device'),
  conflict: t('Conflict'),
};
