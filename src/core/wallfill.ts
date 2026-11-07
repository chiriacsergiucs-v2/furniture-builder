/**
 * Fill a wall (ADR-103): from a wall's width, depth and height, suggest mixes of tall and base cabinets whose widths
 * add up to exactly the wall width. Every mix is an ordinary project built by `buildProjectModel()` (ADR-004); a mix
 * with an error is never offered (ADR-008). Pure and deterministic: the same input gives the same mixes.
 * ADR-104 adds an optional row of wall cabinets with its own widths over the whole wall, and a top box over each
 * tall cabinet up to the entered height.
 * ADR-204 adds the tall cabinet height and the wall cabinet depth to Refine, one round width per base kind (ranked after
 * the shared width), and carcasses of 3 or 4 equal fronts.
 */
import { t } from './i18n';
import { buildModel } from './build';
import {
  KITCHEN_BASE,
  KITCHEN_TALL,
  KITCHEN_WALL,
  base,
  door,
  drawers,
  empty,
  even,
  fr,
  shelves,
  splitX,
  splitY,
  tall,
} from './catalog/helpers';
import { kitchen } from './catalog/kitchen';
import { insertable } from './catalog/types';
import { newId } from './design';
import {
  buildProjectModel,
  makeItem,
  newProject,
  type Project,
  type ProjectModel,
} from './project';
import type { Design, Diagnostic, Mm, Space } from './types';

type PieceKind = 'tall' | 'shelves' | 'drawers' | 'door';
export type TallPosition = 'left' | 'right' | 'ends' | 'centre';
/** Whether mixes get a row of wall cabinets (ADR-104): some with and some without, every mix, or none. */
export type WallRow = 'any' | 'always' | 'never';

export interface WallInput {
  width: Mm;
  depth: Mm;
  height: Mm;
  /** Depth of tall cabinets; absent = `depth`. */
  tallDepth?: Mm;
  /** Piece width range, the user's values (ADR-103: 400–1200). */
  minWidth?: Mm;
  maxWidth?: Mm;
  /** Base cabinet height with its plinth; absent = the catalog base height. */
  baseHeight?: Mm;
  /** Exact number of pieces; absent = any. */
  pieces?: number;
  /** Number of tall cabinets; absent = any (1, 0 or 2 are tried). */
  tallCount?: number;
  /** Where tall cabinets stand; absent = left for one, both ends for two. */
  tallPosition?: TallPosition;
  /** At least this many base cabinets of each kind. */
  atLeast?: Partial<Record<Exclude<PieceKind, 'tall'>, number>>;
  /** Equal fronts: every door the same width (wall / N), carcasses of 1 or 2 fronts, insides empty. */
  equalFronts?: number;
  /** Row of wall cabinets (ADR-104); absent = any. */
  wallRow?: WallRow;
  /** Wall cabinet height; absent = the catalog wall cabinet height. Their tops sit at `height`. */
  wallHeight?: Mm;
  /** Height of every tall cabinet (ADR-204); absent = `TALL_HEIGHT`. The top box fills the rest up to `height`. */
  tallHeight?: Mm;
  /** Depth of every wall cabinet (ADR-204); absent = the catalog's (320). */
  wallDepth?: Mm;
}

/** A piece of the wall row: a catalog wall cabinet, or a top box standing on a tall cabinet (ADR-104). */
export interface WallSlot {
  /** Catalog wall-cabinet variant id, or 'top-box'. */
  variant: string;
  width: Mm;
  height: Mm;
  /** Left edge, room mm. */
  x: Mm;
  /** Top box: index of the tall cabinet slot it stands on. */
  over?: number;
}

export interface Slot {
  kind: PieceKind;
  width: Mm;
  /** Equal-fronts mode: how many fronts this carcass carries. */
  fronts?: number;
}

export interface Mix {
  key: string;
  slots: Slot[];
  /** "600 · 600 · 600 · 600 · 600" */
  widths: string;
  /** "1 tall, 2 open shelves, 1 drawers, 1 door + shelves" */
  summary: string;
  /** The wall row, left to right; absent = no wall row. */
  wall?: WallSlot[];
  /** "750 · 750 · 750 · 750" for the wall row. */
  wallWidths?: string;
  project: Project;
  model: ProjectModel;
  /** Warnings shown on the card: pieces above the entered height first, then the model's. */
  warnings: Diagnostic[];
}

export interface WallFill {
  mixes: Mix[];
  /** Why nothing (or nothing more) could be suggested; errors mean the input itself is wrong. */
  problems: Diagnostic[];
}

/** Mixes shown first (ADR-103: "4 mixes"). */
export const MIXES_FIRST = 4;
export const WALL_DEFAULTS = { minWidth: 400, maxWidth: 1200 } as const;
/** The catalog's own sizes (ADR-036 defaults, typical values to confirm). */
export const BASE_HEIGHT = KITCHEN_BASE.height!;
export const TALL_HEIGHT = KITCHEN_TALL.height!;
export const WALL_HEIGHT = KITCHEN_WALL.height!;
/** The catalog wall cabinet depth, Refine's starting value (ADR-204). */
export const WALL_DEPTH = KITCHEN_WALL.depth!;

