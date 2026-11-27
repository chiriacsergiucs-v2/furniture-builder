/** Placing, dragging, turning, locking and removing project pieces (ADR-031, ADR-065, G-548 split, ADR-306). */
import type { Placement } from './placement';
import { pruneCommon } from './common';
import { pruneConnections } from './connections';
import { pruneShared } from './shared';
import { type ModelItem, type ModelPlacement } from './model3d';
import type { Box, CatalogMeta, Diagnostic, Mm } from './types';
import { t, tr } from '@furniture-builder/i18n';
import {
  type Project,
  type ProjectItem,
  isWallHung,
  type QuarterTurn,
  pruneGroups,
} from './projectDoc';
import { placedBounds } from './projectPlace';

// ---------------------------------------------------------------------------
// Placement: floor, wall, on or above another piece (ADR-031)
// ---------------------------------------------------------------------------

/** Pieces an item may sit on or hang above: not itself and nothing that (directly or not) sits on it. */
export function placementBases(project: Project, id: string): ProjectItem[] {
  const byId = new Map(project.items.map((i) => [i.id, i]));
  const restsOn = (it: ProjectItem): boolean => {
    for (let cur: ProjectItem | undefined = it, n = 0; cur && n <= project.items.length; n++) {
      if (cur.id === id) return true;
      cur = cur.placement?.kind === 'above' ? byId.get(cur.placement.baseId) : undefined;
    }
    return false;
  };
  return project.items.filter((i) => i.id !== id && !restsOn(i));
}

/**
 * Bring every stored position in line with its placement. Bases are placed before the pieces on them; a piece whose
 * base is missing or that rests on itself through a chain keeps its stored position (reported by `placementIssues`).
 * Returns the same project when nothing moves.
 */
export function resolvePlacements(project: Project): Project {
  const byId = new Map(project.items.map((i) => [i.id, i]));
  const out = new Map<string, ProjectItem>();
  const busy = new Set<string>();
  const resolve = (it: ProjectItem): ProjectItem => {
    const done = out.get(it.id);
    if (done) return done;
    if (busy.has(it.id)) return it;
    busy.add(it.id);
    const pl = it.placement;
    let position = it.position;
    if (pl?.kind === 'floor') position = { ...position, y: 0 };
    else if (pl?.kind === 'wall') position = { ...position, y: pl.height };
    else if (pl?.kind === 'above') {
      const base = byId.get(pl.baseId);
      if (base && !busy.has(base.id)) {
        const b = placedBounds(resolve(base));
        position = { x: b.x + pl.offsetX, y: b.y + b.h + pl.gap, z: b.z };
      }
    }
    busy.delete(it.id);
    const next =
      position.x === it.position.x && position.y === it.position.y && position.z === it.position.z
        ? it
        : { ...it, position };
    out.set(it.id, next);
    return next;
  };
  const items = project.items.map(resolve);
  // Display-only models follow their placement too (ADR-208); their base is always a piece, never a model.
  const resolved = new Map(items.map((i) => [i.id, i]));
  const models = project.models?.map((m) => {
    const position = modelPosition(m.position, m.placement, (id) => {
      const base = resolved.get(id);
      return base ? placedBounds(base) : undefined;
    });
    return position === m.position ? m : { ...m, position };
  });
  const sameItems = items.every((it, i) => it === project.items[i]);
  const sameModels = !models || models.every((m, i) => m === project.models![i]);
  if (sameItems && sameModels) return project;
  return { ...project, items, ...(models ? { models } : {}) };
}

/** The placed box of every item, by item id (after `resolvePlacements`). */
export const boundsOf = (project: Project) =>
  new Map(resolvePlacements(project).items.map((i) => [i.id, placedBounds(i)]));

/**
 * Where a model stands for its placement (ADR-208): on the floor, on the wall at its height, or on a piece (`baseBox`
 * gives that piece's placed box). The same position object when nothing changes; a missing base keeps it.
 */
function modelPosition(
  position: ModelItem['position'],
  pl: ModelPlacement | undefined,
  baseBox: (id: string) => Box | undefined,
): ModelItem['position'] {
  let next = position;
  if (pl?.kind === 'floor') next = { ...position, y: 0 };
  else if (pl?.kind === 'wall') next = { ...position, y: pl.height };
  else if (pl?.kind === 'above') {
    const b = baseBox(pl.baseId);
    if (b) next = { x: b.x + pl.offsetX, y: b.y + b.h + pl.gap, z: b.z };
  }
  return next.x === position.x && next.y === position.y && next.z === position.z ? position : next;
}

// ---------------------------------------------------------------------------
// Dragging a piece on the plan (ADR-065)
// ---------------------------------------------------------------------------

