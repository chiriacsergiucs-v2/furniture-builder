import { useSyncExternalStore } from 'react';
import type { Camera, Scene } from 'three';

/** Name of the shadow-only floor; the path tracer swaps it for a real floor. */
export const SHADOW_CATCHER = 'fb-shadow-catcher';

/**
 * Hands the live 3D scene to the path tracer (ADR-068) without the UI importing three.js. While `rendering` is set
 * the viewer shows the realistic look with no selection or hover tint, so the picture shows only the furniture.
 */
let stage: { scene: Scene; camera: Camera } | null = null;
let rendering = false;
const listeners = new Set<() => void>();

export function setStage(s: { scene: Scene; camera: Camera } | null) {
  stage = s;
}
export const getStage = () => stage;

/**
 * A still of the open 3D view as a PNG data URL (ADR-206: the client sheet's picture and the assembly print's step
 * pictures): the viewer registers it while it is mounted; null when no 3D view is open. Draws one frame on demand
 * (ADR-121) and reads it at once, so the canvas needs no preserved drawing buffer.
 */
let capture: (() => string | null) | null = null;
export function setCapture(fn: (() => string | null) | null) {
  capture = fn;
}
export const hasStill = () => capture !== null;
export function captureStill(): string | null {
  try {
    return capture?.() ?? null;
  } catch {
    return null;
  }
}

export function setRendering(v: boolean) {
  rendering = v;
  listeners.forEach((l) => l());
}

export function useRendering(): boolean {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => rendering,
    () => false,
  );
}
