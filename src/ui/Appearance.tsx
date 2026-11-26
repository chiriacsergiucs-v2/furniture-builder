import { t } from '@furniture-builder/i18n';
import {
  cssValue,
  resetAllThemeVars,
  resetThemeVar,
  scaleThemeVars,
  setThemeVar,
  stepThemeVar,
  THEME_GROUPS,
  useThemeVars,
} from '../store/themeVars';
import { useState } from 'react';
import { Dialog } from './Dialogs';

/** Appearance: change the theme variables (font sizes, gaps, paddings, corners, panel widths) for this device. */
export function AppearanceDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { values, ignored } = useThemeVars();
  // How many variables the last ±5% press left at the end of their range, per scope ('all' or a group id) (G-598).
  const [limits, setLimits] = useState<{ scope: string; n: number } | null>(null);
  const scale = (scope: string, dir: 1 | -1, names?: string[]) =>
    setLimits({ scope, n: scaleThemeVars(dir, names) });
  const atLimit = (scope: string) =>
    limits?.scope === scope && limits.n > 0 ? (
      <span className="hint" role="status">
        {t('{n|# at its limit|# at their limit}', { n: limits.n })}
      </span>
    ) : null;
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
      <div className="appearance-scale" role="group" aria-label={t('All variables')}>
        <span>{t('All variables')}</span>
        <button type="button" onClick={() => scale('all', -1)} aria-label={t('All variables −5%')}>
          −5%
        </button>
        <button type="button" onClick={() => scale('all', 1)} aria-label={t('All variables +5%')}>
          +5%
        </button>
        {atLimit('all')}
      </div>
      {ignored > 0 && (
        <p className="alert warn" role="alert">
          {t('{n|# saved value was|# saved values were} out of range and ignored.', { n: ignored })}
        </p>
      )}
      {THEME_GROUPS.map((g) => (
        <fieldset key={g.id} className="appearance-group">
          <legend>{g.title()}</legend>
          <div className="appearance-scale" role="group" aria-label={g.title()}>
            <button
              type="button"
              onClick={() =>
                scale(
                  g.id,
                  -1,
                  g.vars.map((v) => v.name),
                )
              }
              aria-label={t('{group} −5%', { group: g.title() })}
            >
              −5%
            </button>
            <button
              type="button"
              onClick={() =>
                scale(
                  g.id,
                  1,
                  g.vars.map((v) => v.name),
                )
              }
              aria-label={t('{group} +5%', { group: g.title() })}
            >
              +5%
            </button>
            {atLimit(g.id)}
          </div>
          {g.vars.map((v) => {
            const n = values[v.name] ?? v.def;
            return (
              <div key={v.name} className="appearance-row">
                <label htmlFor={`ap${v.name}`}>{v.label()}</label>
                <button
                  type="button"
                  className="appearance-step appearance-dec"
                  onClick={() => stepThemeVar(v.name, -1)}
                  disabled={n <= v.min}
                  aria-label={t('Decrease {name}', { name: v.label() })}
                >
                  −
                </button>
                <input
                  id={`ap${v.name}`}
                  type="range"
                  min={v.min}
                  max={v.max}
                  step={v.step}
                  value={n}
                  onChange={(e) => setThemeVar(v.name, Number(e.target.value))}
                />
                <button
                  type="button"
                  className="appearance-step appearance-inc"
                  onClick={() => stepThemeVar(v.name, 1)}
                  disabled={n >= v.max}
                  aria-label={t('Increase {name}', { name: v.label() })}
                >
                  +
                </button>
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