/** The example's width and the catalog default width: mixes nearest it rank first ("closest to your example"). */
const EXAMPLE_WIDTH = 600;
/** Base kinds are dealt in the example's proportion: 2 open shelves, 1 drawers, 1 door + shelves. */
const DEAL: Exclude<PieceKind, 'tall'>[] = ['shelves', 'drawers', 'door', 'shelves'];
/** Candidates built at most per call, so a long wall cannot hang the page. */
const MAX_BUILDS = 120;
/** Most pieces in one mix, so a tiny min width or a huge front count cannot freeze the page (reported, not clamped). */
export const MAX_PIECES = 40;
/**
 * Most candidates worked out per call (ADR-204): a long wall with a width per base kind has very many; past this the
 * rest are not tried, and the mixes say so (reported, not clamped).
 */
export const MAX_CANDIDATES = 12000;

const kindText = (k: PieceKind, n: number): string =>
  ({
    tall: t('{n} tall', { n }),
    shelves: t('{n} open shelves', { n }),
    drawers: t('{n} drawers', { n }),
    door: t('{n} door + shelves', { n }),
  })[k];
const PIECE_NAME: Record<PieceKind, string> = {
  tall: 'Tall cabinet',
  shelves: 'Base, open shelves',
  drawers: 'Base, drawers',
  door: 'Base, door + shelves',
};

const err = (code: string, message: string): Diagnostic => ({ severity: 'error', code, message });
const info = (code: string, message: string): Diagnostic => ({
  severity: 'warning',
  code,
  message,
});
const whole = (n: unknown): n is number => typeof n === 'number' && Number.isInteger(n);

/** The answer a problem names (ADR-193), so the wizard can mark that field. */
export type WallField =
  | 'width'
  | 'depth'
  | 'height'
  | 'tallDepth'
  | 'baseHeight'
  | 'wallHeight'
  | 'tallHeight'
  | 'wallDepth'
  | 'minWidth'
  | 'maxWidth'
  | 'pieces'
  | 'equalFronts'
  | 'tallCount'
  | 'shelves'
  | 'drawers'
  | 'door';
export type WallIssue = Diagnostic & { field: WallField };

/** Problems with the input itself; the wizard shows them and suggests nothing (ADR-008: never clamp). */
export function checkWall(input: WallInput): WallIssue[] {
  const out: WallIssue[] = [];
  const bad = (field: WallField, code: string, message: string) =>
    out.push({ ...err(code, message), field });
  const pos = (field: WallField, v: unknown, label: string) => {
    if (!whole(v) || v <= 0)
      bad(field, 'wall-input', t('{label} must be a whole number of mm above 0.', { label }));
  };
  pos('width', input.width, t('Width'));
  pos('depth', input.depth, t('Depth'));
  pos('height', input.height, t('Height'));
  if (input.tallDepth !== undefined) pos('tallDepth', input.tallDepth, t('Tall depth'));
  if (input.baseHeight !== undefined) pos('baseHeight', input.baseHeight, t('Base height'));
  if (input.wallHeight !== undefined) pos('wallHeight', input.wallHeight, t('Wall cabinet height'));
  if (input.tallHeight !== undefined) pos('tallHeight', input.tallHeight, t('Tall cabinet height'));
  if (input.wallDepth !== undefined) pos('wallDepth', input.wallDepth, t('Wall cabinet depth'));
  const min = input.minWidth ?? WALL_DEFAULTS.minWidth,
    max = input.maxWidth ?? WALL_DEFAULTS.maxWidth;
  pos('minWidth', min, t('Min piece width'));
  pos('maxWidth', max, t('Max piece width'));
  if (whole(min) && whole(max) && min > max)
    bad(
      'minWidth',
      'wall-range',
      t('Min piece width {min} mm is more than the max, {max} mm.', { min, max }),
    );
  for (const [field, v, label] of [
    ['pieces', input.pieces, t('Number of pieces')],
    ['equalFronts', input.equalFronts, t('Equal fronts')],
  ] as const)
    if (v !== undefined && (!whole(v) || v < 1))
      bad(field, 'wall-input', t('{label} must be 1 or more.', { label }));
  for (const [field, v, label] of [
    ['tallCount', input.tallCount, t('Tall cabinets')],
    ['shelves', input.atLeast?.shelves, t('Open shelf bases')],
    ['drawers', input.atLeast?.drawers, t('Drawer bases')],
    ['door', input.atLeast?.door, t('Door bases')],
  ] as const)
    if (v !== undefined && (!whole(v) || v < 0))
      bad(field, 'wall-input', t('{label} must be 0 or more.', { label }));
  return out;
}

/** `total` split into `n` whole-mm parts, the remainder given 1 mm at a time from the left (ADR-003). */
export function exactSplit(total: Mm, n: number): Mm[] {
  const q = Math.floor(total / n),
    r = total - q * n;
  return Array.from({ length: n }, (_, i) => q + (i < r ? 1 : 0));
}

export interface Candidate {
  slots: Slot[];
  score: number[];
  /** Same widths and kinds counted: one card per signature. */
  signature: string;
}

/** The tall cabinet height in use (ADR-204). */
const tallHeightOf = (input: Pick<WallInput, 'tallHeight'>): Mm => input.tallHeight ?? TALL_HEIGHT;

