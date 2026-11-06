/**
 * Repairs for project diagnostics (ADR-071). A repair is a description and the project it leads to; it is only
 * offered when, built again, its diagnostic is gone and no other error has appeared. Nothing here applies a repair:
 * the user previews one and applies it (one undo step). No diagnostic is hidden or softened (ADR-008). A repair that
 * moves a piece carries its whole group and its connected pieces, as a drag does (ADR-176); one they cannot follow
 * is listed refused, with the reason, and cannot be applied.
 * ADR-204: a depth or height mismatch between neighbours (ADR-100) is repaired by making one piece as deep or as high as
 * the other, both ways; a size-locked size gets none, a size bound to a variable is listed refused, and linked copies
 * follow (ADR-111).
 * ADR-209 (replaces ADR-071's "only with automatic refresh off"): the filler repair adds a run request of kind `filler`,
 * planned with the run parts, so automatic refresh keeps it and the repair is offered with refresh on too.
 */
import { carryUnits } from './connections';
import { t as tx } from './i18n';
import { propagateLinks } from './linked';
import { resizeProduct } from './pieceSize';
import { isAxisLocked } from './sizeLock';
import { bindingOf } from './variables';
import { overlapsBox } from './shape';
import {
  buildProjectModel,
  pieceName,
  planRuns,
  refreshRunParts,
  requestKey,
  resolvePlacements,
  type PlacedPiece,
  type Project,
  type ProjectItem,
  type ProjectModel,
  type RunRequest,
} from './project';
import { boxInside, movesInside } from './room';
import type { Box, Diagnostic, Material, Mm } from './types';

export interface Repair {
  /** Stable within one list, for the UI. */
  id: string;
  /** What it does, with the amount: "Move Tall 600 34 mm to the right". */
  label: string;
  /** How far things move, mm: the list is sorted by it, smallest first (the default, ADR-071 open question). */
  distance: Mm;
  /**
   * The project after the repair, as a commit stores it (placements resolved, run parts refreshed); for a refused
   * repair, the project as it is (nothing to apply).
   */
  project: Project;
  /** Outlines of what moved or was added, room mm, for the preview on the plan (empty when refused). */
  preview: { id: string; box: Box }[];
  /**
   * Why it cannot be applied (ADR-176): the piece's group or a connected piece cannot follow the move. Listed so the
   * user sees why; applying it does nothing.
   */
  refused?: string;
}

/** A repair that can be applied: not refused (ADR-176). */
export const applicable = (r: Repair) => !r.refused;

/** At most this many repairs are listed for one problem, smallest first. */
export const MAX_REPAIRS = 4;

/**
 * The codes repairs exist for (ADR-071; the depth and height matches ADR-204; a back over a pipe or outlet, ADR-205;
 * the family warning, ADR-210).
 */
export const REPAIRABLE = new Set([
  'pieces-overlap',
  'opening-blocked',
  'outside-room',
  'compat-depth-match',
  'compat-height-match',
  'covers-service',
  'compat-family',
]);

/**
 * A problem with a repair family (ADR-071): an overlap, a front blocked by another piece, a piece outside the room; a
 * back covering a pipe or outlet, which can be cut around it (ADR-205).
 */
export const mayRepair = (d: Diagnostic) =>
  REPAIRABLE.has(d.code) &&
  (d.code === 'covers-service'
    ? !!d.featureId && d.itemIds?.length === 1
    : (d.itemIds?.length ?? 0) === (d.code === 'outside-room' ? 1 : 2));

/** The same problem in another build: same code, and the same front, or else the same pieces. */
export function sameProblem(a: Diagnostic, b: Diagnostic): boolean {
  if (a.code !== b.code) return false;
  // The same pipe or outlet behind the same piece (ADR-205).
  if ((a.featureId || b.featureId) && a.featureId !== b.featureId) return false;
  if (a.panelIds?.length) return (b.panelIds ?? []).join(',') === a.panelIds.join(',');
  const ids = (d: Diagnostic) => [...(d.itemIds ?? [d.nodeId ?? ''])].sort().join(',');
  return ids(a) === ids(b);
}

