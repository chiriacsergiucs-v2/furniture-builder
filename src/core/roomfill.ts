/**
 * Fill the room (ADR-173): suggested mixes for every wall of a drawn room (ADR-058/059), built on Fill a wall
 * (ADR-103, ADR-104). Each wall is filled over its free stretches — a door keeps its opening free, a window keeps the
 * wall row off — with a corner cabinet (ADR-025) at every inside corner where two filled walls meet. Every mix is a
 * project with the room, built through `buildProjectModel()` and kept only without errors; ranked by the walls'
 * own ranking, then fewest warnings, then fewest pieces. Deterministic and bounded. Pure.
 * ADR-177: a wall corner cabinet above each base corner cabinet when the wall row is on (blind → the catalog's wall
 * blind corner, L and diagonal → its wall L corner), the wall rows meeting it; a window splits a wall row into the
 * parts beside it, each filled as its own row up to the window edge.
 */
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
import { inside, wallBox, wallInward, wallLength, type Room } from './room';
import {
  BASE_HEIGHT,
  candidates,
  cmp,
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
  type WallSlot,
} from './wallfill';
import type { CornerParams, Design, Diagnostic, Mm } from './types';

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
}

export interface RoomFill {
  mixes: RoomMix[];
  problems: Diagnostic[];
}

/** Candidates kept per stretch before combining (ADR-173: "cut to the best 6"). */
export const PER_STRETCH = 6;
/** Whole-room projects built at most per call. */
const MAX_BUILDS = 60;

