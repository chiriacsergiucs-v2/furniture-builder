import { useSyncExternalStore } from 'react';

/**
 * The plan's **Snap** toggle (ADR-070): on by default (open question in the ADR). Kept on this device only
 * (localStorage, no telemetry — ADR-002); not part of the project document. Holding Alt while dragging places freely
 * whatever this says.
 */
const KEY = 'fb:plan-snap';
const listeners = new Set<() => void>();

/** Stored 'off' turns snapping off; anything else (nothing stored, unreadable) leaves it on. */
export function parseSnap(v: string | null): boolean {
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

export function setSnap(v: boolean) {
  on = v;
  try {
    localStorage.setItem(KEY, v ? 'on' : 'off');
  } catch {
    /* private mode: the choice lasts for this page only */
  }
  listeners.forEach((f) => f());
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

export function useSnap(): [boolean, (v: boolean) => void] {
  return [useSyncExternalStore(subscribe, () => on), setSnap];
}