const errorKey = (d: Diagnostic) =>
  `${d.code}|${[...(d.itemIds ?? [d.nodeId ?? ''])].sort().join(',')}|${(d.panelIds ?? []).join(',')}`;

/** What a commit does to a project before storing it (the store's commitProject does the same). */
export const settle = (p: Project): Project => refreshRunParts(resolvePlacements(p));

/**
 * Move one piece by dx, dz (whole mm). A piece placed on another stays on it and slides along it (its offset
 * changes); it cannot move towards or away from the wall without leaving its base, so that move is null (not offered).
 */
export function moveItem(project: Project, id: string, dx: Mm, dz: Mm): Project | null {
  const it = project.items.find((i) => i.id === id);
  if (!it) return null;
  let moved: ProjectItem;
  if (it.placement?.kind === 'above') {
    if (dz) return null;
    moved = { ...it, placement: { ...it.placement, offsetX: it.placement.offsetX + dx } };
  } else
    moved = { ...it, position: { ...it.position, x: it.position.x + dx, z: it.position.z + dz } };
  return { ...project, items: project.items.map((i) => (i.id === id ? moved : i)) };
}

/** Hang a wall-hung piece `dy` mm higher (negative: lower); null for pieces not hung on the wall. */
function rehang(project: Project, id: string, dy: Mm): Project | null {
  const it = project.items.find((i) => i.id === id);
  if (it?.placement?.kind !== 'wall') return null;
  const height = it.placement.height + dy;
  return {
    ...project,
    items: project.items.map((i) =>
      i.id === id ? { ...i, placement: { kind: 'wall', height } } : i,
    ),
  };
}

/** The panels involved in a problem, for the highlight in 3D: the pieces' panels inside its box. */
export function problemPanels(pm: ProjectModel, d: Diagnostic): string[] {
  if (!d.itemIds?.length) return d.panelIds ?? [];
  const ids = d.itemIds.map((id) => `${id}:`);
  const own = pm.model.panels.filter((p) => ids.some((k) => p.id.startsWith(k)));
  const b = d.box;
  const inBox = b && b.w > 0 && b.d > 0 && b.h > 0 ? own.filter((p) => overlapsBox(p, b)) : [];
  return [...new Set([...(d.panelIds ?? []), ...(inBox.length ? inBox : own).map((p) => p.id)])];
}

type Candidate = Omit<Repair, 'project' | 'preview' | 'id' | 'refused'> & {
  project: Project;
  added?: string;
  /** The piece the repair moves: its group and connected pieces follow it (ADR-176). */
  lead: string;
  /** Listed refused with this reason whatever it would do (ADR-204: a size bound to a variable). */
  refusedWhy?: string;
};

const side = (axis: 'x' | 'z', s: number) =>
  axis === 'x'
    ? s > 0
      ? tx('to the right')
      : tx('to the left')
    : s > 0
      ? tx('away from the back wall')
      : tx('towards the back wall');

export { pieceName };

function moveCandidate(
  project: Project,
  pc: PlacedPiece,
  axis: 'x' | 'z',
  s: Mm,
): Candidate | null {
  if (pc.item.locked) return null;
  const next = moveItem(project, pc.item.id, axis === 'x' ? s : 0, axis === 'z' ? s : 0);
  return next
    ? {
        label: tx('Move {name} {mm} mm {side}', {
          name: pieceName(project, pc.item.id),
          mm: Math.abs(s),
          side: side(axis, s),
        }),
        distance: Math.abs(s),
        project: next,
        lead: pc.item.id,
      }
    : null;
}

function hangCandidate(project: Project, pc: PlacedPiece, dy: Mm): Candidate | null {
  if (pc.item.locked) return null;
  const next = rehang(project, pc.item.id, dy);
  return next
    ? {
        label:
          dy > 0
            ? tx('Hang {name} {mm} mm higher', {
                name: pieceName(project, pc.item.id),
                mm: Math.abs(dy),
              })
            : tx('Hang {name} {mm} mm lower', {
                name: pieceName(project, pc.item.id),
                mm: Math.abs(dy),
              }),
        distance: Math.abs(dy),
        project: next,
        lead: pc.item.id,
      }
    : null;
}

