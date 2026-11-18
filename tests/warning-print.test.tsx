// @vitest-environment jsdom
// ADR-265 (D18-F6): every warning on the cut sheet is in the print language (Romanian, Russian, English). Each warning
// text of the core has a Romanian, Russian and English entry (a missing one fails here), and the sheet's warning list
// renders in all three languages.
import fs from 'node:fs';
import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { COMPAT_RULES } from '../src/core/compat';
import { templates } from '../src/core/design';
import { loadDictionary, setLang, t as tt, tr } from '../src/core/i18n';
import { PRINT_LANGS, setPrintLang, warningText, type PrintLang } from '../src/core/i18n/print';
import { PRINT_EN, PRINT_RU } from '../src/core/i18n/print-text';
import { WARNING_RO } from '../src/core/i18n/warning-text';
import { buildProjectModel, makeItem, newProject, type Project } from '../src/core/project';
import type { Diagnostic } from '../src/core/types';
import { dynamicSites, fileKeys, warningSites } from './helpers/warningKeys';

const shown = vi.hoisted(() => ({ diagnostics: [] as Diagnostic[] }));
vi.mock('../src/store/useView', async (orig) => {
  const real = await orig<typeof import('../src/store/useView')>();
  return { ...real, useView: () => ({ ...real.useView(), diagnostics: shown.diagnostics }) };
});
import { PrintSheet } from '../src/ui/PrintSheet';
import { withCab } from './helpers/cabinet';

afterEach(() => {
  cleanup();
  setPrintLang('ro');
  setLang('en');
});

