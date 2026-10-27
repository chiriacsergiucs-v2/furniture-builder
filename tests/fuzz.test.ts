/**
 * Seeded property test written during an independent review of the geometry core.
 * For each random cabinet/desk that builds without error diagnostics it asserts: valid document, no throw,
 * integer mm, no overlaps, everything inside the envelope, no floating panels, fronts in the front plane,
 * exact gaps between fronts and half-gap outer reveals, drawer parts inside their slot, longest fitting runner.
 * FUZZ_N=50000 npx vitest run tests/fuzz.test.ts for a deep run.
 */
import { it, expect } from 'vitest';
import { buildModel } from '../src/core/build';
import { INTERNAL_DRAWER_SETBACK } from '../src/core/cabinet';
import { validateDesign, defaultDrawers, findSpace, cornerDefaults } from '../src/core/design';
import { explode } from '../src/core/explode';
import { contains, cutDimensions, enclosing, footprintOf, overlaps } from '../src/core/geometry';
import { cutlist } from '../src/core/cutlist';
import { bandFor } from '../src/core/materials';
import { frameDefaults, solidMaterials } from '../src/core/design';
import { aabbOf, panelsOverlap, shapeProblems } from '../src/core/shape';
import type {
  EdgeBand,
  Design,
  Space,
  Material,
  Box,
  CabinetParams,
  CornerParams,
  DeskParams,
  FrameParams,
  Front,
} from '../src/core/types';

let seed = Number(process.env.SEED ?? 12345);
const rnd = () => {
  seed = (seed * 1103515245 + 12345) & 0x7fffffff;
  return seed / 0x7fffffff;
};
const ri = (a: number, b: number) => a + Math.floor(rnd() * (b - a + 1));
// Edge bands (ADR-077) draw from their own sequence so the seeded geometry stays the same as before.
let bandSeed = 777;
const brnd = () => {
  bandSeed = (bandSeed * 1103515245 + 12345) & 0x7fffffff;
  return bandSeed / 0x7fffffff;
};
const randomBand = (): EdgeBand | undefined =>
  brnd() < 0.4
    ? undefined
    : {
        kind: brnd() < 0.5 ? 'abs' : 'pvc',
        thickness: [4, 8, 10, 20, 30][Math.floor(brnd() * 5)],
        // Mostly wider than the board; 15 mm is narrower than every body and front board.
        width: [22, 23, 28, 42, 15][Math.floor(brnd() * 5)],
        ...(brnd() < 0.3 ? { allowance: Math.floor(brnd() * 40) } : {}),
      };
const withBands = (ms: Material[]): Material[] =>
  ms.map((m) => {
    if (m.id !== 'body' && m.id !== 'front') return m;
    const band = randomBand(),
      frontBand = brnd() < 0.3 ? randomBand() : undefined;
    return { ...m, ...(band ? { band } : {}), ...(frontBand ? { frontBand } : {}) };
  });
const pick = <T>(xs: T[]): T => xs[ri(0, xs.length - 1)];
let idc = 0;
const nid = () => `s${idc++}`;

