import { useThree } from '@react-three/fiber';
import { useCallback, useEffect, useMemo, useRef, useSyncExternalStore } from 'react';
import { Raycaster, Vector2 } from 'three';
import { axisPoint } from '../core/drag3d';
import { dragResize, type ModelItem, type ModelSize } from '../core/model3d';
import { useDesign } from '../store/designStore';
import { keepProportionsNow } from '../ui/keepProportions';
import { DRAG_THRESHOLD_PX } from '../ui/planDrag';
import { S } from './pieceDrag';

/** A 3D model being resized with a handle (ADR-102): the size it would get on release. */
export interface ResizePreview {
  id: string;
  size: ModelSize;
}

// Outside React state, as the move ghost: a pointer move re-renders only the model and its label.
let previewNow: ResizePreview | null = null;
const listeners = new Set<() => void>();
function setPreview(p: ResizePreview | null) {
  if (p === previewNow) return;
  previewNow = p;
  listeners.forEach((f) => f());
}
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};
/** The model being resized in 3D and its size so far, or null. */
export const useResizePreview = () => useSyncExternalStore(subscribe, () => previewNow);

export type HandleAxis = 'x' | 'y' | 'z';

/**
 * Resizing a selected 3D model by its handles in Move mode (ADR-102). The pointer is only turned into a point along
 * the handle's room axis here; the new size is `dragResize` (core), with Keep proportions as the size fields have it.
 * Commits once on release (one undo step); Esc, a second finger or a cancelled pointer drop it unchanged.
 */
export function useModelResize() {
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

  /** Screen point → mm along `axis` through room point `at`, or null when it cannot be read. */
  const along = useCallback(
    (clientX: number, clientY: number, at: [number, number, number], axis: HandleAxis) => {
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
    (e: React.PointerEvent, item: ModelItem, axis: HandleAxis, at: [number, number, number]) => {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      e.preventDefault();
      e.stopPropagation();
      if (cleanup.current) return;
      const from = along(e.clientX, e.clientY, at, axis);
      if (from === null) return;
      const pointerId = e.pointerId,
        sx = e.clientX,
        sy = e.clientY,
        start = item.size;
      let dragging = false;
      let by = 0;
      const show = () =>
        setPreview({
          id: item.id,
          size: dragResize(item, start, axis, by, keepProportionsNow(item.id)),
        });
      const onMove = (ev: PointerEvent) => {
        if (ev.pointerId !== pointerId) return;
        dragging ||= Math.hypot(ev.clientX - sx, ev.clientY - sy) > DRAG_THRESHOLD_PX;
        if (!dragging) return;
        // Along the axis seen end-on, keep the last readable point.
        const now = along(ev.clientX, ev.clientY, at, axis);
        if (now !== null) by = now - from;
        show();
      };
      const onUp = (ev: PointerEvent) => {
        if (ev.pointerId !== pointerId) return;
        const size = previewNow?.id === item.id ? previewNow.size : null;
        end();
        if (!dragging || !size) return;
        const st = useDesign.getState();
        st.updateProject((p) => ({
          ...p,
          models: (p.models ?? []).map((m) => (m.id === item.id ? { ...m, size } : m)),
        }));
      };
      const cancel = (ev: Event) => {
        if (ev instanceof PointerEvent && ev.type === 'pointercancel' && ev.pointerId !== pointerId)
          return;
        if (ev instanceof PointerEvent && ev.type === 'pointerdown' && ev.pointerId === pointerId)
          return;
        if (ev instanceof KeyboardEvent) {
          if (ev.key !== 'Escape') return;
          // Esc cancels the resize only; the app's Esc (clear the selection) does not run too.
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
