/**
 * Guillotine sheet placer (ADR-018). A heuristic: seeded, bounded restarts over part orderings, fit rules and
 * split orders, compared lexicographically. It never claims an optimal layout.
 *
 * Rules: every cut runs edge to edge of its rectangle and destroys a full kerf stripe; a part fits a free
 * rectangle only if each residual is 0 or ≥ kerf (a sub-kerf sliver is rejected, never absorbed); grained jobs
 * never rotate parts; trim margins are unusable; the sheet count is respected (null = unlimited).
 */
import type {
  CutOrientation,
  CutTree,
  NestJob,
  NestOptions,
  NestResult,
  NestStats,
  Placement,
  Rect,
  SheetLayout,
  Unplaced,
} from './types';
import { validateNest } from './validate';

type Slot = { node: INode };
type INode =
  | { kind: 'waste'; length: number; width: number }
  | { kind: 'part'; key: string; instance: number; length: number; width: number; rotated: boolean }
  | {
      kind: 'cut';
      orientation: CutOrientation;
      at: number;
      kerf: number;
      first: Slot;
      second: Slot;
    };

interface Free {
  slot: Slot;
  rect: Rect;
  sheet: number;
  id: number;
}
interface Inst {
  key: string;
  instance: number;
  length: number;
  width: number;
}

type Order = 'area' | 'maxSide' | 'length' | 'width' | 'perimeter';
type Fit = 'area' | 'short' | 'long';
type Split = 'across' | 'along' | 'maxArea' | 'minArea';
interface Config {
  order: Order;
  fit: Fit;
  split: Split;
  noise: number;
  firstSheet: boolean;
  preferRotated: boolean;
}

interface Attempt {
  sheets: { root: Slot; placements: Placement[] }[];
  unplaced: Unplaced[];
  cuts: number;
  unusable: number;
  largest: number;
}

const isInt = (n: unknown): n is number => typeof n === 'number' && Number.isSafeInteger(n);
const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());

/** xorshift32; never returns the zero state. */
function rng(seed: number) {
  let s = seed | 0 || 0x9e3779b9;
  return () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return (s >>> 0) / 0x100000000;
  };
}

function jobProblem(job: NestJob): boolean {
  const t = job.trim,
    s = job.sheet;
  if (!isInt(job.kerf) || job.kerf < 0 || !isInt(t) || t < 0) return true;
  if (!isInt(s.length) || !isInt(s.width) || s.length - 2 * t <= 0 || s.width - 2 * t <= 0)
    return true;
  if (s.count !== null && (!isInt(s.count) || s.count < 0)) return true;
  const keys = new Set<string>();
  for (const p of job.parts) {
    if (keys.has(p.key)) return true;
    keys.add(p.key);
    if (
      !isInt(p.length) ||
      !isInt(p.width) ||
      p.length <= 0 ||
      p.width <= 0 ||
      !isInt(p.quantity) ||
      p.quantity < 0
    )
      return true;
  }
  return false;
}

const residualOk = (r: number, kerf: number) => r === 0 || (r > 0 && r >= kerf);
const fits = (rect: Rect, l: number, w: number, kerf: number) =>
  residualOk(rect.length - l, kerf) && residualOk(rect.width - w, kerf);

function orientations(
  inst: Inst,
  grain: boolean,
  preferRotated: boolean,
): [number, number, boolean][] {
  const plain: [number, number, boolean] = [inst.length, inst.width, false];
  if (grain || inst.length === inst.width) return [plain];
  const rot: [number, number, boolean] = [inst.width, inst.length, true];
  return preferRotated ? [rot, plain] : [plain, rot];
}

function score(fit: Fit, rect: Rect, l: number, w: number): [number, number] {
  const rx = rect.length - l,
    ry = rect.width - w;
  const lo = Math.min(rx, ry),
    hi = Math.max(rx, ry);
  if (fit === 'short') return [lo, hi];
  if (fit === 'long') return [hi, lo];
  return [rect.length * rect.width - l * w, lo];
}

