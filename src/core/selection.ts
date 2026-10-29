/**
 * Several selected pieces and saved groups (ADR-097). Pure functions over the stored project: the UI only collects ids.
 * Moves and turns are whole millimetres and quarter turns; locked pieces (ADR-095) refuse with the reason; placement
 * rules (ADR-031) apply to each piece. Groups never merge pieces and are not connections.
 */
import { t } from './i18n';
import { mirrorSet } from './arrange';
import { newId } from './design';
import { union } from './geometry';
import {
  carriedBy,
  liftOff,
  moveBlocked,
  placedBounds,
  placedOutline,
  quarterTurn,
  resolvePlacements,
  type MoveResult,
  type Project,
  type ProjectItem,
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

/** A piece resting on a selected piece (ADR-031): it follows its base, so it is not moved on its own. */
function carried(it: ProjectItem, moving: Set<string>): boolean {
  return it.placement?.kind === 'above' && moving.has(it.placement.baseId);
}

/** The item without a placement: free, standing exactly where `position` says (ADR-031 "Anywhere"). */
function free(it: ProjectItem, position: ProjectItem['position']): ProjectItem {
  const { placement: _old, ...rest } = it;
  void _old;
  return { ...rest, position };
}

/**
 * The item moved to `position` on the plan as a drag moves it (ADR-065): a piece resting on another is lifted off
 * (hung on the wall at its height, or standing on the floor); any other placement stays.
 */
export function movedTo(it: ProjectItem, position: ProjectItem['position']): ProjectItem {
  const placement = liftOff(it);
  return { ...free(it, position), ...(placement ? { placement } : {}) };
}

/**
 * Move every selected piece by the same offset, rounded to whole `step`s as a drag is (ADR-065, ADR-097). A piece
 * resting on a selected piece follows it; one resting on a piece outside the selection is lifted off, as a drag does.
 * Refused with the reason when a piece is locked or carries a locked piece outside the selection (ADR-095). The same
 * project when nothing moves.
 */
export function moveItems(
  project: Project,
  ids: readonly string[],
  dx: number,
  dz: number,
  step = 1,
): MoveResult {
  const items = known(project, ids);
  const snap = (d: number) => (Number.isFinite(d) ? Math.round(d / step) * step : 0) || 0;
  const mx = snap(dx),
    mz = snap(dz);
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
        return movedTo(it, { ...it.position, x: it.position.x + mx, z: it.position.z + mz });
      }),
    },
  };
}

/**
 * Turn the selection a quarter turn about the centre of its footprint (ADR-097), rounded to whole mm; `dir` 1 turns
 * fronts from facing you to facing right, as a single piece's turn (ADR-069). Pieces resting on a selected piece turn
 * with it, selected or not. Each piece turns and its footprint goes round the centre; a piece that rested on another
 * keeps its exact turned place, now free (its base runs the other way). Refused with the reason when a piece is locked
 * (ADR-095).
 */
export function turnSelection(
  project: Project,
  ids: readonly string[],
  dir: 1 | -1 = 1,
): MoveResult {
  const picked = known(project, ids).map((i) => i.id);
  if (!picked.length) return { project };
  const all = [...picked, ...carriedBy(project, picked).map((i) => i.id)];
  const reason = moveBlocked(project, all);
  if (reason) return { project, reason };
  const placed = resolvePlacements(project);
  const bounds = new Map(placed.items.map((i) => [i.id, placedBounds(i)]));
  const around = union(all.map((id) => bounds.get(id)!));
  const cx = Math.round(around.x + around.w / 2),
    cz = Math.round(around.z + around.d / 2);
  // A footprint turned about (cx, cz) the way `rotateBox` turns a piece: dir 1 sends (x, z) to (z, −x).
  const turned = (b: Box) =>
    dir === 1
      ? { x: cx + (b.z - cz), z: cz - (b.x + b.w - cx) }
      : { x: cx - (b.z + b.d - cz), z: cz + (b.x - cx) };
  const moving = new Set(all);
  const out = project.items.map((it): ProjectItem => {
    if (!moving.has(it.id)) return it;
    const rotationY = quarterTurn(it.rotationY, dir);
    // Its quarter-turned outline (ADR-121): `position` is that box's corner, not the box around an angled piece.
    const b = placedOutline(placed.items.find((i) => i.id === it.id)!);
    const at = turned(b);
    if (carried(it, moving)) return { ...free(it, { x: at.x, y: b.y, z: at.z }), rotationY };
    return { ...movedTo(it, { ...it.position, x: at.x, z: at.z }), rotationY };
  });
  return { project: { ...project, items: out } };
}

/**
 * Copies of the selected pieces, new ids (ADR-011), placed as a block just right of the selection: every copy moves by
 * the selection's width. A copy resting on a copied piece rests on that copy; one that rested on a piece outside the
 * selection stands free at its place in the block. Copies start unlocked (ADR-095) and in no group. Returns the copies'
 * ids.
 */
