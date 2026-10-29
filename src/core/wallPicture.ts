/**
 * Fitted and straightened wall pictures (ADR-146). A wall picture covers one rectangle of its wall once (`fit`, or
 * the whole wall); seen from inside the room, `x` runs from the wall's left end and `y` up from the floor. A photo
 * taken at an angle is straightened by a projective (perspective) map from the wall's four corners in the photo onto
 * that rectangle. Pure: the viewer turns a pointer into a ray, this module turns it into a wall point and a dragged
 * rectangle (whole mm, edges snapping to the wall ends, floor and ceiling as pieces snap to walls, ADR-070).
 */
import { t } from './i18n';
import { MAX_REACH, type Ray } from './drag3d';
import {
  wallEnds,
  wallInward,
  wallLength,
  type Pt,
  type Room,
  type WallImage,
  type WallRect,
} from './room';
import { SNAP_RANGE } from './snap';
import { MAX_TILE } from './surface';
import type { Box, Mm } from './types';

/** Photo corners are stored in ten-thousandths of the photo's width and height (ADR-146). */
export const PHOTO_UNITS = 10_000;

/** The whole wall: wall length × room height from its left end and the floor. */
export const wholeWall = (r: Room, i: number): WallRect => ({
  x: 0,
  y: 0,
  w: wallLength(r, i),
  h: r.height,
});

/** The rectangle a wall picture covers: its `fit`, or the whole wall (also for pictures saved before ADR-146). */
export const pictureRect = (r: Room, i: number, img: WallImage): WallRect =>
  img.fit ?? wholeWall(r, i);

/** "From left 0 · From floor 0 · W 3000 × H 2500 mm" */
export const rectLabel = (f: WallRect) =>
  t('From left {x} · From floor {y} · W {w} × H {h} mm', { x: f.x, y: f.y, w: f.w, h: f.h });

/**
 * Wall `i` seen from inside the room: its left end on the plan, the unit step to the right along it and the unit
 * step into the room.
 */
export function wallAxes(r: Room, i: number): { left: Pt; right: Pt; inward: Pt } {
  const [nx, nz] = wallInward(r, i);
  const right: Pt = [nz + 0, -nx + 0];
  const [a, b] = wallEnds(r, i);
  const along = (p: Pt) => p[0] * right[0] + p[1] * right[1];
  return { left: along(a) <= along(b) ? a : b, right, inward: [nx, nz] };
}

/** The plan point `u` mm from wall `i`'s left end. */
export function wallToRoom(r: Room, i: number, u: number): [number, number] {
  const { left, right } = wallAxes(r, i);
  return [left[0] + right[0] * u, left[1] + right[1] * u];
}

/** The stretch of wall `i` a wall box of `roomDisplayBoxes` covers, in wall coordinates. */
export function boxSpan(
  r: Room,
  i: number,
  b: Box,
): { u0: number; u1: number; y0: number; y1: number } {
  const { left, right } = wallAxes(r, i);
  const u = (x: number, z: number) => (x - left[0]) * right[0] + (z - left[1]) * right[1];
  const [p, q] = right[0] !== 0 ? [u(b.x, 0), u(b.x + b.w, 0)] : [u(0, b.z), u(0, b.z + b.d)];
  return { u0: Math.min(p, q), u1: Math.max(p, q), y0: b.y, y1: b.y + b.h };
}

/** A part of a wall span: wall coordinates, and with a picture where in it (0–1 across, 0–1 up). */
export interface WallPatch {
  u0: number;
  u1: number;
  y0: number;
  y1: number;
  picture?: { s0: number; s1: number; t0: number; t1: number };
}

/**
 * A wall span split into the part the picture covers (with its picture coordinates) and up to four parts around it
 * (the picture's average colour). Without a picture rectangle the span stays whole.
 */
export function splitSpan(
  span: { u0: number; u1: number; y0: number; y1: number },
  rect: WallRect | null,
): WallPatch[] {
  if (!rect) return [span];
  const { u0, u1, y0, y1 } = span;
  const a = Math.max(u0, rect.x),
    b = Math.min(u1, rect.x + rect.w),
    c = Math.max(y0, rect.y),
    d = Math.min(y1, rect.y + rect.h);
  if (!(b > a && d > c)) return [span];
  const parts: WallPatch[] = [
    {
      u0: a,
      u1: b,
      y0: c,
      y1: d,
      picture: {
        s0: (a - rect.x) / rect.w,
        s1: (b - rect.x) / rect.w,
        t0: (c - rect.y) / rect.h,
        t1: (d - rect.y) / rect.h,
      },
    },
  ];
  if (a > u0) parts.push({ u0, u1: a, y0, y1 });
  if (u1 > b) parts.push({ u0: b, u1, y0, y1 });
  if (c > y0) parts.push({ u0: a, u1: b, y0, y1: c });
  if (y1 > d) parts.push({ u0: a, u1: b, y0: d, y1 });
  return parts;
}

/**
 * Where a ray meets the plane of wall `i` (its room-side face), in wall coordinates, or null when it runs along it,
 * points away or lands farther than `reach`. Never throws.
 */
export function wallPlanePoint(
  ray: Ray,
  r: Room,
  i: number,
  reach: Mm = MAX_REACH,
): { u: number; y: number } | null {
  const { left, right, inward } = wallAxes(r, i);
  const [ox, oy, oz] = ray.origin;
  const [dx, dy, dz] = ray.dir;
  const len = Math.hypot(dx, dy, dz);
  const den = dx * inward[0] + dz * inward[1];
  if (![ox, oy, oz, dx, dy, dz].every(Number.isFinite) || len === 0 || den === 0) return null;
  const t = ((left[0] - ox) * inward[0] + (left[1] - oz) * inward[1]) / den;
  if (!(t > 0) || t * len > reach) return null;
  const x = ox + dx * t,
    z = oz + dz * t;
  return { u: (x - left[0]) * right[0] + (z - left[1]) * right[1], y: oy + dy * t };
}

