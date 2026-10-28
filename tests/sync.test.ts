import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import type { RemoteRecord } from '../src/core/account';
import { newShareId, shareIdFrom, shareLink } from '../src/core/account';
import { templates } from '../src/core/design';
import { contentHash, planSync, type AccountLink, type LocalItem } from '../src/core/sync';
import { db, saveDesign } from '../src/persist/db';
import { fakeBackend, fakeServer } from '../src/online/fake';
import * as client from '../src/online/client';

const A = 'acct-a';
const item = (id: string, body: unknown = { id, v: 1 }): LocalItem => ({
  table: 'designs',
  id,
  name: id,
  body,
  bodySchema: 3,
  hash: contentHash(body),
});
const remote = (id: string, revision: number, deletedAt: string | null = null): RemoteRecord => ({
  id,
  kind: 'design',
  name: id,
  body: {},
  bodySchema: 3,
  revision,
  updatedAt: '2026',
  deletedAt,
});
const link = (localId: string, remoteId: string, revision: number, syncedHash: string): AccountLink => ({
  accountId: A,
  table: 'designs',
  localId,
  remoteId,
  revision,
  syncedHash,
});

describe('planSync (ADR-129)', () => {
  it('uploads a new item, updates a changed one, pulls a newer record, keeps both on a conflict', () => {
    const n = item('new');
    const changed = item('ch', { v: 2 });
    const same = item('same');
    const both = item('both', { v: 9 });
    const acts = planSync(
      [n, changed, same, both],
      [remote('r-ch', 1), remote('r-same', 2), remote('r-both', 3)],
      [
        link('ch', 'r-ch', 1, 'old'),
        link('same', 'r-same', 1, same.hash),
        link('both', 'r-both', 2, 'old'),
      ],
      A,
    );
    expect(acts.map((a) => `${a.type}:${'item' in a ? a.item.id : a.link.localId}`)).toEqual([
      'create:new',
      'update:ch',
      'pull:same',
      'conflict:both',
    ]);
  });

  it('a deleted item trashes its record; a trashed record leaves the item here; device-only is skipped', () => {
    const kept = item('kept');
    const acts = planSync(
      [kept, item('only')],
      [remote('r-gone', 1), remote('r-kept', 1, '2026-10-01')],
      [
        link('deleted', 'r-gone', 1, 'h'),
        link('kept', 'r-kept', 1, kept.hash),
        { accountId: A, table: 'designs', localId: 'only', deviceOnly: true },
      ],
      A,
    );
    expect(acts.map((a) => a.type)).toEqual(['unlink', 'trash']);
  });

  it('ignores other accounts’ links', () => {
    const i = item('x');
    const acts = planSync([i], [], [{ ...link('x', 'r', 1, i.hash), accountId: 'other' }], A);
    expect(acts.map((a) => a.type)).toEqual(['create']);
  });

  it('fuzz: no plan replaces an item changed here, and no action deletes a saved item', () => {
    let seed = 7;
    const rnd = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
    for (let n = 0; n < 3000; n++) {
      const locals: LocalItem[] = [];
      const remotes: RemoteRecord[] = [];
      const links: AccountLink[] = [];
      for (let i = 0; i < 6; i++) {
        const it = item(`l${i}`, { v: Math.floor(rnd() * 3) });
        if (rnd() < 0.8) locals.push(it);
        if (rnd() < 0.7) {
          const rev = 1 + Math.floor(rnd() * 3);
          if (rnd() < 0.8) remotes.push(remote(`r${i}`, rev, rnd() < 0.15 ? '2026' : null));
          links.push({
            ...link(`l${i}`, `r${i}`, 1 + Math.floor(rnd() * 3), rnd() < 0.5 ? it.hash : 'x'),
            deviceOnly: rnd() < 0.1,
          });
        }
      }
      for (const a of planSync(locals, remotes, links, A)) {
        if (a.type === 'pull') expect(a.item.hash).toBe(a.link.syncedHash);
        expect(['create', 'update', 'pull', 'conflict', 'trash', 'unlink']).toContain(a.type);
      }
    }
  });
});

