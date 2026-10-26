/**
 * Snapping a dragged piece on the plan to its neighbours and to the walls (ADR-070). Connectors are derived from the
 * placed pieces and the room, never stored; the same drag always gives the same snap. A separate layer over the
 * ADR-065 drag: with snapping off (or Alt held) the UI uses `dragPosition` exactly as before.
 *
 * Compatibility rules are data in `compat.ts` (ADR-100): sides join sides, same placement kind, back to wall and the
 * family rule refuse a candidate; depth and height differences are allowed but named. Into an inside corner: the back
 * against one wall and a side against the other. A turned piece's faces are turned with it.
 */
import { evaluate, mountOf, type Mount } from './compat';
import {
  DRAG_STEP,
  dragPosition,
  isWallHung,
  placementBases,
  tapPosition,
  type PlacedPiece,
  type Project,
  type ProjectItem,
} from './project';
import type { Room } from './room';
import type { Box, Mm } from './types';

/** How close (mm) a connector must be to the dragged footprint to snap (ADR-070 open question: default 60). */
export const SNAP_RANGE: Mm = 60;

export type Axis = 'x' | 'z';
export { mountOf, type Mount };

/** A vertical face of a piece's footprint on the plan. */
export interface FaceConnector {
  owner: string;
  name: string;
  face: 'side' | 'back' | 'front';
  /** The room axis the face is perpendicular to, its coordinate there, and the way it points out of the piece. */
  axis: Axis;
  at: Mm;
  normal: 1 | -1;
  /** Its extent along the other plan axis. */
  lo: Mm;
  hi: Mm;
  mount: Mount;
  /** Size along the piece's facing (depth) and height, for the notes. */
  depth: Mm;
  height: Mm;
}

/** A wall of the room, pointing into the room. */
export interface WallConnector {
  wall: number;
  axis: Axis;
  at: Mm;
  normal: 1 | -1;
  lo: Mm;
  hi: Mm;
}

/** An inside corner of the room: two walls meeting at 90° seen from inside. */
export interface CornerConnector {
  walls: [number, number];
  x: Mm;
  z: Mm;
}

export interface Connectors {
  faces: FaceConnector[];
  walls: WallConnector[];
  corners: CornerConnector[];
}

/** The four faces of a placed footprint, turned with the piece. `box` overrides where the footprint is. */
export function pieceConnectors(
  pc: PlacedPiece,
  mount: Mount,
  box: Box = pc.bounds,
): FaceConnector[] {
  const b = box;
  const { axis, sign } = pc.facing;
  const other: Axis = axis === 'x' ? 'z' : 'x';
  const min = (a: Axis) => (a === 'x' ? b.x : b.z);
  const max = (a: Axis) => (a === 'x' ? b.x + b.w : b.z + b.d);
  const base = {
    owner: pc.item.id,
    name: pc.item.design.name,
    mount,
    depth: axis === 'z' ? b.d : b.w,
    height: b.h,
  };
  return [
    {
      ...base,
      face: 'front',
      axis,
      at: sign > 0 ? max(axis) : min(axis),
      normal: sign,
      lo: min(other),
      hi: max(other),
    },
    {
      ...base,
      face: 'back',
      axis,
      at: sign > 0 ? min(axis) : max(axis),
      normal: sign > 0 ? -1 : 1,
      lo: min(other),
      hi: max(other),
    },
    {
      ...base,
      face: 'side',
      axis: other,
      at: min(other),
      normal: -1,
      lo: min(axis),
      hi: max(axis),
    },
    { ...base, face: 'side', axis: other, at: max(other), normal: 1, lo: min(axis), hi: max(axis) },
  ];
}

/**
 * The walls and inside corners of a room. Without a room, the plan's back wall (z = 0, endless) is the one wall, as
 * the plan draws it.
 */
