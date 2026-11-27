import { useEffect, useLayoutEffect, useRef, useState, type RefObject } from 'react';
import type { Object3D } from 'three';
import type { LineSegments2 } from 'three/examples/jsm/lines/LineSegments2.js';
import {
  isOrbiting,
  orbitMoved,
  orbitReleased,
  pressDown,
  pressMoved,
  sameSignature,
} from './orbiting';
import { ThinTwins } from './panelResources';

/**
 * The glue between the 3D view's components and the drag state of orbiting.ts (ADR-295), kept apart from the
 * components so it is tested without WebGL (G-605): the canvas's pointer-move filter, the press tracking of the orbit
 * controls, the floor shadow's freeze and thaw, and the thin twins of the panel edges.
 */

/**
 * The canvas's pointer events (R3F's event manager), except that a pointer move while the view is turned or while a
 * button or finger is down does not raycast the scene: a hover tint has no use mid-drag, the drags of pieces, walls and
 * handles follow the pointer with their own window listeners, and the raycast over every board on every move costs a
 * phone frame time (the first moves of a drag come before turning starts: drag-perf.mjs, the long task at its start).
 */
export function skipDragMoves<M extends { handlers?: { onPointerMove?: (e: Event) => void } }>(
  manager: M,
): M {
  const move = manager.handlers?.onPointerMove;
  if (!manager.handlers || !move) return manager;
  return {
    ...manager,
    handlers: {
      ...manager.handlers,
      onPointerMove: (e: Event) => {
        if (!isOrbiting() && !(e as PointerEvent).buttons) move(e);
      },
    },
  };
}

/**
 * The presses on the 3D view, for the orbit controls (Fit): turning starts with the first camera move while a pointer
 * is pressed, so a tap (no move) and a wheel notch (the controls start and end on it, with no pointer down) change
 * nothing; how far a mouse press travelled decides whether its click selects (pressWasDrag).
 */
export function trackPresses() {
  let pressed = false;
  const pointers = new Set<number>();
  return {
    /** Listens on the canvas `el` and on `win` for the pointer ups; returns the cleanup. */
    attach(el: EventTarget, win: EventTarget = window): () => void {
      const down = (ev: Event) => {
        const e = ev as PointerEvent;
        // A first finger or the mouse starts afresh: a pointer whose up was never delivered is forgotten.
        if (e.isPrimary) {
          pointers.clear();
          pressDown(e.clientX, e.clientY, e.pointerType);
        }
        pointers.add(e.pointerId);
      };
      const move = (ev: Event) => {
        const e = ev as PointerEvent;
        if (e.isPrimary && pointers.has(e.pointerId)) pressMoved(e.clientX, e.clientY);
      };
      const up = (ev: Event) => void pointers.delete((ev as PointerEvent).pointerId);
      el.addEventListener('pointerdown', down, true);
      el.addEventListener('pointermove', move, true);
      win.addEventListener('pointerup', up, true);
      win.addEventListener('pointercancel', up, true);
      return () => {
        el.removeEventListener('pointerdown', down, true);
        el.removeEventListener('pointermove', move, true);
        win.removeEventListener('pointerup', up, true);
        win.removeEventListener('pointercancel', up, true);
      };
    },
    onStart: () => void (pressed = true),
    onChange: () => orbitMoved(pressed && pointers.size > 0),
    onEnd: () => {
      pressed = false;
      orbitReleased();
    },
  };
}

/**
 * The floor shadow's freeze (FloorShadow): frozen while the camera moves (`moving`) and in the first still frame after,
 * which only brings the full quality back; then thawed after that frame (`frame`, called on each frame), or a moment
 * later when none comes (a wheel notch). `signature` is read at the freeze and at the thaw: when they differ the pieces
 * moved meanwhile, and `redraw` asks for the frame that draws the shadow again (its `frames` prop is not a host prop,
 * so the thaw's commit alone asks for none).
 */
export function useShadowFreeze(
  moving: boolean,
  signature: () => number[],
  redraw: () => void,
): { frozen: boolean; frame: () => void } {
  const [frozen, setFrozen] = useState(false);
  if (moving && !frozen) setFrozen(true);
  const read = useRef(signature);
  const ask = useRef(redraw);
  useLayoutEffect(() => {
    read.current = signature;
    ask.current = redraw;
  });
  const atFreeze = useRef<number[] | null>(null);
  const afterFrame = useRef<(() => void) | null>(null);
  const changed = useRef(false);
  useLayoutEffect(() => {
    if (frozen) atFreeze.current = read.current();
  }, [frozen]);
  useEffect(() => {
    if (frozen || !changed.current) return;
    changed.current = false;
    ask.current();
  }, [frozen]);
  useEffect(() => {
    if (moving || !frozen) return;
    let done = false;
    const thaw = () => {
      if (done) return;
      done = true;
      changed.current = !sameSignature(atFreeze.current, read.current());
      setFrozen(false);
    };
    // After the still frame the end of a drag draws (OrbitQuality), or a moment later when none comes (a wheel notch).
    afterFrame.current = () => setTimeout(thaw);
    const late = setTimeout(thaw, 100);
    return () => {
      done = true;
      afterFrame.current = null;
      clearTimeout(late);
    };
  }, [moving, frozen]);
  const [frame] = useState(() => () => {
    const f = afterFrame.current;
    if (!f) return;
    afterFrame.current = null;
    f();
  });
  return { frozen, frame };
}

/**
 * The thin twins of `lines` (ThinTwins), added to `group` in an effect and disposed in its cleanup, so StrictMode's
 * simulated unmount and remount builds them again instead of leaving them emptied (G-605). Returns the twins in use, for
 * `setThin` on each frame; `changed` asks for a frame once they are in place.
 */
export function useThinTwins(
  lines: readonly LineSegments2[],
  group: RefObject<Object3D | null>,
  changed?: () => void,
): RefObject<ThinTwins | null> {
  const twins = useRef<ThinTwins | null>(null);
  const ask = useRef(changed);
  useLayoutEffect(() => {
    ask.current = changed;
  });
  useEffect(() => {
    const g = group.current;
    if (!g) return;
    const t = new ThinTwins(lines);
    if (t.thin.length) g.add(...t.thin, ...t.warm);
    twins.current = t;
    ask.current?.();
    return () => {
      if (t.thin.length) g.remove(...t.thin, ...t.warm);
      t.dispose();
      if (twins.current === t) twins.current = null;
    };
  }, [lines, group]);
  return twins;
}