describe('share links (ADR-132, ADR-138)', () => {
  it('ids are 22 base64url characters from 128 random bits; links are fragments', () => {
    const id = newShareId();
    expect(id).toMatch(/^[A-Za-z0-9_-]{22}$/);
    expect(newShareId()).not.toBe(id);
    const url = shareLink('https://x.github.io/furniture-builder/#projects', id);
    expect(url).toBe(`https://x.github.io/furniture-builder/#share=${id}`);
    expect(shareIdFrom(`#share=${id}`)).toBe(id);
    expect(shareIdFrom('#share=short')).toBeNull();
    expect(shareIdFrom('#open=abc')).toBeNull();
  });
});

describe('sync engine with a fake server (ADR-129, ADR-137)', () => {
  beforeEach(async () => {
    client.stopAutoSync();
    await db.designs.clear();
    await db.templates.clear();
    await db.accountLinks.clear();
  });

  const signedIn = async () => {
    const server = fakeServer();
    const b = fakeBackend(server);
    client.setBackend(b);
    const r = await b.signUp('me@example.com', 'secret-123');
    if (!r.ok) throw new Error(r.error);
    return { b, server, user: r.user };
  };

  it('first sign-in uploads every saved piece silently (G-224); the badge reads In your account', async () => {
    const { server, user } = await signedIn();
    const d1 = templates[0].create();
    const d2 = templates[1].create();
    await saveDesign(d1);
    await saveDesign(d2);
    await client.sync();
    expect(server.records.size).toBe(2);
    let st: client.SyncStatus | undefined;
    const off = client.onSyncStatus((s) => (st = s));
    off();
    expect(st!.items[`designs:${d1.id}`]).toBe('in-account');
    expect(st!.waiting).toBe(0);
    expect((await db.accountLinks.where('accountId').equals(user.id).count())).toBe(2);
  });

  it('offline edits stay here and upload when back (G-225); the local row is never lost', async () => {
    const { server } = await signedIn();
    const d = templates[0].create();
    await saveDesign(d);
    await client.sync();
    server.offline = true;
    await saveDesign({ ...d, name: 'Edited offline' });
    await client.sync();
    expect((await db.designs.get(d.id))?.name).toBe('Edited offline');
    expect([...server.records.values()][0].name).not.toBe('Edited offline');
    server.offline = false;
    await client.sync();
    expect([...server.records.values()][0].name).toBe('Edited offline');
  });

  it('a change on another device while this one changed too keeps both (G-226)', async () => {
    const { b, server } = await signedIn();
    const d = templates[0].create();
    await saveDesign(d);
    await client.sync();
    const rec = [...server.records.values()][0];
    await b.saveRecord({ id: rec.id, kind: 'design', name: 'Other device', body: { ...d, name: 'Other device' }, bodySchema: 3, baseRevision: rec.revision });
    await saveDesign({ ...d, name: 'This device' });
    await client.sync();
    const names = (await db.designs.toArray()).map((r) => r.name).sort();
    expect(names).toEqual(['Other device (from your account)', 'This device']);
    expect(server.records.size).toBe(2);
    expect([...server.records.values()].map((r) => r.name).sort()).toEqual(['Other device', 'This device']);
  });

  it('an unchanged item takes the account’s newer revision', async () => {
    const { b, server } = await signedIn();
    const d = templates[0].create();
    await saveDesign(d);
    await client.sync();
    const rec = [...server.records.values()][0];
    await b.saveRecord({ id: rec.id, kind: 'design', name: 'Newer', body: { ...d, name: 'Newer' }, bodySchema: 3, baseRevision: rec.revision });
    await client.sync();
    expect((await db.designs.get(d.id))?.name).toBe('Newer');
    expect(await db.designs.count()).toBe(1);
  });

  it('deleting here moves the record to the account Trash (G-228); Keep on this device only removes it from the account', async () => {
    const { server, user } = await signedIn();
    const d1 = templates[0].create();
    const d2 = templates[1].create();
    await saveDesign(d1);
    await saveDesign(d2);
    await client.sync();
    await db.designs.delete(d1.id);
    await client.sync();
    expect([...server.records.values()].filter((r) => r.deletedAt)).toHaveLength(1);
    await client.setDeviceOnly(user.id, 'designs', d2.id, true);
    await client.sync();
    expect([...server.records.values()].filter((r) => !r.deletedAt)).toHaveLength(0);
    expect(await db.designs.get(d2.id)).toBeDefined(); // the device copy stays
    let st: client.SyncStatus | undefined;
    client.onSyncStatus((s) => (st = s))();
    expect(st!.items[`designs:${d2.id}`]).toBe('device-only');
  });

  it('a record not on this device is listed and opens as a validated, linked copy; an invalid one is refused', async () => {
    const { b } = await signedIn();
    const d = templates[0].create();
    await b.saveRecord({ kind: 'design', name: d.name, body: d, bodySchema: 3 });
    await b.saveRecord({ kind: 'design', name: 'Broken', body: { schemaVersion: 99 }, bodySchema: 3 });
    await client.sync();
    let st: client.SyncStatus | undefined;
    client.onSyncStatus((s) => (st = s))();
    expect(st!.elsewhere.map((r) => r.name).sort()).toEqual(['Broken', d.name].sort());
    const good = await client.openFromAccount(st!.elsewhere.find((r) => r.name === d.name)!);
    expect(good.ok).toBe(true);
    const bad = await client.openFromAccount(st!.elsewhere.find((r) => r.name === 'Broken')!);
    expect(bad.ok).toBe(false);
    expect(await db.designs.count()).toBe(1);
  });

  it('share link: created for an account item, opened by anyone, stopped by the owner (ADR-138)', async () => {
    const { server } = await signedIn();
    const d = templates[0].create();
    await saveDesign(d);
    const made = await client.createShare('designs', d.id);
    if (!made.ok) throw new Error(made.error);
    const viewer = fakeBackend(server); // another person, not signed in
    expect((await viewer.openShare(made.share.id))?.name).toBe(d.name);
    await client.stopShare(made.share.id);
    expect(await viewer.openShare(made.share.id)).toBeNull();
    expect((await client.openShare(made.share.id)).ok).toBe(false);
  });

  it('sign out keeps this device’s copies by default and removes them on request (G-227)', async () => {
    const { user } = await signedIn();
    const d = templates[0].create();
    await saveDesign(d);
    await client.sync();
    await client.signOut(user.id, false);
    expect(await db.designs.count()).toBe(1);
    const { user: u2 } = await signedIn();
    const d2 = templates[1].create();
    await saveDesign(d2);
    await client.sync();
    await client.signOut(u2.id, true);
    expect(await db.designs.get(d2.id)).toBeUndefined();
    expect(await db.designs.get(d.id)).toBeDefined(); // the other account's copy is not touched
  });

  it('export my data gives the account’s items; delete my account removes them all (ADR-130)', async () => {
    const { server, user } = await signedIn();
    await saveDesign(templates[0].create());
    await client.sync();
    const z = await client.exportMyData();
    expect(z.blob.size).toBeGreaterThan(100);
    expect((await client.deleteMyAccount(user.id)).ok).toBe(true);
    expect(server.records.size).toBe(0);
    expect(server.users.size).toBe(0);
    expect(await db.designs.count()).toBe(1); // this device's rows stay
  });

  it('accounts on one device: another account’s copies are hidden, device-only items are not (ADR-142)', async () => {
    const { user } = await signedIn();
    const d = templates[0].create();
    await saveDesign(d);
    await client.sync();
    expect([...(await client.otherAccountsItems('someone-else'))]).toEqual([`designs:${d.id}`]);
    expect((await client.otherAccountsItems(user.id)).size).toBe(0);
  });
});
