/** Runs of pieces: gaps, run parts, handles, worktops, sinks and cut-outs (G-548 split, ADR-306). */
import { facesPlusX } from './projectWorktops';
import { trimSection, worktopEdgeOf, worktopFront } from './projectProfiles';
import { touchSideBySide } from './compat';
import { swapXZ } from './geometry';
import { meetInCorner, type Connection } from './connections';
import type {
  Axis,
  Box,
  Design,
  Diagnostic,
  Face,
  Handle,
  Material,
  Mm,
  Panel,
  PanelShape,
  Space,
} from './types';
import { t, type Key } from '@furniture-builder/i18n';
import {
  type Project,
  type ProjectItem,
  type RunPart,
  requestKey,
  isWallHung,
  type QuarterTurn,
  type RunHandle,
} from './projectDoc';
import { placeItem, type PlacedPiece, placedBounds } from './projectPlace';
import { type MoveResult, moveBlocked, resolvePlacements } from './projectMove';

// ---------------------------------------------------------------------------
// Gaps between pieces in a run
// ---------------------------------------------------------------------------

/** Open-interval overlap: pieces that only touch are not in each other's way. */
export const spans = (a0: Mm, a1: Mm, b0: Mm, b1: Mm) => Math.min(a1, b1) > Math.max(a0, b0);

/** Pieces at the same height and depth as `b`: a run along the wall (wall cabinets form their own run). */
const sameRun = (a: Box, b: Box) =>
  spans(a.y, a.y + a.h, b.y, b.y + b.h) && spans(a.z, a.z + a.d, b.z, b.z + b.d);

/** The nearest piece on the left of `id` in the same run, and the free space between them (null if none). */
export function leftNeighbour(project: Project, id: string): { item: ProjectItem; gap: Mm } | null {
  const pieces = project.items.map((i) => placeItem(i));
  const me = pieces.find((p) => p.item.id === id);
  if (!me) return null;
  let best: PlacedPiece | null = null;
  for (const pc of pieces) {
    if (pc === me || !sameRun(pc.bounds, me.bounds)) continue;
    const right = pc.bounds.x + pc.bounds.w;
    if (right > me.bounds.x) continue;
    if (!best || right > best.bounds.x + best.bounds.w) best = pc;
  }
  return best ? { item: best.item, gap: me.bounds.x - (best.bounds.x + best.bounds.w) } : null;
}

/**
 * Leave `gap` mm between piece `id` and its left neighbour by moving it along the wall. With `moveRight`, the pieces
 * on its right in the same run move by the same amount, so the rest of the run keeps its spacing. Refused, with the
 * reason, when it would move a locked piece (ADR-095).
 */
export function trySetGap(project: Project, id: string, gap: Mm, moveRight = true): MoveResult {
  const nb = leftNeighbour(project, id);
  const me = project.items.find((i) => i.id === id);
  if (!nb || !me || !Number.isSafeInteger(gap) || gap < 0) return { project };
  const dx = gap - nb.gap;
  if (!dx) return { project };
  const mine = placedBounds(me);
  const moves = (it: ProjectItem) => {
    if (it.id === id) return true;
    if (it.placement?.kind === 'above') return false;
    if (!moveRight) return false;
    const b = placedBounds(it);
    return b.x >= mine.x + mine.w && sameRun(b, mine);
  };
  const ids = new Set(project.items.filter(moves).map((i) => i.id));
  const reason = moveBlocked(project, [...ids]);
  if (reason) return { project, reason };
  return {
    project: resolvePlacements({
      ...project,
      items: project.items.map((it) =>
        ids.has(it.id) ? { ...it, position: { ...it.position, x: it.position.x + dx } } : it,
      ),
    }),
  };
}

/** `trySetGap` without the reason: the same project when nothing moves. */
export const setGapLeft = (project: Project, id: string, gap: Mm, moveRight = true): Project =>
  trySetGap(project, id, gap, moveRight).project;

