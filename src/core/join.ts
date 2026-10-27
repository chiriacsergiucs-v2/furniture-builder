/**
 * Joined outer pieces (ff N122, user request 2026-10-27): touching pieces of a project keep their own boxes, but the
 * outer board they line up on (the bottoms of a row of wall cabinets, the outer sides of a stacked column) is cut as
 * one common board. The common board replaces each piece's own board on that side; the pieces' other boards that run
 * into it are shortened to stand on it. Only the join (side + pieces) is saved; the board is rebuilt from the pieces
 * on every build, and anything that does not line up is an error, never guessed (ADR-008).
 */
import { overlaps, sizeOn, union } from './geometry';
import { materialKey, type PlacedPiece, type Project, type QuarterTurn } from './project';
import type { Axis, Box, Diagnostic, Face, Material, Mm, Panel } from './types';

export type JoinSide = 'top' | 'bottom' | 'left' | 'right';
export const JOIN_SIDES: JoinSide[] = ['bottom', 'top', 'left', 'right'];

/** Saved in `project.joins` (project schemaVersion 10). Item ids in run order. */
export interface Join {
  id: string;
  side: JoinSide;
  itemIds: string[];
}

export const JOIN_NAME: Record<JoinSide, string> = {
  top: 'top',
  bottom: 'bottom',
  left: 'left side',
  right: 'right side',
};

/** What a join changes in one piece, in the piece's own coordinates (panel ids as `buildModel` gives them). */
export interface JoinEdit {
  remove: Set<string>;
  clip: Map<string, Box>;
}

export interface JoinPlan {
  /** Per item id. */
  edits: Map<string, JoinEdit>;
  /** The common boards, in room coordinates, material ids as `materialKey`. */
  panels: Panel[];
  materials: Material[];
  diagnostics: Diagnostic[];
}

const CARCASS = new Set(['side', 'top', 'bottom']);
const lo = (b: Box, a: Axis) => (a === 'x' ? b.x : a === 'y' ? b.y : b.z);
const hi = (b: Box, a: Axis) => lo(b, a) + sizeOn(b, a);
const setRange = (b: Box, a: Axis, from: Mm, to: Mm): Box =>
  a === 'x'
    ? { ...b, x: from, w: to - from }
    : a === 'y'
      ? { ...b, y: from, h: to - from }
      : { ...b, z: from, d: to - from };
const AXES: Axis[] = ['x', 'y', 'z'];

/** The room axis a piece's own width runs along. */
const widthAxis = (r: QuarterTurn): Axis => (r % 180 === 0 ? 'x' : 'z');
/** The room axis the pieces of a join follow each other along. */
export const runAxis = (side: JoinSide, r: QuarterTurn): Axis =>
  side === 'top' || side === 'bottom' ? widthAxis(r) : 'y';

const turnBack = (b: Box, r: QuarterTurn): Box => {
  switch (r) {
    case 0:
      return b;
    case 90:
      return { x: -(b.z + b.d), y: b.y, z: b.x, w: b.d, h: b.h, d: b.w };
    case 180:
      return { x: -(b.x + b.w), y: b.y, z: -(b.z + b.d), w: b.w, h: b.h, d: b.d };
    case 270:
      return { x: b.z, y: b.y, z: -(b.x + b.w), w: b.d, h: b.h, d: b.w };
  }
};

/** The piece's own board on that side, by its own coordinates; null with the reason when there is not one. */
function outerPanel(pc: PlacedPiece, side: JoinSide): { panel: Panel; local: Panel } | string {
  const own = pc.model.panels;
  const role = side === 'left' || side === 'right' ? 'side' : side;
  const cand = own.filter((p) => p.role === role);
  if (!cand.length) return `${pc.item.design.name} has no ${JOIN_NAME[side]} board.`;
  const key = (p: Panel) =>
    side === 'bottom'
      ? -p.box.y
      : side === 'top'
        ? p.box.y + p.box.h
        : side === 'left'
          ? -p.box.x
          : p.box.x + p.box.w;
  const best = Math.max(...cand.map(key));
  const outer = cand.filter((p) => key(p) === best);
  if (outer.length !== 1)
    return `${pc.item.design.name}: its ${JOIN_NAME[side]} is ${outer.length} boards, not one.`;
  const i = own.indexOf(outer[0]);
  return { panel: pc.panels[i], local: outer[0] };
}

