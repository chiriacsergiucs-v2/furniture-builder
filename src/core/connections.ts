/**
 * Stored connections between pieces (ADR-168, research "connection hierarchy"): a snap or the Connected toggle records
 * that two pieces are joined. Since ADR-207 a connection has a kind: **side** (side by side, ADR-168), **corner** (two
 * pieces turned a quarter apart meeting at an edge), **stacked** (one piece over another) and **wall** (a piece's back
 * against one wall of the room, made with Against the wall). An absent kind is a side connection. Each kind is
 * re-checked on every build — its position, and the refusing compatibility rules that run on that join (ADR-100,
 * `CompatRule.joins`) — and warned about when it no longer holds. Pieces connected to each other move together, as
 * grouped pieces do (ADR-148); a wall-connected piece slides along its wall. Pure: documents in, documents out.
 */
import { t } from './i18n';
import { newId } from './design';
import { evaluate, mountOf, sideJoin, touchSideBySide, type JoinKind } from './compat';
import { carryGroups } from './groupMove';
import { groupOf } from './selection';
import { pieceName, placeItem, type MoveResult, type PlacedPiece, type Project } from './project';
import { wallEnds, wallInward } from './room';
import type { Box, Diagnostic } from './types';

/** The kind of a connection (ADR-207). */
export type ConnectionKind = JoinKind;

export interface Connection {
  id: string;
  /** ADR-207 (project schemaVersion 21); absent = side. */
  kind?: ConnectionKind;
  /**
   * The two pieces, in the order they were connected. A wall connection holds its one piece, written twice so every
   * connection keeps the same shape.
   */
  itemIds: [string, string];
  /** A wall connection's wall: the index of `room.outline` (wall i runs from corner i to corner i + 1). */
  wall?: number;
}

/** The kinds two pieces can be connected by; a wall connection holds one piece. */
export const PAIR_KINDS: readonly ConnectionKind[] = ['side', 'corner', 'stacked'];

export const kindOf = (c: Pick<Connection, 'kind'>): ConnectionKind => c.kind ?? 'side';

/** The connection's two pieces, or null for a wall connection. */
export function pairOf(c: Connection): [string, string] | null {
  return kindOf(c) !== 'wall' ? [c.itemIds[0], c.itemIds[1]] : null;
}

const pairKey = (a: string, b: string) => (a < b ? `${a}|${b}` : `${b}|${a}`);
/** One record per pair, and per piece and wall. */
const keyOf = (c: Connection) => {
  const pair = pairOf(c);
  return pair ? pairKey(pair[0], pair[1]) : `wall:${c.itemIds[0]}:${c.wall ?? -1}`;
};

/** The stored connection between `a` and `b`, if any (of any kind but wall). */
export const connectionOf = (project: Project, a: string, b: string): Connection | undefined =>
  project.connections?.find((c) => {
    const pair = pairOf(c);
    return !!pair && pairKey(pair[0], pair[1]) === pairKey(a, b);
  });

export const isConnected = (project: Project, a: string, b: string) =>
  !!connectionOf(project, a, b);

/** The ids connected to `id` (not walls), in connection order. */
export function connectedTo(project: Project, id: string): string[] {
  const out: string[] = [];
  for (const c of project.connections ?? []) {
    const pair = pairOf(c);
    if (!pair) continue;
    if (pair[0] === id && !out.includes(pair[1])) out.push(pair[1]);
    if (pair[1] === id && !out.includes(pair[0])) out.push(pair[0]);
  }
  return out;
}

/** The walls `id` is connected against (ADR-207), in connection order. */
export const wallsOf = (project: Project, id: string): number[] =>
  (project.connections ?? [])
    .filter((c) => kindOf(c) === 'wall' && c.itemIds[0] === id && c.wall !== undefined)
    .map((c) => c.wall!);

