/**
 * Changing a wall unit's height from the 3D view (ADR-122, user answer 2026-10-27 "Accept default": wall-placed pieces
 * only; a floor piece stays on the floor and height still comes from placement, ADR-031). The viewer turns the pointer
 * into millimetres along the vertical axis; this module turns that into the piece's new hanging height, whole mm. Below
 * the floor is refused with the reason, never clamped (ADR-008); a locked piece stays (ADR-095).
 */
import { moveBlocked, pieceName, type Project, type MoveResult } from './project';
import type { Mm } from './types';

/** The label shown while the height is dragged: "From floor 1450 mm". */
export const heightLabel = (height: number) => `From floor ${height} mm`;

/** Whether a piece's height can be dragged: it hangs on the wall. */
export const heightDraggable = (project: Project, id: string): boolean =>
  project.items.find((i) => i.id === id)?.placement?.kind === 'wall';

/** The height a drag lands at: the start height moved by `by` mm, whole mm. */
export const dragHeight = (start: Mm, by: number): Mm =>
  Number.isFinite(by) ? Math.round(start + by) : start;

/**
 * Hang wall unit `id` at `height` mm above the floor (its underside). Refused, with the reason, when the piece is not a
 * wall unit, the height is not a whole mm at or above the floor, or the piece (or one resting on it) is locked. The same
 * project when it is already there.
 */
export function setWallHeight(project: Project, id: string, height: number): MoveResult {
  const it = project.items.find((i) => i.id === id);
  if (!it) return { project };
  if (it.placement?.kind !== 'wall')
    return {
      project,
      reason: `${pieceName(project, id)} is not hung on the wall; only wall units change height here.`,
    };
  if (!Number.isInteger(height) || height < 0)
    return {
      project,
      reason: `${pieceName(project, id)} would go below the floor (${height} mm); it stays at ${it.placement.height} mm.`,
    };
  if (height === it.placement.height) return { project };
  const reason = moveBlocked(project, [id]);
  if (reason) return { project, reason };
  return {
    project: {
      ...project,
      items: project.items.map((i) =>
        i.id === id ? { ...i, placement: { kind: 'wall', height } } : i,
      ),
    },
  };
}