/** Positions of `t` tall cabinets among `n` pieces. */
function tallIndices(n: number, t: number, at: TallPosition): number[] | null {
  if (t === 0) return [];
  if (t > n) return null;
  if (at === 'left') return Array.from({ length: t }, (_, i) => i);
  if (at === 'right') return Array.from({ length: t }, (_, i) => n - t + i);
  if (at === 'centre') {
    const s = Math.floor((n - t) / 2);
    return Array.from({ length: t }, (_, i) => s + i);
  }
  // Both ends: alternate left and right.
  return Array.from({ length: t }, (_, i) =>
    i % 2 ? n - 1 - Math.floor(i / 2) : Math.floor(i / 2),
  );
}

/** Base kinds for `b` pieces: the required minimums first, then dealt in the example's proportion. */
function dealKinds(b: number, atLeast: WallInput['atLeast']): Exclude<PieceKind, 'tall'>[] | null {
  const need = {
    shelves: atLeast?.shelves ?? 0,
    drawers: atLeast?.drawers ?? 0,
    door: atLeast?.door ?? 0,
  };
  if (need.shelves + need.drawers + need.door > b) return null;
  const count = { ...need };
  for (let i = 0, k = 0; k < b - need.shelves - need.drawers - need.door; i++, k++)
    count[DEAL[i % DEAL.length]]++;
  // Left to right: open shelves, drawers, doors (the order of the example).
  return [
    ...Array<'shelves'>(count.shelves).fill('shelves'),
    ...Array<'drawers'>(count.drawers).fill('drawers'),
    ...Array<'door'>(count.door).fill('door'),
  ];
}

const symmetric = (slots: Slot[]) =>
  slots.every((s, i) => {
    const o = slots[slots.length - 1 - i];
    return s.width === o.width && (s.kind === 'tall') === (o.kind === 'tall');
  });

function lay(
  widths: { tall: Mm[]; base: Mm[] },
  kinds: Exclude<PieceKind, 'tall'>[],
  at: number[],
  n: number,
) {
  const slots: Slot[] = [];
  let ti = 0,
    bi = 0;
  for (let i = 0; i < n; i++)
    if (at.includes(i)) slots.push({ kind: 'tall', width: widths.tall[ti++] });
    else {
      slots.push({ kind: kinds[bi], width: widths.base[bi] });
      bi++;
    }
  return slots;
}

/**
 * Ranking, smaller first (ADR-103 "closest to your example first"). `perKind` (ADR-204): a mix with a width per base
 * kind ranks after the shared-width mixes with as many distinct widths.
 */
function scoreOf(slots: Slot[], nominal: Mm[], exact: boolean, perKind = false): number[] {
  const t = slots.filter((s) => s.kind === 'tall').length;
  const distinct = new Set(nominal).size;
  const round = nominal.some((w) => w % 50 !== 0) ? 1 : 0;
  const near = Math.round(
    nominal.reduce((a, w) => a + Math.abs(w - EXAMPLE_WIDTH), 0) / nominal.length / 50,
  );
  // Fewest distinct widths, round widths, one tall cabinet and widths near 600 (the example), then no odd
  // millimetre, symmetry and fewest pieces.
  return [
    distinct,
    perKind ? 1 : 0,
    round,
    Math.abs(t - 1),
    near,
    exact ? 0 : 1,
    symmetric(slots) ? 0 : 1,
    slots.length,
  ];
}

/**
 * Every way to fill `input.width` within the refine answers, unranked; `suggestMixes` ranks and builds them. At most
 * `MAX_CANDIDATES`; `report.capped` is set when more were left out (ADR-204).
 */