/** What a drag on a wall picture moves: the whole picture, or one edge or corner (n = top, s = bottom). */
export type PictureHandle = 'move' | 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw';

/** `v` moved onto the nearest of `targets` within `range`, or left as is. */
const snapTo = (v: number, targets: number[], range: number) => {
  let best = v,
    gap = range;
  for (const t of targets)
    if (Math.abs(t - v) <= gap) {
      gap = Math.abs(t - v);
      best = t;
    }
  return best;
};
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/**
 * The picture rectangle after dragging `handle` by `du` (along the wall) and `dy` (up) mm from `start`: whole mm, at
 * least 1 mm, stretched freely. With `snap`, a moved edge within `range` of the wall's ends (0, `len`), the floor (0)
 * or the ceiling (`height`) lands on it; moving the whole picture snaps whichever of its edges is nearest.
 */
export function dragPicture(
  start: WallRect,
  handle: PictureHandle,
  du: number,
  dy: number,
  wall: { len: Mm; height: Mm },
  snap: boolean,
  range: Mm = SNAP_RANGE,
): WallRect {
  const xs = [0, wall.len],
    ys = [0, wall.height];
  const rng = snap ? range : -1;
  if (handle === 'move') {
    const x = start.x + du,
      y = start.y + dy;
    // The shortest step that lands one of the picture's edges on a target within range; 0 when none is.
    const shift = (edges: number[], targets: number[]) => {
      let best: number | null = null;
      for (const e of edges)
        for (const tg of targets)
          if (Math.abs(tg - e) <= rng && (best === null || Math.abs(tg - e) < Math.abs(best)))
            best = tg - e;
      return best ?? 0;
    };
    return {
      x: clamp(Math.round(x + shift([x, x + start.w], xs)), -MAX_TILE, MAX_TILE),
      y: clamp(Math.round(y + shift([y, y + start.h], ys)), -MAX_TILE, MAX_TILE),
      w: start.w,
      h: start.h,
    };
  }
  let l = start.x,
    r = start.x + start.w,
    b = start.y,
    t = start.y + start.h;
  if (handle.includes('w')) l = Math.round(snapTo(l + du, xs, rng));
  if (handle.includes('e')) r = Math.round(snapTo(r + du, xs, rng));
  if (handle.includes('s')) b = Math.round(snapTo(b + dy, ys, rng));
  if (handle.includes('n')) t = Math.round(snapTo(t + dy, ys, rng));
  // An edge dragged past the opposite one stops 1 mm short of it.
  if (handle.includes('w')) l = Math.min(l, r - 1);
  if (handle.includes('e')) r = Math.max(r, l + 1);
  if (handle.includes('s')) b = Math.min(b, t - 1);
  if (handle.includes('n')) t = Math.max(t, b + 1);
  l = clamp(l, -MAX_TILE, MAX_TILE - 1);
  b = clamp(b, -MAX_TILE, MAX_TILE - 1);
  return { x: l, y: b, w: clamp(r - l, 1, MAX_TILE), h: clamp(t - b, 1, MAX_TILE) };
}

/** A 3 × 3 projective map, row by row. */
export type Homography = [number, number, number, number, number, number, number, number, number];

/**
 * The projective map of the unit square onto quadrilateral `q`: (0,0) → q[0], (1,0) → q[1], (1,1) → q[2],
 * (0,1) → q[3] (Heckbert's square-to-quad). Null for a degenerate quadrilateral.
 */
export function squareToQuad(q: [Pt, Pt, Pt, Pt]): Homography | null {
  const [[x0, y0], [x1, y1], [x2, y2], [x3, y3]] = q;
  const sx = x0 - x1 + x2 - x3,
    sy = y0 - y1 + y2 - y3;
  if (sx === 0 && sy === 0) return [x1 - x0, x3 - x0, x0, y1 - y0, y3 - y0, y0, 0, 0, 1];
  const dx1 = x1 - x2,
    dx2 = x3 - x2,
    dy1 = y1 - y2,
    dy2 = y3 - y2;
  const den = dx1 * dy2 - dx2 * dy1;
  if (den === 0) return null;
  const g = (sx * dy2 - dx2 * sy) / den,
    h = (dx1 * sy - sx * dy1) / den;
  return [x1 - x0 + g * x1, x3 - x0 + h * x3, x0, y1 - y0 + g * y1, y3 - y0 + h * y3, y0, g, h, 1];
}

/** `m` applied to (x, y), or null at infinity. */
export function project(m: Homography, x: number, y: number): [number, number] | null {
  const w = m[6] * x + m[7] * y + m[8];
  if (w === 0 || !Number.isFinite(w)) return null;
  return [(m[0] * x + m[1] * y + m[2]) / w, (m[3] * x + m[4] * y + m[5]) / w];
}

/**
 * For a straightened picture: the map from the straightened picture (0–1 across from the left, 0–1 down from the
 * top) to the photo (0–1 of its width and height from its top-left corner), or null for corners that do not make a
 * quadrilateral.
 */
export function straightenMap(corners: [Pt, Pt, Pt, Pt]): Homography | null {
  const [bl, br, tr, tl] = corners.map(([x, y]) => [x / PHOTO_UNITS, y / PHOTO_UNITS] as Pt);
  return squareToQuad([tl, tr, br, bl]);
}

/** Corners a new straightening starts from: a tenth in from each side of the photo. */
export const DEFAULT_CORNERS: [Pt, Pt, Pt, Pt] = [
  [1000, 9000],
  [9000, 9000],
  [9000, 1000],
  [1000, 1000],
];
