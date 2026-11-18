import { useSyncExternalStore } from 'react';
import { createListeners } from './deviceValue';

/**
 * The plan's **Move alone** toggle (ADR-251): off by default and kept for this session only (not stored). On, a drag
 * or an arrow-key move acts as if Alt were held for connections: the piece moves without its connected neighbours.
 * It gives phones, which have no Alt key, the same path.
 */
const { subscribe, notify } = createListeners();
let on = false;

/** The toggle as it is now, for handlers outside React. */
export const moveAloneIsOn = () => on;

function setMoveAlone(v: boolean) {
  on = v;
  notify();
}

export function useMoveAlone(): [boolean, (v: boolean) => void] {
  return [useSyncExternalStore(subscribe, () => on), setMoveAlone];
}
