import { useThree } from '@react-three/fiber';
import { useCallback, useEffect, useMemo, useRef, useSyncExternalStore } from 'react';
import { Raycaster, Vector2 } from 'three';
import { axisPoint } from '../core/drag3d';
import { dragHeight } from '../core/height';
import { useDesign } from '../store/designStore';
import { DRAG_THRESHOLD_PX } from '../ui/planDrag';
import { S } from './pieceDrag';

/** A wall unit whose height is being dragged in 3D (ADR-122): the height it would hang at on release. */
export interface HeightPreview {
  id: string;
  /** Its underside above the floor, mm (may be below 0 while dragging: release then refuses and says why). */
  height: number;
}

// Outside React state, as the move ghost: a pointer move re-renders only the ghost and its label.
let previewNow: HeightPreview | null = null;
const listeners = new Set<() => void>();
function setPreview(p: HeightPreview | null) {
  if (p === previewNow) return;
  previewNow = p;
  listeners.forEach((f) => f());
}
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};
/** The wall unit being lifted or lowered in 3D and its height so far, or null. */
export const useHeightPreview = () => useSyncExternalStore(subscribe, () => previewNow);

/**
 * Dragging a selected wall unit's height handle in Move mode (ADR-122). The pointer is only turned into millimetres
 * along the vertical axis here; the new height is `dragHeight` and `setWallHeight` (core). Commits once on release (one
 * undo step); Esc, a second finger or a cancelled pointer drop it unchanged.
 */
export function useHeightDrag() {
  const camera = useThree((s) => s.camera);
  const gl = useThree((s) => s.gl);
  const raycaster = useMemo(() => new Raycaster(), []);
  const ndc = useMemo(() => new Vector2(), []);
  const cleanup = useRef<(() => void) | null>(null);

  const end = useCallback(() => {
    cleanup.current?.();
    cleanup.current = null;
    setPreview(null);
  }, []);
  useEffect(() => end, [end]);

  /** Screen point → mm up the vertical line through room point `at`, or null when it cannot be read. */
  const along = useCallback(
    (clientX: number, clientY: number, at: [number, number, number]) => {
      const r = gl.domElement.getBoundingClientRect();
      if (r.width <= 0 || r.height <= 0) return null;
      ndc.set(((clientX - r.left) / r.width) * 2 - 1, -((clientY - r.top) / r.height) * 2 + 1);
      raycaster.setFromCamera(ndc, camera);
      const { origin: o, direction: d } = raycaster.ray;
      return axisPoint({ origin: [o.x / S, o.y / S, o.z / S], dir: [d.x, d.y, d.z] }, at, 'y');
    },
    [gl, camera, raycaster, ndc],
  );

  return useCallback(
    (e: React.PointerEvent, id: string, start: number, at: [number, number, number]) => {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      e.preventDefault();
      e.stopPropagation();
      if (cleanup.current) return;
      const from = along(e.clientX, e.clientY, at);
      if (from === null) return;
      const pointerId = e.pointerId,
        sx = e.clientX,
        sy = e.clientY;
      let dragging = false;
      let by = 0;
      const onMove = (ev: PointerEvent) => {
        if (ev.pointerId !== pointerId) return;
        dragging ||= Math.hypot(ev.clientX - sx, ev.clientY - sy) > DRAG_THRESHOLD_PX;
        if (!dragging) return;
        const now = along(ev.clientX, ev.clientY, at);
        if (now !== null) by = now - from;
        setPreview({ id, height: dragHeight(start, by) });
      };
      const onUp = (ev: PointerEvent) => {
        if (ev.pointerId !== pointerId) return;
        const p = previewNow?.id === id ? previewNow : null;
        end();
        if (dragging && p) useDesign.getState().setItemHeight(id, p.height);
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
      window.addEventListener('pointermove', onMove);
      window.addEventListener('pointerup', onUp);
      window.addEventListener('pointercancel', cancel);
      window.addEventListener('pointerdown', cancel, true);
      window.addEventListener('keydown', cancel, true);
      cleanup.current = () => {
        window.removeEventListener('pointermove', onMove);
        window.removeEventListener('pointerup', onUp);
        window.removeEventListener('pointercancel', cancel);
        window.removeEventListener('pointerdown', cancel, true);
        window.removeEventListener('keydown', cancel, true);
      };
    },
    [along, end],
  );
}
