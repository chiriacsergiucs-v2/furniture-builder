/**
 * The language of what goes to the panel shop (ADR-157): printed sheets, drawing labels, the parts CSV and the review
 * pack. Romanian by default (ADR-020), Russian or English when the user chooses; separate from the UI language.
 * `pt(ro)` takes the Romanian text as its key and gives it in the print language; `PRINT_RU` and `PRINT_EN` hold the
 * other two. Pure TypeScript, no UI imports.
 */
import { format, type Params } from './index';
import { PRINT_EN, PRINT_RU } from './print-text';

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

export type PrintKey = keyof typeof PRINT_RU;

/** The Romanian text `ro` in the print language. */
export function pt(ro: PrintKey, params?: Params): string {
  const text = printLang === 'ru' ? PRINT_RU[ro] : printLang === 'en' ? PRINT_EN[ro] : ro;
  return format(text, params, printLang === 'ru' ? 'ru' : 'en');
}
