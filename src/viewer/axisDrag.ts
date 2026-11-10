import { useThree } from '@react-three/fiber';
import { useCallback, useEffect, useMemo, useRef, useSyncExternalStore } from 'react';
import { Raycaster, Vector2 } from 'three';
import { axisPoint } from '../core/drag3d';
import { DRAG_THRESHOLD_PX } from '../shared/planDrag';
import { S } from './pieceDrag';

/**
 * What a drag would do on release, kept outside React state (as the move ghost) so a pointer move re-renders only
 * what shows it. Shared by the height handle (ADR-122) and the model resize handles (ADR-102).
 */
export function previewStore<T>() {
  let now: T | null = null;
  const listeners = new Set<() => void>();
  const set = (p: T | null) => {
    if (p === now) return;
    now = p;
    listeners.forEach((f) => f());
  };
  const subscribe = (l: () => void) => {
    listeners.add(l);
    return () => listeners.delete(l);
  };
  return {
    set,
    get: () => now,
    use: () => useSyncExternalStore(subscribe, () => now),
  };
}

export type Axis = 'x' | 'y' | 'z';

/**
 * A handle dragged along one room axis in Move mode. The pointer is only turned into millimetres along the axis
 * through `at`; `onMove(by, ev)` gets how far it went (the last readable point when the axis is seen end-on), and
 * `onRelease()` returns what to commit, read before the preview is cleared, or null. One commit on release (one undo
 * step); Esc, a second finger or a cancelled pointer drop it unchanged. `clear` empties the caller's preview.
 */
export function useAxisDrag(clear: () => void) {
  const camera = useThree((s) => s.camera);
  const gl = useThree((s) => s.gl);
  const raycaster = useMemo(() => new Raycaster(), []);
  const ndc = useMemo(() => new Vector2(), []);
  const cleanup = useRef<(() => void) | null>(null);

  const end = useCallback(() => {
    cleanup.current?.();
    cleanup.current = null;
    clear();
  }, [clear]);
  useEffect(() => end, [end]);

  /** Screen point → mm along `axis` through room point `at`, or null when it cannot be read. */
  const along = useCallback(
    (clientX: number, clientY: number, at: [number, number, number], axis: Axis) => {
      const r = gl.domElement.getBoundingClientRect();
      if (r.width <= 0 || r.height <= 0) return null;
      ndc.set(((clientX - r.left) / r.width) * 2 - 1, -((clientY - r.top) / r.height) * 2 + 1);
      raycaster.setFromCamera(ndc, camera);
      const { origin: o, direction: d } = raycaster.ray;
      return axisPoint({ origin: [o.x / S, o.y / S, o.z / S], dir: [d.x, d.y, d.z] }, at, axis);
    },
    [gl, camera, raycaster, ndc],
  );

  return useCallback(
    (
      e: React.PointerEvent,
      at: [number, number, number],
      axis: Axis,
      onMove: (by: number, ev: PointerEvent) => void,
      onRelease: () => (() => void) | null,
    ) => {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      e.preventDefault();
      e.stopPropagation();
      if (cleanup.current) return;
      const from = along(e.clientX, e.clientY, at, axis);
      if (from === null) return;
      const pointerId = e.pointerId,
        sx = e.clientX,
        sy = e.clientY;
      let dragging = false;
      let by = 0;
      const move = (ev: PointerEvent) => {
        if (ev.pointerId !== pointerId) return;
        dragging ||= Math.hypot(ev.clientX - sx, ev.clientY - sy) > DRAG_THRESHOLD_PX;
        if (!dragging) return;
        const now = along(ev.clientX, ev.clientY, at, axis);
        if (now !== null) by = now - from;
        onMove(by, ev);
      };
      const up = (ev: PointerEvent) => {
        if (ev.pointerId !== pointerId) return;
        const commit = onRelease();
        end();
        if (dragging && commit) commit();
      };
      const cancel = (ev: Event) => {
        if (ev instanceof PointerEvent && ev.type === 'pointercancel' && ev.pointerId !== pointerId)
          return;
        if (ev instanceof PointerEvent && ev.type === 'pointerdown' && ev.pointerId === pointerId)
          return;
        if (ev instanceof KeyboardEvent) {
          if (ev.key !== 'Escape') return;
          // Esc cancels the drag only; the app's Esc (clear the selection) does not run too.
          ev.preventDefault();
          ev.stopPropagation();
        }
        end();
      };
      window.addEventListener('pointermove', move);
      window.addEventListener('pointerup', up);
      window.addEventListener('pointercancel', cancel);
      window.addEventListener('pointerdown', cancel, true);
      window.addEventListener('keydown', cancel, true);
      cleanup.current = () => {
        window.removeEventListener('pointermove', move);
        window.removeEventListener('pointerup', up);
        window.removeEventListener('pointercancel', cancel);
        window.removeEventListener('pointerdown', cancel, true);
        window.removeEventListener('keydown', cancel, true);
      };
    },
    [along, end],
  );
}
