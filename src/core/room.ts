/**
 * The room of a project (ADR-058, ADR-059): an outline of walls parallel to x or z, a height, and doors, windows
 * and obstacles. Whole millimetres; x along the back wall, z away from it (ADR-003). Pieces are checked against it:
 * outside the room or into an obstacle is an error; in a door's swing or above a window sill against its wall is a
 * warning. Optional on a project: absent = no room checks, as before.
 */
import type { Box, Diagnostic, Mm } from './types';

export type Pt = [Mm, Mm];

/** Starting height for a new room; the user sets their own (the field says so). */
export const DEFAULT_ROOM_HEIGHT = 2500;

export interface RoomFeature {
  id: string;
  kind: 'door' | 'window' | 'obstacle';
  /** Index of the wall (outline[i] → outline[i+1]); null = a free-standing obstacle on the floor at x, z. */
  wall: number | null;
  /** Distance from the wall's start corner to the opening or obstacle, along the wall. */
  from: Mm;
  width: Mm;
  /** Height above the floor where it starts (window sill, obstacle bottom); 0 for doors. */
  sill: Mm;
  height: Mm;
  /** How far an obstacle comes into the room (or its size along z on the floor). */
  depth: Mm;
  /** Free-standing obstacles: left-back corner. */
  x?: Mm;
  z?: Mm;
  label: string;
}

export interface Room {
  height: Mm;
  /** Corners in order; every wall is parallel to x or z (ADR-059). */
  outline: Pt[];
  features: RoomFeature[];
  /** The ready shape and sizes it was made from; absent once walls are drawn or edited one by one. */
  shape?: { kind: RoomShape; sizes: ShapeSizes };
}

export type RoomShape = 'rectangle' | 'l-shape' | 'u-shape' | 'alcove';
/** Shape sizes: width and depth of the room, then the cut-out (L), notch (U) or alcove: its width, depth and offset. */
export interface ShapeSizes {
  width: Mm;
  depth: Mm;
  cutWidth: Mm;
  cutDepth: Mm;
  offset: Mm;
}

export function shapeOutline(shape: RoomShape, s: ShapeSizes): Pt[] {
  const { width: W, depth: D, cutWidth: a, cutDepth: b, offset: o } = s;
  switch (shape) {
    case 'rectangle':
      return [
        [0, 0],
        [W, 0],
        [W, D],
        [0, D],
      ];
    case 'l-shape':
      return [
        [0, 0],
        [W, 0],
        [W, D - b],
        [W - a, D - b],
        [W - a, D],
        [0, D],
      ];
    case 'u-shape':
      return [
        [0, 0],
        [W, 0],
        [W, D],
        [o + a, D],
        [o + a, D - b],
        [o, D - b],
        [o, D],
        [0, D],
      ];
    case 'alcove':
      return [
        [0, 0],
        [o, 0],
        [o, -b],
        [o + a, -b],
        [o + a, 0],
        [W, 0],
        [W, D],
        [0, D],
      ];
  }
}

export const wallCount = (r: Room) => r.outline.length;
export function wallEnds(r: Room, i: number): [Pt, Pt] {
  const n = r.outline.length;
  return [r.outline[i % n], r.outline[(i + 1) % n]];
}
export function wallLength(r: Room, i: number): Mm {
  const [a, b] = wallEnds(r, i);
  return Math.abs(b[0] - a[0]) + Math.abs(b[1] - a[1]);
}

/** Point inside the outline or on a wall. */
export function inside(outline: Pt[], x: number, z: number): boolean {
  let inn = false;
  for (let i = 0, j = outline.length - 1; i < outline.length; j = i++) {
    const [xi, zi] = outline[i],
      [xj, zj] = outline[j];
    if (onSegment(x, z, xi, zi, xj, zj)) return true;
    if (zi > z !== zj > z && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) inn = !inn;
  }
  return inn;
}
function onSegment(x: number, z: number, x1: number, z1: number, x2: number, z2: number) {
  return (
    x >= Math.min(x1, x2) &&
    x <= Math.max(x1, x2) &&
    z >= Math.min(z1, z2) &&
    z <= Math.max(z1, z2) &&
    (x1 === x2 ? x === x1 : z === z1)
  );
}

