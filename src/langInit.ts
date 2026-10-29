/**
 * Read the chosen languages before any other module loads (ADR-153, ADR-157): texts made at module load (labels,
 * catalog entries) then come out in that language. Imported first by main.tsx. localStorage only, like the theme
 * (ADR-002).
 */
import { getLang, parseLang, setLang } from './core/i18n';
import { parsePrintLang, setPrintLang } from './core/i18n/print';

export const LANG_KEY = 'fb:lang';
export const PRINT_LANG_KEY = 'fb:print-lang';

try {
  setLang(parseLang(localStorage.getItem(LANG_KEY)));
  setPrintLang(parsePrintLang(localStorage.getItem(PRINT_LANG_KEY)));
} catch {
  // Storage blocked: English UI, Romanian print.
}
document.documentElement.lang = getLang();