/** The step a drag or an arrow key moves a piece by (ADR-065); typed values stay exact to 1 mm. */
export const DRAG_STEP: Mm = 10;

/**
 * Where a piece lands after being moved `dxMm` / `dzMm` on the plan: the move is rounded to whole `step`s, so the
 * piece keeps its own millimetres and moves by multiples of the step. No clamping and no snapping (ADR-008): a
 * position outside the room or over another piece is kept and reported by the usual diagnostics.
 */
export function dragPosition(
  item: ProjectItem,
  dxMm: number,
  dzMm: number,
  step: Mm = DRAG_STEP,
): ProjectItem['position'] {
  const snap = (d: number) => (Number.isFinite(d) ? Math.round(d / step) * step : 0) || 0;
  return { ...item.position, x: item.position.x + snap(dxMm), z: item.position.z + snap(dzMm) };
}

/**
 * Where a tap on the plan puts a piece being placed (ADR-056): its left-back corner at the room point, in whole mm,
 * clamped to x ≥ 0 and z ≥ 0; its height is kept. A piece dropped from the piece list starts here too (ADR-094).
 */
export function tapPosition(item: ProjectItem, x: number, z: number): ProjectItem['position'] {
  const mm = (v: number) => (Number.isFinite(v) ? Math.max(0, Math.round(v)) : 0);
  return { ...item.position, x: mm(x), z: mm(z) };
}

/**
 * A piece placed on or above another piece leaves it when dragged (ADR-065): wall-hung pieces become hung on the
 * wall at their current height, anything else stands on the floor. Other placements are returned unchanged.
 */
export function liftOff(item: ProjectItem): Placement | undefined {
  if (item.placement?.kind !== 'above') return item.placement;
  return isWallHung(item.design) ? { kind: 'wall', height: item.position.y } : { kind: 'floor' };
}

// ---------------------------------------------------------------------------
// Locked pieces (ADR-095)
// ---------------------------------------------------------------------------

/** A quarter turn on from `r`: `dir` 1 turns the front from facing you to facing right (ADR-069). */
export const quarterTurn = (r: QuarterTurn, dir: 1 | -1): QuarterTurn =>
  ((((r + dir * 90) % 360) + 360) % 360) as QuarterTurn;

/** A piece's whole turn in degrees, 0–359 (ADR-121): its quarter turn plus its extra angle. */
export const rotationOf = (item: Pick<ProjectItem, 'rotationY' | 'angle'>): number =>
  item.rotationY + (item.angle ?? 0);

/** Whole degrees as a quarter turn and the extra angle the item stores (ADR-121); null outside 0–359. */
export function splitRotation(deg: number): { rotationY: QuarterTurn; angle?: number } | null {
  if (!Number.isInteger(deg) || deg < 0 || deg > 359) return null;
  const rotationY = (Math.floor(deg / 90) * 90) as QuarterTurn,
    angle = deg - rotationY;
  return angle ? { rotationY, angle } : { rotationY };
}

/** The turn after mirroring left–right (ADR-121): the front's sideways part flips, so θ becomes −θ. */
export function mirroredRotation(item: Pick<ProjectItem, 'rotationY' | 'angle'>) {
  return splitRotation((360 - rotationOf(item)) % 360)!;
}

/** The piece's placement is locked: nothing moves or turns it (ADR-095). */
export const isLocked = (item: Pick<ProjectItem, 'locked'> | undefined): boolean => !!item?.locked;

/** The hint shown when a locked piece is dragged, turned or mirrored (ADR-095). */
export const LOCKED_HINT = t('Locked — unlock to move');
/** The hint shown where a turn-locked piece would be turned (ADR-171). */
export const TURN_LOCKED_HINT = t('Turn locked — unlock to turn');
export const isTurnLocked = (item: Pick<ProjectItem, 'turnLocked'> | undefined): boolean =>
  !!item?.turnLocked;

/** Lock or unlock a piece's turn (ADR-171); the flag is absent when unlocked. The same project when nothing changes. */
export function setTurnLocked(project: Project, id: string, on: boolean): Project {
  const it = project.items.find((i) => i.id === id);
  if (!it || isTurnLocked(it) === on) return project;
  const { turnLocked: _l, ...rest } = it;
  void _l;
  const next: ProjectItem = on ? { ...rest, turnLocked: true } : rest;
  return { ...project, items: project.items.map((i) => (i.id === id ? next : i)) };
}

/**
 * Why the pieces `ids` may not turn (ADR-171), or null: one of them, or a piece carried by one of them, has its turn
 * locked. The reason names the piece. A placement lock (ADR-095) is `moveBlocked`'s.
 */
