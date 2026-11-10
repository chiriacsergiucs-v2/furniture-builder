/**
 * Running an assistant plan (ADR-240). `previewPlan` runs the calls through the editor store on the open document and
 * then puts the store back exactly as it was, so nothing is saved or shown until Apply; `applyPlan` runs the same
 * calls for real as one undo step. Neither throws: a failed call rejects the whole plan.
 */
import {
  changesBetween,
  newDiagnostics,
  planProblems,
  positional,
  type Change,
  type PlanCall,
} from '../core/assistant';
import type { Diagnostic } from '../core/types';
import { actionSpecs, CATALOG } from './assistantActions';
import { useDesign } from './designStore';

type Store = ReturnType<typeof useDesign.getState>;

export interface Preview {
  calls: PlanCall[];
  /** The open document the preview was made on: Apply refuses when it changed since (an edit by hand). */
  base: { design: unknown; project: unknown };
  changes: Change[];
  /** Diagnostics the plan adds, errors first, as the app reports them (ADR-008). */
  diagnostics: Diagnostic[];
  /** What the store said while running (why a step did nothing, what was skipped). */
  notes: string[];
}

type RunResult = { ok: true; preview: Preview } | { ok: false; problems: string[] };

const doc = (s: Store) => (s.project ? s.project : s.design);
const diagnosticsOf = (s: Store): Diagnostic[] =>
  s.project && s.projectModel ? s.projectModel.diagnostics : s.model.diagnostics;

/** Run each call on the live store; returns the store's messages, or throws on an unknown action. */
function runCalls(calls: readonly PlanCall[]): string[] {
  const notes: string[] = [];
  const specs = actionSpecs();
  for (const c of calls) {
    const entry = CATALOG[c.action];
    const spec = specs.find((s) => s.name === c.action);
    if (!entry || !spec) throw new Error(`Unknown action ${c.action}`);
    const s = useDesign.getState();
    const before = s.notice;
    const out = entry.run
      ? entry.run(s, c.args)
      : (s[c.action as keyof Store] as (...a: unknown[]) => unknown)(...positional(spec, c.args));
    if (typeof out === 'string' && out) notes.push(out);
    const after = useDesign.getState().notice;
    if (after && after !== before) notes.push(after);
  }
  return notes;
}

/** Check and preview a plan on the open document; the store is left exactly as it was. */
export function previewPlan(calls: PlanCall[]): RunResult {
  const problems = planProblems(calls, actionSpecs());
  if (problems.length) return { ok: false, problems };
  const start = useDesign.getState();
  try {
    const notes = runCalls(calls);
    const end = useDesign.getState();
    const changes = changesBetween(doc(start), doc(end));
    return {
      ok: true,
      preview: {
        calls,
        base: { design: start.design, project: start.project },
        changes,
        diagnostics: newDiagnostics(diagnosticsOf(start), diagnosticsOf(end)),
        notes,
      },
    };
  } catch (e) {
    return { ok: false, problems: [e instanceof Error ? e.message : String(e)] };
  } finally {
    // Back to the state before, functions and history included: the preview leaves no trace.
    useDesign.setState(start, true);
  }
}

/**
 * Apply a previewed plan as one undo step. Refused (null comes back as the reason) when the open document changed
 * since the preview.
 */
export function applyPlan(p: Preview): string | null {
  const start = useDesign.getState();
  if (start.design !== p.base.design || start.project !== p.base.project) return 'changed';
  try {
    if (start.project) {
      // Every project step made inside becomes one (ADR-123).
      start.transact('Assistant', () => runCalls(p.calls));
      const end = useDesign.getState();
      // A piece open in the piece editor keeps one step of its own too.
      if (end.design !== start.design && end.editingItemId)
        useDesign.setState({ past: [...start.past, start.design].slice(-100), future: [] });
    } else {
      runCalls(p.calls);
      const end = useDesign.getState();
      if (end.design !== start.design)
        useDesign.setState({ past: [...start.past, start.design].slice(-100), future: [] });
    }
    return null;
  } catch (e) {
    useDesign.setState(start, true);
    return e instanceof Error ? e.message : String(e);
  }
}
