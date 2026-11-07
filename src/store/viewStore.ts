import { create } from 'zustand';

/**
 * What the 3D view and the page tell each other (ADR-230), instead of DOM side channels: the number of connection
 * seams drawn (ADR-179) and of parts an assembly step lights (ADR-174), both null while nothing draws them, and a
 * counter the Reset view button bumps to frame the model again. Screen state only, never saved.
 */
interface ViewState {
  seams: number | null;
  lit: number | null;
  /** Bumped by `requestFit`; the 3D view frames the model again when it changes. */
  fitRequest: number;
  setSeams: (n: number | null) => void;
  setLit: (n: number | null) => void;
  requestFit: () => void;
}

export const useViewStore = create<ViewState>((set) => ({
  seams: null,
  lit: null,
  fitRequest: 0,
  setSeams: (seams) => set({ seams }),
  setLit: (lit) => set({ lit }),
  requestFit: () => set((s) => ({ fitRequest: s.fitRequest + 1 })),
}));
