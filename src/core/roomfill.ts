/**
 * Fill the room (ADR-173): suggested mixes for every wall of a drawn room (ADR-058/059), built on Fill a wall
 * (ADR-103, ADR-104). Each wall is filled over its free stretches — a door keeps its opening free, a window keeps the
 * wall row off — with a corner cabinet (ADR-025) at every inside corner where two filled walls meet. Every mix is a
 * project with the room, built through `buildProjectModel()` and kept only without errors; ranked by the walls'
 * own ranking, then fewest warnings, then fewest pieces. Deterministic and bounded. Pure.
 * ADR-177: a wall corner cabinet above each base corner cabinet when the wall row is on (blind → the catalog's wall
 * blind corner, L and diagonal → its wall L corner), the wall rows meeting it; a window splits a wall row into the
 * parts beside it, each filled as its own row up to the window edge.
 * ADR-210: a style put on every piece of each mix before its checks; each mix's estimate, with a budget ceiling that
 * hides costlier mixes; and an island of base cabinets in a rectangle room, its fronts facing the longest filled wall's
 * run across a walkway the user types (no prefilled clearance, ADR-010).
 * ADR-216: a corner cabinet only where its footprint fits both walls; a wall too short for one at both ends keeps one
 * of them and leaves the other corner empty (each choice is filled, ranked together); runs stay off floor a corner
 * cabinet or an earlier wall's run already takes (the narrow arm of a U).
 */
import type { DiagnosticCode } from './diagnosticCodes';
import { kitchen } from './catalog/kitchen';
import { cornerDefaults, newId, templates } from './design';
import { t } from './i18n';
import {
  buildProjectModel,
  makeItem,
  newProject,
  type Project,
  type ProjectItem,
  type ProjectModel,
  type QuarterTurn,
  placedBounds,
} from './project';
import {
  checkRoomSizes,
  inside,
  wallBox,
  wallInward,
  wallLength,
  type Room,
  type RoomSizeField,
} from './room';
import type { PriceEntry, SellerLookup, Estimate } from './prices';
import { projectEstimate } from './projectEstimate';
import { applyStyle, type Style } from './styles';
import {
  BASE_HEIGHT,
  candidates,
  compareCandidates,
  MIXES_FIRST,
  piece,
  WALL_HEIGHT,
  WALL_VARIANTS,
  wallPiece,
  wallRowFor,
  checkWall,
  type Candidate,
  type Slot,
  type WallInput,
  type WallField,
  type WallSlot,
} from './wallfill';
import type { Box, CornerParams, Design, Diagnostic, Mm } from './types';

export type CornerKind = CornerParams['variant'] | 'none';

/** What to fill: the room, which walls, and Fill a wall's answers applied to every wall. */
export interface RoomInput extends Omit<WallInput, 'width' | 'height'> {
  room: Room;
  /** Wall indices to fill; absent = every wall. */
  walls?: number[];
  /** The corner cabinet at an inside corner between two filled walls (ADR-025); 'none' leaves the corner empty. */
  corner?: CornerKind;
  /** Height for the wall row and the tall warning; absent = the room's height. */
  height?: Mm;
  /** A style put on every piece of each mix before its checks (ADR-123, ADR-210); absent = Any. */
  style?: Style;
  /** The user's prices and the seller prices, for each mix's estimate (ADR-172, ADR-210). */
  prices?: readonly PriceEntry[];
  seller?: SellerLookup;
  /** Mixes whose estimate is above this (minor units) are hidden (ADR-210); absent = no ceiling. */
  ceiling?: number;
  /** An island of base cabinets (ADR-210): `walkway` is the user's walkway width, required (no prefill, ADR-010). */
  island?: { walkway?: Mm };
  /**
   * The open project the mix is added to (ADR-173 "Add this mix", ADR-248): each mix is also checked with this project's
   * pieces and kept only when it adds no error.
   */
  into?: Project;
}

/** A stretch of a wall that pieces may stand on: `from`..`to` along the wall from its start corner. */
export interface Stretch {
  wall: number;
  from: Mm;
  to: Mm;
  /** Ranges along the wall where the wall row stays off (windows), from the stretch's start. */
  noWallRow: [Mm, Mm][];
  /** It starts right after the corner cabinet at the wall's start / ends right before the one at its end (ADR-177). */
  fromCorner?: boolean;
  toCorner?: boolean;
}

export interface RoomMix {
  key: string;
  /** Per filled wall: its stretches with the slots on each. */
  walls: { wall: number; widths: string; summary: string }[];
  summary: string;
  corners: number;
  project: Project;
  model: ProjectModel;
  warnings: Diagnostic[];
  /** Its cost estimate (ADR-210): total and the lines without a price. */
  estimate: Estimate;
  /** The island's pieces in words, when it has one (ADR-210). */
  island?: string;
}

export interface RoomFill {
  mixes: RoomMix[];
  problems: Diagnostic[];
  /** Mixes hidden because their estimate is above the ceiling (ADR-210), and the cheapest of them. */
  overBudget?: number;
  cheapest?: number;
}

/** Candidates kept per stretch before combining (ADR-173: "cut to the best 6"). */
const PER_STRETCH = 6;
/** Whole-room projects built at most per call. */
const MAX_BUILDS = 60;

const err = (code: DiagnosticCode, message: string): Diagnostic => ({
  severity: 'error',
  code,
  message,
});
const note = (code: DiagnosticCode, message: string): Diagnostic => ({
  severity: 'warning',
  code,
  message,
});

/** The quarter turn of a piece whose back is on a wall with this inward direction. */
export function turnFor(inward: [number, number]): QuarterTurn {
  const [nx, nz] = inward;
  if (nz > 0) return 0;
  if (nx > 0) return 90;
  if (nz < 0) return 180;
  return 270;
}

/** Signed area of the outline: positive when its corners run clockwise on the plan (x right, z down). */
const area = (o: readonly (readonly [number, number])[]) =>
  o.reduce((a, p, i) => {
    const q = o[(i + 1) % o.length];
    return a + (p[0] * q[1] - q[0] * p[1]);
  }, 0) / 2;

/** Whether the corner at the end of wall `i` (its start corner is `i`'s start) is an inside corner (90° inside). */
export function insideCorner(room: Room, i: number): boolean {
  const n = room.outline.length;
  const a = room.outline[i],
    b = room.outline[(i + 1) % n],
    c = room.outline[(i + 2) % n];
  const cross = (b[0] - a[0]) * (c[1] - b[1]) - (b[1] - a[1]) * (c[0] - b[0]);
  // A turn the same way the outline runs is a convex corner of the room.
  return Math.sign(cross) === Math.sign(area(room.outline));
}

