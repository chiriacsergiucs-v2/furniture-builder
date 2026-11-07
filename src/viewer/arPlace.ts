import type { Box } from '../core/types';
import { S } from './pieceDrag';

/**
 * AR placement maths (ADR-213, ADR-214, ADR-215), pure so it can be tested without WebXR. World units are metres
 * (three's and WebXR's); the content's box is in mm and `S` turns mm into metres. Seen from above, a turn `yaw` about
 * y works as three's `rotation.y`: positive is anticlockwise. The content's front is +z, its left (seen from the
 * front) is -x, its back is the box's smallest z.
 */

/** Which point of the content the floor spot marks (ADR-214). Left and right are seen from the front. */
export type ARPoint = 'centre' | 'back-left' | 'back-right';
export const AR_POINTS: readonly ARPoint[] = ['centre', 'back-left', 'back-right'];
export const nextARPoint = (p: ARPoint): ARPoint =>
  AR_POINTS[(AR_POINTS.indexOf(p) + 1) % AR_POINTS.length];

/** Where the content stands: its floor centre in world metres and its turn about y (radians). */
export interface Placement {
  cx: number;
  cy: number;
  cz: number;
  yaw: number;
}

export interface Spot {
  x: number;
  y: number;
  z: number;
}

/** (x, z) turned by `yaw` about y, as three turns a child of an object with `rotation.y = yaw`. */
export function turnXZ(x: number, z: number, yaw: number): [number, number] {
  const c = Math.cos(yaw),
    s = Math.sin(yaw);
  return [x * c + z * s, -x * s + z * c];
}

/** A point of the content on its own floor, in metres (x, z). */
export function pointLocal(b: Box, p: ARPoint): [number, number] {
  if (p === 'centre') return [(b.x + b.w / 2) * S, (b.z + b.d / 2) * S];
  return [(p === 'back-left' ? b.x : b.x + b.w) * S, b.z * S];
}

/** The turn that points the content's front (+z) from the spot toward the phone. */
export const faceYaw = (spot: Spot, cam: { x: number; z: number }) =>
  Math.atan2(cam.x - spot.x, cam.z - spot.z);

/** The placement that puts point `p` of the content on the floor spot, turned by `yaw`. */
export function placeAt(b: Box, p: ARPoint, spot: Spot, yaw: number): Placement {
  const [px, pz] = pointLocal(b, p);
  const [cx, cz] = pointLocal(b, 'centre');
  const [ox, oz] = turnXZ(cx - px, cz - pz, yaw);
  return { cx: spot.x + ox, cy: spot.y, cz: spot.z + oz, yaw };
}

/**
 * Room corner from two floor taps (ADR-214): `corner` is the room corner, `along` a spot on the floor along the wall
 * the back goes against. The back runs from the corner toward `along`, the front faces the phone's side of that line.
 * A wall running to the right (seen from the room) puts the back-left corner in the room corner, otherwise the
 * back-right. Null when the two taps are under 5 cm apart (no direction).
 */
export function cornerPlacement(
  b: Box,
  corner: Spot,
  along: Spot,
  cam: { x: number; z: number },
): { placement: Placement; point: ARPoint } | null {
  let ux = along.x - corner.x,
    uz = along.z - corner.z;
  const len = Math.hypot(ux, uz);
  if (len < 0.05) return null;
  ux /= len;
  uz /= len;
  // With the content's +x along u, its front (+z) points along (-uz, ux).
  const side = (cam.x - corner.x) * -uz + (cam.z - corner.z) * ux;
  if (side >= 0)
    return {
      placement: placeAt(b, 'back-left', corner, Math.atan2(-uz, ux)),
      point: 'back-left',
    };
  return {
    placement: placeAt(b, 'back-right', corner, Math.atan2(uz, -ux)),
    point: 'back-right',
  };
}

/** Moved by (dx, dz) metres along the content's own width (x) and depth (z) (ADR-215). */
export function nudge(pl: Placement, dx: number, dz: number): Placement {
  const [ox, oz] = turnXZ(dx, dz, pl.yaw);
  return { ...pl, cx: pl.cx + ox, cz: pl.cz + oz };
}

/** Turned by `a` radians about its centre; negative is clockwise seen from above (ADR-215). */
export const turnBy = (pl: Placement, a: number): Placement => ({ ...pl, yaw: pl.yaw + a });