/** Pieces whose own plinth is replaced by a run plinth (ADR-054). */
export function plinthCovered(project: Project): Set<string> {
  return new Set(
    (project.runParts ?? []).filter((r) => r.kind === 'plinth').flatMap((r) => r.from ?? []),
  );
}

export const runPanel = (
  rp: RunPart,
  materialId: string,
  cut?: { box: Box; shape?: PanelShape },
): Panel => ({
  ...(cut?.shape ? { shape: cut.shape } : {}),
  id: `run:${rp.id}`,
  nodeId: `run:${rp.id}`,
  role:
    rp.kind === 'worktop'
      ? 'worktop'
      : rp.kind === 'filler'
        ? 'filler'
        : rp.kind === 'plinth'
          ? 'plinth'
          : rp.kind === 'cover'
            ? 'cover-panel'
            : 'trim',
  label: rp.label,
  materialId,
  box: cut?.box ?? rp.box,
  thicknessAxis: rp.thicknessAxis,
  grainAxis: rp.grainAxis,
  banded: rp.banded,
});

/**
 * A run part's panel as drawn (ADR-209): a crown's or pelmet's profile (`section`), a worktop's rounded or bevelled
 * front edge (`edgeProfile`) and a hole per sink or hob cut-out in a worktop (a profile with `holes`, ADR-205). Only the
 * project build adds them; the cut list keeps the plain blank and its notes.
 */
export function followUpPanel(
  project: Project,
  rp: RunPart,
  panel: Panel,
  cuts: readonly CutoutOutline[],
): Panel {
  let p = panel;
  if (rp.kind === 'crown' || rp.kind === 'pelmet') {
    const section = trimSection(project.runRequests?.find((r) => requestKey(r) === rp.key));
    if (section) p = { ...p, section };
  }
  if (rp.kind !== 'worktop') return p;
  const e = worktopEdgeOf(project, rp);
  if (e) p = { ...p, edgeProfile: { ...e, face: worktopFront(rp) } };
  if (!cuts.length || p.thicknessAxis !== 'y') return p;
  const b = p.box;
  const holes = cuts.flatMap((c): [Mm, Mm][][] => {
    const u0 = c.box.x - b.x,
      v0 = c.box.z - b.z,
      u1 = u0 + c.box.w,
      v1 = v0 + c.box.d;
    // A cut-out past the worktop's edge has its diagnostic; it is not drawn as a hole.
    if (u0 <= 0 || v0 <= 0 || u1 >= b.w || v1 >= b.d) return [];
    return [
      [
        [u0, v0],
        [u1, v0],
        [u1, v1],
        [u0, v1],
      ],
    ];
  });
  if (!holes.length) return p;
  const own = p.shape?.kind === 'profile' ? p.shape : null;
  const points: [Mm, Mm][] = own
    ? own.points
    : [
        [0, 0],
        [b.w, 0],
        [b.w, b.d],
        [0, b.d],
      ];
  return {
    ...p,
    shape: {
      kind: 'profile',
      points,
      holes: [...(own?.holes ?? []), ...holes],
      ...(own?.cutouts ? { cutouts: own.cutouts } : {}),
    },
  };
}

/** Base units for runs: floor pieces facing the room (no turn) whose carcass is a cabinet or corner up to worktop height. */
export const RUN_MAX_HEIGHT = 950;
export const FILLER_MAX_GAP = 150;
export const WORKTOP_OVERHANG = 20;
export const worktopMaterial = (): Material => ({
  id: 'worktop38',
  name: 'Worktop 38',
  thickness: 38,
  grain: true,
  color: '#b89b74',
  sheet: { length: 4100, width: 600, trim: 10, count: null },
});

