/**
 * Select the problem and offer previewed repairs (ADR-071): the check picked under Checks, shown above the plan
 * with its repairs (computed in the core, smallest move first). The chosen repair is drawn on the plan as a dashed
 * outline; nothing changes until Apply, which is one undo step. The diagnostic itself is never hidden or softened.
 * A repair the moved piece's group cannot follow is listed disabled with "Refused: {reason}" and cannot be applied
 * (ADR-176).
 */
import { useMemo } from 'react';
import { applicable, repairsFor, sameProblem, type Repair } from '../core/repairs';
import type { Project } from '../core/project';
import type { Diagnostic } from '../core/types';
import { useDesign } from '../store/designStore';
import { t } from '../core/i18n';
import { Icon } from './icons';
import { useProblem } from '../store/problemStore';
import { useUi } from '../store/uiStore';

export interface FocusedProblem {
  d: Diagnostic;
  repairs: Repair[];
  chosen: Repair | null;
  /** The project the repairs were computed from: Apply only writes over that same project. */
  base: Project;
}

/** The problem last looked up per project model, so a second view of it does not work out its repairs again. */
const lookedUp = new WeakMap<
  object,
  { focus: Diagnostic; project: Project; value: Omit<FocusedProblem, 'chosen'> | null }
>();

/**
 * The picked problem as it stands in the current project, with its repairs; null when it is gone, when another
 * project is open, or while a piece is being placed or the room drawn (nothing is computed then).
 */
export function useFocusedProblem(): FocusedProblem | null {
  const focus = useProblem((s) => s.focus);
  const focusProject = useProblem((s) => s.projectId);
  const choice = useProblem((s) => s.choice);
  const project = useDesign((s) => s.project);
  const pm = useDesign((s) => s.projectModel);
  const busy = useDesign((s) => !!s.placingItemId || !!s.drawingRoom);
  const found = useMemo(() => {
    if (!focus || !project || !pm || busy || project.id !== focusProject) return null;
    // The plan and the 3D view (ADR-209) both show the problem: the repairs are worked out once per project.
    const hit = lookedUp.get(pm);
    if (hit && hit.focus === focus && hit.project === project) return hit.value;
    const d = pm.diagnostics.find((e) => sameProblem(focus, e));
    const value = d ? { d, repairs: repairsFor(project, pm, d), base: project } : null;
    lookedUp.set(pm, { focus, project, value });
    return value;
  }, [focus, focusProject, project, pm, busy]);
  return useMemo(() => {
    if (!found) return null;
    // Only a repair that applies can be chosen (ADR-176); otherwise the first that does.
    const picked = found.repairs[choice];
    const chosen = picked && applicable(picked) ? picked : (found.repairs.find(applicable) ?? null);
    return { ...found, chosen };
  }, [found, choice]);
}

export function ProblemBanner({ problem }: { problem: FocusedProblem }) {
  const { d, repairs, chosen } = problem;
  const choose = useProblem((s) => s.choose);
  const close = useProblem((s) => s.close);
  const updateProject = useDesign((s) => s.updateProject);
  const setHighlight = useDesign((s) => s.setHighlight);
  const setNotice = useUi((s) => s.setNotice);
  const apply = (r: Repair) => {
    // A refused repair is never applied (ADR-176).
    if (r.refused) return;
    // The repair was worked out on `base`; a project changed since then gets new repairs on the next render instead.
    if (useDesign.getState().project !== problem.base) return;
    updateProject(() => r.project);
    setHighlight([]);
    close();
    setNotice({ ok: true, text: t('Applied: {repair}. Undo puts it back.', { repair: r.label }) });
  };
  const error = d.severity === 'error';
  const first = repairs.find(applicable);
  return (
    <section className={`problem-banner ${d.severity}`} aria-label={t('Problem and repairs')}>
      <p className="problem-msg">
        <Icon name={error ? 'alert-circle' : 'alert-triangle'} className="sm" />
        <span>
          <strong>{error ? t('Problem') : t('Check')}</strong> {d.message}
        </span>
      </p>
      {repairs.length ? (
        <fieldset className="repairs">
          <legend>{t('Repairs — the dashed outline on the plan shows the chosen one')}</legend>
          {repairs.map((r, i) => (
            <label key={r.id} className={r.refused ? 'refused' : undefined}>
              <input
                type="radio"
                name="repair"
                checked={r === chosen}
                disabled={!!r.refused}
                aria-describedby={r.refused ? `repair-${r.id}-refused` : undefined}
                onChange={() => choose(i)}
              />
              <span>
                {r.label}
                {r === first ? <span className="hint">{t(' · smallest move')}</span> : null}
                {r.refused ? (
                  <span className="hint warn refused-why" id={`repair-${r.id}-refused`}>
                    {t('Refused: {reason}', { reason: r.refused })}
                  </span>
                ) : null}
              </span>
            </label>
          ))}
        </fieldset>
      ) : (
        <p className="hint">
          {t(
            'No repair clears this without causing another problem. Move or change the pieces yourself.',
          )}
        </p>
      )}
      <div className="repair-actions">
        {chosen && (
          <button type="button" className="btn sm primary" onClick={() => apply(chosen)}>
            <Icon name="check" className="sm" />
            {t('Apply')}
          </button>
        )}
        <button
          type="button"
          className="btn sm ghost"
          onClick={() => {
            setHighlight([]);
            close();
          }}
        >
          {t('Close')}
        </button>
      </div>
    </section>
  );
}

/** The problem zone and the chosen repair's result, drawn inside the plan's SVG (room x → x, z → y). */
export function ProblemOutline({ problem, fs }: { problem: FocusedProblem; fs: number }) {
  const b = problem.d.box;
  return (
    <g className="problem-plan" aria-hidden="true">
      {b && b.w > 0 && b.d > 0 && (
        <rect className="problem-zone" x={b.x} y={b.z} width={b.w} height={b.d} />
      )}
      {problem.chosen?.preview.map((p) => (
        <g key={p.id} className="repair-preview">
          <rect x={p.box.x} y={p.box.z} width={p.box.w} height={p.box.d} />
          <text x={p.box.x} y={p.box.z - fs * 0.4} fontSize={fs}>
            {t('After repair')}
          </text>
        </g>
      ))}
    </g>
  );
}