/** The scene's position for a placement: the content's floor centre lands on (cx, cy, cz). */
export function scenePosition(b: Box, pl: Placement): [number, number, number] {
  const [cx, cz] = pointLocal(b, 'centre');
  const [ox, oz] = turnXZ(cx, cz, pl.yaw);
  return [pl.cx - ox, pl.cy - b.y * S, pl.cz - oz];
}

/** Where a content point (metres, its own frame) ends up in the world for a placement. */
export function toWorld(b: Box, pl: Placement, x: number, y: number, z: number): Spot {
  const [px, py, pz] = scenePosition(b, pl);
  const [ox, oz] = turnXZ(x, z, pl.yaw);
  return { x: px + ox, y: py + y, z: pz + oz };
}

// ---------------------------------------------------------------------------
// Floor detection (ADR-213)
// ---------------------------------------------------------------------------

/** A hit counts as floor when its surface's up axis is within this of vertical. */
export const FLOOR_TILT = (15 * Math.PI) / 180;
/** Floor frames in a row before the outline shows. */
export const STEADY_FRAMES = 6;
/** Largest height change between two floor frames that still counts as steady (metres). */
export const STEADY_HEIGHT = 0.03;
/** How far the outline moves toward each new hit (smoothing). */
export const SMOOTHING = 0.35;

/** True when a hit pose (column-major 4×4) faces up: its y axis is within `FLOOR_TILT` of vertical. */
export const isFloorPose = (m: ArrayLike<number>) => m[5] >= Math.cos(FLOOR_TILT);

export interface FloorTrack {
  count: number;
  y: number | null;
}
export const NO_FLOOR: FloorTrack = { count: 0, y: null };

/** The next floor track after a frame's floor height (`null`: no floor hit this frame). */
export function trackFloor(t: FloorTrack, y: number | null): FloorTrack {
  if (y === null) return NO_FLOOR;
  if (t.y === null || Math.abs(y - t.y) > STEADY_HEIGHT) return { count: 1, y };
  return { count: t.count + 1, y };
}
export const steady = (t: FloorTrack) => t.count >= STEADY_FRAMES;

// ---------------------------------------------------------------------------
// Grounding shadow (ADR-213) and dimensions (ADR-215)
// ---------------------------------------------------------------------------

/** How far the grounding shadow reaches past each side of the footprint (mm). */
export const SHADOW_MARGIN = 60;

/**
 * The grounding shadow's alpha, `n`×`n` RGBA (black), over the footprint plus `SHADOW_MARGIN` on each side: full
 * strength under the footprint, fading to nothing at the margin's edge.
 */
export function shadowPixels(w: number, d: number, n = 64, strength = 0.5): Uint8Array {
  const W = w + 2 * SHADOW_MARGIN,
    D = d + 2 * SHADOW_MARGIN;
  const px = new Uint8Array(n * n * 4);
  for (let j = 0; j < n; j++)
    for (let i = 0; i < n; i++) {
      const x = Math.abs(((i + 0.5) / n) * W - W / 2),
        z = Math.abs(((j + 0.5) / n) * D - D / 2);
      const out = Math.hypot(Math.max(x - w / 2, 0), Math.max(z - d / 2, 0));
      const t = Math.min(out / SHADOW_MARGIN, 1);
      const a = strength * (1 - t * t * (3 - 2 * t));
      px[(j * n + i) * 4 + 3] = Math.round(a * 255);
    }
  return px;
}

/** One dimension label: which size, its value in mm, where it stands (metres, the content's own frame). */
export interface DimLabel {
  key: 'w' | 'h' | 'd';
  mm: number;
  at: [number, number, number];
}

/**
 * The overall width, height and depth labels of what is shown (ADR-215): width along the front bottom edge, height
 * up the front left edge, depth along the left bottom edge, each a few cm off the content so it does not hide in it.
 */
export function dimensionLabels(b: Box): DimLabel[] {
  const off = 0.04;
  const x0 = b.x * S,
    y0 = b.y * S,
    z0 = b.z * S;
  const x1 = (b.x + b.w) * S,
    z1 = (b.z + b.d) * S;
  return [
    { key: 'w', mm: b.w, at: [(x0 + x1) / 2, y0 + off, z1 + off] },
    { key: 'h', mm: b.h, at: [x0 - off, (b.y + b.h / 2) * S, z1 + off] },
    { key: 'd', mm: b.d, at: [x0 - off, y0 + off, (z0 + z1) / 2] },
  ];
}
