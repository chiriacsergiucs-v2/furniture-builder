import { useSyncExternalStore } from 'react';
import { t } from '@furniture-builder/i18n';
import { clamp } from '../core/clamp';

/**
 * Theme variables the user can change (Appearance dialog): font sizes, line height, spacing, corner radii and the two
 * side-panel widths. A change is a CSS custom property set on <html>, so every screen follows at once. The values are
 * kept on this device only (localStorage, like the theme, no telemetry — ADR-002); no Dexie table, no design-document
 * field. `def` is the value in `src/styles.css` `:root` (`tests/theme-vars.test.ts` keeps the two equal). Not here:
 * `--control-h` (touch targets stay 44 px on a touch screen, ADR-114) and colours (the dark set overrides them).
 */
type ThemeVar = {
  name: string;
  label: () => string;
  unit: 'rem' | 'px' | '';
  min: number;
  max: number;
  step: number;
  def: number;
};
type ThemeGroup = { id: string; title: () => string; vars: ThemeVar[] };

const rem = (name: string, label: () => string, def: number): ThemeVar => ({
  name,
  label,
  unit: 'rem',
  min: Math.round(def * 0.75 * 16) / 16,
  max: Math.round(def * 1.75 * 16) / 16,
  step: 0.0625,
  def,
});
const px = (
  name: string,
  label: () => string,
  def: number,
  min: number,
  max: number,
): ThemeVar => ({
  name,
  label,
  unit: 'px',
  min,
  max,
  step: 1,
  def,
});

export const THEME_GROUPS: ThemeGroup[] = [
  {
    id: 'font',
    title: () => t('Font size'),
    vars: [
      rem('--fs-xs', () => t('Hints and captions'), 0.8125),
      rem('--fs-sm', () => t('Labels'), 0.875),
      rem('--fs-md', () => t('Body text'), 0.9375),
      rem('--fs-lg', () => t('Section titles'), 1.0625),
      rem('--fs-xl', () => t('Panel titles'), 1.25),
      rem('--fs-2xl', () => t('Dialog titles'), 1.5),
      {
        name: '--lh',
        label: () => t('Line height'),
        unit: '',
        min: 1.2,
        max: 2,
        step: 0.05,
        def: 1.45,
      },
    ],
  },
  {
    id: 'space',
    title: () => t('Gaps and paddings'),
    vars: [
      px('--s-1', () => t('Space 1 (tightest)'), 4, 2, 8),
      px('--s-2', () => t('Space 2'), 8, 4, 16),
      px('--s-3', () => t('Space 3'), 12, 6, 24),
      px('--s-4', () => t('Space 4'), 16, 8, 32),
      px('--s-5', () => t('Space 5'), 20, 10, 40),
      px('--s-6', () => t('Space 6'), 24, 12, 48),
      px('--s-8', () => t('Space 8 (widest)'), 32, 16, 64),
    ],
  },
  {
    id: 'shape',
    title: () => t('Corners'),
    vars: [
      px('--r-sm', () => t('Small radius'), 4, 0, 12),
      px('--r', () => t('Radius'), 6, 0, 16),
      px('--r-lg', () => t('Large radius'), 10, 0, 24),
    ],
  },
  {
    id: 'layout',
    title: () => t('Panel widths'),
    vars: [
      px('--side', () => t('Side panel'), 360, 280, 520),
      px('--out', () => t('Output panel'), 400, 320, 560),
    ],
  },
];

export const THEME_VARS: ThemeVar[] = THEME_GROUPS.flatMap((g) => g.vars);
const KEY = 'fb:theme-vars';

/** A value as CSS: `1.0625rem`, `12px`, `1.45`. */
export function cssValue(v: ThemeVar, n: number): string {
  return `${Number(n.toFixed(4))}${v.unit}`;
}

/**
 * Read saved values. Anything that is not a known name with a finite number inside its range is dropped, never
 * clamped: the variable keeps its default and `ignored` counts what was dropped, so the dialog can say so (ADR-008).
 */