export function roomConnectors(room: Room | undefined): Pick<Connectors, 'walls' | 'corners'> {
  if (!room)
    return {
      walls: [{ wall: -1, axis: 'z', at: 0, normal: 1, lo: -Infinity, hi: Infinity }],
      corners: [],
    };
  const o = room.outline;
  const n = o.length;
  let area2 = 0;
  for (let i = 0; i < n; i++) {
    const [ax, az] = o[i],
      [bx, bz] = o[(i + 1) % n];
    area2 += ax * bz - bx * az;
  }
  if (n < 3 || area2 === 0) return { walls: [], corners: [] };
  const turn = Math.sign(area2);
  const dir = (i: number) => {
    const [ax, az] = o[i % n],
      [bx, bz] = o[(i + 1) % n];
    return [Math.sign(bx - ax), Math.sign(bz - az)] as const;
  };
  const walls: WallConnector[] = [];
  for (let i = 0; i < n; i++) {
    const [ax, az] = o[i],
      [bx, bz] = o[(i + 1) % n];
    const [dx, dz] = dir(i);
    if (dx === 0 && dz === 0) continue;
    // Inward normal: the direction turned a quarter towards the inside of the outline.
    if (dz === 0)
      walls.push({
        wall: i,
        axis: 'z',
        at: az,
        normal: (turn * dx) as 1 | -1,
        lo: Math.min(ax, bx),
        hi: Math.max(ax, bx),
      });
    else if (dx === 0)
      walls.push({
        wall: i,
        axis: 'x',
        at: ax,
        normal: (-turn * dz) as 1 | -1,
        lo: Math.min(az, bz),
        hi: Math.max(az, bz),
      });
  }
  const corners: CornerConnector[] = [];
  for (let i = 0; i < n; i++) {
    const p = (i - 1 + n) % n;
    const [ix, iz] = dir(p),
      [ox, oz] = dir(i);
    const cross = ix * oz - iz * ox;
    // Same turn as the outline: the corner is convex, so 90° seen from inside the room.
    if (cross !== 0 && Math.sign(cross) === turn)
      corners.push({ walls: [p, i], x: o[i][0], z: o[i][1] });
  }
  return { walls, corners };
}

/** Every connector of a project's plan: the faces of the given pieces and the room's walls and inside corners. */
export function connectorsOf(pieces: PlacedPiece[], room: Room | undefined): Connectors {
  return {
    faces: pieces.flatMap((pc) => pieceConnectors(pc, mountOf(pc.item))),
    ...roomConnectors(room),
  };
}

export interface Snapped {
  /** "Joins Base cabinet 600" · "Against wall 1" · "Into the corner of walls 1 and 2". */
  label: string;
  /** Allowed differences, named: "depth 560 vs 600". */
  notes: string[];
  kind: 'corner' | 'wall' | 'side';
}

export interface SnapResult {
  /** Where the piece lands: snapped axes exact to the connector (whole mm), others on the ADR-065 step. */
  position: ProjectItem['position'];
  /** Its footprint there, for the preview. */
  box: Box;
  snap: Snapped | null;
  /** With nothing to snap to: why the nearest connector was rejected. */
  hint: string | null;
  /**
   * Neighbours within range the family rule refused (ADR-100), named even when the piece snaps elsewhere:
   * "Won’t snap to Base cabinet: …". Nearest first.
   */
  refused: string[];
}

interface Move {
  x?: number;
  z?: number;
}
interface Cand {
  kind: Snapped['kind'];
  move: Move;
  dist: number;
  key: string;
  label: string;
  notes: string[];
  /** The wall a corner or wall candidate holds, so a corner can complete a wall snap. */
  walls?: number[];
  /** A side snap: the neighbour face, which the final footprint must still touch along it. */
  face?: FaceConnector;
}

/** A footprint moved on the plan. */
const shifted = (b: Box, dx: number, dz: number): Box => ({ ...b, x: b.x + dx, z: b.z + dz });
/** The footprint's extent along the axis a face runs along. */
const spanOf = (b: Box, face: FaceConnector) =>
  face.axis === 'x' ? { lo: b.z, hi: b.z + b.d } : { lo: b.x, hi: b.x + b.w };

const RANK: Record<Cand['kind'], number> = { corner: 0, wall: 1, side: 2 };
const overlap = (a: { lo: number; hi: number }, b: { lo: number; hi: number }) =>
  Math.min(a.hi, b.hi) - Math.max(a.lo, b.lo);
const distOf = (m: Move) => Math.abs(m.x ?? 0) + Math.abs(m.z ?? 0);
const cmp = (a: { dist: number; kind: Cand['kind']; key: string }, b: typeof a) =>
  a.dist - b.dist || RANK[a.kind] - RANK[b.kind] || (a.key < b.key ? -1 : a.key > b.key ? 1 : 0);
const wallName = (w: number) => (w < 0 ? 'the back wall' : `wall ${w + 1}`);

/**
 * Where a dragged piece lands with snapping on (ADR-070). `dx` / `dz` is the pointer's move in plan mm, as for
 * `dragPosition`. Candidates within `range` of the stepped drop are ranked by distance, then kind (corner, wall,
 * neighbour side), then id; when the best one fixes one axis only, the best candidate on the other axis is added.
 * Pieces resting on the dragged piece follow it and are not neighbours. Never throws; never clamps.
 */
