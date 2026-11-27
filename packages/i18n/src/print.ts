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
 * Built-in board names (src/core/design.ts `defaultMaterials` and `solidMaterials`, src/core/projectRuns.ts
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

/**
 * Built-in hardware names (the catalog variants' `hardware`, read by the `hardware-to-choose` rule) by their English
 * text, with their Romanian print key (G-521). A name the user typed prints as typed.
 */
const BUILT_IN_HARDWARE_RO = new Map<string, PrintKey>([
  [
    'full-extension runners suited to a sink drawer; the siphon/trap sets the notch',
    'glisiere cu extragere totală potrivite pentru un sertar sub chiuvetă; sifonul stabilește decupajul',
  ],
  ['waste pull-out system', 'sistem extractibil pentru coșul de gunoi'],
  [
    'oven — enter its niche size from the installation drawing',
    'cuptor — introduceți dimensiunea nișei din desenul de montaj',
  ],
  ['pull-out frame', 'cadru extractibil'],
  [
    'oven and microwave — enter their niche sizes from the installation drawings',
    'cuptor și cuptor cu microunde — introduceți dimensiunile nișelor din desenele de montaj',
  ],
  [
    'fridge — enter its niche size from the installation drawing',
    'frigider — introduceți dimensiunea nișei din desenul de montaj',
  ],
  [
    'wall hanging brackets (corner units do not get them automatically)',
    'suporți de agățare pe perete (corpurile de colț nu îi primesc automat)',
  ],
  ['hanging-file rails', 'șine pentru dosare suspendate'],
  [
    'hanging-file rails and full-extension runners rated for files',
    'șine pentru dosare suspendate și glisiere cu extragere totală pentru greutatea dosarelor',
  ],
  ['lateral hanging-file rails', 'șine transversale pentru dosare suspendate'],
  [
    'upholstery (foam, webbing or springs, fabric) — bought, not cut',
    'tapițerie (burete, chingi sau arcuri, stofă) — cumpărată, nu se croiește',
  ],
  [
    'upholstery (foam, webbing or springs, fabric) — bought, not cut; module connector brackets',
    'tapițerie (burete, chingi sau arcuri, stofă) — cumpărată, nu se croiește; console de legătură între module',
  ],
  [
    "reclining mechanism (it sets the frame's inside sizes); upholstery (foam, webbing or springs, fabric) — bought, not cut",
    'mecanism de rabatare (stabilește dimensiunile interioare ale cadrului); tapițerie (burete, chingi sau arcuri, stofă) — cumpărată, nu se croiește',
  ],
  [
    "reclining mechanism with footrest linkage (it sets the positions and the frame's inside sizes); upholstery (foam, webbing or springs, fabric) — bought, not cut",
    'mecanism de rabatare cu legătură pentru suportul de picioare (stabilește pozițiile și dimensiunile interioare ale cadrului); tapițerie (burete, chingi sau arcuri, stofă) — cumpărată, nu se croiește',
  ],
  [
    'gas lift, synchro mechanism and 5-star base are bought; this frame has fixed legs instead',
    'pistonul cu gaz, mecanismul sincron și baza cu 5 brațe se cumpără; acest cadru are în schimb picioare fixe',
  ],
  [
    'gas lift, synchro mechanism, 5-star base and back support bar are bought',
    'pistonul cu gaz, mecanismul sincron, baza cu 5 brațe și bara de susținere a spătarului se cumpără',
  ],
  ['adjustable backrest prop and wheels', 'suport reglabil pentru spătar și roți'],
  ['backrest hinges and prop', 'balamale și suport pentru spătar'],
  ['futon fold mechanism', 'mecanism de pliere pentru futon'],
]);

/** A hardware name inside a printed warning: a built-in name in the print language, any other as typed. */
export function printHardwareName(name: string): string {
  const ro = BUILT_IN_HARDWARE_RO.get(name);
  return ro === undefined ? name : pt(ro);
}

/** A built-in board or hardware name in the print language, or undefined for a name the user typed (G-521). */
export function printBuiltInName(name: string): string | undefined {
  const ro = BUILT_IN_BOARD_RO.get(name) ?? BUILT_IN_HARDWARE_RO.get(name);
  return ro === undefined ? undefined : pt(ro);
}