/** What `id` is connected to, each with its kind: another piece (`other`) or a wall (`wall`). For the card. */
export function connectionsOf(
  project: Project,
  id: string,
): { kind: ConnectionKind; other?: string; wall?: number }[] {
  const out: { kind: ConnectionKind; other?: string; wall?: number }[] = [];
  for (const c of project.connections ?? []) {
    const pair = pairOf(c);
    if (pair && (pair[0] === id || pair[1] === id))
      out.push({ kind: kindOf(c), other: pair[0] === id ? pair[1] : pair[0] });
    else if (!pair && c.itemIds[0] === id && c.wall !== undefined)
      out.push({ kind: 'wall', wall: c.wall });
  }
  return out;
}

/** A kind in words, for the card ("side by side", "in the corner", "stacked", "against wall 2"). */
export function kindName(kind: ConnectionKind, wall?: number): string {
  switch (kind) {
    case 'corner':
      return t('in the corner');
    case 'stacked':
      return t('stacked');
    case 'wall':
      return t('against wall {n}', { n: (wall ?? 0) + 1 });
    default:
      return t('side by side');
  }
}

const findPiece = (project: Project, id: string, pieces?: readonly PlacedPiece[]) => {
  const pc = pieces?.find((x) => x.item.id === id);
  if (pc) return pc;
  const it = project.items.find((i) => i.id === id);
  return it ? placeItem(it) : undefined;
};

const spanOver = (a0: number, a1: number, b0: number, b1: number) =>
  Math.min(a1, b1) - Math.max(a0, b0) > 0;
const heightsOverlap = (A: Box, B: Box) => spanOver(A.y, A.y + A.h, B.y, B.y + B.h);
const planOverlap = (A: Box, B: Box) =>
  spanOver(A.x, A.x + A.w, B.x, B.x + B.w) && spanOver(A.z, A.z + A.d, B.z, B.z + B.d);

/**
 * Two pieces meet in a corner (ADR-207): turned a quarter apart (one faces along x, the other along z), neither at an
 * extra angle, their plan outlines sharing an edge and their heights overlapping.
 */
export function meetInCorner(a: PlacedPiece, b: PlacedPiece): boolean {
  if (a.item.angle || b.item.angle || a.facing.axis === b.facing.axis) return false;
  const A = a.bounds,
    B = b.bounds;
  if (!heightsOverlap(A, B)) return false;
  const xTouch = A.x + A.w === B.x || B.x + B.w === A.x;
  const zTouch = A.z + A.d === B.z || B.z + B.d === A.z;
  return (
    (xTouch && spanOver(A.z, A.z + A.d, B.z, B.z + B.d)) ||
    (zTouch && spanOver(A.x, A.x + A.w, B.x, B.x + B.w))
  );
}

/**
 * One piece is over the other (ADR-207): it is placed on it (`above`), or it is a wall unit whose plan outline
 * overlaps the floor piece's and whose underside is at or above that piece's top.
 */
export function isStacked(a: PlacedPiece, b: PlacedPiece): boolean {
  const on = (x: PlacedPiece, y: PlacedPiece) =>
    x.item.placement?.kind === 'above' && x.item.placement.baseId === y.item.id;
  const over = (w: PlacedPiece, f: PlacedPiece) =>
    mountOf(w.item) === 'wall' &&
    mountOf(f.item) === 'floor' &&
    planOverlap(w.bounds, f.bounds) &&
    w.bounds.y >= f.bounds.y + f.bounds.h;
  return on(a, b) || on(b, a) || over(a, b) || over(b, a);
}

/** Whether two placed pieces are in the position of `kind`; null when they are, else why not. */
function placedAs(kind: ConnectionKind, a: PlacedPiece, b: PlacedPiece): string | null {
  const names = { a: a.item.design.name, b: b.item.design.name };
  if (kind === 'corner')
    return meetInCorner(a, b) ? null : t('{a} and {b} do not meet in a corner.', names);
  if (kind === 'stacked')
    return isStacked(a, b) ? null : t('{a} and {b} are not one over the other.', names);
  return touchSideBySide(a, b) ? null : t('{a} and {b} do not stand side by side.', names);
}

/** The refusing rules that run on this kind of join (ADR-100, `CompatRule.joins`); null when none fails. */
function refusedAs(kind: ConnectionKind, a: PlacedPiece, b: PlacedPiece): string | null {
  const refused = evaluate('snap', { ...sideJoin(a, b), join: kind }).find(
    (f) => f.rule.severity === 'refuse',
  );
  return refused ? refused.message : null;
}