/** A base unit for a run (ADR-036): a floor cabinet or corner up to worktop height, not at an angle. */
const isRunBase = (pc: PlacedPiece) => {
  const k = pc.item.design.product.kind;
  return (
    (k === 'cabinet' || k === 'corner') &&
    !pc.item.angle &&
    pc.bounds.y === 0 &&
    pc.bounds.h <= RUN_MAX_HEIGHT &&
    !isWallHung(pc.item.design)
  );
};

/** The quarter turns runs are found at: facing the room along the back wall, and along the side walls (ADR-205). */
const RUN_TURNS = [0, 90, 270] as const;

/**
 * Runs of base units with gaps up to 150 mm (ADR-036): floor cabinets/corners facing the room side by side along x,
 * left → right, then (ADR-205) those turned a quarter (`rotationY` 90 or 270) along a side wall, side by side along z.
 * Every piece of a run has the same turn.
 */
function touchingRuns(placed: PlacedPiece[]): PlacedPiece[][] {
  const runs: PlacedPiece[][] = [];
  for (const r of RUN_TURNS) {
    const alongX = r === 0;
    const lo = (b: Box) => (alongX ? b.x : b.z),
      size = (b: Box) => (alongX ? b.w : b.d);
    const across = (b: Box): [Mm, Mm] => (alongX ? [b.z, b.z + b.d] : [b.x, b.x + b.w]);
    const base = placed
      .filter((pc) => isRunBase(pc) && pc.item.rotationY === r)
      .sort((a, b) => lo(a.bounds) - lo(b.bounds));
    const mine: PlacedPiece[][] = [];
    for (const pc of base) {
      const run = mine.find((rn) => {
        const last = rn[rn.length - 1];
        const gap = lo(pc.bounds) - (lo(last.bounds) + size(last.bounds));
        return (
          gap >= 0 && gap <= FILLER_MAX_GAP && spans(...across(last.bounds), ...across(pc.bounds))
        );
      });
      if (run) run.push(pc);
      else mine.push([pc]);
    }
    runs.push(...mine);
  }
  return runs;
}

/**
 * Runs of base units as legs (G-420): the touching runs above, joined by the stored connections that still hold
 * (ADR-168, ADR-207). Side-connected pieces put their runs in one leg (one turn, ordered along it); corner-connected
 * pieces put their legs in one run, legs in the order of the touching runs (back wall first). Without connections each
 * run is one leg, as before. Wall and stacked connections, and connections to pieces that are not base units, join
 * nothing.
 */
export function groupRunLegs(
  placed: PlacedPiece[],
  connections: readonly Connection[] = [],
): PlacedPiece[][][] {
  const runs = touchingRuns(placed);
  if (!connections.length) return runs.map((r) => [r]);
  const at = new Map<string, number>();
  runs.forEach((r, i) => r.forEach((pc) => at.set(pc.item.id, i)));
  // Two union-finds over run indices; each root is the smallest index of its set.
  const side = runs.map((_, i) => i),
    all = runs.map((_, i) => i);
  const find = (up: number[], i: number): number => (up[i] === i ? i : (up[i] = find(up, up[i])));
  const join = (up: number[], i: number, j: number) => {
    const a = find(up, i),
      b = find(up, j);
    if (a !== b) up[Math.max(a, b)] = Math.min(a, b);
  };
  for (const c of connections) {
    const kind = c.kind ?? 'side';
    if (kind !== 'side' && kind !== 'corner') continue;
    const i = at.get(c.itemIds[0]),
      j = at.get(c.itemIds[1]);
    if (i === undefined || j === undefined || i === j) continue;
    const a = runs[i].find((pc) => pc.item.id === c.itemIds[0])!,
      b = runs[j].find((pc) => pc.item.id === c.itemIds[1])!;
    // A connection that no longer holds has its warning (ADR-168) and joins nothing.
    if (kind === 'side' ? !touchSideBySide(a, b) : !meetInCorner(a, b)) continue;
    if (kind === 'side') join(side, i, j);
    join(all, i, j);
  }
  const legs = new Map<number, PlacedPiece[]>();
  runs.forEach((r, i) => {
    const k = find(side, i);
    legs.set(k, [...(legs.get(k) ?? []), ...r]);
  });
  const out = new Map<number, PlacedPiece[][]>();
  for (const [k, leg] of legs) {
    const lo = (pc: PlacedPiece) => (pc.item.rotationY === 0 ? pc.bounds.x : pc.bounds.z);
    const r = find(all, k);
    out.set(r, [...(out.get(r) ?? []), [...leg].sort((a, b) => lo(a) - lo(b))]);
  }
  return [...out.values()];
}

