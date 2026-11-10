/**
 * Align and distribute selected pieces (ADR-099). Pure functions over the stored project; every result is whole mm.
 * Align: to the first selected piece — Left, Centre, Right along the wall, Back, Front in depth. Distribute evenly:
 * along the wall only (user answer), the leftmost and rightmost pieces stay and the gaps between neighbours become
 * equal; leftover millimetres go one each to the leftmost gaps (ADR-003). Locked pieces (ADR-095) do not move, and the
 * result says which; placement rules (ADR-031) apply to each piece. Top and Bottom (ADR-122) move pieces up or down to
 * the first piece's top or underside by changing how high they hang; a piece standing on the floor stays and the result
 * says why (user answer 2026-10-27 "Accept default": skip floor pieces, never resize them).
 */
import { t } from './i18n';
import { groupOf, movedTo } from './selection';
import {
  moveBlocked,
  pieceName,
  placedBounds,
  resolvePlacements,
  type Project,
  type ProjectItem,
} from './project';
import type { Box } from './types';

export type AlignHow = 'left' | 'centre' | 'right' | 'back' | 'front' | 'top' | 'bottom';

interface ArrangeResult {
  project: Project;
  /** The pieces that stayed where they are and why ("Tall 600 is locked …"). */
  skipped: string[];
  /** Distribute: the gaps between neighbours after it, left to right (mm), as they now are. */
  gaps?: number[];
  /** Why nothing was done (distribute over pieces at different heights). */
  refused?: string;
}

/**
 * Move pieces by their own offsets (whole mm). A piece resting on a moving piece follows it and slides along it by the
 * difference; one resting on a piece that stays slides along it, or is lifted off (as a drag) when it must move in
 * depth. A piece that is locked or carries a locked piece stays, named in `skipped`.
 */
function shiftEach(project: Project, moves: Map<string, { dx: number; dz: number }>) {
  const skipped: string[] = [];
  const go = new Map<string, { dx: number; dz: number }>();
  for (const [id, m] of moves) {
    if (!m.dx && !m.dz) continue;
    const why = moveBlocked(project, [id]);
    if (why) skipped.push(why);
    else go.set(id, m);
  }
  // A selected piece that already lines up stays put, also when it rests on a base that moves (it would follow it).
  for (const id of moves.keys()) {
    const pl = project.items.find((i) => i.id === id)?.placement;
    if (!go.has(id) && pl?.kind === 'above' && go.has(pl.baseId)) go.set(id, { dx: 0, dz: 0 });
  }
  const items = project.items.map((it): ProjectItem => {
    const m = go.get(it.id);
    if (!m) return it;
    const pl = it.placement;
    if (pl?.kind === 'above') {
      const base = go.get(pl.baseId) ?? { dx: 0, dz: 0 };
      // Along its base: the offset changes by what the base does not do for it.
      if (m.dz === base.dz)
        return { ...it, placement: { ...pl, offsetX: pl.offsetX + m.dx - base.dx } };
    }
    return movedTo(it, { ...it.position, x: it.position.x + m.dx, z: it.position.z + m.dz });
  });
  return { project: { ...project, items }, skipped };
}

/**
 * Move pieces up or down by their own offsets (whole mm, ADR-122): a wall unit hangs higher or lower, a piece above
 * another sits with a larger or smaller gap over it, a piece with no placement moves its stored height. A piece on the
 * floor, locked, carrying a locked piece, or that would go below the floor or into its base stays, named in `skipped`.
 */
