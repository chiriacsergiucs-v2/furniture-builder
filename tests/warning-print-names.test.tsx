// @vitest-environment jsdom
// G-521: names inside a warning on the cut sheet follow the print language — a catalog piece's name (as the pieces table
// prints it, printPieceName), a built-in board name (printBoardName) and a built-in hardware name (printHardwareName).
// A name the user typed prints as typed.
import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { catalogFamilies, insertVariant } from '../src/core/catalog';
import { printPieceName, printPieceNames } from '../src/core/catalog/printName';
import {
  buildProjectModel,
  makeItem,
  newProject,
  pieceName,
  type Project,
} from '../src/core/project';
import { warningText } from '../src/core/ro';
import { loadDictionary, setLang, t as tt, tr } from '@furniture-builder/i18n';
import {
  printBoardName,
  printHardwareName,
  setPrintLang,
  type PrintLang,
} from '@furniture-builder/i18n/print';
import { PRINT_EN, PRINT_RU } from '@furniture-builder/i18n/print-text';
import { data_catalog } from '@furniture-builder/i18n/ru/data-catalog';
import type { Diagnostic } from '../src/core/types';

const shown = vi.hoisted(() => ({ diagnostics: [] as Diagnostic[] }));
vi.mock('../src/store/useView', async (orig) => {
  const real = await orig<typeof import('../src/store/useView')>();
  return { ...real, useView: () => ({ ...real.useView(), diagnostics: shown.diagnostics }) };
});
import { PrintSheet } from '../src/ui/PrintSheet';
import { useDesign } from '../src/store/designStore';

afterEach(() => {
  cleanup();
  setPrintLang('ro');
  setLang('en');
  useDesign.setState({ project: null });
  shown.diagnostics = [];
});

/** Every hardware name of the built-in catalog (the `{what}` of the hardware-to-choose warning). */
const hardwareNames = [
  ...new Set(catalogFamilies.flatMap((f) => f.variants.flatMap((v) => v.hardware ?? []))),
];

/** The catalog piece that needs hanging-file rails, with its family. */
function filePiece() {
  for (const f of catalogFamilies)
    for (const v of f.variants)
      if (v.hardware === 'hanging-file rails') return insertVariant(f, v)!;
  throw new Error('no hanging-file rails variant');
}

describe('built-in hardware names have print entries (G-521)', () => {
  it('every catalog hardware name has a Romanian, Russian and English entry', () => {
    expect(hardwareNames.length).toBeGreaterThan(10);
    for (const lang of ['ro', 'ru'] as const) {
      setPrintLang(lang);
      for (const h of hardwareNames) expect(printHardwareName(h), `${lang} ${h}`).not.toBe(h);
    }
    setPrintLang('ru');
    for (const h of hardwareNames) expect(printHardwareName(h)).toBe(data_catalog[h]);
    setPrintLang('en');
    for (const h of hardwareNames) expect(printHardwareName(h)).toBe(h);
    expect(Object.keys(PRINT_RU).length).toBe(Object.keys(PRINT_EN).length);
  });

  it('a typed hardware name prints as typed', () => {
    setPrintLang('ru');
    expect(printHardwareName('my own lift')).toBe('my own lift');
  });
});

describe('names inside a warning on the printed sheet (G-521)', () => {
  /** Two of the same catalog piece (a numbered name) and the warnings that name pieces, a board and hardware. */
  function setup(): { project: Project; warnings: Diagnostic[] } {
    let p = newProject('Office');
    p = { ...p, items: [...p.items, makeItem(p, filePiece())] };
    p = { ...p, items: [...p.items, makeItem(p, filePiece())] };
    const [a, b] = p.items.map((i) => i.id);
    const hw = buildProjectModel(p).diagnostics.filter((d) => d.code === 'hardware-to-choose');
    const warn = (code: string, message: string): Diagnostic =>
      ({ severity: 'warning', code, message }) as Diagnostic;
    const warnings = [
      ...hw.slice(0, 1),
      warn('connect', tt('{a} and {b} do not touch.', { a: pieceName(p, a), b: pieceName(p, b) })),
      warn(
        'shelf-span',
        tt(
          'Shelf span {span} mm is long for {t} mm {name} and may sag (typical limit {limit} mm — confirm for your board and load).',
          { span: 900, t: 18, name: tr('PAL 18 white'), limit: 800 },
        ),
      ),
      warn(
        'worktop',
        tt('{board} is labelled kitchen worktop but is used for {part} (guidance).', {
          board: tr('Worktop 38'),
          part: tr('Shelf'),
        }),
      ),
      warn('typed', tt('{name} has another back.', { name: 'My own cupboard' })),
    ];
    return { project: p, warnings };
  }

  it.each(['en', 'ru'] as const)(
    'app %s, print ru: the sheet shows the piece, board and hardware names in Russian',
    async (app) => {
      await loadDictionary(app);
      setLang(app);
      const { project, warnings } = setup();
      expect(warnings[0]?.code).toBe('hardware-to-choose');
      useDesign.setState({ project });
      shown.diagnostics = warnings;
      setPrintLang('ru');
      const piece = printPieceName(project.items[0].design);
      expect(piece).not.toBe(project.items[0].design.name);
      const { container } = render(<PrintSheet />);
      const items = [...container.querySelectorAll('.pr-warn li')].map((li) => li.textContent);
      expect(items).toEqual(
        warnings.map((w) =>
          warningText(w.message, printPieceNames(project.items.map((i) => i.design))),
        ),
      );
      const [hwLine, pair, shelf, worktop, typed] = items;
      expect(hwLine).toContain(printHardwareName('hanging-file rails'));
      expect(hwLine).not.toContain('hanging-file rails');
      expect(pair).toContain(`${piece} (изделие 1)`);
      expect(pair).toContain(`${piece} (изделие 2)`);
      expect(shelf).toContain(printBoardName('PAL 18 white'));
      expect(shelf).toContain('ЛДСП 18 белая');
      expect(worktop).toContain('Столешница 38');
      expect(typed).toContain('My own cupboard');
      for (const line of items) {
        expect(line).toMatch(/[А-Яа-яЁё]/);
        expect(line).not.toMatch(/\{\w+/);
        expect(line).not.toMatch(/hanging-file|PAL 18 white|Worktop 38|\(piece \d\)/);
      }
    },
  );

  it.each(['ro', 'en'] as const satisfies readonly PrintLang[])(
    'print %s: the same names in that language',
    async (lang) => {
      await loadDictionary('ru');
      setLang('ru');
      const { project, warnings } = setup();
      setPrintLang(lang);
      const names = printPieceNames(project.items.map((i) => i.design));
      const [hwLine, pair, shelf, worktop] = warnings.map((w) => warningText(w.message, names));
      const piece = printPieceName(project.items[0].design);
      expect(hwLine).toContain(printHardwareName('hanging-file rails'));
      expect(pair).toContain(piece);
      expect(shelf).toContain(lang === 'ro' ? 'PAL 18 alb' : 'PAL 18 white');
      expect(worktop).toContain(lang === 'ro' ? 'Blat 38' : 'Worktop 38');
      for (const line of [hwLine, pair, shelf, worktop]) expect(line).not.toMatch(/[А-Яа-яЁё]/);
    },
  );
});