export function candidates(input: WallInput, report?: { capped: boolean }): Candidate[] {
  const W = input.width,
    min = input.minWidth ?? WALL_DEFAULTS.minWidth,
    max = input.maxWidth ?? WALL_DEFAULTS.maxWidth;
  const inRange = (w: Mm) => w >= min && w <= max;
  const out: Candidate[] = [];
  const nMin = Math.max(1, Math.ceil(W / max)),
    nMax = Math.floor(W / min);
  const counts = (input.pieces !== undefined ? [input.pieces] : range(nMin, nMax)).filter(
    (n) => n <= MAX_PIECES,
  );
  const talls = input.tallCount !== undefined ? [input.tallCount] : [1, 0, 2];

  if (input.equalFronts !== undefined) {
    const N = input.equalFronts;
    if (N > 2 * MAX_PIECES) return out;
    const fronts = exactSplit(W, N);
    // Carcasses of 1 or 2 fronts (a door front has 1 or 2 leaves); uniform first, then mixed and symmetric.
    for (const groups of frontGroups(N))
      for (const t of talls) {
        const n = groups.length;
        if (n > MAX_PIECES) continue;
        if (input.pieces !== undefined && n !== input.pieces) continue;
        const at = tallIndices(n, t, input.tallPosition ?? (t === 2 ? 'ends' : 'left'));
        if (!at) continue;
        let f = 0;
        // Carcasses of 3 or 4 fronts (ADR-204) end at the rounded share of the wall, so equal carcasses are equally
        // wide and their doors can match within 1 mm; 1- and 2-front carcasses keep the front-by-front split.
        const wide = groups.some((k) => k > 2);
        const slots: Slot[] = groups.map((k, i) => {
          const width = wide
            ? Math.round((W * (f + k)) / N) - Math.round((W * f) / N)
            : fronts.slice(f, f + k).reduce((a, b) => a + b, 0);
          f += k;
          return { kind: at.includes(i) ? 'tall' : 'door', width, fronts: k };
        });

        if (!slots.every((s) => inRange(s.width))) continue;
        const nominal = groups.map((k) => k * Math.floor(W / N));
        out.push({
          slots,
          score: scoreOf(slots, nominal, W % N === 0),
          signature: slots.map((s) => `${s.kind === 'tall' ? 'T' : 'F'}${s.fronts}`).join(','),
        });
      }
    return out;
  }

  for (const n of counts)
    for (const t of talls) {
      if (t > n) continue;
      const b = n - t;
      const kinds = dealKinds(b, input.atLeast);
      if (!kinds) continue;
      const at = tallIndices(n, t, input.tallPosition ?? (t === 2 ? 'ends' : 'left'));
      if (!at) continue;
      // Tall width: the same as the bases (an even split of the wall), or a round width with the bases sharing the rest.
      const tallWidths = t === 0 || b === 0 ? [null] : [null, ...range(min, max, 50)];
      for (const wt of tallWidths) {
        if (out.length >= MAX_CANDIDATES) {
          if (report) report.capped = true;
          return out;
        }
        let tw: Mm[], bw: Mm[], nominal: Mm[], exact: boolean;
        if (wt === null) {
          const all = exactSplit(W, n);
          // The extra millimetres go to the bases first, so tall cabinets keep the round width.
          tw = all.slice(n - t);
          bw = all.slice(0, n - t);
          nominal = Array(n).fill(Math.floor(W / n));
          exact = W % n === 0;
        } else {
          const rest = W - t * wt;
          if (rest <= 0) continue;
          tw = Array(t).fill(wt);
          bw = exactSplit(rest, b);
          nominal = [...tw, ...Array(b).fill(Math.floor(rest / b))];
          exact = rest % b === 0;
          if (Math.floor(rest / b) === wt) continue; // already covered by the even split
        }
        if (![...tw, ...bw].every(inRange)) continue;
        const slots = lay({ tall: tw, base: bw }, kinds, at, n);
        out.push({
          slots,
          score: scoreOf(slots, nominal, exact),
          signature: `${t}|${[...slots]
            .map((s) => s.width)
            .sort((x, y) => x - y)
            .join(',')}`,
        });
      }
      // One round width per base kind (ADR-204), the last kind taking the exact rest; tall cabinets at a round width.
      if (!perKindWidths({ W, kinds, t, at, n, min, max }, out, report)) return out;
    }
  return out;
}

/**
 * Adds the mixes with one round width per base kind (G-118): every kind but the last at a round width (50 mm steps,
 * min–max), the last kind sharing the exact rest; tall cabinets at one round width, or none. A mix whose kinds all
 * share one width is the shared-width mix and is left out. False when `MAX_CANDIDATES` was reached.
 */
function perKindWidths(
  c: {
    W: Mm;
    kinds: Exclude<PieceKind, 'tall'>[];
    t: number;
    at: number[];
    n: number;
    min: Mm;
    max: Mm;
  },
  out: Candidate[],
  report?: { capped: boolean },
): boolean {
  const { W, kinds, t, at, n, min, max } = c;
  const order = [...new Set(kinds)];
  if (order.length < 2) return true;
  const count = order.map((k) => kinds.filter((x) => x === k).length);
  const steps = range(min, max, 50);
  if (!steps.length) return true;
  const head = order.length - 1;
  const lastN = count[head];
  // The fixed kinds' widths are tried in the same order as an odometer (the first kind changing fastest), but a
  // choice that leaves the last kind no room within min–max is skipped at once instead of being counted out at the
  // end: only the valid combinations were ever built, and they come out in the same order.
  const below = count.map((_, k) => count.slice(0, k).reduce((a, n) => a + n, 0));
  const first = steps[0],
    lastStep = steps[steps.length - 1];
  for (const wt of t ? steps : [0]) {
    const left = W - t * wt;
    const fixed = Array<number>(head).fill(0);
    const walk = (k: number, chosen: number): boolean => {
      if (k < 0) {
        const rest = left - chosen;
        if (rest <= 0) return true;
        // The last kind's pieces are floor(rest / lastN) or one more: both within min–max, and not all one width.
        const lowest = Math.floor(rest / lastN);
        if (lowest < min || Math.ceil(rest / lastN) > max || fixed.every((w) => w === lowest))
          return true;
        const lastW = exactSplit(rest, lastN);
        const widths = [...fixed, lowest];
        if (out.length >= MAX_CANDIDATES) {
          if (report) report.capped = true;
          return false;
        }
        // Widths in the order the kinds stand, the last kind's exact split from the left.
        let li = 0;
        const bw = kinds.map((kind) => {
          const i = order.indexOf(kind);
          return i < head ? fixed[i] : lastW[li++];
        });
        const slots = lay({ tall: Array(t).fill(wt), base: bw }, kinds, at, n);
        const nominal = [...Array(t).fill(wt), ...kinds.map((kind) => widths[order.indexOf(kind)])];
        out.push({
          slots,
          score: scoreOf(slots, nominal, rest % lastN === 0, true),
          // The signature names each kind's width: "800 drawers + 600 shelves" differs from the swap (ADR-204).
          signature: `${t}|${t ? `tall ${wt},` : ''}${order.map((kind, x) => `${kind} ${widths[x]}×${count[x]}`).join(',')}`,
        });
        return true;
      }
      for (const w of steps) {
        fixed[k] = w;
        const c = chosen + w * count[k];
        // The kinds still to choose (0 to k-1) take between `first` and `lastStep` each; what is left for the last
        // kind must fit lastN pieces of min–max.
        if (left - c - below[k] * first < lastN * min) break; // wider only leaves less
        if (left - c - below[k] * lastStep > lastN * max) continue;
        if (!walk(k - 1, c)) return false;
      }
      return true;
    };
    if (!walk(head - 1, 0)) return false;
  }
  return true;
}