/** Shifts along `axis` that take box `m` clear of box `o` on that axis (both ways). */
function clearShifts(m: Box, o: Box, axis: 'x' | 'z'): Mm[] {
  const [p, w] = axis === 'x' ? (['x', 'w'] as const) : (['z', 'd'] as const);
  return [o[p] + o[w] - m[p], o[p] - (m[p] + m[w])];
}

/** The board of a piece's fronts (fillers are made of it, as in ADR-054). */
function frontBoard(pc: PlacedPiece): Material {
  const p = pc.item.design.product;
  const id = p.kind === 'cabinet' || p.kind === 'corner' ? p.params.frontMaterialId : '';
  return pc.item.design.materials.find((m) => m.id === id) ?? pc.item.design.materials[0];
}

/**
 * Move the door's piece sideways by `s` (along the wall it stands on) and close the gap it leaves with a filler of
 * `s` mm in its front plane, made of its front board (ADR-054 fillers).
 */
function fillerCandidate(
  project: Project,
  pc: PlacedPiece,
  other: PlacedPiece,
  s: Mm,
): Candidate | null {
  const m = frontBoard(pc);
  if (!m || pc.item.locked) return null;
  const along = pc.facing.axis === 'z' ? 'x' : 'z';
  const w = Math.abs(s);
  const key = `filler|${pc.item.id},${other.item.id}`;
  const moved = moveItem(project, pc.item.id, along === 'x' ? s : 0, along === 'z' ? s : 0);
  if (!moved) return null;
  // The filler is a run request (ADR-209): planned with the run parts, so automatic refresh keeps it and moves it with
  // the pieces. With refresh off, its part is added now, as asking for a run part does.
  const req: RunRequest = { kind: 'filler', from: [pc.item.id, other.item.id], width: w };
  const withReq: Project = {
    ...moved,
    runRequests: [...(moved.runRequests ?? []).filter((r) => requestKey(r) !== key), req],
    runPartsRemoved: (moved.runPartsRemoved ?? []).filter((k) => k !== key),
  };
  const planned = planRuns(resolvePlacements(withReq)).parts.find((r) => r.key === key);
  return {
    label: tx('Move {name} {mm} mm {side} and add a {mm} mm filler', {
      name: pieceName(project, pc.item.id),
      mm: w,
      side: side(along, s),
    }),
    distance: w,
    project: {
      ...withReq,
      runParts: [
        ...(withReq.runParts ?? []).filter((r) => r.key !== key),
        ...(planned ? [planned] : []),
      ],
    },
    added: key,
    lead: pc.item.id,
  };
}

/**
 * Make `pc` as deep (or high) as `other` (ADR-204): its carcass depth set to the other's, or its height changed by the
 * difference of their outside heights. None for a size-locked size (ADR-122, ADR-171); refused for a size bound to a
 * variable (ADR-166). Linked copies take the same change (ADR-111).
 */
function matchCandidate(
  project: Project,
  pc: PlacedPiece,
  other: PlacedPiece,
  axis: 'depth' | 'height',
): Candidate | null {
  const p = pc.item.design.product,
    o = other.item.design.product;
  if (
    (p.kind !== 'cabinet' && p.kind !== 'corner') ||
    (o.kind !== 'cabinet' && o.kind !== 'corner')
  )
    return null;
  if (isAxisLocked(pc.item, axis)) return null;
  const from = axis === 'depth' ? p.params.depth : p.params.height;
  const to = axis === 'depth' ? o.params.depth : p.params.height + (other.bounds.h - pc.bounds.h);
  if (to === from || to <= 0) return null;
  const vars = {
    name: pieceName(project, pc.item.id),
    mm: to,
    other: pieceName(project, other.item.id),
  };
  const label =
    axis === 'depth'
      ? tx('Make {name} {mm} mm deep like {other}', vars)
      : tx('Make {name} {mm} mm high like {other}', vars);
  const base = { label, distance: Math.abs(to - from), lead: pc.item.id };
  if (bindingOf(pc.item, axis))
    return {
      ...base,
      project,
      refusedWhy: tx('The size follows a project variable; change the variable instead.'),
    };
  const design = { ...pc.item.design, product: resizeProduct(p, axis, to) };
  const next: Project = {
    ...project,
    items: project.items.map((i) => (i.id === pc.item.id ? { ...i, design } : i)),
  };
  return { ...base, project: propagateLinks(project, next, true) };
}

