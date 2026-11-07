import { useMemo } from 'react';
import { applicable, repairsFor, sameProblem, type Repair } from '../core/repairs';
import type { Project } from '../core/project';
import type { Diagnostic } from '../core/types';
import { useDesign } from './designStore';
import { useProblem } from './problemStore';

/**
 * The problem picked under Checks (ADR-071) as it stands in the current project, with its previewed repairs: shared by
 * the plan's problem banner and the 3D view (ADR-209).
 */
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