function range(a: number, b: number, step = 1): number[] {
  const out: number[] = [];
  for (let v = Math.ceil(a / step) * step; v <= b; v += step) out.push(v);
  return out;
}

/**
 * Ways to group N fronts into carcasses: of 1 or 2 first (all 2s, all 1s, then 2s with the 1s at both ends or centre),
 * then of 3 and 4 fronts (ADR-204): all 3s, all 4s, then 4s in the middle with 3s at both ends.
 */
export function frontGroups(N: number): number[][] {
  const out: number[][] = [];
  const seen = new Set<string>();
  const add = (g: number[]) => {
    const k = g.join('');
    if (g.length && !seen.has(k)) {
      seen.add(k);
      out.push(g);
    }
  };
  if (N % 2 === 0) add(Array(N / 2).fill(2));
  add(Array(N).fill(1));
  for (let ones = N % 2; ones < N; ones += 2) {
    const twos = (N - ones) / 2;
    const half = Math.floor(ones / 2);
    add([...Array(half).fill(1), ...Array(twos).fill(2), ...Array(ones - half).fill(1)]);
    add([
      ...Array(Math.floor(twos / 2)).fill(2),
      ...Array(ones).fill(1),
      ...Array(twos - Math.floor(twos / 2)).fill(2),
    ]);
  }
  if (N % 3 === 0) add(Array(N / 3).fill(3));
  if (N % 4 === 0) add(Array(N / 4).fill(4));
  for (let fours = 1; 4 * fours < N; fours++) {
    const r = N - 4 * fours;
    if (r % 3) continue;
    const threes = r / 3;
    const half = Math.floor(threes / 2);
    add([...Array(half).fill(3), ...Array(fours).fill(4), ...Array(threes - half).fill(3)]);
  }
  return out;
}

// ---------------------------------------------------------------------------
// Pieces
// ---------------------------------------------------------------------------

const pantry = (doors: 1 | 2): Space =>
  splitY(even(2), [shelves(3, door(doors)), shelves(2, door(doors))]);

/** Interiors to try for a kind, in order: one door, two doors, then two bays with a centre divider (ADR-103 sag). */
function interiors(kind: PieceKind): Space[] {
  switch (kind) {
    case 'tall':
      return [pantry(1), pantry(2), splitX(even(2), [pantry(1), pantry(1)])];
    case 'shelves':
      return [shelves(2), splitX(even(2), [shelves(2), shelves(2)])];
    case 'drawers':
      return [drawers(3, [fr(1), fr(1.5), fr(2)])];
    case 'door':
      return [
        shelves(1, door(1)),
        shelves(1, door(2)),
        splitX(even(2), [shelves(1, door(1)), shelves(1, door(1))]),
      ];
  }
}

/** Warnings an interior change can avoid: a sagging shelf or a door wider than the guidance (ADR-035). */
const AVOID = new Set(['shelf-span', 'door-wide']);

export function piece(slot: Slot, input: WallInput): Design {
  const isTall = slot.kind === 'tall';
  const size = {
    width: slot.width,
    depth: isTall ? (input.tallDepth ?? input.depth) : input.depth,
    height: isTall ? tallHeightOf(input) : (input.baseHeight ?? BASE_HEIGHT),
  };
  const name = `${slot.fronts ? (isTall ? 'Tall cabinet' : 'Base') + `, ${slot.fronts} ${slot.fronts === 1 ? 'front' : 'fronts'}` : PIECE_NAME[slot.kind]} ${slot.width}`;
  const make = (s: Space) => (isTall ? tall(name, size, s) : base(name, size, s));
  if (slot.fronts) {
    // Equal fronts: the inside is left empty, to be configured in the editor.
    const k = slot.fronts;
    if (k <= 2) {
      const one = () => empty(door(k as 1 | 2));
      return make(isTall ? splitY(even(2), [one(), one()]) : one());
    }
    return equalBays(k, (bays) => make(isTall ? splitY(even(2), [bays(), bays()]) : bays()));
  }
  const tries = interiors(slot.kind);
  let last: Design | null = null;
  for (const s of tries) {
    last = make(s);
    if (!buildModel(last).diagnostics.some((d) => AVOID.has(d.code))) return last;
  }
  return last!;
}

/**
 * A carcass of `k` (3 or 4) equal fronts (ADR-204): `k` bays, a divider between, one empty door each. The bays are
 * weighted so the doors come out equal (the end doors overlay a side, the inner ones half a divider): a few rounds
 * from the doors as built (ADR-004). The last design built when they never get within 1 mm; suggestMixes drops it.
 */
