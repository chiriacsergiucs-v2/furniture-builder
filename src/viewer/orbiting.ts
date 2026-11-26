import { useSyncExternalStore } from 'react';
import { createListeners } from '../store/deviceValue';

/**
 * Whether the user is turning the 3D view right now (the orbit controls between their start and end events). While the
 * camera alone moves, work that does not depend on the camera (the floor's contact shadow, the shadow map) is not
 * redrawn and the costly passes (ambient occlusion, a high pixel ratio) are skipped, so dragging on a phone stays
 * smooth (user report 2026-11-26: dragging in 3D lags on an Android phone). The view looks the same once it stops.
 */
let orbiting = false;
/** How long the camera must be still after the release (its damped glide over) before turning counts as ended. */
const SETTLE_MS = 150;
let settle: ReturnType<typeof setTimeout> | undefined;
const { subscribe, notify } = createListeners();

export function setOrbiting(on: boolean) {
  if (!on) clearTimeout(settle);
  if (orbiting === on) return;
  orbiting = on;
  notify();
}

function settleLater() {
  clearTimeout(settle);
  settle = setTimeout(() => setOrbiting(false), SETTLE_MS);
}

/** The camera moved: while pressed, turning starts (a tap without a move never does); after the release, the glide. */
export function orbitMoved(pressed: boolean) {
  if (!pressed && !orbiting) return;
  setOrbiting(true);
  if (pressed) clearTimeout(settle);
  else settleLater();
}

/** The press ended: turning ends once the camera has stopped gliding. */
export function orbitReleased() {
  if (orbiting) settleLater();
}

export function isOrbiting(): boolean {
  return orbiting;
}

export function useOrbiting(): boolean {
  return useSyncExternalStore(subscribe, isOrbiting, () => false);
}

/**
 * The pixel ratio while turning: at most 0.5. Drawing the pixels is most of a frame's cost (measured with
 * tools/mobile-middle/drag-perf.mjs: 8 fps at the full ratio, 25 at 0.75, 52 at 0.5, 4× CPU throttling). The picture is
 * softer only while it moves; the still view is drawn at the full ratio again (OrbitQuality).
 */
export function orbitDpr(dpr: number): number {
  return Math.min(dpr, 0.5);
}
