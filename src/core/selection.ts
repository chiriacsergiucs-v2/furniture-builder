/**
 * Several selected pieces and saved groups (ADR-097). Pure functions over the stored project: the UI only collects ids.
 * Moves and turns are whole millimetres and quarter turns; locked pieces (ADR-095) refuse with the reason; placement
 * rules (ADR-031) apply to each piece. Groups never merge pieces and are not connections.
 */
import { newId } from './design';
import {
  liftOff,
  moveBlocked,
  placedBounds,
  resolvePlacements,
  type MoveResult,
  type Project,
  type ProjectItem,
  type QuarterTurn,
} from './project';
import type { Box } from './types';

/** A named set of pieces kept together (ADR-097); a piece belongs to at most one group. */
export interface Group {
  id: string;
  name: string;
  itemIds: string[];
}

/** The group a piece belongs to, if any. */
export const groupOf = (project: Project, itemId: string): Group | undefined =>
  project.groups?.find((g) => g.itemIds.includes(itemId));

/** The ids, in the project's order, keeping only pieces that exist. */
const known = (project: Project, ids: readonly string[]) => {
  const want = new Set(ids);
  return project.items.filter((i) => want.has(i.id));
};

/** Two id lists hold the same pieces (order aside). */
export const sameIds = (a: readonly string[], b: readonly string[]) =>
  a.length === b.length && a.every((x) => b.includes(x));

/** The footprint around the pieces (room mm), or null for none. */
export function selectionBounds(project: Project, ids: readonly string[]): Box | null {
  const placed = resolvePlacements(project);
  const boxes = known(placed, ids).map(placedBounds);
  if (!boxes.length) return null;
  const x0 = Math.min(...boxes.map((b) => b.x)),
    y0 = Math.min(...boxes.map((b) => b.y)),
    z0 = Math.min(...boxes.map((b) => b.z));
  const x1 = Math.max(...boxes.map((b) => b.x + b.w)),
    y1 = Math.max(...boxes.map((b) => b.y + b.h)),
    z1 = Math.max(...boxes.map((b) => b.z + b.d));
  return { x: x0, y: y0, z: z0, w: x1 - x0, h: y1 - y0, d: z1 - z0 };
}

/**
 * A piece of the selection, moved by `dx`/`dz` and/or turned. A piece resting on a selected piece keeps resting on it
 * (it follows, ADR-031); one resting on a piece outside the selection is lifted off, as a drag does (ADR-065).
 */
function carried(it: ProjectItem, moving: Set<string>): boolean {
  return it.placement?.kind === 'above' && moving.has(it.placement.baseId);
}

/**
 * Move every selected piece by the same whole-mm offset (ADR-097). Refused with the reason when a piece is locked or
 * carries a locked piece outside the selection (ADR-095). The same project when nothing moves.
 */
export function moveItems(
  project: Project,
  ids: readonly string[],
  dx: number,
  dz: number,
): MoveResult {
  const items = known(project, ids);
  const mx = Number.isFinite(dx) ? Math.round(dx) : 0,
    mz = Number.isFinite(dz) ? Math.round(dz) : 0;
  if (!items.length || (!mx && !mz)) return { project };
  const reason = moveBlocked(
    project,
    items.map((i) => i.id),
  );
  if (reason) return { project, reason };
  const moving = new Set(items.map((i) => i.id));
  return {
    project: {
      ...project,
      items: project.items.map((it) => {
        if (!moving.has(it.id) || carried(it, moving)) return it;
        const placement = liftOff(it);
        const { placement: _old, ...rest } = it;
        void _old;
        return {
          ...rest,
          position: { ...it.position, x: it.position.x + mx, z: it.position.z + mz },
          ...(placement ? { placement } : {}),
        };
      }),
    },
  };
}

/**
 * Turn the selection a quarter turn about the centre of its footprint (ADR-097), rounded to whole mm; `dir` 1 turns
 * fronts from facing you to facing right, as a single piece's turn (ADR-069). Each piece turns and its footprint goes
 * round the centre; a piece resting on a selected piece keeps resting on it at its turned place along it. Refused
 * with the reason when a piece is locked (ADR-095).
 */
