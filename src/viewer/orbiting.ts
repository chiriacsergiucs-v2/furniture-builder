import { useSyncExternalStore } from 'react';
import type { Object3D } from 'three';
import { createListeners } from '../store/deviceValue';

/**
 * Whether the user is turning the 3D view right now (a pointer drag of the orbit controls, then their damped glide).
 * While the camera alone moves, work that does not depend on the camera (the floor's contact shadow, the shadow map) is
 * not redrawn, which changes nothing on screen (user report 2026-11-26: dragging in 3D lags on an Android phone). Only
 * when the frames of a drag are measured slow does the view give up more (the orbit budget below): first ambient
 * occlusion, then pixel ratio, never below 0.5. A fast device draws the drag exactly as the still view (ADR-295,
 * decision 9). The mouse wheel never starts turning: a zoom notch draws at full quality (only the camera-independent
 * work pauses, see `useCameraMoving`).
 */
let orbiting = false;
/** How long the camera must be still after the release (its damped glide over) before turning counts as ended. */
const SETTLE_MS = 150;
const { subscribe, notify } = createListeners();

/**
 * Calls `off` once `ms` have passed since the last `poke`, with one timer at a time: the camera pokes it on every
 * frame of a drag, and a timer cleared and set again on each one showed in the drag's profile (setTimeout, 10 ms).
 */
function quietAfter(ms: number, off: () => void) {
  let last = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const check = () => {
    const left = last + ms - Date.now();
    if (left > 0) timer = setTimeout(check, left);
    else {
      timer = undefined;
      off();
    }
  };
  return {
    poke() {
      last = Date.now();
      timer ??= setTimeout(check, ms);
    },
    cancel() {
      clearTimeout(timer);
      timer = undefined;
    },
  };
}

const settle = quietAfter(SETTLE_MS, () => setOrbiting(false));

export function setOrbiting(on: boolean) {
  if (!on) settle.cancel();
  if (orbiting === on) return;
  orbiting = on;
  lastFrame = undefined;
  notify();
}

/**
 * Whether the camera moved within the last SETTLE_MS for any reason (a drag, its glide, a wheel notch). The floor's
 * contact shadow does not depend on the camera, so it is not redrawn then (FloorShadow): on a slow GPU each redraw of it
 * made every wheel notch a long task (drag-perf.mjs, wheel 1x).
 */
let moving = false;
const still = quietAfter(SETTLE_MS, () => {
  moving = false;
  notify();
});

/** The camera moved: while pressed, turning starts (a tap without a move never does); after the release, the glide. */
export function orbitMoved(pressed: boolean) {
  still.poke();
  if (!moving) {
    moving = true;
    notify();
  }
  if (!pressed && !orbiting) return;
  setOrbiting(true);
  if (pressed) settle.cancel();
  else settle.poke();
}

/** The press ended: turning ends once the camera has stopped gliding. */
export function orbitReleased() {
  if (orbiting) settle.poke();
}

/**
 * A press whose pointer travelled more than this (px) from where it went down is a drag, not a tap: the click that may
 * follow selects nothing. A mouse sends a click after any drag that starts and ends on a board; that click selected the
 * board and changed the page's layout at the end of the drag, which resized the view at full quality (drag-perf.mjs:
 * the long tasks after the release). Only a mouse press counts: a touch tap that wobbles still selects (user
 * 2026-11-26, G-600), and a touch drag sends no click.
 */
export const TAP_SLOP_PX = 10;
let press: { x: number; y: number; far: boolean } | null = null;

/** The primary pointer went down on the view at (x, y) (client px); a touch or pen press is never a drag. */
export function pressDown(x: number, y: number, pointerType = 'mouse') {
  press = pointerType === 'mouse' ? { x, y, far: false } : null;
}

/** The primary pointer moved to (x, y) while pressed. */
export function pressMoved(x: number, y: number) {
  if (press && !press.far && Math.hypot(x - press.x, y - press.y) > TAP_SLOP_PX) press.far = true;
}

