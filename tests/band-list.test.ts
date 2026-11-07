// ADR-212 (G-038): the user's band list. `parseBandList` reads CSV with the columns manufacturer, type, code, decor,
// name, thickness, width, color (thickness in mm with one decimal, stored in tenths; width whole mm; type abs, pvc, pp,
// melamine, veneer, else `other`), skips and lists bad rows and never throws; only what the file holds is used
// (ADR-010). The list lives in the `bands` table (Dexie version 12, additive); a new import replaces it. The band
// editor offers Matching bands first (decor or code equals the board's decor code, band at least as wide as the
// board) then the others by closeness to the board colour; a pick fills only the `EdgeBand` fields.
import 'fake-indexeddb/auto';
import Dexie from 'dexie';
import { describe, expect, it } from 'vitest';
import { BACKUP_TABLES } from '../src/core/backup';
import { bandFromList, bandsForBoard, parseBandList, validateBand } from '../src/core/materials';
import type { Material } from '../src/core/types';
import { db, listBands, replaceBands } from '../src/persist/db';

const HEAD = 'manufacturer,type,code,decor,name,thickness,width,color';

describe('parseBandList (ADR-212, G-038)', () => {
  it('reads thickness in tenths, width in whole mm, the type words and an optional decor', () => {
    const r = parseBandList(
      `\uFEFF${HEAD}\nEgger,ABS,B-H1145,H1145,Oak band,0.4,22,#B59A7A\nRehau,PVC,R2,,White,2,23,#ffffff\nX,PP,P1,,pp band,1.3,42,#000000\nX,Melamine,M1,,mel,0.3,19,#111111\nX,veneer,V1,,ven,0.6,25,#222222\nX,acrylic,A1,,other kind,1,23,#333333\n`,
      'bands.csv',
    );
    expect(r.problems).toEqual([]);
    expect(r.bands.map((b) => [b.kind, b.code, b.decor, b.thickness, b.width, b.color])).toEqual([
      ['abs', 'B-H1145', 'H1145', 4, 22, '#b59a7a'],
      ['pvc', 'R2', undefined, 20, 23, '#ffffff'],
      ['pp', 'P1', undefined, 13, 42, '#000000'],
      ['melamine', 'M1', undefined, 3, 19, '#111111'],
      ['veneer', 'V1', undefined, 6, 25, '#222222'],
      ['other', 'A1', undefined, 10, 23, '#333333'],
    ]);
    expect(r.bands[0]).toMatchObject({ makerText: 'Egger', name: 'Oak band', list: 'bands.csv' });
    expect(r.bands.every(validateBand)).toBe(true);
    // A row without a decor has no decor key at all: nothing is invented (ADR-010).
    expect('decor' in r.bands[1]).toBe(false);
  });

  it('reads semicolons with a decimal comma, and Romanian headers', () => {
    const r = parseBandList(
      'Producător;Tip;Cod;Decor;Denumire;Grosime;Lățime;Culoare\nEgger;ABS;C1;U999;Negru;0,8;22;#000000',
      'ro.csv',
    );
    expect(r.problems).toEqual([]);
    expect(r.bands.map((b) => [b.code, b.thickness, b.width])).toEqual([['C1', 8, 22]]);
  });

  it('skips and lists bad rows, keeping the good ones', () => {
    const r = parseBandList(
      [
        HEAD,
        'Egger,ABS,OK,,good,0.4,22,#ffffff',
        'Egger,ABS,T1,,two decimals,0.45,22,#ffffff',
        'Egger,ABS,T2,,zero,0,22,#ffffff',
        'Egger,ABS,W1,,decimal width,1,22.5,#ffffff',
        'Egger,ABS,W2,,too wide,1,101,#ffffff',
        'Egger,ABS,C1,,bad colour,1,22,white',
        ',ABS,M1,,no maker,1,22,#ffffff',
        'Egger,ABS,,,no code,1,22,#ffffff',
        'Egger,ABS,N1,,,1,22,#ffffff',
        'Egger,ABS,OK,,again,0.4,22,#ffffff',
      ].join('\n'),
      'x.csv',
    );
    expect(r.bands.map((b) => b.code)).toEqual(['OK']);
    expect(r.problems).toEqual([
      'Row 3: thickness "0.45" is not mm from 0.1 to 10 with one decimal.',
      'Row 4: thickness "0" is not mm from 0.1 to 10 with one decimal.',
      'Row 5: width "22.5" is not whole mm from 1 to 100.',
      'Row 6: width "101" is not whole mm from 1 to 100.',
      'Row 7: color "white" is not #rrggbb.',
      'Row 8: no manufacturer.',
      'Row 9: no code.',
      'Row 10: no name.',
      'Row 11: Egger OK 0.4 × 22 mm is listed twice; the first is kept.',
    ]);
  });

  it('refuses a file without the columns, an empty file and a header with no bands; never throws', () => {
    expect(parseBandList('code,name\nA,b', 'x').problems[0]).toMatch(
      /missing: manufacturer, type, thickness, width, color/,
    );
    expect(parseBandList('', 'x')).toEqual({ bands: [], problems: ['The file is empty.'] });
    expect(parseBandList(`${HEAD}\n\n`, 'x')).toEqual({
      bands: [],
      problems: ['The file has a header row but no bands.'],
    });
    for (const junk of ['"unterminated,,,\n;;;', '\u0000\u0001', `${HEAD}\n"a,b`, ',,,,,,,'])
      expect(() => parseBandList(junk, 'x')).not.toThrow();
  });
});