/** The corner cabinet's `side`: which end, seen from the room, touches the corner at the end of wall `i`. */
function cornerSide(room: Room, i: number): CornerParams['side'] {
  const [nx, nz] = wallInward(room, i);
  const n = room.outline.length;
  const a = room.outline[i],
    b = room.outline[(i + 1) % n];
  const d = [Math.sign(b[0] - a[0]), Math.sign(b[1] - a[1])];
  // Facing the wall from inside the room, the viewer's right-hand direction.
  const right = [nz, -nx];
  return right[0] * d[0] + right[1] * d[1] > 0 ? 'right' : 'left';
}

/**
 * The free stretches of wall `i`: the wall minus every door opening (its full width; the swing stays in front of
 * it) and minus the corner cabinets at its ends. A window keeps the wall row off its range; a window whose sill is
 * below the base height keeps the whole stretch free. Stretches shorter than `min` are dropped.
 */
export function freeStretches(
  input: RoomInput,
  i: number,
  reserve: { start: Mm; end: Mm },
  min: Mm,
): Stretch[] {
  const len = wallLength(input.room, i);
  const baseTop = input.baseHeight ?? BASE_HEIGHT;
  const blocked: [Mm, Mm][] = [];
  const noWallRow: [Mm, Mm][] = [];
  for (const f of input.room.features) {
    if (f.wall !== i) continue;
    const a = Math.max(0, f.from),
      b = Math.min(len, f.from + f.width);
    if (b <= a) continue;
    if (f.kind === 'door' || f.kind === 'obstacle') blocked.push([a, b]);
    else if (f.kind === 'window') {
      if (f.sill < baseTop) blocked.push([a, b]);
      else noWallRow.push([a, b]);
    }
  }
  const cuts = [...blocked].sort((p, q) => p[0] - q[0]);
  const out: Stretch[] = [];
  let at = reserve.start;
  const end = len - reserve.end;
  const push = (from: Mm, to: Mm) => {
    if (to - from >= min)
      out.push({
        wall: i,
        from,
        to,
        noWallRow: noWallRow
          .map(([a, b]) => [Math.max(a, from) - from, Math.min(b, to) - from] as [Mm, Mm])
          .filter(([a, b]) => b > a),
        ...(reserve.start > 0 && from === reserve.start ? { fromCorner: true } : {}),
        ...(reserve.end > 0 && to === end ? { toCorner: true } : {}),
      });
  };
  for (const [a, b] of cuts) {
    if (a > at) push(at, Math.min(a, end));
    at = Math.max(at, b);
  }
  if (end > at) push(at, end);
  return out;
}

/** The corner cabinet standing at the end of wall `i`, with its back on that wall. */
function cornerPiece(kind: Exclude<CornerKind, 'none'>, input: RoomInput): Design {
  const tpl = templates.find((x) => x.id === (kind === 'blind' ? 'corner-blind' : 'corner-l'))!;
  const d = tpl.create();
  if (d.product.kind !== 'corner') return d;
  const base = cornerDefaults(kind);
  const params: CornerParams = {
    ...d.product.params,
    depth: input.depth,
    height: input.baseHeight ?? base.height,
    ...(kind === 'l-shape' ? { width: input.depth + 340, wingWidth: input.depth + 340 } : {}),
  };
  return { ...d, product: { ...d.product, params } };
}

/** How much of each wall a corner cabinet at its end (`end`) or start (`start`) takes. */
function cornerTake(
  kind: CornerKind,
  input: RoomInput,
  perWall: WallInput,
): { along: Mm; across: Mm } {
  // No corner cabinet: the first wall's run reaches into the corner; the next wall starts after a run's depth.
  if (kind === 'none') return { along: 0, across: runDepth(input, perWall) };
  const d = cornerPiece(kind, input);
  const foot = placedBounds({
    ...makeItem(newProject('c'), d),
    rotationY: 0,
    position: { x: 0, y: 0, z: 0 },
  });
  // Blind: the cabinet runs its width along its wall; the next wall's run starts after its depth. L: both wings.
  return kind === 'blind' ? { along: foot.w, across: foot.d } : { along: foot.w, across: foot.w };
}

/** The deepest footprint a base or tall piece of this input has (fronts included). */
function runDepth(input: RoomInput, perWall: WallInput): Mm {
  const probe = newProject('d');
  return Math.max(
    ...(['tall', 'drawers'] as const).map(
      (kind) =>
        placedBounds({
          ...makeItem(probe, piece({ kind, width: 600 }, { ...perWall, width: 600 })),
          position: { x: 0, y: 0, z: 0 },
        }).d,
    ),
    input.depth,
  );
}

/** The catalog's wall corner variant for a base corner kind (ADR-177): blind → wall blind, L and diagonal → wall L. */
const WALL_CORNER = {
  blind: 'corner-blind-wall',
  'l-shape': 'corner-l-wall',
  diagonal: 'corner-l-wall',
} as const;

/**
 * The depth of the wall row's cabinets: the wall cabinet depth from Refine (ADR-204), else the deepest wall-cabinet
 * variant the row deals (ADR-104).
 */
const wallRowDepth = (input: Pick<WallInput, 'wallDepth'> = {}): Mm =>
  input.wallDepth ??
  Math.max(
    ...WALL_VARIANTS.map((v) => {
      const p = v.create!().product;
      return p.kind === 'cabinet' ? p.params.depth : 0;
    }),
  );

/**
 * The wall corner cabinet above a base corner of this kind (ADR-177): the catalog template at the wall row's height,
 * as deep as the wall row; its wings (or its blind section) keep the template's length beyond its depth. Null when
 * the catalog has none.
 */
function wallCornerPiece(kind: Exclude<CornerKind, 'none'>, input: RoomInput): Design | null {
  const v = kitchen.flatMap((f) => f.variants).find((x) => x.id === WALL_CORNER[kind]);
  if (!v?.create) return null;
  const d = v.create();
  if (d.product.kind !== 'corner') return null;
  const p = d.product.params;
  const depth = wallRowDepth(input);

  const params: CornerParams = {
    ...p,
    depth,
    height: input.wallHeight ?? WALL_HEIGHT,
    ...(p.variant === 'blind'
      ? { blindWidth: depth + (p.blindWidth - p.depth) }
      : { width: depth + (p.width - p.depth), wingWidth: depth + (p.wingWidth - p.depth) }),
  };
  return {
    ...d,
    product: { ...d.product, params },
    // The template's own note: corner units do not get wall brackets automatically (ADR-010, guidance).
    ...(v.hardware ? { catalog: { ...d.catalog, hardwareToChoose: v.hardware } } : {}),
  };
}

