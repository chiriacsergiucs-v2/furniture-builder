import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { cssValue, parseThemeVars, THEME_VARS } from '../src/store/themeVars';

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