/** A floor rectangle lies inside the room: corners inside and no wall passes through it. */
export function rectInside(outline: Pt[], x0: number, z0: number, x1: number, z1: number): boolean {
  if (
    ![
      [x0, z0],
      [x1, z0],
      [x1, z1],
      [x0, z1],
    ].every(([x, z]) => inside(outline, x, z))
  )
    return false;
  for (let i = 0; i < outline.length; i++) {
    const [ax, az] = outline[i],
      [bx, bz] = outline[(i + 1) % outline.length];
    if (ax === bx) {
      if (ax > x0 && ax < x1 && Math.max(az, bz) > z0 && Math.min(az, bz) < z1) return false;
    } else if (az > z0 && az < z1 && Math.max(ax, bx) > x0 && Math.min(ax, bx) < x1) return false;
  }
  return true;
}

/** Problems with the outline itself; room checks are skipped while there are any (ADR-008). */
export function outlineIssues(outline: Pt[]): string[] {
  const n = outline.length;
  if (n < 4) return ['A room needs at least four walls.'];
  const out: string[] = [];
  for (let i = 0; i < n; i++) {
    const [a, b] = [outline[i], outline[(i + 1) % n]];
    if (a[0] !== b[0] && a[1] !== b[1])
      out.push(
        `Wall ${i + 1} is not straight along the room: change another wall by ${Math.abs(b[0] - a[0])} or ${Math.abs(b[1] - a[1])} mm so the walls close square.`,
      );
    else if (a[0] === b[0] && a[1] === b[1]) out.push(`Wall ${i + 1} has no length.`);
  }
  if (out.length) return out;
  // Walls that are not neighbours must not touch or cross.
  for (let i = 0; i < n; i++)
    for (let j = i + 2; j < n; j++) {
      if (i === 0 && j === n - 1) continue;
      if (segmentsMeet(outline[i], outline[(i + 1) % n], outline[j], outline[(j + 1) % n])) {
        out.push(`Walls ${i + 1} and ${j + 1} cross.`);
        return out;
      }
    }
  return out;
}
function segmentsMeet(a: Pt, b: Pt, c: Pt, d: Pt) {
  const ax0 = Math.min(a[0], b[0]),
    ax1 = Math.max(a[0], b[0]),
    az0 = Math.min(a[1], b[1]),
    az1 = Math.max(a[1], b[1]);
  const cx0 = Math.min(c[0], d[0]),
    cx1 = Math.max(c[0], d[0]),
    cz0 = Math.min(c[1], d[1]),
    cz1 = Math.max(c[1], d[1]);
  return ax0 <= cx1 && cx0 <= ax1 && az0 <= cz1 && cz0 <= az1;
}

/** Unit direction of a wall and the normal pointing into the room. */
function frame(r: Room, i: number) {
  const [a, b] = wallEnds(r, i);
  const dx = Math.sign(b[0] - a[0]),
    dz = Math.sign(b[1] - a[1]);
  const len = wallLength(r, i);
  const mx = a[0] + (dx * len) / 2,
    mz = a[1] + (dz * len) / 2;
  let nx = -dz,
    nz = dx;
  if (!inside(r.outline, mx + nx, mz + nz)) {
    nx = -nx;
    nz = -nz;
  }
  return { a, dx, dz, nx, nz };
}

/** A box on a wall: `from`..`from + width` along it, `depth` into the room, `y0`..`y0 + h` high. */
export function wallBox(r: Room, i: number, from: Mm, width: Mm, depth: Mm, y0: Mm, h: Mm): Box {
  const { a, dx, dz, nx, nz } = frame(r, i);
  const p = [a[0] + dx * from, a[1] + dz * from],
    q = [p[0] + dx * width, p[1] + dz * width];
  const xs = [p[0], q[0], p[0] + nx * depth, q[0] + nx * depth],
    zs = [p[1], q[1], p[1] + nz * depth, q[1] + nz * depth];
  const x = Math.min(...xs),
    z = Math.min(...zs);
  return { x, y: y0, z, w: Math.max(...xs) - x, h, d: Math.max(...zs) - z };
}

/** The space a feature takes or keeps free: an obstacle's body, a door's swing (as deep as it is wide), a window strip. */
export function featureBox(r: Room, f: RoomFeature): Box | null {
  if (f.wall === null)
    return f.kind === 'obstacle'
      ? { x: f.x ?? 0, y: f.sill, z: f.z ?? 0, w: f.width, h: f.height, d: f.depth }
      : null;
  if (f.wall < 0 || f.wall >= r.outline.length) return null;
  if (f.kind === 'door') return wallBox(r, f.wall, f.from, f.width, f.width, 0, f.height);
  if (f.kind === 'window') return wallBox(r, f.wall, f.from, f.width, 50, f.sill, f.height);
  return wallBox(r, f.wall, f.from, f.width, f.depth, f.sill, f.height);
}

