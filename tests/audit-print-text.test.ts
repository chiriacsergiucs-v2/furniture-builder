// ADR-260 and ADR-265: print text in the three print languages (the Client sheet's plural, the printed front view's
// space labels, the Shopping estimate).
import { afterEach, describe, expect, it } from 'vitest';
import { pt, setPrintLang } from '../src/core/i18n/print';

afterEach(() => setPrintLang('ro'));

describe('print text (ADR-260, ADR-265)', () => {
  it('lines without a price take the singular for one, in ro, ru and en', () => {
    expect(pt('{n|# linie fără preț|# linii fără preț}', { n: 1 })).toBe('1 linie fără preț');
    expect(pt('{n|# linie fără preț|# linii fără preț}', { n: 2 })).toBe('2 linii fără preț');
    setPrintLang('en');
    expect(pt('{n|# linie fără preț|# linii fără preț}', { n: 1 })).toBe('1 line without a price');
    setPrintLang('ru');
    expect(pt('{n|# linie fără preț|# linii fără preț}', { n: 5 })).toBe('5 строк без цены');
  });

  it('the front view space labels follow the print language', () => {
    expect(pt('{n|# raft|# rafturi}', { n: 3 })).toBe('3 rafturi');
    setPrintLang('en');
    expect(pt('{n|# sertar|# sertare}', { n: 1 })).toBe('1 drawer');
    setPrintLang('ru');
    expect(pt('Gol')).toBe('Пусто');
  });
});
