import { afterEach, describe, expect, it } from 'vitest';
import { buildModel } from '../src/core/build';
import { cutlist, hardwareSummary } from '../src/core/cutlist';
import { templates } from '../src/core/design';
import { PRINT_EN, PRINT_RU } from '../src/core/i18n/print-text';
import { getPrintLang, setPrintLang } from '../src/core/i18n/print';
import { CSV_HEADERS_RO, cutlistCsvRo, drillingRo, hardwareRo, partRo } from '../src/core/ro';

const chestCsv = () => {
  const d = templates.find((t) => t.id === 'chest')!.create();
  const csv = cutlistCsvRo(cutlist(buildModel(d), d.materials));
  const [head, ...lines] = csv.slice(1).trim().split('\r\n');
  return { csv, head: head.split(';'), lines };
};

describe('print language (ADR-157)', () => {
  afterEach(() => setPrintLang('ro'));

  it('is Romanian by default', () => {
    expect(getPrintLang()).toBe('ro');
    expect(chestCsv().head).toEqual(CSV_HEADERS_RO);
    expect(partRo('Left side')).toBe('Lateral stânga');
  });

  it('Russian: CSV header and part names', () => {
    setPrintLang('ru');
    const { csv, head, lines } = chestCsv();
    expect(csv.startsWith('﻿')).toBe(true);
    expect(head).toEqual([
      'Наименование',
      'Материал',
      'Толщина',
      'Длина',
      'Ширина',
      'Кол.',
      'Кромка Д',
      'Кромка Ш',
      'Тип кромки',
      'Текстура',
      'Присадка',
    ]);
    expect(csv).toContain('Боковина левая / Боковина правая');
    expect(csv).toContain('Фасад ящика');
    expect(csv).not.toContain('Lateral stânga');
    for (const l of lines) expect(l.split(';').length).toBe(head.length);
    expect(partRo('Base cabinet: Drawer 2 side')).toBe('Base cabinet: Боковина ящика');
    expect(drillingRo('2 rows × 14 holes ø5, 37 mm from edges, one face')).toBe(
      'ряды: 2 × 14 отв. ø5, 37 мм от краёв, одна пласть',
    );
  });

  it('English: CSV header and part names', () => {
    setPrintLang('en');
    const { csv, head } = chestCsv();
    expect(head).toEqual([
      'Part',
      'Material',
      'Thickness',
      'Length',
      'Width',
      'Qty',
      'Band L',
      'Band W',
      'Band type',
      'Grain',
      'Drilling',
    ]);
    expect(csv).toContain('Left side / Right side');
    expect(csv).toContain('Drawer front');
    expect(partRo('Drawer 2 side')).toBe('Drawer side');
    expect(drillingRo('2 rows × 14 holes ø5, 37 mm from edges, one face')).toBe(
      '2 rows × 14 holes ø5, 37 mm from edges, one face',
    );
  });

  it('every generated part and hardware item reads in the chosen language', () => {
    const seen = new Set<string>();
    for (const t of templates)
      for (const p of buildModel(t.create()).panels) if (p.role !== 'loose') seen.add(p.label);
    setPrintLang('ru');
    for (const label of seen) expect(partRo(label), label).toMatch(/[А-Яа-яЁё]/);
    const d = templates.find((t) => t.id === 'wardrobe')!.create();
    for (const h of hardwareSummary(buildModel(d)))
      expect(hardwareRo(h).item, h.kind).toMatch(/[А-Яа-яЁё]|push-to-open/);
    setPrintLang('en');
    for (const h of hardwareSummary(buildModel(d)))
      expect(hardwareRo(h).item, h.kind).not.toMatch(/[ăâîșț]/);
  });

  it('every Romanian print text has Russian and English', () => {
    for (const k of Object.keys(PRINT_RU) as (keyof typeof PRINT_RU)[]) {
      expect(PRINT_RU[k], k).toBeTruthy();
      expect(PRINT_EN[k], k).toBeTruthy();
    }
  });
});
