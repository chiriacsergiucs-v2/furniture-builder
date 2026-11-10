/**
 * The app's language (ADR-153): English by default, Russian on request. The key of every text is its English text;
 * `ru` maps it to Russian. `t` only accepts keys that have a Russian entry, so a text added without one fails the
 * type check (CLAUDE.md rule). Text that comes from data (catalog, wizard, research, generated part names) goes
 * through `tr`, a plain lookup that falls back to the English text. Pure TypeScript, no UI imports.
 *
 * Placeholders: `{name}` takes `params.name`. Plurals: `{n|part|parts}` in English and `{n|деталь|детали|деталей}`
 * in Russian pick a form by `params.n`; `#` inside a form is the number itself (`{n|# part|# parts}`).
 *
 * Context: one English word with two meanings gets a key per meaning, `Back@@panel` (the back panel) beside `Back`
 * (go back); English shows the text before `@@`.
 */
// Type only (ADR-229): the Russian dictionary is a lazy chunk, loaded by `loadDictionary` before the app's modules.
import type { ru } from './ru';

export type Lang = 'en' | 'ru';
export const LANGS: Lang[] = ['en', 'ru'];
/** Each language in its own words, for the switch. */
export const LANG_NAME: Record<Lang, string> = { en: 'English', ru: 'Русский' };

export type Key = keyof typeof ru;
export type Params = Record<string, string | number>;

let lang: Lang = 'en';

/**
 * Set once, before the app's modules load (src/langInit.ts); tests set it per case. Russian text needs its
 * dictionary loaded first (`loadDictionary`); until then `t` and `tr` give English.
 */
export function setLang(l: Lang): void {
  lang = l;
}
export function getLang(): Lang {
  return lang;
}
/** A stored language, or English for anything else. */
export function parseLang(v: string | null | undefined): Lang {
  return LANGS.find((l) => l === v) ?? 'en';
}

/** The Russian code texts, once loaded. */
let RU: Partial<Record<Key, string>> = {};
// Data entries win: a part named "Back" is the back panel, not the "Back" button.
let RU_ALL: Record<string, string> = {};
/** Keys with simple placeholders, by their text with each placeholder as a hole: `Top box {w}` → `Top box ␁`. */
let shapes: Map<string, { names: string[]; value: string }> | null = null;

/**
 * Load a language's dictionary (ADR-229): a dynamic import of the Russian one, nothing for English. src/main.tsx
 * awaits it before importing the app, so texts made at module load are in that language; tests that switch to
 * Russian await it in their setup.
 */
export async function loadDictionary(l: Lang): Promise<void> {
  if (l !== 'ru' || Object.keys(RU).length) return;
  const m = await import('./ru');
  RU = m.ru;
  RU_ALL = { ...m.ru, ...m.ruData };
  shapes = null;
  namePatterns = undefined;
}

/** Russian plural form: 0 one (1, 21), 1 few (2–4, 22–24), 2 many (5–20, 25…). */
export function ruPlural(n: number): 0 | 1 | 2 {
  const a = Math.abs(Math.trunc(n));
  const d = a % 10;
  const h = a % 100;
  if (d === 1 && h !== 11) return 0;
  if (d >= 2 && d <= 4 && (h < 12 || h > 14)) return 1;
  return 2;
}

/** Fill `{name}` and `{n|one|other}` (English) or `{n|one|few|many}` (Russian) in a text. */
export function format(text: string, params: Params | undefined, l: Lang = lang): string {
  if (!params) return text;
  return text.replace(/\{(\w+)((?:\|[^|{}]*)*)\}/g, (all, name: string, forms: string) => {
    const v = params[name];
    if (v === undefined) return all;
    if (!forms) return String(v);
    const list = forms.slice(1).split('|');
    const n = Number(v);
    const i = l === 'ru' ? Math.min(ruPlural(n), list.length - 1) : n === 1 ? 0 : list.length - 1;
    return list[i].replace(/#/g, String(v));
  });
}

/** The English text of a key: the key without its `@@context`. */
export function english(key: string): string {
  const at = key.indexOf('@@');
  return at < 0 ? key : key.slice(0, at);
}

/** The text in the current language. */
export function t(key: Key, params?: Params): string {
  return format((lang === 'ru' ? RU[key] : undefined) ?? english(key), params);
}

const NUM = /\d+(?:[.,]\d+)?/g;
const HOLE = '\u0001';
function shapeOf(text: string): { names: string[]; value: string } | undefined {
  if (!shapes) {
    shapes = new Map();
    for (const [k, value] of Object.entries(RU_ALL)) {
      const names = [...k.matchAll(/\{(\w+)\}/g)].map((m) => m[1]);
      if (names.length) shapes.set(k.replace(/\{\w+\}/g, HOLE), { names, value });
    }
  }
  return shapes.get(text);
}

/**
 * Keys whose placeholders hold names, not only numbers ('Flap fitting: {name}', 'Screws: {a} to {b}'), as patterns,
 * built once (ADR-256): the text before the first placeholder must be non-empty, so a pattern never matches everything.
 */
let namePatterns: { re: RegExp; names: string[]; value: string }[] | undefined;
const escapeRe = (x: string) => x.replace(/[.*+?^$()|[\]\\]/g, '\\$&');
function nameFill(text: string): string | undefined {
  if (!namePatterns) {
    namePatterns = [];
    for (const [k, value] of Object.entries(RU_ALL)) {
      if (/\{\w+\|/.test(k)) continue;
      const names = [...k.matchAll(/\{(\w+)\}/g)].map((m) => m[1]);
      if (!names.length || k.indexOf('{') < 1) continue;
      const re = new RegExp(`^${k.split(/\{\w+\}/).map(escapeRe).join('(.+?)')}$`);
      namePatterns.push({ re, names, value });
    }
  }
  for (const p of namePatterns) {
    const m = p.re.exec(text);
    // Each filled part is a data text too (a part's name), or the user's own words, kept as typed.
    if (m) return format(p.value, Object.fromEntries(p.names.map((n, i) => [n, tr(m[i + 1])])), 'ru');
  }
  return undefined;
}

/** Russian for a data text with no entry of its own: numbers in it fill a key's placeholders, `A: B` both sides. */
function trLoose(text: string): string | undefined {
  const nums = text.match(NUM);
  if (nums) {
    const s = shapeOf(text.replace(NUM, HOLE));
    if (s && s.names.length === nums.length)
      return format(s.value, Object.fromEntries(s.names.map((n, i) => [n, nums[i]])), 'ru');
  }
  // Names in a key's placeholders (ADR-256).
  const named = nameFill(text);
  if (named !== undefined) return named;
  const at = text.indexOf(': ');
  if (at > 0) {
    const a = tr(text.slice(0, at));
    const b = tr(text.slice(at + 2));
    if (a !== text.slice(0, at) || b !== text.slice(at + 2)) return `${a}: ${b}`;
  }
  return undefined;
}

/**
 * A text from data, in the current language; the English text when it has no entry. A generated name with numbers
 * in it ("Top box 600") uses the key with placeholders ("Top box {w}"); "Piece: part" translates each side.
 */
export function tr(text: string, params?: Params): string {
  if (lang === 'ru') {
    const v = RU_ALL[text] ?? (params ? undefined : trLoose(text));
    if (v !== undefined) return format(v, params);
  }
  return format(text, params);
}

/** Whether a data text has a Russian entry (tests of ADR-155). */
export function hasRu(text: string): boolean {
  return Object.prototype.hasOwnProperty.call(RU_ALL, text);
}