function liftEach(project: Project, moves: Map<string, number>) {
  const skipped: string[] = [];
  const go = new Map<string, ProjectItem>();
  /** What each moved piece moved by: a stacked piece whose base moves too only needs the difference. */
  const moved = new Map<string, number>();
  const kind = (id: string) => project.items.find((i) => i.id === id)?.placement?.kind;
  // Bases before the pieces stacked on them.
  const order = [...moves].sort(([a], [b]) => +(kind(a) === 'above') - +(kind(b) === 'above'));
  for (const [id, want] of order) {
    const it = project.items.find((i) => i.id === id);
    if (!it) continue;
    const pl = it.placement;
    const dy = want - (pl?.kind === 'above' ? (moved.get(pl.baseId) ?? 0) : 0);
    if (!dy) continue;
    const name = pieceName(project, id);
    if (pl?.kind === 'floor') {
      skipped.push(
        t('{name} stands on the floor; Top and Bottom move wall units and stacked pieces.', {
          name,
        }),
      );
      continue;
    }
    const why = moveBlocked(project, [id]);
    if (why) {
      skipped.push(why);
      continue;
    }
    if (pl?.kind === 'wall') {
      if (pl.height + dy < 0) skipped.push(t('{name} would go below the floor.', { name }));
      else go.set(id, { ...it, placement: { kind: 'wall', height: pl.height + dy } });
    } else if (pl?.kind === 'above') {
      if (pl.gap + dy < 0) skipped.push(t('{name} would sink into the piece under it.', { name }));
      else go.set(id, { ...it, placement: { ...pl, gap: pl.gap + dy } });
    } else if (it.position.y + dy < 0)
      skipped.push(t('{name} would go below the floor.', { name }));
    else go.set(id, { ...it, position: { ...it.position, y: it.position.y + dy } });
    if (go.has(id)) moved.set(id, want);
  }
  const items = project.items.map((it) => go.get(it.id) ?? it);
  return { project: { ...project, items }, skipped };
}

const boundsOf = (project: Project) =>
  new Map(resolvePlacements(project).items.map((i) => [i.id, placedBounds(i)]));

/** The outer box of `boxes` (whole mm). */
const unionOf = (boxes: Box[]): Box => {
  const x = Math.min(...boxes.map((b) => b.x)),
    y = Math.min(...boxes.map((b) => b.y)),
    z = Math.min(...boxes.map((b) => b.z));
  return {
    x,
    y,
    z,
    w: Math.max(...boxes.map((b) => b.x + b.w)) - x,
    h: Math.max(...boxes.map((b) => b.y + b.h)) - y,
    d: Math.max(...boxes.map((b) => b.z + b.d)) - z,
  };
};

/**
 * The axes of the wall a piece stands along (ADR-251), from its quarter turn: `along` the wall and `depth` across it,
 * with the direction (−1 towards the smaller coordinate, +1 the larger) of the piece's own left and of its back.
 * Turn 0 faces +z (back at the back wall), 90 faces +x, 180 faces −z, 270 faces −x (`FACING`, project.ts).
 */
interface WallAxes {
  along: 'x' | 'z';
  depth: 'x' | 'z';
  left: 1 | -1;
  back: 1 | -1;
}
function wallAxes(it: ProjectItem | undefined): WallAxes {
  switch (it?.rotationY ?? 0) {
    case 90:
      return { along: 'z', depth: 'x', left: 1, back: -1 };
    case 180:
      return { along: 'x', depth: 'z', left: 1, back: 1 };
    case 270:
      return { along: 'z', depth: 'x', left: -1, back: 1 };
    default:
      return { along: 'x', depth: 'z', left: -1, back: -1 };
  }
}
const lo = (b: Box, a: 'x' | 'z') => b[a];
const len = (b: Box, a: 'x' | 'z') => (a === 'x' ? b.w : b.d);
const hi = (b: Box, a: 'x' | 'z') => b[a] + len(b, a);
/** An offset of `v` mm on axis `a`, as `shiftEach` takes it. */
const on = (a: 'x' | 'z', v: number) => (a === 'x' ? { dx: v, dz: 0 } : { dx: 0, dz: v });
const itemOf = (project: Project, id: string) => project.items.find((i) => i.id === id);
/** Whether two pieces stand along the same wall direction (their quarter turns on one axis). */
const sameAxis = (a: ProjectItem | undefined, b: ProjectItem | undefined) =>
  (a?.rotationY ?? 0) % 180 === (b?.rotationY ?? 0) % 180;

/**
 * Align the selected pieces to the first one (ADR-099): its left edge, centre line or right edge along the wall, or its
 * back or front in depth, or its top or underside in height (ADR-122). A centre that falls on a half mm rounds down
 * (whole mm). Grouped pieces move together (ADR-148), so a group aligns as one block by its outer box, moved through
 * its first selected member (the store carries the rest); a piece in the first piece's own group stays, named in
 * `skipped` when it would have moved (user answer 2026-10-29 "Group = one block"). Fewer than two known pieces: the
 * same project.
 */
