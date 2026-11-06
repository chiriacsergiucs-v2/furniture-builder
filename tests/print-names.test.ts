// ADR-212 (G-381): a catalog piece's name in the parts CSV follows the print language (ro, ru, en) through
// `cutlistCsvRo(rows, pieceNames)` and `printPieceNames`; renamed pieces and project names print as typed (G-304).
// The Output tab and the review pack both pass the map.
import { afterEach, describe, expect, it } from 'vitest';
import { findFamily, insertVariant } from '../src/core/catalog';
import { printPieceName, printPieceNames } from '../src/core/catalog/printName';
import { setPrintLang, type PrintLang } from '../src/core/i18n/print';
import { data_catalog } from '../src/core/i18n/ru/data-catalog';
import {
  buildProjectModel,
  makeItem,
  newProject,
  projectCutlist,
  resolvePlacements,
} from '../src/core/project';
import { reviewPackFiles } from '../src/core/reviewPack';
import { cutlistCsvRo } from '../src/core/ro';
import type { Design } from '../src/core/types';

afterEach(() => setPrintLang('ro'));

const family = findFamily('base-doors')!;
const variant = family.variants.find((v) => v.id === 'base-door')!;
const catalogPiece = (): Design => insertVariant(family, variant, '2026-11-06T00:00:00.000Z')!;

/** The piece names that start the first column of the CSV's part rows. */
function labelPieces(csv: string): Set<string> {
  const lines = csv
    .replace(/^\uFEFF/, '')
    .trim()
    .split('\r\n')
    .slice(1);
  const out = new Set<string>();
  for (const l of lines) {
    const cell = l.split(';')[0].replace(/^"|"$/g, '');
    for (const label of cell.split(' / ')) out.add(label.slice(0, label.indexOf(': ')));
  }
  return out;
}

const EXPECTED: Record<PrintLang, (d: Design) => string> = {
  ro: () => 'Corp bază cu uși — 1 ușă + raft',
  ru: (d) => data_catalog[d.name],
  en: (d) => d.name,
};

describe('print names in the parts CSV (ADR-212, G-381)', () => {
  it('the catalog piece keeps its default name, which has a Russian entry', () => {
    const d = catalogPiece();
    expect(d.catalog?.origin?.variantId).toBe('base-door');
    expect(data_catalog[d.name]).toBeTruthy();
  });

  for (const lang of ['ro', 'ru', 'en'] as const) {
    it(`a catalog piece's labels and printed name follow the print language: ${lang}`, () => {
      setPrintLang(lang);
      const d = catalogPiece();
      const want = EXPECTED[lang](d);
      expect(printPieceName(d)).toBe(want);
      let p = newProject('My kitchen');
      p = resolvePlacements({ ...p, items: [makeItem(p, d)] });
      const names = printPieceNames(p.items.map((i) => i.design));
      // Only names that differ go in the map (English prints the stored name).
      expect(names.size).toBe(lang === 'en' ? 0 : 1);
      const csv = cutlistCsvRo(projectCutlist(p), names);
      expect(labelPieces(csv)).toEqual(new Set([want]));
      if (lang !== 'en') expect(csv).not.toContain(`${d.name}: `);
      // The review pack's parts CSV is the same text.
      const pm = buildProjectModel(p);
      const pack = reviewPackFiles(p, pm, '{}', 'kitchen', '2026-11-06');
      const packCsv = pack.find((f) => f.name.endsWith('.csv'))!.text;
      expect(packCsv).toBe(csv);
    });
  }

  it('a renamed catalog piece prints as typed, in every language', () => {
    for (const lang of ['ro', 'ru', 'en'] as const) {
      setPrintLang(lang);
      const d = { ...catalogPiece(), name: 'Sink base' };
      expect(printPieceName(d)).toBe('Sink base');
      let p = newProject('Kitchen');
      p = resolvePlacements({ ...p, items: [makeItem(p, d)] });
      const names = printPieceNames(p.items.map((i) => i.design));
      expect(names.size).toBe(0);
      expect(labelPieces(cutlistCsvRo(projectCutlist(p), names))).toEqual(new Set(['Sink base']));
    }
  });

  it('without the map, labels keep the stored name (single pieces and older callers)', () => {
    setPrintLang('ro');
    const d = catalogPiece();
    let p = newProject('Kitchen');
    p = resolvePlacements({ ...p, items: [makeItem(p, d)] });
    expect(labelPieces(cutlistCsvRo(projectCutlist(p)))).toEqual(new Set([d.name]));
  });

  it('two pieces: only the catalog one is swapped; the renamed one stays as typed', () => {
    setPrintLang('ro');
    const a = catalogPiece();
    const b = { ...catalogPiece(), name: 'Corner piece' };
    let p = newProject('Kitchen');
    p = { ...p, items: [makeItem(p, a)] };
    p = resolvePlacements({ ...p, items: [...p.items, makeItem(p, b)] });
    const csv = cutlistCsvRo(projectCutlist(p), printPieceNames(p.items.map((i) => i.design)));
    expect(labelPieces(csv)).toEqual(new Set(['Corp bază cu uși — 1 ușă + raft', 'Corner piece']));
  });
});
