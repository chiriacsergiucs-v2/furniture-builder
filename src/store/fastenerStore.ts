import { useEffect } from 'react';
import { create } from 'zustand';
import type { FastenerChoice, JointType } from '../core/fasteners';
import { t } from '../core/i18n';
import { deleteFastener, listFasteners, saveFastener } from '../persist/db';

/**
 * The user's fastener list (ADR-074), shared by Settings › Fasteners, the Hardware tab and the Shopping list. It is
 * kept on this device; nothing here is part of a design.
 */
interface FastenerState {
  choices: FastenerChoice[];
  loaded: boolean;
  /** The saved list has been read (or could not be): rows start from what is saved. */
  ready: boolean;
  error: string | null;
  load: () => void;
  set: (c: FastenerChoice) => void;
  clear: (joint: JointType) => void;
}
export const useFastenerList = create<FastenerState>((set, get) => ({
  choices: [],
  loaded: false,
  ready: false,
  error: null,
  load: () => {
    if (get().loaded) return;
    set({ loaded: true });
    listFasteners()
      .then((choices) => set({ choices, ready: true }))
      .catch(() =>
        set({
          loaded: false,
          ready: true,
          error: t('Your fastener list could not be read from this browser.'),
        }),
      );
  },
  set: (c) => {
    set((s) => ({ choices: [...s.choices.filter((x) => x.joint !== c.joint), c], error: null }));
    saveFastener(c).catch(() => failed(set, t('The fastener could not be saved on this device.')));
  },
  clear: (joint) => {
    set((s) => ({ choices: s.choices.filter((x) => x.joint !== joint), error: null }));
    deleteFastener(joint).catch(() =>
      failed(set, t('The fastener could not be removed from this device.')),
    );
  },
}));

/** A write failed: show what is really saved again, so no view counts an unsaved fastener. */
function failed(set: (p: Partial<FastenerState>) => void, error: string) {
  set({ error });
  listFasteners()
    .then((choices) => set({ choices }))
    .catch(() => set({ choices: [] }));
}

/** The user's fastener list, read from the device on first use. */
export function useFastenerChoices(): FastenerChoice[] {
  const choices = useFastenerList((s) => s.choices);
  const load = useFastenerList((s) => s.load);
  useEffect(load, [load]);
  return choices;
}