/** Whether two boxes share volume. */
const boxesOverlap = (a: Box, b: Box) =>
  a.x < b.x + b.w &&
  b.x < a.x + a.w &&
  a.z < b.z + b.d &&
  b.z < a.z + a.d &&
  a.y < b.y + b.h &&
  b.y < a.y + a.h;

/**
 * The family warning's repair (ADR-210): piece `pc` moves along its wall in direction `dir` to the nearest spot where
 * it touches no piece side by side, overlaps none and stays in the room. Null when there is none or it is locked.
 */
function apartCandidate(
  project: Project,
  pm: ProjectModel,
  pc: PlacedPiece,
  dir: 1 | -1,
): Candidate | null {
  if (pc.item.locked) return null;
  const axis: 'x' | 'z' = pc.facing.axis === 'z' ? 'x' : 'z';
  const others = pm.pieces.filter((o) => o.item.id !== pc.item.id);
  const m = pc.bounds;
  const lo = (b: Box) => (axis === 'x' ? b.x : b.z);
  const len = (b: Box) => (axis === 'x' ? b.w : b.d);
  // The spots to try: 1 mm off where it is, and 1 mm past each other piece's edge, in this direction.
  const shifts = new Set<number>([dir]);
  for (const o of others.map((x) => x.bounds)) {
    shifts.add(lo(o) + len(o) + 1 - lo(m));
    shifts.add(lo(o) - 1 - (lo(m) + len(m)));
  }
  const tries = [...shifts].filter((s) => s * dir > 0).sort((p, q) => Math.abs(p) - Math.abs(q));
  const room = project.room;
  for (const s of tries) {
    const box = axis === 'x' ? { ...m, x: m.x + s } : { ...m, z: m.z + s };
    if (room && !boxInside(room.outline, box)) continue;
    const touches = others.some((o) => {
      const b = o.bounds;
      if (boxesOverlap(box, b)) return true;
      // Side by side: one end face on the other's, with depth and height in common.
      const faces = lo(box) + len(box) === lo(b) || lo(b) + len(b) === lo(box);
      const across = axis === 'x' ? ['z', 'd'] : ['x', 'w'];
      const [p, w] = across as ['x' | 'z', 'w' | 'd'];
      const deep = Math.min(box[p] + box[w], b[p] + b[w]) - Math.max(box[p], b[p]);
      const high = Math.min(box.y + box.h, b.y + b.h) - Math.max(box.y, b.y);
      return faces && deep > 0 && high > 0;
    });
    if (touches) continue;
    return moveCandidate(project, pc, axis, s);
  }
  return null;
}