/**
 * A door's swing on the plan (ADR-058): hinged at the start of its opening, the leaf turns a quarter circle from
 * the wall into the room. `hinge`, the closed leaf end and the open leaf end are floor points (x, z); `sweep` is
 * the SVG arc direction from closed to open in plan coordinates (x right, z down).
 */
export function doorSwing(
  r: Room,
  f: RoomFeature,
): { hinge: Pt; closed: Pt; open: Pt; radius: Mm; sweep: 0 | 1 } | null {
  if (f.kind !== 'door' || f.wall === null || f.wall < 0 || f.wall >= r.outline.length) return null;
  const { a, dx, dz, nx, nz } = frame(r, f.wall);
  const hinge: Pt = [a[0] + dx * f.from, a[1] + dz * f.from];
  const closed: Pt = [hinge[0] + dx * f.width, hinge[1] + dz * f.width];
  const open: Pt = [hinge[0] + nx * f.width, hinge[1] + nz * f.width];
  return { hinge, closed, open, radius: f.width, sweep: dx * nz - dz * nx > 0 ? 1 : 0 };
}

/**
 * What the front view shows of the room (ADR-058): its x range and height, and the doors, windows and obstacles on
 * the back wall (a wall along x at the smallest z of the outline) at their x range and heights. Empty while the
 * outline has problems.
 */
export function roomFrontView(r: Room): {
  x0: Mm;
  x1: Mm;
  height: Mm;
  features: { id: string; kind: RoomFeature['kind']; label: string; x: Mm; w: Mm; y: Mm; h: Mm }[];
} | null {
  if (outlineIssues(r.outline).length) return null;
  const xs = r.outline.map((p) => p[0]);
  const minZ = Math.min(...r.outline.map((p) => p[1]));
  const back = r.outline
    .map((_, i) => i)
    .filter((i) => {
      const [a, b] = wallEnds(r, i);
      return a[1] === minZ && b[1] === minZ;
    });
  const features = r.features
    .filter((f) => f.wall !== null && back.includes(f.wall))
    .map((f) => {
      const b = wallBox(r, f.wall!, f.from, f.width, 0, 0, 0);
      const y = f.kind === 'door' ? 0 : f.sill;
      return { id: f.id, kind: f.kind, label: f.label, x: b.x, w: b.w, y, h: f.height };
    });
  return { x0: Math.min(...xs), x1: Math.max(...xs), height: r.height, features };
}

export const NEAR_WALL = 50;

const boxesOverlap = (a: Box, b: Box) =>
  a.x < b.x + b.w &&
  b.x < a.x + a.w &&
  a.y < b.y + b.h &&
  b.y < a.y + a.h &&
  a.z < b.z + b.d &&
  b.z < a.z + a.d;

/**
 * Check pieces (their footprint `bounds` and a panel test) against the room. `hitsPanels` says whether any panel of a
 * piece enters a box. Returns diagnostics and the obstacles for the opening-clearance check (ADR-057).
 */