/**
 * Runs of base units (ADR-036, ADR-205): pieces in line with gaps up to 150 mm, joined by the stored side and corner
 * connections that hold (G-420). A run joined in a corner holds pieces of two turns, one leg after the other
 * (`groupRunLegs` keeps them apart).
 */
export function groupRuns(
  placed: PlacedPiece[],
  connections: readonly Connection[] = [],
): PlacedPiece[][] {
  return groupRunLegs(placed, connections).map((r) => r.flat());
}

/**
 * A run's own frame (ADR-205): runs along a side wall are planned as if they stood along the back wall, run along x
 * and front towards +z, then turned back. `toLocal` and `toRoom` are exact in integers.
 */
interface RunFrame {
  toLocal: (b: Box) => Box;
  toRoom: (b: Box) => Box;
  axis: (a: Axis) => Axis;
  face: (f: Face) => Face;
}
const SAME_FRAME: RunFrame = {
  toLocal: (b) => b,
  toRoom: (b) => b,
  axis: (a) => a,
  face: (f) => f,
};
export function runFrame(r: QuarterTurn): RunFrame {
  if (r === 90)
    return {
      toLocal: (b) => ({ x: b.z, y: b.y, z: b.x, w: b.d, h: b.h, d: b.w }),
      toRoom: (b) => ({ x: b.z, y: b.y, z: b.x, w: b.d, h: b.h, d: b.w }),
      axis: swapXZ,
      face: (f) => `${f[0]}${swapXZ(f[1] as Axis)}` as Face,
    };
  if (r === 270)
    return {
      toLocal: (b) => ({ x: b.z, y: b.y, z: -(b.x + b.w), w: b.d, h: b.h, d: b.w }),
      toRoom: (b) => ({ x: -(b.z + b.d), y: b.y, z: b.x, w: b.d, h: b.h, d: b.w }),
      axis: swapXZ,
      // Local +z (the front) is room -x; local x is room z.
      face: (f) =>
        f[1] === 'z'
          ? (`${f[0] === '+' ? '-' : '+'}x` as Face)
          : f[1] === 'x'
            ? (`${f[0]}z` as Face)
            : f,
    };
  return SAME_FRAME;
}

/** The ids of the run a piece belongs to (the same runs the run parts use), or null. */
export function runOf(project: Project, id: string): string[] | null {
  const ids = groupRuns(
    resolvePlacements(project).items.map((i) => placeItem(i)),
    project.connections,
  )
    .map((r) => r.map((pc) => pc.item.id))
    .find((r) => r.includes(id));
  return ids ?? null;
}

/** A design with one handle on every front that takes one (doors, drawer fronts; not drawers inside doors). */
function withHandle(d: Design, h: Handle): Design {
  const fix = (sp: Space, inside: boolean): Space => {
    const children =
      sp.kind === 'split' ? sp.children.map((c) => fix(c, inside || !!sp.front)) : undefined;
    const next = children ? ({ ...sp, children } as Space) : sp;
    return !inside && (next.front || next.kind === 'drawers') ? { ...next, handle: h } : next;
  };
  const p = d.product;
  if (p.kind === 'cabinet')
    return {
      ...d,
      product: { ...p, params: { ...p.params, interior: fix(p.params.interior, false) } },
    };
  if (p.kind === 'corner')
    return {
      ...d,
      product: {
        ...p,
        params: {
          ...p.params,
          interior: fix(p.params.interior, false),
          wingInterior: fix(p.params.wingInterior, false),
        },
      },
    };
  return d;
}

