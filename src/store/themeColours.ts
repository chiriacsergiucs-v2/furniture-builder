import { useSyncExternalStore } from 'react';
import { t } from '@furniture-builder/i18n';
import { readLocal, writeLocal } from '../persist/localPrefs';

/**
 * Brand colours the user can change in the Appearance dialog (G-588): the accent and the primary colour, separately for
 * the light and the dark set. Kept on this device only (localStorage, like the theme and the theme variables, no
 * telemetry — ADR-002); no Dexie table, no design-document field. A change is written as a `<style>` element on <head>
 * whose rules use the same selectors as the dark set in `src/styles.css`, so a light colour never leaks into the dark
 * set and the other way round. The hover shade follows the chosen colour (`color-mix`, darker on light, lighter on
 * dark, the direction of the default hovers). `--control-h` is not here: touch targets stay 44 px (ADR-114).
 * `light` and `dark` are the defaults in `src/styles.css` (`tests/theme-colours.test.ts` keeps them equal).
 */
type ColourSet = 'light' | 'dark';
type ThemeColour = {
  name: string;
  hover: string;
  label: () => string;
  light: string;
  dark: string;
  /** The default dark hover (the dark set inherits `--accent-hover` from `:root`). */
  darkHover: string;
};

export const THEME_COLOURS: ThemeColour[] = [
  {
    name: '--accent',
    hover: '--accent-hover',
    label: () => t('Accent'),
    light: '#f2c230',
    dark: '#f2c230',
    darkHover: '#ebb81c',
  },
  {
    name: '--primary',
    hover: '--primary-hover',
    label: () => t('Primary'),
    light: '#2d5b4c',
    dark: '#3a7260',
    darkHover: '#44826e',
  },
];
export const COLOUR_SETS: ColourSet[] = ['light', 'dark'];

type ColourValues = Record<ColourSet, Record<string, string>>;
const KEY = 'fb:theme-colours';
const STYLE_ID = 'fb-theme-colours';
const HEX = /^#[0-9a-f]{6}$/;

const empty = (): ColourValues => ({ light: {}, dark: {} });

/**
 * Read saved colours. Anything that is not a known set and name with a `#rrggbb` value is dropped: the colour keeps
 * its default and `ignored` counts what was dropped, so the dialog can say so (ADR-008).
 */
export function parseThemeColours(raw: string | null): { values: ColourValues; ignored: number } {
  const values = empty();
  if (!raw) return { values, ignored: 0 };
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return { values, ignored: 1 };
  }
  if (typeof data !== 'object' || data === null || Array.isArray(data))
    return { values, ignored: 1 };
  let ignored = 0;
  for (const [set, entries] of Object.entries(data)) {
    if (
      (set !== 'light' && set !== 'dark') ||
      typeof entries !== 'object' ||
      entries === null ||
      Array.isArray(entries)
    ) {
      ignored++;
      continue;
    }
    for (const [name, c] of Object.entries(entries as Record<string, unknown>)) {
      if (THEME_COLOURS.some((x) => x.name === name) && typeof c === 'string' && HEX.test(c))
        values[set][name] = c;
      else ignored++;
    }
  }
  return { values, ignored };
}

/** The CSS rules for the saved colours; empty when nothing is saved. */
export function themeColourCss(values: ColourValues): string {
  const decl = (set: ColourSet, withDefaults: boolean) =>
    THEME_COLOURS.flatMap((c) => {
      const v = values[set][c.name];
      if (v === undefined) {
        // The dark set must restate a light override it does not define itself (`--accent` lives only in `:root`).
        const light = values.light[c.name];
        return withDefaults && light !== undefined
          ? [`${c.name}: ${c.dark};`, `${c.hover}: ${c.darkHover};`]
          : [];
      }
      const mix = set === 'light' ? 'black' : 'white';
      return [`${c.name}: ${v};`, `${c.hover}: color-mix(in srgb, ${v} 85%, ${mix});`];
    }).join(' ');
  const light = decl('light', false);
  const dark = decl('dark', true);
  const out: string[] = [];
  if (light) out.push(`:root { ${light} }`);
  if (dark)
    out.push(
      `@media screen and (prefers-color-scheme: dark) { :root:not([data-theme='light']) { ${dark} } }`,
      `@media screen { :root[data-theme='dark'] { ${dark} } }`,
    );
  return out.join('\n');
}

const listeners = new Set<() => void>();
function load() {
  return readLocal(KEY, parseThemeColours, { values: empty(), ignored: 0 });
}
let state = load();

/** Write the saved colours as a `<style>` element; called at start-up and on every change. */
export function applyThemeColours(): void {
  const css = themeColourCss(state.values);
  let el = document.getElementById(STYLE_ID);
  if (!css) el?.remove();
  else {
    if (!el) {
      el = document.createElement('style');
      el.id = STYLE_ID;
      document.head.appendChild(el);
    }
    el.textContent = css;
  }
  listeners.forEach((l) => l());
}

function save(values: ColourValues) {
  state = { values, ignored: 0 };
  writeLocal(
    KEY,
    Object.keys(values.light).length || Object.keys(values.dark).length
      ? JSON.stringify(values)
      : null,
  );
  applyThemeColours();
}

/** Set one colour of one set; its default is removed instead of saved. A value that is not `#rrggbb` does nothing. */
export function setThemeColour(set: ColourSet, name: string, value: string): void {
  const c = THEME_COLOURS.find((x) => x.name === name);
  const v = value.toLowerCase();
  if (!c || !HEX.test(v)) return;
  const next = { light: { ...state.values.light }, dark: { ...state.values.dark } };
  if (v === c[set]) delete next[set][name];
  else next[set][name] = v;
  save(next);
}

export function resetThemeColour(set: ColourSet, name: string): void {
  const next = { light: { ...state.values.light }, dark: { ...state.values.dark } };
  delete next[set][name];
  save(next);
}

export function resetAllThemeColours(): void {
  save(empty());
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
}

/** The saved colours and how many saved entries were ignored; the object changes only when a colour does. */
export function useThemeColours(): { values: ColourValues; ignored: number } {
  return useSyncExternalStore(
    subscribe,
    () => state,
    () => state,
  );
}