export function turnSelection(
  project: Project,
  ids: readonly string[],
  dir: 1 | -1 = 1,
): MoveResult {
  const items = known(project, ids);
  if (!items.length) return { project };
  const reason = moveBlocked(
    project,
    items.map((i) => i.id),
  );
  if (reason) return { project, reason };
  const placed = resolvePlacements(project);
  const bounds = new Map(placed.items.map((i) => [i.id, placedBounds(i)]));
  const all = selectionBounds(project, ids)!;
  const cx = Math.round(all.x + all.w / 2),
    cz = Math.round(all.z + all.d / 2);
  // A footprint turned about (cx, cz) the way `rotateBox` turns a piece: dir 1 sends (x, z) to (z, −x).
  const turned = (b: Box) =>
    dir === 1
      ? { x: cx + (b.z - cz), z: cz - (b.x + b.w - cx) }
      : { x: cx - (b.z + b.d - cz), z: cz + (b.x - cx) };
  const moving = new Set(items.map((i) => i.id));
  const next = new Map<string, { x: number; z: number }>();
  for (const it of items) next.set(it.id, turned(bounds.get(it.id)!));
  const out = project.items.map((it): ProjectItem => {
    if (!moving.has(it.id)) return it;
    const rotationY = ((((it.rotationY + dir * 90) % 360) + 360) % 360) as QuarterTurn;
    const at = next.get(it.id)!;
    if (carried(it, moving) && it.placement?.kind === 'above') {
      const base = next.get(it.placement.baseId)!;
      return { ...it, rotationY, placement: { ...it.placement, offsetX: at.x - base.x } };
    }
    const placement = liftOff(it);
    const { placement: _old, ...rest } = it;
    void _old;
    return {
      ...rest,
      rotationY,
      position: { ...it.position, x: at.x, z: at.z },
      ...(placement ? { placement } : {}),
    };
  });
  return { project: { ...project, items: out } };
}

/**
 * Copies of the selected pieces, new ids (ADR-011), placed as a block just right of the selection: every copy moves by
 * the selection's width. A copy resting on a copied piece rests on that copy. Copies start unlocked (ADR-095) and in
 * no group. Returns the copies' ids.
 */
export function duplicateItems(
  project: Project,
  ids: readonly string[],
): { project: Project; ids: string[] } {
  const items = known(project, ids);
  const all = selectionBounds(project, ids);
  if (!items.length || !all) return { project, ids: [] };
  const newIds = new Map(items.map((i) => [i.id, newId()]));
  const copies = items.map((src): ProjectItem => {
    const { locked: _locked, ...rest } = structuredClone(src);
    void _locked;
    const pl = rest.placement;
    const inside = pl?.kind === 'above' && newIds.has(pl.baseId);
    const placement =
      pl?.kind === 'above'
        ? inside
          ? { ...pl, baseId: newIds.get(pl.baseId)! }
          : { ...pl, offsetX: pl.offsetX + all.w }
        : pl;
    return {
      ...rest,
      id: newIds.get(src.id)!,
      design: { ...rest.design, id: newId() },
      position: { ...rest.position, x: rest.position.x + all.w },
      ...(placement ? { placement } : {}),
    };
  });
  return {
    project: { ...project, items: [...project.items, ...copies] },
    ids: [...newIds.values()],
  };
}

/** "Group 1", "Group 2", … the first free name. */
function nextName(project: Project): string {
  const names = new Set((project.groups ?? []).map((g) => g.name));
  let n = 1;
  while (names.has(`Group ${n}`)) n++;
  return `Group ${n}`;
}

/**
 * Keep the selection as a named group (ADR-097). Its pieces leave any group they were in (a piece belongs to at most
 * one); a group left empty goes. Fewer than two known pieces: the same project.
 */
export function groupItems(
  project: Project,
  ids: readonly string[],
  name = nextName(project),
): { project: Project; groupId: string | null } {
  const items = known(project, ids).map((i) => i.id);
  if (items.length < 2) return { project, groupId: null };
  const taken = new Set(items);
  const others = (project.groups ?? [])
    .map((g) => ({ ...g, itemIds: g.itemIds.filter((x) => !taken.has(x)) }))
    .filter((g) => g.itemIds.length);
  const group: Group = { id: newId(), name: name.trim() || nextName(project), itemIds: items };
  return { project: { ...project, groups: [...others, group] }, groupId: group.id };
}

/** Remove a group; its pieces stay where they are. */
export function ungroup(project: Project, groupId: string): Project {
  const groups = project.groups?.filter((g) => g.id !== groupId);
  if (!groups || groups.length === project.groups!.length) return project;
  return { ...project, groups };
}

/** The pieces whose footprint touches the plan rectangle (room mm, any corner order), in the project's order. */
export function itemsInBox(
  project: Project,
  a: { x: number; z: number },
  b: { x: number; z: number },
): string[] {
  const x0 = Math.min(a.x, b.x),
    x1 = Math.max(a.x, b.x),
    z0 = Math.min(a.z, b.z),
    z1 = Math.max(a.z, b.z);
  return resolvePlacements(project)
    .items.filter((it) => {
      const f = placedBounds(it);
      return f.x <= x1 && f.x + f.w >= x0 && f.z <= z1 && f.z + f.d >= z0;
    })
    .map((it) => it.id);
}

/** The pieces under a plan point (room mm), in drawing order (the project's order), for cycling taps. */
export function itemsAt(project: Project, x: number, z: number): string[] {
  return itemsInBox(project, { x, z }, { x, z });
}

/** The next piece under the pointer after `current` (cyclic), or the first when `current` is not among them. */
export function nextUnder(under: readonly string[], current: string | null): string | undefined {
  if (!under.length) return undefined;
  const i = current ? under.indexOf(current) : -1;
  return under[(i + 1) % under.length];
}