/** How much of each wall a wall corner takes: `along` the wall whose end holds it, `across` on the next wall. */
function wallCornerTake(d: Design): { along: Mm; across: Mm } {
  const foot = placedBounds({
    ...makeItem(newProject('c'), d),
    rotationY: 0,
    position: { x: 0, y: 0, z: 0 },
  });
  // Its width runs along its wall, its depth (an L: its side wing) along the next wall.
  return { along: foot.w, across: foot.d };
}

/** Ranges along wall `i` that a wall cabinet stays off: its windows, doors and obstacles. */
function wallRowStops(room: Room, i: number): [Mm, Mm][] {
  return room.features
    .filter(
      (f) => f.wall === i && (f.kind === 'window' || f.kind === 'door' || f.kind === 'obstacle'),
    )
    .map((f) => [f.from, f.from + f.width] as [Mm, Mm])
    .filter(([a, b]) => b > a);
}

const overlaps = (stops: [Mm, Mm][], a: Mm, b: Mm) => stops.some(([x, y]) => a < y && x < b);

/** A piece of the wall row's span: plain (over base units or a corner), over the tall slot `tall`, or a hole. */
interface RowSeg {
  from: Mm;
  to: Mm;
  tall?: number;
  hole?: boolean;
}

/**
 * The wall row over one base stretch (ADR-104, ADR-177): it spans `lo`..`hi` along the wall (the stretch, reaching
 * a wall corner at either end) minus every stop (window, door, obstacle). Each part between stops is filled with
 * `wallRowFor` on its own, so the row ends at a window edge; a tall cabinet keeps its top box, one cut by a stop gets
 * none; a part that cannot be split into wall cabinets stays empty. `from` is along the wall; `over` is the index of
 * the tall slot in `slots`.
 */
export function wallRowParts(
  slots: Slot[],
  stretch: { from: Mm; to: Mm },
  lo: Mm,
  hi: Mm,
  stops: [Mm, Mm][],
  input: WallInput,
): (WallSlot & { from: Mm })[] {
  const segs: RowSeg[] = [];
  if (lo < stretch.from) segs.push({ from: lo, to: stretch.from });
  let at = stretch.from;
  slots.forEach((s, k) => {
    segs.push({ from: at, to: at + s.width, ...(s.kind === 'tall' ? { tall: k } : {}) });
    at += s.width;
  });
  if (hi > stretch.to) segs.push({ from: stretch.to, to: hi });
  const pieces: RowSeg[] = [];
  for (const g of segs) {
    let parts: [Mm, Mm][] = [[Math.max(g.from, lo), Math.min(g.to, hi)]];
    for (const [a, b] of stops)
      parts = parts.flatMap(([x, y]): [Mm, Mm][] =>
        b <= x || a >= y
          ? [[x, y]]
          : (
              [
                [x, Math.min(a, y)],
                [Math.max(b, x), y],
              ] as [Mm, Mm][]
            ).filter(([p, q]) => q > p),
      );
    for (const [x, y] of parts.sort((p, q) => p[0] - q[0])) {
      if (y <= x) continue;
      if (g.tall === undefined) pieces.push({ from: x, to: y });
      else if (x === g.from && y === g.to) pieces.push({ from: x, to: y, tall: g.tall });
      else pieces.push({ from: x, to: y, hole: true });
    }
  }
  const out: (WallSlot & { from: Mm })[] = [];
  // Variants dealt left to right over the whole stretch, as one `wallRowFor` call would (ADR-104).
  let dealt = 0;
  const fill = (from: Mm, to: Mm) => {
    for (const ws of wallRowFor([{ kind: 'shelves', width: to - from }], input) ?? [])
      out.push({
        ...ws,
        variant: WALL_VARIANTS[dealt++ % WALL_VARIANTS.length].id,
        from: from + ws.x,
      });
  };
  // Runs: plain pieces that touch; a tall, a hole or a gap (a stop) ends a run.
  let run: [Mm, Mm] | null = null;
  for (const pc of pieces) {
    const plain = pc.tall === undefined && !pc.hole;
    if (plain && run && pc.from === run[1]) {
      run[1] = pc.to;
      continue;
    }
    if (run) fill(run[0], run[1]);
    run = plain ? [pc.from, pc.to] : null;
    if (pc.tall !== undefined)
      for (const ws of wallRowFor([{ kind: 'tall', width: pc.to - pc.from }], input) ?? [])
        out.push({ ...ws, over: pc.tall, from: pc.from });
  }
  if (run) fill(run[0], run[1]);
  return out;
}

interface Placed {
  /** What it is, for the memo (ADR-193). */
  key: string;
  design: Design;
  wall: number;
  from: Mm;
  width: Mm;
  depth: Mm;
  /** Wall row (hung), or stands on the floor. */
  hung?: boolean;
  /** Top box: index into the placed base items of this stretch it stands on. */
  overId?: string;
  id: string;
}

/** The inside corners between consecutive filled walls, as the wall whose end holds the corner. */
export function cornerWalls(input: RoomInput, walls: number[]): number[] {
  const n = input.room.outline.length;
  const set = new Set(walls);
  return walls.filter((i) => set.has((i + 1) % n) && insideCorner(input.room, i));
}

/** A problem with the input; `field` names the answer or room size it is about (ADR-193). */
export type RoomIssue = Diagnostic & { field?: WallField | RoomSizeField | 'walkway' };

/**
 * Problems with the input: the ready shape's sizes (ADR-193), the room's outline, the ticked walls and the per-wall
 * answers. The wall width comes from the room, so Fill a wall's width check is left out; with a ready shape its
 * "Room height" stands for the height.
 */
