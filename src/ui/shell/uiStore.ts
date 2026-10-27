import { create } from 'zustand';

/**
 * The two editor modes (ADR-080, was three in ADR-079): what goes where · what you get. What it is made of is in the
 * Settings dialog.
 */
export type Mode = 'compose' | 'build';
export const MODES: Mode[] = ['compose', 'build'];
export const MODE_LABEL: Record<Mode, string> = {
  compose: 'Compose',
  build: 'Build & Preview',
};

const KEY = 'fb:mode';
/** A stored mode, or Compose for anything else (missing, unknown, the old `configure`, storage blocked). */
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
  /** The Settings dialog (ADR-080) is open for what is open in the editor. */
  settingsOpen: boolean;
  setSettingsOpen: (v: boolean) => void;
  /** Parts and Sheets show only the selected pieces (N125); applies only while two pieces or more are selected. */
  selectionOnly: boolean;
  setSelectionOnly: (v: boolean) => void;
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
  settingsOpen: false,
  setSettingsOpen: (settingsOpen) => set({ settingsOpen }),
  selectionOnly: false,
  setSelectionOnly: (selectionOnly) => set({ selectionOnly }),
}));
