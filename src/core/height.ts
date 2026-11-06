/**
 * Changing a wall unit's height from the 3D view (ADR-122, user answer 2026-10-27 "Accept default": wall-placed pieces
 * only; a floor piece stays on the floor and height still comes from placement, ADR-031). The viewer turns the pointer
 * into millimetres along the vertical axis; this module turns that into the piece's new hanging height, whole mm. Below
 * the floor is refused with the reason, never clamped (ADR-008); a locked piece stays (ADR-095).
 */
import { t } from './i18n';
import {
  isWallHung,
  moveBlocked,
  pieceName,
  type MoveResult,
  type PlacedPiece,
  type Project,
} from './project';
import { SNAP_RANGE } from './snap';
import type { Box, Mm } from './types';

/** The label shown while the height is dragged: "From floor 1450 mm". */
export const heightLabel = (height: number) => t('From floor {h} mm', { h: height });

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
      reason: t('{name} is not hung on the wall; only wall units change height here.', {
        name: pieceName(project, id),
      }),
    };
  if (!Number.isInteger(height) || height < 0)
    return {
      project,
      reason: t('{name} would go below the floor ({h} mm); it stays at {at} mm.', {
        name: pieceName(project, id),
        h: height,
        at: it.placement.height,
      }),
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

/** A wall unit's height after snapping (ADR-205): where it lands and the hint naming the line, or null when free. */
export interface HeightSnap {
  height: Mm;
  hint: string | null;
}

/**
 * Snap a dragged wall unit's height (ADR-205, G-033): its underside or its top within `range` (60 mm, ADR-070) of a
 * line lands on it. The lines are the worktop line (the top of the run worktop under it, or of the base units under it
 * when there is no worktop) and the undersides and tops of the other wall units. The nearest line wins, ties broken by
 * the line's kind (worktop first) and then the piece id. Nothing in range: the height as given, no hint. Whole mm; a
 * line below the floor is never offered. Snap off or Alt held: the caller does not call this.
 */
export function snapWallHeight(
  project: Project,
  pieces: PlacedPiece[],
  id: string,
  height: Mm,
  range: Mm = SNAP_RANGE,
): HeightSnap {
  const me = pieces.find((pc) => pc.item.id === id);
  if (!me) return { height, hint: null };
  const b = me.bounds;
  const under = (o: Box) =>
    o.x < b.x + b.w && b.x < o.x + o.w && o.z < b.z + b.d && b.z < o.z + o.d;
  type Line = { y: Mm; rank: number; key: string; hint: (y: Mm) => string };
  const worktop = (y: Mm) => t('Snapped to the worktop line, {h} mm', { h: y });
  const tops = (project.runParts ?? []).filter((rp) => rp.kind === 'worktop' && under(rp.box));
  const bases = pieces.filter(
    (pc) =>
      pc.item.id !== id && pc.bounds.y === 0 && !isWallHung(pc.item.design) && under(pc.bounds),
  );
  const lines: Line[] = tops.length
    ? tops.map((rp) => ({ y: rp.box.y + rp.box.h, rank: 0, key: rp.id, hint: worktop }))
    : bases.map((pc) => ({
        y: pc.bounds.y + pc.bounds.h,
        rank: 0,
        key: pc.item.id,
        hint: worktop,
      }));
  for (const pc of pieces) {
    if (pc.item.id === id || pc.item.placement?.kind !== 'wall') continue;
    const hint = (y: Mm) => t('Snapped to {name}, {h} mm', { name: pc.item.design.name, h: y });
    lines.push(
      { y: pc.bounds.y, rank: 1, key: pc.item.id, hint },
      { y: pc.bounds.y + pc.bounds.h, rank: 1, key: pc.item.id, hint },
    );
  }
  let best: { at: Mm; dist: number; line: Line } | null = null;
  for (const line of lines)
    for (const at of [line.y, line.y - b.h]) {
      const dist = Math.abs(at - height);
      if (at < 0 || dist > range) continue;
      const better =
        !best ||
        dist < best.dist ||
        (dist === best.dist &&
          (line.rank < best.line.rank ||
            (line.rank === best.line.rank && line.key < best.line.key)));
      if (better) best = { at, dist, line };
    }
  return best ? { height: best.at, hint: best.line.hint(best.line.y) } : { height, hint: null };
}