export function checkRoom(input: RoomInput): RoomIssue[] {
  const out: RoomIssue[] = [];
  const shape = input.room.shape;
  if (shape) out.push(...checkRoomSizes(shape.kind, shape.sizes, input.room.height));
  if (input.room.outline.length < 3)
    out.push(err('room-input', t('The room needs at least three walls.')));
  const walls = input.walls ?? input.room.outline.map((_, i) => i);
  if (!walls.length) out.push(err('room-input', t('Tick at least one wall to fill.')));
  if (walls.some((i) => !Number.isInteger(i) || i < 0 || i >= input.room.outline.length))
    out.push(err('room-input', t('A ticked wall is not a wall of this room.')));
  const probe: WallInput = { ...input, width: 1000, height: input.height ?? input.room.height };
  const sized = !!shape && input.height === undefined;
  out.push(
    ...checkWall(probe).filter((d) => d.field !== 'width' && !(sized && d.field === 'height')),
  );
  // An island (ADR-210): the user's walkway width, in a rectangle room.
  if (input.island) {
    const w = input.island.walkway;
    if (w === undefined)
      out.push({
        ...err('room-island', t('Type the walkway width to place an island.')),
        field: 'walkway',
      });
    else if (!Number.isInteger(w) || w < 1 || w > 10000)
      out.push({
        ...err('room-island', t('The walkway width must be a whole number of mm above 0.')),
        field: 'walkway',
      });
    if (!isRectangle(input.room))
      out.push(err('room-island', t('An island needs a rectangle room.')));
  }
  return out;
}

/** A room of four walls, each along x or z (ADR-210: islands go in rectangle rooms only). */
export function isRectangle(room: Room): boolean {
  const o = room.outline;
  return (
    o.length === 4 &&
    o.every((p, i) => {
      const q = o[(i + 1) % 4];
      return (p[0] === q[0]) !== (p[1] === q[1]);
    })
  );
}

/** The island's slots and where it stands, or why it does not fit (ADR-210). */
interface IslandPlan {
  wall: number;
  from: Mm;
  slots: Slot[];
  /** Its fronts' distance from the wall: the run's depth plus the walkway. */
  offset: Mm;
  input: WallInput;
}

/** A turned piece's footprint along and across a wall it is put against. */
function footOf(p: Project, d: Design, rotationY: QuarterTurn): { along: Mm; across: Mm } {
  const made = makeItem(p, d);
  const foot = placedBounds({ ...made, rotationY, position: { x: 0, y: 0, z: 0 } });
  return rotationY % 180 === 0
    ? { along: foot.w, across: foot.d }
    : { along: foot.d, across: foot.w };
}

/**
 * The island (ADR-210): base cabinets only, parallel to the longest filled wall, its fronts facing that wall's run a
 * walkway away; as long as the wall less twice the depth and the walkway, in 50 mm steps, filled by `candidates()`;
 * the walkway is kept behind it too (to the opposite wall or its run). An error when the room is too small.
 */
function planIsland(
  input: RoomInput,
  walls: number[],
  perWall: WallInput,
): IslandPlan | Diagnostic {
  const room = input.room;
  const walkway = input.island!.walkway!;
  const tooSmall = err('room-island', t('The room is too small for an island with this walkway.'));
  const wall = walls.reduce((a, b) => (wallLength(room, b) > wallLength(room, a) ? b : a));
  const len = wallLength(room, wall);
  const length = Math.floor((len - 2 * (input.depth + walkway)) / 50) * 50;
  if (length < (input.minWidth ?? 400)) return tooSmall;
  const widthInput: WallInput = { ...perWall, width: length, wallRow: 'never', tallCount: 0 };
  const best = candidates(widthInput).sort(compareCandidates)[0];
  if (!best) return tooSmall;
  // The run's front: as deep as a base piece with its fronts; the island stands a walkway away from it.
  const probe = newProject('island');
  const [nx, nz] = wallInward(room, wall);
  const turn = turnFor([-nx, -nz]);
  const across = Math.max(
    ...best.slots.map((s) => footOf(probe, piece(s, widthInput), turn).across),
  );
  const offset = across + walkway;
  const opposite = (wall + 2) % 4;
  const roomDepth = wallLength(room, (wall + 1) % 4);
  const behind = roomDepth - (offset + across) - (walls.includes(opposite) ? across : 0);
  if (behind < walkway) return tooSmall;
  return {
    wall,
    from: Math.floor((len - length) / 2),
    slots: best.slots,
    offset,
    input: widthInput,
  };
}

/** The island's pieces in project `p`, turned to face the wall's run (ADR-210). */
function islandItems(p: Project, room: Room, plan: IslandPlan): ProjectItem[] {
  const [nx, nz] = wallInward(room, plan.wall);
  const rotationY = turnFor([-nx, -nz]);
  let at = plan.from;
  return plan.slots.map((slot) => {
    const d = piece(slot, plan.input);
    const made = makeItem(p, d);
    const { along, across } = footOf(p, d, rotationY);
    // From the wall out to the island's back, then only the island's own depth.
    const b = wallBox(room, plan.wall, at, along, plan.offset + across, 0, 1);
    at += slot.width;
    const x = nx > 0 ? b.x + plan.offset : b.x;
    const z = nz > 0 ? b.z + plan.offset : b.z;
    return { ...made, rotationY, position: { x, y: made.position.y, z } };
  });
}

/**
 * ADR-193: the same candidate with its one tall cabinet at the right end of the stretch instead of the left (auto
 * puts it on the left, ADR-103); null when it has no single tall cabinet or the tall is already last.
 */
export function tallAtRight(c: Candidate): Candidate | null {
  const talls = c.slots.filter((s) => s.kind === 'tall');
  if (talls.length !== 1 || c.slots[c.slots.length - 1].kind === 'tall') return null;
  return {
    ...c,
    slots: [...c.slots.filter((s) => s.kind !== 'tall'), talls[0]],
    signature: `${c.signature}|right`,
  };
}

/** Corner plans tried at most per call (ADR-216): each is a full fill of the room, so the work stays bounded. */
const MAX_PLANS = 4;

/** Whether two plan boxes share floor (touching edges do not count). */
const clash = (a: Box, b: Box) =>
  a.x < b.x + b.w && b.x < a.x + a.w && a.z < b.z + b.d && b.z < a.z + a.d;

/** The floor a corner cabinet at the end of wall `i` takes, placed as `roomProject` places it. */
function cornerBox(room: Room, i: number, take: { along: Mm; across: Mm }): Box {
  const len = wallLength(room, i);
  return wallBox(room, i, len - take.along, take.along, take.across, 0, 1);
}

/**
 * ADR-216: which inside corners get a corner cabinet. A corner cabinet stands only where its own footprint fits both
 * walls (its length on the wall holding it, its depth on the next one). Two whose footprints share floor (a wall too
 * short for a corner cabinet at both ends) never stand together: each plan keeps one of them and leaves the other
 * corner empty. The plans are the largest such sets, first the one keeping the earlier corners, at most `MAX_PLANS`;
 * every plan is filled and the mixes are ranked together (fewest warnings first).
 */