/** Replace a free slot by a part plus up to two cuts; returns the new free rectangles. */
function split(
  f: Free,
  l: number,
  w: number,
  rotated: boolean,
  inst: Inst,
  kerf: number,
  rule: Split,
): { frees: Rect[]; slots: Slot[]; cuts: number } {
  const r = f.rect;
  const rx = r.length - l,
    ry = r.width - w;
  const part: Slot = {
    node: { kind: 'part', key: inst.key, instance: inst.instance, length: l, width: w, rotated },
  };
  const frees: Rect[] = [],
    slots: Slot[] = [];
  let cuts = 0;
  const waste = (rect: Rect): Slot => {
    const s: Slot = { node: { kind: 'waste', length: rect.length, width: rect.width } };
    frees.push(rect);
    slots.push(s);
    return s;
  };
  // across first: right piece spans full width; along first: top piece spans full length.
  let acrossFirst: boolean;
  if (rx === 0 || ry === 0) acrossFirst = rx !== 0;
  else if (rule === 'across' || rule === 'along') acrossFirst = rule === 'across';
  else {
    const a = Math.max((rx - kerf) * r.width, l * (ry - kerf));
    const b = Math.max(r.length * (ry - kerf), (rx - kerf) * w);
    acrossFirst = rule === 'maxArea' ? a >= b : a <= b;
  }
  const cutX = (rect: Rect, first: Slot, at: number): Slot => {
    cuts++;
    const second = waste({
      x: at + kerf,
      y: rect.y,
      length: rect.x + rect.length - at - kerf,
      width: rect.width,
    });
    return { node: { kind: 'cut', orientation: 'across-length', at, kerf, first, second } };
  };
  const cutY = (rect: Rect, first: Slot, at: number): Slot => {
    cuts++;
    const second = waste({
      x: rect.x,
      y: at + kerf,
      length: rect.length,
      width: rect.y + rect.width - at - kerf,
    });
    return { node: { kind: 'cut', orientation: 'along-length', at, kerf, first, second } };
  };
  let root: Slot;
  if (acrossFirst) {
    const strip = { x: r.x, y: r.y, length: l, width: r.width };
    const inner = ry > 0 ? cutY(strip, part, r.y + w) : part;
    root = rx > 0 ? cutX(r, inner, r.x + l) : inner;
  } else {
    const strip = { x: r.x, y: r.y, length: r.length, width: w };
    const inner = rx > 0 ? cutX(strip, part, r.x + l) : part;
    root = ry > 0 ? cutY(r, inner, r.y + w) : inner;
  }
  f.slot.node = root.node;
  return { frees, slots, cuts };
}

function runAttempt(
  job: NestJob,
  insts: Inst[],
  cfg: Config,
  usable: Rect,
  rnd: () => number,
): Attempt {
  const kerf = job.kerf;
  const sheets: Attempt['sheets'] = [];
  const unplaced: Unplaced[] = [];
  let frees: Free[] = [];
  let fid = 0,
    cuts = 0;
  const key = (i: Inst) => {
    switch (cfg.order) {
      case 'maxSide':
        return Math.max(i.length, i.width) * 1e6 + Math.min(i.length, i.width);
      case 'length':
        return i.length * 1e6 + i.width;
      case 'width':
        return i.width * 1e6 + i.length;
      case 'perimeter':
        return (i.length + i.width) * 1e6 + (i.length * i.width) / 1e6;
      default:
        return i.length * i.width;
    }
  };
  const order = insts.map((i) => ({ i, k: key(i) * (1 + cfg.noise * (rnd() - 0.5)) }));
  order.sort((a, b) => b.k - a.k);
  const maxSheets = job.sheet.count;

  for (const { i: inst } of order) {
    const ors = orientations(inst, job.grain, cfg.preferRotated);
    let best: { f: Free; l: number; w: number; rot: boolean; s: [number, number] } | null = null;
    for (const f of frees) {
      if (best && cfg.firstSheet && f.sheet > best.f.sheet) continue;
      for (const [l, w, rot] of ors) {
        if (!fits(f.rect, l, w, kerf)) continue;
        const s = score(cfg.fit, f.rect, l, w);
        const better =
          !best ||
          (cfg.firstSheet && f.sheet < best.f.sheet) ||
          ((!cfg.firstSheet || f.sheet === best.f.sheet) &&
            (s[0] < best.s[0] ||
              (s[0] === best.s[0] &&
                (s[1] < best.s[1] || (s[1] === best.s[1] && f.sheet < best.f.sheet)))));
        if (better) best = { f, l, w, rot, s };
      }
    }
    if (!best) {
      const fitsEmpty = ors.some(([l, w]) => fits(usable, l, w, kerf));
      if (!fitsEmpty) {
        unplaced.push({ key: inst.key, instance: inst.instance, reason: 'too-large' });
        continue;
      }
      if (maxSheets !== null && sheets.length >= maxSheets) {
        unplaced.push({ key: inst.key, instance: inst.instance, reason: 'no-sheet-left' });
        continue;
      }
      const root: Slot = { node: { kind: 'waste', length: usable.length, width: usable.width } };
      sheets.push({ root, placements: [] });
      const f: Free = { slot: root, rect: { ...usable }, sheet: sheets.length - 1, id: fid++ };
      frees.push(f);
      let pick: [number, number, boolean] = ors[0];
      let ps: [number, number] | null = null;
      for (const o of ors) {
        if (!fits(usable, o[0], o[1], kerf)) continue;
        const s = score(cfg.fit, usable, o[0], o[1]);
        if (!ps || s[0] < ps[0] || (s[0] === ps[0] && s[1] < ps[1])) {
          ps = s;
          pick = o;
        }
      }
      best = { f, l: pick[0], w: pick[1], rot: pick[2], s: ps ?? [0, 0] };
    }
    const { f, l, w, rot } = best;
    sheets[f.sheet].placements.push({
      key: inst.key,
      instance: inst.instance,
      x: f.rect.x,
      y: f.rect.y,
      length: l,
      width: w,
      rotated: rot,
    });
    const res = split(f, l, w, rot, inst, kerf, cfg.split);
    cuts += res.cuts;
    frees = frees.filter((x) => x !== f);
    res.frees.forEach((rect, k) => {
      if (rect.length > 0 && rect.width > 0)
        frees.push({ slot: res.slots[k], rect, sheet: f.sheet, id: fid++ });
    });
  }

  return { sheets, unplaced, cuts, unusable: 0, largest: 0 };
}

