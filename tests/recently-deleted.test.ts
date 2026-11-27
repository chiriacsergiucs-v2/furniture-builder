// ADR-302 (G-014): deleting a project or piece on the Projects page moves it to Recently deleted for 30 days.
import 'fake-indexeddb/auto';
import Dexie from 'dexie';
import { beforeEach, describe, expect, it } from 'vitest';
import { templates } from '../src/core/design';
import { newProject } from '../src/core/project';
import * as dbm from '../src/persist/db';
import { onSavedChange } from '../src/persist/events';

const { db } = dbm;
const flush = () => new Promise((r) => setTimeout(r, 10));
const DAY = 24 * 60 * 60 * 1000;

beforeEach(async () => {
  await Promise.all(db.tables.map((table) => table.clear()));
});

describe('Dexie v13 adds Recently deleted (ADR-302)', () => {
  it('opening a v12 database keeps every row of every table, unreadable rows too', async () => {
    const V12 = {
      designs: 'id, updatedAt, name',
      projects: 'id, updatedAt, name',
      templates: 'id, updatedAt',
      researchDocs: 'key, docId',
      researchMarks: 'id, updatedAt',
      images: 'id',
      decors: 'id',
      projectTemplates: 'id, updatedAt, name',
      prices: 'id',
      models: 'id, createdAt',
      gapMarks: 'gapId, updatedAt',
      projectVersions: 'id, projectId, savedAt',
      settings: 'key',
      accountLinks: '[accountId+table+localId], accountId, remoteId',
      bands: 'id',
    };
    // Two rows per table, the second one unreadable by the app: both must survive (ADR-012).
    const rows: Record<string, Record<string, unknown>[]> = {
      designs: [
        { id: 'd1', updatedAt: '2026', name: 'D', design: { a: 1 } },
        { id: 'd2', updatedAt: '2026', name: 'bad', design: { v: 99 } },
      ],
      projects: [
        { id: 'p1', updatedAt: '2026', name: 'P', project: { a: 1 } },
        { id: 'p2', updatedAt: '2026', name: 'bad', project: null },
      ],
      templates: [
        { id: 't1', updatedAt: '2026', template: {} },
        { id: 't2', updatedAt: '2026' },
      ],
      researchDocs: [
        { key: 'k1', docId: 'r', bundle: {} },
        { key: 'k2', docId: 'r' },
      ],
      researchMarks: [
        { id: 'm1', updatedAt: '2026' },
        { id: 'm2', updatedAt: 'x' },
      ],
      images: [
        { id: 'i1', bytes: new Uint8Array([1, 2, 3]) },
        { id: 'i2', bytes: 'not bytes' },
      ],
      decors: [{ id: 'de1', name: 'Oak' }, { id: 'de2' }],
      projectTemplates: [
        { id: 'pt1', updatedAt: '2026', name: 'T', template: {} },
        { id: 'pt2', updatedAt: '2026', name: 'bad' },
      ],
      prices: [{ id: 'pr1', price: 1 }, { id: 'pr2' }],
      models: [
        { id: 'mo1', createdAt: '2026' },
        { id: 'mo2', createdAt: '2026', bytes: null },
      ],
      gapMarks: [
        { gapId: 'G-001', decision: null, note: '', updatedAt: '2026' },
        { gapId: 'G-002', decision: 'nope', updatedAt: '2026' },
      ],
      projectVersions: [
        { id: 'v1', projectId: 'p1', savedAt: '2026' },
        { id: 'v2', projectId: 'p2', savedAt: '2026' },
      ],
      settings: [
        { key: 's1', value: 1 },
        { key: 's2', value: { odd: true } },
      ],
      accountLinks: [
        { accountId: 'a', table: 'designs', localId: 'd1', remoteId: 'r1' },
        { accountId: 'a', table: 'projects', localId: 'p1', remoteId: 'r2' },
      ],
      bands: [{ id: 'b1', thickness: 2 }, { id: 'b2' }],
    };
    expect(Object.keys(rows).sort()).toEqual(Object.keys(V12).sort());
    const name = 'recently-deleted-upgrade-test';
    const old = new Dexie(name);
    old.version(12).stores(V12);
    await old.open();
    for (const [table, list] of Object.entries(rows)) await old.table(table).bulkPut(list);
    old.close();
    const Fresh = db.constructor as new (n: string) => typeof db;
    const nw = new Fresh(name);
    await nw.open();
    expect(nw.verno).toBe(13);
    for (const [table, list] of Object.entries(rows)) {
      const after = await nw.table(table).toArray();
      expect(after, table).toHaveLength(list.length);
      expect(after, table).toEqual(expect.arrayContaining(list));
    }
    expect(nw.tables.map((t) => t.name).sort()).toEqual(
      [...Object.keys(V12), 'recentlyDeleted'].sort(),
    );
    expect(await nw.recentlyDeleted.count()).toBe(0);
    nw.close();
    await Dexie.delete(name);
  });
});