/** Plan every join of the project over its placed pieces (`buildProjectModel`'s, or `placeItem` of each item). */
export function planJoins(project: Project, pieces: PlacedPiece[]): JoinPlan {
  const plan: JoinPlan = { edits: new Map(), panels: [], materials: [], diagnostics: [] };
  const byId = new Map(pieces.map((pc) => [pc.item.id, pc]));
  const mats = new Map<string, Material>();
  for (const j of project.joins ?? []) {
    const src = j.itemIds.map((id) => byId.get(id)).filter((pc): pc is PlacedPiece => !!pc);
    if (src.length < 2) continue;
    const res = planOne(j, src);
    if (typeof res === 'string') {
      plan.diagnostics.push({
        severity: 'error',
        code: 'join-invalid',
        message: `Common ${JOIN_NAME[j.side]} (${src.map((pc) => pc.item.design.name).join(' + ')}): ${res} Separate it or line the pieces up.`,
        nodeId: src[0].item.id,
        itemIds: src.map((pc) => pc.item.id),
      });
      continue;
    }
    // A piece already changed by another join: two common boards meeting at a corner are not worked out.
    const hit = plan.panels.find((q) => overlaps(q.box, res.panel.box));
    if (hit) {
      plan.diagnostics.push({
        severity: 'error',
        code: 'join-invalid',
        message: `${res.panel.label} and ${hit.label} take the same corner; separate one of them.`,
        nodeId: src[0].item.id,
        itemIds: src.map((pc) => pc.item.id),
      });
      continue;
    }
    for (const [id, e] of res.edits) {
      const cur = plan.edits.get(id);
      if (!cur) plan.edits.set(id, e);
      else {
        for (const r of e.remove) cur.remove.add(r);
        for (const [k, b] of e.clip) cur.clip.set(k, b);
      }
    }
    plan.panels.push(res.panel);
    if (!mats.has(res.material.id)) mats.set(res.material.id, res.material);
  }
  plan.materials = [...mats.values()];
  return plan;
}

