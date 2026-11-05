/**
 * Step-by-step assembly list (ADR-174): a piece's panels ordered into steps by their role and what they touch —
 * bottom, sides, fixed dividers and shelves, top, back, plinth, adjustable shelves, drawer boxes, fronts and doors,
 * handles, hanging — each step with its parts, the carcass joints it closes (the pairs ADR-074 counts, assigned to
 * the later of the two panels' steps) and the hardware scheduled on its parts. The order comes from geometry and
 * roles only: it is guidance (ADR-010); the user's joints, fasteners and drilling decide. Pure.
 *
 * A project also gets an order of its pieces (ADR-178, `projectAssemblyOrder`): corner cabinets, base pieces wall by
 * wall from the corner, wall pieces, then the run parts.
 */
import { carcassJointPairs } from './fasteners';
import { t } from './i18n';
import { pt, type PrintKey } from './i18n/print';
import { partRo } from './ro';
import {
  isWallHung,
  type PlacedPiece,
  type Project,
  type ProjectModel,
  type RunPart,
} from './project';
import { NEAR_WALL, wallEnds, wallInward, type Pt, type Room } from './room';
import { insideCorner } from './roomfill';
import type {
  Box,
  FurnitureModel,
  HardwareItem,
  HardwareKind,
  Mm,
  Panel,
  PanelRole,
} from './types';

export type StepId =
  | 'bottom'
  | 'sides'
  | 'fixed'
  | 'top'
  | 'back'
  | 'plinth'
  | 'adjustable'
  | 'drawers'
  | 'fronts'
  | 'handles'
  | 'hang'
  | 'loose'
  | 'also';

export interface StepPart {
  /** Panel ids of the model (one entry per identical part). */
  panelIds: string[];
  label: string;
  quantity: number;
  /** Finished size, mm: length × width × thickness. */
  size: [number, number, number];
}

export interface AssemblyStep {
  id: StepId;
  /** Step number from 1, in order. */
  n: number;
  title: string;
  parts: StepPart[];
  /** Carcass joints this step closes (ADR-074's pairs). */
  joints: number;
  hardware: { kind: HardwareKind; label: string; quantity: number }[];
}

export const STEP_ORDER: StepId[] = [
  'bottom',
  'sides',
  'fixed',
  'top',
  'back',
  'plinth',
  'adjustable',
  'drawers',
  'fronts',
  'handles',
  'hang',
  'loose',
  'also',
];

/** Step titles: the `t()` keys shown on the tab; the printed sheet uses `pt()` with the same meaning. */
export const STEP_TITLE: Record<StepId, string> = {
  bottom: t('Bottom'),
  sides: t('Sides to the bottom'),
  fixed: t('Fixed dividers and shelves'),
  top: t('Top'),
  back: t('Back'),
  plinth: t('Plinth'),
  adjustable: t('Adjustable shelves'),
  drawers: t('Drawer boxes'),
  fronts: t('Doors and fronts'),
  handles: t('Handles'),
  hang: t('Hanging and fixing'),
  loose: t('Loose parts'),
  also: t('Also'),
};

/** The line every list and sheet carries (ADR-010). */
export const ASSEMBLY_GUIDANCE = t(
  "Guidance: order from the parts' positions; your joints, fasteners and drilling decide.",
);

const FRAME = new Set<PanelRole>([
  'leg',
  'apron',
  'stretcher',
  'slat',
  'ledger',
  'seat',
  'headboard',
  'footboard',
  'stile',
  'rung',
]);
const DRAWER = new Set<PanelRole>([
  'drawer-side',
  'drawer-back',
  'drawer-inner-front',
  'drawer-bottom',
]);
const FRONT = new Set<PanelRole>(['door', 'drawer-front', 'blind-panel']);

/** Hardware kinds by the step that fits them; the rest goes to "Hanging and fixing". */
const HW_STEP: Partial<Record<HardwareKind, StepId>> = {
  'shelf-pin': 'adjustable',
  'drawer-runner-pair': 'drawers',
  hinge: 'fronts',
  'corner-hinge': 'fronts',
  'front-fixing': 'fronts',
  'flap-stay': 'fronts',
  'push-latch': 'fronts',
  'sliding-track': 'fronts',
  handle: 'handles',
};