describe('matching bands and the pick (ADR-212)', () => {
  const [match, narrow, byCode, near, far] = parseBandList(
    [
      HEAD,
      'E,ABS,M1,H1145,matches by decor,1,22,#000000',
      'E,ABS,M2,H1145,too narrow,1,17,#b59a7a',
      'E,ABS,H1145,,matches by code,2,23,#ffffff',
      'E,ABS,N1,,near colour,1,22,#b49979',
      'E,ABS,F1,,far colour,1,22,#0000ff',
    ].join('\n'),
    'b.csv',
  ).bands;
  const board: Pick<Material, 'thickness' | 'color' | 'decor'> = {
    thickness: 18,
    color: '#b59a7a',
    decor: { code: 'H1145', list: 'decors.csv' },
  };

  it('matching first: same decor code (decor or code column) and at least as wide as the board', () => {
    const { matching, others } = bandsForBoard([far, near, narrow, byCode, match], board);
    // Matching bands are themselves ordered by colour closeness.
    expect(matching.map((b) => b.code)).toEqual(['H1145', 'M1']);
    // The rest, nearest colour first; a band too narrow for the board is not a match.
    expect(others.map((b) => b.code)).toEqual(['M2', 'N1', 'F1']);
  });

  it('a board without a decor code has no matching bands; all are ordered by colour', () => {
    const { matching, others } = bandsForBoard([far, near, match], {
      thickness: 18,
      color: '#0000ff',
    });
    expect(matching).toEqual([]);
    expect(others.map((b) => b.code)).toEqual(['F1', 'M1', 'N1']);
  });

  it('a pick fills kind, thickness, width and code only (no allowance, no product)', () => {
    expect(bandFromList(match)).toEqual({ kind: 'abs', thickness: 10, width: 22, code: 'M1' });
  });
});

describe('the bands table (Dexie version 12)', () => {
  it('a new import replaces the list; unreadable rows are skipped and kept', async () => {
    expect(db.verno).toBe(12);
    await replaceBands(
      parseBandList(`${HEAD}\nE,ABS,A,,a,1,22,#ffffff\nE,ABS,B,,b,1,22,#ffffff`, 'one.csv').bands,
    );
    await replaceBands(parseBandList(`${HEAD}\nE,PVC,C,,c,2,23,#ffffff`, 'two.csv').bands);
    expect((await listBands()).map((b) => `${b.list}:${b.code}`)).toEqual(['two.csv:C']);
    await db.bands.put({ id: 'bad', thickness: 0.4 } as never);
    expect((await listBands()).map((b) => b.code)).toEqual(['C']);
    expect(await db.bands.get('bad')).toBeDefined();
  });

  it('the band list is not part of the folder backup', () => {
    expect(BACKUP_TABLES.map(([n]) => n as string)).not.toContain('bands');
  });

  it('a version-11 database upgrades to 12 keeping every row of every table', async () => {
    const V11 = {
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
      decors: [{ id: 'dc1', code: 'H1145' }, { id: 'dc2' }],
      projectTemplates: [
        { id: 'pt1', updatedAt: '2026', name: 'PT' },
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
    };
    expect(Object.keys(rows).sort()).toEqual(Object.keys(V11).sort());
    const name = 'bands-upgrade-test';
    const old = new Dexie(name);
    old.version(11).stores(V11);
    await old.open();
    for (const [table, list] of Object.entries(rows)) await old.table(table).bulkPut(list);
    old.close();
    const Fresh = db.constructor as new (n: string) => typeof db;
    const nw = new Fresh(name);
    await nw.open();
    expect(nw.verno).toBe(12);
    // Every earlier table is still there, with every row as written.
    for (const [table, list] of Object.entries(rows)) {
      const after = await nw.table(table).toArray();
      expect(after, table).toHaveLength(list.length);
      expect(after, table).toEqual(expect.arrayContaining(list));
    }
    expect(nw.tables.map((t) => t.name).sort()).toEqual([...Object.keys(V11), 'bands'].sort());
    expect(await nw.bands.count()).toBe(0);
    nw.close();
  });
});
