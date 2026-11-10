import { useCallback } from 'react';
import { dragHeight, snapWallHeight } from '../core/height';
import { useDesign } from '../store/designStore';
import { snapIsOn } from '../store/useSnap';
import { previewStore, useAxisDrag } from './axisDrag';

/** A wall unit whose height is being dragged in 3D (ADR-122): the height it would hang at on release. */
interface HeightPreview {
  id: string;
  /** Its underside above the floor, mm (may be below 0 while dragging: release then refuses and says why). */
  height: number;
  /** The line it snapped to (ADR-205): "Snapped to the worktop line, 900 mm"; null when placed freely. */
  hint?: string | null;
}

const preview = previewStore<HeightPreview>();
const clear = () => preview.set(null);
/** The wall unit being lifted or lowered in 3D and its height so far, or null. */
export const useHeightPreview = preview.use;

/**
 * Dragging a selected wall unit's height handle in Move mode (ADR-122). The pointer is only turned into millimetres
 * along the vertical axis (`useAxisDrag`); the new height is `dragHeight` and `setWallHeight` (core). Commits once on
 * release (one undo step); Esc, a second finger or a cancelled pointer drop it unchanged.
 */
export function useHeightDrag() {
  const drag = useAxisDrag(clear);
  return useCallback(
    (e: React.PointerEvent, id: string, start: number, at: [number, number, number]) =>
      drag(
        e,
        at,
        'y',
        (by, ev) => {
          const free = dragHeight(start, by);
          // Snap on and Alt not held: the underside or top snaps to the worktop and wall-unit lines (ADR-205).
          const st = useDesign.getState();
          const snapped =
            snapIsOn() && !ev.altKey && st.project && st.projectModel
              ? snapWallHeight(st.project, st.projectModel.pieces, id, free)
              : { height: free, hint: null };
          preview.set({ id, height: snapped.height, hint: snapped.hint });
        },
        () => {
          const p = preview.get();
          return p?.id === id ? () => void useDesign.getState().setItemHeight(id, p.height) : null;
        },
      ),
    [drag],
  );
}