function equalBays(k: number, make: (bays: () => Space) => Design): Design {
  let weights = Array<number>(k).fill(1);
  let last: Design | null = null;
  for (let round = 0; round < 4; round++) {
    const w = weights;
    last = make(() =>
      splitX(
        w.map((v) => fr(v)),
        Array.from({ length: k }, () => empty(door(1))),
      ),
    );
    const doors = buildModel(last).panels.filter((p) => p.role === 'door');
    const xs = [...new Set(doors.map((p) => p.box.x))].sort((a, b) => a - b);
    if (xs.length !== k) return last;
    const ws = xs.map((x) => doors.find((p) => p.box.x === x)!.box.w);
    if (Math.max(...ws) - Math.min(...ws) <= 1) return last;
    const mean = ws.reduce((a, b) => a + b, 0) / k;
    const total = w.reduce((a, b) => a + b, 0);
    const scale = total / ws.reduce((a, b) => a + b, 0);
    weights = w.map((v, i) => Math.round((v + (mean - ws[i]) * scale) * 10000) / 10000);
    if (weights.some((v) => v < 0.01 || v > 1000)) return last;
  }
  return last!;
}

// ---------------------------------------------------------------------------
// Wall row (ADR-104)
// ---------------------------------------------------------------------------

/** Wall-cabinet variants dealt left to right, in the order the user named them; then the rest of the family. */
const WALL_ORDER = ['wall-1-door', 'wall-open', 'wall-flap', 'wall-cabinet', 'wall-hood'];
const wallFamily = kitchen.find((f) => f.id === 'wall-cabinet')!;
export const WALL_VARIANTS = [
  ...WALL_ORDER.map((id) => wallFamily.variants.find((v) => v.id === id)).filter((v) => !!v),
  ...wallFamily.variants.filter((v) => !WALL_ORDER.includes(v.id)),
].filter(insertable);

/** Best number of equal pieces for a stretch of wall: round widths near 600 first, then no odd mm, then fewer. */
function bestSplit(S: Mm, min: Mm, max: Mm): number | null {
  let best: { m: number; score: number[] } | null = null;
  for (
    let m = Math.max(1, Math.ceil(S / max));
    m <= Math.min(Math.floor(S / min), MAX_PIECES);
    m++
  ) {
    const q = Math.floor(S / m);
    if (q < min || Math.ceil(S / m) > max) continue;
    const score = [q % 50 ? 1 : 0, Math.round(Math.abs(q - EXAMPLE_WIDTH) / 50), S % m ? 1 : 0, m];
    if (!best || cmp(score, best.score) < 0) best = { m, score };
  }
  return best?.m ?? null;
}

/**
 * The wall row for a base row: its own widths over each stretch above base cabinets, a top box over each tall cabinet
 * sized to the entered height (none when there is no room). Null when a stretch cannot be split in range.
 */
export function wallRowFor(slots: Slot[], input: WallInput): WallSlot[] | null {
  const min = input.minWidth ?? WALL_DEFAULTS.minWidth,
    max = input.maxWidth ?? WALL_DEFAULTS.maxWidth;
  const h = input.wallHeight ?? WALL_HEIGHT;
  const out: WallSlot[] = [];
  let x = 0,
    dealt = 0;
  for (let i = 0; i < slots.length;) {
    if (slots[i].kind === 'tall') {
      const gap = input.height - tallHeightOf(input);
      const box: WallSlot = { variant: 'top-box', width: slots[i].width, height: gap, x, over: i };
      // A gap too thin to build a box in is left open, like no room (ADR-104), and noted by suggestMixes.
      if (gap > 0 && topBoxFits(box, input)) out.push(box);
      x += slots[i].width;
      i++;
      continue;
    }
    let S = 0;
    const x0 = x;
    while (i < slots.length && slots[i].kind !== 'tall') {
      S += slots[i].width;
      i++;
    }
    x += S;
    const m = bestSplit(S, min, max);
    if (m === null) return null;
    let at = x0;
    for (const w of exactSplit(S, m)) {
      out.push({
        variant: WALL_VARIANTS[dealt++ % WALL_VARIANTS.length].id,
        width: w,
        height: h,
        x: at,
      });
      at += w;
    }
  }
  return out;
}

/** Whether a top box of this size builds without an error. */
const topBoxFits = (box: WallSlot, input: WallInput) =>
  !buildModel(wallPiece(box, input)).diagnostics.some((d) => d.severity === 'error');

const renew = (s: Space): Space =>
  s.kind === 'split'
    ? { ...s, id: newId(), children: s.children.map(renew) }
    : { ...s, id: newId() };

/** A wall-row piece: the catalog variant resized, tried with one door, two doors, then two bays (sag, ADR-103). */
export function wallPiece(ws: WallSlot, input: WallInput): Design {
  if (ws.variant === 'top-box') {
    const size = {
      width: ws.width,
      height: ws.height,
      depth: input.tallDepth ?? input.depth,
      plinthHeight: 0,
    };
    const name = `Top box ${ws.width}`;
    let last: Design | null = null;
    for (const s of [empty(door(1)), empty(door(2))]) {
      last = tall(name, size, s);
      if (!buildModel(last).diagnostics.some((d) => AVOID.has(d.code))) return last;
    }
    return last!;
  }
  const v = WALL_VARIANTS.find((x) => x.id === ws.variant)!;
  const made = v.create!();
  const prod = made.product;
  if (prod.kind !== 'cabinet') return made;
  const params = prod.params;
  const sized = (interior: Space): Design => ({
    ...made,
    id: newId(),
    name: `${made.name} ${ws.width}`,
    product: {
      ...prod,
      id: newId(),
      params: {
        ...params,
        width: ws.width,
        height: ws.height,
        // The wall cabinet depth from Refine (ADR-204); absent = the catalog's.
        depth: input.wallDepth ?? params.depth,
        mountHeight: input.height - ws.height,
        interior,
      },
    },
  });
  const inner = params.interior;
  const tries: Space[] = [inner];
  if (inner.front?.kind === 'doors' && inner.front.count === 1)
    tries.push({ ...renew(inner), front: door(2) });
  tries.push(splitX(even(2), [renew(inner), renew(inner)]));
  let last: Design | null = null;
  for (const s of tries) {
    last = sized(s);
    if (!buildModel(last).diagnostics.some((d) => AVOID.has(d.code))) return last;
  }
  return last!;
}