/** The pieces a run handle reaches now (ADR-125): the run holding any of its pieces, less those keeping their own. */
export function runHandleMembers(project: Project, rh: RunHandle): string[] {
  const runs = groupRuns(
    resolvePlacements(project).items.map((i) => placeItem(i)),
    project.connections,
  );
  const run = runs.find((r) => r.some((pc) => rh.from.includes(pc.item.id)));
  return run ? run.map((pc) => pc.item.id) : [];
}

/**
 * The run handle that reaches piece `itemId` (ADR-203, G-211), or undefined: the first run handle whose run holds the
 * piece and that the piece does not keep its own handles against, as `applyRunHandles` applies them.
 */
export function runHandleFor(project: Project, itemId: string): RunHandle | undefined {
  return project.runHandles?.find(
    (rh) => !rh.own?.includes(itemId) && runHandleMembers(project, rh).includes(itemId),
  );
}

/**
 * The project as built with its run handles (ADR-125): each piece of a handled run gets the run's handle on every
 * front, its line converted to the piece's own height. Pieces in `own` keep theirs; the first run handle wins.
 * The same project when there are none. Never saved: the pieces' designs keep their own handles.
 */
export function applyRunHandles(project: Project): Project {
  if (!project.runHandles?.length) return project;
  const placed = resolvePlacements(project).items.map((i) => placeItem(i));
  const runs = groupRuns(placed, project.connections);
  const handles = new Map<string, Handle>();
  for (const rh of project.runHandles) {
    const run = runs.find((r) => r.some((pc) => rh.from.includes(pc.item.id)));
    for (const pc of run ?? []) {
      if (rh.own?.includes(pc.item.id) || handles.has(pc.item.id)) continue;
      // Room height to the piece's own: the outline's lowest point (model bounds.y) sits at bounds.y in the room.
      const lineY =
        rh.height === undefined ? undefined : rh.height - pc.bounds.y + pc.model.bounds.y;
      handles.set(pc.item.id, {
        ...rh.handle,
        position: 'top',
        ...(lineY !== undefined ? { lineY } : {}),
      });
    }
  }
  if (!handles.size) return project;
  return {
    ...project,
    items: project.items.map((i) =>
      handles.has(i.id) ? { ...i, design: withHandle(i.design, handles.get(i.id)!) } : i,
    ),
  };
}

/**
 * Run handles, sinks and hobs keep only pieces still in the project (ADR-125, ADR-205). The same project when nothing
 * changes.
 */
export function pruneRunExtras(project: Project): Project {
  if (!project.runHandles && !project.sinks && !project.hobs) return project;
  const ids = new Set(project.items.map((i) => i.id));
  const handles = project.runHandles
    ?.map((rh) => ({
      ...rh,
      from: rh.from.filter((x) => ids.has(x)),
      ...(rh.own ? { own: rh.own.filter((x) => ids.has(x)) } : {}),
    }))
    .filter((rh) => rh.from.length);
  const sinks = project.sinks?.filter((sk) => ids.has(sk.baseId));
  const hobs = project.hobs?.filter((hb) => ids.has(hb.baseId));
  const same =
    JSON.stringify(handles) === JSON.stringify(project.runHandles) &&
    (sinks?.length ?? 0) === (project.sinks?.length ?? 0) &&
    (hobs?.length ?? 0) === (project.hobs?.length ?? 0);
  return same
    ? project
    : { ...project, runHandles: handles, sinks, ...(project.hobs ? { hobs } : {}) };
}

/** The run worktop over a base unit, if any (ADR-125). */
const worktopOver = (project: Project, baseId: string): RunPart | undefined =>
  (project.runParts ?? []).find((rp) => rp.kind === 'worktop' && rp.from?.includes(baseId));