function stepOf(p: Panel, pinned: Set<string>, loose: boolean): StepId {
  if (loose) return 'loose';
  switch (p.role) {
    case 'bottom':
      return 'bottom';
    case 'side':
    case 'gable':
      return 'sides';
    case 'divider':
    case 'modesty':
      return 'fixed';
    case 'shelf':
      return pinned.has(p.nodeId) ? 'adjustable' : 'fixed';
    case 'top':
    case 'rail':
    case 'worktop':
      return 'top';
    case 'back':
      return 'back';
    case 'plinth':
      return 'plinth';
    default:
      if (DRAWER.has(p.role)) return 'drawers';
      if (FRONT.has(p.role)) return 'fronts';
      if (p.role === 'loose' || FRAME.has(p.role)) return 'loose';
      return 'also';
  }
}

const size = (p: Panel): [number, number, number] => {
  const dims = [p.box.w, p.box.h, p.box.d];
  const thick = p.thicknessAxis === 'x' ? 0 : p.thicknessAxis === 'y' ? 1 : 2;
  const [a, b] = dims.filter((_, i) => i !== thick).sort((x, y) => y - x);
  return [a, b, dims[thick]];
};

/** The steps for one piece's model; every panel is in exactly one step, every scheduled hardware item too. */
export function assemblySteps(model: FurnitureModel): AssemblyStep[] {
  const pinned = new Set(model.hardware.filter((h) => h.kind === 'shelf-pin').map((h) => h.nodeId));
  // A panel set (ADR-041) or frame furniture (ADR-038): one step, no order claimed.
  const loose = model.panels.some((p) => p.role === 'loose' || FRAME.has(p.role));
  const byStep = new Map<StepId, Panel[]>();
  const stepOfId = new Map<string, StepId>();
  for (const p of model.panels) {
    const s = stepOf(p, pinned, loose);
    stepOfId.set(p.id, s);
    byStep.set(s, [...(byStep.get(s) ?? []), p]);
  }
  // Joints: each carcass pair counts in the later of its two panels' steps.
  const joints = new Map<StepId, number>();
  for (const [a, b] of carcassJointPairs(model)) {
    const sa = STEP_ORDER.indexOf(stepOfId.get(a.id) ?? 'also'),
      sb = STEP_ORDER.indexOf(stepOfId.get(b.id) ?? 'also');
    const s = STEP_ORDER[Math.max(sa, sb)];
    joints.set(s, (joints.get(s) ?? 0) + 1);
  }
  const hw = new Map<StepId, HardwareItem[]>();
  for (const h of model.hardware) {
    const s = HW_STEP[h.kind] ?? 'hang';
    hw.set(s, [...(hw.get(s) ?? []), h]);
  }
  const steps: AssemblyStep[] = [];
  for (const id of STEP_ORDER) {
    const panels = byStep.get(id) ?? [];
    const items = hw.get(id) ?? [];
    if (!panels.length && !items.length && !(joints.get(id) ?? 0)) continue;
    const parts = new Map<string, StepPart>();
    for (const p of panels) {
      const sz = size(p);
      const key = `${p.label}|${sz.join('x')}|${p.materialId}`;
      const part = parts.get(key);
      if (part) {
        part.panelIds.push(p.id);
        part.quantity++;
      } else parts.set(key, { panelIds: [p.id], label: p.label, quantity: 1, size: sz });
    }
    const hardware = new Map<string, { kind: HardwareKind; label: string; quantity: number }>();
    for (const h of items) {
      const key = `${h.kind}|${h.label}`;
      const have = hardware.get(key);
      if (have) have.quantity += h.quantity;
      else hardware.set(key, { kind: h.kind, label: h.label, quantity: h.quantity });
    }
    steps.push({
      id,
      n: steps.length + 1,
      title: STEP_TITLE[id],
      parts: [...parts.values()],
      joints: joints.get(id) ?? 0,
      hardware: [...hardware.values()],
    });
  }
  return steps;
}

// ---------------------------------------------------------------------------
// Project assembly order (ADR-178): which piece goes in first
// ---------------------------------------------------------------------------

export type ProjectStageId = 'corners' | 'base' | 'wall' | 'run';