const summaryOf = (slots: Slot[]) => {
  if (slots.some((s) => s.fronts)) {
    const n = slots.reduce((a, s) => a + (s.fronts ?? 0), 0);
    const tc = slots.filter((s) => s.kind === 'tall').length;
    const b = slots.length - tc;
    return [
      tc ? kindText('tall', tc) : '',
      b ? t('{n|# base carcass|# base carcasses}', { n: b }) : '',
      t('{n} equal front widths', { n }),
    ]
      .filter(Boolean)
      .join(', ');
  }
  const order: PieceKind[] = ['tall', 'shelves', 'drawers', 'door'];
  return order
    .map((k) => [k, slots.filter((s) => s.kind === k).length] as const)
    .filter(([, c]) => c > 0)
    .map(([k, c]) => kindText(k, c))
    .join(', ');
};

/** The whole wall as a project: pieces side by side on the floor, backs to the wall, left to right. */
export function mixProject(
  slots: Slot[],
  input: WallInput,
  wall?: WallSlot[] | null,
  name = `Wall ${input.width} mm`,
): Project {
  const p = newProject(name);
  let x = 0;
  for (const s of slots) {
    // Placed from the left by the slot widths: a cabinet is exactly as wide as its slot.
    const item = makeItem(p, piece(s, input));
    p.items.push({ ...item, position: { ...item.position, x } });
    x += s.width;
  }
  const baseItems = [...p.items];
  for (const ws of wall ?? []) {
    // Wall cabinets hang with their tops at the entered height (ADR-031); a top box stands on its tall cabinet.
    const item = makeItem(p, wallPiece(ws, input));
    p.items.push({
      ...item,
      position: { ...item.position, x: ws.x },
      ...(ws.over !== undefined
        ? {
            placement: {
              kind: 'above' as const,
              baseId: baseItems[ws.over].id,
              gap: 0,
              offsetX: 0,
            },
          }
        : {}),
    });
  }
  return p;
}