function candidates(project: Project, pm: ProjectModel, d: Diagnostic): Candidate[] {
  const byId = new Map(pm.pieces.map((pc) => [pc.item.id, pc]));
  const ids = d.itemIds ?? [];
  const out: (Candidate | null)[] = [];
  if (d.code === 'pieces-overlap' && ids.length === 2) {
    const [a, b] = ids.map((id) => byId.get(id));
    if (!a || !b) return [];
    // The second piece first, then the first; left or right along the wall, back or forward.
    for (const [m, o] of [
      [b, a],
      [a, b],
    ])
      for (const axis of ['x', 'z'] as const)
        for (const s of clearShifts(m.bounds, o.bounds, axis))
          out.push(moveCandidate(project, m, axis, s));
    // A wall-hung piece over or under the other can hang higher or lower instead.
    for (const [m, o] of [
      [b, a],
      [a, b],
    ]) {
      out.push(hangCandidate(project, m, o.bounds.y + o.bounds.h - m.bounds.y));
      out.push(hangCandidate(project, m, o.bounds.y - (m.bounds.y + m.bounds.h)));
    }
  } else if (d.code === 'opening-blocked' && ids.length === 2) {
    const other = byId.get(ids[0]),
      door = byId.get(ids[1]);
    const c = door?.clearances.find((x) => x.panelId === d.panelIds?.[0]);
    if (!other || !door || !c) return [];
    const f = door.facing.axis,
      across = f === 'x' ? 'z' : 'x';
    // The neighbour moves out of the space the front needs: away from it, or sideways.
    out.push(
      moveCandidate(
        project,
        other,
        f,
        clearShifts(other.bounds, c.box, f)[door.facing.sign > 0 ? 0 : 1],
      ),
    );
    for (const s of clearShifts(other.bounds, c.box, across))
      out.push(moveCandidate(project, other, across, s));
    // Or the door's piece moves along its wall, and a filler closes the gap.
    for (const s of clearShifts(c.box, other.bounds, across)) {
      const fc = fillerCandidate(project, door, other, s);
      if (fc) out.push(fc);
    }
  } else if (
    (d.code === 'compat-depth-match' || d.code === 'compat-height-match') &&
    ids.length === 2
  ) {
    const [a, b] = ids.map((id) => byId.get(id));
    if (!a || !b) return [];
    const axis = d.code === 'compat-depth-match' ? 'depth' : 'height';
    // Both ways: the second piece like the first, then the first like the second; sorted by the change in mm.
    out.push(matchCandidate(project, b, a, axis), matchCandidate(project, a, b, axis));
  } else if (d.code === 'compat-family' && ids.length === 2) {
    const [a, b] = ids.map((id) => byId.get(id));
    if (!a || !b) return [];
    // The later-placed piece first, then the other: along its wall, left or right, to the nearest spot (ADR-210).
    for (const m of [b, a])
      for (const dir of [1, -1] as const) out.push(apartCandidate(project, pm, m, dir));
  } else if (d.code === 'outside-room' && ids.length === 1) {
    const pc = byId.get(ids[0]);
    const room = project.room;
    if (!pc || !room) return [];
    const b = pc.bounds;
    if (b.y + b.h > room.height) out.push(hangCandidate(project, pc, room.height - (b.y + b.h)));
    for (const m of movesInside(room.outline, b).slice(0, 6)) {
      const parts = [
        m.dx ? tx('{mm} mm {side}', { mm: Math.abs(m.dx), side: side('x', m.dx) }) : '',
        m.dz ? tx('{mm} mm {side}', { mm: Math.abs(m.dz), side: side('z', m.dz) }) : '',
      ].filter(Boolean);
      const next = pc.item.locked ? null : moveItem(project, pc.item.id, m.dx, m.dz);
      if (next)
        out.push({
          label: tx('Move {name} {moves}, inside the room', {
            name: pieceName(project, pc.item.id),
            moves:
              parts.length === 2 ? tx('{a} and {b}', { a: parts[0], b: parts[1] }) : parts.join(''),
          }),
          distance: Math.abs(m.dx) + Math.abs(m.dz),
          project: next,
          lead: pc.item.id,
        });
    }
  }
  return out.filter((c): c is Candidate => !!c && c.distance > 0);
}

/**
 * The repairs offered for one diagnostic of `project` (whose model is `pm`), smallest move first. Each move is carried
 * to the moved piece's group and connected pieces (`carryUnits`, ADR-176); each one is built again and kept only if its
 * diagnostic is gone and it adds no error; the first `max` that pass are returned. A move its group cannot follow,
 * which would pass if the piece moved alone, is listed refused with the reason (at most `max` of those too; they do not
 * take the place of one that applies). Empty for codes without repairs.
 */
