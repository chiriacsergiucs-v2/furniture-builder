import { useCallback } from 'react';
import { dragResize, type ModelItem, type ModelSize } from '../core/model3d';
import { useDesign } from '../store/designStore';
import { keepProportionsNow } from '../store/keepProportions';
import { previewStore, useAxisDrag, type Axis } from './axisDrag';

/** A 3D model being resized with a handle (ADR-102): the size it would get on release. */
interface ResizePreview {
  id: string;
  size: ModelSize;
}

const preview = previewStore<ResizePreview>();
const clear = () => preview.set(null);
/** The model being resized in 3D and its size so far, or null. */
export const useResizePreview = preview.use;

export type HandleAxis = Axis;

/**
 * Resizing a selected 3D model by its handles in Move mode (ADR-102). The pointer is only turned into a point along
 * the handle's room axis (`useAxisDrag`); the new size is `dragResize` (core), with Keep proportions as the size
 * fields have it. Commits once on release (one undo step); Esc, a second finger or a cancelled pointer drop it
 * unchanged.
 */
export function useModelResize() {
  const drag = useAxisDrag(clear);
  return useCallback(
    (e: React.PointerEvent, item: ModelItem, axis: HandleAxis, at: [number, number, number]) => {
      const start = item.size;
      drag(
        e,
        at,
        axis,
        (by) =>
          preview.set({
            id: item.id,
            size: dragResize(item, start, axis, by, keepProportionsNow(item.id)),
          }),
        () => {
          const p = preview.get();
          if (p?.id !== item.id) return null;
          const size = p.size;
          return () =>
            useDesign.getState().updateProject((proj) => ({
              ...proj,
              models: (proj.models ?? []).map((m) => (m.id === item.id ? { ...m, size } : m)),
            }));
        },
      );
    },
    [drag],
  );
}
