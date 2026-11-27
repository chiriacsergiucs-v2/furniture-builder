/**
 * The language of what goes to the panel shop (ADR-157): printed sheets, drawing labels, the parts CSV and the review
 * pack. Romanian by default (ADR-020), Russian or English when the user chooses; separate from the UI language.
 * `pt(ro)` takes the Romanian text as its key and gives it in the print language; `PRINT_RU` and `PRINT_EN`
 * (`./print-text`) hold the other two. They are a lazy chunk (G-496): `loadPrintTables()` loads them, and the app awaits
 * it before choosing Russian or English (`src/langInit.ts`, the More menu). Pure TypeScript, no UI imports.
 */
import { format, type Params } from './index';
import type * as Tables from './print-text';

export { WARNING_RO } from './warning-text';

type PrintTables = typeof Tables;
/** Kept on the global object so every copy of this module (tests load the app again per render) shares one load. */
const shared = globalThis as { __fbPrintTables?: PrintTables };

/** Load the Russian and English print tables once; Romanian needs none. */
export async function loadPrintTables(): Promise<void> {
  shared.__fbPrintTables ??= await import('./print-text');
}

export type PrintLang = 'ro' | 'ru' | 'en';
export const PRINT_LANGS: PrintLang[] = ['ro', 'ru', 'en'];
export const PRINT_LANG_NAME: Record<PrintLang, string> = {
  ro: 'Română',
  ru: 'Русский',
  en: 'English',
};

/** The date format of each print language. */
export const PRINT_DATE_LOCALE: Record<PrintLang, string> = {
  ro: 'ro-RO',
  ru: 'ru-RU',
  en: 'en-GB',
};

let printLang: PrintLang = 'ro';

/** Choose the print language; Russian and English need `loadPrintTables()` first, or `pt` throws. */
export function setPrintLang(l: PrintLang): void {
  printLang = l;
}
export function getPrintLang(): PrintLang {
  return printLang;
}
/** A stored print language, or Romanian for anything else. */
export function parsePrintLang(v: string | null | undefined): PrintLang {
  return PRINT_LANGS.find((l) => l === v) ?? 'ro';
}

export type PrintKey = keyof PrintTables['PRINT_RU'];

/** The Romanian text `ro` in the print language. */
export function pt(ro: PrintKey, params?: Params): string {
  const tables = printLang === 'ro' ? undefined : shared.__fbPrintTables;
  if (printLang !== 'ro' && !tables) throw new Error('print tables not loaded (loadPrintTables)');
  const text = tables ? (printLang === 'ru' ? tables.PRINT_RU[ro] : tables.PRINT_EN[ro]) : ro;
  return format(text, params, printLang === 'ru' ? 'ru' : 'en');
}

/**
 * Built-in board names (src/core/design.ts `defaultMaterials` and `solidMaterials`, src/core/project.ts
 * `worktopMaterial`) by their stored English name, with their Romanian print key (G-537, user 2026-11-27: "Translate on
 * print"). Only an exact stored name is looked up; a name the user typed or changed prints as typed.
 */
const BUILT_IN_BOARD_RO = new Map<string, PrintKey>([
  ['PAL 18 white', 'PAL 18 alb'],
  ['PAL 18 oak', 'PAL 18 stejar'],
  ['PAL 16 white', 'PAL 16 alb'],
  ['MDF 18 painted', 'MDF 18 vopsit'],
  ['HDF 3', 'HDF 3'],
  ['Beech, solid', 'Fag, masiv'],
  ['Pine, solid', 'Pin, masiv'],
  ['Larch, solid (outdoor)', 'Larice, masiv (exterior)'],
  ['Worktop 38', 'Blat 38'],
]);

/** A board's name on the printed sheets and in the CSVs: a built-in name in the print language, any other as typed. */
export function printBoardName(name: string): string {
  const ro = BUILT_IN_BOARD_RO.get(name);
  return ro === undefined ? name : pt(ro);
}
