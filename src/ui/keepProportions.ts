import { useSyncExternalStore } from 'react';

/**
 * Keep proportions for the selected 3D model (ADR-102): screen state only, never saved (G-111). It is on each time a
 * model is selected; turning it off holds for that model until another is selected. Shared by the size fields and
 * the 3D resize handles.
 */
let off: string | null = null;
const listeners = new Set<() => void>();
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

/** Whether Keep proportions is on for this model item, and the switch for it. */
export function useKeepProportions(itemId: string): [boolean, (on: boolean) => void] {
  const keep = useSyncExternalStore(subscribe, () => off !== itemId);
  return [
    keep,
    (on: boolean) => {
      off = on ? null : itemId;
      listeners.forEach((f) => f());
    },
  ];
}

/** The current value, for a gesture in progress (no render). */
export const keepProportionsNow = (itemId: string) => off !== itemId;
