import { useSyncExternalStore } from 'react';
import { createListeners } from './deviceValue';
import { readLocal, writeLocal } from '../persist/localPrefs';

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
  return readLocal(KEY, parseSnap, true);
}
let on = stored();

/** The toggle as it is now, for handlers outside React (ADR-094: a drop from the piece list). */
export const snapIsOn = () => on;

function setSnap(v: boolean) {
  on = v;
  writeLocal(KEY, v ? 'on' : 'off');
  notify();
}

export function useSnap(): [boolean, (v: boolean) => void] {
  return [useSyncExternalStore(subscribe, () => on), setSnap];
}