/** Suggested mixes for a wall, best first, at most `limit`, one per signature (widths and tall count). */
export function suggestMixes(input: WallInput, limit = MIXES_FIRST): WallFill {
  const bad = checkWall(input);
  if (bad.length) return { mixes: [], problems: bad };
  const min = input.minWidth ?? WALL_DEFAULTS.minWidth,
    max = input.maxWidth ?? WALL_DEFAULTS.maxWidth;
  const report = { capped: false };
  const list = candidates(input, report).sort(compareCandidates);
  const mixes: Mix[] = [];
  const seen = new Set<string>();
  let built = 0,
    failed = 0,
    wallFailed = 0;
  // Default always: the user's answer to the ADR-104 open question ("Refine choice, default always").
  const row = input.wallRow ?? 'always';
  // "any": each base row once without and once with a wall row, so the cards show both (ADR-104).
  const withWall = row === 'never' ? [false] : row === 'always' ? [true] : [false, true];
  const tries = list.flatMap((c) => withWall.map((w) => ({ c, w })));
  for (const { c, w } of tries) {
    if (mixes.length >= limit || built >= MAX_BUILDS) break;
    const key = `${c.signature}${w ? '|wall' : ''}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const wall = w ? wallRowFor(c.slots, input) : null;
    if (w && !wall) {
      wallFailed++;
      continue;
    }
    built++;
    const project = mixProject(c.slots, input, wall);
    const model = buildProjectModel(project);
    if (model.diagnostics.some((d) => d.severity === 'error')) {
      failed++;
      continue;
    }
    // Carcasses of 3 or 4 fronts are offered only when their doors match within 1 mm (ADR-103, ADR-204).
    if (c.slots.some((x) => (x.fronts ?? 0) > 2)) {
      const keys = project.items.slice(0, c.slots.length).map((i) => `${i.id}:`);
      const ws = model.model.panels
        .filter((p) => p.role === 'door' && keys.some((k) => p.id.startsWith(k)))
        .map((p) => p.box.w);
      if (ws.length && Math.max(...ws) - Math.min(...ws) > 1) {
        failed++;
        continue;
      }
    }
    const tallWarn: Diagnostic[] = [];
    for (const pc of model.pieces) {
      const top = pc.bounds.y + pc.bounds.h;
      if (top > input.height)
        tallWarn.push({
          severity: 'warning',
          code: 'wall-too-tall',
          message: t('{name} is {top} mm tall, {over} mm above the {h} mm height.', {
            name: pc.item.design.name,
            top,
            over: top - input.height,
            h: input.height,
          }),
          itemIds: [pc.item.id],
        });
    }
    mixes.push({
      key,
      slots: c.slots,
      widths: c.slots.map((s) => s.width).join(' · '),
      summary: wall
        ? wall.some((x) => x.variant === 'top-box')
          ? t('{summary}; wall row: {n} wall cabinets + top box', {
              summary: summaryOf(c.slots),
              n: wall.filter((x) => x.variant !== 'top-box').length,
            })
          : t('{summary}; wall row: {n} wall cabinets', {
              summary: summaryOf(c.slots),
              n: wall.filter((x) => x.variant !== 'top-box').length,
            })
        : summaryOf(c.slots),
      ...(wall ? { wall, wallWidths: wall.map((x) => x.width).join(' · ') } : {}),
      project,
      model,
      warnings: [...tallWarn, ...model.diagnostics.filter((d) => d.severity === 'warning')],
    });
  }
  const problems: Diagnostic[] = [];
  if (report.capped)
    problems.push(
      info(
        'wall-capped',
        t(
          'More than {max} ways fill this wall; only the first {max} were tried. Narrow the width range or set the counts to see the rest.',
          { max: MAX_CANDIDATES },
        ),
      ),
    );
  const gap = input.height - tallHeightOf(input);
  if (
    gap > 0 &&
    mixes.some(
      (m) =>
        m.wall &&
        m.slots.some((x) => x.kind === 'tall') &&
        !m.wall.some((x) => x.variant === 'top-box'),
    )
  )
    problems.push(
      info(
        'wall-top-box-small',
        t('The {gap} mm over the tall cabinets is too small for a top box, so it is left open.', {
          gap,
        }),
      ),
    );
  const a = input.atLeast;
  // Equal fronts leave the insides empty, so the base-kind minimums cannot apply: said, not dropped (ADR-008).
  if (input.equalFronts !== undefined && ((a?.shelves ?? 0) || (a?.drawers ?? 0) || (a?.door ?? 0)))
    problems.push(
      info(
        'wall-atleast-ignored',
        t(
          'With Equal fronts the insides are left to configure, so the "At least" bases do not apply.',
        ),
      ),
    );
  const wallH = input.wallHeight ?? WALL_HEIGHT,
    baseTop = input.baseHeight ?? BASE_HEIGHT;
  // A wall cabinet reaching into the base row would overlap it, an error (ADR-008): such mixes are not offered.
  if (row !== 'never' && input.height - wallH < baseTop)
    problems.push(
      info(
        'wall-row-low',
        t(
          'Wall cabinets {wh} mm high under a {h} mm height would reach {over} mm into the base row; lower the wall cabinet height to show a wall row.',
          {
            wh: wallH,
            h: input.height,
            over: baseTop - (input.height - wallH),
          },
        ),
      ),
    );
  else if (row !== 'never' && wallFailed && !mixes.some((m) => m.wall))
    problems.push(
      info(
        'wall-row-none',
        t('No wall row fits these mixes with pieces {min}–{max} mm wide.', { min, max }),
      ),
    );
  if (!mixes.length) {
    if (input.width < min)
      problems.push(
        info(
          'wall-narrow',
          t('The wall ({w} mm) is narrower than the min piece width, {min} mm.', {
            w: input.width,
            min,
          }),
        ),
      );
    else if (
      Math.ceil(input.width / max) > MAX_PIECES ||
      (input.pieces ?? 0) > MAX_PIECES ||
      (input.equalFronts ?? 0) > 2 * MAX_PIECES
    )
      problems.push(
        info(
          'wall-many',
          t(
            'These settings need more than {max} pieces; raise the min or max piece width, or lower the counts.',
            { max: MAX_PIECES },
          ),
        ),
      );
    else if (input.equalFronts !== undefined)
      problems.push(
        info(
          'wall-fronts',
          t(
            'With {n} equal fronts each front is about {each} mm; no carcass of 1 to 4 fronts is between {min} and {max} mm with these settings.',

            {
              n: input.equalFronts,
              each: Math.floor(input.width / input.equalFronts),
              min,
              max,
            },
          ),
        ),
      );
    else if (failed)
      problems.push(
        info(
          'wall-errors',
          t('Every mix that fits has a problem in a piece (check the depth and heights).'),
        ),
      );
    else
      problems.push(
        info(
          'wall-none',
          t('No mix fills {w} mm with pieces {min}–{max} mm wide and these Refine settings.', {
            w: input.width,
            min,
            max,
          }),
        ),
      );
  }
  return { mixes, problems };
}

/**
 * The order candidates are ranked in: by score, then by the slot widths left to right (a shorter list counts as
 * zeros). Compares in place; the ranking sorts many thousands of candidates, so it allocates nothing per comparison.
 */
export function compareCandidates(a: Candidate, b: Candidate): number {
  const d = cmp(a.score, b.score);
  if (d) return d;
  const n = Math.max(a.slots.length, b.slots.length);
  for (let i = 0; i < n; i++) {
    const w = (a.slots[i]?.width ?? 0) - (b.slots[i]?.width ?? 0);
    if (w) return w;
  }
  return 0;
}

export function cmp(a: number[], b: number[]): number {
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const d = (a[i] ?? 0) - (b[i] ?? 0);
    if (d) return d;
  }
  return 0;
}
