/**
 * One-tap "Move to" actions (ADR-147): send a project piece to the wall behind it, the ceiling, the floor or the piece
 * under it, its left or right neighbour, the nearest corner, the centre of its gap, or line its top or front up with a
 * neighbour. Directions follow the piece's own front: left and right as you face its front, back behind it. A piece
 * slides until it touches the first room wall or piece whose outline overlaps its path in plan and in height; there is
 * no distance limit. Nothing is clamped silently: an action that cannot move the piece is disabled with its reason.
 */
import { t } from './i18n';
import { carryGroups, withGroups } from './groupMove';
import {
  carriedBy,
  moveBlocked,
  placeItem,
  placementBases,
  resolvePlacements,
  type MoveResult,
  type PlacedPiece,
  type Placement,
  type Project,
  type ProjectItem,
  type QuarterTurn,
} from './project';
import { roomConnectors } from './snap';
import type { Box, Mm } from './types';

export const MOVE_TO_ACTIONS = [
  'wall',
  'left',
  'right',
  'corner',
  'centre',
  'ceiling',
  'down',
  'alignTopLeft',
  'alignTopRight',
  'alignFrontLeft',
  'alignFrontRight',
] as const;
export type MoveToAction = (typeof MOVE_TO_ACTIONS)[number];

/** Button text and what each action does, for the panel and the 3D toolbar. */
export const MOVE_TO_LABELS: Record<MoveToAction, { label: string; title: string }> = {
  wall: {
    label: t('To wall'),
    title: t('Slide back until it touches the wall or a piece behind it'),
  },
  left: {
    label: t('To left piece'),
    title: t('Slide left until it touches the first piece or wall'),
  },
  right: {
    label: t('To right piece'),
    title: t('Slide right until it touches the first piece or wall'),
  },
  corner: {
    label: t('Into corner'),
    title: t('Back to the wall, then sideways to the nearer side'),
  },
  centre: { label: t('Centre'), title: t('Centre it between what is on its left and right') },
  ceiling: { label: t('To ceiling'), title: t('Raise it until its top touches the ceiling') },
  down: { label: t('Down'), title: t('Lower it onto the piece under it or the floor') },
  alignTopLeft: { label: t('Align top ←'), title: t('Match the top of the piece on its left') },
  alignTopRight: { label: t('Align top →'), title: t('Match the top of the piece on its right') },
  alignFrontLeft: {
    label: t('Align front ←'),
    title: t('Match the front of the piece on its left'),
  },
  alignFrontRight: {
    label: t('Align front →'),
    title: t('Match the front of the piece on its right'),
  },
};

type Dir = 'left' | 'right' | 'back';
type Axis = 'x' | 'z';
/** A direction on the plan: the room axis and its sign. */
interface Way {
  axis: Axis;
  sign: 1 | -1;
}

/** The piece's own left, right and back turned into room directions (as `rotateBox` turns a piece). */
const WAYS: Record<QuarterTurn, Record<Dir | 'front', Way>> = {
  0: {
    left: { axis: 'x', sign: -1 },
    right: { axis: 'x', sign: 1 },
    back: { axis: 'z', sign: -1 },
    front: { axis: 'z', sign: 1 },
  },
  90: {
    left: { axis: 'z', sign: 1 },
    right: { axis: 'z', sign: -1 },
    back: { axis: 'x', sign: -1 },
    front: { axis: 'x', sign: 1 },
  },
  180: {
    left: { axis: 'x', sign: 1 },
    right: { axis: 'x', sign: -1 },
    back: { axis: 'z', sign: 1 },
    front: { axis: 'z', sign: -1 },
  },
  270: {
    left: { axis: 'z', sign: -1 },
    right: { axis: 'z', sign: 1 },
    back: { axis: 'x', sign: 1 },
    front: { axis: 'x', sign: -1 },
  },
};

const lo = (b: Box, a: Axis | 'y') => (a === 'x' ? b.x : a === 'z' ? b.z : b.y);
const hi = (b: Box, a: Axis | 'y') => (a === 'x' ? b.x + b.w : a === 'z' ? b.z + b.d : b.y + b.h);
const overlaps = (a: Box, b: Box, axis: Axis | 'y') =>
  lo(a, axis) < hi(b, axis) && lo(b, axis) < hi(a, axis);
const other = (a: Axis): Axis => (a === 'x' ? 'z' : 'x');

/** What a slide meets first: how far it can go (mm) and what it touches. */
interface Hit {
  dist: Mm;
  what: string;
  piece?: PlacedPiece;
}

interface Ctx {
  project: Project;
  me: PlacedPiece;
  /** The other pieces, without the ones resting on this one or in its group (they move with it). */
  others: PlacedPiece[];
  /** The other pieces of its group (ADR-148): they slide with it, so they stop it too. */
  mates: Box[];
}

