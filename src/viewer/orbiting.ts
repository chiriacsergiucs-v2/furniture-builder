import { useSyncExternalStore } from 'react';
import { createListeners } from '../store/deviceValue';

/**
 * Whether the user is turning the 3D view right now (a pointer drag of the orbit controls, then their damped glide).
 * While the camera alone moves, work that does not depend on the camera (the floor's contact shadow, the shadow map) is
 * not redrawn, which changes nothing on screen (user report 2026-11-26: dragging in 3D lags on an Android phone). Only
 * when the frames of a drag are measured slow does the view give up more (the orbit budget below): first ambient
 * occlusion, then pixel ratio, never below 0.5. A fast device draws the drag exactly as the still view (ADR-295,
 * decision 9). The mouse wheel never starts turning: a zoom notch draws at full quality.
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
  lastFrame = undefined;
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

/** A frame of a drag slower than this, on average, is slow (about 45 frames a second). */
export const SLOW_FRAME_MS = 22;
/** A frame faster than this, on average, leaves room to draw sharper again. */
export const FAST_FRAME_MS = 12;
/** A gap longer than this is a pause in the drag (the finger held still), not a slow frame. */
export const PAUSE_MS = 300;
/** The lowest pixel ratio a drag may drop to. */
export const MIN_ORBIT_DPR = 0.5;
/** Frames averaged before a decision; two are enough when they are very slow. */
const WINDOW = 6;
const VERY_SLOW_MS = 60;
const TARGET_MS = 1000 / 60;

/**
 * What turning the view may give up to stay smooth, learned from the frames of the drags so far in this session (so a
 * slow phone starts its next drag already reduced, and a fast one never reduces).
 */
interface OrbitBudget {
  /** The pixel ratio while turning, as a share of the still view's ratio (1 = the same). */
  readonly scale: number;
  /** Whether ambient occlusion is skipped while turning. */
  readonly skipOcclusion: boolean;
  /** Frame intervals (ms) measured since the last decision. */
  readonly samples: readonly number[];
}

export const FULL_BUDGET: OrbitBudget = { scale: 1, skipOcclusion: false, samples: [] };

/**
 * The budget after one more frame of a drag took `intervalMs`. Pure. When the frames are slow, it skips ambient occlusion
 * first (if the view draws it), then lowers the pixel ratio by about what the measured time asks for (the cost of a
 * frame is mostly its pixels, which go with the square of the ratio), never below MIN_ORBIT_DPR. When they are fast, it
 * raises the ratio back a step; ambient occlusion returns when the drag ends.
 */
export function nextBudget(
  b: OrbitBudget,
  intervalMs: number,
  baseDpr: number,
  hasOcclusion: boolean,
): OrbitBudget {
  if (!(intervalMs > 0) || intervalMs > PAUSE_MS)
    return b.samples.length ? { ...b, samples: [] } : b;
  const samples = [...b.samples, intervalMs];
  const avg = samples.reduce((a, x) => a + x, 0) / samples.length;
  if (samples.length < WINDOW && !(samples.length >= 2 && avg > VERY_SLOW_MS))
    return { ...b, samples };
  const minScale = Math.min(1, MIN_ORBIT_DPR / baseDpr);
  if (avg > SLOW_FRAME_MS) {
    if (hasOcclusion && !b.skipOcclusion) return { ...b, skipOcclusion: true, samples: [] };
    const step = Math.min(0.85, Math.max(0.5, Math.sqrt(TARGET_MS / avg)));
    return { ...b, scale: Math.max(minScale, b.scale * step), samples: [] };
  }
  if (avg < FAST_FRAME_MS && b.scale < 1)
    return { ...b, scale: Math.min(1, b.scale / 0.85), samples: [] };
  return { ...b, samples: [] };
}

let budget: OrbitBudget = FULL_BUDGET;
let occlusions = 0;
let lastFrame: number | undefined;

/** The ambient-occlusion pass is drawn (Occlusion): a slow drag may skip it before lowering the pixel ratio. */
export function occlusionMounted(): () => void {
  occlusions++;
  return () => void occlusions--;
}

/**
 * One frame of the view at `now` (ms): while turning, it measures the frame and returns the pixel ratio to draw it at;
 * otherwise `baseDpr`. The first frame of a drag, and the first after a change of ratio, are not measured (they include
 * the wait before the drag and the resize of the drawing buffer).
 */
export function orbitFrame(now: number, baseDpr: number): number {
  if (!orbiting) {
    lastFrame = undefined;
    return baseDpr;
  }
  if (lastFrame !== undefined) {
    const before = budget.scale;
    budget = nextBudget(budget, now - lastFrame, baseDpr, occlusions > 0);
    if (budget.scale !== before) {
      lastFrame = undefined;
      return baseDpr * budget.scale;
    }
  }
  lastFrame = now;
  return baseDpr * budget.scale;
}

/** A touch screen (a phone or tablet, the main target): its first drag starts already reduced (ADR-295). */
function coarsePointer(): boolean {
  return typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;
}

/**
 * The pixel ratio to start a drag at, from what earlier drags learned. Before any drag was measured, a touch screen
 * starts at MIN_ORBIT_DPR and steps back up while the frames are fast, so the first drag on a phone does not lag while
 * the budget learns (review of ADR-295); a mouse starts at the full ratio.
 */
export function orbitStartDpr(baseDpr: number): number {
  if (budget === FULL_BUDGET && coarsePointer())
    budget = { ...FULL_BUDGET, scale: Math.min(1, MIN_ORBIT_DPR / baseDpr) };
  return baseDpr * budget.scale;
}

/** Whether this frame skips ambient occlusion: only while turning, and only once a drag was measured slow. */
export function orbitSkipsOcclusion(): boolean {
  return orbiting && budget.skipOcclusion;
}

/** Tests: forget what earlier drags learned. */
export function resetOrbitBudget() {
  budget = FULL_BUDGET;
  lastFrame = undefined;
}
