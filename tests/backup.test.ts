import 'fake-indexeddb/auto';
import Dexie from 'dexie';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  BACKUP_TABLES,
  decodeRow,
  encodeRow,
  planBackup,
  planRestore,
  safeName,
} from '../src/core/backup';
import { daysSince, deviceNoticeShown, reminderDue } from '../src/core/backupReminder';
import { templates } from '../src/core/design';
import { newProject } from '../src/core/project';
import { makeVersion } from '../src/core/projectVersion';
import { templateFromProject } from '../src/core/projectTemplate';
import { unzipStore, zipStore } from '../src/core/zip';
import { db, getSetting, saveDesign, setSetting } from '../src/persist/db';
import {
  backupZip,
  readTables,
  RestoreStopped,
  restoreFiles,
  restoreFromZip,
} from '../src/persist/backup';
import { onSavedChange } from '../src/persist/events';

const design = (i = 0) => templates[i].create();

describe('folder backup plan (ADR-133)', () => {
  it('one file per row in a folder per table; designs as the documents Import reads', () => {
    const d = design();
    const files = planBackup({
      designs: [{ id: d.id, name: d.name, updatedAt: d.updatedAt, design: d }],
      images: [{ id: 'img/1', bytes: new Uint8Array([1, 2, 3]).buffer }],
    });
    expect(files.map((f) => f.path)).toEqual([`designs/${d.id}.json`, 'images/img_1.json']);
    expect(JSON.parse(files[0].text)).toEqual(d);
    const img = decodeRow(files[1].text) as { bytes: ArrayBuffer };
    expect([...new Uint8Array(img.bytes)]).toEqual([1, 2, 3]);
  });

  it('covers every row of every table, unreadable rows copied as they are', () => {
    const tables: Record<string, unknown[]> = Object.fromEntries(
      BACKUP_TABLES.map(([t, key]) => [t, [{ [key]: `${t}-a` }, { [key]: `${t}-b`, junk: true }]]),
    );
    tables.designs = [{ id: 'bad', design: { schemaVersion: 99 } }];
    const files = planBackup(tables);
    expect(files).toHaveLength(1 + (BACKUP_TABLES.length - 1) * 2);
    expect(JSON.parse(files[0].text)).toEqual({ schemaVersion: 99 });
  });

  it('two keys with the same file name get distinct files', () => {
    const files = planBackup({ prices: [{ id: 'a/b' }, { id: 'a:b' }] });
    expect(new Set(files.map((f) => f.path)).size).toBe(2);
    expect(safeName('../..')).not.toContain('/');
    expect(safeName('')).toBe('item');
  });

  it('bytes survive encode → decode', () => {
    const row = { id: 'm', bytes: new Uint8Array([0, 255, 7]).buffer, n: 1 };
    const back = decodeRow(encodeRow(row)) as typeof row;
    expect([...new Uint8Array(back.bytes)]).toEqual([0, 255, 7]);
    expect(back.n).toBe(1);
  });
});