export function duplicateItems(
  project: Project,
  ids: readonly string[],
): { project: Project; ids: string[] } {
  const items = known(project, ids);
  const all = selectionBounds(project, ids);
  if (!items.length || !all) return { project, ids: [] };
  const resolved = new Map(resolvePlacements(project).items.map((i) => [i.id, i.position]));
  const newIds = new Map(items.map((i) => [i.id, newId()]));
  const copies = items.map((src): ProjectItem => {
    const { locked: _locked, linkId: _link, ...rest } = structuredClone(src);
    void _locked;
    void _link;
    const pl = rest.placement;
    const at = resolved.get(src.id) ?? rest.position;
    const position = { ...at, x: at.x + all.w };
    const base = {
      ...rest,
      id: newIds.get(src.id)!,
      design: { ...rest.design, id: newId() },
    };
    if (pl?.kind === 'above')
      return newIds.has(pl.baseId)
        ? { ...base, position, placement: { ...pl, baseId: newIds.get(pl.baseId)! } }
        : free(base, position);
    return { ...base, position };
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
 * one); a group left with fewer than two goes. Fewer than two known pieces: the same project.
 */
export function groupItems(
  project: Project,
  ids: readonly string[],
  name = nextName(project),
): { project: Project; groupId: string | null } {
  const items = known(project, ids).map((i) => i.id);
  if (items.length < 2) return { project, groupId: null };
  const taken = new Set(items);
  // A group left with fewer than two pieces goes.
  const others = (project.groups ?? [])
    .map((g) => ({ ...g, itemIds: g.itemIds.filter((x) => !taken.has(x)) }))
    .filter((g) => g.itemIds.length >= 2);
  const group: Group = { id: newId(), name: name.trim() || nextName(project), itemIds: items };
  return { project: { ...project, groups: [...others, group] }, groupId: group.id };
}

/** Remove a group; its pieces stay where they are. */
export function ungroup(project: Project, groupId: string): Project {
  const groups = project.groups?.filter((g) => g.id !== groupId);
  if (!groups || groups.length === project.groups!.length) return project;
  return { ...project, groups };
}

/** Each piece's placed footprint, by id; the project model's `pieces` already hold them. */
export type Footprints = ReadonlyMap<string, Box>;
const footprints = (project: Project): Footprints =>
  new Map(resolvePlacements(project).items.map((i) => [i.id, placedBounds(i)]));

/**
 * The pieces whose footprint touches the plan rectangle (room mm, any corner order), in the project's order. Pass the
 * placed footprints when they are at hand (the plan has them), so nothing is built again.
 */
export function itemsInBox(
  project: Project,
  a: { x: number; z: number },
  b: { x: number; z: number },
  placed: Footprints = footprints(project),
): string[] {
  const x0 = Math.min(a.x, b.x),
    x1 = Math.max(a.x, b.x),
    z0 = Math.min(a.z, b.z),
    z1 = Math.max(a.z, b.z);
  return project.items
    .filter((it) => {
      const f = placed.get(it.id);
      return !!f && f.x <= x1 && f.x + f.w >= x0 && f.z <= z1 && f.z + f.d >= z0;
    })
    .map((it) => it.id);
}

/**
 * The pieces under a plan point (room mm), in drawing order (the project's order), for cycling taps. Strictly inside:
 * a point on the edge two neighbours share is under neither.
 */
export function itemsAt(
  project: Project,
  x: number,
  z: number,
  placed: Footprints = footprints(project),
): string[] {
  return project.items
    .filter((it) => {
      const f = placed.get(it.id);
      return !!f && f.x < x && x < f.x + f.w && f.z < z && z < f.z + f.d;
    })
    .map((it) => it.id);
}

/** The next piece under the pointer after `current` (cyclic), or the first when `current` is not among them. */
export function nextUnder(under: readonly string[], current: string | null): string | undefined {
  if (!under.length) return undefined;
  const i = current ? under.indexOf(current) : -1;
  return under[(i + 1) % under.length];
}

/**
 * Mirror the selected pieces (ADR-121, G-085): positions reflect left–right about the selection's centre line and each
 * design mirrors as Mirror the run does (ADR-069). Pieces resting on them follow. A locked piece refuses the whole
 * action with its name (ADR-095); `reasons` lists pieces with nothing to mirror (they only move).
 */
export function mirrorItems(
  project: Project,
  ids: readonly string[],
): { project: Project; reasons: string[]; refused?: string } {
  const r = mirrorSet(
    project,
    known(project, ids).map((i) => i.id),
  );
  return r.refused ? { ...r, refused: t('Mirror refused: {why}', { why: r.refused }) } : r;
}
