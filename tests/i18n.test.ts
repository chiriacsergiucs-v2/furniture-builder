import { afterEach, describe, expect, it } from 'vitest';
import { buildModel } from '../src/core/build';
import { templates } from '../src/core/design';
import type { CabinetParams, Design } from '../src/core/types';
import { format, getLang, hasRu, parseLang, ruPlural, setLang, t, tr } from '../src/core/i18n';

afterEach(() => setLang('en'));

describe('t (ADR-153)', () => {
  it('gives the English text by default and the Russian text when Russian is chosen', () => {
    expect(getLang()).toBe('en');
    expect(t('Language')).toBe('Language');
    setLang('ru');
    expect(t('Language')).toBe('Язык');
  });

  it('fills placeholders and picks English and Russian plural forms', () => {
    const key = 'What this version of the app can do: {n|# feature|# features}, grouped by domain.';
    expect(t(key, { n: 1 })).toBe(
      'What this version of the app can do: 1 feature, grouped by domain.',
    );
    expect(t(key, { n: 5 })).toBe(
      'What this version of the app can do: 5 features, grouped by domain.',
    );
    setLang('ru');
    expect(t(key, { n: 1 })).toContain('1 функция');
    expect(t(key, { n: 3 })).toContain('3 функции');
    expect(t(key, { n: 11 })).toContain('11 функций');
    expect(t(key, { n: 21 })).toContain('21 функция');
  });

  it('only accepts keys that have a Russian entry', () => {
    // @ts-expect-error a text without a Russian entry fails the type check (CLAUDE.md translation rule)
    expect(t('A text nobody translated')).toBe('A text nobody translated');
  });

  it('keeps an unknown placeholder and fills named ones', () => {
    expect(format('Delete {name}? {other}', { name: 'Desk' })).toBe('Delete Desk? {other}');
  });

  it('uses the Russian plural rules', () => {
    expect([1, 2, 5, 11, 12, 14, 21, 22, 25, 101, 111].map(ruPlural)).toEqual([
      0, 1, 2, 2, 2, 2, 0, 1, 2, 0, 2,
    ]);
  });

  it('reads a stored language, English for anything else', () => {
    expect(parseLang('ru')).toBe('ru');
    expect(parseLang('de')).toBe('en');
    expect(parseLang(null)).toBe('en');
  });

  it('tr falls back to the English text when data has no entry', () => {
    setLang('ru');
    expect(hasRu('No such data text')).toBe(false);
    expect(tr('No such data text')).toBe('No such data text');
  });
});

describe('tr for generated names (ADR-155)', () => {
  it('fills a key with placeholders from the numbers in a name, and translates both sides of "A: B"', () => {
    setLang('ru');
    expect(tr('Door 3')).toBe('Дверь 3');
    expect(tr('Top box 600')).toBe('Антресоль 600');
    expect(tr('Door 3: Left side')).toBe(`Дверь 3: ${tr('Left side')}`);
    expect(tr('Left side')).not.toBe('Left side');
    setLang('en');
    expect(tr('Door 3')).toBe('Door 3');
  });
});

describe('problem messages (ADR-156)', () => {
  it('gives the same error code with a Russian message when Russian is chosen', () => {
    const d = templates.find((x) => x.id === 'chest')!.create();
    const params = (d.product as { params: CabinetParams }).params;
    const shallow: Design = {
      ...d,
      product: { ...d.product, params: { ...params, depth: 200 } } as Design['product'],
    };
    const runner = () => buildModel(shallow).diagnostics.find((x) => x.code === 'runner-fit');
    const en = runner();
    setLang('ru');
    const ru = runner();
    expect(en?.severity).toBe('error');
    expect(ru?.severity).toBe('error');
    expect(ru?.message).not.toBe(en?.message);
    expect(ru?.message).toMatch(/[а-яё]/i);
  });
});
