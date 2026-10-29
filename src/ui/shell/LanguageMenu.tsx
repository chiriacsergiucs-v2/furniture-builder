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

/** Save the UI language and reload in it (ADR-153: the user chose a reload; designs are autosaved). */
export function switchLang(l: Lang): void {
  if (l === getLang()) return;
  try {
    localStorage.setItem(LANG_KEY, l);
  } catch {
    // Storage blocked: the reload stays in the old language.
  }
  page.reload();
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
            onClick={() => switchLang(l)}
          >
            {LANG_NAME[l]}
          </button>
        ))}
      </div>
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