export function alignItems(project: Project, ids: readonly string[], how: AlignHow): ArrangeResult {
  const bounds = boundsOf(project);
  const known = ids.filter((id) => bounds.has(id));
  if (known.length < 2) return { project, skipped: [] };
  const ref = bounds.get(known[0])!;
  const refGroup = groupOf(project, known[0]);
  // One entry per piece, or per group through its first selected member, with the box that aligns.
  const sameGroup = known.slice(1).filter((id) => !!refGroup && groupOf(project, id) === refGroup);
  const units = blocksOf(
    project,
    bounds,
    known.slice(1).filter((id) => !sameGroup.includes(id)),
  );
  const stays = (moves: boolean[]) =>
    moves.some(Boolean)
      ? [
          sameGroup.length > 1
            ? t('{names} are in the same group as {ref}; ungroup to align them.', {
                names: sameGroup.map((id) => pieceName(project, id)).join(', '),
                ref: pieceName(project, known[0]),
              })
            : t('{names} is in the same group as {ref}; ungroup to align it.', {
                names: sameGroup.map((id) => pieceName(project, id)).join(', '),
                ref: pieceName(project, known[0]),
              }),
        ]
      : [];
  if (how === 'top' || how === 'bottom') {
    const dy = (b: Box) => (how === 'top' ? ref.y + ref.h - (b.y + b.h) : ref.y - b.y);
    const res = liftEach(project, new Map(units.map(([id, b]) => [id, dy(b)])));
    return {
      ...res,
      skipped: [...stays(sameGroup.map((id) => !!dy(bounds.get(id)!))), ...res.skipped],
    };
  }
  // Along the wall the first piece stands on (ADR-251): its own left, right and back, on its wall's axes.
  const ax = wallAxes(itemOf(project, known[0]));
  const edge = (b: Box, a: 'x' | 'z', side: 1 | -1) => (side < 0 ? lo(b, a) : hi(b, a));
  const target = (b: Box): { dx: number; dz: number } => {
    switch (how) {
      case 'left':
        return on(ax.along, edge(ref, ax.along, ax.left) - edge(b, ax.along, ax.left));
      case 'right': {
        const r = ax.left === 1 ? -1 : 1;
        return on(ax.along, edge(ref, ax.along, r) - edge(b, ax.along, r));
      }
      case 'centre':
        return on(
          ax.along,
          lo(ref, ax.along) +
            Math.floor((len(ref, ax.along) - len(b, ax.along)) / 2) -
            lo(b, ax.along),
        );
      case 'back':
        return on(ax.depth, edge(ref, ax.depth, ax.back) - edge(b, ax.depth, ax.back));
      case 'front': {
        const f = ax.back === 1 ? -1 : 1;
        return on(ax.depth, edge(ref, ax.depth, f) - edge(b, ax.depth, f));
      }
      default:
        return { dx: 0, dz: 0 };
    }
  };
  // A piece or group standing along another wall stays and is named (ADR-251).
  const other = units.filter(([id]) => !sameAxis(itemOf(project, id), itemOf(project, known[0])));
  const along = units.filter(([id]) => !other.some(([o]) => o === id));
  const otherWall = other.map(([id]) =>
    t('{name} stands along another wall.', { name: pieceName(project, id) }),
  );
  const res = shiftEach(project, new Map(along.map(([id, b]) => [id, target(b)])));
  const off = sameGroup.map((id) => {
    const m = target(bounds.get(id)!);
    return !!(m.dx || m.dz);
  });
  return { ...res, skipped: [...stays(off), ...otherWall, ...res.skipped] };
}

/**
 * Each selected piece, or each selected group as one block (ADR-148: grouped pieces move together): the id that moves
 * it (the group's first selected member; the store carries the rest) and its outer box over every member.
 */
function blocksOf(project: Project, bounds: Map<string, Box>, ids: readonly string[]) {
  const out: [string, Box][] = [];
  const seen = new Set<string>();
  for (const id of ids) {
    const g = groupOf(project, id);
    if (!g) out.push([id, bounds.get(id)!]);
    else if (!seen.has(g.id)) {
      seen.add(g.id);
      out.push([id, unionOf(g.itemIds.flatMap((m) => (bounds.has(m) ? [bounds.get(m)!] : [])))]);
    }
  }
  return out;
}

/**
 * Equal gaps between neighbours along the wall (ADR-099, user answer "Along the wall only"), row by row (ADR-205): the
 * selected pieces fall into rows (their heights overlap, chained: the base units, the wall units), and each row of three
 * or more is spaced on its own. In a row, sorted by left edge, the leftmost and rightmost stay and the others move so
 * every gap is the same; the free length splits exactly, leftover millimetres one each to the leftmost gaps (ADR-003). A
 * row with fewer than three stays where it is and is named in `skipped`. A locked piece stays, named in `skipped`; the
 * gaps returned are the ones the pieces now have, row after row. A group counts as one block by its outer box (user
 * 2026-10-29 "fix distribute too", G-300); fewer than three pieces or groups in all is refused with the reason. Fewer
 * than three known pieces: the same project.
 */