export const PROJECT_STAGE_ORDER: ProjectStageId[] = ['corners', 'base', 'wall', 'run'];

/** Stage titles: the `t()` keys shown on the tab; the printed sheet uses `pt()` with the same meaning. */
export const PROJECT_STAGE_TITLE: Record<ProjectStageId, string> = {
  corners: t('Corner cabinets'),
  base: t('Base pieces'),
  wall: t('Wall pieces'),
  run: t('Run parts'),
};

/** One line of a stage: a piece (linked copies once), run parts, a common top or bottom, or a sink cut-out. */
export interface OrderEntry {
  kind: 'piece' | RunPart['kind'] | 'common' | 'sink';
  /** Item ids for a piece, run part ids, common panel node ids (`common:<id>`) or sink ids. */
  ids: string[];
  /** The piece's name, or the part's label as the generators name it (English: `tr()` / `partRo()` to show). */
  name: string;
  /** Copies of a piece and its linked copies (ADR-111), or identical run parts: how many this line stands for. */
  times: number;
  /** The wall (from 0) the piece's back stands on; absent = on no wall, or no room. */
  wall?: number;
  /** A sink cut-out's width and depth, mm. */
  size?: [Mm, Mm];
}

export interface ProjectStage {
  id: ProjectStageId;
  /** Stage number from 1, in order. */
  n: number;
  title: string;
  entries: OrderEntry[];
}

/** Run parts in the order they go on: plinths, fillers and covers, cornices, worktops (then common panels, sinks). */
const RUN_RANK: Record<RunPart['kind'], number> = {
  plinth: 0,
  filler: 1,
  cover: 1,
  crown: 2,
  pelmet: 2,
  'ceiling-filler': 2,
  worktop: 3,
};

/** The wall whose line the piece's back stands on (within `NEAR_WALL`), its front facing into the room. */
function wallOf(room: Room, pc: PlacedPiece): number | undefined {
  const b = pc.bounds;
  let best: { i: number; gap: number } | undefined;
  for (let i = 0; i < room.outline.length; i++) {
    const [a, e] = wallEnds(room, i);
    const [nx, nz] = wallInward(room, i);
    let gap: number;
    if (a[1] === e[1] && nz !== 0) {
      if (pc.facing.axis !== 'z' || pc.facing.sign !== nz) continue;
      const lo = Math.min(a[0], e[0]),
        hi = Math.max(a[0], e[0]);
      if (!(b.x < hi && b.x + b.w > lo)) continue;
      gap = Math.abs((nz > 0 ? b.z : b.z + b.d) - a[1]);
    } else if (a[0] === e[0] && nx !== 0) {
      if (pc.facing.axis !== 'x' || pc.facing.sign !== nx) continue;
      const lo = Math.min(a[1], e[1]),
        hi = Math.max(a[1], e[1]);
      if (!(b.z < hi && b.z + b.d > lo)) continue;
      gap = Math.abs((nx > 0 ? b.x : b.x + b.w) - a[0]);
    } else continue;
    if (gap <= NEAR_WALL && (!best || gap < best.gap)) best = { i, gap };
  }
  return best?.i;
}

/** How far a box is from a point on the plan (0 when the point is on or inside it). */
const planGap = (b: Box, p: Pt) =>
  Math.max(b.x - p[0], 0, p[0] - (b.x + b.w)) + Math.max(b.z - p[1], 0, p[1] - (b.z + b.d));

/**
 * The end of wall `i` its pieces start from: the end with a corner cabinet; else the inside corner it shares with a
 * wall that has pieces of the same stage; else its start.
 */
function cornerEnd(
  room: Room,
  i: number,
  corners: PlacedPiece[],
  usedWalls: Set<number>,
): 'start' | 'end' {
  const n = room.outline.length;
  const [a, e] = wallEnds(room, i);
  if (corners.some((c) => planGap(c.bounds, a) <= NEAR_WALL)) return 'start';
  if (corners.some((c) => planGap(c.bounds, e) <= NEAR_WALL)) return 'end';
  const prev = (i - 1 + n) % n,
    next = (i + 1) % n;
  if (usedWalls.has(prev) && insideCorner(room, prev)) return 'start';
  if (usedWalls.has(next) && insideCorner(room, i)) return 'end';
  return 'start';
}

