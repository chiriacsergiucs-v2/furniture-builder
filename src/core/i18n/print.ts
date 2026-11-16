/**
 * The language of what goes to the panel shop (ADR-157): printed sheets, drawing labels, the parts CSV and the review
 * pack. Romanian by default (ADR-020), Russian or English when the user chooses; separate from the UI language.
 * `pt(ro)` takes the Romanian text as its key and gives it in the print language; `PRINT_RU` and `PRINT_EN` hold the
 * other two. Pure TypeScript, no UI imports.
 */
import { dataSource, format, recordedMessage, type Params } from './index';
import { partRo } from '../ro';
import { PRINT_EN, PRINT_RU } from './print-text';
import { WARNING_RO } from './warning-text';

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

/**
 * The params that hold a message of the core, not a name the user typed: a reason, a kind, a word, a rule text, a face
 * of a piece (and the two sides of the "cannot join" messages). Names are never looked up, so a piece called "top"
 * stays "top".
 */
const MESSAGE_PARAMS = new Set(['reason', 'kind', 'what', 'text', 'face']);
const JOIN_KEYS = new Set(['a {a} cannot join a {b}; only sides join', 'a {a} cannot join a {b}']);
const isMessageParam = (key: string, name: string): boolean =>
  MESSAGE_PARAMS.has(name) || (JOIN_KEYS.has(key) && (name === 'a' || name === 'b'));

/**
 * A warning's message in the print language (ADR-265, D18-F6). The message was made by `t()` from a key in
 * `WARNING_RO`; its key and params are looked up and the Romanian text for that key is printed with the params, a
 * param that is itself such a message (a reason) the same way, and a data word (a part label) is taken back to its
 * English text and printed in the print language (G-516). A message with no entry is printed as it is, in the
 * app language; `tests/warning-print.test.ts` keeps that from happening for the warnings the core makes.
 */
export function warningText(message: string): string {
  const rec = recordedMessage(message);
  if (!rec || !Object.hasOwn(WARNING_RO, rec.key)) return message;
  const params = rec.params
    ? Object.fromEntries(
        Object.entries(rec.params).map(([k, v]) => [
          k,
          typeof v !== 'string'
            ? v
            : isMessageParam(rec.key, k)
              ? warningText(v)
              : partRo(dataSource(v)),
        ]),
      )
    : undefined;
  return pt(WARNING_RO[rec.key as keyof typeof WARNING_RO], params);
}
