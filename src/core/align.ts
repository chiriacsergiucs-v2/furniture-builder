/**
 * Align and distribute selected pieces (ADR-099). Pure functions over the stored project; every result is whole mm.
 * Align: to the first selected piece — Left, Centre, Right along the wall, Back, Front in depth. Distribute evenly:
 * along the wall only (user answer), the leftmost and rightmost pieces stay and the gaps between neighbours become
 * equal; leftover millimetres go one each to the leftmost gaps (ADR-003). Locked pieces (ADR-095) do not move, and the
 * result says which; placement rules (ADR-031) apply to each piece.
 */
import { movedTo } from './selection';
import {
  moveBlocked,
  placedBounds,
  resolvePlacements,
  type Project,
  type ProjectItem,
} from './project';
import type { Box } from './types';

export type AlignHow = 'left' | 'centre' | 'right' | 'back' | 'front';

export interface ArrangeResult {
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

const boundsOf = (project: Project) =>
  new Map(resolvePlacements(project).items.map((i) => [i.id, placedBounds(i)]));

/**
 * Align the selected pieces to the first one (ADR-099): its left edge, centre line or right edge along the wall, or its
 * back or front in depth. A centre that falls on a half mm rounds down (whole mm). Fewer than two known pieces: the
 * same project.
 */
export function alignItems(project: Project, ids: readonly string[], how: AlignHow): ArrangeResult {
  const bounds = boundsOf(project);
  const known = ids.filter((id) => bounds.has(id));
  if (known.length < 2) return { project, skipped: [] };
  const ref = bounds.get(known[0])!;
  const target = (b: Box): { dx: number; dz: number } => {
    switch (how) {
      case 'left':
        return { dx: ref.x - b.x, dz: 0 };
      case 'right':
        return { dx: ref.x + ref.w - (b.x + b.w), dz: 0 };
      case 'centre':
        return { dx: ref.x + Math.floor((ref.w - b.w) / 2) - b.x, dz: 0 };
      case 'back':
        return { dx: 0, dz: ref.z - b.z };
      case 'front':
        return { dx: 0, dz: ref.z + ref.d - (b.z + b.d) };
    }
  };
  const moves = new Map(known.slice(1).map((id) => [id, target(bounds.get(id)!)]));
  return shiftEach(project, moves);
}

/**
 * Equal gaps between neighbours along the wall (ADR-099, user answer "Along the wall only"): with three or more pieces,
 * sorted by their left edge, the leftmost and rightmost stay and the others move so every gap is the same. The free
 * length splits exactly: leftover millimetres go one each to the leftmost gaps (ADR-003). A locked piece stays, named
 * in `skipped`; the gaps returned are the ones the pieces now have. The pieces must stand in one row (their heights
 * overlap): wall units over base units, or a piece on another, are refused with the reason. Fewer than three known
 * pieces: the same project.
 */
export function distributeItems(project: Project, ids: readonly string[]): ArrangeResult {
  const bounds = boundsOf(project);
  const known = ids.filter((id) => bounds.has(id));
  if (known.length < 3) return { project, skipped: [] };
  const rows = (a: Box, b: Box) => Math.min(a.y + a.h, b.y + b.h) > Math.max(a.y, b.y);
  if (!known.every((a) => known.every((b) => rows(bounds.get(a)!, bounds.get(b)!))))
    return {
      project,
      skipped: [],
      refused:
        'Distribute works on pieces in one row along the wall; select the base units or the wall units, not both.',
    };
  const order = [...known].sort(
    (a, b) => bounds.get(a)!.x - bounds.get(b)!.x || known.indexOf(a) - known.indexOf(b),
  );
  const first = bounds.get(order[0])!,
    last = bounds.get(order[order.length - 1])!;
  const widths = order.map((id) => bounds.get(id)!.w);
  const free = last.x + last.w - first.x - widths.reduce((a, w) => a + w, 0);
  const n = order.length - 1;
  const each = Math.floor(free / n);
  const extra = free - each * n;
  const gaps = Array.from({ length: n }, (_, i) => each + (i < extra ? 1 : 0));
  const moves = new Map<string, { dx: number; dz: number }>();
  let x = first.x + first.w;
  for (let i = 1; i < order.length - 1; i++) {
    x += gaps[i - 1];
    moves.set(order[i], { dx: x - bounds.get(order[i])!.x, dz: 0 });
    x += widths[i];
  }
  const res = shiftEach(project, moves);
  // The gaps as they now are (a locked piece may have kept its place).
  const now = boundsOf(res.project);
  const after = order.map((id) => now.get(id)!);
  return { ...res, gaps: after.slice(1).map((b, i) => b.x - (after[i].x + after[i].w)) };
}

/** What the UI says about an align or distribute that left pieces where they were (ADR-095), or ''. */
export const skippedText = (r: Pick<ArrangeResult, 'skipped' | 'refused'>): string =>
  r.refused ?? (r.skipped.length ? `Not moved: ${r.skipped.join(' ')}` : '');