export function repairsFor(
  project: Project,
  pm: ProjectModel,
  d: Diagnostic,
  max = MAX_REPAIRS,
): Repair[] {
  if (!REPAIRABLE.has(d.code)) return [];
  if (d.code === 'covers-service') return backCutRepair(project, pm, d);
  const before = new Set(pm.diagnostics.filter((e) => e.severity === 'error').map(errorKey));
  const seen = new Set<string>();
  const out: Repair[] = [];
  const boundsOf = (m: ProjectModel) =>
    new Map<string, Box>([...m.pieces.map((pc) => [pc.item.id, pc.bounds] as [string, Box])]);
  const was = boundsOf(pm);
  // A locked piece is never moved by a repair (ADR-095): candidates that move it are not made, and one that moves it by
  // moving its base is dropped here.
  const locked = pm.pieces.filter((pc) => pc.item.locked).map((pc) => pc.item.id);
  /** The settled project and its model, when it clears the problem and adds no error; else null. */
  const passes = (c: Candidate, p: Project) => {
    const next = settle(p);
    if (c.added && !(next.runParts ?? []).some((r) => r.key === c.added)) return null;
    const after = buildProjectModel(next);
    if (locked.length) {
      const now = boundsOf(after);
      if (locked.some((id) => JSON.stringify(now.get(id)) !== JSON.stringify(was.get(id))))
        return null;
    }
    if (after.diagnostics.some((e) => sameProblem(d, e))) return null;
    if (after.diagnostics.some((e) => e.severity === 'error' && !before.has(errorKey(e))))
      return null;
    return { next, after };
  };
  let ok = 0,
    refused = 0;
  for (const c of candidates(project, pm, d).sort((a, b) => a.distance - b.distance)) {
    if (ok >= max) break;
    if (seen.has(c.label)) continue;
    seen.add(c.label);
    // A size bound to a variable (ADR-204): listed refused with the reason, never applied.
    if (c.refusedWhy) {
      if (refused >= max) continue;
      refused++;
      out.push({
        id: `r${out.length}`,
        label: c.label,
        distance: c.distance,
        project,
        preview: [],
        refused: c.refusedWhy,
      });
      continue;
    }

    // The whole group and the connected pieces follow the moved piece (ADR-176).
    const carried = carryUnits(project, c.project, [c.lead]);
    if (carried.reason) {
      // Refused: listed with the reason when the move would have cleared the problem on its own.
      if (refused >= max || !passes(c, c.project)) continue;
      refused++;
      out.push({
        id: `r${out.length}`,
        label: c.label,
        distance: c.distance,
        project,
        preview: [],
        refused: carried.reason,
      });
      continue;
    }
    const pass = passes(c, carried.project);
    if (!pass) continue;
    const { next, after } = pass;
    ok++;
    const preview: Repair['preview'] = [];
    for (const [id, b] of boundsOf(after)) {
      const o = was.get(id);
      if (!o || JSON.stringify(o) !== JSON.stringify(b)) preview.push({ id, box: b });
    }
    for (const r of next.runParts ?? [])
      if (r.key === c.added) preview.push({ id: `run:${r.id}`, box: r.box });
    out.push({
      id: `r${out.length}`,
      label: c.label,
      distance: c.distance,
      project: next,
      preview,
    });
  }
  return out;
}

/**
 * "Cut the back around it" (ADR-205): the back covering a pipe or outlet gets a cut-out exactly the size of its zone
 * (`ProjectItem.backCuts`); nothing is cut until the user applies it (ADR-072). Offered when, built again, the warning
 * is gone and no error appeared; a piece typed at an angle is refused with the reason.
 */
function backCutRepair(project: Project, pm: ProjectModel, d: Diagnostic): Repair[] {
  const id = d.itemIds?.[0] ?? d.nodeId;
  const item = project.items.find((i) => i.id === id);
  const fid = d.featureId;
  if (!item || !fid) return [];
  const label = tx('Cut the back around it');
  if (item.angle)
    return [
      {
        id: 'r0',
        label,
        distance: 0,
        project,
        preview: [],
        refused: tx(
          '{name} is typed at an angle: its back cannot be cut around a pipe or outlet; turn it to a quarter turn or move it.',
          { name: pieceName(project, item.id) },
        ),
      },
    ];
  if (item.backCuts?.includes(fid)) return [];
  const next = settle({
    ...project,
    items: project.items.map((i) =>
      i.id === item.id ? { ...i, backCuts: [...(i.backCuts ?? []), fid] } : i,
    ),
  });
  const after = buildProjectModel(next);
  const before = new Set(pm.diagnostics.filter((e) => e.severity === 'error').map(errorKey));
  if (after.diagnostics.some((e) => sameProblem(d, e))) return [];
  if (after.diagnostics.some((e) => e.severity === 'error' && !before.has(errorKey(e)))) return [];
  const pc = after.pieces.find((x) => x.item.id === item.id);
  return [
    {
      id: 'r0',
      label,
      distance: 0,
      project: next,
      preview: pc ? [{ id: item.id, box: pc.bounds }] : [],
    },
  ];
}
