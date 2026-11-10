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
const AR_POINTS: readonly ARPoint[] = ['centre', 'back-left', 'back-right'];
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
function turnXZ(x: number, z: number, yaw: number): [number, number] {
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
const FLOOR_TILT = (15 * Math.PI) / 180;
/** Floor frames in a row before the outline shows. */
const STEADY_FRAMES = 6;
/** Largest height change between two floor frames that still counts as steady (metres). */
const STEADY_HEIGHT = 0.03;
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
interface DimLabel {
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

// ---------------------------------------------------------------------------
// Walls, wall gap, drag, light and per-piece sizes (ADR-218)
// ---------------------------------------------------------------------------

/** A wall seen by a hit: a point on it and its face (unit, horizontal, pointing into the room). */
export interface Wall {
  x: number;
  z: number;
  nx: number;
  nz: number;
}

/** True when a hit pose's surface is a wall: its up axis (the surface normal) is within `FLOOR_TILT` of horizontal. */
export const isWallPose = (m: ArrayLike<number>) => Math.abs(m[5]) <= Math.sin(FLOOR_TILT);

/** The wall of a wall hit pose (column-major 4×4): its position and its face from the pose's y axis. */
export function wallOf(m: ArrayLike<number>): Wall {
  const len = Math.hypot(m[4], m[6]) || 1;
  return { x: m[12], z: m[14], nx: m[4] / len, nz: m[6] / len };
}

/** Two walls make a corner only when their faces differ by more than this. */
const CORNER_MIN_ANGLE = (60 * Math.PI) / 180;

/**
 * The room corner where two walls meet (ADR-218), at floor height `y`, with the wall the back goes against: the one
 * the phone faces more squarely. `along` is a floor spot 1 m from the corner along that wall, away from the other
 * wall, ready for `cornerPlacement`. Null when the walls are nearly parallel.
 */
export function wallsCorner(
  a: Wall,
  b: Wall,
  y: number,
  cam: { x: number; z: number },
): { corner: Spot; along: Spot } | null {
  const dot = a.nx * b.nx + a.nz * b.nz;
  if (dot > Math.cos(CORNER_MIN_ANGLE) || dot < -Math.cos(CORNER_MIN_ANGLE)) return null;
  // n_a · (p - a) = 0 and n_b · (p - b) = 0.
  const det = a.nx * b.nz - a.nz * b.nx;
  if (Math.abs(det) < 1e-9) return null;
  const ca = a.nx * a.x + a.nz * a.z,
    cb = b.nx * b.x + b.nz * b.z;
  const x = (ca * b.nz - a.nz * cb) / det,
    z = (a.nx * cb - ca * b.nx) / det;
  // The back wall is the one whose face points most toward the phone.
  const tx = cam.x - x,
    tz = cam.z - z;
  const tl = Math.hypot(tx, tz) || 1;
  const facing = (w: Wall) => (w.nx * tx + w.nz * tz) / tl;
  const [back, side] = facing(a) >= facing(b) ? [a, b] : [b, a];
  let dx = -back.nz,
    dz = back.nx;
  // Along the back wall, away from the side wall: the side wall's face points into the room, the same way.
  if (dx * side.nx + dz * side.nz < 0) {
    dx = -dx;
    dz = -dz;
  }
  return { corner: { x, y, z }, along: { x: x + dx, y, z: z + dz } };
}

/** Wall gap steps and limits (mm). */
export const GAP_STEP = 5;
export const GAP_MAX = 200;

/**
 * A corner placement moved off the walls by `gapMm` (ADR-218): forward from the back wall, and from the side wall
 * toward the content's middle (right for a back-left corner, left for a back-right one).
 */
export function withWallGap(pl: Placement, corner: ARPoint, gapMm: number): Placement {
  const g = gapMm * S;
  return nudge(pl, corner === 'back-right' ? -g : g, g);
}

/** One-finger drag (ADR-218): the placement moved by the finger's floor movement, its turn kept. */
export const dragTo = (start: Placement, from: Spot, to: Spot): Placement => ({
  ...start,
  cx: start.cx + to.x - from.x,
  cz: start.cz + to.z - from.z,
});

/** A WebXR light estimate, as far as it is used here. */
export interface LightEstimateLike {
  sphericalHarmonicsCoefficients: Float32Array | number[];
  primaryLightDirection: { x: number; y: number; z: number };
  primaryLightIntensity: { x: number; y: number; z: number };
}

/** The main light from an estimate, as three's XREstimatedLight sets it: colour scaled to 0–1, intensity the scale. */
export function mainLight(e: LightEstimateLike) {
  const i = e.primaryLightIntensity;
  const scale = Math.max(1, i.x, i.y, i.z);
  return {
    color: [i.x / scale, i.y / scale, i.z / scale] as [number, number, number],
    intensity: scale,
    direction: [
      e.primaryLightDirection.x,
      e.primaryLightDirection.y,
      e.primaryLightDirection.z,
    ] as [number, number, number],
  };
}

/** What the Sizes switch shows (ADR-218). */
export type ARSizes = 'overall' | 'piece' | 'off';
export const nextARSizes = (s: ARSizes): ARSizes =>
  s === 'overall' ? 'piece' : s === 'piece' ? 'off' : 'overall';

/** One shown piece: its box in the scene (mm) and its own size. */
export interface ARPiece {
  box: Box;
  w: number;
  h: number;
  d: number;
}

/** Per-piece labels: each piece's W × H × D, 6 cm above the middle of its top front edge (metres, content frame). */
export function pieceLabels(pieces: readonly ARPiece[]) {
  return pieces.map((p) => ({
    w: p.w,
    h: p.h,
    d: p.d,
    at: [(p.box.x + p.box.w / 2) * S, (p.box.y + p.box.h) * S + 0.06, (p.box.z + p.box.d) * S] as [
      number,
      number,
      number,
    ],
  }));
}