function genSpace(depth: number, doorsAbove: boolean): Space {
  // Hinged doors mostly; sliding doors and flaps sometimes (ADR-037).
  const frontKind = rnd();
  const doors: Front | null =
    doorsAbove || rnd() >= 0.3
      ? null
      : frontKind < 0.75
        ? {
            kind: 'doors' as const,
            count: pick([1, 2] as const),
            hinge: pick(['left', 'right'] as const),
          }
        : frontKind < 0.88
          ? {
              kind: 'sliding' as const,
              count: pick([2, 3, 4] as const),
              overlap: pick([20, 30, 40]),
              track: pick([60, 80, 100]),
            }
          : {
              kind: 'flap' as const,
              count: 1 as const,
              direction: pick(['up', 'down'] as const),
              ...(rnd() < 0.5 ? { fitting: 'Test stay' } : {}),
            };
  const handle =
    rnd() < 0.4
      ? {
          kind: pick(['bar', 'knob', 'push'] as const),
          holeSpacing: pick([96, 128, 160, 192, 320]),
          position: pick(['top', 'centre', 'bottom'] as const),
        }
      : undefined;
  const below = doorsAbove || !!doors;
  const k =
    depth < 3 && rnd() < 0.45 ? 'split' : pick(['empty', 'shelves', 'hanging', 'drawers'] as const);
  const id = nid();
  switch (k) {
    case 'empty':
      return {
        id,
        kind: 'empty',
        front: doors,
        handle,
        ...(rnd() < 0.15
          ? {
              appliance: {
                kind: pick(['oven', 'fridge', 'other'] as const),
                w: ri(200, 700),
                h: ri(200, 900),
                d: ri(200, 600),
              },
            }
          : {}),
      };
    case 'shelves':
      return {
        id,
        kind: 'shelves',
        count: ri(0, 4),
        front: doors,
        handle,
        ...(rnd() < 0.35 ? { adjustable: true } : {}),
      };
    case 'hanging':
      return { id, kind: 'hanging', railDrop: ri(20, 80), front: doors };
    case 'drawers': {
      const count = ri(1, 5);
      const heights =
        rnd() < 0.35
          ? Array.from({ length: count }, () =>
              rnd() < 0.3
                ? { mode: 'mm' as const, value: ri(90, 250) }
                : { mode: 'fr' as const, value: ri(1, 3) },
            )
          : undefined;
      // Sink drawers (ADR-040): the top drawer cut around a trap.
      const uCut = rnd() < 0.2 ? { width: ri(30, 500), depth: ri(30, 450) } : undefined;
      // Sink false front (ADR-054): the top drawer kept as a fixed front.
      const fixedTop = rnd() < 0.15;
      return {
        id,
        kind: 'drawers',
        count,
        front: doors,
        handle,
        ...(heights ? { heights } : {}),
        ...(uCut ? { uCut } : {}),
        ...(fixedTop ? { fixedTop } : {}),
      };
    }
    default: {
      const n = ri(2, 4);
      const children = Array.from({ length: n }, () => genSpace(depth + 1, below));
      return {
        id,
        kind: 'split',
        axis: pick(['x', 'y'] as const),
        sizes: children.map(() =>
          rnd() < 0.25
            ? { mode: 'mm' as const, value: ri(80, 400) }
            : { mode: 'fr' as const, value: ri(1, 3) },
        ),
        children,
        front: doors,
      };
    }
  }
}

function mats(): Material[] {
  return withBands([
    {
      id: 'body',
      name: 'Body',
      thickness: pick([16, 18, 19, 25, 12]),
      grain: rnd() < 0.5,
      color: '#fff',
    },
    {
      id: 'front',
      name: 'Front',
      thickness: pick([16, 18, 19, 22]),
      grain: rnd() < 0.5,
      color: '#fff',
    },
    { id: 'back', name: 'Back', thickness: pick([3, 4, 5, 8]), grain: false, color: '#fff' },
    { id: 'box', name: 'Box', thickness: pick([12, 15, 16]), grain: false, color: '#fff' },
    { id: 'bot', name: 'Bot', thickness: pick([3, 5, 8]), grain: false, color: '#fff' },
    { id: 'top', name: 'Top', thickness: pick([18, 25, 38]), grain: true, color: '#fff' },
  ]);
}
const drawers = () => ({
  ...defaultDrawers(),
  sideClearance: ri(10, 14),
  verticalClearance: ri(20, 40),
  rearClearance: ri(0, 20),
  boxMaterialId: 'box',
  bottomMaterialId: 'bot',
});

/** Diagonal corner units (ADR-040): random sizes, sides, shelves and doors. */
function genDiagonal(): Design {
  idc = 0;
  const W = ri(500, 1400);
  const params: CornerParams = {
    ...cornerDefaults('diagonal'),
    side: pick(['left', 'right'] as const),
    width: W,
    depth: ri(250, Math.max(260, W - 200)),
    height: ri(300, 2400),
    topLayers: pick([1, 2] as const),
    bodyMaterialId: 'body',
    frontMaterialId: 'front',
    backMaterialId: 'back',
    back: pick(['applied', 'none'] as const),
    plinthHeight: pick([0, ri(40, 150)]),
    plinthSetback: ri(0, 80),
    frontGap: ri(0, 5),
    drawers: drawers(),
    interior: {
      id: nid(),
      kind: 'shelves',
      count: ri(0, 5),
      front: pick([
        null,
        { kind: 'doors' as const, count: 1 as const },
        { kind: 'doors' as const, count: 2 as const },
      ]),
    },
  };
  return {
    schemaVersion: 2,
    id: 'd',
    name: 'c',
    createdAt: '',
    updatedAt: '',
    materials: mats(),
    product: { kind: 'corner', id: 'C', params },
  };
}

