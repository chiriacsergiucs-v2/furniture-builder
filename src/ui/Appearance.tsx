import { t } from '@furniture-builder/i18n';
import {
  cssValue,
  resetAllThemeVars,
  resetThemeVar,
  setThemeVar,
  THEME_GROUPS,
  useThemeVars,
} from '../store/themeVars';
import { Dialog } from './Dialogs';

/** Appearance: change the theme variables (font sizes, gaps, paddings, corners, panel widths) for this device. */
export function AppearanceDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { values, ignored } = useThemeVars();
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={t('Appearance')}
      footer={
        <>
          <button type="button" onClick={resetAllThemeVars} disabled={!Object.keys(values).length}>
            {t('Reset all')}
          </button>
          <button type="button" className="primary" onClick={onClose}>
            {t('Done')}
          </button>
        </>
      }
    >
      <p className="hint">{t('Changes apply at once and stay on this device.')}</p>
      {ignored > 0 && (
        <p className="alert warn" role="alert">
          {t('{n|# saved value was|# saved values were} out of range and ignored.', { n: ignored })}
        </p>
      )}
      {THEME_GROUPS.map((g) => (
        <fieldset key={g.id} className="appearance-group">
          <legend>{g.title()}</legend>
          {g.vars.map((v) => {
            const n = values[v.name] ?? v.def;
            return (
              <div key={v.name} className="appearance-row">
                <label htmlFor={`ap${v.name}`}>{v.label()}</label>
                <input
                  id={`ap${v.name}`}
                  type="range"
                  min={v.min}
                  max={v.max}
                  step={v.step}
                  value={n}
                  onChange={(e) => setThemeVar(v.name, Number(e.target.value))}
                />
                <output htmlFor={`ap${v.name}`}>{cssValue(v, n)}</output>
                <button
                  type="button"
                  onClick={() => resetThemeVar(v.name)}
                  disabled={values[v.name] === undefined}
                  aria-label={t('Reset {name}', { name: v.label() })}
                >
                  {t('Reset')}
                </button>
              </div>
            );
          })}
        </fieldset>
      ))}
    </Dialog>
  );
}