describe('restore plan (ADR-133, G-244)', () => {
  it('never overwrites or deletes: identical items skipped, others restored (new id when theirs is taken)', () => {
    const a = design(0);
    const b = design(1);
    const files = planBackup({
      designs: [
        { id: a.id, design: a },
        { id: b.id, design: b },
      ],
    });
    const changedA = { ...a, name: 'Changed since' };
    const p = planRestore(files, { designs: [changedA], projects: [], templates: [], keys: {} });
    expect(p.identical).toBe(0);
    expect(p.actions).toHaveLength(2);
    const ids = p.actions.map((act) => (act.table === 'designs' ? act.design.id : ''));
    // a's id is taken on this device: a new copy with a new id; b's is free: it keeps it (G-282).
    expect(ids).not.toContain(a.id);
    expect(ids).toContain(b.id);
    const again = planRestore(files, { designs: [a], projects: [], templates: [], keys: {} });
    expect(again.identical).toBe(1);
    expect(again.actions).toHaveLength(1);
  });

  it('an item restored once is identical the second time, even under its new id', () => {
    const a = design(0);
    const files = planBackup({ designs: [{ id: a.id, design: a }] });
    const first = planRestore(files, { designs: [], projects: [], templates: [], keys: {} });
    const restored = (first.actions[0] as { design: typeof a }).design;
    const second = planRestore(files, {
      designs: [restored],
      projects: [],
      templates: [],
      keys: {},
    });
    expect(second.actions).toHaveLength(0);
    expect(second.identical).toBe(1);
  });

  it('a restored item keeps its id when nothing on the device uses it, else gets a new one (G-282)', () => {
    const a = design(0);
    const b = design(1);
    const c = design(2);
    const twin = { ...a, name: 'Same id, other content' };
    const files = [
      ...planBackup({ designs: [{ id: a.id, design: a }] }),
      { path: 'designs/twin.json', text: encodeRow(twin) },
      ...planBackup({ designs: [{ id: b.id, design: b }], templates: [] }),
      ...planBackup({ designs: [{ id: c.id, design: c }] }),
    ];
    // b is taken by a saved row the app cannot read: never overwritten (ADR-012), so b gets a new id too.
    const p = planRestore(files, {
      designs: [],
      projects: [],
      templates: [],
      keys: {},
      ids: { designs: new Set([b.id]) },
    });
    const got = p.actions.map((act) => (act.table === 'designs' ? act.design : null)!);
    expect(got.map((d) => d.name)).toEqual([a.name, twin.name, b.name, c.name]);
    expect(got[0].id).toBe(a.id); // free: kept, so versions and template links find it again
    expect(got[1].id).not.toBe(a.id); // taken earlier in the same restore
    expect(got[2].id).not.toBe(b.id); // taken by an unreadable row
    expect(got[3].id).toBe(c.id);
    expect(new Set(got.map((d) => d.id)).size).toBe(4);
  });

  it('invalid files are listed by name and nothing throws', () => {
    const p = planRestore(
      [
        { path: 'designs/x.json', text: '{"schemaVersion":99}' },
        { path: 'designs/y.json', text: 'not json' },
        { path: 'notes.txt', text: 'hello' },
        { path: 'prices/z.json', text: '{"nokey":1}' },
      ],
      { designs: [], projects: [], templates: [], keys: {} },
    );
    expect(p.actions).toHaveLength(0);
    expect(p.skipped.map((s) => s.path)).toEqual([
      'designs/x.json',
      'designs/y.json',
      'notes.txt',
      'prices/z.json',
    ]);
  });

  it('other rows are added only when their key is free', () => {
    const files = planBackup({
      prices: [
        { id: 'p1', unit: 'piece', amount: 1 },
        { id: 'p2', unit: 'piece', amount: 2 },
      ],
    });
    const p = planRestore(files, {
      designs: [],
      projects: [],
      templates: [],
      keys: { prices: new Set(['p1']) },
    });
    expect(p.actions).toEqual([
      { table: 'prices', row: { id: 'p2', unit: 'piece', amount: 2 }, path: 'prices/p2.json' },
    ]);
  });
});

// G-542: every non-design row is checked against its table's shape before it is restored; a bad row is listed, never
// stored, and the rows already saved are untouched.
describe('restore checks each row against its table (G-542)', () => {
  const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3]).buffer;
  const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0]).buffer;
  const empty = { designs: [], projects: [], templates: [], keys: {} };
  const p = newProject('Kept');
  const good: Record<string, Record<string, unknown>> = {
    prices: { id: 'board:x', unit: 'sheet', amount: 1200 },
    gapMarks: { gapId: 'G-001', decision: null, note: '', updatedAt: '2026-11-27' },
    images: {
      id: 'img-1',
      name: 'oak.jpg',
      type: 'image/jpeg',
      width: 2,
      height: 1,
      bytes: jpeg,
      createdAt: '2026-11-27',
    },
    models: {
      id: 'm1',
      name: 'Fridge',
      format: 'glb',
      bytes: new Uint8Array([1, 2, 3]).buffer,
      size: { w: 600, h: 1800, d: 650 },
      triangles: 12,
      thumb: png,
      createdAt: '2026-11-27',
    },
    decors: {
      id: 'egger:H1145:18',
      maker: 'egger',
      makerText: 'Egger',
      kind: 'pal',
      code: 'H1145',
      name: 'Natural Bardolino Oak',
      thickness: 18,
      color: '#a07850',
      list: 'egger.csv',
    },
    projectVersions: { ...makeVersion(p, 'manual'), id: 'v1' },
    projectTemplates: (() => {
      const tpl = templateFromProject(p, 'Kit');
      return { id: tpl.id, name: tpl.name, updatedAt: tpl.updatedAt, template: tpl };
    })(),
    researchMarks: { id: 'r1' },
  };
  const bad: [string, Record<string, unknown>][] = [
    ['prices', { id: 'board:y', unit: 'barrel', amount: 1 }],
    ['gapMarks', { gapId: 'G-002', decision: 'maybe', note: '', updatedAt: '' }],
    ['images', { ...good.images, id: 'img-2', type: 'image/png' }], // JPEG bytes declared as PNG
    ['images', { ...good.images, id: 'img-3', bytes: 'not bytes' }],
    ['images', { ...good.images, id: 'img-4', width: 99999 }],
    ['models', { ...good.models, id: 'm2', format: 'obj' }],
    ['models', { ...good.models, id: 'm3', thumb: jpeg }],
    ['decors', { ...good.decors, id: 'egger:H2:18', thickness: -1 }],
    ['projectVersions', { ...good.projectVersions, id: 'v2', project: { junk: true } }],
    ['projectTemplates', { ...good.projectTemplates, id: 't2', template: { kind: 'x' } }],
  ];
  const file = (table: string, row: Record<string, unknown>) => ({
    path: `${table}/${String(row.gapId ?? row.id)}.json`,
    text: encodeRow(row),
  });

  it('a row of the right shape is restored', () => {
    const plan = planRestore(
      Object.entries(good).map(([t, r]) => file(t, r)),
      empty,
    );
    expect(plan.skipped).toEqual([]);
    expect(plan.actions.map((a) => a.table).sort()).toEqual(Object.keys(good).sort());
  });

  it('a row of the wrong shape is listed with its reason and not restored', () => {
    const plan = planRestore(
      bad.map(([t, r]) => file(t, r)),
      empty,
    );
    expect(plan.actions).toEqual([]);
    expect(plan.skipped.map((s) => s.path)).toEqual(bad.map(([t, r]) => file(t, r).path));
    for (const s of plan.skipped) expect(s.reason.length).toBeGreaterThan(0);
    const reason = (path: string) => plan.skipped.find((s) => s.path === path)!.reason;
    expect(reason('images/img-2.json')).toMatch(/do not match its type/);
    expect(reason('images/img-3.json')).toMatch(/picture bytes missing/);
    expect(reason('models/m3.json')).toMatch(/thumbnail/);
  });
});

