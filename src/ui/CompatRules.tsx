import { FUNCTION_LABEL } from '../core/catalog';
import { COMPAT_RULES, type CompatRule } from '../core/compat';

const KIND_LABEL: Record<string, string> = {
  cabinet: 'cabinets',
  corner: 'corner units',
  desk: 'desks',
  panel: 'panels',
  frame: 'frames',
  panels: 'panel sets',
};
const PLACEMENT_LABEL: Record<string, string> = {
  floor: 'on the floor',
  wall: 'on the wall',
  above: 'on another piece',
};

/** "Applies to" in words, from the rule's data. */
export function appliesText(r: CompatRule): string {
  const a = r.appliesTo;
  const parts = [
    a.productKinds ? a.productKinds.map((k) => KIND_LABEL[k] ?? k).join(' and ') : 'any piece',
    a.functions ? `in ${a.functions.map((f) => FUNCTION_LABEL[f]).join(', ')}` : '',
    a.placements ? a.placements.map((p) => PLACEMENT_LABEL[p]).join(' or ') : '',
    a.when ?? '',
  ];
  return parts.filter(Boolean).join(', ');
}

/** Severity and where it runs, in words. */
export function severityText(r: CompatRule): string {
  const snap = r.where.includes('snap'),
    checks = r.where.includes('checks');
  if (r.severity === 'refuse')
    return checks ? 'Refuses a snap; a warning in Checks' : 'Refuses a snap';
  return [snap && 'Named in the snap preview', checks && 'a warning in Checks']
    .filter(Boolean)
    .join('; ')
    .replace(/^a/, 'A');
}

/**
 * Settings › Rules (ADR-100): every compatibility rule with its text, what it applies to and its severity, read from
 * the rule table. Read only; warnings never block export.
 */
export function CompatRules() {
  return (
    <section className="section compat-rules" aria-label="Rules">
      <div className="card-title">
        <span>Rules</span>
      </div>
      <p className="hint">
        Compatibility rules used when snapping on the plan and in Checks. A refused snap is named
        while dragging; hold Alt (or turn Snap off) to place freely. Warnings never block export.
      </p>
      <ul className="run-list">
        {COMPAT_RULES.map((r) => (
          <li key={r.id}>
            <span>
              <strong>{r.name}</strong>
              <span className="sub">{r.text}</span>
              <span className="sub">Applies to: {appliesText(r)}</span>
              <span className="sub">{severityText(r)}</span>
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