export function distributeItems(project: Project, ids: readonly string[]): ArrangeResult {
  const bounds = boundsOf(project);
  const known = ids.filter((id) => bounds.has(id));
  if (known.length < 3) return { project, skipped: [] };
  const blocks = blocksOf(project, bounds, known);
  if (blocks.length < 3)
    return {
      project,
      skipped: [],
      refused: t(
        'Distribute needs three or more pieces or groups; the pieces of a group move together, so ungroup them to space them.',
      ),
    };
  // Along the wall the first piece stands on (ADR-251); a block along another wall stays and is named.
  const ax = wallAxes(itemOf(project, known[0])).along;
  const firstItem = itemOf(project, known[0]);
  const otherWall = blocks
    .filter(([id]) => !sameAxis(itemOf(project, id), firstItem))
    .map(([id]) => t('{name} stands along another wall.', { name: pieceName(project, id) }));
  const box = new Map(blocks);
  const lead = blocks.filter(([id]) => sameAxis(itemOf(project, id), firstItem)).map(([id]) => id);
  // Rows: blocks whose heights overlap, chained (a block joins every row it overlaps, and those rows merge).
  const level = (a: Box, b: Box) => Math.min(a.y + a.h, b.y + b.h) > Math.max(a.y, b.y);
  const rows: string[][] = [];
  for (const id of lead) {
    const hit = rows.filter((r) => r.some((o) => level(box.get(o)!, box.get(id)!)));
    const merged = [...hit.flat(), id];
    for (const r of hit) rows.splice(rows.indexOf(r), 1);
    rows.push(merged);
  }
  rows.sort((a, b) => lead.indexOf(a[0]) - lead.indexOf(b[0]));
  const moves = new Map<string, { dx: number; dz: number }>();
  const spaced: string[][] = [];
  const short: string[] = [];
  for (const row of rows) {
    if (row.length < 3) {
      short.push(
        t('{names}: fewer than three in this row', {
          names: row.map((id) => pieceName(project, id)).join(', '),
        }),
      );
      continue;
    }
    const order = [...row].sort(
      (a, b) => lo(box.get(a)!, ax) - lo(box.get(b)!, ax) || lead.indexOf(a) - lead.indexOf(b),
    );
    spaced.push(order);
    const first = box.get(order[0])!,
      last = box.get(order[order.length - 1])!;
    const widths = order.map((id) => len(box.get(id)!, ax));
    const free = hi(last, ax) - lo(first, ax) - widths.reduce((a, w) => a + w, 0);
    const n = order.length - 1;
    const each = Math.floor(free / n);
    const extra = free - each * n;
    const gaps = Array.from({ length: n }, (_, i) => each + (i < extra ? 1 : 0));
    let x = hi(first, ax);
    for (let i = 1; i < order.length - 1; i++) {
      x += gaps[i - 1];
      moves.set(order[i], on(ax, x - lo(box.get(order[i])!, ax)));
      x += widths[i];
    }
  }
  const res = moves.size ? shiftEach(project, moves) : { project, skipped: [] as string[] };
  // The gaps as they now are (a locked piece may have kept its place); a moved group's lead moved by its block's offset.
  const now = boundsOf(res.project);
  const gaps = spaced.flatMap((order) => {
    const after = order.map((id) => {
      const b = box.get(id)!,
        d = lo(now.get(id)!, ax) - lo(bounds.get(id)!, ax);
      return { ...b, [ax]: b[ax] + d };
    });
    return after.slice(1).map((b, i) => lo(b, ax) - hi(after[i], ax));
  });
  return {
    ...res,
    skipped: [...res.skipped, ...otherWall, ...short],
    ...(spaced.length ? { gaps } : {}),
  };
}

/** What the UI says about an align or distribute that left pieces where they were (ADR-095), or ''. */
export const skippedText = (r: Pick<ArrangeResult, 'skipped' | 'refused'>): string =>
  r.refused ?? (r.skipped.length ? t('Not moved: {list}', { list: r.skipped.join(' ') }) : '');
