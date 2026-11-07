/**
 * Room surfaces on the 2D views (ADR-208): the wall behind a single piece in its own front view (G-275) and the board
 * a piece shows from above on the plan (G-413). Pure: from the project build, never computed in the UI (ADR-004).
 */
import { footprintOf } from './geometry';
import type { PlacedPiece, Project } from './project';
import { wallFinish, wallLength, type WallFinish } from './room';
import { roomConnectors, SNAP_RANGE } from './snap';
import { wallAxes } from './wallPicture';
import type { Material, Mm } from './types';

export interface WallBehind {
  wall: number;
  finish: WallFinish;
  /** Where the piece's left side (seen from its front) is along the wall, mm from the wall's left end. */
  u0: Mm;
  len: Mm;
  height: Mm;
  /** The floor in the piece's own height: minus the height the piece stands at. */
  floorY: Mm;
}

/**
 * The wall with a background that a piece's back stands against (ADR-145 item 5's rule, ADR-208): the wall facing the
 * way the piece faces, its line within `SNAP_RANGE` of the piece's back, along the piece. Null without a room, for a
 * piece at an angle, against no wall or against a wall without a background.
 */
export function wallBehind(project: Project, pc: PlacedPiece | undefined): WallBehind | null {
  const room = project.room;
  if (!room || !pc || pc.item.angle) return null;
  const b = pc.bounds;
  const { axis, sign } = pc.facing;
  const back = axis === 'x' ? (sign > 0 ? b.x : b.x + b.w) : sign > 0 ? b.z : b.z + b.d;
  const lo = axis === 'x' ? b.z : b.x,
    hi = axis === 'x' ? b.z + b.d : b.x + b.w;
  const w = roomConnectors(room).walls.find(
    (c) =>
      c.wall >= 0 &&
      c.axis === axis &&
      c.normal === sign &&
      Math.abs(c.at - back) <= SNAP_RANGE &&
      Math.min(hi, c.hi) - Math.max(lo, c.lo) > 0,
  );
  const finish = w ? wallFinish(room, w.wall) : undefined;
  if (!w || !finish) return null;
  const { left, right } = wallAxes(room, w.wall);
  const u0 = Math.min(
    ...footprintOf(b).map(([x, z]) => (x - left[0]) * right[0] + (z - left[1]) * right[1]),
  );
  return {
    wall: w.wall,
    finish,
    u0: Math.round(u0),
    len: wallLength(room, w.wall),
    height: room.height,
    floorY: -pc.item.position.y,
  };
}

/**
 * The board a piece shows from above (ADR-208, G-413): the board of its highest panel (the greatest top), the first
 * in model order on a tie. Undefined for a piece without panels.
 */
export function topBoard(pc: PlacedPiece): Material | undefined {
  let best: { top: number; id: string } | null = null;
  for (const p of pc.panels) {
    const top = p.box.y + p.box.h;
    if (!best || top > best.top) best = { top, id: p.materialId };
  }
  return best ? pc.item.design.materials.find((m) => m.id === best.id) : undefined;
}
