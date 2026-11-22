import { useSyncExternalStore } from 'react';
import { createListeners } from './deviceValue';

/**
 * The catalog finder (ADR-291): search first, one row of filters, a flat grid of families and a family sheet, in place
 * of the grouped catalog page; the seller product picker gets kind chips, a count and paging. Off by default; the choice
 * is kept on this device only (localStorage, no telemetry — ADR-002).
 */
const KEY = 'fb:catalogFinder';
const { subscribe, notify } = createListeners();

/** Off unless 'on' is stored: the finder is a preview behind the More switch (ADR-291). */
export function parseCatalogFinder(v: string | null): boolean {
  return v === 'on';
}

function stored(): boolean {
  try {
    return parseCatalogFinder(localStorage.getItem(KEY));
  } catch {
    return false;
  }
}
let on = stored();

function setCatalogFinder(v: boolean) {
  on = v;
  try {
    localStorage.setItem(KEY, v ? 'on' : 'off');
  } catch {
    /* private mode: the choice lasts for this page only */
  }
  notify();
}

export function useCatalogFinder(): [boolean, (v: boolean) => void] {
  return [useSyncExternalStore(subscribe, () => on), setCatalogFinder];
}