/** How far along wall `i` the piece starts, measured from the chosen end. */
function alongFrom(room: Room, i: number, from: 'start' | 'end', b: Box): number {
  const [a, e] = wallEnds(room, i);
  const [p, q] = from === 'start' ? [a, e] : [e, a];
  if (a[1] === e[1]) return q[0] > p[0] ? b.x - p[0] : p[0] - (b.x + b.w);
  return q[1] > p[1] ? b.z - p[1] : p[1] - (b.z + b.d);
}

/** On the floor (base stage), or not (wall stage): hung on the wall, on or above another piece, or lifted. */
const onFloor = (pc: PlacedPiece) => {
  const pl = pc.item.placement;
  if (pl?.kind === 'wall' || pl?.kind === 'above' || isWallHung(pc.item.design)) return false;
  return pc.bounds.y <= 0;
};

const byId = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);

/**
 * The project's assembly order (ADR-178): corner cabinets first, then the base pieces wall by wall (room wall order,
 * each wall from its corner end), then the wall pieces in the same order, then the run parts (plinths, fillers and
 * covers, cornices, worktops, common tops and bottoms, sinks). Pieces on no wall — every piece of a project without a
 * room — follow by plan x, then z. Linked copies are listed once with their count. Guidance from geometry only
 * (ADR-010). Pure and deterministic: the same project gives the same order. Empty stages are left out; no project
 * (a design alone), no stages.
 */
