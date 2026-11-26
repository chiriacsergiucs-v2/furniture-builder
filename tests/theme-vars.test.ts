// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  cssValue,
  parseThemeVars,
  resetAllThemeVars,
  scaleThemeVars,
  setThemeVar,
  stepThemeVar,
  THEME_GROUPS,
  THEME_VARS,
} from '../src/store/themeVars';

const root = /:root\s*{([^}]*)}/.exec(readFileSync('src/styles.css', 'utf8'))![1];

describe('theme variables', () => {
  it('each default equals its token in styles.css :root', () => {
    for (const v of THEME_VARS) {
      const m = new RegExp(`${v.name}:\\s*([^;\\s]+);`).exec(root);
      expect(m, v.name).not.toBeNull();
      expect(m![1], v.name).toBe(cssValue(v, v.def));
    }
  });

  it('each range holds its default and steps are positive', () => {
    for (const v of THEME_VARS) {
      expect(v.min, v.name).toBeLessThanOrEqual(v.def);
      expect(v.max, v.name).toBeGreaterThanOrEqual(v.def);
      expect(v.step, v.name).toBeGreaterThan(0);
    }
  });

  it('keeps valid values and drops, without clamping, unknown names, out-of-range and non-numbers', () => {
    const r = parseThemeVars(
      JSON.stringify({ '--fs-md': 1, '--s-2': 999, '--nope': 3, '--r': '6', '--lh': null }),
    );
    expect(r.values).toEqual({ '--fs-md': 1 });
    expect(r.ignored).toBe(4);
  });

  it('never throws on bad input', () => {
    expect(parseThemeVars(null)).toEqual({ values: {}, ignored: 0 });
    expect(parseThemeVars('{bad').ignored).toBe(1);
    expect(parseThemeVars('[1,2]').ignored).toBe(1);
  });
});

// The −/+ and ±5% rules (N378). `stored` reads what is saved on this device; a variable at its default is not saved.
const stored = (name: string): number | undefined =>
  (JSON.parse(localStorage.getItem('fb:theme-vars') ?? '{}') as Record<string, number>)[name];
const onRoot = (name: string) => document.documentElement.style.getPropertyValue(name);
const byName = (name: string) => THEME_VARS.find((v) => v.name === name)!;

// [name, value after +5%, value after −5%], worked out by hand from the default: px to the whole px, rem and line
// height to the nearest slider step; a default whose rounding does not move (4 px, 8 px, 6 px, 10 px down) moves one step.
const FIVE: [string, number, number][] = [
  ['--fs-xs', 0.875, 0.75],
  ['--fs-sm', 0.9375, 0.8125],
  ['--fs-md', 1, 0.875],
  ['--fs-lg', 1.125, 1],
  ['--fs-xl', 1.3125, 1.1875],
  ['--fs-2xl', 1.5625, 1.4375],
  ['--lh', 1.5, 1.4],
  ['--s-1', 5, 3],
  ['--s-2', 9, 7],
  ['--s-3', 13, 11],
  ['--s-4', 17, 15],
  ['--s-5', 21, 19],
  ['--s-6', 25, 23],
  ['--s-8', 34, 30],
  ['--r-sm', 5, 3],
  ['--r', 7, 5],
  ['--r-lg', 11, 9],
  ['--side', 378, 342],
  ['--out', 420, 380],
];