export function roomChecks(
  room: Room,
  pieces: {
    id: string;
    name: string;
    bounds: Box;
    hitsPanels: (b: Box) => boolean;
    clearances: { label: string; box: Box; need: Mm }[];
  }[],
): {
  diagnostics: Diagnostic[];
  obstacles: { label: string; box: Box }[];
  clearanceIssues: Diagnostic[];
} {
  const diagnostics: Diagnostic[] = [];
  const bad = outlineIssues(room.outline);
  if (bad.length)
    return {
      diagnostics: bad.map((m) => ({
        severity: 'error',
        code: 'room-outline',
        message: `Room: ${m}`,
      })),
      obstacles: [],
      clearanceIssues: [],
    };
  const obstacles: { label: string; box: Box }[] = [];
  for (const f of room.features) {
    const b = featureBox(room, f);
    if (!b) {
      diagnostics.push({
        severity: 'error',
        code: 'room-feature',
        message: `${f.label} is on a wall the room does not have.`,
      });
      continue;
    }
    if (f.wall !== null) {
      const len = wallLength(room, f.wall);
      if (f.from + f.width > len)
        diagnostics.push({
          severity: 'error',
          code: 'room-feature',
          message: `${f.label} runs ${f.from + f.width - len} mm past the end of wall ${f.wall + 1} (${len} mm long): move it or make it narrower.`,
        });
    } else if (!rectInside(room.outline, b.x, b.z, b.x + b.w, b.z + b.d))
      diagnostics.push({
        severity: 'error',
        code: 'room-feature',
        message: `${f.label} is outside the room: move it inside the walls.`,
      });
    if (f.kind === 'obstacle') obstacles.push({ label: f.label, box: b });
  }
  const clearanceIssues: Diagnostic[] = [];
  for (const pc of pieces) {
    const b = pc.bounds;
    if (!rectInside(room.outline, b.x, b.z, b.x + b.w, b.z + b.d))
      diagnostics.push({
        severity: 'error',
        code: 'outside-room',
        message: `${pc.name} is outside the room (through a wall).`,
        nodeId: pc.id,
      });
    else if (b.y + b.h > room.height)
      diagnostics.push({
        severity: 'error',
        code: 'outside-room',
        message: `${pc.name} is ${b.y + b.h - room.height} mm taller than the room.`,
        nodeId: pc.id,
      });
    for (const f of room.features) {
      const fb = featureBox(room, f);
      if (!fb) continue;
      if (f.kind === 'obstacle' && boxesOverlap(b, fb) && pc.hitsPanels(fb))
        diagnostics.push({
          severity: 'error',
          code: 'hits-obstacle',
          message: `${pc.name} runs into ${f.label}.`,
          nodeId: pc.id,
        });
      if (f.kind === 'door' && boxesOverlap(b, fb) && pc.hitsPanels(fb))
        diagnostics.push({
          severity: 'warning',
          code: 'blocks-door',
          message: `${pc.name} is in the way of ${f.label} (it needs ${f.width} mm to swing).`,
          nodeId: pc.id,
        });
      if (f.kind === 'window' && f.wall !== null) {
        const strip = wallBox(room, f.wall, f.from, f.width, NEAR_WALL, 0, room.height);
        if (boxesOverlap(b, strip) && b.y + b.h > f.sill)
          diagnostics.push({
            severity: 'warning',
            code: 'covers-window',
            message: `${pc.name} covers the window ${f.label}: it stands against its wall and is ${b.y + b.h - f.sill} mm higher than its sill.`,
            nodeId: pc.id,
          });
      }
    }
    // Opening clearances that reach through a wall (ADR-057).
    for (const c of pc.clearances) {
      const cb = c.box;
      if (!rectInside(room.outline, cb.x, cb.z, cb.x + cb.w, cb.z + cb.d))
        clearanceIssues.push({
          severity: 'warning',
          code: 'opening-blocked',
          message: `${c.label} of ${pc.name} cannot open fully: it hits a wall (needs ${c.need} mm).`,
          nodeId: pc.id,
        });
    }
  }
  return { diagnostics, obstacles, clearanceIssues };
}

/**
 * Change one wall's length by stretching the room: every corner at or beyond the wall's far end (along the wall's
 * direction) moves by the difference, so the walls stay square and closed.
 */
export function setWallLength(r: Room, i: number, length: Mm): Room {
  const [a, b] = wallEnds(r, i);
  const axis = a[0] !== b[0] ? 0 : 1;
  const dir = Math.sign(b[axis] - a[axis]);
  const delta = length - wallLength(r, i);
  if (!delta || length <= 0) return r;
  const end = b[axis];
  const outline = r.outline.map((p): Pt => {
    if (dir > 0 ? p[axis] < end : p[axis] > end) return p;
    const q: Pt = [p[0], p[1]];
    q[axis] += dir * delta;
    return q;
  });
  const { shape: _s, ...rest } = r;
  void _s;
  return { ...rest, outline };
}

/** Next corner while drawing: the new wall runs along x or z (the longer way), snapped to `step` mm. */
export function snapCorner(prev: Pt | undefined, x: number, z: number, step = 10, first?: Pt): Pt {
  const s = (v: number) => Math.round(v / step) * step || 0;
  if (!prev) return [s(x), s(z)];
  // Within 50 mm of the first corner's line, the wall ends on it, so the room closes square.
  const near = (v: number, k: 0 | 1) =>
    first && Math.abs(v - first[k]) <= CLOSE_SNAP ? first[k] : s(v);
  return Math.abs(x - prev[0]) >= Math.abs(z - prev[1])
    ? [near(x, 0), prev[1]]
    : [prev[0], near(z, 1)];
}
export const CLOSE_SNAP = 50;