export function projectAssemblyOrder(
  project: Project | null | undefined,
  model: ProjectModel | null | undefined,
): ProjectStage[] {
  if (!project || !model) return [];
  const room = project.room && project.room.outline.length >= 3 ? project.room : undefined;
  const index = new Map(model.pieces.map((pc, k) => [pc.item.id, k]));
  const wall = new Map<string, number | undefined>(
    model.pieces.map((pc) => [pc.item.id, room ? wallOf(room, pc) : undefined]),
  );
  const byPlan = (a: PlacedPiece, b: PlacedPiece) =>
    a.bounds.x - b.bounds.x ||
    a.bounds.z - b.bounds.z ||
    index.get(a.item.id)! - index.get(b.item.id)!;
  const corners = model.pieces.filter((pc) => pc.item.design.product.kind === 'corner');
  const rest = model.pieces.filter((pc) => pc.item.design.product.kind !== 'corner');
  /** Pieces wall by wall, each from its corner end, then those on no wall by plan x, z. */
  const along = (list: PlacedPiece[]): PlacedPiece[] => {
    const onWall = new Map<number, PlacedPiece[]>();
    const loose: PlacedPiece[] = [];
    for (const pc of list) {
      const w = wall.get(pc.item.id);
      if (w === undefined || !room) loose.push(pc);
      else onWall.set(w, [...(onWall.get(w) ?? []), pc]);
    }
    const out: PlacedPiece[] = [];
    const used = new Set(onWall.keys());
    for (const w of [...used].sort((a, b) => a - b)) {
      const end = cornerEnd(room!, w, corners, used);
      const key = (pc: PlacedPiece) => alongFrom(room!, w, end, pc.bounds);
      out.push(...onWall.get(w)!.sort((a, b) => key(a) - key(b) || byPlan(a, b)));
    }
    return [...out, ...loose.sort(byPlan)];
  };
  const cornerOrder = [...corners].sort(
    (a, b) =>
      Number(!onFloor(a)) - Number(!onFloor(b)) ||
      (wall.get(a.item.id) ?? Infinity) - (wall.get(b.item.id) ?? Infinity) ||
      byPlan(a, b),
  );
  const pieceStages: [ProjectStageId, PlacedPiece[]][] = [
    ['corners', cornerOrder],
    ['base', along(rest.filter(onFloor))],
    ['wall', along(rest.filter((pc) => !onFloor(pc)))],
  ];
  // Linked copies once, where the first of them comes, with how many there are.
  const linked = new Map<string, OrderEntry>();
  const entries = new Map<ProjectStageId, OrderEntry[]>();
  for (const [id, list] of pieceStages) {
    const out: OrderEntry[] = [];
    for (const pc of list) {
      const link = pc.item.linkId;
      const have = link ? linked.get(link) : undefined;
      if (have) {
        have.ids.push(pc.item.id);
        have.times += pc.item.quantity;
        continue;
      }
      const w = wall.get(pc.item.id);
      const entry: OrderEntry = {
        kind: 'piece',
        ids: [pc.item.id],
        name: pc.item.design.name,
        times: pc.item.quantity,
        ...(w !== undefined ? { wall: w } : {}),
      };
      if (link) linked.set(link, entry);
      out.push(entry);
    }
    entries.set(id, out);
  }
  // Run parts (identical labels once, counted), common tops and bottoms, then sinks in the order of their bases.
  const run: OrderEntry[] = [];
  const same = new Map<string, OrderEntry>();
  const parts = [...(project.runParts ?? [])].sort(
    (a, b) =>
      RUN_RANK[a.kind] - RUN_RANK[b.kind] ||
      a.box.x - b.box.x ||
      a.box.z - b.box.z ||
      a.box.y - b.box.y ||
      byId(a.id, b.id),
  );
  for (const rp of parts) {
    const key = `${RUN_RANK[rp.kind]}|${rp.label}`;
    const have = same.get(key);
    if (have) {
      have.ids.push(rp.id);
      have.times++;
      continue;
    }
    const entry: OrderEntry = { kind: rp.kind, ids: [rp.id], name: rp.label, times: 1 };
    same.set(key, entry);
    run.push(entry);
  }
  const common = new Map<string, { label: string; box: Box }>();
  for (const p of model.model.panels)
    if (p.id.startsWith('common:') && !common.has(p.nodeId))
      common.set(p.nodeId, { label: p.label, box: p.box });
  for (const [id, c] of [...common].sort(
    ([ia, a], [ib, b]) => a.box.x - b.box.x || a.box.z - b.box.z || byId(ia, ib),
  ))
    run.push({ kind: 'common', ids: [id], name: c.label, times: 1 });
  const at = new Map<string, number>();
  PROJECT_STAGE_ORDER.flatMap((s) => entries.get(s) ?? []).forEach((e, k) =>
    e.ids.forEach((id) => at.set(id, k)),
  );
  for (const sk of (project.sinks ?? [])
    .filter((s) => at.has(s.baseId))
    .sort((a, b) => at.get(a.baseId)! - at.get(b.baseId)! || byId(a.id, b.id)))
    run.push({ kind: 'sink', ids: [sk.id], name: 'Sink cut-out', times: 1, size: [sk.w, sk.d] });
  entries.set('run', run);
  const stages: ProjectStage[] = [];
  for (const id of PROJECT_STAGE_ORDER) {
    const list = entries.get(id) ?? [];
    if (!list.length) continue;
    stages.push({ id, n: stages.length + 1, title: PROJECT_STAGE_TITLE[id], entries: list });
  }
  return stages;
}

/** Stage titles as print text keys (Romanian, ADR-020/157). */
const STAGE_PT: Record<ProjectStageId, PrintKey> = {
  corners: 'Corpuri de colț',
  base: 'Corpuri de jos',
  wall: 'Corpuri suspendate',
  run: 'Piese de rând',
};

/**
 * The Project order as the printed assembly sheet starts with it (ADR-178), in the print language (ADR-157): a
 * heading and each numbered stage with its lines (piece names as the user named them; part names via `partRo`).
 */
export function projectOrderPrint(stages: ProjectStage[]): {
  heading: string;
  stages: { n: number; title: string; lines: string[] }[];
} {
  return {
    heading: pt('Ordinea în proiect'),
    stages: stages.map((s) => ({
      n: s.n,
      title: pt(STAGE_PT[s.id]),
      lines: s.entries.map((e) => {
        const name =
          e.kind === 'sink'
            ? pt('Decupaj chiuvetă {w} × {d} mm', { w: e.size![0], d: e.size![1] })
            : e.kind === 'piece'
              ? e.name
              : partRo(e.name);
        const wall = e.wall !== undefined ? ` (${pt('peretele {n}', { n: e.wall + 1 })})` : '';
        return `${name}${e.times > 1 ? ` × ${e.times}` : ''}${wall}`;
      }),
    })),
  };
}