describe('theme variable steps and ±5%', () => {
  beforeEach(() => {
    localStorage.clear();
    resetAllThemeVars();
  });

  it('the table covers every variable', () => {
    expect(FIVE.map((r) => r[0]).sort()).toEqual(THEME_VARS.map((v) => v.name).sort());
  });

  it('+ and − move one variable by exactly its own step and set it on <html>', () => {
    stepThemeVar('--s-4', 1);
    expect(stored('--s-4')).toBe(17);
    expect(onRoot('--s-4')).toBe('17px');
    stepThemeVar('--fs-md', 1);
    expect(stored('--fs-md')).toBe(1);
    expect(onRoot('--fs-md')).toBe('1rem');
    stepThemeVar('--lh', -1);
    expect(stored('--lh')).toBe(1.4);
    expect(onRoot('--lh')).toBe('1.4');
    expect(stored('--s-5')).toBeUndefined();
    expect(onRoot('--s-5')).toBe('');
  });

  it('stepping back to the default removes the saved value and the property', () => {
    stepThemeVar('--r', 1);
    expect(onRoot('--r')).toBe('7px');
    stepThemeVar('--r', -1);
    expect(stored('--r')).toBeUndefined();
    expect(onRoot('--r')).toBe('');
    expect(localStorage.getItem('fb:theme-vars')).toBeNull();
  });

  it('a step at the range end stays at the end (the store clamps, it does not refuse)', () => {
    const v = byName('--s-4');
    setThemeVar(v.name, v.max);
    stepThemeVar(v.name, 1);
    expect(stored(v.name)).toBe(v.max);
    setThemeVar(v.name, v.min);
    stepThemeVar(v.name, -1);
    expect(stored(v.name)).toBe(v.min);
    const f = byName('--fs-xs');
    setThemeVar(f.name, f.max);
    stepThemeVar(f.name, 1);
    expect(stored(f.name)).toBe(1.4375);
  });

  it('setThemeVar ignores an out-of-range or non-finite value', () => {
    setThemeVar('--s-4', 999);
    setThemeVar('--s-4', Number.NaN);
    setThemeVar('--nope', 3);
    expect(stored('--s-4')).toBeUndefined();
  });

  it.each(FIVE)('%s: +5%% gives %f and −5%% gives %f from the default', (name, up, down) => {
    scaleThemeVars(1, [name]);
    expect(stored(name)).toBe(up);
    resetAllThemeVars();
    scaleThemeVars(-1, [name]);
    expect(stored(name)).toBe(down);
  });

  it('±5% rounds the result of the current value, not the default (to the closest integer px)', () => {
    setThemeVar('--side', 361);
    scaleThemeVars(1, ['--side']);
    expect(stored('--side')).toBe(379); // 379.05
    setThemeVar('--side', 379);
    scaleThemeVars(-1, ['--side']);
    expect(stored('--side')).toBeUndefined(); // 360.05 -> the default, so removed
    expect(onRoot('--side')).toBe('');
    setThemeVar('--s-6', 30);
    scaleThemeVars(1, ['--s-6']);
    expect(stored('--s-6')).toBe(32); // 31.5 rounds up
  });

  it('a press always moves at least one slider step when rounding gives no change', () => {
    scaleThemeVars(1, ['--s-1']); // 4.2 px rounds to 4
    expect(stored('--s-1')).toBe(5);
    scaleThemeVars(-1, ['--r-lg']); // 9.5 rounds back to 10
    expect(stored('--r-lg')).toBe(9);
  });

  it('±5% at the range end stays at the end and reports it (G-598)', () => {
    const v = byName('--s-4');
    setThemeVar(v.name, v.max);
    expect(scaleThemeVars(1, [v.name])).toBe(1);
    expect(stored(v.name)).toBe(v.max);
    setThemeVar(v.name, v.min);
    expect(scaleThemeVars(-1, [v.name])).toBe(1);
    expect(stored(v.name)).toBe(v.min);
    setThemeVar(v.name, 31);
    expect(scaleThemeVars(1, [v.name])).toBe(1); // 32.55 -> 33, past the end
    expect(stored(v.name)).toBe(v.max);
    setThemeVar(v.name, 20);
    expect(scaleThemeVars(1, [v.name])).toBe(0); // 21, inside the range
  });

  it.each(THEME_GROUPS.map((g) => [g.id, g.vars.map((v) => v.name)] as const))(
    'the %s group +5%% and −5%% change only its own variables',
    (_id, names) => {
      scaleThemeVars(1, names);
      for (const [name, up] of FIVE) {
        if (names.includes(name)) expect(stored(name), name).toBe(up);
        else expect(stored(name), name).toBeUndefined();
      }
      resetAllThemeVars();
      scaleThemeVars(-1, names);
      for (const [name, , down] of FIVE) {
        if (names.includes(name)) expect(stored(name), name).toBe(down);
        else expect(stored(name), name).toBeUndefined();
      }
    },
  );

  it('all variables +5% and −5% change every variable, and each value is written to <html>', () => {
    scaleThemeVars(1);
    for (const [name, up] of FIVE) {
      expect(stored(name), name).toBe(up);
      expect(onRoot(name), name).toBe(cssValue(byName(name), up));
    }
    resetAllThemeVars();
    scaleThemeVars(-1);
    for (const [name, , down] of FIVE) expect(stored(name), name).toBe(down);
  });

  it('+5% then −5% on all lands back on most defaults, and Reset all clears every property', () => {
    scaleThemeVars(1);
    scaleThemeVars(-1);
    expect(stored('--s-6')).toBeUndefined(); // 25 -> 23.75 -> 24, the default
    expect(stored('--s-8')).toBeUndefined(); // 34 -> 32.3 -> 32
    expect(stored('--r-lg')).toBeUndefined(); // 11 -> 10.45 -> 10
    expect(stored('--s-1')).toBeUndefined(); // 5 -> 4.75 rounds to 5, so one step down: 4
    resetAllThemeVars();
    for (const v of THEME_VARS) expect(onRoot(v.name), v.name).toBe('');
    expect(localStorage.getItem('fb:theme-vars')).toBeNull();
  });
});
