/**
 * Repairs for project diagnostics (ADR-071). A repair is a description and the project it leads to; it is only
 * offered when, built again, its diagnostic is gone and no other error has appeared. Nothing here applies a repair:
 * the user previews one and applies it (one undo step). No diagnostic is hidden or softened (ADR-008).
 */
import { overlapsBox } from './shape';
import {
  buildProjectModel,
  pieceName,
  refreshRunParts,
  resolvePlacements,
  type PlacedPiece,
  type Project,
  type ProjectItem,
  type ProjectModel,
  type RunPart,
} from './project';
import { movesInside } from './room';
import type { Box, Diagnostic, Material, Mm } from './types';

export interface Repair {
  /** Stable within one list, for the UI. */
  id: string;
  /** What it does, with the amount: "Move Tall 600 34 mm to the right". */
  label: string;
  /** How far things move, mm: the list is sorted by it, smallest first (the default, ADR-071 open question). */
  distance: Mm;
  /** The project after the repair, as a commit stores it (placements resolved, run parts refreshed). */
  project: Project;
  /** Outlines of what moved or was added, room mm, for the preview on the plan. */
  preview: { id: string; box: Box }[];
}

/** At most this many repairs are listed for one problem, smallest first. */
export const MAX_REPAIRS = 4;

/** The codes repairs exist for (ADR-071). */
export const REPAIRABLE = new Set(['pieces-overlap', 'opening-blocked', 'outside-room']);

/** A problem with a repair family (ADR-071): an overlap, a front blocked by another piece, a piece outside the room. */
export const mayRepair = (d: Diagnostic) =>
  REPAIRABLE.has(d.code) && (d.itemIds?.length ?? 0) === (d.code === 'outside-room' ? 1 : 2);

