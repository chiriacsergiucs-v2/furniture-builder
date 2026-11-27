import { useSyncExternalStore } from 'react';
import { createListeners } from './deviceValue';
import { readLocal, writeLocal } from '../persist/localPrefs';

/**
 * The 3D view's look (ADR-067): 'simple' is the plain preview, 'realistic' adds room light, soft shadows and
 * ambient occlusion. Kept on this device only (localStorage, no telemetry — ADR-002), like the theme.
 */
export type Look = 'simple' | 'realistic';
const KEY = 'fb:look';
const { subscribe, notify } = createListeners();

/** Until the user picks one: realistic on screens at least 1024 px wide, simple below (phones). */
export function defaultLook(width: number): Look {
  return width >= 1024 ? 'realistic' : 'simple';
}

export function parseLook(v: string | null): Look | null {
  return v === 'simple' || v === 'realistic' ? v : null;
}

function stored(): Look | null {
  return readLocal(KEY, parseLook, null);
}
let chosen: Look | null = stored();

function currentLook(): Look {
  return chosen ?? defaultLook(typeof window === 'undefined' ? 0 : window.innerWidth);
}

export function setLook(l: Look) {
  chosen = l;
  writeLocal(KEY, l);
  notify();
}

export function useLook(): Look {
  return useSyncExternalStore(subscribe, currentLook, () => 'simple');
}
