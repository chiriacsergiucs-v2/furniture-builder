/**
 * One-tap "Move to" actions (ADR-147): send a project piece to the wall behind it, the ceiling, the floor or the piece
 * under it, its left or right neighbour, the nearest corner, the centre of its gap, or line its top or front up with a
 * neighbour. Directions follow the piece's own front: left and right as you face its front, back behind it. A piece
 * slides until it touches the first room wall or piece whose outline overlaps its path in plan and in height; there is
 * no distance limit. Nothing is clamped silently: an action that cannot move the piece is disabled with its reason.
 */
import { t } from './i18n';
import { movingSet } from './connections';
import { carryGroups, withGroups } from './groupMove';
import {
  carriedBy,
  moveBlocked,
  pieceName,
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
  /**
   * A multi-selection moved as one block (ADR-182): every piece that moves with it — the selection, its groups and
   * connected pieces — with `me`, the first selected, first. Absent for one piece.
   */
  block?: PlacedPiece[];
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
  const way = WAYS[ctx.me.item.rotationY][dir];
  // A block's neighbour is the first piece outside it on that side, from any of its pieces (ADR-182).
  let best: Hit | null = null;
  for (const b of ctx.block ? ctx.block.map((p) => p.bounds) : [ctx.me.bounds]) {
    const h = firstPiece(ctx, b, way);
    if (h && (!best || h.dist < best.dist)) best = h;
  }
  return best?.piece ?? null;
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
      // A block's front is the front-most edge of its pieces (ADR-182).
      const fronts = (ctx.block ?? [ctx.me]).map((p) =>
        f.sign > 0 ? hi(p.bounds, f.axis) : lo(p.bounds, f.axis),
      );
      const mine = f.sign > 0 ? Math.max(...fronts) : Math.min(...fronts);
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

/**
 * The context of a multi-selection moved as one block (ADR-182): the block is every piece that moves with the
 * selection — its groups and connected pieces (ADR-148, ADR-168) and the pieces resting on them; neighbours are the
 * pieces outside it. `me`, whose front gives the directions, is the first selected piece that does not rest on
 * another block piece.
 */
function blockContext(project: Project, ids: readonly string[]): Ctx {
  const unit = movingSet(project, ids);
  const inBlock = new Set([...unit, ...carriedBy(project, unit).map((i) => i.id)]);
  const pieces = project.items.map((i) => placeItem(i));
  const members = pieces.filter((p) => inBlock.has(p.item.id));
  const rides = (p: PlacedPiece) =>
    p.item.placement?.kind === 'above' && inBlock.has(p.item.placement.baseId);
  const lead = ids.find((id) => !rides(members.find((p) => p.item.id === id)!)) ?? ids[0];
  const me = members.find((p) => p.item.id === lead)!;
  const block = [me, ...members.filter((p) => p !== me)];
  return {
    project,
    me,
    others: pieces.filter((p) => !inBlock.has(p.item.id)),
    mates: block.slice(1).map((p) => p.bounds),
    block,
  };
}

/** The block's pieces that move by themselves: not resting on another block piece (that one follows its base). */
function blockRoots(ctx: Ctx): PlacedPiece[] {
  const ids = new Set(ctx.block!.map((p) => p.item.id));
  return ctx.block!.filter((p) => {
    const pl = p.item.placement;
    return !(pl?.kind === 'above' && ids.has(pl.baseId));
  });
}

/** The project with the items in `next` (by id) replaced and the placements resolved again. */
function withItems(project: Project, next: ReadonlyMap<string, ProjectItem>): Project {
  return resolvePlacements({ ...project, items: project.items.map((i) => next.get(i.id) ?? i) });
}

/** A block piece raised or lowered by `dy`, keeping how it is placed (align top), or why it cannot follow. */
function lifted(project: Project, pc: PlacedPiece, dy: Mm): ProjectItem | string {
  const it = pc.item;
  const pl = it.placement;
  const name = pieceName(project, it.id);
  if (pl?.kind === 'floor')
    return t('{name} stands on the floor; the selected pieces move up and down together.', {
      name,
    });
  if (pc.bounds.y + dy < 0)
    return t('{name} would go below the floor; the selected pieces move together.', { name });
  if (pl?.kind === 'wall') return { ...it, placement: { kind: 'wall', height: pl.height + dy } };
  if (pl?.kind === 'above') {
    if (pl.gap + dy < 0)
      return t('{name} would go into the piece under it; the selected pieces move together.', {
        name,
      });
    return { ...it, placement: { ...pl, gap: pl.gap + dy } };
  }
  return { ...it, position: { ...it.position, y: it.position.y + dy } };
}

type Vertical = 'ceiling' | 'down' | 'alignTopLeft' | 'alignTopRight';
const VERTICAL: readonly MoveToAction[] = ['ceiling', 'down', 'alignTopLeft', 'alignTopRight'];

/** The block's up and down actions (ADR-182): its combined height goes to the ceiling, down, or level with a top. */
function moveBlockVertically(ctx: Ctx, action: Vertical): MoveResult {
  const { project } = ctx;
  const block = ctx.block!;
  const bottom = Math.min(...block.map((p) => p.bounds.y));
  const top = Math.max(...block.map((p) => hi(p.bounds, 'y')));
  const roots = blockRoots(ctx);
  const next = new Map<string, ProjectItem>();
  if (action === 'ceiling') {
    const room = project.room;
    if (!room) return { project, reason: t('Draw the room first.') };
    if (top - bottom > room.height)
      return {
        project,
        reason: t('{n} mm taller than the room.', { n: top - bottom - room.height }),
      };
    const dy = room.height - top;
    if (dy === 0) return { project, reason: t('Already at the ceiling.') };
    // Every piece of the block becomes wall-hung, as one piece does (ADR-147), keeping the block's layout.
    for (const pc of roots)
      next.set(pc.item.id, withPlacement(pc.item, { kind: 'wall', height: pc.bounds.y + dy }));
    return { project: withItems(project, next) };
  }
  if (action === 'down') {
    // The block drops until its first piece meets the floor or a piece under it outside the block.
    let drop = Infinity;
    let stop = roots[0].item.id;
    const under = new Map<string, PlacedPiece>();
    for (const pc of roots) {
      const b = pc.bounds;
      const pl = pc.item.placement;
      let free: Mm = b.y;
      if (pl?.kind === 'floor') free = 0;
      else if (pl?.kind === 'above') free = pl.gap;
      else {
        const bases = new Set(placementBases(project, pc.item.id).map((i) => i.id));
        let base: PlacedPiece | null = null;
        for (const o of ctx.others) {
          const ob = o.bounds;
          if (!bases.has(o.item.id) || !overlaps(ob, b, 'x') || !overlaps(ob, b, 'z')) continue;
          if (hi(ob, 'y') > b.y) continue;
          if (!base || hi(ob, 'y') > hi(base.bounds, 'y')) base = o;
        }
        if (base) {
          under.set(pc.item.id, base);
          free = b.y - hi(base.bounds, 'y');
        }
      }
      if (free < drop) {
        drop = free;
        stop = pc.item.id;
      }
    }
    if (drop <= 0)
      return {
        project,
        reason: t(
          '{name} already sits on the floor or on a piece; the selected pieces move down together.',
          { name: pieceName(project, stop) },
        ),
      };
    for (const pc of roots) {
      const it = pc.item;
      const pl = it.placement;
      const y = pc.bounds.y - drop;
      const base = under.get(it.id);
      if (pl?.kind === 'above')
        next.set(it.id, { ...it, placement: { ...pl, gap: pl.gap - drop } });
      else if (base && hi(base.bounds, 'y') === y)
        next.set(
          it.id,
          withPlacement(it, {
            kind: 'above',
            baseId: base.item.id,
            gap: 0,
            offsetX: pc.bounds.x - base.bounds.x,
          }),
        );
      else if (y === 0) next.set(it.id, withPlacement(it, { kind: 'floor' }));
      else if (pl?.kind === 'wall')
        next.set(it.id, { ...it, placement: { kind: 'wall', height: y } });
      else next.set(it.id, { ...it, position: { ...it.position, y } });
    }
    return { project: withItems(project, next) };
  }
  const n = neighbour(ctx, action === 'alignTopLeft' ? 'left' : 'right');
  if (!n)
    return {
      project,
      reason: action === 'alignTopLeft' ? t('No piece on its left.') : t('No piece on its right.'),
    };
  const dy = hi(n.bounds, 'y') - top;
  if (dy === 0) return { project, reason: t('Already at that height.') };
  for (const pc of roots) {
    const r = lifted(project, pc, dy);
    if (typeof r === 'string') return { project, reason: r };
    next.set(pc.item.id, r);
  }
  return { project: withItems(project, next) };
}

/**
 * The block moved on the plan by the offset of `next`, the first selected piece moved (ADR-182): every block piece
 * follows by the same offset, as a group's pieces do (`carryGroups`); a piece that cannot follow refuses the move.
 */
function carryBlock(ctx: Ctx, next: ProjectItem): MoveResult {
  const { project } = ctx;
  const ids = ctx.block!.map((p) => p.item.id);
  const rest = (project.groups ?? []).filter((g) => !g.itemIds.some((id) => ids.includes(id)));
  const unit: Project = {
    ...project,
    groups: [{ id: 'move-to-block', name: '', itemIds: ids }, ...rest],
  };
  const res = carryGroups(unit, withItem(unit, next), [ctx.me.item.id]);
  if (res.reason) return { project, reason: res.reason };
  const { groups: _unit, ...out } = res.project;
  void _unit;
  return { project: project.groups ? { ...out, groups: project.groups } : out };
}

/** Several pieces moved as one block (ADR-182). */
function moveBlock(project: Project, ids: readonly string[], action: MoveToAction): MoveResult {
  const ctx = blockContext(project, ids);
  const locked = moveBlocked(
    project,
    ctx.block!.map((p) => p.item.id),
  );
  if (locked) return { project, reason: locked };
  if (VERTICAL.includes(action)) return moveBlockVertically(ctx, action as Vertical);
  const p = plan(ctx, action);
  if ('reason' in p) return { project, reason: p.reason };
  return carryBlock(ctx, p.item);
}

/** The ids that are pieces of the project, each once, in order. */
function pieceIdsOf(project: Project, id: string | readonly string[]): string[] {
  const list = typeof id === 'string' ? [id] : id;
  return [...new Set(list)].filter((x) => project.items.some((i) => i.id === x));
}

/**
 * Each action, enabled (null) or disabled with the reason, for piece `id` (ADR-147) or for several pieces moved as one
 * block (ADR-182).
 */
export function moveToOptions(
  project: Project,
  id: string | readonly string[],
): Record<MoveToAction, string | null> {
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
 *
 * Several ids move as one block (ADR-182): directions follow the first selected piece's front; the block is the
 * selection with its groups and connected pieces, and it moves by one offset until its first piece meets a wall or a
 * piece outside it (its top meets the ceiling, its bottom the floor). A locked piece in it refuses with its reason.
 */
export function moveTo(
  project: Project,
  id: string | readonly string[],
  action: MoveToAction,
): MoveResult {
  const ids = pieceIdsOf(project, id);
  if (ids.length > 1) return moveBlock(project, ids, action);
  const ctx = ids.length ? context(project, ids[0]) : null;
  if (!ctx) return { project };
  const locked = moveBlocked(project, ids);
  if (locked) return { project, reason: locked };
  const p = plan(ctx, action);
  if ('reason' in p) return { project, reason: p.reason };
  return carryGroups(project, withItem(project, p.item), ids);
}