/** The same problem in another build: same code, and the same front, or else the same pieces. */
export function sameProblem(a: Diagnostic, b: Diagnostic): boolean {
  if (a.code !== b.code) return false;
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

type Candidate = Omit<Repair, 'project' | 'preview' | 'id'> & { project: Project; added?: string };

const side = (axis: 'x' | 'z', s: number) =>
  axis === 'x'
    ? s > 0
      ? 'to the right'
      : 'to the left'
    : s > 0
      ? 'away from the back wall'
      : 'towards the back wall';

export { pieceName };

function moveCandidate(
  project: Project,
  pc: PlacedPiece,
  axis: 'x' | 'z',
  s: Mm,
): Candidate | null {
  const next = moveItem(project, pc.item.id, axis === 'x' ? s : 0, axis === 'z' ? s : 0);
  return next
    ? {
        label: `Move ${pieceName(project, pc.item.id)} ${Math.abs(s)} mm ${side(axis, s)}`,
        distance: Math.abs(s),
        project: next,
      }
    : null;
}

function hangCandidate(project: Project, pc: PlacedPiece, dy: Mm): Candidate | null {
  const next = rehang(project, pc.item.id, dy);
  return next
    ? {
        label: `Hang ${pieceName(project, pc.item.id)} ${Math.abs(dy)} mm ${dy > 0 ? 'higher' : 'lower'}`,
        distance: Math.abs(dy),
        project: next,
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
  const b = pc.bounds,
    m = frontBoard(pc);
  if (!m) return null;
  const along = pc.facing.axis === 'z' ? 'x' : 'z';
  const t = m.thickness;
  const gap0 = s > 0 ? (along === 'x' ? b.x : b.z) : (along === 'x' ? b.x + b.w : b.z + b.d) + s;
  const front =
    pc.facing.axis === 'z'
      ? pc.facing.sign > 0
        ? b.z + b.d - t
        : b.z
      : pc.facing.sign > 0
        ? b.x + b.w - t
        : b.x;
  const w = Math.abs(s);
  const box: Box =
    along === 'x'
      ? { x: gap0, y: b.y, z: front, w, h: b.h, d: t }
      : { x: front, y: b.y, z: gap0, w: t, h: b.h, d: w };
  const key = `filler|${pc.item.id},${other.item.id}`;
  const part: RunPart = {
    id: key,
    key,
    from: [pc.item.id, other.item.id],
    kind: 'filler',
    label: 'Filler',
    reason: `${w} mm gap so ${pc.item.design.name} opens clear of ${other.item.design.name} (repair)`,
    box,
    material: { ...m },
    thicknessAxis: along === 'x' ? 'z' : 'x',
    grainAxis: 'y',
    banded: along === 'x' ? ['-x', '+x', '-y', '+y'] : ['-z', '+z', '-y', '+y'],
  };
  const moved = moveItem(project, pc.item.id, along === 'x' ? s : 0, along === 'z' ? s : 0);
  if (!moved) return null;
  return {
    label: `Move ${pieceName(project, pc.item.id)} ${w} mm ${side(along, s)} and add a ${w} mm filler`,
    distance: w,
    project: {
      ...moved,
      runParts: [...(moved.runParts ?? []).filter((r) => r.key !== key), part],
    },
    added: key,
  };
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
  } else if (d.code === 'outside-room' && ids.length === 1) {
    const pc = byId.get(ids[0]);
    const room = project.room;
    if (!pc || !room) return [];
    const b = pc.bounds;
    if (b.y + b.h > room.height) out.push(hangCandidate(project, pc, room.height - (b.y + b.h)));
    for (const m of movesInside(room.outline, b).slice(0, 6)) {
      const parts = [
        m.dx ? `${Math.abs(m.dx)} mm ${side('x', m.dx)}` : '',
        m.dz ? `${Math.abs(m.dz)} mm ${side('z', m.dz)}` : '',
      ].filter(Boolean);
      const next = moveItem(project, pc.item.id, m.dx, m.dz);
      if (next)
        out.push({
          label: `Move ${pieceName(project, pc.item.id)} ${parts.join(' and ')}, inside the room`,
          distance: Math.abs(m.dx) + Math.abs(m.dz),
          project: next,
        });
    }
  }
  return out.filter((c): c is Candidate => !!c && c.distance > 0);
}

/**
 * The repairs offered for one diagnostic of `project` (whose model is `pm`), smallest move first. Each one is built
 * again and kept only if its diagnostic is gone and it adds no error; the first `max` that pass are returned.
 * Empty for codes without repairs.
 */
export function repairsFor(
  project: Project,
  pm: ProjectModel,
  d: Diagnostic,
  max = MAX_REPAIRS,
): Repair[] {
  if (!REPAIRABLE.has(d.code)) return [];
  const before = new Set(pm.diagnostics.filter((e) => e.severity === 'error').map(errorKey));
  const seen = new Set<string>();
  const out: Repair[] = [];
  const boundsOf = (m: ProjectModel) =>
    new Map<string, Box>([...m.pieces.map((pc) => [pc.item.id, pc.bounds] as [string, Box])]);
  const was = boundsOf(pm);
  // A locked piece is never moved by a repair (ADR-095), neither directly nor by following its base.
  const locked = pm.pieces.filter((pc) => pc.item.locked).map((pc) => pc.item.id);
  for (const c of candidates(project, pm, d).sort((a, b) => a.distance - b.distance)) {
    if (out.length >= max) break;
    if (seen.has(c.label)) continue;
    seen.add(c.label);
    const next = settle(c.project);
    if (c.added && !(next.runParts ?? []).some((r) => r.key === c.added)) continue;
    const after = buildProjectModel(next);
    if (locked.length) {
      const now = boundsOf(after);
      if (locked.some((id) => JSON.stringify(now.get(id)) !== JSON.stringify(was.get(id))))
        continue;
    }
    if (after.diagnostics.some((e) => sameProblem(d, e))) continue;
    if (after.diagnostics.some((e) => e.severity === 'error' && !before.has(errorKey(e)))) continue;
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