/**
 * Can `a` and `b` be connected, and as what? Both in the project and different, in the position of a kind, and no
 * refusing rule of that join fails (ADR-100, ADR-168, ADR-207). With `kind` the pair is checked as that kind (a stored
 * connection); without it the first kind they are in (side, corner, stacked) is found. `pieces` saves placing them
 * again when the caller has them.
 */
export function connectionCheck(
  project: Project,
  a: string,
  b: string,
  pieces?: readonly PlacedPiece[],
  kind?: ConnectionKind,
): { reason: string | null; kind: ConnectionKind } {
  const k = kind ?? 'side';
  if (a === b) return { reason: t('A piece cannot be connected to itself.'), kind: k };
  const pa = findPiece(project, a, pieces),
    pb = findPiece(project, b, pieces);
  if (!pa || !pb) return { reason: t('A connected piece was removed.'), kind: k };
  if (kind === 'wall') return { reason: t('A wall connection holds one piece.'), kind };
  if (kind) {
    const where = placedAs(kind, pa, pb);
    return { reason: where ?? refusedAs(kind, pa, pb), kind };
  }
  for (const each of PAIR_KINDS)
    if (!placedAs(each, pa, pb)) return { reason: refusedAs(each, pa, pb), kind: each };
  return {
    reason: t('{a} and {b} are not side by side, in a corner or one over the other.', {
      a: pa.item.design.name,
      b: pb.item.design.name,
    }),
    kind: 'side',
  };
}

/**
 * Does the piece's back lie on wall `wall` of the room, within its length (ADR-207)? Null when it does, else why not.
 * A piece at an extra angle never lies on a wall.
 */
export function wallCheck(
  project: Project,
  id: string,
  wall: number,
  pieces?: readonly PlacedPiece[],
): string | null {
  const pc = findPiece(project, id, pieces);
  if (!pc) return t('A connected piece was removed.');
  const room = project.room;
  const n = wall + 1;
  if (!room || !Number.isInteger(wall) || wall < 0 || wall >= room.outline.length)
    return t('The room has no wall {n}.', { n });
  const name = pc.item.design.name;
  if (pc.item.angle) return t('{name} is turned at an angle.', { name });
  const [p, q] = wallEnds(room, wall);
  const [nx, nz] = wallInward(room, wall);
  const f = pc.facing;
  const faces =
    f.axis === 'z'
      ? Math.round(nx) === 0 && Math.sign(nz) === f.sign
      : Math.round(nz) === 0 && Math.sign(nx) === f.sign;
  if (!faces) return t('The back of {name} does not face wall {n}.', { name, n });
  const B = pc.bounds;
  const back = f.axis === 'z' ? (f.sign > 0 ? B.z : B.z + B.d) : f.sign > 0 ? B.x : B.x + B.w;
  const at = f.axis === 'z' ? p[1] : p[0];
  if (back !== at) return t('The back of {name} is not against wall {n}.', { name, n });
  const [lo, hi] =
    f.axis === 'z'
      ? [Math.min(p[0], q[0]), Math.max(p[0], q[0])]
      : [Math.min(p[1], q[1]), Math.max(p[1], q[1])];
  const [s0, s1] = f.axis === 'z' ? [B.x, B.x + B.w] : [B.z, B.z + B.d];
  if (s0 < lo || s1 > hi) return t('{name} reaches past the end of wall {n}.', { name, n });
  return null;
}

/** The first wall of the room the piece's back lies on (ADR-207), or null with why not. */
export function wallAgainst(
  project: Project,
  id: string,
  pieces?: readonly PlacedPiece[],
): { wall: number | null; reason: string | null } {
  const room = project.room;
  if (!room)
    return { wall: null, reason: t('Draw the room first: a piece goes against its walls.') };
  for (let w = 0; w < room.outline.length; w++)
    if (!wallCheck(project, id, w, pieces)) return { wall: w, reason: null };
  const name = findPiece(project, id, pieces)?.item.design.name ?? '';
  return { wall: null, reason: t('The back of {name} is not against a wall.', { name }) };
}

