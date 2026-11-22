import { useSyncExternalStore } from 'react';
import { createListeners } from './deviceValue';

/**
 * The canvas editor on phones (ADR-283): selection ladder, chip rail and lens card in place of the Compose sheet.
 * Off by default; kept on this device only (localStorage, no telemetry — ADR-002).
 */
const KEY = 'fb:canvasEditor';
const { subscribe, notify } = createListeners();

/** Only a stored 'on' turns it on; nothing stored or unreadable leaves today's sheet. */
export function parseCanvasEditor(v: string | null): boolean {
  return v === 'on';
}

function stored(): boolean {
  try {
    return parseCanvasEditor(localStorage.getItem(KEY));
  } catch {
    return false;
  }
}
let on = stored();

function setCanvasEditor(v: boolean) {
  on = v;
  try {
    localStorage.setItem(KEY, v ? 'on' : 'off');
  } catch {
    /* private mode: the choice lasts for this page only */
  }
  notify();
}

export function useCanvasEditor(): [boolean, (v: boolean) => void] {
  return [useSyncExternalStore(subscribe, () => on), setCanvasEditor];
}

/** Chips used most on this device come first (ADR-283). Counts by chip label, kept on this device only. */
const USE_KEY = 'fb:lens-use';
const use = createListeners();
function readUse(): Record<string, number> {
  try {
    const v = JSON.parse(localStorage.getItem(USE_KEY) ?? '{}') as unknown;
    return v && typeof v === 'object' ? (v as Record<string, number>) : {};
  } catch {
    return {};
  }
}
let counts = readUse();

export function bumpLensUse(key: string) {
  counts = { ...counts, [key]: (counts[key] ?? 0) + 1 };
  try {
    localStorage.setItem(USE_KEY, JSON.stringify(counts));
  } catch {
    /* private mode */
  }
  use.notify();
}

export function useLensUse(): Record<string, number> {
  return useSyncExternalStore(use.subscribe, () => counts);
}

/** Labels sorted by use on this device, most used first; ties keep their order. */
export function orderByUse(labels: string[], used: Record<string, number>): string[] {
  return labels
    .map((l, i) => ({ l, i, n: used[l] ?? 0 }))
    .sort((a, b) => b.n - a.n || a.i - b.i)
    .map((x) => x.l);
}
