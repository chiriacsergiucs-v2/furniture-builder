import 'fake-indexeddb/auto';
import Dexie from 'dexie';
import { beforeEach, describe, expect, it } from 'vitest';
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
import { unzipStore, zipStore } from '../src/core/zip';
import { db, getSetting, saveDesign, setSetting } from '../src/persist/db';
import { backupZip, readTables, restoreFiles, restoreFromZip } from '../src/persist/backup';
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
  it('never overwrites or deletes: identical items skipped, others become new copies', () => {
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
    for (const act of p.actions) {
      if (act.table !== 'designs') throw new Error('designs only');
      expect([a.id, b.id]).not.toContain(act.design.id); // new ids (ADR-011)
    }
    const again = planRestore(files, { designs: [a], projects: [], templates: [], keys: {} });
    expect(again.identical).toBe(1);
    expect(again.actions).toHaveLength(1);
  });

  it('an item restored once is identical the second time, even under its new id', () => {
    const a = design(0);
    const files = planBackup({ designs: [{ id: a.id, design: a }] });
    const first = planRestore(files, { designs: [], projects: [], templates: [], keys: {} });
    const restored = (first.actions[0] as { design: typeof a }).design;
    const second = planRestore(files, { designs: [restored], projects: [], templates: [], keys: {} });
    expect(second.actions).toHaveLength(0);
    expect(second.identical).toBe(1);
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
    const files = planBackup({ prices: [{ id: 'p1', price: 1 }, { id: 'p2', price: 2 }] });
    const p = planRestore(files, {
      designs: [],
      projects: [],
      templates: [],
      keys: { prices: new Set(['p1']) },
    });
    expect(p.actions).toEqual([{ table: 'prices', row: { id: 'p2', price: 2 } }]);
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

  it('restore writes nothing for an invalid file and reports it', async () => {
    const p = await restoreFiles([{ path: 'designs/bad.json', text: '{}' }]);
    expect(p.skipped).toHaveLength(1);
    expect(await db.designs.count()).toBe(0);
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

  it('a version-10 database upgrades to 11 with every row, an unreadable one included', async () => {
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
    expect(nw.verno).toBe(11);
    expect((await nw.designs.get(d.id))?.design).toEqual(d);
    expect(await nw.designs.get('bad')).toBeDefined();
    expect(await nw.settings.count()).toBe(0);
    expect(await nw.accountLinks.count()).toBe(0);
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
    expect(
      reminderDue({ intervalDays: 7, firstSaveAt: ago(8), lastChangeAt: ago(1), now }),
    ).toBe(true);
    expect(reminderDue({ intervalDays: 7, lastChangeAt: ago(1), now })).toBe(false);
    expect(daysSince(ago(31), now)).toBe(31);
  });
});