/** The first piece in the way of `b` going `way`: it overlaps the path across and in height and lies ahead. */
function firstPiece(ctx: Ctx, b: Box, way: Way): Hit | null {
  let best: Hit | null = null;
  const { axis, sign } = way;
  for (const pc of ctx.others) {
    const o = pc.bounds;
    if (!overlaps(o, b, other(axis)) || !overlaps(o, b, 'y')) continue;
    const dist = sign > 0 ? lo(o, axis) - hi(b, axis) : lo(b, axis) - hi(o, axis);
    if (dist < 0) continue;
    if (!best || dist < best.dist) best = { dist, what: pc.item.design.name, piece: pc };
  }
  return best;
}

/** The first room wall in the way of `b` going `way`: a wall across its path facing back towards it. */
function firstWall(ctx: Ctx, b: Box, way: Way): Hit | null {
  if (!ctx.project.room) return null;
  let best: Hit | null = null;
  const { axis, sign } = way;
  const ax = other(axis);
  for (const w of roomConnectors(ctx.project.room).walls) {
    if (w.axis !== axis || w.normal !== -sign) continue;
    if (!(w.lo < hi(b, ax) && lo(b, ax) < w.hi)) continue;
    const dist = sign > 0 ? w.at - hi(b, axis) : lo(b, axis) - w.at;
    if (dist < 0) continue;
    if (!best || dist < best.dist) best = { dist, what: t('wall {n}', { n: w.wall + 1 }) };
  }
  return best;
}

function firstHit(ctx: Ctx, b: Box, way: Way): Hit | null {
  const p = firstPiece(ctx, b, way),
    w = firstWall(ctx, b, way);
  if (!p) return w;
  if (!w) return p;
  return w.dist < p.dist ? w : p;
}

const shifted = (b: Box, axis: Axis, d: Mm): Box =>
  axis === 'x' ? { ...b, x: b.x + d } : { ...b, z: b.z + d };

/** The item moved by `d` mm along `axis` on the plan; a piece on another piece moves along it (its offset). */
function slid(it: ProjectItem, axis: Axis, d: Mm): ProjectItem {
  if (it.placement?.kind === 'above')
    return { ...it, placement: { ...it.placement, offsetX: it.placement.offsetX + d } };
  const p = it.position;
  return { ...it, position: axis === 'x' ? { ...p, x: p.x + d } : { ...p, z: p.z + d } };
}

const withItem = (project: Project, next: ProjectItem): Project =>
  resolvePlacements({
    ...project,
    items: project.items.map((i) => (i.id === next.id ? next : i)),
  });

function withPlacement(it: ProjectItem, placement: Placement | undefined): ProjectItem {
  const { placement: _old, ...rest } = it;
  void _old;
  return placement ? { ...rest, placement } : rest;
}

const DIR_WORD: Record<Dir, string> = {
  left: t('on its left'),
  right: t('on its right'),
  back: t('behind it'),
};

/** Plan for one action: the moved item, or why it cannot move. */
type Plan = { item: ProjectItem } | { reason: string };

/** The limit of a slide along the piece under it (ADR-147, G-295): its base's ends. */
function baseLimit(ctx: Ctx, way: Way): Hit | null {
  const pl = ctx.me.item.placement;
  if (pl?.kind !== 'above') return null;
  const base = ctx.others.find((p) => p.item.id === pl.baseId) ?? placed(ctx, pl.baseId);
  if (!base) return null;
  const b = ctx.me.bounds,
    o = base.bounds;
  const dist = way.sign > 0 ? hi(o, way.axis) - hi(b, way.axis) : lo(b, way.axis) - lo(o, way.axis);
  return { dist: Math.max(0, dist), what: t('the end of {name}', { name: base.item.design.name }) };
}

function placed(ctx: Ctx, id: string): PlacedPiece | undefined {
  const it = ctx.project.items.find((i) => i.id === id);
  return it ? placeItem(it) : undefined;
}

/** What the piece meets sliding `dir` (null: nothing), or why it cannot slide that way. */
function reach(
  ctx: Ctx,
  dir: Dir,
  b: Box = ctx.me.bounds,
): { hit: Hit | null } | { reason: string } {
  const it = ctx.me.item;
  const way = WAYS[it.rotationY][dir];
  if (it.placement?.kind === 'above' && (dir === 'back' || way.axis !== 'x'))
    return {
      reason:
        dir === 'back'
          ? t('Sits on another piece and follows it back.')
          : t('Sits on another piece and follows it that way.'),
    };
  let hit = firstHit(ctx, b, way);
  // Its group-mates move by the same offset: the first of them to touch something stops them all.
  const dx = b.x - ctx.me.bounds.x,
    dz = b.z - ctx.me.bounds.z;
  for (const m of ctx.mates) {
    const h = firstHit(ctx, { ...m, x: m.x + dx, z: m.z + dz }, way);
    if (h && (!hit || h.dist < hit.dist)) hit = h;
  }
  const end = baseLimit(ctx, way);
  if (end && (!hit || end.dist < hit.dist)) hit = end;
  return { hit };
}

