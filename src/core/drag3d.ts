/**
 * Moving a project piece in the 3D view (ADR-093). The viewer only turns the pointer into a ray; this module turns
 * the ray into a point on the room's floor plane and that point into exactly the drop a Plan drag gives (ADR-065,
 * ADR-070): whole mm, the 10 mm step with Snap off or Alt held, snapping with Snap on. Height is never dragged; it
 * comes from placement.
 */
import { t } from './i18n';
import { modelBox } from './model3d';
import { DRAG_STEP, liftOff, type PlacedPiece, type Project, type ProjectItem } from './project';
import { connectorsOf, dropTarget, SNAP_RANGE, type SnapResult } from './snap';
import type { Box, Mm } from './types';

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
 * Where along a room axis a ray passes closest to the line through `at` along that axis (mm on that axis), or null
 * when the ray runs parallel to it or the point lies behind the camera or beyond `reach`. Used to drag a 3D model's
 * resize handle (ADR-102). Never throws.
 */
export function axisPoint(
  ray: Ray,
  at: [number, number, number],
  axis: 'x' | 'y' | 'z',
  reach: Mm = MAX_REACH,
): number | null {
  const i = axis === 'x' ? 0 : axis === 'y' ? 1 : 2;
  const [ox, oy, oz] = ray.origin;
  const len = Math.hypot(...ray.dir);
  if (![...ray.origin, ...ray.dir, ...at].every(Number.isFinite) || len === 0) return null;
  const d = ray.dir.map((v) => v / len);
  // Closest points of two lines: the ray o + t·d and the axis at + s·e, with e the unit axis.
  const w = [ox - at[0], oy - at[1], oz - at[2]];
  const b = d[i];
  const denom = 1 - b * b;
  if (denom < 1e-6) return null;
  const dw = d[0] * w[0] + d[1] * w[1] + d[2] * w[2];
  const t = (b * w[i] - dw) / denom;
  if (!(t > 0) || t > reach) return null;
  return at[i] + w[i] + t * b;
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

/**
 * The drop for a display-only 3D model (ADR-076) pressed at `from` and dragged to `to` (ADR-203, G-105): the same
 * 10 mm step as a piece (ADR-065) and, with `snap`, its box's sides snap within `range` to the walls and to the pieces'
 * faces, nearest first on each plan axis (a model has no family, so no join rules apply). Height is kept. Whole mm;
 * null when the model is not in the project. Never throws.
 */
export function modelDrop(
  project: Project,
  pieces: PlacedPiece[],
  id: string,
  from: FloorPoint,
  to: FloorPoint,
  snap: boolean,
  range: Mm = SNAP_RANGE,
): SnapResult | null {
  const m = project.models?.find((x) => x.id === id);
  if (!m) return null;
  const step = (d: number) => (Number.isFinite(d) ? Math.round(d / DRAG_STEP) * DRAG_STEP : 0) || 0;
  const free = {
    ...m.position,
    x: m.position.x + step(to.x - from.x),
    z: m.position.z + step(to.z - from.z),
  };
  const b0 = modelBox(m);
  const at = (dx: number, dz: number): Box => ({ ...b0, x: free.x + dx, z: free.z + dz });
  if (!snap) return { position: free, box: at(0, 0), snap: null, hint: null, refused: [] };
  const here = at(0, 0);
  const conn = connectorsOf(pieces, project.room);
  const wallName = (w: number) => (w < 0 ? t('the back wall') : t('wall {n}', { n: w + 1 }));
  const best: Record<'x' | 'z', { d: number; label: string; kind: 'side' | 'wall' } | null> = {
    x: null,
    z: null,
  };
  const lohi = (axis: 'x' | 'z') =>
    axis === 'x' ? [here.z, here.z + here.d] : [here.x, here.x + here.w];
  for (const axis of ['x', 'z'] as const) {
    const [lo, hi] = lohi(axis);
    const min = axis === 'x' ? here.x : here.z,
      max = axis === 'x' ? here.x + here.w : here.z + here.d;
    const sides = [
      { at: min, normal: -1 },
      { at: max, normal: 1 },
    ];
    const offer = (d: number, label: string, kind: 'side' | 'wall') => {
      const was = best[axis];
      if (Math.abs(d) <= range && (!was || Math.abs(d) < Math.abs(was.d)))
        best[axis] = { d, label, kind };
    };
    for (const f of sides) {
      for (const n of conn.faces)
        if (
          n.axis === axis &&
          n.normal === -f.normal &&
          Math.min(hi, n.hi) - Math.max(lo, n.lo) > 0
        )
          offer(n.at - f.at, t('Joins {name}', { name: n.name }), 'side');
      for (const w of conn.walls)
        if (
          w.axis === axis &&
          w.normal === -f.normal &&
          Math.min(hi, w.hi) - Math.max(lo, w.lo) > 0
        )
          offer(w.at - f.at, t('Against {wall}', { wall: wallName(w.wall) }), 'wall');
    }
  }
  const sx = best.x?.d ?? 0,
    sz = best.z?.d ?? 0;
  const labels = [best.x?.label, best.z?.label].filter((l): l is string => !!l);
  if (!labels.length)
    return {
      position: free,
      box: here,
      snap: null,
      hint: t('Nothing to snap to within {range} mm.', { range }),
      refused: [],
    };
  const label = labels.map((l, i) => (i ? l.replace(/^./, (c) => c.toLowerCase()) : l)).join(' · ');
  return {
    position: { ...free, x: free.x + sx, z: free.z + sz },
    box: at(sx, sz),
    snap: {
      label,
      notes: [],
      kind:
        best.x?.kind === 'wall' && best.z?.kind === 'wall' ? 'corner' : (best.x ?? best.z)!.kind,
    },
    hint: null,
    refused: [],
  };
}
