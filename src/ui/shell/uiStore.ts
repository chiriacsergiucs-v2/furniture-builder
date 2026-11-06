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
  /**
   * What prints: the cutting sheet, the assembly steps (ADR-174) or the client sheet (ADR-206). Back to the sheet after
   * each print.
   */
  printMode: 'sheet' | 'assembly' | 'client';
  setPrintMode: (printMode: 'sheet' | 'assembly' | 'client') => void;
  /** The last PNG the Render dialog made this session (ADR-068), as an object URL: the client sheet's picture. */
  lastRender: string | null;
  setLastRender: (url: string | null) => void;
  /** The picture the client sheet prints (ADR-206), chosen when it is asked for; null = the front view. */
  clientPicture: string | null;
  /** One 3D picture per assembly step for the print (ADR-206), by `<piece>:<step>`; null without the 3D view. */
  stepPictures: Record<string, string> | null;
  /** Print with these pictures; cleared again after each print. */
  printWith: (
    printMode: 'sheet' | 'assembly' | 'client',
    pictures: { client?: string | null; steps?: Record<string, string> | null },
  ) => void;
  /** A one-line result of an import or export started from a menu, shown until dismissed. */
  notice: { ok: boolean; text: string } | null;
  setNotice: (n: { ok: boolean; text: string } | null) => void;
  /** The Settings dialog (ADR-080) is open for what is open in the editor. */
  settingsOpen: boolean;
  setSettingsOpen: (v: boolean) => void;
  /** The Material dialog (ADR-163) is open. */
  materialOpen: boolean;
  setMaterialOpen: (v: boolean) => void;
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
  setPrinting: (printing) =>
    set(
      printing
        ? { printing }
        : { printing, printMode: 'sheet', clientPicture: null, stepPictures: null },
    ),
  printMode: 'sheet',
  setPrintMode: (printMode) => set({ printMode }),
  lastRender: null,
  setLastRender: (lastRender) =>
    set((s) => {
      if (s.lastRender && s.lastRender !== lastRender) URL.revokeObjectURL(s.lastRender);
      return { lastRender };
    }),
  clientPicture: null,
  stepPictures: null,
  printWith: (printMode, pictures) =>
    set({
      printMode,
      printing: true,
      clientPicture: pictures.client ?? null,
      stepPictures: pictures.steps ?? null,
    }),
  notice: null,
  setNotice: (notice) => set({ notice }),
  settingsOpen: false,
  setSettingsOpen: (settingsOpen) => set({ settingsOpen }),
  materialOpen: false,
  setMaterialOpen: (materialOpen) => set({ materialOpen }),
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