/** Close a drawn outline: when the last corner does not line up with the first, one corner is added to square it. */
export function closeOutline(points: Pt[]): Pt[] {
  if (points.length < 3) return points;
  const first = points[0],
    last = points[points.length - 1];
  if (last[0] === first[0] || last[1] === first[1]) return points;
  const prev = points[points.length - 2];
  // Carry on in the last wall's direction to line up with the first corner, then turn to it.
  const extra: Pt = prev[1] === last[1] ? [first[0], last[1]] : [last[0], first[1]];
  return [...points, extra];
}

const isObj = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === 'object' && !Array.isArray(v);
const isInt = (v: unknown, min = -1e7) =>
  typeof v === 'number' && Number.isSafeInteger(v) && v >= min && v <= 1e7;

export function validateRoom(r: unknown): string[] {
  if (!isObj(r)) return ['Invalid room'];
  const errs: string[] = [];
  if (!isInt(r.height, 1)) errs.push('Room height must be whole mm');
  if (
    !Array.isArray(r.outline) ||
    r.outline.length < 4 ||
    !r.outline.every((p) => Array.isArray(p) && p.length === 2 && isInt(p[0]) && isInt(p[1]))
  )
    errs.push('Room outline must be at least four whole-mm corners');
  if (!Array.isArray(r.features)) errs.push('Room features missing');
  else
    for (const f of r.features) {
      if (
        !isObj(f) ||
        typeof f.id !== 'string' ||
        !['door', 'window', 'obstacle'].includes(f.kind as string) ||
        typeof f.label !== 'string' ||
        !(f.wall === null || isInt(f.wall, 0)) ||
        !isInt(f.from, 0) ||
        !isInt(f.width, 1) ||
        !isInt(f.sill, 0) ||
        !isInt(f.height, 1) ||
        !isInt(f.depth, 0) ||
        (f.x !== undefined && !isInt(f.x)) ||
        (f.z !== undefined && !isInt(f.z))
      )
        errs.push('Invalid room feature');
    }
  if (
    r.shape !== undefined &&
    !(
      isObj(r.shape) &&
      ['rectangle', 'l-shape', 'u-shape', 'alcove'].includes(r.shape.kind as string) &&
      isObj(r.shape.sizes) &&
      ['width', 'depth', 'cutWidth', 'cutDepth', 'offset'].every((k) =>
        isInt((r.shape as { sizes: Record<string, unknown> }).sizes[k], 0),
      )
    )
  )
    errs.push('Invalid room shape');
  return errs;
}

/**
 * Walls for the 3D view (ADR-058): thin boxes just outside the outline, full room height, with door and window
 * openings left as gaps; obstacles as their own boxes. Display only.
 */
export function roomDisplayBoxes(r: Room, thick = 20): { walls: Box[]; obstacles: Box[] } {
  if (outlineIssues(r.outline).length) return { walls: [], obstacles: [] };
  const walls: Box[] = [];
  for (let i = 0; i < r.outline.length; i++) {
    const len = wallLength(r, i);
    const open = r.features
      .filter((f) => f.wall === i && f.kind !== 'obstacle')
      .map((f) => ({
        a: Math.max(0, f.from),
        b: Math.min(len, f.from + f.width),
        y0: f.kind === 'door' ? 0 : f.sill,
        y1: (f.kind === 'door' ? 0 : f.sill) + f.height,
      }))
      .filter((o) => o.b > o.a)
      .sort((p, q) => p.a - q.a);
    let at = 0;
    const seg = (a: number, b: number, y0: number, y1: number) => {
      if (b > a && y1 > y0) walls.push(wallBox(r, i, a, b - a, -thick, y0, y1 - y0));
    };
    for (const o of open) {
      seg(at, o.a, 0, r.height);
      seg(o.a, o.b, 0, o.y0);
      seg(o.a, o.b, o.y1, r.height);
      at = Math.max(at, o.b);
    }
    seg(at, len, 0, r.height);
  }
  const obstacles = r.features
    .filter((f) => f.kind === 'obstacle')
    .map((f) => featureBox(r, f))
    .filter((b): b is Box => !!b);
  return { walls, obstacles };
}