export function turnBlocked(project: Project, ids: readonly string[]): string | null {
  const turning = new Set(ids);
  const own =
    project.items.find((it) => turning.has(it.id) && it.turnLocked) ??
    carriedBy(project, ids, (it) => !!it.turnLocked).find((it) => it.turnLocked);
  if (!own) return null;
  return t('{name} has its turn locked — unlock it to turn it.', {
    name: pieceName(project, own.id),
  });
}

/** What a move helper did: the project after it, or the same project and why nothing moved (ADR-095). */
export interface MoveResult {
  project: Project;
  reason?: string;
}

/** A piece's name, with its number in the project when another piece has the same name. */
/** A project diagnostic that is one piece's own warning carried into the project's checks (ADR-258). */
export const PIECE_WARNINGS = new WeakSet<Diagnostic>();
export const isPieceWarning = (d: Diagnostic): boolean => PIECE_WARNINGS.has(d);

export function pieceName(project: Project, id: string): string {
  const i = project.items.findIndex((x) => x.id === id);
  const stored = project.items[i]?.design.name ?? '';
  // A built-in name in the user's language (ADR-265); a name the user typed stays as typed.
  const name = tr(stored);
  return project.items.some((x) => x.id !== id && x.design.name === stored)
    ? t('{name} (piece {n})', { name, n: i + 1 })
    : name;
}

/** The pieces placed directly on each piece (ADR-031), by base id. */
function piecesOn(project: Project): Map<string, ProjectItem[]> {
  const on = new Map<string, ProjectItem[]>();
  for (const it of project.items)
    if (it.placement?.kind === 'above') {
      const list = on.get(it.placement.baseId);
      if (list) list.push(it);
      else on.set(it.placement.baseId, [it]);
    }
  return on;
}

/**
 * Pieces resting on any of `ids`, directly or on each other (ADR-031): they follow them when they move. Each piece once,
 * none of `ids` themselves; `stop` ends the walk early at the first piece it accepts (returned last).
 */
export function carriedBy(
  project: Project,
  ids: string | readonly string[],
  stop?: (it: ProjectItem, base: string) => boolean,
): ProjectItem[] {
  const roots = typeof ids === 'string' ? [ids] : ids;
  const on = piecesOn(project);
  const seen = new Set(roots);
  const out: ProjectItem[] = [];
  const todo = roots.map((id) => ({ id, root: id }));
  for (let next = todo.shift(); next; next = todo.shift())
    for (const c of on.get(next.id) ?? []) {
      if (seen.has(c.id)) continue;
      seen.add(c.id);
      out.push(c);
      if (stop?.(c, next.root)) return out;
      todo.push({ id: c.id, root: next.root });
    }
  return out;
}

/**
 * Why moving or turning the pieces `ids` is refused (ADR-095), or null: one of them is locked, or a locked piece rests
 * on one of them and would follow it. The reason names the locked piece.
 */
export function moveBlocked(project: Project, ids: readonly string[]): string | null {
  const moving = new Set(ids);
  const own = project.items.find((it) => moving.has(it.id) && it.locked);
  if (own)
    return t('{name} is locked — unlock it to move it.', { name: pieceName(project, own.id) });
  let base = '';
  const found = carriedBy(project, ids, (it, root) => {
    base = root;
    return !!it.locked;
  }).at(-1);
  if (!found?.locked) return null;
  const b = pieceName(project, base);
  return t('{name} sits on {base} and is locked — unlock it to move {base}.', {
    name: pieceName(project, found.id),
    base: b,
  });
}

/**
 * Move piece `id` on the plan by a drag or an arrow key (ADR-065): rounded to `step`, lifted off a base. A locked
 * piece, or one carrying a locked piece, stays where it is and the reason comes back (ADR-095). The same project comes
 * back when nothing would move.
 */
export function moveBy(
  project: Project,
  id: string,
  dxMm: number,
  dzMm: number,
  step: Mm = DRAG_STEP,
): MoveResult {
  const it = project.items.find((i) => i.id === id);
  if (!it) return { project };
  const position = dragPosition(it, dxMm, dzMm, step);
  if (position.x === it.position.x && position.z === it.position.z) return { project };
  const reason = moveBlocked(project, [id]);
  if (reason) return { project, reason };
  const placement = liftOff(it);
  const { placement: _old, ...rest } = it;
  void _old;
  const moved: ProjectItem = { ...rest, position, ...(placement ? { placement } : {}) };
  return { project: { ...project, items: project.items.map((i) => (i.id === id ? moved : i)) } };
}

/** Lock or unlock a piece's placement (ADR-095); the flag is absent when unlocked. */
export function setLocked(project: Project, id: string, on: boolean): Project {
  const it = project.items.find((i) => i.id === id);
  if (!it || isLocked(it) === on) return project;
  const { locked: _l, ...rest } = it;
  void _l;
  const next: ProjectItem = on ? { ...rest, locked: true } : rest;
  return { ...project, items: project.items.map((i) => (i.id === id ? next : i)) };
}