export function parseThemeVars(raw: string | null): {
  values: Record<string, number>;
  ignored: number;
} {
  const values: Record<string, number> = {};
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
  for (const [name, n] of Object.entries(data)) {
    const v = THEME_VARS.find((x) => x.name === name);
    if (v && typeof n === 'number' && Number.isFinite(n) && n >= v.min && n <= v.max)
      values[name] = n;
    else ignored++;
  }
  return { values, ignored };
}

const listeners = new Set<() => void>();
function load() {
  try {
    return parseThemeVars(localStorage.getItem(KEY));
  } catch {
    return { values: {}, ignored: 0 };
  }
}
let state = load();

/** Write every saved value on <html> and clear the rest; called at start-up and on every change. */
export function applyThemeVars(): void {
  const root = document.documentElement;
  for (const v of THEME_VARS) {
    const n = state.values[v.name];
    if (n === undefined) root.style.removeProperty(v.name);
    else root.style.setProperty(v.name, cssValue(v, n));
  }
  listeners.forEach((l) => l());
}

function save(values: Record<string, number>) {
  state = { values, ignored: 0 };
  try {
    if (Object.keys(values).length) localStorage.setItem(KEY, JSON.stringify(values));
    else localStorage.removeItem(KEY);
  } catch {
    /* private mode: the choice lasts for this page only */
  }
  applyThemeVars();
}

/** Set one variable; a value equal to its default is removed. */
export function setThemeVar(name: string, n: number): void {
  const v = THEME_VARS.find((x) => x.name === name);
  if (!v || !Number.isFinite(n) || n < v.min || n > v.max) return;
  const next = { ...state.values };
  if (n === v.def) delete next[name];
  else next[name] = n;
  save(next);
}

export function resetThemeVar(name: string): void {
  const next = { ...state.values };
  delete next[name];
  save(next);
}

const place = (v: ThemeVar, n: number) => clamp(Number(n.toFixed(4)), v.min, v.max);

/** The value one slider step up or down, kept inside the range. */
function stepped(v: ThemeVar, n: number, dir: 1 | -1): number {
  return place(v, n + dir * v.step);
}

/**
 * The value 5% up or down, rounded to the nearest whole px (rem and line height: the nearest slider step), kept inside
 * the range. When rounding gives no change (4 px × 5% = 0.2 px) it moves one slider step, so a press always does something.
 */
function scaled(v: ThemeVar, n: number, dir: 1 | -1): number {
  const grid = v.unit === 'px' ? 1 : v.step;
  const r = place(v, Math.round((n * (1 + dir * 0.05)) / grid) * grid);
  return r === n ? stepped(v, n, dir) : r;
}

function change(names: string[], next: (v: ThemeVar, n: number) => number): void {
  const out = { ...state.values };
  for (const v of THEME_VARS) {
    if (!names.includes(v.name)) continue;
    const n = next(v, out[v.name] ?? v.def);
    if (n === v.def) delete out[v.name];
    else out[v.name] = n;
  }
  save(out);
}

/** One slider step for one variable. */
export function stepThemeVar(name: string, dir: 1 | -1): void {
  change([name], (v, n) => stepped(v, n, dir));
}

/**
 * ±5% of the current value for the named variables (all of them when `names` is omitted). Returns how many of them
 * stopped at the end of their range (already there, or cut to it), so the dialog can say so instead of clamping
 * silently (G-598, ADR-008).
 */
export function scaleThemeVars(
  dir: 1 | -1,
  names: string[] = THEME_VARS.map((v) => v.name),
): number {
  let atLimit = 0;
  change(names, (v, n) => {
    const grid = v.unit === 'px' ? 1 : v.step;
    const wanted = Math.round((n * (1 + dir * 0.05)) / grid) * grid;
    const end = dir > 0 ? v.max : v.min;
    if (n === end || (dir > 0 ? wanted > v.max : wanted < v.min)) atLimit++;
    return scaled(v, n, dir);
  });
  return atLimit;
}

export function resetAllThemeVars(): void {
  save({});
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
}

/** The saved values and how many saved entries were ignored; the object changes only when a value does. */
export function useThemeVars(): { values: Record<string, number>; ignored: number } {
  return useSyncExternalStore(
    subscribe,
    () => state,
    () => state,
  );
}
