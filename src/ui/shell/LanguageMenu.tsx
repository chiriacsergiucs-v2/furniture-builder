import { useState } from 'react';
import { getLang, LANG_NAME, LANGS, t, type Lang } from '../../core/i18n';
import {
  getPrintLang,
  PRINT_LANG_NAME,
  PRINT_LANGS,
  setPrintLang,
  type PrintLang,
} from '../../core/i18n/print';
import { LANG_KEY, PRINT_LANG_KEY } from '../../langInit';

/** The page reload, replaceable in tests (jsdom cannot reload). */
export const page = { reload: () => location.reload() };

/**
 * Save the UI language and reload in it (ADR-153: the user chose a reload; designs are autosaved). False when the
 * browser's storage refused it: then nothing reloads, as a reload would come back in the old language (ADR-265).
 */
function switchLang(l: Lang): boolean {
  if (l === getLang()) return true;
  try {
    localStorage.setItem(LANG_KEY, l);
  } catch {
    return false;
  }
  page.reload();
  return true;
}

/** Keep the print language (ADR-157); sheets and the CSV are made when asked, so no reload. */
function choosePrintLang(l: PrintLang): void {
  setPrintLang(l);
  try {
    localStorage.setItem(PRINT_LANG_KEY, l);
  } catch {
    // Storage blocked: the choice holds for this visit.
  }
}

/** The More menu's language switches (ADR-153, ADR-157): the app's language and the print language. */
export function LanguageMenu() {
  const [printLang, setShown] = useState(getPrintLang);
  const [langFailed, setLangFailed] = useState(false);
  return (
    <>
      <p className="menu-head" id="menu-lang">
        {t('Language')}
      </p>
      <div role="group" aria-labelledby="menu-lang" className="menu-choice">
        {LANGS.map((l) => (
          <button
            key={l}
            type="button"
            lang={l}
            aria-pressed={getLang() === l}
            onClick={() => setLangFailed(!switchLang(l))}
          >
            {LANG_NAME[l]}
          </button>
        ))}
      </div>
      {langFailed && (
        <p className="alert error" role="alert">
          {t('The language could not be saved in this browser’s storage.')}
        </p>
      )}
      <p className="menu-head" id="menu-print-lang">
        {t('Print language')} <small>{t('sheets and the parts CSV')}</small>
      </p>
      <div role="group" aria-labelledby="menu-print-lang" className="menu-choice">
        {PRINT_LANGS.map((l) => (
          <button
            key={l}
            type="button"
            lang={l}
            aria-pressed={printLang === l}
            onClick={() => {
              choosePrintLang(l);
              setShown(l);
            }}
          >
            {PRINT_LANG_NAME[l]}
          </button>
        ))}
      </div>
    </>
  );
}