describe('device storage: backup .zip and restore (ADR-133)', () => {
  beforeEach(async () => {
    await db.designs.clear();
    await db.settings.clear();
  });

  it('a .zip backup round-trips through restore as new copies, keeping saved rows', async () => {
    const a = design(0);
    await saveDesign(a);
    const { blob, status } = await backupZip();
    expect(status.items).toBeGreaterThanOrEqual(1);
    const file = new File([await blob.arrayBuffer()], 'b.zip');
    const before = await db.designs.toArray();
    const same = await restoreFromZip(file);
    expect(same.actions).toHaveLength(0); // identical: nothing added
    await db.designs.put({ ...before[0], name: 'Edited', design: { ...a, name: 'Edited' } });
    const p = await restoreFromZip(file);
    expect(p.actions).toHaveLength(1);
    const rows = await db.designs.toArray();
    expect(rows).toHaveLength(2);
    expect(rows.find((r) => r.id === a.id)?.name).toBe('Edited'); // never overwritten
  });

  it('a restore keeps a free id and never overwrites an unreadable row under a taken one (G-282)', async () => {
    const a = design(0);
    const b = design(1);
    await db.designs.put({ id: b.id, name: 'x', updatedAt: '2026', design: {} as never });
    await restoreFiles(
      planBackup({
        designs: [
          { id: a.id, design: a },
          { id: b.id, design: b },
        ],
      }),
    );
    expect((await db.designs.get(a.id))?.design.name).toBe(a.name);
    expect((await db.designs.get(b.id))?.design).toEqual({}); // the unreadable row stays as it was
    const rows = await db.designs.toArray();
    expect(rows).toHaveLength(3);
    expect(rows.some((r) => r.id !== b.id && r.design.name === b.name)).toBe(true);
  });

  it('restore writes nothing for an invalid file and reports it', async () => {
    const p = await restoreFiles([{ path: 'designs/bad.json', text: '{}' }]);
    expect(p.skipped).toHaveLength(1);
    expect(await db.designs.count()).toBe(0);
  });

  // G-489: a restore runs in one transaction; a row the storage refuses leaves the library as it was and says nothing.
  it('a restore that fails on a row leaves the library unchanged and reports nothing as saved', async () => {
    const kept = design(0);
    await saveDesign(kept);
    const incoming = design(1);
    const files = [
      { path: `designs/${incoming.id}.json`, text: JSON.stringify(incoming) },
      { path: 'prices/r1.json', text: '{"id":"r1","unit":"piece","amount":1}' },
    ];
    // The storage refuses the price row (a full disk, say), after the design was written in the same restore.
    const proto = Object.getPrototypeOf(db.prices) as { add: (...a: unknown[]) => unknown };
    const real = proto.add;
    const add = vi.spyOn(proto, 'add').mockImplementation(function (this: { name: string }, ...a) {
      return this.name === 'prices'
        ? Dexie.Promise.reject(new Error('quota'))
        : real.apply(this, a);
    });
    const seen: string[] = [];
    const off = onSavedChange((c) => seen.push(`${c.table}:${String(c.key)}`));
    const err = await restoreFiles(files).catch((e: unknown) => e);
    const refused = add.mock.calls.length;
    add.mockRestore();
    await new Promise((r) => setTimeout(r, 10));
    off();
    expect(refused).toBeGreaterThan(0);
    expect(err).toBeInstanceOf(RestoreStopped);
    expect((err as RestoreStopped).done).toBe(0);
    expect((await db.designs.toArray()).map((r) => r.id)).toEqual([kept.id]);
    expect(await db.prices.count()).toBe(0);
    expect(seen).toEqual([]);
    // The same files restore in full once the storage accepts them.
    expect((await restoreFiles(files)).actions).toHaveLength(2);
    expect(await db.designs.count()).toBe(2);
    expect(await db.prices.count()).toBe(1);
  });

  it('readTables reads every table, unreadable rows included', async () => {
    await db.designs.put({ id: 'bad', name: 'x', updatedAt: '2026', design: {} as never });
    const t = await readTables();
    expect(Object.keys(t).sort()).toEqual(BACKUP_TABLES.map(([n]) => n).sort());
    expect(t.designs).toHaveLength(1);
  });

  it('saving fires a change after the write; settings do not', async () => {
    const seen: string[] = [];
    const off = onSavedChange((c) => seen.push(`${c.table}:${c.deleted}`));
    await saveDesign(design(0));
    await setSetting('x', 1);
    await new Promise((r) => setTimeout(r, 10));
    off();
    expect(seen).toEqual(['designs:false']);
    expect(await getSetting('x')).toBe(1);
  });

  it('a version-10 database upgrades to 12 with every row, an unreadable one included', async () => {
    const name = 'backup-upgrade-test';
    const old = new Dexie(name);
    old.version(10).stores({
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
    });
    await old.open();
    const d = design(0);
    await old.table('designs').put({ id: d.id, name: d.name, updatedAt: d.updatedAt, design: d });
    await old.table('designs').put({ id: 'bad', name: 'x', updatedAt: '2026', design: { v: 99 } });
    old.close();
    const Fresh = db.constructor as new (n: string) => typeof db;
    const nw = new Fresh(name);
    await nw.open();
    expect(nw.verno).toBe(13);
    expect((await nw.designs.get(d.id))?.design).toEqual(d);
    expect(await nw.designs.get('bad')).toBeDefined();
    expect(await nw.settings.count()).toBe(0);
    expect(await nw.accountLinks.count()).toBe(0);
    expect(await nw.bands.count()).toBe(0);
    nw.close();
  });
});