export function snapDrag(
  project: Project,
  pieces: PlacedPiece[],
  id: string,
  dx: number,
  dz: number,
  range: Mm = SNAP_RANGE,
): SnapResult | null {
  const me = pieces.find((pc) => pc.item.id === id);
  if (!me) return null;
  const free = dragPosition(me.item, dx, dz, DRAG_STEP);
  const sx = free.x - me.item.position.x,
    sz = free.z - me.item.position.z;
  const at = (m: Move = {}): Box => shifted(me.bounds, sx + (m.x ?? 0), sz + (m.z ?? 0));
  // A dragged piece on another piece is lifted off (ADR-065): it joins as what it becomes.
  const mine: Mount =
    mountOf(me.item) === 'above'
      ? isWallHung(me.item.design)
        ? 'wall'
        : 'floor'
      : mountOf(me.item);
  const faces = pieceConnectors(me, mine, at());
  const allowed = new Set(placementBases(project, id).map((i) => i.id));
  const others = pieces.filter((pc) => allowed.has(pc.item.id));
  const conn = connectorsOf(others, project.room);

  const cands: Cand[] = [];
  const rejected: {
    dist: number;
    key: string;
    kind: Cand['kind'];
    text: string;
    /** Named even when the piece snaps elsewhere (ADR-100 `namedWhenSnapped`). */
    named?: boolean;
  }[] = [];
  const reject = (
    kind: Cand['kind'],
    dist: number,
    key: string,
    target: string,
    why: string,
    named = false,
  ) => rejected.push({ dist, key, kind, text: `Won’t snap to ${target}: ${why}.`, named });
  const itemById = new Map(others.map((pc) => [pc.item.id, pc.item]));

  for (const f of faces) {
    for (const n of conn.faces) {
      if (n.axis !== f.axis || n.normal !== -f.normal || overlap(f, n) <= 0) continue;
      const d = n.at - f.at;
      if (Math.abs(d) > range) continue;
      const key = `piece:${n.owner}`;
      // The compatibility rules (ADR-100), in table order: the first failed `refuse` rule removes the candidate.
      const found = evaluate('snap', {
        a: me.item,
        mountA: mine,
        faceA: f.face,
        b: itemById.get(n.owner)!,
        mountB: n.mount,
        faceB: n.face,
        depthA: f.depth,
        depthB: n.depth,
        heightA: f.height,
        heightB: n.height,
      });
      const refused = found.find((x) => x.rule.severity === 'refuse');
      if (refused) {
        reject('side', Math.abs(d), key, n.name, refused.message, refused.rule.namedWhenSnapped);
        continue;
      }
      // Depth and height differences are allowed but named (ADR-070); failed `warning` rules are named too.
      const notes = [
        ...new Set([
          ...(f.depth !== n.depth ? [`depth ${f.depth} vs ${n.depth}`] : []),
          ...(f.height !== n.height ? [`height ${f.height} vs ${n.height}`] : []),
          ...found.map((x) => x.message),
        ]),
      ];
      const move = f.axis === 'x' ? { x: d } : { z: d };
      cands.push({
        kind: 'side',
        move,
        dist: Math.abs(d),
        key,
        label: `Joins ${n.name}`,
        notes,
        face: n,
      });
    }
    for (const w of conn.walls) {
      if (w.axis !== f.axis || w.normal !== -f.normal || overlap(f, w) <= 0) continue;
      const d = w.at - f.at;
      if (Math.abs(d) > range) continue;
      const key = `wall:${String(w.wall).padStart(4, '0')}`;
      const refused = evaluate('snap', { a: me.item, mountA: mine, faceA: f.face }).find(
        (x) => x.rule.severity === 'refuse',
      );
      if (refused) {
        reject('wall', Math.abs(d), key, wallName(w.wall), refused.message);
        continue;
      }
      const move = f.axis === 'x' ? { x: d } : { z: d };
      cands.push({
        kind: 'wall',
        move,
        dist: Math.abs(d),
        key,
        label: `Against ${wallName(w.wall)}`,
        notes: [],
        walls: [w.wall],
      });
    }
  }
  const wallById = new Map(conn.walls.map((w) => [w.wall, w]));
  for (const c of conn.corners) {
    const [a, b] = c.walls.map((i) => wallById.get(i));
    if (!a || !b || a.axis === b.axis) continue;
    const fa = faces.find((f) => f.axis === a.axis && f.normal === -a.normal);
    const fb = faces.find((f) => f.axis === b.axis && f.normal === -b.normal);
    if (!fa || !fb) continue;
    const da = a.at - fa.at,
      db = b.at - fb.at;
    if (Math.abs(da) > range || Math.abs(db) > range) continue;
    const pair = [fa.face, fb.face].sort().join('+');
    if (pair !== 'back+side') continue;
    const move: Move = { [a.axis]: da, [b.axis]: db };
    cands.push({
      kind: 'corner',
      move,
      dist: distOf(move),
      key: `corner:${String(c.walls[0]).padStart(4, '0')}`,
      label: `Into the corner of walls ${c.walls[0] + 1} and ${c.walls[1] + 1}`,
      notes: [],
      walls: c.walls,
    });
  }

  const refused = [
    ...new Set(
      [...rejected]
        .filter((r) => r.named)
        .sort(cmp)
        .map((r) => r.text),
    ),
  ];
  if (!cands.length) {
    const near = [...rejected].sort(cmp)[0];
    return {
      position: free,
      box: at(),
      snap: null,
      hint: near ? near.text : `Nothing to snap to within ${range} mm.`,
      refused,
    };
  }
  const best = [...cands].sort(cmp)[0];
  let move = best.move;
  let label = best.label;
  let notes = best.notes;
  let kind = best.kind;
  const fixed: Axis[] = (['x', 'z'] as const).filter((a) => move[a] !== undefined);
  if (fixed.length === 1) {
    const otherAxis: Axis = fixed[0] === 'x' ? 'z' : 'x';
    // Single-axis candidates on the other axis, and corners that complete the same wall snap.
    const second = cands
      .filter((c) => {
        if (c.move[fixed[0]] === undefined) return c.move[otherAxis] !== undefined;
        return (
          c.kind === 'corner' &&
          c.move[fixed[0]] === move[fixed[0]] &&
          c.walls?.some((w) => best.walls?.includes(w))
        );
      })
      .map((c) => ({ ...c, dist: Math.abs(c.move[otherAxis] ?? 0) }))
      .sort(cmp)
      // Both moves together must still leave the piece touching a neighbour it joins.
      .find((c) => {
        const box = at({ ...move, [otherAxis]: c.move[otherAxis] });
        return [best, c].every((k) => !k.face || overlap(spanOf(box, k.face), k.face) > 0);
      });
    if (second) {
      move = { ...move, [otherAxis]: second.move[otherAxis] };
      if (second.kind === 'corner') {
        label = second.label;
        kind = 'corner';
      } else label = `${label} · ${second.label.replace(/^./, (s) => s.toLowerCase())}`;
      notes = [...notes, ...second.notes];
    }
  }
  const position = { ...free, x: free.x + (move.x ?? 0), z: free.z + (move.z ?? 0) };
  return { position, box: at(move), snap: { label, notes, kind }, hint: null, refused };
}