function genCabinet(): Design {
  idc = 0;
  const params: CabinetParams = {
    width: ri(300, 2400),
    height: ri(300, 2400),
    depth: ri(250, 700),
    bodyMaterialId: 'body',
    frontMaterialId: 'front',
    backMaterialId: 'back',
    top: pick(['over', 'between'] as const),
    bottom: pick(['between', 'between', 'under', 'none'] as const),
    topKind: pick(['panel', 'panel', 'rails'] as const),
    railDepth: pick([80, 100, 120]),
    topLayers: pick([1, 1, 2] as const),
    back: pick(['none', 'applied', 'inset'] as const),
    backInset: ri(0, 30),
    frontStyle: pick(['overlay', 'overlay', 'half', 'inset'] as const),
    plinthHeight: pick([0, 0, ri(40, 120)]),
    plinthSetback: ri(0, 60),
    frontGap: ri(0, 6),
    shelfSetback: ri(0, 30),
    shelfClearance: ri(0, 2),
    pinRowSetback: pick([37, 37, ri(25, 60)]),
    drawers: drawers(),
    interior: genSpace(0, false),
  };
  return {
    schemaVersion: 1,
    id: 'd',
    name: 'f',
    createdAt: '',
    updatedAt: '',
    materials: mats(),
    product: { kind: 'cabinet', id: 'P', params },
  };
}
function genDesk(): Design {
  const params: DeskParams = {
    width: ri(800, 2400),
    depth: ri(450, 900),
    height: ri(650, 900),
    topMaterialId: 'top',
    bodyMaterialId: 'body',
    frontOverhang: ri(0, 60),
    support: pick(['gables', 'pedestal-left', 'pedestal-right', 'two-pedestals'] as const),
    pedestal: { width: ri(300, 600), drawerCount: ri(1, 5) },
    modesty: { enabled: rnd() < 0.6, height: ri(100, 500), setback: ri(0, 200) },
    drawers: drawers(),
    frontMaterialId: 'front',
    frontGap: ri(0, 6),
  };
  return {
    schemaVersion: 1,
    id: 'd',
    name: 'f',
    createdAt: '',
    updatedAt: '',
    materials: mats(),
    product: { kind: 'desk', id: 'K', params },
  };
}

const FRONT = new Set(['door', 'drawer-front']);
const touches = (a: Box, b: Box) => {
  // share a face region (closed intervals intersect on all axes, positive on at least two)
  const iv = (a0: number, a1: number, b0: number, b1: number) =>
    Math.min(a1, b1) - Math.max(a0, b0);
  const ox = iv(a.x, a.x + a.w, b.x, b.x + b.w),
    oy = iv(a.y, a.y + a.h, b.y, b.y + b.h),
    oz = iv(a.z, a.z + a.d, b.z, b.z + b.d);
  return ox >= 0 && oy >= 0 && oz >= 0 && [ox, oy, oz].filter((v) => v > 0).length >= 2;
};

