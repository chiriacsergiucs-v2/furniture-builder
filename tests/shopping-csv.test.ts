import { describe, expect, it } from 'vitest';
import {
  estimate,
  linePrice,
  parsePricesCsv,
  pricesCsv,
  unitsFor,
  type PriceEntry,
} from '../src/core/prices';
import { worktopMaterial } from '../src/core/project';
import { shoppingCsvRo, shoppingList, type ShopLine } from '../src/core/shopping';
import type { CutRow } from '../src/core/cutlist';

const line = (label: string, detail = ''): ShopLine => ({
  section: 'hardware',
  label,
  quantity: 2,
  unit: 'piece',
  detail,
  priceKey: `hw:${label}`,
});

describe('CSV formula injection (shopping list and price list)', () => {
  it('shopping CSV prefixes cells starting with = + - @ and keeps ; and quote escaping', () => {
    const csv = shoppingCsvRo([
      line('=HYPERLINK("http://x")', '+1'),
      line('-2 handles', '@SUM(A1)'),
      line('Hinge; 35 mm', 'say "soft"'),
    ]);
    const rows = csv.replace(/^\uFEFF/, '').split('\r\n');
    expect(rows[1]).toBe(`Feronerie;"'=HYPERLINK(""http://x"")";2;buc;'+1`);
    expect(rows[2]).toBe(`Feronerie;'-2 handles;2;buc;'@SUM(A1)`);
    expect(rows[3]).toBe(`Feronerie;"Hinge; 35 mm";2;buc;"say ""soft"""`);
    for (const r of rows.slice(1)) for (const c of r.split(';')) expect(c).not.toMatch(/^[=+\-@]/);
  });
  it('price CSV neutralises formula keys and reads them back unchanged', () => {
    const list: PriceEntry[] = [
      { id: 'hw:=cmd|calc', unit: 'piece', amount: 150 },
      { id: 'hw:Hinge; "soft"', unit: 'piece', amount: 250 },
      { id: 'currency', unit: 'piece', amount: 0, text: '@lei' },
    ];
    const csv = pricesCsv(list);
    expect(csv).toContain(`hardware;'=cmd|calc;piece;1.50`);
    expect(csv).toContain(`hardware;"Hinge; ""soft""";piece;2.50`);
    expect(csv).toContain(`currency;'@lei;;`);
    expect(parsePricesCsv(csv)).toEqual({ prices: list, problems: [] });
  });
});

describe('price list CSV format kind;key;unit;price (ADR-062)', () => {
  it('writes the kind column with the key without its stored prefix, and round-trips', () => {
    const list: PriceEntry[] = [
      { id: 'board:mat:PAL alb|18|plain', unit: 'sheet', amount: 25000 },
      { id: 'band:mat:PAL alb|18|plain', unit: 'm', amount: 150 },
      { id: 'hw:Hinge', unit: 'piece', amount: 1200 },
      { id: 'currency', unit: 'piece', amount: 0, text: 'EUR' },
    ];
    const csv = pricesCsv(list);
    expect(csv.split('\n').slice(0, 5)).toEqual([
      'kind;key;unit;price',
      'board;mat:PAL alb|18|plain;sheet;250.00',
      'band;mat:PAL alb|18|plain;m;1.50',
      'hardware;Hinge;piece;12.00',
      'currency;EUR;;',
    ]);
    expect(parsePricesCsv(csv)).toEqual({ prices: list, problems: [] });
  });
  it('still reads the earlier key;unit;price files, with or without a header', () => {
    const old =
      'key;unit;price\nboard:mat:X|18|plain;m2;12,5\nhw:Runner pair;piece;30\ncurrency;;lei\n';
    expect(parsePricesCsv(old)).toEqual({
      prices: [
        { id: 'board:mat:X|18|plain', unit: 'm2', amount: 1250 },
        { id: 'hw:Runner pair', unit: 'piece', amount: 3000 },
        { id: 'currency', unit: 'piece', amount: 0, text: 'lei' },
      ],
      problems: [],
    });
    expect(parsePricesCsv('hw:Hinge;piece;2').prices).toEqual([
      { id: 'hw:Hinge', unit: 'piece', amount: 200 },
    ]);
    expect(parsePricesCsv('board;mat:Y|18|plain;sheet;100').prices).toEqual([
      { id: 'board:mat:Y|18|plain', unit: 'sheet', amount: 10000 },
    ]);
  });
  it('skips unreadable rows with a reason and keeps the rest', () => {
    const r = parsePricesCsv(
      'kind;key;unit;price\nboard;mat:X|18|plain;sheet;abc\nshelf;x;piece;1\nhardware;Hinge;piece;3\ncurrency;;;\n',
    );
    expect(r.prices).toEqual([{ id: 'hw:Hinge', unit: 'piece', amount: 300 }]);
    expect(r.problems).toHaveLength(3);
  });
});

describe('worktop boards priced per piece (ADR-062)', () => {
  const row = (materialId: string, materialName: string): CutRow => ({
    materialId,
    materialName,
    thickness: 38,
    length: 2000,
    width: 600,
    quantity: 1,
    labels: ['Worktop'],
    panelIds: ['p1'],
    edgesL: 0,
    edgesW: 0,
    grain: true,
    drilling: '',
  });
  it('a run worktop board can be priced per worktop board bought (its sheet count)', () => {
    const wt = worktopMaterial();
    const lines = shoppingList({
      rows: [row(wt.id, wt.name)],
      materials: [wt],
      hardware: [],
      sheets: new Map([[wt.id, 2]]),
    });
    const board = lines.find((l) => l.section === 'boards')!;
    expect(board.worktop).toBe(true);
    expect(unitsFor(board)).toEqual(['sheet', 'm2', 'piece']);
    const p: PriceEntry = { id: board.priceKey!, unit: 'piece', amount: 40000 };
    expect(linePrice(board, new Map([[p.id, p]]))).toBe(80000);
    expect(estimate(lines, [p]).total).toBe(80000);
    // Not laid out yet: the per-piece price cannot be used, it is listed as missing.
    const unlaid = shoppingList({
      rows: [row(wt.id, wt.name)],
      materials: [wt],
      hardware: [],
      sheets: null,
    });
    expect(estimate(unlaid, [p]).missing).toContain(wt.name);
  });
  it('a board of kind kitchen worktop is a worktop; an ordinary board is not priced per piece', () => {
    const lab = { ...worktopMaterial(), id: 'oak', name: 'Oak slab', kind: 'worktop' as const };
    const pal = { ...worktopMaterial(), id: 'pal', name: 'PAL alb', kind: 'pal' as const };
    const lines = shoppingList({
      rows: [row(lab.id, lab.name), row(pal.id, pal.name)],
      materials: [lab, pal],
      hardware: [],
      sheets: new Map([
        [lab.id, 1],
        [pal.id, 1],
      ]),
    });
    const [a, b] = lines.filter((l) => l.section === 'boards');
    expect(unitsFor(a)).toContain('piece');
    expect(unitsFor(b)).toEqual(['sheet', 'm2']);
    const p: PriceEntry = { id: b.priceKey!, unit: 'piece', amount: 100 };
    expect(linePrice(b, new Map([[p.id, p]]))).toBeNull();
  });
});