describe('zip reader', () => {
  it('reads back what zipStore writes', () => {
    const enc = new TextEncoder();
    const z = zipStore([
      { name: 'designs/a.json', data: enc.encode('{"a":1}') },
      { name: 'prices/b.json', data: enc.encode('{}') },
    ]);
    const { files, skipped } = unzipStore(z);
    expect(files.map((f) => f.name)).toEqual(['designs/a.json', 'prices/b.json']);
    expect(new TextDecoder().decode(files[0].data)).toBe('{"a":1}');
    expect(skipped).toEqual([]);
    expect(unzipStore(new Uint8Array([1, 2, 3])).files).toEqual([]);
  });
});

describe('device-only notice and backup reminder (ADR-140, ADR-141)', () => {
  const now = '2026-10-28T12:00:00.000Z';
  const ago = (days: number) => new Date(Date.parse(now) - days * 864e5).toISOString();
  it('notice: only while something is saved with no backup and no account copy; Dismiss hides 7 days', () => {
    const base = { savedItems: 3, accountCopies: 0, now };
    expect(deviceNoticeShown(base)).toBe(true);
    expect(deviceNoticeShown({ ...base, savedItems: 0 })).toBe(false);
    expect(deviceNoticeShown({ ...base, lastBackupAt: ago(1) })).toBe(false);
    expect(deviceNoticeShown({ ...base, accountCopies: 1 })).toBe(false);
    expect(deviceNoticeShown({ ...base, dismissedAt: ago(6) })).toBe(false);
    expect(deviceNoticeShown({ ...base, dismissedAt: ago(7) })).toBe(true);
  });
  it('reminder: due after the interval when something changed; Off and Later respected', () => {
    const base = { intervalDays: 30, lastBackupAt: ago(31), lastChangeAt: ago(2), now };
    expect(reminderDue(base)).toBe(true);
    expect(reminderDue({ ...base, lastBackupAt: ago(29) })).toBe(false);
    expect(reminderDue({ ...base, lastChangeAt: ago(40) })).toBe(false); // nothing changed since
    expect(reminderDue({ ...base, intervalDays: 0 })).toBe(false);
    expect(reminderDue({ ...base, laterAt: ago(0.5) })).toBe(false);
    expect(reminderDue({ ...base, laterAt: ago(1) })).toBe(true);
    expect(reminderDue({ intervalDays: 7, firstSaveAt: ago(8), lastChangeAt: ago(1), now })).toBe(
      true,
    );
    expect(reminderDue({ intervalDays: 7, lastChangeAt: ago(1), now })).toBe(false);
    expect(daysSince(ago(31), now)).toBe(31);
  });
});