function check(d: Design): string[] {
  const probs: string[] = [];
  const v = validateDesign(d);
  if (v.length) probs.push('validate: ' + v.join(';'));
  let m;
  try {
    m = buildModel(d);
  } catch (e) {
    return [...probs, 'THROW ' + (e as Error).message];
  }
  const errs = m.diagnostics.filter((x) => x.severity === 'error');
  // ADR-077: a band narrower than a banded part's board is always an error, and only then.
  const mat = new Map(d.materials.map((x) => [x.id, x]));
  const narrow = m.panels.some((p) => {
    const x = mat.get(p.materialId);
    const b = x && p.banded.length ? bandFor(x, p.role) : undefined;
    return !!b && b.width < cutDimensions(p, x!.grain).thickness;
  });
  if (narrow !== errs.some((x) => x.code === 'band-narrow'))
    probs.push(`band-narrow expected ${narrow}`);
  if (errs.length) return probs; // only check invariants for designs reported clean
  // ADR-009/077: naming bands never changes a cut size (sampled: the cut list is built twice).
  if (brnd() < 0.1) {
    const plain = d.materials.map(({ band: _b, frontBand: _f, ...x }) => {
      void _b;
      void _f;
      return x;
    });
    const sizes = (ms: Material[]) =>
      cutlist(m, ms).map((r) => [r.materialId, r.length, r.width, r.edgesL, r.edgesW, r.quantity]);
    if (JSON.stringify(sizes(d.materials).sort()) !== JSON.stringify(sizes(plain).sort()))
      probs.push('band-sizes cut sizes change with a band');
  }
  const P = m.panels;
  for (const p of P)
    for (const k of ['x', 'y', 'z', 'w', 'h', 'd'] as const)
      if (!Number.isSafeInteger(p.box[k])) probs.push(`nonint ${p.id}`);
  for (let i = 0; i < P.length; i++)
    for (let j = i + 1; j < P.length; j++)
      if (panelsOverlap(P[i], P[j])) probs.push(`overlap ${P[i].id} ${P[j].id}`);
  for (const p of P) for (const msg of shapeProblems(p)) probs.push(`shape ${p.id} ${msg}`);
  const E = explode([P]);
  for (let i = 0; i < E.length; i++)
    for (let j = i + 1; j < E.length; j++)
      if (panelsOverlap(E[i], E[j])) probs.push(`exploded-overlap ${E[i].id} ${E[j].id}`);
  const tf = d.materials.find((m) => m.id === 'front')!.thickness;
  const fronts = P.filter((p) => FRONT.has(p.role));
  let W: number, H: number, Dd: number, ph: number, g: number, envD: number;
  if (d.product.kind === 'cabinet') {
    const c = d.product.params;
    W = c.width;
    H = c.height;
    Dd = c.depth;
    ph = c.plinthHeight;
    g = c.frontGap;
    envD = Dd;
  } else if (d.product.kind === 'desk') {
    const c = d.product.params;
    W = c.width;
    H = c.height;
    Dd = c.depth - c.frontOverhang;
    ph = 0;
    g = c.frontGap;
    envD = c.depth;
  } else return probs;
  const env: Box = { x: 0, y: 0, z: 0, w: W, h: H, d: envD };
  for (const p of P) if (!FRONT.has(p.role) && !contains(env, p.box)) probs.push(`outside ${p.id}`);
  const style =
    d.product.kind === 'cabinet' ? (d.product.params.frontStyle ?? 'overlay') : 'overlay';
  const fz = style === 'inset' ? Dd - tf : Dd;
  const sliding = (f: (typeof P)[number]) => f.label.startsWith('Sliding door');
  for (const f of fronts) {
    // Sliding doors run in two planes in front of the carcass, whatever the front style (ADR-037).
    if (sliding(f)) {
      if ((f.box.z !== Dd && f.box.z !== Dd + tf + 2) || f.box.d !== tf)
        probs.push(`sliding-z ${f.id}`);
      continue;
    }
    if (f.box.z !== fz || f.box.d !== tf) probs.push(`front-z ${f.id} z=${f.box.z} expected ${fz}`);
    if (
      d.product.kind === 'desk' &&
      f.box.z + f.box.d > envD &&
      !m.diagnostics.some((x) => x.code === 'fronts-proud')
    )
      probs.push(`front-protrudes-past-worktop ${f.id} by ${f.box.z + f.box.d - envD}`);
  }
  // floating: every non-front panel must touch another panel (drawer parts each other; shelves the carcass)
  // Adjustable shelves rest on pins (ADR-023): they are supported only if both neighbouring panels carry pin rows.
  const onPins = (p: (typeof P)[number]) =>
    p.label.startsWith('Adjustable shelf') &&
    P.filter(
      (q) => q.pinRows?.length && (q.box.x + q.box.w <= p.box.x || q.box.x >= p.box.x + p.box.w),
    ).length >= 2;
  for (const p of P)
    if (!FRONT.has(p.role) && !onPins(p) && !P.some((q) => q !== p && touches(p.box, q.box)))
      probs.push(`floating ${p.id}`);
  // front gaps (cabinet only for outer reveal)
  const t = d.materials.find((m) => m.id === 'body')!.thickness;
  const lo = (n: number) => Math.floor(n / 2),
    hi = (n: number) => n - Math.floor(n / 2);
  if (d.product.kind === 'cabinet') {
    // Outer limits per front style (ADR-006, ADR-024).
    const bt = d.product.params.bottom === 'none' ? 0 : t;
    const lim =
      style === 'inset'
        ? { x0: t + g, x1: W - t - g, y0: ph + bt + g, y1: H - t - g }
        : style === 'half'
          ? {
              x0: lo(t) + hi(g),
              x1: W - t + lo(t) - lo(g),
              y0: ph + lo(t) + hi(g),
              y1: H - t + lo(t) - lo(g),
            }
          : { x0: lo(g), x1: W - lo(g), y0: ph + lo(g), y1: H - lo(g) };
    for (const f of fronts) {
      const b = f.box;
      if (sliding(f)) {
        if (b.x < lo(g) || b.x + b.w > W - lo(g)) probs.push(`reveal sliding ${f.id}`);
        continue;
      }
      if (b.x < lim.x0 || b.x + b.w > lim.x1 || b.y < lim.y0 || b.y + b.h > lim.y1)
        probs.push(`reveal ${style} ${f.id}`);
    }
  }
  const okGap = (gap: number) => gap === g || (style === 'inset' && gap === 2 * g + t);
  for (let i = 0; i < fronts.length; i++)
    for (let j = 0; j < fronts.length; j++) {
      if (i === j) continue;
      const a = fronts[i].box,
        b = fronts[j].box;
      const yo = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
      const xo = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
      if (yo > 0 && b.x >= a.x + a.w) {
        const gap = b.x - a.x - a.w;
        if (!okGap(gap) && gap <= 2 * g + t + 20)
          probs.push(`xgap ${gap}!=${g} ${fronts[i].id}|${fronts[j].id}`);
      }
      if (xo > 0 && b.y >= a.y + a.h) {
        const gap = b.y - a.y - a.h;
        if (!okGap(gap) && gap <= 2 * g + t + 20)
          probs.push(`ygap ${gap}!=${g} ${fronts[i].id}|${fronts[j].id}`);
      }
    }
  for (const p of P)
    if ((p.role.startsWith('drawer-') && p.role !== 'drawer-front') || p.role === 'shelf') {
      const sp = m.spaces.find((s) => s.nodeId === p.nodeId);
      if (sp && !contains(sp.box, p.box)) probs.push(`notInSpace ${p.id}`);
    }
  if (d.product.kind === 'cabinet')
    for (const h of m.hardware)
      if (h.kind === 'drawer-runner-pair') {
        const sp = m.spaces.find((s) => s.nodeId === h.nodeId)!;
        const c = d.product.params;
        const internal = h.label.includes('internal');
        const ins = (c.frontStyle ?? 'overlay') === 'inset';
        // Sliding doors run outside the carcass, so they take no depth from the drawers behind them (ADR-037).
        const ownFront = findSpace(c.interior, h.nodeId)?.front;
        const setback = internal
          ? Math.max(c.shelfSetback, INTERNAL_DRAWER_SETBACK) +
            (ins && sp.hasDoors && ownFront?.kind !== 'sliding' ? tf : 0)
          : ins
            ? tf
            : 0;
        const best = Math.max(
          ...c.drawers.runnerLengths.filter(
            (l) => l <= sp.box.d - c.drawers.rearClearance - setback,
          ),
        );
        if (best !== h.sizeMm) probs.push(`runnerChoice ${h.sizeMm} vs ${best}`);
      }
  // runners
  for (const h of m.hardware)
    if (
      h.kind === 'drawer-runner-pair' &&
      !d.product.params.drawers.runnerLengths.includes(h.sizeMm!)
    )
      probs.push('runner not in list');
  // cutlist edge counts 0..2
  return probs;
}