export function cornerPlans(
  room: Room,
  corners: number[],
  take: { along: Mm; across: Mm },
): number[][] {
  const n = room.outline.length;
  const fit = corners.filter(
    (i) => take.along <= wallLength(room, i) && take.across <= wallLength(room, (i + 1) % n),
  );
  const boxes = new Map(fit.map((i) => [i, cornerBox(room, i, take)]));
  const hits = (a: number, b: number) => a !== b && clash(boxes.get(a)!, boxes.get(b)!);
  const out: number[][] = [];
  const walk = (k: number, kept: number[]) => {
    if (out.length >= MAX_PLANS) return;
    if (k === fit.length) {
      // Only the largest sets: every corner left out clashes with one kept.
      if (fit.every((c) => kept.includes(c) || kept.some((d) => hits(c, d)))) out.push(kept);
      return;
    }
    const c = fit[k];
    if (!kept.some((d) => hits(c, d))) walk(k + 1, [...kept, c]);
    // Leaving it out is only worth trying when it clashes with another corner.
    if (fit.some((d) => hits(c, d))) walk(k + 1, kept);
  };
  walk(0, []);
  return out;
}

/** The floor a stretch's run takes: its length along the wall, a run's depth into the room. */
const stretchBox = (room: Room, s: { wall: number; from: Mm; to: Mm }, depth: Mm): Box =>
  wallBox(room, s.wall, s.from, s.to - s.from, depth, 0, 1);

/** The range along wall `i` (from its start corner) that a plan box covers. */
function alongRange(room: Room, i: number, b: Box): [Mm, Mm] {
  const n = room.outline.length;
  const a = room.outline[i],
    e = room.outline[(i + 1) % n];
  const len = wallLength(room, i);
  const dx = (e[0] - a[0]) / len,
    dz = (e[1] - a[1]) / len;
  const at = [
    [b.x, b.z],
    [b.x + b.w, b.z],
    [b.x, b.z + b.d],
    [b.x + b.w, b.z + b.d],
  ].map(([x, z]) => (x - a[0]) * dx + (z - a[1]) * dz);
  return [Math.floor(Math.min(...at)), Math.ceil(Math.max(...at))];
}

/**
 * ADR-216: every stretch loses the part of the wall whose run would stand on floor already taken, by a corner
 * cabinet or by an earlier wall's run (a narrow arm of a U, the run past an empty corner), so tall cabinets, their
 * top boxes and base units stay out of the corner zones. Parts shorter than `min` are dropped. A room where nothing
 * meets keeps its stretches as they were.
 */
export function trimStretches(
  room: Room,
  stretches: Stretch[],
  taken: Box[],
  depth: Mm,
  min: Mm,
): Stretch[] {
  const out: Stretch[] = [];
  for (const s of stretches) {
    const others = [
      ...taken,
      ...out.filter((o) => o.wall !== s.wall).map((o) => stretchBox(room, o, depth)),
    ];
    const own = stretchBox(room, s, depth);
    let parts: [Mm, Mm][] = [[s.from, s.to]];
    for (const b of others) {
      if (!clash(own, b)) continue;
      const [x, y] = alongRange(room, s.wall, b);
      parts = parts.flatMap(([p, q]): [Mm, Mm][] =>
        y <= p || x >= q
          ? [[p, q]]
          : (
              [
                [p, Math.min(x, q)],
                [Math.max(y, p), q],
              ] as [Mm, Mm][]
            ).filter(([u, v]) => v > u),
      );
    }
    const rows = s.noWallRow.map(([a, b]) => [a + s.from, b + s.from] as [Mm, Mm]);
    for (const [p, q] of parts) {
      if (q - p < min) continue;
      const { fromCorner, toCorner, ...rest } = s;
      out.push({
        ...rest,
        from: p,
        to: q,
        noWallRow: rows
          .map(([a, b]) => [Math.max(a, p) - p, Math.min(b, q) - p] as [Mm, Mm])
          .filter(([a, b]) => b > a),
        ...(fromCorner && p === s.from ? { fromCorner } : {}),
        ...(toCorner && q === s.to ? { toCorner } : {}),
      });
    }
  }
  return out;
}

/**
 * The mixes for the whole room, best first, at most `limit`. Every wall stretch gets its own candidates (the best
 * `PER_STRETCH`), combined best-first; each combination is one project with the room, kept only without errors.
 * ADR-216: a wall too short for a corner cabinet at both ends keeps one of them; each corner plan is filled and the
 * mixes of all plans are ranked together.
 */
export function suggestRoomMixes(input: RoomInput, limit = MIXES_FIRST): RoomFill {
  const bad = checkRoom(input);
  if (bad.length) return { mixes: [], problems: bad };
  const room = input.room;
  const walls = (input.walls ?? room.outline.map((_, i) => i)).slice().sort((a, b) => a - b);
  // The island first (ADR-210): the same for every mix; a room too small for it is an error.
  const island = input.island
    ? planIsland(input, walls, { ...input, width: 0, height: input.height ?? room.height })
    : null;
  if (island && 'severity' in island) return { mixes: [], problems: [island] };
  const corner = input.corner ?? 'blind';
  const height = input.height ?? room.height;
  const perWall: WallInput = { ...input, width: 0, height };
  const take = cornerTake(corner, input, perWall);
  // Inside corners between two filled walls: a corner cabinet, or (none) the first wall's run reaching the corner.
  const corners = cornerWalls(input, walls);
  const plans = corner === 'none' ? [[]] : cornerPlans(room, corners, take);
  const depth = runDepth(input, perWall);
  const memo = roomMemo();
  // The errors the open project already has; a mix that adds one to it is not offered (ADR-248).
  const intoErrors = input.into ? errorCount(buildProjectModel(input.into)) : 0;
  const ctx: PlanContext = {
    input,
    walls,
    corner,
    corners,
    take,
    depth,
    perWall,
    island,
    memo,
    intoErrors,
  };
  // The combinations are shared out: each plan gets its part of MAX_BUILDS, so a call tries no more than before.
  const budget = Math.ceil(MAX_BUILDS / plans.length);
  const results = plans.map((kept) =>
    fillPlan(ctx, kept, plans.length > 1 ? `c${kept.join(',')}#` : '', limit, budget),
  );
  const mixes = results
    .flatMap((r) => r.mixes)
    .sort(
      (a, b) =>
        a.warnings.length - b.warnings.length || a.project.items.length - b.project.items.length,
    )
    .slice(0, limit);
  const overBudget = results.reduce((a, r) => a + r.overBudget, 0);
  const clashed = results.reduce((a, r) => a + r.clashed, 0);
  const prices = results.flatMap((r) => (r.cheapest === undefined ? [] : [r.cheapest]));
  const cheapest = prices.length ? Math.min(...prices) : undefined;
  // The problems of the plan that gave the best mix; with no mix, the first plan's and every plan's errors.
  const from = results.find((r) => mixes[0] && r.mixes.includes(mixes[0])) ?? results[0];
  const problems = [...from.problems];
  if (!mixes.length && !overBudget && clashed) {
    problems.push(
      err(
        'room-clash',
        t(
          'No mix fits beside the pieces already in this project. Untick the walls that are already filled.',
        ),
      ),
    );
  } else if (!mixes.length && !overBudget) {
    for (const r of results)
      for (const p of r.problems)
        if (p.severity === 'error' && !problems.some((q) => q.message === p.message))
          problems.push(p);
    const failed = results.reduce((a, r) => a + r.failed, 0);
    if (failed || !problems.some((p) => p.severity === 'error'))
      problems.push(
        err(
          'room-no-mix',
          failed
            ? t(
                'Every mix tried had a problem in the room ({n} tried); change the walls or the width range.',
                { n: failed },
              )
            : t('No mix could be built.'),
        ),
      );
  }
  return { mixes, problems, ...(overBudget ? { overBudget, cheapest } : {}) };
}

