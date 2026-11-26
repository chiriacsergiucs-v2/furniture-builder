/**
 * Read the chosen languages before any other module loads (ADR-153, ADR-157): texts made at module load (labels,
 * catalog entries) then come out in that language. Imported first by main.tsx, which awaits `langReady` (the chosen
 * language's dictionary, a lazy chunk for Russian, ADR-229) before importing the app. localStorage only, like the
 * theme (ADR-002).
 */
import { getLang, loadDictionary, parseLang, setLang } from '@furniture-builder/i18n';
import { loadPrintTables, parsePrintLang, setPrintLang } from '@furniture-builder/i18n/print';

export const LANG_KEY = 'fb:lang';
export const PRINT_LANG_KEY = 'fb:print-lang';

/** The stored print language, chosen once its tables are in (a lazy chunk, G-496); Romanian until then or if they fail. */
let printReady: Promise<void> = Promise.resolve();
try {
  setLang(parseLang(localStorage.getItem(LANG_KEY)));
  const print = parsePrintLang(localStorage.getItem(PRINT_LANG_KEY));
  if (print !== 'ro')
    printReady = loadPrintTables().then(
      () => setPrintLang(print),
      () => {},
    );
} catch {
  // Storage blocked: English UI, Romanian print.
}
document.documentElement.lang = getLang();

/** The chosen language's dictionary; await it before importing any module that makes texts at load (ADR-229). */
export const langReady: Promise<void> = Promise.all([loadDictionary(getLang()), printReady]).then(
  () => undefined,
);
