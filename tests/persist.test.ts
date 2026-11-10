import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { SCHEMA_VERSION, templates } from '../src/core/design';
import { newProject, PROJECT_SCHEMA } from '../src/core/project';
import {
  copyDesign,
  copyProject,
  db,
  deleteDesign,
  listDesigns,
  loadDesign,
  saveDesign,
  saveProject,
} from '../src/persist/db';
import * as dbm from '../src/persist/db';
import { restoreFiles } from '../src/persist/backup';
import { onSavedChange } from '../src/persist/events';
import { makeVersion } from '../src/core/projectVersion';

// ADR-237: every test starts from an empty database so the tests pass in any order. The module is shared (ADR-235's
// tests read its exports directly), so the rows are cleared instead of swapping the IndexedDB factory.
beforeEach(async () => {
  await Promise.all(db.tables.map((table) => table.clear()));
});

describe('local storage', () => {
  it('saves, lists newest first, loads and deletes designs', async () => {
    const a = { ...templates[0].create(), updatedAt: '2026-01-01T00:00:00.000Z' };
    const b = { ...templates[1].create(), updatedAt: '2026-02-01T00:00:00.000Z' };
    await saveDesign(a);
    await saveDesign(b);
    expect((await listDesigns()).map((r) => r.id)).toEqual([b.id, a.id]);
    expect(await loadDesign(a.id)).toEqual(a);
    await saveDesign({ ...a, name: 'Renamed' });
    expect((await loadDesign(a.id))?.name).toBe('Renamed');
    await deleteDesign(a.id);
    expect(await loadDesign(a.id)).toBeUndefined();
  });
  it('skips a corrupt stored row instead of loading it', async () => {
    const d = templates[0].create();
    await db.designs.put({
      id: d.id,
      name: d.name,
      updatedAt: d.updatedAt,
      design: { ...d, schemaVersion: 99 } as never,
    });
    expect(await loadDesign(d.id)).toBeUndefined();
    expect(await db.designs.get(d.id)).toBeDefined(); // never deleted
  });
});

describe('copy a saved design or project (ADR-227)', () => {
  it('a valid design and project copy with a new id and the same content', async () => {
    const d = templates[0].create();
    await saveDesign(d);
    const rd = await copyDesign(d.id, 'Design copy');
    if (!rd.ok) throw new Error(rd.reason);
    expect(rd.id).not.toBe(d.id);
    const cd = await loadDesign(rd.id);
    expect(cd).toEqual({
      ...d,
      id: rd.id,
      name: 'Design copy',
      createdAt: cd!.createdAt,
      updatedAt: cd!.updatedAt,
    });
    expect(await loadDesign(d.id)).toEqual(d); // the source is untouched

    const p = newProject('Kitchen');
    await saveProject(p);
    const rp = await copyProject(p.id, 'Kitchen (copy)');
    if (!rp.ok) throw new Error(rp.reason);
    const row = await db.projects.get(rp.id);
    expect(row?.name).toBe('Kitchen (copy)');
    expect(row?.project).toEqual({
      ...p,
      id: rp.id,
      name: 'Kitchen (copy)',
      createdAt: row!.project.createdAt,
      updatedAt: row!.project.updatedAt,
    });
  });

  it('a copy of an older-version row is written at the current schemaVersion', async () => {
    const d = { ...templates[0].create(), schemaVersion: 8 } as never as ReturnType<
      (typeof templates)[0]['create']
    >;
    await saveDesign(d);
    const rd = await copyDesign(d.id, 'Old copy');
    if (!rd.ok) throw new Error(rd.reason);
    expect((await loadDesign(rd.id))?.schemaVersion).toBe(SCHEMA_VERSION);
    const p = { ...newProject('Old'), schemaVersion: 20 } as never as ReturnType<typeof newProject>;
    await saveProject(p);
    const rp = await copyProject(p.id, 'Old (copy)');
    if (!rp.ok) throw new Error(rp.reason);
    expect((await db.projects.get(rp.id))?.project.schemaVersion).toBe(PROJECT_SCHEMA);
  });

  it('a corrupt or missing row is refused with a reason; nothing is added or changed', async () => {
    const d = templates[0].create();
    const badDesign = {
      id: d.id,
      name: d.name,
      updatedAt: d.updatedAt,
      design: { ...d, schemaVersion: 99 },
    };
    await db.designs.put(badDesign as never);
    const p = newProject('Broken');
    const badProject = {
      id: p.id,
      name: p.name,
      updatedAt: p.updatedAt,
      project: { ...p, schemaVersion: 99 },
    };
    await db.projects.put(badProject as never);
    const garbage = { id: 'garbage', name: 'x', updatedAt: '2026', project: 'not a project' };
    await db.projects.put(garbage as never);
    const counts = async () => [await db.designs.count(), await db.projects.count()];
    const before = await counts();

    const rd = await copyDesign(d.id, 'copy');
    const rp = await copyProject(p.id, 'copy');
    const rg = await copyProject('garbage', 'copy');
    const rm = await copyProject('missing', 'copy');
    for (const r of [rd, rp, rg, rm]) {
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.reason.length).toBeGreaterThan(0);
    }
    expect(await counts()).toEqual(before);
    expect(await db.designs.get(d.id)).toEqual(badDesign); // kept as it was (ADR-012)
    expect(await db.projects.get(p.id)).toEqual(badProject);
    expect(await db.projects.get('garbage')).toEqual(garbage);
  });
});

