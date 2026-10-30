import { create } from 'zustand';
import { t } from '../../core/i18n';

/**
 * The two editor modes (ADR-080, was three in ADR-079): what goes where · what you get. What it is made of is in the
 * Settings dialog.
 */
export type Mode = 'compose' | 'build';
export const MODES: Mode[] = ['compose', 'build'];
export const MODE_LABEL: Record<Mode, string> = {
  compose: t('Compose'),
  build: t('Build & Preview'),
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
  /** The Saved data dialog (ADR-133): persistent storage, folder backup and restore for this device. */
  savedDataOpen: boolean;
  setSavedDataOpen: (v: boolean) => void;
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
  savedDataOpen: false,
  setSavedDataOpen: (savedDataOpen) => set({ savedDataOpen }),
}));

/**
 * Set by the phone sheet's peek row actions (ADR-160): the selection they make (a duplicate) leaves the sheet closed.
 * Not reactive: taken (read and cleared) once by the editor when the selection changes.
 */
let keepSheetClosed = false;
export const keepSheetClosedOnce = () => {
  keepSheetClosed = true;
};
export const takeKeepSheetClosed = () => {
  const v = keepSheetClosed;
  keepSheetClosed = false;
  return v;
};