/** Connect `a` and `b` as `kind` (no check: the caller decides). The same project when they already are. */
export function connect(
  project: Project,
  a: string,
  b: string,
  kind: ConnectionKind = 'side',
): Project {
  if (a === b || kind === 'wall' || isConnected(project, a, b)) return project;
  const c: Connection = { id: newId(), ...(kind !== 'side' ? { kind } : {}), itemIds: [a, b] };
  return { ...project, connections: [...(project.connections ?? []), c] };
}

/** Connect the piece against wall `wall` (no check). The same project when it already is. */
export function connectWall(project: Project, id: string, wall: number): Project {
  if (wallsOf(project, id).includes(wall)) return project;
  const c: Connection = { id: newId(), kind: 'wall', itemIds: [id, id], wall };
  return { ...project, connections: [...(project.connections ?? []), c] };
}

/** Remove the connection between `a` and `b`; the same project when there is none. */
export function disconnect(project: Project, a: string, b: string): Project {
  const c = connectionOf(project, a, b);
  if (!c) return project;
  return withConnections(
    project,
    project.connections!.filter((x) => x !== c),
  );
}

/** Remove the piece's wall connections (one wall, or every one); the same project when there are none. */
export function disconnectWall(project: Project, id: string, wall?: number): Project {
  const gone = (c: Connection) =>
    kindOf(c) === 'wall' && c.itemIds[0] === id && (wall === undefined || c.wall === wall);
  if (!project.connections?.some(gone)) return project;
  return withConnections(
    project,
    project.connections.filter((c) => !gone(c)),
  );
}

function withConnections(project: Project, connections: Connection[]): Project {
  const { connections: _was, ...rest } = project;
  void _was;
  return connections.length ? { ...rest, connections } : rest;
}

