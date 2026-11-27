import { useSyncExternalStore } from 'react';
import { createListeners } from './deviceValue';
import { readLocal, writeLocal } from '../persist/localPrefs';

/**
 * The catalog finder (ADR-291): search first, one row of filters, a flat grid of families and a family sheet, in place
 * of the grouped catalog page; the seller product picker gets kind chips, a count and paging. On by default (was off, ADR-291); the choice
 * is kept on this device only (localStorage, no telemetry — ADR-002).
 */
const KEY = 'fb:catalogFinder';
const { subscribe, notify } = createListeners();

/** On unless 'off' is stored: the finder is the default; the More switch brings the grouped catalog back (as ADR-290). */
export function parseCatalogFinder(v: string | null): boolean {
  return v !== 'off';
}

function stored(): boolean {
  return readLocal(KEY, parseCatalogFinder, true);
}
let on = stored();

function setCatalogFinder(v: boolean) {
  on = v;
  writeLocal(KEY, v ? 'on' : 'off');
  notify();
}

export function useCatalogFinder(): [boolean, (v: boolean) => void] {
  return [useSyncExternalStore(subscribe, () => on), setCatalogFinder];
}