function planOne(
  j: Join,
  src: PlacedPiece[],
): string | { panel: Panel; material: Material; edits: Map<string, JoinEdit> } {
  if (src.some((pc) => pc.item.quantity > 1)) return 'a piece with copies cannot share a board.';
  const r = src[0].item.rotationY;
  if (src.some((pc) => pc.item.rotationY !== r)) return 'the pieces face different ways.';
  const outers: { pc: PlacedPiece; panel: Panel; local: Panel }[] = [];
  for (const pc of src) {
    const o = outerPanel(pc, j.side);
    if (typeof o === 'string') return o;
    outers.push({ pc, ...o });
  }
  const first = outers[0];
  const t = first.panel.thicknessAxis;
  const mat = first.pc.item.design.materials.find((m) => m.id === first.local.materialId);
  if (!mat) return 'its board is missing.';
  const key = materialKey(mat);
  const run = runAxis(j.side, r);
  const cross = AXES.find((a) => a !== t && a !== run)!;
  if (t === run) return 'the boards do not lie along the pieces.';
  for (const o of outers) {
    const m = o.pc.item.design.materials.find((x) => x.id === o.local.materialId);
    if (o.panel.thicknessAxis !== t || !m || materialKey(m) !== key)
      return `${o.pc.item.design.name} has a different ${JOIN_NAME[j.side]} board.`;
    if (
      lo(o.panel.box, t) !== lo(first.panel.box, t) ||
      hi(o.panel.box, t) !== hi(first.panel.box, t)
    )
      return `${o.pc.item.design.name}'s ${JOIN_NAME[j.side]} is not in line with the others.`;
    if (
      lo(o.panel.box, cross) !== lo(first.panel.box, cross) ||
      hi(o.panel.box, cross) !== hi(first.panel.box, cross)
    )
      return `${o.pc.item.design.name}'s ${JOIN_NAME[j.side]} is ${sizeOn(o.panel.box, cross)} mm deep, not ${sizeOn(first.panel.box, cross)}.`;
  }
  // The pieces must follow each other with no gap along the run.
  const sorted = [...src].sort((a, b) => lo(a.bounds, run) - lo(b.bounds, run));
  for (let i = 1; i < sorted.length; i++)
    if (hi(sorted[i - 1].bounds, run) !== lo(sorted[i].bounds, run))
      return `${sorted[i - 1].item.design.name} and ${sorted[i].item.design.name} do not touch.`;
  // The common board: the outer board's thickness and depth, as long as the carcasses together.
  const carcass = union(
    src.flatMap((pc) => pc.panels.filter((p) => CARCASS.has(p.role)).map((p) => p.box)),
  );
  const slab = setRange(first.panel.box, run, lo(carcass, run), hi(carcass, run));
  // The board's outer face: the face away from the middle of its piece.
  const outward =
    lo(first.panel.box, t) + hi(first.panel.box, t) <
    lo(first.pc.bounds, t) + hi(first.pc.bounds, t)
      ? -1
      : 1;
  const s0 = lo(slab, t),
    s1 = hi(slab, t);
  const edits = new Map<string, JoinEdit>();
  for (const pc of src) {
    const e: JoinEdit = { remove: new Set(), clip: new Map() };
    const outer = outers.find((o) => o.pc === pc)!;
    e.remove.add(outer.local.id);
    for (let i = 0; i < pc.panels.length; i++) {
      const p = pc.panels[i],
        local = pc.model.panels[i];
      if (p === outer.panel || !overlaps(p.box, slab)) continue;
      const p0 = lo(p.box, t),
        p1 = hi(p.box, t);
      if (p0 >= s0 && p1 <= s1) {
        e.remove.add(local.id);
        continue;
      }
      if ((outward < 0 && p0 < s0) || (outward > 0 && p1 > s1) || p.shape)
        return `${pc.item.design.name}: ${p.label} runs past the ${JOIN_NAME[j.side]}.`;
      const clipped = outward < 0 ? setRange(p.box, t, s1, p1) : setRange(p.box, t, p0, s0);
      // Back to the piece's own coordinates: the same move and turn as `placeItem`, undone.
      e.clip.set(local.id, toLocal(clipped, p.box, local.box, r));
    }
    edits.set(pc.item.id, e);
  }
  const banded = new Set<Face>(outers.flatMap((o) => o.panel.banded));
  // The common board's two ends are now the outer edges of the whole run.
  banded.add(`-${run}` as Face).add(`+${run}` as Face);
  const names = sorted.map((pc) => pc.item.design.name).join(' + ');
  const panel: Panel = {
    id: `run:join-${j.id}`,
    nodeId: `run:join-${j.id}`,
    role: first.panel.role,
    label: `Common ${JOIN_NAME[j.side]} (${names})`,
    materialId: key,
    box: slab,
    thicknessAxis: t,
    grainAxis: first.panel.grainAxis === t ? run : first.panel.grainAxis,
    banded: [...banded],
  };
  return { panel, material: { ...mat, id: key }, edits };
}

/** A room box clipped from `room` back into the piece: the panel's own box changed by the same amount. */
function toLocal(clipped: Box, room: Box, local: Box, r: QuarterTurn): Box {
  const a = turnBack(room, r),
    b = turnBack(clipped, r);
  return {
    x: local.x + (b.x - a.x),
    y: local.y + (b.y - a.y),
    z: local.z + (b.z - a.z),
    w: local.w + (b.w - a.w),
    h: local.h + (b.h - a.h),
    d: local.d + (b.d - a.d),
  };
}