function genFrame(): Design {
  const kind = pick(['table', 'bench', 'stool', 'chair', 'bed'] as const);
  const base = frameDefaults(kind);
  const f: FrameParams = {
    ...base,
    width: ri(300, 2400),
    depth: ri(300, 1200),
    height: ri(300, 1100),
    top: pick(['panel', 'slats'] as const),
    leg: { w: ri(25, 80), d: ri(25, 80) },
    legInset: ri(0, 80),
    apron: { height: pick([0, ri(40, 120)]), thickness: ri(15, 30) },
    stretchers: pick(['none', 'box', 'h'] as const),
    stretcherHeight: ri(60, 300),
    shelf: rnd() < 0.3 ? { height: ri(80, 300) } : null,
    slats: { width: ri(30, 120), thickness: ri(12, 30), gap: ri(5, 80) },
    back:
      (kind === 'chair' || kind === 'bench') && rnd() < 0.8
        ? {
            seatHeight: ri(300, 520),
            style: pick(['slats', 'panel'] as const),
            count: ri(1, 8),
            railHeight: ri(40, 90),
            angleDeg: pick([0, ri(1, 25), ri(1, 60)]),
          }
        : null,
    bed:
      kind === 'bed'
        ? {
            mattress: { w: pick([600, 900, 1400, 1600, 1800]), l: pick([1200, 1900, 2000]) },
            clearance: ri(0, 30),
            deckHeight: ri(200, 500),
            railHeight: ri(140, 260),
            headboardHeight: ri(400, 1200),
            footboardHeight: pick([0, ri(300, 700)]),
            sidePanelHeight: pick([0, 0, ri(400, 900)]),
            tierGap: pick([0, 0, ri(700, 1100)]),
            guardHeight: ri(150, 400),
          }
        : null,
  };
  // Shaped options (ADR-040): reclining positions with a footrest, arm rests, a lounger backrest, a bought base.
  const positions = () => Array.from({ length: ri(1, 4) }, () => ri(91, 179));
  if (f.back && rnd() < 0.3) {
    const ps = positions();
    f.recline = {
      positions: ps,
      at: ri(0, ps.length - 1),
      footrest: rnd() < 0.7 ? { length: ri(100, 600), angles: ps.map(() => ri(0, 90)) } : null,
    };
  }
  if (f.back && rnd() < 0.3) f.arms = { height: f.back.seatHeight + ri(-50, 400) };
  if (kind === 'bench' && !f.back && f.top === 'slats' && rnd() < 0.5) {
    const ps = positions();
    f.backrest = { length: ri(100, 1200), positions: ps, at: ri(0, ps.length - 1) };
  }
  if (kind === 'chair' && rnd() < 0.2) f.base = 'bought';
  return {
    schemaVersion: 2,
    id: 'd',
    name: 'f',
    createdAt: '',
    updatedAt: '',
    materials: [
      ...mats(),
      ...solidMaterials(),
      { id: 'pal18oak', name: 'Oak', thickness: pick([16, 18, 25]), grain: true, color: '#fff' },
    ],
    product: {
      kind: 'frame',
      id: 'F',
      params: { ...f, panelMaterialId: 'pal18oak', solidMaterialId: 'beech' },
    },
  };
}