/**
 * Keep a piece as it is although its template has revision `revision` (ADR-096 "Keep mine"): the notice stays hidden
 * until the template moves past it. Nothing about the piece itself changes.
 */
export function keepTemplate(project: Project, id: string, revision: number): Project {
  const it = project.items.find((i) => i.id === id);
  if (!it || !Number.isSafeInteger(revision) || revision < 1 || it.templateSeen === revision)
    return project;
  return {
    ...project,
    items: project.items.map((i) => (i.id === id ? { ...i, templateSeen: revision } : i)),
  };
}

/**
 * Link a piece to the catalog template it was saved as (ADR-107): its design's `catalog.origin` becomes `origin`; the
 * rest of the piece is unchanged. A "Keep mine" mark for an earlier origin no longer applies and goes.
 */
export function linkItemOrigin(
  project: Project,
  id: string,
  origin: NonNullable<CatalogMeta['origin']>,
): Project {
  if (!project.items.some((i) => i.id === id)) return project;
  return {
    ...project,
    items: project.items.map((i) => {
      if (i.id !== id) return i;
      const { templateSeen: _seen, ...rest } = i;
      void _seen;
      return { ...rest, design: { ...i.design, catalog: { ...i.design.catalog, origin } } };
    }),
  };
}

/** Remove a piece; pieces that sat on it stay where they are (their placement becomes free). */
/**
 * Why removing the pieces `ids` is refused (ADR-243), or null: one of them has its placement locked (ADR-095). The
 * reason names the piece; the user unlocks it first.
 */
export function removeBlocked(project: Project, ids: readonly string[]): string | null {
  const gone = new Set(ids);
  const own = project.items.find((it) => gone.has(it.id) && it.locked);
  return own
    ? t('{name} is locked — unlock it to remove it.', { name: pieceName(project, own.id) })
    : null;
}

export function removeProjectItem(project: Project, id: string): Project {
  const items = project.items
    .filter((i) => i.id !== id)
    .map((i) => {
      if (i.placement?.kind !== 'above' || i.placement.baseId !== id) return i;
      const { placement: _gone, ...rest } = i;
      void _gone;
      return rest;
    });
  // Run parts asked for over this piece (ADR-075) follow the pieces that are left.
  const runRequests = project.runRequests
    ?.map((r) => ({ ...r, from: r.from.filter((x) => x !== id) }))
    .filter((r) => r.from.length);
  return pruneShared(
    pruneConnections(
      pruneCommon(pruneGroups({ ...project, items, ...(runRequests ? { runRequests } : {}) })),
    ),
  );
}

/** Placement problems: a missing base, a piece resting on itself, a piece in the air that is not built to hang. */
export function placementIssues(project: Project): Diagnostic[] {
  const out: Diagnostic[] = [];
  const byId = new Map(project.items.map((i) => [i.id, i]));
  for (const it of project.items) {
    const pl = it.placement;
    const name = it.design.name;
    if (pl?.kind === 'above') {
      const base = byId.get(pl.baseId);
      if (!base)
        out.push({
          severity: 'warning',
          code: 'placement-base-missing',
          message: t(
            '{name} was placed on a piece that is no longer in the project; it stays where it is.',
            { name },
          ),
          nodeId: it.id,
        });
      else if (!placementBases(project, it.id).some((b) => b.id === base.id))
        out.push({
          severity: 'error',
          code: 'placement-cycle',
          message: t('{name} and {other} are placed on each other.', {
            name,
            other: base.design.name,
          }),
          nodeId: it.id,
        });
    }
    const hangs = pl?.kind === 'wall' ? pl.height > 0 : pl?.kind === 'above' ? pl.gap > 0 : false;
    if (hangs && !isWallHung(it.design))
      out.push({
        severity: 'warning',
        code: 'placement-not-hung',
        message: t(
          '{name} is off the floor with nothing under it; set it to hang on wall brackets (Whole cabinet → Stands on).',
          { name },
        ),
        nodeId: it.id,
      });
    if (pl?.kind === 'floor' && isWallHung(it.design))
      out.push({
        severity: 'warning',
        code: 'placement-wall-on-floor',
        message: t('{name} is built to hang on the wall but is placed on the floor.', { name }),
        nodeId: it.id,
      });
  }
  // A model placed on a piece that is gone keeps its place (ADR-208).
  for (const m of project.models ?? [])
    if (m.placement?.kind === 'above' && !byId.has(m.placement.baseId))
      out.push({
        severity: 'warning',
        code: 'placement-base-missing',
        message: t(
          '{name} was placed on a piece that is no longer in the project; it stays where it is.',
          { name: m.name },
        ),
        nodeId: m.id,
      });
  return out;
}