/** A piece's own panels with a join's changes: replaced boards gone, shortened ones cut to the common board. */
export function applyJoinEdit(panels: Panel[], e: JoinEdit | undefined): Panel[] {
  if (!e) return panels;
  return panels
    .filter((p) => !e.remove.has(p.id))
    .map((p) => {
      const b = e.clip.get(p.id);
      if (!b) return p;
      // Shelf-pin holes are measured from the panel's bottom and rear edges (ADR-023).
      const dy = b.y - p.box.y,
        dz = b.z - p.box.z;
      const pinRows = p.pinRows
        ?.map((x) => ({
          ...x,
          holes: x.holes.map((h) => h - dy).filter((h) => h > 0 && h < b.h),
          rows: x.rows.map((h) => h - dz),
        }))
        .filter((x) => x.holes.length);
      return { ...p, box: b, ...(p.pinRows ? { pinRows } : {}) };
    });
}

/**
 * The pieces a join from `itemId` on `side` takes: the piece and every piece touching it in line along the run (side
 * by side for a top or bottom, stacked for a side) whose board on that side sits in the same plane. Run order.
 */
export function joinChain(pieces: PlacedPiece[], itemId: string, side: JoinSide): string[] {
  const start = pieces.find((pc) => pc.item.id === itemId);
  if (!start) return [];
  const o = outerPanel(start, side);
  if (typeof o === 'string') return [itemId];
  const r = start.item.rotationY;
  const run = runAxis(side, r);
  const t = o.panel.thicknessAxis;
  const fits = (pc: PlacedPiece) => {
    if (pc.item.rotationY !== r) return false;
    const q = outerPanel(pc, side);
    return typeof q !== 'string' && lo(q.panel.box, t) === lo(o.panel.box, t);
  };
  const others = AXES.filter((a) => a !== run);
  const touching = (a: Box, b: Box) =>
    hi(a, run) === lo(b, run) &&
    others.every((k) => Math.min(hi(a, k), hi(b, k)) > Math.max(lo(a, k), lo(b, k)));
  const chain = [start];
  for (let cur = start; ;) {
    const next = pieces.find(
      (pc) => !chain.includes(pc) && touching(cur.bounds, pc.bounds) && fits(pc),
    );
    if (!next) break;
    chain.push(next);
    cur = next;
  }
  for (let cur = start; ;) {
    const prev = pieces.find(
      (pc) => !chain.includes(pc) && touching(pc.bounds, cur.bounds) && fits(pc),
    );
    if (!prev) break;
    chain.unshift(prev);
    cur = prev;
  }
  return chain.map((pc) => pc.item.id);
}

/** Joins keep only pieces still in the project; one left with fewer than two goes. */
export function pruneJoins(project: Project): Project {
  if (!project.joins) return project;
  const ids = new Set(project.items.map((i) => i.id));
  const joins = project.joins
    .map((j) => ({ ...j, itemIds: j.itemIds.filter((x) => ids.has(x)) }))
    .filter((j) => j.itemIds.length >= 2);
  const same =
    joins.length === project.joins.length &&
    joins.every((j, i) => j.itemIds.length === project.joins![i].itemIds.length);
  return same ? project : { ...project, joins };
}

/** Add a join, replacing any join on the same side that shares a piece with it. */
export function addJoin(project: Project, join: Join): Project {
  const keep = (project.joins ?? []).filter(
    (j) => j.side !== join.side || !j.itemIds.some((x) => join.itemIds.includes(x)),
  );
  return { ...project, joins: [...keep, join] };
}

export const removeJoin = (project: Project, id: string): Project => ({
  ...project,
  joins: (project.joins ?? []).filter((j) => j.id !== id),
});

export function validJoins(v: unknown, ids: Set<string>): boolean {
  if (!Array.isArray(v)) return false;
  return v.every(
    (j) =>
      typeof j === 'object' &&
      j !== null &&
      typeof (j as Join).id === 'string' &&
      !!(j as Join).id &&
      JOIN_SIDES.includes((j as Join).side) &&
      Array.isArray((j as Join).itemIds) &&
      (j as Join).itemIds.length >= 2 &&
      (j as Join).itemIds.every((x) => typeof x === 'string' && ids.has(x)),
  );
}