/** How far the piece can slide `dir`, or why it cannot. */
function slide(ctx: Ctx, dir: Dir, b: Box = ctx.me.bounds): Hit | { reason: string } {
  const r = reach(ctx, dir, b);
  if ('reason' in r) return r;
  if (!r.hit) return { reason: t('Nothing {where}.', { where: DIR_WORD[dir] }) };
  if (r.hit.dist === 0) return { reason: t('Already touching {what}.', { what: r.hit.what }) };
  return r.hit;
}

const isReason = (x: object): x is { reason: string } => 'reason' in x;

/** The first piece on its `dir` side (pieces only), for the align actions. */
function neighbour(ctx: Ctx, dir: 'left' | 'right'): PlacedPiece | null {
  return firstPiece(ctx, ctx.me.bounds, WAYS[ctx.me.item.rotationY][dir])?.piece ?? null;
}

/** The item with its underside at `y` (mm above the floor), keeping how it is placed where it can. */
function atHeight(ctx: Ctx, y: Mm): Plan {
  const it = ctx.me.item;
  const pl = it.placement;
  if (y < 0) return { reason: t('It would go below the floor.') };
  if (y === it.position.y) return { reason: t('Already at that height.') };
  if (pl?.kind === 'floor') return { reason: t('Stands on the floor; its height is fixed.') };
  if (pl?.kind === 'wall') return { item: { ...it, placement: { kind: 'wall', height: y } } };
  if (pl?.kind === 'above') {
    const gap = pl.gap + y - it.position.y;
    if (gap < 0) return { reason: t('It would go into the piece under it.') };
    return { item: { ...it, placement: { ...pl, gap } } };
  }
  return { item: { ...it, position: { ...it.position, y } } };
}