/** Keep only connections whose pieces are still in the project, once each. Same object when unchanged. */
export function pruneConnections(project: Project): Project {
  if (!project.connections) return project;
  const ids = new Set(project.items.map((i) => i.id));
  const seen = new Set<string>();
  const kept = project.connections.filter((c) => {
    const pair = pairOf(c);
    if (pair ? pair[0] === pair[1] : c.wall === undefined || c.itemIds[0] !== c.itemIds[1])
      return false;
    if (!c.itemIds.every((x) => ids.has(x))) return false;
    const k = keyOf(c);
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
  return kept.length === project.connections.length ? project : withConnections(project, kept);
}

/**
 * Merging pieces (ADR-047, ADR-207): the connections of `from` go to `to`, those between two of `from` go. The other
 * pieces keep their connections to the merged piece.
 */
export function mergeConnections(project: Project, from: readonly string[], to: string): Project {
  if (!project.connections?.length) return project;
  const merged = new Set(from);
  const connections = project.connections.flatMap((c): Connection[] => {
    const pair = pairOf(c);
    if (pair && merged.has(pair[0]) && merged.has(pair[1])) return [];
    if (!c.itemIds.some((x) => merged.has(x))) return [c];
    return [
      {
        ...c,
        itemIds: c.itemIds.map((x) => (merged.has(x) ? to : x)) as [string, string],
      },
    ];
  });
  return pruneConnections(withConnections(project, connections));
}

/**
 * Settle the connections of pieces that were just dropped (ADR-168, ADR-207): a connection whose position they left
 * goes (dragged apart, off the wall); when the drop snapped, every valid neighbour of a moved piece becomes connected
 * with the kind it is in (side, corner, stacked), and a piece whose back landed on a wall is connected against it.
 * Same object when nothing changes.
 */
export function settleConnections(
  project: Project,
  movedIds: readonly string[],
  snapped: boolean,
  pieces?: readonly PlacedPiece[],
): Project {
  const moved = new Set(movedIds);
  let next = project;
  const placed = new Map<string, PlacedPiece>();
  const place = (id: string) => {
    let pc = placed.get(id) ?? pieces?.find((x) => x.item.id === id);
    if (!pc) {
      const it = project.items.find((i) => i.id === id);
      if (!it) return undefined;
      pc = placeItem(it);
    }
    placed.set(id, pc);
    return pc;
  };
  const known = () => [...placed.values()];
  for (const c of project.connections ?? []) {
    const pair = pairOf(c);
    if (!pair) {
      const id = c.itemIds[0];
      if (!moved.has(id) || !place(id)) continue;
      if (wallCheck(project, id, c.wall ?? -1, known())) next = disconnectWall(next, id, c.wall);
      continue;
    }
    const [a, b] = pair;
    if (!moved.has(a) && !moved.has(b)) continue;
    const pa = place(a),
      pb = place(b);
    if (!pa || !pb || placedAs(kindOf(c), pa, pb)) next = disconnect(next, a, b);
  }
  if (!snapped) return next;
  for (const id of movedIds) {
    const me = place(id);
    if (!me) continue;
    for (const other of project.items) {
      if (other.id === id || isConnected(next, id, other.id)) continue;
      const pc = place(other.id);
      if (!pc) continue;
      const found = connectionCheck(project, id, other.id, [me, pc]);
      if (found.reason === null) next = connect(next, id, other.id, found.kind);
    }
    if (project.room && !wallsOf(next, id).length) {
      const w = wallAgainst(project, id, [me]).wall;
      if (w !== null) next = connectWall(next, id, w);
    }
  }
  return next;
}

/** A warning for every connection that no longer holds, with its kind's reason (ADR-008: never an error). */
export function connectionDiagnostics(
  project: Project,
  pieces?: readonly PlacedPiece[],
): Diagnostic[] {
  const out: Diagnostic[] = [];
  for (const c of project.connections ?? []) {
    const pair = pairOf(c);
    if (!pair) {
      const id = c.itemIds[0];
      const reason = wallCheck(project, id, c.wall ?? -1, pieces);
      if (!reason) continue;
      out.push({
        severity: 'warning',
        code: 'connection-broken',
        message: t('{a} is connected against wall {n} but no longer joined: {reason}', {
          a: pieceName(project, id),
          n: (c.wall ?? 0) + 1,
          reason,
        }),
        nodeId: id,
        itemIds: [id],
      });
      continue;
    }
    const [a, b] = pair;
    const { reason } = connectionCheck(project, a, b, pieces, kindOf(c));
    if (!reason) continue;
    out.push({
      severity: 'warning',
      code: 'connection-broken',
      message: t('{a} and {b} are connected but no longer joined: {reason}', {
        a: pieceName(project, a),
        b: pieceName(project, b),
        reason,
      }),
      nodeId: b,
      itemIds: [a, b],
    });
  }
  return out;
}

/**
 * The shared seam of one connection that still holds (ADR-179), in room mm: the edge the two pieces share on the
 * plan, from (x1, z1) to (x2, z2) along one axis (x1 === x2 for pieces side by side along x), the heights both pieces
 * stand over (y1 bottom, y2 top) and the seam's end at the pieces' front face.
 */
export interface ConnectionSeam {
  /** The connection's id. */
  id: string;
  itemIds: [string, string];
  x1: number;
  z1: number;
  x2: number;
  z2: number;
  y1: number;
  y2: number;
  /** The seam's end on the plan at the front face of the pieces (x, z). */
  front: [number, number];
}

/**
 * One seam for every side or corner connection that still holds (`connectionCheck` without a reason), in connection
 * order; corner seams draw as side seams do (ADR-207). A broken one has none, its warning is in the checks (ADR-168);
 * stacked and wall connections have no seam. The plan, the room front view and the 3D view draw their marks from
 * these (ADR-004, ADR-179).
 */
export function connectionSeams(
  project: Project,
  pieces: readonly PlacedPiece[],
): ConnectionSeam[] {
  if (!project.connections?.length) return [];
  const byId = new Map(pieces.map((pc) => [pc.item.id, pc]));
  return project.connections.flatMap((c) => {
    const pair = pairOf(c);
    const kind = kindOf(c);
    if (!pair || (kind !== 'side' && kind !== 'corner')) return [];
    const [ia, ib] = pair;
    const a = byId.get(ia),
      b = byId.get(ib);
    if (!a || !b || connectionCheck(project, ia, ib, pieces, kind).reason) return [];
    const A = a.bounds,
      B = b.bounds;
    const y1 = Math.max(A.y, B.y),
      y2 = Math.min(A.y + A.h, B.y + B.h);
    const ahead = a.facing.sign > 0;
    // The seam: a shared x edge (side by side along x) or a shared z edge.
    if (A.x + A.w === B.x || B.x + B.w === A.x) {
      const x = A.x + A.w === B.x ? B.x : A.x;
      const z1 = Math.max(A.z, B.z),
        z2 = Math.min(A.z + A.d, B.z + B.d);
      return [
        { id: c.id, itemIds: pair, x1: x, z1, x2: x, z2, y1, y2, front: [x, ahead ? z2 : z1] },
      ];
    }
    const z = A.z + A.d === B.z ? B.z : A.z;
    const x1 = Math.max(A.x, B.x),
      x2 = Math.min(A.x + A.w, B.x + B.w);
    return [{ id: c.id, itemIds: pair, x1, z1: z, x2, z2: z, y1, y2, front: [ahead ? x2 : x1, z] }];
  });
}

/**
 * Every piece that moves with one of `ids`: through its group (ADR-148) and its connections to other pieces
 * (ADR-168, ADR-207: side, corner and stacked), repeatedly, with `ids` first. Without `connections`, groups only
 * (`withGroups`).
 */
export function movingSet(project: Project, ids: readonly string[], connections = true): string[] {
  const out = [...ids];
  for (let i = 0; i < out.length; i++) {
    const id = out[i];
    for (const m of groupOf(project, id)?.itemIds ?? []) if (!out.includes(m)) out.push(m);
    if (connections) for (const m of connectedTo(project, id)) if (!out.includes(m)) out.push(m);
  }
  return out;
}

/**
 * A move of `ids` by (dx, dz) kept along the walls they are connected against (ADR-207): a piece against a wall along
 * x moves only along x, one against a wall along z only along z. Unchanged when none of them is against a wall.
 */
export function alongWalls(
  project: Project,
  ids: readonly string[],
  dx: number,
  dz: number,
): { dx: number; dz: number } {
  const room = project.room;
  if (!room) return { dx, dz };
  let ox = dx,
    oz = dz;
  for (const c of project.connections ?? []) {
    if (kindOf(c) !== 'wall' || !ids.includes(c.itemIds[0]) || c.wall === undefined) continue;
    if (c.wall < 0 || c.wall >= room.outline.length) continue;
    const [p, q] = wallEnds(room, c.wall);
    if (p[1] === q[1]) oz = 0;
    else if (p[0] === q[0]) ox = 0;
  }
  return { dx: ox, dz: oz };
}

/** The project with its groups replaced by the units that move together: groups joined with connections. */
function asUnits(project: Project): Project {
  const seen = new Set<string>();
  const groups: NonNullable<Project['groups']> = [];
  for (const it of project.items) {
    if (seen.has(it.id)) continue;
    const unit = movingSet(project, [it.id]);
    unit.forEach((x) => seen.add(x));
    if (unit.length > 1) groups.push({ id: `unit:${it.id}`, name: '', itemIds: unit });
  }
  return { ...project, groups };
}

/**
 * Carry a change to whole moving units — groups and connected pieces together (ADR-148, ADR-168) — as `carryGroups`
 * does for groups alone. The real groups come back unchanged.
 */
export function carryUnits(
  before: Project,
  after: Project,
  lead: readonly string[] = [],
): MoveResult {
  if (!before.connections?.some((c) => pairOf(c))) return carryGroups(before, after, lead);
  const units = asUnits(before);
  const res = carryGroups(units, { ...after, groups: units.groups }, lead);
  if (res.reason) return { project: before, reason: res.reason };
  const { groups: _u, ...rest } = res.project;
  void _u;
  return { project: before.groups ? { ...rest, groups: before.groups } : rest };
}
