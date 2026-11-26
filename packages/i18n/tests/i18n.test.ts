// The i18n package on its own (ADR-280): the UI language, the Russian dictionary loaded on demand, data text and
// the print language, with nothing from the app.
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { format, getLang, loadDictionary, parseLang, setLang, t, tr } from '../src/index';
import { getPrintLang, loadPrintTables, parsePrintLang, pt, setPrintLang } from '../src/print';

beforeAll(loadPrintTables);
afterEach(() => {
  setLang('en');
  setPrintLang('ro');
});

describe('i18n package (ADR-280)', () => {
  it('t() gives English, then Russian once the dictionary is loaded', async () => {
    expect(t('Thickness')).toBe('Thickness');
    await loadDictionary('ru');
    setLang('ru');
    expect(getLang()).toBe('ru');
    expect(t('Thickness')).toBe('Толщина');
  });

  it('tr() falls back to the English text when there is no entry', async () => {
    await loadDictionary('ru');
    setLang('ru');
    expect(tr('A name nobody translated')).toBe('A name nobody translated');
  });

  it('format() fills params; parse functions fall back to the default language', () => {
    expect(format('{n} mm', { n: 18 }, 'en')).toBe('18 mm');
    expect(parseLang('xx')).toBe('en');
    expect(parsePrintLang('xx')).toBe('ro');
  });

  it('pt() gives the print language, Romanian by default', () => {
    expect(getPrintLang()).toBe('ro');
    expect(pt('Grosime')).toBe('Grosime');
    setPrintLang('en');
    expect(pt('Grosime')).toBe('Thickness');
  });
});

describe('print tables load on demand (G-496)', () => {
  it('Russian and English need the tables; Romanian never does', async () => {
    const key = 'Un despărțitor din rândul {i} este aliniat cu unul din rândul de deasupra.';
    const g = globalThis as { __fbPrintTables?: unknown };
    const kept = g.__fbPrintTables;
    delete g.__fbPrintTables;
    try {
      setPrintLang('ro');
      expect(pt(key, { i: 2 })).toMatch(/rândul 2/);
      setPrintLang('ru');
      expect(() => pt(key, { i: 2 })).toThrow(/not loaded/);
      await loadPrintTables();
      expect(pt(key, { i: 2 })).toMatch(/ряду 2/);
    } finally {
      setPrintLang('ro');
      g.__fbPrintTables = kept;
    }
  });
});
