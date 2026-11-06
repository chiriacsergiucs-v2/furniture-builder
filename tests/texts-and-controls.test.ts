// ADR-202: whole-sentence hardware notes in Russian, catalog piece names on prints, fastener lines in the print
// language, and the short Review label of the compartment widths.
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { buildModel } from '../src/core/build';
import * as cabinet from '../src/core/cabinet';
import { cornerHingeNote, hingeNote } from '../src/core/cabinet';
import {
  catalogFamilies,
  insertVariant,
  isSafetyConfirmed,
  setSafetyConfirmed,
} from '../src/core/catalog';
import { printPieceName } from '../src/core/catalog/printName';
import { VARIANT_RO } from '../src/core/catalog/ro';
import { templates } from '../src/core/design';
import {
  COUNTED_PT,
  fastenerCounts,
  fastenerShopLines,
  JOINTS,
  notCountedPrint,
  type FastenerCount,
} from '../src/core/fasteners';
import { setLang, tr } from '../src/core/i18n';
import { pt, setPrintLang, type PrintLang } from '../src/core/i18n/print';
import { PRINT_EN, PRINT_RU } from '../src/core/i18n/print-text';
import { data_catalog } from '../src/core/i18n/ru/data-catalog';
import { shoppingCsvRo, shoppingList } from '../src/core/shopping';
import { STEPS } from '../src/core/wizard/steps';

const LATIN = /[A-Za-z]/;

afterEach(() => {
  setLang('en');
  setPrintLang('ro');
});

describe('hardware notes are whole sentences (ADR-202, G-366)', () => {
  let safety = false;
  beforeAll(() => {
    safety = isSafetyConfirmed();
    setSafetyConfirmed(true);
  });
  afterAll(() => setSafetyConfirmed(safety));

  it('the sentence-building hingeBand is gone', () => {
    expect('hingeBand' in cabinet).toBe(false);
  });

  it('under Russian, every hardware note of every catalog variant translates with no English left', () => {
    const notes = new Set<string>();
    for (const f of catalogFamilies)
      for (const v of f.variants) {
        if (!v.create) continue;
        for (const h of buildModel(v.create()).hardware) if (h.note) notes.add(h.note);
      }
    for (const tpl of templates)
      for (const h of buildModel(tpl.create()).hardware) if (h.note) notes.add(h.note);
    expect(notes.size).toBeGreaterThan(5);
    setLang('ru');
    const english = [...notes].filter((n) => LATIN.test(tr(n))).map((n) => `${n} → ${tr(n)}`);
    expect(english).toEqual([]);
  });

  it('every door-height band of the hinge and corner hinge notes is one Russian sentence', () => {
    setLang('ru');
    for (const h of [400, 900, 901, 1600, 1601, 2000, 2001, 2400]) {
      for (const note of [hingeNote(h), cornerHingeNote(h)]) {
        const ru = tr(note);
        expect(ru, note).not.toBe(note);
        expect(LATIN.test(ru), ru).toBe(false);
      }
    }
    expect(hingeNote(900)).toMatch(/^2 per door, doors up to 900 mm/);
    expect(hingeNote(2001)).toMatch(/^5 per door, doors over 2000 mm/);
  });

  it('notes with numbers use one key with placeholders, any number', () => {
    setLang('ru');
    expect(tr('side clearance 17 mm per side')).toBe('боковой зазор 17 мм с каждой стороны');
    expect(
      tr(
        "3 doors in two planes, 95 mm in front of the carcass (confirm rollers, track and door sizes with the sliding system's datasheet)",
      ),
    ).toMatch(/^3 дверцы в двух плоскостях, на 95 мм перед корпусом/);
    expect(
      tr(
        "niche 600×450×560 mm as entered — check every size and the ventilation against the appliance's installation drawing",
      ),
    ).toMatch(/^ниша 600×450×560 мм, как введено/);
    expect(
      tr("front 801×377 mm — choose by front weight and height from the fitting's datasheet"),
    ).toMatch(/^фасад 801×377 мм/);
  });
});

describe('catalog piece names on prints (ADR-202, G-353)', () => {
  const kitchenBase = catalogFamilies.find((f) => f.variants.some((v) => v.id === 'base-door'))!;
  const variant = kitchenBase.variants.find((v) => v.id === 'base-door')!;
  const piece = () => insertVariant(kitchenBase, variant)!;

  it('an untouched "Base cabinet, 1 door" prints in the print language', () => {
    const d = piece();
    expect(d.name).toBe('Base cabinet, 1 door');
    const printed: Record<PrintLang, string> = {
      ro: `${kitchenBase.nameRo} — 1 ușă + raft`,
      ru: 'Нижний шкаф, 1 дверца',
      en: 'Base cabinet, 1 door',
    };
    for (const lang of ['ro', 'ru', 'en'] as const) {
      setPrintLang(lang);
      expect(printPieceName(d), lang).toBe(printed[lang]);
    }
    expect(printed.ro).toBe('Corp bază cu uși — 1 ușă + raft');
  });

  it('the Russian name is read directly, whatever the UI language', () => {
    setLang('en');
    setPrintLang('ru');
    expect(printPieceName(piece())).toBe('Нижний шкаф, 1 дверца');
  });

  it('a renamed piece prints as typed in every language', () => {
    const d = { ...piece(), name: 'Dulap Ion' };
    for (const lang of ['ro', 'ru', 'en'] as const) {
      setPrintLang(lang);
      expect(printPieceName(d)).toBe('Dulap Ion');
    }
  });

  it('a design with no catalog origin prints as typed', () => {
    setPrintLang('ro');
    expect(printPieceName({ name: 'Base cabinet, 1 door' })).toBe('Base cabinet, 1 door');
  });

  it('every buildable variant has its Romanian and Russian names (no new keys)', () => {
    const missing: string[] = [];
    for (const f of catalogFamilies)
      for (const v of f.variants) {
        if (!v.create || f.id.startsWith('own-')) continue;
        if (!VARIANT_RO[v.id]) missing.push(`ro ${f.id}/${v.id}`);
        if (!f.nameRo) missing.push(`ro family ${f.id}`);
        const name = v.create().name;
        if (!data_catalog[name]) missing.push(`ru ${f.id}/${v.id} "${name}"`);
      }
    expect(missing).toEqual([]);
  });
});