/**
 * Where a drop lands: snapped when `snap` is on (ADR-070), otherwise exactly the ADR-065 drop (`dragPosition`), with
 * no snap and no hint. Alt held while dragging is `snap: false`.
 */
export function dropTarget(
  project: Project,
  pieces: PlacedPiece[],
  id: string,
  dx: number,
  dz: number,
  snap: boolean,
  range: Mm = SNAP_RANGE,
): SnapResult | null {
  if (snap) return snapDrag(project, pieces, id, dx, dz, range);
  const me = pieces.find((pc) => pc.item.id === id);
  if (!me) return null;
  const position = dragPosition(me.item, dx, dz);
  const box = shifted(me.bounds, position.x - me.item.position.x, position.z - me.item.position.z);
  return { position, box, snap: null, hint: null, refused: [] };
}

/**
 * Where a new piece dragged from the piece list lands (ADR-094). `me` is the piece as `placeItem` builds it from
 * `makeItem` (any position): its left-back corner goes to the room point exactly as a tap places it (ADR-056,
 * `tapPosition`), then, with `snap` on, it snaps as a dragged piece does (ADR-070). Whole mm.
 */
export function dropNewPiece(
  project: Project,
  pieces: PlacedPiece[],
  me: PlacedPiece,
  at: { x: number; z: number },
  snap: boolean,
  range: Mm = SNAP_RANGE,
): SnapResult {
  const position = tapPosition(me.item, at.x, at.z);
  const item: ProjectItem = { ...me.item, position };
  const moved: PlacedPiece = {
    ...me,
    item,
    bounds: shifted(me.bounds, position.x - me.item.position.x, position.z - me.item.position.z),
  };
  const free: SnapResult = { position, box: moved.bounds, snap: null, hint: null };
  if (!snap) return free;
  const others = pieces.filter((pc) => pc.item.id !== item.id);
  const withMe: Project = {
    ...project,
    items: [...project.items.filter((i) => i.id !== item.id), item],
  };
  return snapDrag(withMe, [...others, moved], item.id, 0, 0, range) ?? free;
}