/** Frames: valid, no throw, whole mm, nothing overlapping, nothing below the floor, nothing floating. */
function checkFrame(d: Design): string[] {
  const probs: string[] = [];
  const v = validateDesign(d);
  if (v.length) probs.push('validate: ' + v.join(';'));
  let m;
  try {
    m = buildModel(d);
  } catch (e) {
    return [...probs, 'THROW ' + (e as Error).message];
  }
  if (m.diagnostics.some((x) => x.severity === 'error')) return probs;
  const P = m.panels;
  for (const p of P)
    for (const k of ['x', 'y', 'z', 'w', 'h', 'd'] as const)
      if (!Number.isSafeInteger(p.box[k]) || (['w', 'h', 'd'].includes(k) && p.box[k] <= 0))
        probs.push(`frame-size ${p.id}`);
  for (const p of P) if (aabbOf(p).y < 0) probs.push(`frame-below-floor ${p.id}`);
  for (let i = 0; i < P.length; i++)
    for (let j = i + 1; j < P.length; j++)
      if (panelsOverlap(P[i], P[j])) probs.push(`frame-overlap ${P[i].id} ${P[j].id}`);
  // A footrest hangs on the bought mechanism and a bought base carries seat and back: those may float.
  const bought =
    d.product.kind === 'frame' &&
    d.product.params.kind === 'chair' &&
    d.product.params.base === 'bought';
  for (const p of P)
    if (
      p.label !== 'Lower shelf' &&
      p.label !== 'Footrest' &&
      !bought &&
      !P.some((q) => q !== p && touches(p.box, q.box))
    )
      probs.push(`frame-floating ${p.id}`);
  return probs;
}

/** A deep run (FUZZ_N=30000, CLAUDE.md) needs more than vitest's 5 s per test: about 4 ms per design. */
const FUZZ_TIMEOUT = Math.max(5000, Number(process.env.FUZZ_N ?? 3000) * 4);