/** Sinks for the shopping list (ADR-125): the base each is over and its cut-out. */
export function sinkList(project: Project): { over: string; w: Mm; d: Mm }[] {
  return (project.sinks ?? []).map((sk) => ({
    over: project.items.find((i) => i.id === sk.baseId)?.design.name ?? t('a removed piece'),
    w: sk.w,
    d: sk.d,
  }));
}

/** The wording of each cut-out's diagnostics (ADR-125 sinks, ADR-205 hobs). */
const CUTOUT_TEXT = {
  sink: {
    none: 'The sink over {name} has no worktop to be cut out of; add the run worktop.',
    deep: 'Sink cut-out {w} × {d} mm is as deep as the worktop over {name} ({depth} mm) or deeper.',
    wide: 'Sink cut-out {w} mm is wider than {name} under it ({width} mm).',
  },
  hob: {
    none: 'The hob over {name} has no worktop to be cut out of; add the run worktop.',
    deep: 'Hob cut-out {w} × {d} mm is as deep as the worktop over {name} ({depth} mm) or deeper.',
    wide: 'Hob cut-out {w} mm is wider than {name} under it ({width} mm).',
  },
} as const satisfies Record<'sink' | 'hob', Record<'none' | 'deep' | 'wide', Key>>;

/**
 * Diagnostics of the sinks or hobs (ADR-125, ADR-205): no worktop to cut, a cut-out wider than its base or through
 * the worktop.
 */
export function cutoutChecks(
  project: Project,
  placedById: Map<string, PlacedPiece>,
  kind: 'sink' | 'hob',
): Diagnostic[] {
  const out: Diagnostic[] = [];
  const text = CUTOUT_TEXT[kind];
  for (const sk of (kind === 'sink' ? project.sinks : project.hobs) ?? []) {
    const base = placedById.get(sk.baseId);
    if (!base) continue;
    const name = base.item.design.name;
    const top = worktopOver(project, sk.baseId);
    const nodeId = `${kind}:${sk.id}`;
    // Across its run: the worktop's depth along z on the back wall, along x on a side wall (ADR-205).
    const side = top?.grainAxis === 'z';
    const depth = top ? (side ? top.box.w : top.box.d) : 0;
    const width = side ? base.bounds.d : base.bounds.w;
    // A placed cut-out (ADR-209): its offset counts with its size.
    const at = CUTOUT_AT_TEXT[kind];
    if (!top)
      out.push({
        severity: 'warning',
        code: `${kind}-no-worktop`,
        message: t(text.none, { name }),
        nodeId,
      });
    else if ((sk.z ?? 0) + sk.d >= depth)
      out.push({
        severity: 'error',
        code: `${kind}-cutout-deep`,
        message:
          sk.z === undefined
            ? t(text.deep, { w: sk.w, d: sk.d, name, depth })
            : t(at.deep, { d: sk.d, z: sk.z, name, depth }),
        nodeId,
      });
    if ((sk.x ?? 0) + sk.w > width)
      out.push({
        severity: 'warning',
        code: `${kind}-cutout-wide`,
        message:
          sk.x === undefined
            ? t(text.wide, { w: sk.w, name, width })
            : t(at.wide, { w: sk.w, x: sk.x, name, width }),
        nodeId,
      });
  }
  return out;
}

const CUTOUT_AT_TEXT = {
  sink: {
    deep: 'Sink cut-out {d} mm deep at {z} mm from the front reaches the back of the worktop over {name} ({depth} mm) or past it.',
    wide: 'Sink cut-out {w} mm wide at {x} mm from the left goes past {name} under it ({width} mm).',
  },
  hob: {
    deep: 'Hob cut-out {d} mm deep at {z} mm from the front reaches the back of the worktop over {name} ({depth} mm) or past it.',
    wide: 'Hob cut-out {w} mm wide at {x} mm from the left goes past {name} under it ({width} mm).',
  },
} as const satisfies Record<'sink' | 'hob', Record<'deep' | 'wide', Key>>;