describe('fastener lines in the print language (ADR-202, G-042)', () => {
  const counts: FastenerCount[] = fastenerCounts(
    buildModel(templates.find((x) => x.id === 'wardrobe')!.create()),
  );
  const csvOf = (lines: ReturnType<typeof fastenerShopLines>['lines']) =>
    shoppingCsvRo(
      shoppingList({ rows: [], materials: [], hardware: [], sheets: null }).concat(lines),
    );

  it('every joint has a print plural, line name and how text in Russian and English', () => {
    for (const j of JOINTS) {
      expect(COUNTED_PT[j.id], j.id).toBeTruthy();
      expect(PRINT_RU[COUNTED_PT[j.id]], j.id).toBeTruthy();
      expect(PRINT_EN[COUNTED_PT[j.id]], j.id).toBeTruthy();
    }
    setPrintLang('ru');
    expect(pt(COUNTED_PT['carcass-joint'], { n: 5 })).toBe('5 соединений');
    setPrintLang('en');
    expect(pt(COUNTED_PT['carcass-joint'], { n: 1 })).toBe('1 joint');
  });

  it('the lines still to choose print in Romanian, Russian and English', () => {
    const { lines } = fastenerShopLines(counts, []);
    const joint = lines.find((l) => l.label.startsWith('Joint fixings'))!;
    // The screen text stays in the UI language.
    expect(joint.label).toBe('Joint fixings: 18 joints — choose your fastener');
    setPrintLang('ro');
    expect(joint.printLabel).toBe('Fixare îmbinări: 18 îmbinări — alegeți elementul de fixare');
    expect(joint.printDetail).toMatch(/^Orientativ: numărat din model \(fiecare loc unde/);
    expect(joint.printDetail).toMatch(/Numiți-l pe al dvs\. în Setări › Elemente de fixare\.$/);
    let csv = csvOf(lines);
    expect(csv).toContain('Fixare îmbinări: 18 îmbinări');
    expect(csv).toContain('Lipiciul nu este numărat.');

    setPrintLang('ru');
    expect(joint.printLabel).toBe('Крепёж соединений: 18 соединений — выберите крепёж');
    expect(joint.printDetail).toMatch(/^Ориентировочно: подсчитано по модели \(/);
    csv = csvOf(lines);
    expect(csv).toContain('Крепёж соединений: 18 соединений — выберите крепёж');
    expect(csv).toContain(notCountedPrint());
    expect(notCountedPrint()).toMatch(/Клей не учитывается\.$/);
    const back = lines.find((l) => l.label.startsWith('Back fixings'))!;
    expect(back.printDetail).toMatch(/ м кромки задней стенки\)/);

    setPrintLang('en');
    expect(joint.printLabel).toBe('Joint fixings: 18 joints — choose your fastener');
    expect(joint.printDetail).toMatch(/^Guidance: counted from the model \(each place/);
    csv = csvOf(lines);
    expect(csv).toContain('Joint fixings: 18 joints — choose your fastener');
    expect(csv).toContain('Glue is not counted.');
    expect(csv).not.toMatch(/îmbinări|соединений/);
  });

  it("a chosen fastener prints the user's name as typed, its detail in the print language", () => {
    const { lines } = fastenerShopLines(counts, [
      { joint: 'carcass-joint', name: 'Confirmat 7 × 50', per: 2 },
      { joint: 'back-fixing', name: 'Confirmat 7 × 50', per: 10 },
    ]);
    const conf = lines.find((l) => l.label === 'Confirmat 7 × 50')!;
    setPrintLang('ro');
    expect(conf.printLabel).toBe('Confirmat 7 × 50');
    expect(conf.printDetail).toBe(
      'Orientativ: numărat din model: 18 îmbinări × 2; 1 panou de spate × 10.',
    );
    setPrintLang('ru');
    expect(conf.printLabel).toBe('Confirmat 7 × 50');
    expect(conf.printDetail).toMatch(/^Ориентировочно: подсчитано по модели: 18 соединений × 2; /);
    expect(csvOf(lines)).toContain('Confirmat 7 × 50');
    setPrintLang('en');
    expect(conf.printDetail).toBe('Guidance: counted from the model: 18 joints × 2; 1 back × 10.');
  });
});

describe('short Review labels (ADR-202, G-360)', () => {
  it("'Width of each compartment' reads 'Compartment widths' on Review, in Russian too", () => {
    const f = STEPS.flatMap((s) => s.fields).find((x) => x.id === 'widths')!;
    expect(f.label).toBe('Width of each compartment (0 = share the rest)');
    expect(f.reviewLabel).toBe('Compartment widths');
    setLang('ru');
    expect(tr(f.reviewLabel ?? f.label)).toBe('Ширина секций');
  });
});
