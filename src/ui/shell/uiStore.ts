import { create } from 'zustand';

/** The three editor modes (ADR-079): what goes where · what it is made of · what you get. */
export type Mode = 'compose' | 'configure' | 'build';
export const MODES: Mode[] = ['compose', 'configure', 'build'];
export const MODE_LABEL: Record<Mode, string> = {
  compose: 'Compose',
  configure: 'Configure',
  build: 'Build & Preview',
};

const KEY = 'fb:mode';
/** A stored mode, or Compose for anything else (missing, unknown, storage blocked). */
export function parseMode(v: string | null | undefined): Mode {
  return MODES.find((m) => m === v) ?? 'compose';
}
function readMode(): Mode {
  try {
    return parseMode(localStorage.getItem(KEY));
  } catch {
    return 'compose';
  }
}

interface Ui {
  mode: Mode;
  setMode: (m: Mode) => void;
  /** The print sheet is on screen and the print dialog is open (ADR-020). */
  printing: boolean;
  setPrinting: (v: boolean) => void;
  /** A one-line result of an import or export started from a menu, shown until dismissed. */
  notice: { ok: boolean; text: string } | null;
  setNotice: (n: { ok: boolean; text: string } | null) => void;
}

/** UI-only state shared by the shell and the editors; nothing here is part of a design (remembered per device only). */
export const useUi = create<Ui>((set) => ({
  mode: readMode(),
  setMode: (mode) => {
    try {
      localStorage.setItem(KEY, mode);
    } catch {
      // Storage blocked: the mode still changes for this visit.
    }
    set({ mode });
  },
  printing: false,
  setPrinting: (printing) => set({ printing }),
  notice: null,
  setNotice: (notice) => set({ notice }),
}));