function size(n: INode): [number, number] {
  if (n.kind !== 'cut') return [n.length, n.width];
  const a = size(n.first.node),
    b = size(n.second.node);
  return n.orientation === 'across-length'
    ? [a[0] + n.kerf + b[0], a[1]]
    : [a[0], a[1] + n.kerf + b[1]];
}

function kerfArea(n: INode): number {
  if (n.kind !== 'cut') return 0;
  const [l, w] = size(n);
  return (
    n.kerf * (n.orientation === 'across-length' ? w : l) +
    kerfArea(n.first.node) +
    kerfArea(n.second.node)
  );
}

/** Unusable = kerf + waste rectangles no part of this job could ever occupy; also the largest leftover. */
function scoreWaste(a: Attempt, job: NestJob, insts: Inst[]) {
  const shapes = [...new Set(insts.map((i) => `${i.length}x${i.width}`))].map((d) =>
    d.split('x').map(Number),
  );
  let u = 0;
  const walk = (n: INode) => {
    if (n.kind === 'cut') {
      walk(n.first.node);
      walk(n.second.node);
      return;
    }
    if (n.kind !== 'waste') return;
    a.largest = Math.max(a.largest, n.length * n.width);
    const r = { x: 0, y: 0, length: n.length, width: n.width };
    const usable =
      n.length > 0 &&
      n.width > 0 &&
      shapes.some(([l, w]) => fits(r, l, w, job.kerf) || (!job.grain && fits(r, w, l, job.kerf)));
    if (!usable) u += n.length * n.width;
  };
  for (const s of a.sheets) {
    u += kerfArea(s.root.node);
    walk(s.root.node);
  }
  a.unusable = u;
}

/** Lexicographic: fewest unplaced → fewest sheets → least unusable waste → largest leftover → fewest cuts. */
function better(a: Attempt, b: Attempt): boolean {
  if (a.unplaced.length !== b.unplaced.length) return a.unplaced.length < b.unplaced.length;
  if (a.sheets.length !== b.sheets.length) return a.sheets.length < b.sheets.length;
  if (a.unusable !== b.unusable) return a.unusable < b.unusable;
  if (a.largest !== b.largest) return a.largest > b.largest;
  return a.cuts < b.cuts; // ties keep the earlier attempt (stable)
}

function toTree(n: INode): CutTree {
  if (n.kind === 'cut') {
    return {
      kind: 'cut',
      orientation: n.orientation,
      at: n.at,
      kerf: n.kerf,
      first: toTree(n.first.node),
      second: toTree(n.second.node),
    };
  }
  return { ...n };
}