/** Whether the last press on the view travelled beyond TAP_SLOP_PX (its click ends a drag). */
export function pressWasDrag(): boolean {
  return !!press?.far;
}

export function isOrbiting(): boolean {
  return orbiting;
}

export function useOrbiting(): boolean {
  return useSyncExternalStore(subscribe, isOrbiting, () => false);
}

const cameraMoving = () => orbiting || moving;

/** Whether the camera is turning or moved a moment ago (a wheel notch included). */
export function useCameraMoving(): boolean {
  return useSyncExternalStore(subscribe, cameraMoving, () => false);
}

/** A frame of a drag slower than this, on average, is slow (below 50 frames a second, the drag target of ADR-295). */
export const SLOW_FRAME_MS = 20;
/**
 * A frame faster than this, on average, leaves room to draw sharper again. Above the 16.7 ms frame of a 60 Hz screen,
 * so a fast 60 Hz phone that started reduced steps back up (re-review of ADR-295, N1).
 */
export const FAST_FRAME_MS = 18;
/** A gap longer than this is a pause in the drag (the finger held still), not a slow frame. */
export const PAUSE_MS = 300;
/** The lowest pixel ratio a drag may drop to. */
export const MIN_ORBIT_DPR = 0.5;
/** Frames averaged before a decision; two are enough when they are very slow. */
const WINDOW = 6;
const VERY_SLOW_MS = 60;
const TARGET_MS = 1000 / 60;
/**
 * Fast windows to wait, after a slow one, before a ratio measured slow is tried again. Without it the ratio climbs
 * back into the slow one every other window, and each change of ratio resizes the drawing buffer (a long frame of its
 * own): the 4x-throttled drag changed it about 20 times in 3 seconds (drag-perf.mjs profile, MO.setSize 67 ms).
 */
export const HOLD_WINDOWS = 12;
/** The step of the ratio up or down. */
const STEP = 0.85;

/**
 * What turning the view may give up to stay smooth, learned from the frames of the drags so far in this session (so a
 * slow phone starts its next drag already reduced, and a fast one never reduces).
 */
interface OrbitBudget {
  /** The pixel ratio while turning, as a share of the still view's ratio (1 = the same). */
  readonly scale: number;
  /** Whether ambient occlusion is skipped while turning. */
  readonly skipOcclusion: boolean;
  /** Whether the plain panel edges are drawn as thin GL lines while turning (MergedEdges.setThin). */
  readonly thinEdges: boolean;
  /** The lowest ratio share measured slow: the ratio steps up to at most a step below it, until `wait` runs out. */
  readonly cap: number;
  /** Fast windows left before `cap` is lifted. */
  readonly wait: number;
  /** How many frames were measured since the last decision, and their total time (ms). */
  readonly n: number;
  readonly sum: number;
}

export const FULL_BUDGET: OrbitBudget = {
  scale: 1,
  skipOcclusion: false,
  thinEdges: false,
  cap: Infinity,
  wait: 0,
  n: 0,
  sum: 0,
};

/**
 * The budget after one more frame of a drag took `intervalMs`. Pure. When the frames are slow, it skips ambient occlusion
 * first (if the view draws it), then draws the plain edges thin (if the view draws them), then lowers the pixel ratio by
 * about what the measured time asks for (the cost of a frame is mostly its pixels, which go with the square of the
 * ratio), never below MIN_ORBIT_DPR. When they are fast, it raises the ratio back a step, but not to within a step of a
 * ratio measured slow until HOLD_WINDOWS fast windows have passed; at the full ratio, the fat edges come back. Ambient
 * occlusion returns when the drag ends.
 */