/** A sink or hob cut-out on the plan (ADR-205): dashed on its worktop, labelled with its size. */
export interface CutoutOutline {
  id: string;
  kind: 'sink' | 'hob';
  /** Room mm. */
  box: Box;
  /** The cut-out as typed: along the run × across it. */
  w: Mm;
  d: Mm;
  /** The worktop run part it is cut in. */
  partId: string;
  /** Where it is (ADR-209): from the base's left edge and from the worktop's front edge, mm (typed or centred). */
  x: Mm;
  z: Mm;
  /** Whether the user placed it (`x` or `z` typed); absent = centred, as ADR-205. */
  placed: boolean;
}

/**
 * Where each sink and hob cut-out is drawn (ADR-205): at the offsets the user typed (ADR-209: `x` from the base's left
 * edge, `z` from the worktop's front edge), else centred on its base along the run and on the worktop's depth, whole mm
 * (a half mm rounds down). Cut-outs without a worktop are not drawn (their diagnostic says why).
 */
export function cutoutOutlines(project: Project, pieces: PlacedPiece[]): CutoutOutline[] {
  const byId = new Map(pieces.map((pc) => [pc.item.id, pc]));
  const out: CutoutOutline[] = [];
  for (const [kind, list] of [
    ['sink', project.sinks],
    ['hob', project.hobs],
  ] as const)
    for (const c of list ?? []) {
      const base = byId.get(c.baseId)?.bounds;
      const part = worktopOver(project, c.baseId);
      if (!base || !part) continue;
      const top = part.box;
      const side = part.grainAxis === 'z';
      const width = side ? base.d : base.w,
        depth = side ? top.w : top.d;
      const x = c.x ?? Math.floor((width - c.w) / 2);
      const z = c.z ?? Math.floor((depth - c.d) / 2);
      // Across the run from the front edge: +z on the back wall; a side worktop faces +x or -x.
      const plus = !side || facesPlusX(part);
      const box: Box = side
        ? {
            x: c.z === undefined ? top.x + z : plus ? top.x + top.w - z - c.d : top.x + z,
            y: top.y,
            z: base.z + x,
            w: c.d,
            h: top.h,
            d: c.w,
          }
        : {
            x: base.x + x,
            y: top.y,
            z: c.z === undefined ? top.z + z : top.z + top.d - z - c.d,
            w: c.w,
            h: top.h,
            d: c.d,
          };
      out.push({
        id: `${kind}:${c.id}`,
        kind,
        box,
        w: c.w,
        d: c.d,
        partId: part.id,
        x,
        // Centred, `z` above was counted from the back (ADR-205's rounding); from the front it is the rest.
        z: c.z ?? depth - c.d - z,
        placed: c.x !== undefined || c.z !== undefined,
      });
    }
  return out;
}

/** A sink or hob cut-out's width as a dashed line on its worktop's top edge in the room front view (ADR-205, G-438). */
interface CutoutFrontLine {
  id: string;
  kind: 'sink' | 'hob';
  /** Room mm: the cut-out's left and right ends along the front view's x axis. */
  x1: Mm;
  x2: Mm;
  /** Height of the worktop's top face from the floor, mm (the view's y runs up). */
  y: Mm;
  /** The cut-out as typed (along the run), for its label. */
  w: Mm;
}

/** Where each cut-out's width is marked on the worktop in the front view: its x range from `cutoutOutlines`. */
export function cutoutFrontLines(cuts: readonly CutoutOutline[]): CutoutFrontLine[] {
  return cuts.map((c) => ({
    id: c.id,
    kind: c.kind,
    x1: c.box.x,
    x2: c.box.x + c.box.w,
    y: c.box.y + c.box.h,
    w: c.w,
  }));
}