describe('every write reports its change (ADR-235)', () => {
  type Seen = [table: string, key: string, deleted: boolean];
  const flush = () => new Promise((r) => setTimeout(r, 10));
  const img = (id: string) => ({
    id,
    name: id,
    type: 'image/png',
    width: 1,
    height: 1,
    bytes: new Uint8Array([1]).buffer,
    createdAt: '2026',
  });
  const model = (id: string) => ({
    id,
    name: id,
    format: 'glb',
    bytes: new Uint8Array([1]).buffer,
    size: { w: 1, h: 1, d: 1 },
    triangles: 1,
    createdAt: '2026',
  });
  const d = templates[0].create();
  const p = newProject('Emits');
  const v = (id: string) => ({ ...makeVersion(p, 'manual'), id });
  let copiedDesign = '';
  let copiedProject = '';
  // Every write function of `src/persist/db.ts`, in order, with the changes it must report. A new write function
  // fails the listing check below until it is added here (and emits).
  const cases: [name: string, run: () => Promise<unknown>, expected: () => Seen[]][] = [
    ['saveDesign', () => dbm.saveDesign(d), () => [['designs', d.id, false]]],
    [
      'copyDesign',
      async () => {
        const r = await dbm.copyDesign(d.id, 'c');
        if (r.ok) copiedDesign = r.id;
      },
      () => [['designs', copiedDesign, false]],
    ],
    ['deleteDesign', () => dbm.deleteDesign(d.id), () => [['designs', d.id, true]]],
    ['saveProject', () => dbm.saveProject(p), () => [['projects', p.id, false]]],
    [
      'copyProject',
      async () => {
        const r = await dbm.copyProject(p.id, 'c');
        if (r.ok) copiedProject = r.id;
      },
      () => [['projects', copiedProject, false]],
    ],
    ['deleteProject', () => dbm.deleteProject(p.id), () => [['projects', p.id, true]]],
    [
      'saveProjectVersion',
      async () => {
        await dbm.saveProjectVersion(v('v1'));
      },
      () => [['projectVersions', 'v1', false]],
    ],
    [
      'deleteProjectVersion',
      () => dbm.deleteProjectVersion('v1'),
      () => [['projectVersions', 'v1', true]],
    ],
    [
      'deleteProjectVersions',
      async () => {
        await dbm.db.projectVersions.bulkPut([v('v2'), v('v3')]);
        await flush();
        seen.length = 0;
        await dbm.deleteProjectVersions(['v2', 'v3']);
      },
      () => [
        ['projectVersions', 'v2', true],
        ['projectVersions', 'v3', true],
      ],
    ],
    [
      'saveTemplate',
      () => dbm.saveTemplate({ id: 't1', updatedAt: '2026' } as never),
      () => [['templates', 't1', false]],
    ],
    ['deleteTemplate', () => dbm.deleteTemplate('t1'), () => [['templates', 't1', true]]],
    [
      'saveResearchBundle',
      () => dbm.saveResearchBundle({ key: 'k1', docId: 'doc' } as never),
      () => [['researchDocs', 'k1', false]],
    ],
    [
      'saveResearchMarks',
      () => dbm.saveResearchMarks([{ id: 'm1' }, { id: 'm2' }] as never),
      () => [
        ['researchMarks', 'm1', false],
        ['researchMarks', 'm2', false],
      ],
    ],
    [
      'saveGapMark',
      () => dbm.saveGapMark({ gapId: 'G-1', updatedAt: '2026' } as never),
      () => [['gapMarks', 'G-1', false]],
    ],
    [
      'saveGapMarks',
      () => dbm.saveGapMarks([{ gapId: 'G-1' }, { gapId: 'G-2' }] as never),
      () => [
        ['gapMarks', 'G-1', false],
        ['gapMarks', 'G-2', false],
      ],
    ],
    ['saveImage', () => dbm.saveImage(img('i1')), () => [['images', 'i1', false]]],
    [
      'deleteImages',
      async () => {
        await dbm.saveImage(img('i2'));
        await flush();
        seen.length = 0;
        await dbm.deleteImages(['i1', 'i2']);
      },
      () => [
        ['images', 'i1', true],
        ['images', 'i2', true],
      ],
    ],
    [
      'replaceDecors',
      async () => {
        await dbm.db.decors.put({ id: 'old' } as never);
        await flush();
        seen.length = 0;
        await dbm.replaceDecors([{ id: 'x1' }, { id: 'x2' }] as never);
      },
      () => [
        ['decors', 'old', true],
        ['decors', 'x1', false],
        ['decors', 'x2', false],
      ],
    ],
    [
      'clearDecors',
      () => dbm.clearDecors(),
      () => [
        ['decors', 'x1', true],
        ['decors', 'x2', true],
      ],
    ],
    // Bands are not part of the folder backup or the account (BACKUP_TABLES): no change reported, as before.
    ['replaceBands', () => dbm.replaceBands([{ id: 'b1' }] as never), () => []],
    // The band list is not backed up (ADR-212): clearing it reports nothing (ADR-255).
    ['clearBands', () => dbm.clearBands(), () => []],
    [
      'saveProjectTemplate',
      () => dbm.saveProjectTemplate({ id: 'pt1', name: 'n', updatedAt: '2026' } as never),
      () => [['projectTemplates', 'pt1', false]],
    ],
    [
      'deleteProjectTemplate',
      () => dbm.deleteProjectTemplate('pt1'),
      () => [['projectTemplates', 'pt1', true]],
    ],
    [
      'saveFastener',
      () => dbm.saveFastener({ joint: 'cam', name: 'Cam', per: 2 } as never),
      () => [['prices', 'fastener:cam', false]],
    ],
    [
      'deleteFastener',
      () => dbm.deleteFastener('cam' as never),
      () => [['prices', 'fastener:cam', true]],
    ],
    [
      'savePrice',
      () => dbm.savePrice({ id: 'pr1', unit: 'piece', amount: 1 } as never),
      () => [['prices', 'pr1', false]],
    ],
    [
      'savePrices',
      () =>
        dbm.savePrices([
          { id: 'pr1', unit: 'piece', amount: 2 },
          { id: 'pr2', unit: 'piece', amount: 3 },
        ] as never),
      () => [
        ['prices', 'pr1', false],
        ['prices', 'pr2', false],
      ],
    ],
    ['deletePrice', () => dbm.deletePrice('pr1'), () => [['prices', 'pr1', true]]],
    ['saveModel', () => dbm.saveModel(model('mo1') as never), () => [['models', 'mo1', false]]],
    ['deleteModelIfUnused', () => dbm.deleteModelIfUnused('mo1'), () => [['models', 'mo1', true]]],
    // Links to account records (ADR-128, named functions since ADR-223) are not saved work: no change reported.
    [
      'saveAccountLink',
      () => dbm.saveAccountLink({ accountId: 'a', table: 'designs', localId: 'l1' }),
      () => [],
    ],
    [
      'deleteAccountLink',
      () => dbm.deleteAccountLink({ accountId: 'a', table: 'designs', localId: 'l1' }),
      () => [],
    ],
    // Device settings are not saved work: no change reported.
    ['setSetting', () => dbm.setSetting('k', 1), () => []],
    ['deleteSetting', () => dbm.deleteSetting('k'), () => []],
  ];

  const seen: Seen[] = [];
  const sorted = (l: Seen[]) => [...l].sort((a, b) => a.join().localeCompare(b.join()));

  it('the list covers every write function of src/persist/db.ts', () => {
    const writers = Object.keys(dbm)
      .filter((n) => /^(save|delete|replace|clear|copy|set)[A-Z]/.test(n))
      .sort();
    expect(cases.map(([n]) => n).sort()).toEqual(writers);
  });

  it('each write reports one change per row with the right table and key, after the write', async () => {
    await dbm.db.delete();
    await dbm.db.open();
    const off = onSavedChange((c) => seen.push([c.table, c.key, c.deleted]));
    try {
      for (const [name, run, expected] of cases) {
        seen.length = 0;
        await run();
        await flush();
        expect([name, sorted(seen)]).toEqual([name, sorted(expected())]);
      }
      // Restore adds rows outside the save functions: it reports them too.
      seen.length = 0;
      await restoreFiles([
        { path: 'prices/r1.json', text: '{"id":"r1","unit":"piece","amount":1}' },
      ]);
      await flush();
      expect(seen).toEqual([['prices', 'r1', false]]);
    } finally {
      off();
    }
  });
});