/** What every corner plan of one call shares (ADR-216). */
interface PlanContext {
  input: RoomInput;
  walls: number[];
  corner: CornerKind;
  corners: number[];
  take: { along: Mm; across: Mm };
  /** A run's depth, fronts included. */
  depth: Mm;
  perWall: WallInput;
  island: IslandPlan | null;
  memo: RoomMemo;
  /** Error diagnostics of `input.into` alone (ADR-248). */
  intoErrors: number;
}

/**
 * One corner plan filled: its mixes (at most `limit`, from at most `budget` combinations), its problems, and how many
 * builds had an error.
 */
function fillPlan(
  ctx: PlanContext,
  kept: number[],
  prefix: string,
  limit: number,
  budget: number,
): {
  mixes: RoomMix[];
  problems: Diagnostic[];
  failed: number;
  overBudget: number;
  /** Mixes that would add an error to `input.into` (ADR-248). */
  clashed: number;
  cheapest?: number;
} {
  const { input, walls, corner, corners, take, depth, perWall, island, memo, intoErrors } = ctx;
  const room = input.room;
  const n = room.outline.length;
  const min = input.minWidth ?? 400;
  const height = perWall.height;
  const has = new Set(kept);
  const problems: Diagnostic[] = [];
  const none = { mixes: [], problems, failed: 0, overBudget: 0, clashed: 0 };

  // Stretches per wall, after the corners' reservations; an empty corner is reserved as `none` reserves it (ADR-216).
  let stretches: Stretch[] = [];
  for (const i of walls) {
    const prev = (i - 1 + n) % n;
    const reserve = {
      start: corners.includes(prev) ? (has.has(prev) ? take.across : depth) : 0,
      end: has.has(i) ? take.along : 0,
    };
    stretches.push(...freeStretches(input, i, reserve, min));
  }
  stretches = trimStretches(
    room,
    stretches,
    kept.map((i) => cornerBox(room, i, take)),
    depth,
    min,
  );
  for (const i of walls)
    if (!stretches.some((s) => s.wall === i))
      problems.push(
        note(
          'room-wall-empty',
          t('Wall {n} has no stretch of {min} mm or more to fill.', { n: i + 1, min }),
        ),
      );
  if (!stretches.length && !kept.length) {
    problems.push(err('room-empty', t('Nothing fits: every wall is too short or blocked.')));
    return none;
  }
  // The best candidates per stretch.
  let lists: Candidate[][] = stretches.map((s) =>
    candidates({ ...perWall, width: s.to - s.from })
      .sort(compareCandidates)
      .slice(0, PER_STRETCH),
  );
  if (lists.some((l) => !l.length)) {
    const empty = stretches[lists.findIndex((l) => !l.length)];
    problems.push(
      err(
        'room-stretch',
        t('No mix fits the {w} mm stretch of wall {n} within the width range.', {
          w: empty.to - empty.from,
          n: empty.wall + 1,
        }),
      ),
    );
    return none;
  }
  // Each combination is built once, whether to choose a side (below) or to offer it.
  const keyOf = (picks: Candidate[]) =>
    prefix + picks.map((c, k) => `${stretches[k].wall}:${c.signature}`).join('/');
  const builds = new Map<
    string,
    { project: Project; model: ProjectModel; warnings: Diagnostic[] }
  >();
  const build = (picks: Candidate[]) => {
    const key = keyOf(picks);
    let b = builds.get(key);
    if (!b) {
      let project = roomProject(input, stretches, picks, kept, corner, perWall, undefined, memo);
      if (island)
        project = { ...project, items: [...project.items, ...islandItems(project, room, island)] };
      // A style goes on every piece before the checks (ADR-210).
      if (input.style && project.items.length)
        project = applyStyle(project, project.items[0].id, input.style, 'project').project;
      const model = buildProjectModel(project);
      b = { project, model, warnings: warningsOf(model, height) };
      builds.set(key, b);
    }
    return b;
  };
  const errors = (b: { model: ProjectModel }) =>
    b.model.diagnostics.some((d) => d.severity === 'error');
  // ADR-193: on auto the tall cabinet is tried at both ends of each stretch (two signatures). Starting from the best
  // combination with every tall on the left (ADR-103's auto), each stretch in turn moves its tall to the right end
  // and keeps it there when the room then has fewer warnings. Each list puts the kept side's candidates first and
  // the other side's after them.
  if (input.tallPosition === undefined) {
    const twins = lists.map((l) => l.map(tallAtRight));
    if (twins.some((l) => l[0])) {
      const right = lists.map(() => false);
      const count = () => {
        const b = build(lists.map((l, k) => (right[k] ? twins[k][0]! : l[0])));
        return errors(b) ? Infinity : b.warnings.length;
      };
      let best = count();
      for (let k = 0; k < lists.length; k++) {
        if (!twins[k][0]) continue;
        right[k] = true;
        const c = count();
        if (c < best) best = c;
        else right[k] = false;
      }
      lists = lists.map((l, k) => {
        const other = l.flatMap((c, r) => (twins[k][r] ? [right[k] ? c : twins[k][r]!] : []));
        return [...(right[k] ? l.map((c, r) => twins[k][r] ?? c) : l), ...other];
      });
    }
  }
  // Combinations by the sum of ranks, best first, bounded.
  const combos: number[][] = [];
  const maxRank = lists.reduce((a, l) => a + l.length - 1, 0);
  for (let total = 0; total <= maxRank && combos.length < budget; total++) {
    const walk = (k: number, left: number, acc: number[]) => {
      if (combos.length >= budget) return;
      if (k === lists.length) {
        if (left === 0) combos.push(acc);
        return;
      }
      for (let r = 0; r < lists[k].length && r <= left; r++) walk(k + 1, left - r, [...acc, r]);
    };
    walk(0, total, []);
  }
  const mixes: RoomMix[] = [];
  const seen = new Set<string>();
  let failed = 0;
  let overBudget = 0;
  let clashed = 0;
  let cheapest: number | undefined;
  for (const combo of combos) {
    if (mixes.length >= limit) break;
    const picks = combo.map((r, k) => lists[k][r]);
    const key = keyOf(picks);
    if (seen.has(key)) continue;
    seen.add(key);
    const built = build(picks);
    if (errors(built)) {
      failed++;
      continue;
    }
    // Added to an open project (ADR-248): checked with its pieces, as `fillRoom` will add it.
    if (
      input.into &&
      errorCount(
        buildProjectModel({
          ...input.into,
          items: [...input.into.items, ...built.project.items],
        }),
      ) > intoErrors
    ) {
      clashed++;
      continue;
    }
    // Its estimate (ADR-210); a mix above the ceiling is hidden and counted.
    const estimate = projectEstimate(
      built.project,
      built.model,
      input.prices ?? [],
      input.seller,
    ).est;
    if (input.ceiling !== undefined && estimate.total > input.ceiling) {
      overBudget++;
      cheapest = Math.min(cheapest ?? estimate.total, estimate.total);
      continue;
    }
    // A wall left empty (too short, or its floor taken by a corner, ADR-216) is named by its note, not as "Wall n: ".
    const byWall = walls.flatMap((w) => {
      const ks = stretches.map((s, k) => (s.wall === w ? k : -1)).filter((k) => k >= 0);
      const slots = ks.flatMap((k) => picks[k].slots);
      return slots.length
        ? [{ wall: w, widths: slots.map((s) => s.width).join(' · '), summary: summaryOf(slots) }]
        : [];
    });
    mixes.push({
      key,
      walls: byWall,
      summary: byWall.length
        ? byWall.map((w) => t('Wall {n}: {s}', { n: w.wall + 1, s: w.summary })).join('; ')
        : t('Corner cabinets only'),
      corners: kept.length,
      project: built.project,
      model: built.model,
      warnings: built.warnings,
      estimate,
      ...(island ? { island: summaryOf(island.slots) } : {}),
    });
  }
  return {
    mixes,
    problems,
    failed,
    overBudget,
    clashed,
    ...(cheapest !== undefined ? { cheapest } : {}),
  };
}

