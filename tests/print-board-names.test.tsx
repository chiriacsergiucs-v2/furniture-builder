// @vitest-environment jsdom
// G-537 (user 2026-11-27: "Translate on print"): a built-in board name ('Worktop 38', 'PAL 18 white', …) prints in the
// print language on the parts CSV, the printed sheet and the shopping list; a name the user typed prints as typed.
import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { defaultMaterials, solidMaterials } from '../src/core/design';
import { worktopMaterial } from '../src/core/project';
import type { CutRow } from '../src/core/cutlist';
import { cutlistCsvRo } from '../src/core/ro';
import { shoppingCsvRo, shoppingList } from '../src/core/shopping';
import { printBoardName, setPrintLang, type PrintLang } from '@furniture-builder/i18n/print';
import { PrintSheet } from '../src/ui/PrintSheet';
import { useDesign } from '../src/store/designStore';

afterEach(() => {
  cleanup();
  setPrintLang('ro');
});

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

/** The Material cell of each CSV part row. */
const csvMaterials = (csv: string) =>
  csv
    .replace(/^\uFEFF/, '')
    .trim()
    .split('\r\n')
    .slice(1)
    .map((l) => l.split(';')[1]);

const WORKTOP: Record<PrintLang, string> = { ro: 'Blat 38', ru: 'Столешница 38', en: 'Worktop 38' };

describe('built-in board names on print (G-537)', () => {
  it('every built-in board name has a print entry, and English gives back the stored name', () => {
    const names = [...defaultMaterials(), ...solidMaterials(), worktopMaterial()].map(
      (m) => m.name,
    );
    for (const lang of ['ro', 'ru'] as const) {
      setPrintLang(lang);
      for (const n of names.filter((x) => x !== 'HDF 3'))
        expect(printBoardName(n), `${lang} ${n}`).not.toBe(n);
    }
    setPrintLang('en');
    for (const n of names) expect(printBoardName(n)).toBe(n);
  });

  it.each(['ro', 'ru', 'en'] as const)(
    'parts CSV in %s: Worktop 38 translated, a typed name unchanged',
    (lang) => {
      setPrintLang(lang);
      const wt = worktopMaterial();
      const csv = cutlistCsvRo([row(wt.id, wt.name), row('mine', 'Worktop 38 stejar Egger')]);
      expect(csvMaterials(csv)).toEqual([WORKTOP[lang], 'Worktop 38 stejar Egger']);
    },
  );

  it('a typed name that only differs in case or spacing prints as typed', () => {
    setPrintLang('ru');
    expect(printBoardName('worktop 38')).toBe('worktop 38');
    expect(printBoardName('Worktop 38 ')).toBe('Worktop 38 ');
    expect(printBoardName('Blat 38')).toBe('Blat 38');
  });

  it('shopping list: the board line prints in the print language, its UI label stays stored', () => {
    const wt = worktopMaterial();
    const own = { ...wt, id: 'own', name: 'My oak slab' };
    const lines = shoppingList({
      rows: [row(wt.id, wt.name), row(own.id, own.name)],
      materials: [wt, own],
      hardware: [],
      sheets: new Map([
        [wt.id, 1],
        [own.id, 1],
      ]),
    });
    const [a, b] = lines.filter((l) => l.section === 'boards');
    expect(a.label).toBe('Worktop 38');
    for (const lang of ['ro', 'ru'] as const) {
      setPrintLang(lang);
      expect(a.printLabel).toBe(WORKTOP[lang]);
      expect(b.printLabel).toBe('My oak slab');
      const csv = shoppingCsvRo(lines);
      expect(csv).toContain(`;${WORKTOP[lang]};`);
      expect(csv).toContain(';My oak slab;');
      expect(csv).not.toContain(';Worktop 38;');
    }
  });

  it('the printed sheet names a built-in board in the print language and a typed one as typed', () => {
    const d = useDesign.getState().design;
    const builtIn = d.materials.find((m) => m.name === 'PAL 18 white');
    expect(builtIn).toBeDefined();
    const want: Record<PrintLang, string> = {
      ro: 'PAL 18 alb',
      ru: 'ЛДСП 18 белая',
      en: 'PAL 18 white',
    };
    for (const lang of ['ro', 'ru', 'en'] as const) {
      setPrintLang(lang);
      const { container, unmount } = render(<PrintSheet />);
      const captions = [...container.querySelectorAll('.pr-table caption')].map(
        (c) => c.textContent ?? '',
      );
      expect(captions.some((c) => c.startsWith(`${want[lang]} — `))).toBe(true);
      if (lang !== 'en') expect(captions.some((c) => c.startsWith('PAL 18 white — '))).toBe(false);
      unmount();
    }
  });
});
