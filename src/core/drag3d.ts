/**
 * Moving a project piece in the 3D view (ADR-093). The viewer only turns the pointer into a ray; this module turns
 * the ray into a point on the room's floor plane and that point into exactly the drop a Plan drag gives (ADR-065,
 * ADR-070): whole mm, the 10 mm step with Snap off or Alt held, snapping with Snap on. Height is never dragged; it
 * comes from placement.
 */
import { liftOff, type PlacedPiece, type Project, type ProjectItem } from './project';
import { dropTarget, SNAP_RANGE, type SnapResult } from './snap';
import type { Mm } from './types';

/** A room point on the plan, in mm (x along the back wall, z away from it). */
export interface FloorPoint {
  x: number;
  z: number;
}

/** A ray in room mm: where it starts and the way it points (any length). */
export interface Ray {
  origin: [number, number, number];
  dir: [number, number, number];
}

/**
 * The farthest a pointer may land from the camera (mm). Near the horizon the hit runs away to infinity; past this a
 * drag keeps its last valid position instead (ADR-093 consequences).
 */
export const MAX_REACH: Mm = 50_000;

/**
 * Where a ray meets the horizontal plane at height `y` (mm), or null when it never does in front of the camera, runs
 * along it, or lands farther than `reach`. Never throws.
 */
export function floorPoint(ray: Ray, y: Mm, reach: Mm = MAX_REACH): FloorPoint | null {
  const [ox, oy, oz] = ray.origin;
  const [dx, dy, dz] = ray.dir;
  const len = Math.hypot(dx, dy, dz);
  if (![ox, oy, oz, dx, dy, dz, y].every(Number.isFinite) || len === 0 || dy === 0) return null;
  const t = (y - oy) / dy;
  if (!(t > 0) || t * len > reach) return null;
  return { x: ox + dx * t, z: oz + dz * t };
}

/**
 * The drop for a piece pressed at room point `from` and dragged to `to` on its floor plane: the same result as a Plan
 * drag by the same move (`dropTarget`), so 3D and Plan always agree. `snap` is the Snap toggle with Alt not held.
 */
export function floorDrop(
  project: Project,
  pieces: PlacedPiece[],
  id: string,
  from: FloorPoint,
  to: FloorPoint,
  snap: boolean,
  range: Mm = SNAP_RANGE,
): SnapResult | null {
  return dropTarget(project, pieces, id, to.x - from.x, to.z - from.z, snap, range);
}

/**
 * The height (mm) a dragged piece lands at: a piece on another piece is lifted off (ADR-065) to the floor, or stays
 * hung on the wall at its height; any other piece keeps its height. For the 3D preview.
 */
export function landingY(item: ProjectItem): Mm {
  if (item.placement?.kind !== 'above') return item.position.y;
  const pl = liftOff(item);
  return pl?.kind === 'wall' ? pl.height : 0;
}