export function nextBudget(
  b: OrbitBudget,
  intervalMs: number,
  baseDpr: number,
  hasOcclusion: boolean,
  hasEdges = false,
): OrbitBudget {
  if (!(intervalMs > 0) || intervalMs > PAUSE_MS) return b.n ? { ...b, n: 0, sum: 0 } : b;
  const n = b.n + 1,
    sum = b.sum + intervalMs,
    avg = sum / n;
  if (n < WINDOW && !(n >= 2 && avg > VERY_SLOW_MS)) return { ...b, n, sum };
  const minScale = Math.min(1, MIN_ORBIT_DPR / baseDpr);
  if (avg > SLOW_FRAME_MS) {
    const slow = { ...b, cap: Math.min(b.cap, b.scale), wait: HOLD_WINDOWS, n: 0, sum: 0 };
    if (hasOcclusion && !b.skipOcclusion) return { ...slow, skipOcclusion: true };
    if (hasEdges && !b.thinEdges) return { ...slow, thinEdges: true };
    const step = Math.min(STEP, Math.max(0.5, Math.sqrt(TARGET_MS / avg)));
    return { ...slow, scale: Math.max(minScale, b.scale * step) };
  }
  if (avg < FAST_FRAME_MS && (b.scale < 1 || b.thinEdges)) {
    const up = Math.min(1, b.scale / STEP);
    if (b.scale < 1 && up <= b.cap * STEP + 1e-9) return { ...b, scale: up, n: 0, sum: 0 };
    if (b.scale >= 1 && b.cap > 1) return { ...b, thinEdges: false, n: 0, sum: 0 };
    // Held below a ratio measured slow: lift the cap once enough fast windows passed.
    return b.wait > 1
      ? { ...b, wait: b.wait - 1, n: 0, sum: 0 }
      : { ...b, cap: Infinity, wait: 0, n: 0, sum: 0 };
  }
  return { ...b, n: 0, sum: 0 };
}

let budget: OrbitBudget = FULL_BUDGET;
let occlusions = 0;
let edges = 0;
let lastFrame: number | undefined;

/** The ambient-occlusion pass is drawn (Occlusion): a slow drag may skip it before lowering the pixel ratio. */
export function occlusionMounted(): () => void {
  occlusions++;
  return () => void occlusions--;
}

/** The plain panel edges are drawn (PanelEdges): a slow drag may draw them thin before lowering the pixel ratio. */
export function edgesMounted(): () => void {
  edges++;
  return () => void edges--;
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
    budget = nextBudget(budget, now - lastFrame, baseDpr, occlusions > 0, edges > 0);
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
    budget = {
      ...FULL_BUDGET,
      scale: Math.min(1, MIN_ORBIT_DPR / baseDpr),
      thinEdges: edges > 0,
    };
  return baseDpr * budget.scale;
}

/** Whether this frame skips ambient occlusion: only while turning, and only once a drag was measured slow. */
export function orbitSkipsOcclusion(): boolean {
  return orbiting && budget.skipOcclusion;
}

/** Whether this frame draws the plain panel edges thin: only while turning, once a drag was measured slow (or on a
 * touch screen's first drag, which starts reduced). */
export function orbitThinEdges(): boolean {
  return orbiting && budget.thinEdges;
}

/**
 * What the floor's contact shadow is drawn from: each visible mesh's geometry and place (it is drawn with one depth
 * material, so materials do not matter). Read when the camera starts moving and again once it stops: the shadow is
 * drawn again only when they differ.
 */
export function shadowSignature(scene: Object3D): number[] {
  const out: number[] = [];
  scene.traverseVisible((o) => {
    const mesh = o as Object3D & { isMesh?: boolean; geometry?: { id: number } };
    if (mesh.isMesh && mesh.geometry) out.push(mesh.geometry.id, ...o.matrixWorld.elements);
  });
  return out;
}

export function sameSignature(a: readonly number[] | null, b: readonly number[]): boolean {
  return !!a && a.length === b.length && a.every((x, i) => x === b[i]);
}

/** Tests: forget what earlier drags learned. */
export function resetOrbitBudget() {
  budget = FULL_BUDGET;
  lastFrame = undefined;
  press = null;
}