function plan(ctx: Ctx, action: MoveToAction): Plan {
  const it = ctx.me.item;
  const b = ctx.me.bounds;
  const room = ctx.project.room;
  const turned = !!it.angle;
  if (turned && action !== 'ceiling' && action !== 'down')
    return { reason: t('Turned freely; only To ceiling and Down work.') };
  const roomFirst = { reason: t('Draw the room first.') };
  switch (action) {
    case 'wall': {
      if (!room) return roomFirst;
      const h = slide(ctx, 'back');
      if (isReason(h)) return h;
      const way = WAYS[it.rotationY].back;
      return { item: slid(it, way.axis, way.sign * h.dist) };
    }
    case 'left':
    case 'right': {
      const h = slide(ctx, action);
      if (isReason(h)) return h;
      const way = WAYS[it.rotationY][action];
      return { item: slid(it, way.axis, way.sign * h.dist) };
    }
    case 'corner': {
      if (!room) return roomFirst;
      const ways = WAYS[it.rotationY];
      let next = it;
      let box = b;
      if (it.placement?.kind !== 'above') {
        const back = slide(ctx, 'back');
        if (!isReason(back)) {
          next = slid(next, ways.back.axis, ways.back.sign * back.dist);
          box = shifted(box, ways.back.axis, ways.back.sign * back.dist);
        }
      }
      const l = slide(ctx, 'left', box),
        r = slide(ctx, 'right', box);
      const side =
        isReason(l) && isReason(r)
          ? null
          : isReason(r) || (!isReason(l) && l.dist <= r.dist)
            ? { dir: 'left' as const, hit: l as Hit }
            : { dir: 'right' as const, hit: r as Hit };
      if (side) next = slid(next, ways[side.dir].axis, ways[side.dir].sign * side.hit.dist);
      if (next === it) return { reason: t('Already in the corner, or no corner to slide into.') };
      return { item: next };
    }
    case 'centre': {
      const l = reach(ctx, 'left'),
        r = reach(ctx, 'right');
      if (isReason(l)) return l;
      if (isReason(r)) return r;
      if (!l.hit || !r.hit)
        return {
          reason: l.hit
            ? t('Nothing on its right to centre between.')
            : t('Nothing on its left to centre between.'),
        };
      const dl = l.hit.dist,
        dr = r.hit.dist;
      // Odd millimetres round to the left.
      const toRight = Math.floor((dr - dl) / 2);
      if (!toRight) return { reason: t('Already centred.') };
      const way = WAYS[it.rotationY].right;
      return { item: slid(it, way.axis, way.sign * toRight) };
    }
    case 'ceiling': {
      if (!room) return roomFirst;
      const y = room.height - b.h;
      if (y < 0) return { reason: t('{n} mm taller than the room.', { n: b.h - room.height }) };
      if (y === b.y) return { reason: t('Already at the ceiling.') };
      // A floor piece becomes wall-hung, and a piece on another piece lifts off (user answers, ADR-147).
      return { item: withPlacement(it, { kind: 'wall', height: y }) };
    }
    case 'down': {
      const pl = it.placement;
      if (pl?.kind === 'floor') return { reason: t('Already on the floor.') };
      if (pl?.kind === 'above') {
        if (pl.gap === 0) return { reason: t('Already sits on the piece under it.') };
        return { item: { ...it, placement: { ...pl, gap: 0 } } };
      }
      const bases = new Set(placementBases(ctx.project, it.id).map((i) => i.id));
      let under: PlacedPiece | null = null;
      for (const pc of ctx.others) {
        const o = pc.bounds;
        if (!bases.has(pc.item.id) || !overlaps(o, b, 'x') || !overlaps(o, b, 'z')) continue;
        if (hi(o, 'y') > b.y) continue;
        if (!under || hi(o, 'y') > hi(under.bounds, 'y')) under = pc;
      }
      if (under)
        return {
          item: withPlacement(it, {
            kind: 'above',
            baseId: under.item.id,
            gap: 0,
            offsetX: b.x - under.bounds.x,
          }),
        };
      if (b.y === 0) return { reason: t('Already on the floor.') };
      return { item: withPlacement(it, { kind: 'floor' }) };
    }
    case 'alignTopLeft':
    case 'alignTopRight': {
      const n = neighbour(ctx, action === 'alignTopLeft' ? 'left' : 'right');
      if (!n)
        return {
          reason:
            action === 'alignTopLeft' ? t('No piece on its left.') : t('No piece on its right.'),
        };
      return atHeight(ctx, hi(n.bounds, 'y') - b.h);
    }
    case 'alignFrontLeft':
    case 'alignFrontRight': {
      const n = neighbour(ctx, action === 'alignFrontLeft' ? 'left' : 'right');
      if (!n)
        return {
          reason:
            action === 'alignFrontLeft' ? t('No piece on its left.') : t('No piece on its right.'),
        };
      if (it.placement?.kind === 'above')
        return { reason: t('Sits on another piece; its back stays in line with it.') };
      const f = WAYS[it.rotationY].front;
      const mine = f.sign > 0 ? hi(b, f.axis) : lo(b, f.axis);
      const theirs = f.sign > 0 ? hi(n.bounds, f.axis) : lo(n.bounds, f.axis);
      if (mine === theirs) return { reason: t('Fronts already in line.') };
      return { item: slid(it, f.axis, theirs - mine) };
    }
  }
}

function context(project: Project, id: string): Ctx | null {
  const item = project.items.find((i) => i.id === id);
  if (!item) return null;
  // Pieces resting on it and the other pieces of its group move with it (ADR-031, ADR-148): not in the way.
  const group = new Set(withGroups(project, [id]).filter((m) => m !== id));
  const riding = new Set(carriedBy(project, [id, ...group]).map((i) => i.id));
  const pieces = project.items.map((i) => placeItem(i));
  const me = pieces.find((p) => p.item.id === id)!;
  return {
    project,
    me,
    others: pieces.filter((p) => p !== me && !riding.has(p.item.id) && !group.has(p.item.id)),
    mates: pieces.filter((p) => group.has(p.item.id)).map((p) => p.bounds),
  };
}

/** Each action, enabled (null) or disabled with the reason, for piece `id` (ADR-147). */
export function moveToOptions(project: Project, id: string): Record<MoveToAction, string | null> {
  const out = {} as Record<MoveToAction, string | null>;
  for (const a of MOVE_TO_ACTIONS) {
    const r = moveTo(project, id, a);
    out[a] = r.reason ?? (r.project === project ? t('No piece selected.') : null);
  }
  return out;
}

/**
 * Do one Move to action on piece `id`: the project after it, or the same project and the reason (ADR-147). A piece in
 * a group takes its group with it (ADR-148); a member that cannot follow refuses the move with its reason.
 */
export function moveTo(project: Project, id: string, action: MoveToAction): MoveResult {
  const ctx = context(project, id);
  if (!ctx) return { project };
  const locked = moveBlocked(project, [id]);
  if (locked) return { project, reason: locked };
  const p = plan(ctx, action);
  if ('reason' in p) return { project, reason: p.reason };
  return carryGroups(project, withItem(project, p.item), [id]);
}
