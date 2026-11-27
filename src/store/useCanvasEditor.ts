import { useSyncExternalStore } from 'react';
import { createListeners } from './deviceValue';
import { readLocal, writeLocal } from '../persist/localPrefs';

/**
 * The canvas editor on phones (ADR-283): selection ladder, chip rail and lens card in place of the Compose sheet.
 * On by default since ADR-290 (was off, ADR-283); the choice is kept on this device only (localStorage, no telemetry —
 * ADR-002).
 */
const KEY = 'fb:canvasEditor';
const { subscribe, notify } = createListeners();

/** On unless 'off' is stored: the canvas editor is the phone default since ADR-290; the More switch brings the sheet back. */
export function parseCanvasEditor(v: string | null): boolean {
  return v !== 'off';
}

function stored(): boolean {
  return readLocal(KEY, parseCanvasEditor, true);
}
let on = stored();

function setCanvasEditor(v: boolean) {
  on = v;
  writeLocal(KEY, v ? 'on' : 'off');
  notify();
}

export function useCanvasEditor(): [boolean, (v: boolean) => void] {
  return [useSyncExternalStore(subscribe, () => on), setCanvasEditor];
}