/** A built mix's warnings: every piece above the height, then the project's own warnings. */
function warningsOf(model: ProjectModel, height: Mm): Diagnostic[] {
  const tallWarn: Diagnostic[] = [];
  for (const pc of model.pieces) {
    const top = pc.bounds.y + pc.bounds.h;
    if (top > height)
      tallWarn.push({
        severity: 'warning',
        code: 'wall-too-tall',
        message: t('{name} is {top} mm tall, {over} mm above the {h} mm height.', {
          name: pc.item.design.name,
          top,
          over: top - height,
          h: height,
        }),
        itemIds: [pc.item.id],
      });
  }
  return [...tallWarn, ...model.diagnostics.filter((d) => d.severity === 'warning')];
}

const summaryOf = (slots: Slot[]): string => {
  const count = { tall: 0, shelves: 0, drawers: 0, door: 0 };
  for (const s of slots) count[s.kind]++;
  return (Object.entries(count) as [Slot['kind'], number][])
    .filter(([, c]) => c > 0)
    .map(
      ([k, c]) =>
        ({
          tall: t('{n} tall', { n: c }),
          shelves: t('{n} open shelves', { n: c }),
          drawers: t('{n} drawers', { n: c }),
          door: t('{n} door + shelves', { n: c }),
        })[k],
    )
    .join(', ');
};

/**
 * Pieces and footprints already made for one input (ADR-193): the mixes of one call share most pieces, so each is
 * made and measured once. A piece taken from it gets a new design id, as a duplicated piece does.
 */
interface RoomMemo {
  /** Null: the catalog has none (a wall corner of that kind), remembered too. */
  designs: Map<string, Design | null>;
  feet: Map<string, Box>;
}
const roomMemo = (): RoomMemo => ({ designs: new Map(), feet: new Map() });