it(
  'random frames keep the frame invariants (seeded fuzz, ADR-038)',
  () => {
    const N = Math.ceil(Number(process.env.FUZZ_N ?? 3000) / 2);
    const found: Record<string, { n: number; probs: string[] }> = {};
    let clean = 0;
    for (let i = 0; i < N; i++) {
      const d = genFrame();
      const probs = checkFrame(d);
      try {
        if (!buildModel(d).diagnostics.some((x) => x.severity === 'error')) clean++;
      } catch {
        /* reported above */
      }
      for (const p of probs) {
        const k = p.split(' ')[0];
        if (process.env.FUZZ_DEBUG && !found[k]) console.log(JSON.stringify(d.product.params));
        found[k] ??= { n: 0, probs };
        found[k].n++;
      }
    }
    expect(clean).toBeGreaterThan(N / 4);
    expect(found).toEqual({});
  },
  FUZZ_TIMEOUT,
);

it(
  'random designs keep every geometric invariant (seeded fuzz)',
  () => {
    const N = Number(process.env.FUZZ_N ?? 3000);
    const found: Record<string, { n: number; ex: Design; probs: string[] }> = {};
    let clean = 0;
    for (let i = 0; i < N; i++) {
      const d = i % 4 === 3 ? genDesk() : i % 8 === 5 ? genDiagonal() : genCabinet();
      const probs = check(d);
      const m = (() => {
        try {
          return buildModel(d);
        } catch {
          return null;
        }
      })();
      if (m && !m.diagnostics.some((x) => x.severity === 'error')) clean++;
      for (const p of probs) {
        const key = p.split(' ')[0];
        if (process.env.FUZZ_DEBUG && !found[key]) console.log(key, JSON.stringify(d));
        if (!found[key]) found[key] = { n: 0, ex: d, probs };
        found[key].n++;
      }
    }
    // At least a third of random designs must be buildable, or the generator is not exercising geometry.
    expect(clean).toBeGreaterThan(N / 3);
    expect(
      Object.fromEntries(
        Object.entries(found).map(([k, v]) => [k, { n: v.n, probs: v.probs.slice(0, 3) }]),
      ),
    ).toEqual({});
  },
  FUZZ_TIMEOUT,
);

it(
  'random turned boxes: exact overlap agrees with the enclosing test and with touching (seeded fuzz, ADR-121)',
  () => {
    const N = Number(process.env.FUZZ_N ?? 3000);
    const probs: string[] = [];
    for (let i = 0; i < N && probs.length < 5; i++) {
      const w = ri(50, 1200),
        d = ri(50, 800),
        h = ri(50, 2000);
      const yaw = { deg: ri(1, 89), cx: ri(0, 2000) + 0.5 * ri(0, 1), cz: ri(0, 2000) };
      const a = { x: ri(0, 1500), y: 0, z: ri(0, 1500), w, h, d, yaw };
      // A second box in the same turned frame: beside a (touching), or 1 mm into it.
      const into = rnd() < 0.5;
      const b = { ...a, x: a.x + w - (into ? 1 : 0), w: ri(50, 900) };
      if (overlaps(a, b) !== into) probs.push(`frame ${JSON.stringify({ a, b, into })}`);
      if (overlaps(a, b) !== overlaps(b, a)) probs.push(`symmetry ${JSON.stringify({ a, b })}`);
      // Any box: a true overlap implies the enclosing boxes overlap; the outline lies inside the enclosing box.
      const c = {
        x: ri(-500, 2500),
        y: ri(-100, 100),
        z: ri(-500, 2500),
        w: ri(1, 900),
        h: ri(1, 900),
        d: ri(1, 900),
        ...(rnd() < 0.5 ? { yaw: { deg: ri(1, 89), cx: ri(0, 2000), cz: ri(0, 2000) } } : {}),
      };
      if (overlaps(a, c) && !overlaps(enclosing(a), enclosing(c)))
        probs.push(`enclosing ${JSON.stringify({ a, c })}`);
      const e = enclosing(a);
      if (
        !footprintOf(a).every(
          ([x, z]) =>
            x >= e.x - 1e-6 && x <= e.x + e.w + 1e-6 && z >= e.z - 1e-6 && z <= e.z + e.d + 1e-6,
        )
      )
        probs.push(`outline ${JSON.stringify(a)}`);
    }
    expect(probs).toEqual([]);
  },
  FUZZ_TIMEOUT,
);