function statsOf(sheets: SheetLayout[]): NestStats {
  let partArea = 0,
    sheetArea = 0,
    trimArea = 0,
    kerf = 0,
    waste = 0,
    largest = 0,
    cuts = 0;
  const walk = (t: CutTree, l: number, w: number) => {
    if (t.kind === 'part') {
      partArea += l * w;
      return;
    }
    if (t.kind === 'waste') {
      waste += l * w;
      largest = Math.max(largest, l * w);
      return;
    }
    cuts++;
    const sf = size2(t.first),
      ss = size2(t.second);
    if (t.orientation === 'across-length') {
      kerf += t.kerf * w;
      walk(t.first, sf[0], w);
      walk(t.second, ss[0], w);
    } else {
      kerf += t.kerf * l;
      walk(t.first, l, sf[1]);
      walk(t.second, l, ss[1]);
    }
  };
  for (const s of sheets) {
    sheetArea += s.length * s.width;
    trimArea += s.length * s.width - s.usable.length * s.usable.width;
    walk(s.tree, s.usable.length, s.usable.width);
  }
  return {
    sheetsUsed: sheets.length,
    partArea,
    sheetArea,
    trimArea,
    kerfArea: kerf,
    wasteArea: waste,
    largestLeftover: largest,
    utilisation: sheetArea ? partArea / sheetArea : 0,
    cuts,
  };
}

function size2(t: CutTree): [number, number] {
  if (t.kind !== 'cut') return [t.length, t.width];
  const a = size2(t.first),
    b = size2(t.second);
  return t.orientation === 'across-length'
    ? [a[0] + t.kerf + b[0], a[1]]
    : [a[0], a[1] + t.kerf + b[1]];
}

const ORDERS: Order[] = ['area', 'maxSide', 'length', 'width', 'perimeter'];
const FITS: Fit[] = ['area', 'short', 'long'];
const SPLITS: Split[] = ['maxArea', 'minArea', 'across', 'along'];

/** Heuristic guillotine layout for one material. Deterministic for a given seed while within the attempt bound. */
export function nest(job: NestJob, options: NestOptions = {}): NestResult {
  const seed = options.seed ?? 42,
    maxMs = options.maxMs ?? 1500,
    maxAttempts = Math.max(1, options.maxAttempts ?? 40);
  const t0 = now();
  const insts: Inst[] = [];
  for (const p of job.parts) {
    const q = isInt(p.quantity) && p.quantity > 0 ? p.quantity : 0;
    for (let k = 1; k <= q; k++)
      insts.push({ key: p.key, instance: k, length: p.length, width: p.width });
  }
  const finish = (sheets: SheetLayout[], unplaced: Unplaced[], attempts: number): NestResult => {
    const result: NestResult = {
      materialId: job.materialId,
      sheets,
      unplaced,
      stats: statsOf(sheets),
      search: { attempts, elapsedMs: Math.round(now() - t0), seed },
      valid: false,
      errors: [],
    };
    result.errors = validateNest(job, result);
    result.valid = result.errors.length === 0;
    return result;
  };
  if (jobProblem(job)) {
    return finish(
      [],
      insts.map((i) => ({ key: i.key, instance: i.instance, reason: 'invalid-job' as const })),
      0,
    );
  }
  const t = job.trim;
  const usable: Rect = {
    x: t,
    y: t,
    length: job.sheet.length - 2 * t,
    width: job.sheet.width - 2 * t,
  };
  const rnd = rng(seed);
  let best: Attempt | null = null;
  let attempts = 0;
  for (let a = 0; a < maxAttempts; a++) {
    if (a > 0 && now() - t0 > maxMs) break;
    const cfg: Config =
      a < ORDERS.length * 2
        ? {
            order: ORDERS[a % ORDERS.length],
            fit: a < ORDERS.length ? 'area' : 'short',
            split: a < ORDERS.length ? 'maxArea' : 'minArea',
            noise: 0,
            firstSheet: false,
            preferRotated: false,
          }
        : {
            order: ORDERS[Math.floor(rnd() * ORDERS.length)],
            fit: FITS[Math.floor(rnd() * FITS.length)],
            split: SPLITS[Math.floor(rnd() * SPLITS.length)],
            noise: rnd() * 0.4,
            firstSheet: rnd() < 0.5,
            preferRotated: rnd() < 0.5,
          };
    const att = runAttempt(job, insts, cfg, usable, rnd);
    scoreWaste(att, job, insts);
    attempts++;
    if (!best || better(att, best)) best = att;
  }
  const chosen = best as Attempt;
  const sheets: SheetLayout[] = chosen.sheets.map((s, index) => ({
    index,
    length: job.sheet.length,
    width: job.sheet.width,
    usable: { ...usable },
    tree: toTree(s.root.node),
    placements: [...s.placements].sort((p, q) => p.x - q.x || p.y - q.y),
  }));
  const unplaced = [...chosen.unplaced].sort((p, q) =>
    p.key < q.key ? -1 : p.key > q.key ? 1 : p.instance - q.instance,
  );
  return finish(sheets, unplaced, attempts);
}
