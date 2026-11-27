import type { Diagnostic } from '../../core/types';
import { useDesign } from '../../store/designStore';
import type { State as DesignState } from '../../store/designState';

/** The diagnostics `useView()` shows for the open project or piece, read without building the cut list (G-500). */
const shownDiagnostics = (s: DesignState): Diagnostic[] =>
  s.project && s.projectModel && !s.editingItemId
    ? s.projectModel.diagnostics
    : s.model.diagnostics;

/** The error and warning counts of the open project or piece: numbers, so a selector stays stable. */
export function useCheckCounts(): { errors: number; warnings: number } {
  // A count, not a filtered list: the selector returns a number (stable selectors, CLAUDE.md).
  const errors = useDesign((s) =>
    shownDiagnostics(s).reduce((n, d) => n + (d.severity === 'error' ? 1 : 0), 0),
  );
  const total = useDesign((s) => shownDiagnostics(s).length);
  return { errors, warnings: total - errors };
}