const err = (code: string, message: string): Diagnostic => ({ severity: 'error', code, message });
const note = (code: string, message: string): Diagnostic => ({
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

/** The depth of the wall row's cabinets: the deepest wall-cabinet variant the row deals (ADR-104). */
const wallRowDepth = (): Mm =>
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
export function wallCornerPiece(
  kind: Exclude<CornerKind, 'none'>,
  input: RoomInput,
): Design | null {
  const v = kitchen.flatMap((f) => f.variants).find((x) => x.id === WALL_CORNER[kind]);
  if (!v?.create) return null;
  const d = v.create();
  if (d.product.kind !== 'corner') return null;
  const p = d.product.params;
  const depth = wallRowDepth();
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

/** Problems with the input: the room's outline and the per-wall answers. */
export function checkRoom(input: RoomInput): Diagnostic[] {
  const out: Diagnostic[] = [];
  if (input.room.outline.length < 3)
    out.push(err('room-input', t('The room needs at least three walls.')));
  const walls = input.walls ?? input.room.outline.map((_, i) => i);
  if (!walls.length) out.push(err('room-input', t('Tick at least one wall to fill.')));
  if (walls.some((i) => !Number.isInteger(i) || i < 0 || i >= input.room.outline.length))
    out.push(err('room-input', t('A ticked wall is not a wall of this room.')));
  const probe: WallInput = { ...input, width: 1000, height: input.height ?? input.room.height };
  out.push(...checkWall(probe).filter((d) => d.code !== 'wall-input' || !/Width/.test(d.message)));
  return out;
}

/**
 * The mixes for the whole room, best first, at most `limit`. Every wall stretch gets its own candidates (the best
 * `PER_STRETCH`), combined best-first; each combination is one project with the room, kept only without errors.
 */
export function suggestRoomMixes(input: RoomInput, limit = MIXES_FIRST): RoomFill {
  const bad = checkRoom(input);
  if (bad.length) return { mixes: [], problems: bad };
  const room = input.room;
  const walls = (input.walls ?? room.outline.map((_, i) => i)).slice().sort((a, b) => a - b);
  const corner = input.corner ?? 'blind';
  const n = room.outline.length;
  const min = input.minWidth ?? 400;
  const height = input.height ?? room.height;
  const perWall: WallInput = { ...input, width: 0, height };
  const take = cornerTake(corner, input, perWall);
  // Inside corners between two filled walls: a corner cabinet, or (none) the first wall's run reaching the corner.
  const corners = cornerWalls(input, walls);
  const cabinets = corner === 'none' ? [] : corners;
  const problems: Diagnostic[] = [];

  // Stretches per wall, after the corners' reservations.
  const stretches: Stretch[] = [];
  for (const i of walls) {
    const reserve = {
      start: corners.includes((i - 1 + n) % n) ? take.across : 0,
      end: corners.includes(i) ? take.along : 0,
    };
    const st = freeStretches(input, i, reserve, min);
    if (!st.length)
      problems.push(
        note(
          'room-wall-empty',
          t('Wall {n} has no stretch of {min} mm or more to fill.', { n: i + 1, min }),
        ),
      );
    stretches.push(...st);
  }
  if (!stretches.length && !corners.length) {
    problems.push(err('room-empty', t('Nothing fits: every wall is too short or blocked.')));
    return { mixes: [], problems };
  }
  // The best candidates per stretch.
  const lists: Candidate[][] = stretches.map((s) => {
    const list = candidates({ ...perWall, width: s.to - s.from })
      .sort(
        (a, b) =>
          cmp(a.score, b.score) ||
          cmp(
            a.slots.map((x) => x.width),
            b.slots.map((x) => x.width),
          ),
      )
      .slice(0, PER_STRETCH);
    return list;
  });
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
    return { mixes: [], problems };
  }
  // Combinations by the sum of ranks, best first, bounded.
  const combos: number[][] = [];
  const maxRank = lists.reduce((a, l) => a + l.length - 1, 0);
  for (let total = 0; total <= maxRank && combos.length < MAX_BUILDS; total++) {
    const walk = (k: number, left: number, acc: number[]) => {
      if (combos.length >= MAX_BUILDS) return;
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
  for (const combo of combos) {
    if (mixes.length >= limit) break;
    const picks = combo.map((r, k) => lists[k][r]);
    const key = picks.map((c, k) => `${stretches[k].wall}:${c.signature}`).join('/');
    if (seen.has(key)) continue;
    seen.add(key);
    const project = roomProject(input, stretches, picks, cabinets, corner, perWall);
    const model = buildProjectModel(project);
    if (model.diagnostics.some((d) => d.severity === 'error')) {
      failed++;
      continue;
    }
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
    const byWall = walls.map((w) => {
      const ks = stretches.map((s, k) => (s.wall === w ? k : -1)).filter((k) => k >= 0);
      const slots = ks.flatMap((k) => picks[k].slots);
      return {
        wall: w,
        widths: slots.map((s) => s.width).join(' · '),
        summary: summaryOf(slots),
      };
    });
    mixes.push({
      key,
      walls: byWall,
      summary: byWall.map((w) => t('wall {n}: {s}', { n: w.wall + 1, s: w.summary })).join('; '),
      corners: cabinets.length,
      project,
      model,
      warnings: [...tallWarn, ...model.diagnostics.filter((d) => d.severity === 'warning')],
    });
  }
  mixes.sort(
    (a, b) =>
      a.warnings.length - b.warnings.length || a.project.items.length - b.project.items.length,
  );
  if (!mixes.length)
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
  return { mixes, problems };
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

/** One mix as a project with the room: pieces along their walls, corner cabinets at the inside corners. */
export function roomProject(
  input: RoomInput,
  stretches: Stretch[],
  picks: Candidate[],
  corners: number[],
  corner: CornerKind,
  perWall: WallInput,
  name = t('Room {w} × {d}', { w: roomSize(input.room).w, d: roomSize(input.room).d }),
): Project {
  const room = input.room;
  const p = newProject(name);
  p.room = structuredClone(room);
  const placed: Placed[] = [];
  const height = perWall.height;
  const n = room.outline.length;
  const rowOn = (input.wallRow ?? 'always') !== 'never';
  const mount = height - (input.wallHeight ?? WALL_HEIGHT);
  // Wall corner cabinets above the base corners when the wall row is on (ADR-177).
  const wallCorner = rowOn && corner !== 'none' ? wallCornerPiece(corner, input) : null;
  const wtake = wallCorner ? wallCornerTake(wallCorner) : { along: 0, across: 0 };
  const wallCorners = new Set<number>();
  if (wallCorner && corner !== 'none') {
    const baseTop = placedBounds({
      ...makeItem(newProject('c'), cornerPiece(corner, input)),
      position: { x: 0, y: 0, z: 0 },
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
      const d = piece(slot, widthInput);
      const id = newId();
      baseIds.push(id);
      placed.push({
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
      const d = wallPiece(ws, widthInput);
      placed.push({
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
    const foot = placedBounds({ ...made, rotationY, position: { x: 0, y: 0, z: 0 } });
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
      const d = cornerPiece(corner, input);
      if (d.product.kind !== 'corner') continue;
      const side = cornerSide(room, i);
      const design: Design = {
        ...d,
        product: { ...d.product, params: { ...d.product.params, side } },
      };
      const made = makeItem(p, design);
      const len = wallLength(room, i);
      const rotationY = turnFor(wallInward(room, i));
      const foot = placedBounds({ ...made, rotationY, position: { x: 0, y: 0, z: 0 } });
      const along = rotationY % 180 === 0 ? foot.w : foot.d;
      const across = rotationY % 180 === 0 ? foot.d : foot.w;
      const box = wallBox(room, i, len - along, along, across, 0, 1);
      items.push({ ...made, rotationY, position: { x: box.x, y: 0, z: box.z } });
    }
  // Wall corner cabinets, hung with their tops at the wall row's height (ADR-177).
  if (corner !== 'none')
    for (const i of corners) {
      const d = wallCorners.has(i) ? wallCornerPiece(corner, input) : null;
      if (d?.product.kind !== 'corner') continue;
      const design: Design = {
        ...d,
        // Hung by its template (ADR-177): its underside at the wall row's.
        product: {
          ...d.product,
          params: { ...d.product.params, side: cornerSide(room, i), mountHeight: mount },
        },
      };
      const made = makeItem(p, design);
      const len = wallLength(room, i);
      const rotationY = turnFor(wallInward(room, i));
      const foot = placedBounds({ ...made, rotationY, position: { x: 0, y: 0, z: 0 } });
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

/** A wall cabinet's depth, from its design. */
function wallDepth(d: Design): Mm {
  const p = d.product;
  return p.kind === 'cabinet' || p.kind === 'corner' ? p.params.depth : 320;
}

/** Width and depth of the room's bounding box. */
export function roomSize(room: Room): { w: Mm; d: Mm } {
  const xs = room.outline.map((p) => p[0]),
    zs = room.outline.map((p) => p[1]);
  return { w: Math.max(...xs) - Math.min(...xs), d: Math.max(...zs) - Math.min(...zs) };
}
