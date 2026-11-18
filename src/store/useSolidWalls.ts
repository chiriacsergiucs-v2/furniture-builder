import { useSyncExternalStore } from 'react';
import { createListeners } from './deviceValue';

/**
 * Solid or see-through room walls in the 3D view (ADR-145, G-272): a view setting kept on this device only
 * (localStorage, no telemetry — ADR-002), not saved in the project. Starts see-through, as walls looked before.
 */
const KEY = 'fb:solid-walls';
const { subscribe, notify } = createListeners();

function stored(): boolean {
  try {
    return localStorage.getItem(KEY) === 'yes';
  } catch {
    return false;
  }
}
let solid = stored();

export function setSolidWalls(v: boolean) {
  solid = v;
  try {
    localStorage.setItem(KEY, v ? 'yes' : 'no');
  } catch {
    /* private mode: the choice lasts for this page only */
  }
  notify();
}

export function useSolidWalls(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => solid,
    () => false,
  );
}