const placeholders = (s: string) =>
  [...new Set([...s.matchAll(/\{(\w+)/g)].map((m) => m[1]))].sort();
const english = (k: string) => (k.includes('@@') ? k.slice(0, k.indexOf('@@')) : k);

/** Every text key of a warning in src/core: found in the code, plus the texts chosen at run time. */
function keysOfWarnings(): string[] {
  // The wizard's hints (wallfill, roomfill) never reach the sheet.
  const found = warningSites()
    .filter((s) => !/(wallfill|roomfill)\.ts$/.test(s.file))
    .flatMap((s) => s.keys ?? []);
  // The sink and hob texts are picked by kind (project.ts CUTOUT_TEXT, CUTOUT_AT_TEXT): the `none` and `wide` ones warn.
  const src = fs.readFileSync('src/core/project.ts', 'utf8');
  const cutouts = [...src.matchAll(/\b(?:none|wide): '([^']+)'/g)].map((m) => m[1]);
  // The compat rules that warn: their rule text and their Checks message.
  const rules = COMPAT_RULES.filter((r) => r.severity === 'warning' && r.where.includes('checks'));
  const compat = rules.map((r) => r.text);
  // Where each reason of a warning comes from: every text of the files that make `{reason}` and `{kind}` params.
  const reasons = ['common', 'shared', 'connections', 'compat'].flatMap((f) =>
    fileKeys(`src/core/${f}.ts`),
  );
  return [...new Set([...found, ...cutouts, ...compat, ...reasons])];
}

describe('warning texts have a print entry (ADR-265)', () => {
  it('the only texts chosen at run time are the sink and hob ones, covered by name', () => {
    expect(dynamicSites().map((s) => s.file)).toEqual([
      'src/core/project.ts',
      'src/core/project.ts',
      'src/core/project.ts',
    ]);
  });

  it('every warning text of the core has a Romanian entry, and that has a Russian and an English one', () => {
    const keys = keysOfWarnings();
    expect(keys.length).toBeGreaterThan(60);
    const missing = keys.filter((k) => !Object.hasOwn(WARNING_RO, k));
    expect(missing).toEqual([]);
    for (const k of keys) {
      const ro = WARNING_RO[k as keyof typeof WARNING_RO];
      expect(Object.hasOwn(PRINT_RU, ro), `no Russian for ${k}`).toBe(true);
      expect(Object.hasOwn(PRINT_EN, ro), `no English for ${k}`).toBe(true);
      expect(PRINT_RU[ro as keyof typeof PRINT_RU].length).toBeGreaterThan(0);
      expect(PRINT_EN[ro as keyof typeof PRINT_EN]).toBe(english(k));
      // The same placeholders in every language.
      const want = placeholders(k);
      expect(placeholders(ro), `ro placeholders of ${k}`).toEqual(want);
      expect(
        placeholders(PRINT_RU[ro as keyof typeof PRINT_RU]),
        `ru placeholders of ${k}`,
      ).toEqual(want);
    }
  });
});

const t = (id: string) => templates.find((x) => x.id === id)!.create();

/** Two base units side by side, the second not as deep (a compat warning), linked by a common top moved out of line
 * (a common-panel warning with a reason inside it). */
function pairOfBases(): Project {
  let p = newProject('Warned');
  p = { ...p, items: [...p.items, makeItem(p, t('base-door'))] };
  p = { ...p, items: [...p.items, makeItem(p, withCab(t('base-door'), { depth: 500 }))] };
  return p;
}

/** The same two units with a common top, the second moved out of line: the top is not built (a reason inside). */
function brokenCommon(): Project {
  const p0 = pairOfBases();
  const p = {
    ...p0,
    common: [{ id: 'c1', kind: 'top' as const, itemIds: p0.items.map((i) => i.id) }],
  };
  return {
    ...p,
    items: p.items.map((it, i) =>
      i === 1
        ? { ...it, position: { ...it.position, x: it.position.x + 10, z: it.position.z + 10 } }
        : it,
    ),
  };
}

const warningsOf = (p: Project): Diagnostic[] =>
  buildProjectModel(p).diagnostics.filter((d) => d.severity === 'warning');

describe('the cut sheet warning list follows the print language (ADR-265)', () => {
  const warnings = [...warningsOf(pairOfBases()), ...warningsOf(brokenCommon())];

  it('the project makes the warnings this test prints', () => {
    const codes = warnings.map((w) => w.code);
    expect(codes).toContain('common-panel-broken');
    expect(codes).toContain('compat-depth-match');
    expect(codes.length).toBeGreaterThan(0);
  });

  const printed = (lang: PrintLang) => {
    setPrintLang(lang);
    return warnings.map((w) => warningText(w.message));
  };

  it('Romanian: every warning is in Romanian, with its reason and its names filled in', () => {
    const out = printed('ro');
    const broken = out[warnings.findIndex((w) => w.code === 'common-panel-broken')];
    expect(broken).toMatch(/^Panoul comun de sus nu este construit: /);
    expect(broken).toMatch(/Elementele își păstrează panoul propriu\.$/);
    for (const [i, w] of warnings.entries()) {
      expect(out[i]).not.toBe(w.message);
      expect(out[i]).not.toMatch(/\{\w+/);
    }
  });

  it('Russian: every warning is in Russian', () => {
    const out = printed('ru');
    for (const [i, w] of warnings.entries()) {
      expect(out[i]).not.toBe(w.message);
      expect(out[i]).toMatch(/[А-Яа-яЁё]/);
      expect(out[i]).not.toMatch(/\{\w+/);
    }
    expect(out[warnings.findIndex((w) => w.code === 'common-panel-broken')]).toMatch(
      /^Общая панель \(крышки\) не построена: /,
    );
  });

  it('English: the warning is its English text', () => {
    const out = printed('en');
    for (const [i, w] of warnings.entries()) {
      expect(out[i]).toBe(w.message);
    }
  });

  it('a message the core did not make is printed as it is', () => {
    expect(warningText('Something typed by hand')).toBe('Something typed by hand');
  });

  it('the sheet renders its "De verificat" list in ro, ru and en', () => {
    shown.diagnostics = warnings;
    const heading: Record<PrintLang, string> = {
      ro: 'De verificat',
      ru: 'Проверить',
      en: 'To check',
    };
    for (const lang of PRINT_LANGS) {
      setPrintLang(lang);
      const { container, getByText, unmount } = render(<PrintSheet />);
      getByText(heading[lang]);
      const items = [...container.querySelectorAll('.pr-warn li')].map((li) => li.textContent);
      expect(items).toEqual(warnings.map((w) => warningText(w.message)));
      expect(items.length).toBe(warnings.length);
      if (lang !== 'en')
        for (const [i, w] of warnings.entries()) expect(items[i]).not.toBe(w.message);
      unmount();
    }
  });
});

describe('data words inside a warning follow the print language (G-516)', () => {
  const msg = () => tt('{part} is only {w} mm wide.', { part: tr('Left side'), w: 50 });

  it.each([
    ['en', 'ro', 'Lateral stânga are doar 50 mm lățime.'],
    ['ru', 'ro', 'Lateral stânga are doar 50 mm lățime.'],
    ['en', 'en', 'Left side is only 50 mm wide.'],
    ['ru', 'en', 'Left side is only 50 mm wide.'],
    ['en', 'ru', 'Боковина слева — только 50 мм ширины.'],
  ] as const)('app %s, print %s', async (app, print, want) => {
    await loadDictionary(app);
    setLang(app);
    setPrintLang(print);
    const text = warningText(msg());
    if (print === 'ru') expect(text).toMatch(/^[^A-Za-z]*[А-Яа-я]/);
    if (print !== 'ru') expect(text).toBe(want);
    expect(text).not.toMatch(/\{\w+/);
  });
});
