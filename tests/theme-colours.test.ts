// @vitest-environment jsdom
// Accent and primary colours of the light and dark sets (G-588): defaults equal src/styles.css, bad saved values are
// dropped (never repaired), and the rules use the dark set's selectors so a light colour never reaches the dark set.
import { readFileSync } from 'node:fs';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  parseThemeColours,
  resetAllThemeColours,
  resetThemeColour,
  setThemeColour,
  THEME_COLOURS,
  themeColourCss,
} from '../src/store/themeColours';

const css = readFileSync('src/styles.css', 'utf8');
const root = /:root\s*{([^}]*)}/.exec(css)![1];
const dark = /:root\[data-theme='dark'\]\s*{([^}]*)}/.exec(css)![1];
const token = (block: string, name: string) =>
  new RegExp(`${name}:\\s*([^;\\s]+);`).exec(block)?.[1];
const styleText = () => document.getElementById('fb-theme-colours')?.textContent ?? '';

describe('theme colours', () => {
  beforeEach(() => {
    resetAllThemeColours();
  });

  it('each default equals its token in styles.css (dark falls back to :root)', () => {
    for (const c of THEME_COLOURS) {
      expect(token(root, c.name), c.name).toBe(c.light);
      expect(token(dark, c.name) ?? token(root, c.name), c.name).toBe(c.dark);
      expect(token(dark, c.hover) ?? token(root, c.hover), c.hover).toBe(c.darkHover);
    }
  });

  it('keeps #rrggbb values of known names and drops the rest', () => {
    const r = parseThemeColours(
      JSON.stringify({
        light: { '--accent': '#ff0000', '--primary': 'red', '--ink': '#000000' },
        dark: { '--primary': '#112233' },
        sepia: {},
      }),
    );
    expect(r.values).toEqual({
      light: { '--accent': '#ff0000' },
      dark: { '--primary': '#112233' },
    });
    expect(r.ignored).toBe(3);
    expect(parseThemeColours('{bad').ignored).toBe(1);
    expect(parseThemeColours(null)).toEqual({ values: { light: {}, dark: {} }, ignored: 0 });
  });

  it('a light colour goes on :root and the dark set restates its default', () => {
    const out = themeColourCss({ light: { '--accent': '#ff0000' }, dark: {} });
    expect(out).toContain(':root { --accent: #ff0000;');
    expect(out).toContain(
      ":root[data-theme='dark'] { --accent: #f2c230; --accent-hover: #ebb81c; }",
    );
    expect(out).toContain(":root:not([data-theme='light'])");
  });

  it('a dark colour goes only under the dark selectors', () => {
    const out = themeColourCss({ light: {}, dark: { '--primary': '#112233' } });
    expect(out).not.toMatch(/^:root \{/m);
    expect(out).toContain(":root[data-theme='dark'] { --primary: #112233;");
    expect(themeColourCss({ light: {}, dark: {} })).toBe('');
  });

  it('set writes the style element and saves it; its default or a reset removes it', () => {
    setThemeColour('light', '--primary', '#AA0000');
    expect(styleText()).toContain('--primary: #aa0000;');
    expect(JSON.parse(localStorage.getItem('fb:theme-colours')!)).toEqual({
      light: { '--primary': '#aa0000' },
      dark: {},
    });
    setThemeColour('light', '--primary', 'nope');
    expect(styleText()).toContain('--primary: #aa0000;');
    resetThemeColour('light', '--primary');
    expect(document.getElementById('fb-theme-colours')).toBeNull();
    expect(localStorage.getItem('fb:theme-colours')).toBeNull();
    setThemeColour('dark', '--primary', '#3a7260');
    expect(localStorage.getItem('fb:theme-colours')).toBeNull();
  });
});
