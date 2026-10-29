import { FUNCTION_LABEL } from '../core/catalog';
import { COMPAT_RULES, type CompatRule } from '../core/compat';
import { t, tr } from '../core/i18n';
import { InfoTip } from './controls';

const KIND_LABEL: Record<string, string> = {
  cabinet: t('cabinets'),
  corner: t('corner units'),
  desk: t('desks'),
  panel: t('panels'),
  frame: t('frames'),
  panels: t('panel sets'),
};
const PLACEMENT_LABEL: Record<string, string> = {
  floor: t('on the floor'),
  wall: t('on the wall'),
  above: t('on another piece'),
};

/** "Applies to" in words, from the rule's data. */
export function appliesText(r: CompatRule): string {
  const a = r.appliesTo;
  const parts = [
    a.productKinds
      ? a.productKinds.map((k) => KIND_LABEL[k] ?? k).join(t(' and '))
      : t('any piece'),
    a.functions
      ? t('in {list}', { list: a.functions.map((f) => tr(FUNCTION_LABEL[f])).join(', ') })
      : '',
    a.placements ? a.placements.map((p) => PLACEMENT_LABEL[p]).join(t(' or ')) : '',
    a.when ? tr(a.when) : '',
  ];
  return parts.filter(Boolean).join(', ');
}

/** Severity and where it runs, in words. */
export function severityText(r: CompatRule): string {
  const snap = r.where.includes('snap'),
    checks = r.where.includes('checks');
  if (r.severity === 'refuse')
    return checks ? t('Refuses a snap; a warning in Checks') : t('Refuses a snap');
  if (snap && checks) return t('Named in the snap preview; a warning in Checks');
  if (snap) return t('Named in the snap preview');
  return checks ? t('A warning in Checks') : '';
}

/**
 * Settings › Rules (ADR-100): every compatibility rule with its text, what it applies to and its severity, read from
 * the rule table. Read only; warnings never block export.
 */
export function CompatRules() {
  return (
    <section className="section compat-rules" aria-label={t('Rules')}>
      <div className="card-title">
        <span className="info-row">
          <span>{t('Rules')}</span>
          <InfoTip label={t('About the rules')} align="start">
            {t(
              'Compatibility rules used when snapping on the plan and in Checks. A refused snap is named while dragging; hold Alt (or turn Snap off) to place freely. Warnings never block export.',
            )}
          </InfoTip>
        </span>
      </div>
      <ul className="run-list">
        {COMPAT_RULES.map((r) => (
          <li key={r.id}>
            <span>
              <strong>{tr(r.name)}</strong>
              <span className="sub">{tr(r.text)}</span>
              <span className="sub">{t('Applies to: {list}', { list: appliesText(r) })}</span>
              <span className="sub">{severityText(r)}</span>
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