describe('Recently deleted: move, list, restore, delete forever, purge (ADR-302)', () => {
  const d = templates[0].create();
  const p = newProject('Pantry');

  it('delete moves a design and a project to Recently deleted, newest first, and reports them deleted', async () => {
    await dbm.saveDesign(d);
    await dbm.saveProject(p);
    await flush();
    const seen: [string, string, boolean][] = [];
    const off = onSavedChange((c) => seen.push([c.table, c.key, c.deleted]));
    try {
      await dbm.moveToRecentlyDeleted('designs', d.id, new Date('2026-11-01T10:00:00Z'));
      await dbm.moveToRecentlyDeleted('projects', p.id, new Date('2026-11-02T10:00:00Z'));
      await flush();
    } finally {
      off();
    }
    expect(seen).toEqual([
      ['designs', d.id, true],
      ['projects', p.id, true],
    ]);
    expect(await db.designs.get(d.id)).toBeUndefined();
    expect(await db.projects.get(p.id)).toBeUndefined();
    const list = await dbm.listRecentlyDeleted();
    expect(list.map((r) => r.key)).toEqual([`projects:${p.id}`, `designs:${d.id}`]);
    expect(list[0]).toMatchObject({ table: 'projects', id: p.id, name: 'Pantry' });
    expect(list[1].deletedAt).toBe('2026-11-01T10:00:00.000Z');
  });

  it('a missing row moves nothing', async () => {
    await dbm.moveToRecentlyDeleted('designs', 'nope');
    expect(await db.recentlyDeleted.count()).toBe(0);
  });

  it('an unreadable row is moved as it is and restored unchanged (ADR-012)', async () => {
    const bad = { id: 'bad', updatedAt: '2026', name: 'bad', design: { v: 99 } };
    await db.designs.put(bad as never);
    await dbm.moveToRecentlyDeleted('designs', 'bad');
    expect((await dbm.listRecentlyDeleted())[0].row).toEqual(bad);
    expect(await dbm.restoreRecentlyDeleted('designs:bad')).toEqual({ ok: true });
    expect(await db.designs.get('bad')).toEqual(bad);
  });

  it('restore puts the row back unchanged and reports it saved', async () => {
    await dbm.saveProject(p);
    const before = await db.projects.get(p.id);
    await dbm.moveToRecentlyDeleted('projects', p.id);
    await flush();
    const seen: [string, string, boolean][] = [];
    const off = onSavedChange((c) => seen.push([c.table, c.key, c.deleted]));
    try {
      expect(await dbm.restoreRecentlyDeleted(`projects:${p.id}`)).toEqual({ ok: true });
      await flush();
    } finally {
      off();
    }
    expect(seen).toEqual([['projects', p.id, false]]);
    expect(await db.projects.get(p.id)).toEqual(before);
    expect(await db.recentlyDeleted.count()).toBe(0);
  });

  it('restore refuses a taken id and writes nothing', async () => {
    await dbm.saveDesign(d);
    await dbm.moveToRecentlyDeleted('designs', d.id);
    const again = { ...d, name: 'Saved again' };
    await dbm.saveDesign(again);
    expect(await dbm.restoreRecentlyDeleted(`designs:${d.id}`)).toEqual({
      ok: false,
      reason: 'taken',
    });
    expect((await db.designs.get(d.id))?.name).toBe('Saved again');
    expect(await db.recentlyDeleted.count()).toBe(1);
    expect(await dbm.restoreRecentlyDeleted('designs:gone')).toEqual({
      ok: false,
      reason: 'missing',
    });
  });

  it('delete forever removes only that row', async () => {
    await dbm.saveDesign(d);
    await dbm.saveProject(p);
    await dbm.moveToRecentlyDeleted('designs', d.id);
    await dbm.moveToRecentlyDeleted('projects', p.id);
    await dbm.deleteForever(`designs:${d.id}`);
    expect((await dbm.listRecentlyDeleted()).map((r) => r.key)).toEqual([`projects:${p.id}`]);
  });

  it('the purge removes readable rows older than 30 days, keeps newer and unreadable rows, and counts', async () => {
    const now = new Date('2026-12-31T12:00:00Z');
    const at = (days: number) => new Date(now.getTime() - days * DAY);
    const old1 = { ...templates[0].create(), id: 'old1' };
    const old2 = newProject('Old project');
    const fresh = { ...templates[0].create(), id: 'fresh' };
    await dbm.saveDesign(old1);
    await dbm.saveProject(old2);
    await dbm.saveDesign(fresh);
    await db.designs.put({ id: 'bad', updatedAt: '2026', name: 'bad', design: { v: 99 } } as never);
    await dbm.moveToRecentlyDeleted('designs', 'old1', at(31));
    await dbm.moveToRecentlyDeleted('projects', old2.id, at(40));
    await dbm.moveToRecentlyDeleted('designs', 'fresh', at(29));
    await dbm.moveToRecentlyDeleted('designs', 'bad', at(90));
    // A row whose date cannot be read is kept too.
    await db.recentlyDeleted.put({
      key: 'designs:nodate',
      table: 'designs',
      id: 'nodate',
      name: 'x',
      deletedAt: 'not a date',
      row: { id: 'nodate', name: 'x', updatedAt: '2026', design: old1 },
    });
    expect(await dbm.purgeRecentlyDeleted(now)).toBe(2);
    expect((await dbm.listRecentlyDeleted()).map((r) => r.key).sort()).toEqual(
      ['designs:bad', 'designs:fresh', 'designs:nodate'].sort(),
    );
    // Run again: nothing more to remove.
    expect(await dbm.purgeRecentlyDeleted(now)).toBe(0);
  });

  it('pictures a Recently deleted item uses are not unused', async () => {
    await db.images.put({
      id: 'pic1',
      name: 'p',
      type: 'image/png',
      width: 1,
      height: 1,
      bytes: new Uint8Array([1]).buffer,
      createdAt: '2026',
    });
    await db.recentlyDeleted.put({
      key: 'designs:x',
      table: 'designs',
      id: 'x',
      name: 'x',
      deletedAt: '2026-11-01T00:00:00Z',
      row: { id: 'x', name: 'x', updatedAt: '2026', design: { imageId: 'pic1' } as never },
    });
    expect(await dbm.unusedImageIds()).toEqual([]);
  });
});