/** One mix as a project with the room: pieces along their walls, corner cabinets at the inside corners. */
function roomProject(
  input: RoomInput,
  stretches: Stretch[],
  picks: Candidate[],
  corners: number[],
  corner: CornerKind,
  perWall: WallInput,
  name = t('Room {w} × {d}', { w: roomSize(input.room).w, d: roomSize(input.room).d }),
  memo: RoomMemo = roomMemo(),
): Project {
  const room = input.room;
  const p = newProject(name);
  p.room = structuredClone(room);
  const placed: Placed[] = [];
  const design = (key: string, make: () => Design): Design => {
    let d = memo.designs.get(key);
    if (!d) memo.designs.set(key, (d = make()));
    return { ...d, id: newId() };
  };
  // Its real footprint once turned (fronts included), at the origin.
  const footOf = (key: string, item: ProjectItem): Box => {
    const k = `${key}|${item.rotationY}`;
    let f = memo.feet.get(k);
    if (!f) memo.feet.set(k, (f = placedBounds({ ...item, position: { x: 0, y: 0, z: 0 } })));
    return f;
  };
  const height = perWall.height;
  const n = room.outline.length;
  const rowOn = (input.wallRow ?? 'always') !== 'never';
  const mount = height - (input.wallHeight ?? WALL_HEIGHT);
  // Wall corner cabinets above the base corners when the wall row is on (ADR-177).
  const wallCorner =
    rowOn && corner !== 'none'
      ? memoOr(memo, 'wall-corner', () => wallCornerPiece(corner, input))
      : null;
  const wtake = wallCorner ? wallCornerTake(wallCorner) : { along: 0, across: 0 };
  const wallCorners = new Set<number>();
  if (wallCorner && corner !== 'none') {
    const baseTop = footOf('corner', {
      ...makeItem(
        newProject('c'),
        design('corner', () => cornerPiece(corner, input)),
      ),
      rotationY: 0,
    }).h;
    // It hangs above the base corner, on both walls clear of windows, doors and obstacles, within the walls.
    const fits = (i: number) => {
      const j = (i + 1) % n,
        len = wallLength(room, i);
      return (
        mount >= baseTop &&
        wtake.along <= len &&
        wtake.across <= wallLength(room, j) &&
        !overlaps(wallRowStops(room, i), len - wtake.along, len) &&
        !overlaps(wallRowStops(room, j), 0, wtake.across)
      );
    };
    const ok = new Set(corners.filter(fits));
    // Two wall corners on one wall must not overlap each other.
    for (const i of ok) {
      const prev = (i - 1 + n) % n,
        next = (i + 1) % n;
      if (ok.has(prev) && wtake.across + wtake.along > wallLength(room, i)) continue;
      if (ok.has(next) && wtake.across + wtake.along > wallLength(room, next)) continue;
      wallCorners.add(i);
    }
  }
  for (let k = 0; k < stretches.length; k++) {
    const s = stretches[k];
    const c = picks[k];
    const widthInput: WallInput = { ...perWall, width: s.to - s.from };
    let at = s.from;
    const baseIds: string[] = [];
    for (const slot of c.slots) {
      const key = `piece|${slot.kind}|${slot.width}|${slot.fronts ?? 0}`;
      const d = design(key, () => piece(slot, widthInput));
      const id = newId();
      baseIds.push(id);
      placed.push({
        key,
        design: d,
        wall: s.wall,
        from: at,
        width: slot.width,
        depth: slot.kind === 'tall' ? (input.tallDepth ?? input.depth) : input.depth,
        id,
      });
      at += slot.width;
    }
    // The wall row reaches a wall corner at either end and stops at each window edge (ADR-177).
    const len = wallLength(room, s.wall);
    const lo = s.fromCorner && wallCorners.has((s.wall - 1 + n) % n) ? wtake.across : s.from;
    const hi = s.toCorner && wallCorners.has(s.wall) ? len - wtake.along : s.to;
    const row = rowOn
      ? wallRowParts(c.slots, s, lo, hi, wallRowStops(room, s.wall), widthInput)
      : [];
    for (const ws of row) {
      // A top box stands on its tall cabinet.
      const key = `wall|${ws.variant}|${ws.width}|${ws.height}`;
      const d = design(key, () => wallPiece(ws, widthInput));
      placed.push({
        key,
        design: d,
        wall: s.wall,
        from: ws.from,
        width: ws.width,
        depth: wallDepth(d),
        hung: ws.variant !== 'top-box',
        ...(ws.over !== undefined ? { overId: baseIds[ws.over] } : {}),
        id: newId(),
      });
    }
  }
  const items: ProjectItem[] = placed.map((pl) => {
    const made = makeItem(p, pl.design);
    const h = made.position.y;
    const rotationY = turnFor(wallInward(room, pl.wall));
    // Its real footprint once turned (fronts included): the back sits on the wall, nothing pokes through it.
    const foot = footOf(pl.key, { ...made, rotationY });
    const along = rotationY % 180 === 0 ? foot.w : foot.d;
    const across = rotationY % 180 === 0 ? foot.d : foot.w;
    const box = wallBox(room, pl.wall, pl.from, along, across, 0, 1);
    const base: ProjectItem = {
      ...made,
      id: pl.id,
      rotationY,
      position: { x: box.x, y: pl.overId ? 0 : h, z: box.z },
    };
    if (pl.overId)
      return { ...base, placement: { kind: 'above', baseId: pl.overId, gap: 0, offsetX: 0 } };
    return base;
  });
  // Corner cabinets, their backs on the wall whose end holds the corner.
  if (corner !== 'none')
    for (const i of corners) {
      const d = design('corner', () => cornerPiece(corner, input));
      if (d.product.kind !== 'corner') continue;
      const side = cornerSide(room, i);
      const made = makeItem(p, {
        ...d,
        product: { ...d.product, params: { ...d.product.params, side } },
      });
      const len = wallLength(room, i);
      const rotationY = turnFor(wallInward(room, i));
      const foot = footOf(`corner|${side}`, { ...made, rotationY });
      const along = rotationY % 180 === 0 ? foot.w : foot.d;
      const across = rotationY % 180 === 0 ? foot.d : foot.w;
      const box = wallBox(room, i, len - along, along, across, 0, 1);
      items.push({ ...made, rotationY, position: { x: box.x, y: 0, z: box.z } });
    }
  // Wall corner cabinets, hung with their tops at the wall row's height (ADR-177).
  if (corner !== 'none')
    for (const i of corners) {
      const d = wallCorners.has(i) && wallCorner ? { ...wallCorner, id: newId() } : null;
      if (d?.product.kind !== 'corner') continue;
      const side = cornerSide(room, i);
      const made = makeItem(p, {
        ...d,
        // Hung by its template (ADR-177): its underside at the wall row's.
        product: {
          ...d.product,
          params: { ...d.product.params, side, mountHeight: mount },
        },
      });
      const len = wallLength(room, i);
      const rotationY = turnFor(wallInward(room, i));
      const foot = footOf(`wall-corner|${side}`, { ...made, rotationY });
      const along = rotationY % 180 === 0 ? foot.w : foot.d;
      const across = rotationY % 180 === 0 ? foot.d : foot.w;
      const box = wallBox(room, i, len - along, along, across, 0, 1);
      items.push({
        ...made,
        rotationY,
        position: { x: box.x, y: mount, z: box.z },
        placement: { kind: 'wall', height: mount },
      });
    }
  p.items = items;
  void height;
  void inside;
  return p;
}

/** A memo entry that may be absent (the catalog has no wall corner of this kind). */
function memoOr(memo: RoomMemo, key: string, make: () => Design | null): Design | null {
  if (!memo.designs.has(key)) memo.designs.set(key, make());
  return memo.designs.get(key) ?? null;
}

/** A wall cabinet's depth, from its design. */
function wallDepth(d: Design): Mm {
  const p = d.product;
  return p.kind === 'cabinet' || p.kind === 'corner' ? p.params.depth : 320;
}

/** Width and depth of the room's bounding box. */
function roomSize(room: Room): { w: Mm; d: Mm } {
  const xs = room.outline.map((p) => p[0]),
    zs = room.outline.map((p) => p[1]);
  return { w: Math.max(...xs) - Math.min(...xs), d: Math.max(...zs) - Math.min(...zs) };
}

/** The error diagnostics of a built project (ADR-248). */
function errorCount(model: ProjectModel): number {
  return model.diagnostics.filter((d) => d.severity === 'error').length;
}