// ADR-223: the ui saves through `src/store/libraryStore.ts`. Each library write runs the persist function of the same
// name, so it reports exactly the changes the direct call reported (the folder backup and the account upload follow
// them). Each case runs from an empty database twice, once directly and once through the library, and the reported
// changes must be the same and not empty where the direct call reports any.
describe('library writes report their changes like the direct calls (ADR-223)', () => {
  type Seen = [table: string, key: string, deleted: boolean];
  type Writes = Record<string, (...args: never[]) => Promise<unknown>>;
  const flush = () => new Promise((r) => setTimeout(r, 10));
  const d = templates[0].create();
  const p = newProject('Library');
  const v = (id: string) => ({ ...makeVersion(p, 'manual'), id });
  const img = (id: string) => ({
    id,
    name: id,
    type: 'image/png',
    width: 1,
    height: 1,
    bytes: new Uint8Array([1]).buffer,
    createdAt: '2026',
  });
  // [name, rows put first (not counted), the write with the module's function of that name]
  const cases: [
    name: string,
    seed: () => Promise<unknown>,
    run: (m: Writes) => Promise<unknown>,
  ][] = [
    ['saveDesign', async () => {}, (m) => m.saveDesign(d as never)],
    ['copyDesign', () => dbm.saveDesign(d), (m) => m.copyDesign(d.id as never, 'c' as never)],
    ['deleteDesign', () => dbm.saveDesign(d), (m) => m.deleteDesign(d.id as never)],
    ['saveProject', async () => {}, (m) => m.saveProject(p as never)],
    ['copyProject', () => dbm.saveProject(p), (m) => m.copyProject(p.id as never, 'c' as never)],
    ['deleteProject', () => dbm.saveProject(p), (m) => m.deleteProject(p.id as never)],
    [
      'deleteProjectVersion',
      () => dbm.saveProjectVersion(v('v1')),
      (m) => m.deleteProjectVersion('v1' as never),
    ],
    [
      'deleteProjectVersions',
      () => db.projectVersions.bulkPut([v('v2'), v('v3')]),
      (m) => m.deleteProjectVersions(['v2', 'v3'] as never),
    ],
    [
      'saveProjectTemplate',
      async () => {},
      (m) => m.saveProjectTemplate({ id: 'pt1', name: 'n', updatedAt: '2026' } as never),
    ],
    [
      'deleteProjectTemplate',
      () => dbm.saveProjectTemplate({ id: 'pt1', name: 'n', updatedAt: '2026' } as never),
      (m) => m.deleteProjectTemplate('pt1' as never),
    ],
    [
      'saveTemplate',
      async () => {},
      (m) => m.saveTemplate({ id: 't1', updatedAt: '2026' } as never),
    ],
    [
      'replaceDecors',
      () => db.decors.put({ id: 'old' } as never),
      (m) => m.replaceDecors([{ id: 'x1' }, { id: 'x2' }] as never),
    ],
    [
      'clearDecors',
      () => db.decors.bulkPut([{ id: 'x1' }, { id: 'x2' }] as never),
      (m) => m.clearDecors(),
    ],
    ['replaceBands', async () => {}, (m) => m.replaceBands([{ id: 'b1' }] as never)],
    ['clearBands', async () => {}, (m) => m.clearBands()],
    [
      'saveGapMark',
      async () => {},
      (m) => m.saveGapMark({ gapId: 'G-1', updatedAt: '2026' } as never),
    ],
    [
      'saveGapMarks',
      async () => {},
      (m) => m.saveGapMarks([{ gapId: 'G-1' }, { gapId: 'G-2' }] as never),
    ],
    [
      'deleteImages',
      () => db.images.bulkPut([img('i1'), img('i2')]),
      (m) => m.deleteImages(['i1', 'i2'] as never),
    ],
    [
      'deleteModelIfUnused',
      () =>
        db.models.put({
          id: 'mo1',
          name: 'mo1',
          format: 'glb',
          bytes: new Uint8Array([1]).buffer,
          size: { w: 1, h: 1, d: 1 },
          triangles: 1,
          createdAt: '2026',
        }),
      (m) => m.deleteModelIfUnused('mo1' as never),
    ],
    [
      'savePrices',
      async () => {},
      (m) =>
        m.savePrices([
          { id: 'pr1', unit: 'piece', amount: 2 },
          { id: 'pr2', unit: 'piece', amount: 3 },
        ] as never),
    ],
    ['setSetting', async () => {}, (m) => m.setSetting('k' as never, 1 as never)],
  ];
  const writers = /^(save|delete|replace|clear|copy|set)[A-Z]/;

  it('the list covers every write of the library, each a persist write of the same name', async () => {
    const lib = await import('../src/store/libraryStore');
    const names = Object.keys(lib)
      .filter((n) => writers.test(n))
      .sort();
    expect(cases.map(([n]) => n).sort()).toEqual(names);
    for (const n of names) expect(typeof (dbm as unknown as Writes)[n], n).toBe('function');
  });

  it('each library write reports the same changes as the direct persist call', async () => {
    const lib = (await import('../src/store/libraryStore')) as unknown as Writes;
    const known = new Set([d.id, p.id]);
    const seen: Seen[] = [];
    // A copy gets a new random id each run: compared as "<new id>".
    const sorted = (l: Seen[], copy: boolean) =>
      l
        .map(([t, k, del]): Seen => [t, copy && !known.has(k) ? '<new id>' : k, del])
        .sort((a, b) => a.join().localeCompare(b.join()));
    const once = async (
      name: string,
      seed: () => Promise<unknown>,
      run: () => Promise<unknown>,
    ) => {
      await Promise.all(db.tables.map((table) => table.clear()));
      await seed();
      await flush();
      seen.length = 0;
      await run();
      await flush();
      return sorted(seen, name.startsWith('copy'));
    };
    const off = onSavedChange((c) => seen.push([c.table, c.key, c.deleted]));
    try {
      for (const [name, seed, run] of cases) {
        const direct = await once(name, seed, () => run(dbm as unknown as Writes));
        const viaLibrary = await once(name, seed, () => run(lib));
        expect([name, viaLibrary]).toEqual([name, direct]);
        if (!['replaceBands', 'clearBands', 'setSetting'].includes(name))
          expect(direct.length, name).toBeGreaterThan(0);
      }
    } finally {
      off();
    }
  });
});
