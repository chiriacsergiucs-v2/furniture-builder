/**
 * Grouped pieces move together (ADR-148, user answer "Always together"): a piece in a group (ADR-097) never moves on
 * its own. A change that moves one or more grouped pieces is carried to the whole group: every member moves by the
 * offset of the first member that moved, along the wall, in depth and up or down. A member that cannot follow — it is
 * locked (ADR-095), or stands on the floor and would have to go up or down — refuses the whole change with the reason
 * (ADR-008). Pure; positions come from the placements (ADR-031).
 */
import { groupOf, movedTo } from './selection';
import {
  moveBlocked,
  pieceName,
  resolvePlacements,
  type MoveResult,
  type Project,
  type ProjectItem,
} from './project';

type Offset = { dx: number; dy: number; dz: number };

/** Every piece in the same group as one of `ids`, with `ids` first; pieces in no group stay as they are. */
export function withGroups(project: Project, ids: readonly string[]): string[] {
  const out = [...ids];
  for (const id of ids)
    for (const m of groupOf(project, id)?.itemIds ?? []) if (!out.includes(m)) out.push(m);
  return out;
}

/** The member `it` moved by `d` from where it was, or the reason it cannot follow. */
function follow(project: Project, it: ProjectItem, d: Offset): ProjectItem | string {
  let next = it;
  if (d.dy) {
    const pl = it.placement;
    const name = pieceName(project, it.id);
    const below = (y: number) =>
      `${name} would go below the floor (${y} mm); the pieces of its group move together.`;
    if (pl?.kind === 'wall') {
      if (pl.height + d.dy < 0) return below(pl.height + d.dy);
      next = { ...next, placement: { ...pl, height: pl.height + d.dy } };
    } else if (pl?.kind === 'above') {
      if (pl.gap + d.dy < 0) return below(pl.gap + d.dy);
      next = { ...next, placement: { ...pl, gap: pl.gap + d.dy } };
    } else if (pl?.kind === 'floor')
      return `${name} stands on the floor; the pieces of its group move up and down together.`;
    else {
      if (it.position.y + d.dy < 0) return below(it.position.y + d.dy);
      next = { ...next, position: { ...next.position, y: it.position.y + d.dy } };
    }
  }
  if (d.dx || d.dz)
    next = movedTo(next, {
      ...next.position,
      x: next.position.x + d.dx,
      z: next.position.z + d.dz,
    });
  return next;
}

/**
 * Carry a change from `before` to `after` to whole groups: in each group with a member that moved, every member ends
 * up moved by the offset of the first one that moved (`lead` ids first, then the group's order). A member resting on
 * another member follows it by itself. Refused, with `before` and the reason, when a member cannot follow. `after` as
 * it is when no grouped piece moved or every group already moved as one.
 */
export function carryGroups(
  before: Project,
  after: Project,
  lead: readonly string[] = [],
): MoveResult {
  if (!before.groups?.length || after === before) return { project: after };
  const was = new Map(resolvePlacements(before).items.map((i) => [i.id, i.position]));
  const now = (p: Project) => new Map(resolvePlacements(p).items.map((i) => [i.id, i.position]));
  let cur = after;
  let pos = now(cur);
  const offset = (id: string): Offset | null => {
    const a = was.get(id),
      b = pos.get(id);
    return a && b ? { dx: b.x - a.x, dy: b.y - a.y, dz: b.z - a.z } : null;
  };
  const moved = (d: Offset | null) => !!d && (d.dx !== 0 || d.dy !== 0 || d.dz !== 0);
  const same = (a: Offset | null, b: Offset) =>
    !!a && a.dx === b.dx && a.dy === b.dy && a.dz === b.dz;
  for (const g of before.groups) {
    const order = [...lead.filter((id) => g.itemIds.includes(id)), ...g.itemIds];
    const first = order.find((id) => moved(offset(id)));
    if (!first) continue;
    const d = offset(first)!;
    const ids = new Set(g.itemIds);
    // Members not yet where the lead's offset puts them start again from where they were.
    const behind = g.itemIds.filter((id) => !same(offset(id), d));
    if (!behind.length) continue;
    const reason = moveBlocked(before, behind);
    if (reason) return { project: before, reason };
    const items = cur.items.map((it): ProjectItem | string => {
      if (!behind.includes(it.id)) return it;
      const old = before.items.find((i) => i.id === it.id) ?? it;
      // Resting on a member: it follows its base.
      if (old.placement?.kind === 'above' && ids.has(old.placement.baseId)) return old;
      return follow(before, old, d);
    });
    const refused = items.find((x): x is string => typeof x === 'string');
    if (refused) return { project: before, reason: refused };
    cur = { ...cur, items: items as ProjectItem[] };
    pos = now(cur);
    const still = g.itemIds.find((id) => !same(offset(id), d));
    if (still)
      return {
        project: before,
        reason: `${pieceName(before, still)} cannot move with its group; ungroup it to move it alone.`,
      };
  }
  return { project: cur };
}
