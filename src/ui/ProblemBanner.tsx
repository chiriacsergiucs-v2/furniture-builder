/**
 * Select the problem and offer previewed repairs (ADR-071): the check picked under Checks, shown above the plan
 * with its repairs (computed in the core, smallest move first). The chosen repair is drawn on the plan as a dashed
 * outline; nothing changes until Apply, which is one undo step. The diagnostic itself is never hidden or softened.
 */
import { useMemo } from 'react';
import { repairsFor, sameProblem, type Repair } from '../core/repairs';
import type { Project } from '../core/project';
import type { Diagnostic } from '../core/types';
import { useDesign } from '../store/designStore';
import { Icon } from './icons';
import { useProblem } from './problemStore';
import { useUi } from './shell/uiStore';

export interface FocusedProblem {
  d: Diagnostic;
  repairs: Repair[];
  chosen: Repair | null;
  /** The project the repairs were computed from: Apply only writes over that same project. */
  base: Project;
}

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
    const d = pm.diagnostics.find((e) => sameProblem(focus, e));
    return d ? { d, repairs: repairsFor(project, pm, d), base: project } : null;
  }, [focus, focusProject, project, pm, busy]);
  return useMemo(
    () => (found ? { ...found, chosen: found.repairs[choice] ?? found.repairs[0] ?? null } : null),
    [found, choice],
  );
}

export function ProblemBanner({ problem }: { problem: FocusedProblem }) {
  const { d, repairs, chosen } = problem;
  const choose = useProblem((s) => s.choose);
  const close = useProblem((s) => s.close);
  const updateProject = useDesign((s) => s.updateProject);
  const setHighlight = useDesign((s) => s.setHighlight);
  const setNotice = useUi((s) => s.setNotice);
  const apply = (r: Repair) => {
    // The repair was worked out on `base`; a project changed since then gets new repairs on the next render instead.
    if (useDesign.getState().project !== problem.base) return;
    updateProject(() => r.project);
    setHighlight([]);
    close();
    setNotice({ ok: true, text: `Applied: ${r.label}. Undo puts it back.` });
  };
  const error = d.severity === 'error';
  return (
    <section className={`problem-banner ${d.severity}`} aria-label="Problem and repairs">
      <p className="problem-msg">
        <Icon name={error ? 'alert-circle' : 'alert-triangle'} className="sm" />
        <span>
          <strong>{error ? 'Problem' : 'Check'}</strong> {d.message}
        </span>
      </p>
      {repairs.length ? (
        <fieldset className="repairs">
          <legend>Repairs — the dashed outline on the plan shows the chosen one</legend>
          {repairs.map((r, i) => (
            <label key={r.id}>
              <input type="radio" name="repair" checked={r === chosen} onChange={() => choose(i)} />
              <span>
                {r.label}
                {i === 0 ? <span className="hint"> · smallest move</span> : null}
              </span>
            </label>
          ))}
        </fieldset>
      ) : (
        <p className="hint">
          No repair clears this without causing another problem. Move or change the pieces yourself.
        </p>
      )}
      <div className="repair-actions">
        {chosen && (
          <button type="button" className="btn sm primary" onClick={() => apply(chosen)}>
            <Icon name="check" className="sm" />
            Apply
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
          Close
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
            After repair
          </text>
        </g>
      ))}
    </g>
  );
}
