import { useSyncExternalStore } from 'react';
import { createListeners } from './deviceValue';

/**
 * The plan's **Snap** toggle (ADR-070): on by default (open question in the ADR). Kept on this device only
 * (localStorage, no telemetry — ADR-002); not part of the project document. Holding Alt while dragging places freely
 * whatever this says.
 */
const KEY = 'fb:plan-snap';
const { subscribe, notify } = createListeners();

/** Stored 'off' turns snapping off; anything else (nothing stored, unreadable) leaves it on. */
function parseSnap(v: string | null): boolean {
  return v !== 'off';
}

function stored(): boolean {
  try {
    return parseSnap(localStorage.getItem(KEY));
  } catch {
    return true;
  }
}
let on = stored();

/** The toggle as it is now, for handlers outside React (ADR-094: a drop from the piece list). */
export const snapIsOn = () => on;

function setSnap(v: boolean) {
  on = v;
  try {
    localStorage.setItem(KEY, v ? 'on' : 'off');
  } catch {
    /* private mode: the choice lasts for this page only */
  }
  notify();
}

export function useSnap(): [boolean, (v: boolean) => void] {
  return [useSyncExternalStore(subscribe, () => on), setSnap];
}
