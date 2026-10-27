import { useSyncExternalStore } from 'react';
import { useDesign } from '../store/designStore';

/**
 * Keep proportions for the selected 3D model (ADR-102): screen state only, never saved (G-111). It is on each time a
 * model is selected; turning it off holds until the selection changes. Shared by the size fields and the 3D resize
 * handles.
 */
let off: string | null = null;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((f) => f());
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};
// A new selection turns it back on.
useDesign.subscribe((s, prev) => {
  if (off !== null && s.selectedItemId !== prev.selectedItemId) {
    off = null;
    notify();
  }
});

/** Turn Keep proportions on or off for this model item. */
export function setKeepProportions(itemId: string, on: boolean) {
  off = on ? null : itemId;
  notify();
}

/** The current value, for a gesture in progress (no render). */
export const keepProportionsNow = (itemId: string) => off !== itemId;

/** Whether Keep proportions is on for this model item, and the switch for it. */
export function useKeepProportions(itemId: string): [boolean, (on: boolean) => void] {
  const keep = useSyncExternalStore(subscribe, () => keepProportionsNow(itemId));
  return [keep, (on: boolean) => setKeepProportions(itemId, on)];
}
