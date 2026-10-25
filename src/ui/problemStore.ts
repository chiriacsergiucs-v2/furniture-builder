import { create } from 'zustand';
import type { Diagnostic } from '../core/types';

/**
 * The project problem picked from Checks (ADR-071) and the repair being previewed. UI-only: the diagnostic is
 * looked up again in the current project model on every render, so a fixed problem simply disappears.
 */
interface ProblemUi {
  focus: Diagnostic | null;
  /** The project the problem was picked in: another project never shows it. */
  projectId: string | null;
  /** Index of the previewed repair in the list for `focus` (0 = the smallest move, the default). */
  choice: number;
  /** Bumped on every tap of a check, so the plan scrolls to the problem again. */
  tapped: number;
  show: (d: Diagnostic, projectId: string) => void;
  choose: (i: number) => void;
  close: () => void;
}

export const useProblem = create<ProblemUi>((set) => ({
  focus: null,
  projectId: null,
  choice: 0,
  tapped: 0,
  show: (focus, projectId) => set((s) => ({ focus, projectId, choice: 0, tapped: s.tapped + 1 })),
  choose: (choice) => set({ choice }),
  close: () => set({ focus: null, projectId: null, choice: 0 }),
}));
