import type {
  CabinetParams,
  CornerParams,
  DeskParams,
  Design,
  DrawerSettings,
  FrameKind,
  FrameParams,
  Material,
  PanelParams,
  Product,
  Space,
  SpaceKind,
  SplitSize,
} from './types';
import { isFinish, materialImageProblems } from './surface';
import { bandProblems, materialLabelProblems } from './materials';

export type PedestalSide = 'left' | 'right';

export const newId = (): string =>
  (
    globalThis.crypto?.randomUUID?.() ??
    `${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`
  ).slice(0, 8);

/** User's stock (2026-10-21): PAL and HDF 2800 × 2070, MDF 2440 × 1220, 10 mm trim per edge, 4 mm kerf. */
export const DEFAULT_KERF = 4;
export const DEFAULT_TRIM = 10;
export function defaultSheetFor(m: Pick<Material, 'id' | 'name'>): NonNullable<Material['sheet']> {
  const mdf = /mdf/i.test(m.id) || /mdf/i.test(m.name);
  return mdf
    ? { length: 2440, width: 1220, trim: DEFAULT_TRIM, count: null }
    : { length: 2800, width: 2070, trim: DEFAULT_TRIM, count: null };
}
export const sheetOf = (m: Material) => m.sheet ?? defaultSheetFor(m);
export const kerfOf = (d: Design) => d.cutting?.kerf ?? DEFAULT_KERF;

/** The document shape this app writes: 3 adds edge band specs on boards (ADR-077); 1 and 2 still load. */
export const SCHEMA_VERSION = 3;

/**
 * Older versions → 3 in memory: version 1 gets stock sheets and cutting settings; 2 → 3 adds only optional band
 * fields, so nothing else changes. Returns the same object when already current.
 */
export function upgradeDesign(d: Design): Design {
  if (d.schemaVersion === SCHEMA_VERSION && d.cutting && d.materials.every((m) => m.sheet))
    return d;
  return {
    ...d,
    schemaVersion: SCHEMA_VERSION,
    cutting: d.cutting ?? { kerf: DEFAULT_KERF },
    materials: d.materials.map((m) => (m.sheet ? m : { ...m, sheet: defaultSheetFor(m) })),
  };
}

const baseMaterials = (): Material[] => [
  { id: 'pal18', name: 'PAL 18 white', thickness: 18, grain: false, color: '#ecebe6' },
  { id: 'pal18oak', name: 'PAL 18 oak', thickness: 18, grain: true, color: '#c9a36b' },
  { id: 'pal16', name: 'PAL 16 white', thickness: 16, grain: false, color: '#f1f0ea' },
  { id: 'mdf18', name: 'MDF 18 painted', thickness: 18, grain: false, color: '#b9c4c9' },
  { id: 'hdf3', name: 'HDF 3', thickness: 3, grain: false, color: '#a89a86' },
];
export const defaultMaterials = (): Material[] =>
  baseMaterials().map((m) => ({ ...m, sheet: defaultSheetFor(m) }));

export const defaultDrawers = (): DrawerSettings => ({
  sideClearance: 13,
  verticalClearance: 30,
  rearClearance: 10,
  runnerLengths: [250, 300, 350, 400, 450, 500, 550, 600],
  boxMaterialId: 'pal16',
  bottomMaterialId: 'hdf3',
});

export function makeSpace(kind: SpaceKind, id = newId()): Space {
  switch (kind) {
    case 'empty':
      return { id, kind };
    case 'shelves':
      return { id, kind, count: 2 };
    case 'hanging':
      return { id, kind, railDrop: 60 };
    case 'drawers':
      return { id, kind, count: 3 };
    case 'split':
      return {
        id,
        kind,
        axis: 'x',
        sizes: [fr(), fr()],
        children: [makeSpace('shelves'), makeSpace('shelves')],
      };
  }
}
export const fr = (value = 1): SplitSize => ({ mode: 'fr', value });
export const mm = (value: number): SplitSize => ({ mode: 'mm', value });

export const cabinetDefaults = (interior: Space): CabinetParams => ({
  width: 800,
  height: 900,
  depth: 450,
  bodyMaterialId: 'pal18',
  frontMaterialId: 'mdf18',
  backMaterialId: 'hdf3',
  top: 'over',
  back: 'applied',
  backInset: 15,
  plinthHeight: 80,
  plinthSetback: 40,
  frontGap: 3,
  shelfSetback: 20,
  shelfClearance: 1,
  pinRowSetback: 37,
  drawers: defaultDrawers(),
  interior,
});

export const cornerDefaults = (variant: CornerParams['variant']): CornerParams => ({
  variant,
  side: 'left',
  width: variant === 'blind' ? 1000 : 900,
  wingWidth: 900,
  blindWidth: 610,
  height: 720,
  depth: 560,
  bodyMaterialId: 'pal18',
  frontMaterialId: 'mdf18',
  backMaterialId: 'hdf3',
  top: 'over',
  back: 'applied',
  backInset: 15,
  plinthHeight: 100,
  plinthSetback: 50,
  frontGap: 3,
  shelfSetback: 20,
  drawers: defaultDrawers(),
  interior: {
    id: newId(),
    kind: 'shelves',
    count: 1,
    front: { kind: 'doors', count: 1, ...(variant === 'blind' ? { hinge: 'right' as const } : {}) },
  },
  wingInterior: {
    id: newId(),
    kind: 'shelves',
    count: 1,
    front: variant === 'l-shape' ? { kind: 'doors', count: 1, hinge: 'left' } : null,
  },
});

export const deskDefaults = (): DeskParams => ({
  width: 1400,
  depth: 700,
  height: 750,
  topMaterialId: 'pal18oak',
  bodyMaterialId: 'pal18',
  frontOverhang: 30,
  support: 'pedestal-left',
  pedestal: {
    width: 420,
    drawerCount: 3,
    left: { id: newId(), kind: 'drawers', count: 3 },
    right: { id: newId(), kind: 'drawers', count: 3 },
  },
  modesty: { enabled: true, height: 350, setback: 120 },
  drawers: defaultDrawers(),
  frontMaterialId: 'mdf18',
  frontGap: 3,
});

/** Solid timber for frames (ADR-038): bought in lengths; thickness is nominal (sections vary by part). */
export const solidMaterials = (): Material[] => [
  {
    id: 'beech',
    name: 'Beech, solid',
    thickness: 45,
    grain: true,
    color: '#d8b38a',
    stock: 'solid',
    lengths: [2400, 3000],
  },
  {
    id: 'pine',
    name: 'Pine, solid',
    thickness: 45,
    grain: true,
    color: '#e3c99a',
    stock: 'solid',
    lengths: [2400, 3000],
  },
  {
    id: 'larch',
    name: 'Larch, solid (outdoor)',
    thickness: 45,
    grain: true,
    color: '#c7966a',
    stock: 'solid',
    lengths: [2400, 3000],
  },
];

export const frameDefaults = (kind: FrameKind): FrameParams => {
  const base: FrameParams = {
    kind,
    width: 1600,
    depth: 900,
    height: 750,
    panelMaterialId: 'pal18oak',
    solidMaterialId: 'beech',
    top: 'panel',
    leg: { w: 60, d: 60 },
    legInset: 20,
    apron: { height: 90, thickness: 22 },
    stretchers: 'none',
    stretcherHeight: 150,
    shelf: null,
    slats: { width: 70, thickness: 20, gap: 40 },
    back: null,
    bed: null,
  };
  switch (kind) {
    case 'table':
      return base;
    case 'bench':
      return {
        ...base,
        width: 1200,
        depth: 380,
        height: 450,
        leg: { w: 45, d: 45 },
        legInset: 30,
        apron: { height: 70, thickness: 22 },
      };
    case 'stool':
      return {
        ...base,
        width: 380,
        depth: 380,
        height: 650,
        leg: { w: 40, d: 40 },
        legInset: 10,
        apron: { height: 60, thickness: 22 },
        stretchers: 'box',
        stretcherHeight: 250,
      };
    case 'chair':
      return {
        ...base,
        width: 450,
        depth: 500,
        height: 880,
        leg: { w: 40, d: 40 },
        legInset: 0,
        apron: { height: 70, thickness: 22 },
        stretchers: 'h',
        stretcherHeight: 150,
        back: { seatHeight: 460, style: 'slats', count: 4, railHeight: 60, angleDeg: 8 },
        slats: { width: 40, thickness: 16, gap: 40 },
      };
    case 'bed':
      return {
        ...base,
        height: 1000,
        panelMaterialId: 'pal18oak',
        solidMaterialId: 'pine',
        apron: { height: 0, thickness: 25 },
        leg: { w: 45, d: 45 },
        slats: { width: 70, thickness: 20, gap: 50 },
        bed: {
          mattress: { w: 1600, l: 2000 },
          clearance: 10,
          deckHeight: 380,
          railHeight: 180,
          headboardHeight: 1000,
          footboardHeight: 0,
          sidePanelHeight: 0,
          tierGap: 0,
          guardHeight: 300,
        },
      };
  }
};

export const panelDefaults = (purpose: PanelParams['purpose']): PanelParams => ({
  purpose,
  width: purpose === 'filler' ? 50 : purpose === 'cover' ? 580 : 597,
  height: purpose === 'fridge' ? 1200 : purpose === 'cover' ? 870 : 717,
  materialId: 'mdf18',
  handle:
    purpose === 'dishwasher' || purpose === 'fridge'
      ? { kind: 'bar', holeSpacing: 128, position: 'top' }
      : null,
});

export function wrap(name: string, product: Product): Design {
  const now = new Date().toISOString();
  const solid = product.kind === 'frame' ? solidMaterials() : [];
  return {
    schemaVersion: SCHEMA_VERSION,
    id: newId(),
    name,
    createdAt: now,
    updatedAt: now,
    materials: [...defaultMaterials(), ...solid],
    product,
    cutting: { kerf: DEFAULT_KERF },
  };
}
export const cabinet = (name: string, over: Partial<CabinetParams>, interior: Space) =>
  wrap(name, {
    kind: 'cabinet',
    id: newId(),
    params: { ...cabinetDefaults(interior), ...over, interior },
  });

export interface Template {
  id: string;
  name: string;
  description: string;
  create: () => Design;
}

export const templates: Template[] = [
  {
    id: 'chest',
    name: 'Chest of drawers',
    description: '800 × 900 × 450, four drawers on a plinth',
    create: () => cabinet('Chest of drawers', {}, { id: newId(), kind: 'drawers', count: 4 }),
  },
  {
    id: 'bookcase',
    name: 'Bookcase',
    description: '800 × 1800 × 300, four shelves, white body',
    create: () =>
      cabinet(
        'Bookcase',
        { height: 1800, depth: 300, plinthHeight: 60, shelfSetback: 0 },
        { id: newId(), kind: 'shelves', count: 4 },
      ),
  },
  {
    id: 'base-door',
    name: 'Base cabinet',
    description: '600 × 720 × 560, one shelf behind a door',
    create: () =>
      cabinet(
        'Base cabinet',
        { width: 600, height: 720, depth: 560, plinthHeight: 100, plinthSetback: 50 },
        { id: newId(), kind: 'shelves', count: 1, front: { kind: 'doors', count: 1 } },
      ),
  },
  {
    id: 'sideboard',
    name: 'Sideboard',
    description: '1600 × 800 × 450, doors either side of a drawer bank',
    create: () =>
      cabinet(
        'Sideboard',
        { width: 1600, height: 800, bodyMaterialId: 'pal18oak' },
        {
          id: newId(),
          kind: 'split',
          axis: 'x',
          sizes: [fr(), mm(500), fr()],
          children: [
            { id: newId(), kind: 'shelves', count: 1, front: { kind: 'doors', count: 1 } },
            { id: newId(), kind: 'drawers', count: 3 },
            { id: newId(), kind: 'shelves', count: 1, front: { kind: 'doors', count: 1 } },
          ],
        },
      ),
  },
  {
    id: 'wardrobe',
    name: 'Wardrobe',
    description: '1200 × 2100 × 600, hanging + shelves behind two doors',
    create: () =>
      cabinet(
        'Wardrobe',
        { width: 1200, height: 2100, depth: 600, plinthHeight: 80 },
        {
          id: newId(),
          kind: 'split',
          axis: 'x',
          sizes: [fr(), fr()],
          front: { kind: 'doors', count: 2 },
          children: [
            {
              id: newId(),
              kind: 'split',
              axis: 'y',
              sizes: [mm(300), fr()],
              children: [
                { id: newId(), kind: 'empty' },
                { id: newId(), kind: 'hanging', railDrop: 50 },
              ],
            },
            { id: newId(), kind: 'shelves', count: 5 },
          ],
        },
      ),
  },
  {
    id: 'wall-cabinet',
    name: 'Wall cabinet',
    description: '800 × 720 × 320, two doors, hung on brackets',
    create: () =>
      cabinet(
        'Wall cabinet',
        {
          width: 800,
          height: 720,
          depth: 320,
          mount: 'wall',
          mountHeight: 1450,
          plinthHeight: 0,
          back: 'inset',
          backInset: 18,
        },
        { id: newId(), kind: 'shelves', count: 1, front: { kind: 'doors', count: 2 } },
      ),
  },
  {
    id: 'corner-blind',
    name: 'Blind corner base',
    description: '1000 × 720 × 560, 400 mm blind section on the left, one door',
    create: () =>
      wrap('Blind corner base', { kind: 'corner', id: newId(), params: cornerDefaults('blind') }),
  },
  {
    id: 'corner-l',
    name: 'L-shaped corner base',
    description: '900 × 900 × 720, two wings open to each other, folding door pair',
    create: () =>
      wrap('L-shaped corner base', {
        kind: 'corner',
        id: newId(),
        params: cornerDefaults('l-shape'),
      }),
  },
  {
    id: 'panels',
    name: 'Loose panels',
    description: 'Parts known only by their cut sizes, listed for cutting; not assembled',
    create: () =>
      wrap('Loose panels', {
        kind: 'panels',
        id: newId(),
        params: {
          panels: [
            {
              id: newId(),
              name: 'Panel',
              length: 600,
              width: 300,
              materialId: 'pal18',
              quantity: 1,
            },
          ],
        },
      }),
  },
  {
    id: 'desk-pedestal',
    name: 'Desk with pedestal',
    description: '1400 × 700 × 750, three-drawer pedestal left',
    create: () => wrap('Desk with pedestal', { kind: 'desk', id: newId(), params: deskDefaults() }),
  },
  {
    id: 'desk-gables',
    name: 'Panel desk',
    description: '1200 × 600 × 750, two panel gables',
    create: () =>
      wrap('Panel desk', {
        kind: 'desk',
        id: newId(),
        params: { ...deskDefaults(), width: 1200, depth: 600, support: 'gables' },
      }),
  },
];

// ---------------------------------------------------------------------------
// Space tree operations (pure, immutable)
// ---------------------------------------------------------------------------

export function findSpace(root: Space, id: string): Space | undefined {
  if (root.id === id) return root;
  if (root.kind === 'split')
    for (const c of root.children) {
      const f = findSpace(c, id);
      if (f) return f;
    }
  return undefined;
}

export function parentOf(root: Space, id: string): Space | undefined {
  if (root.kind !== 'split') return undefined;
  for (const c of root.children) {
    if (c.id === id) return root;
    const f = parentOf(c, id);
    if (f) return f;
  }
  return undefined;
}

export function mapSpace(root: Space, id: string, fn: (s: Space) => Space): Space {
  if (root.id === id) return fn(root);
  if (root.kind === 'split') {
    let changed = false;
    const children = root.children.map((c) => {
      const n = mapSpace(c, id, fn);
      if (n !== c) changed = true;
      return n;
    });
    return changed ? { ...root, children } : root;
  }
  return root;
}

/** Change what a space contains, keeping its id and doors. Drawers cannot keep doors' role as fronts. */
export function changeKind(s: Space, kind: SpaceKind): Space {
  if (s.kind === kind) return s;
  const next = makeSpace(kind, s.id);
  return { ...next, front: s.front ?? null, ...(s.handle ? { handle: s.handle } : {}) };
}

/** Change a drawer count, keeping custom heights in step (new drawers share the rest). */
export function setDrawerCount(s: Space, count: number): Space {
  if (s.kind !== 'drawers') return s;
  const heights = s.heights
    ? count > s.heights.length
      ? [...s.heights, ...Array.from({ length: count - s.heights.length }, () => fr())]
      : s.heights.slice(0, count)
    : undefined;
  return { ...s, count, ...(heights ? { heights } : {}) };
}

export function splitSpace(s: Space, axis: 'x' | 'y', parts: number): Space {
  const n = Math.max(2, Math.min(8, Math.round(parts)));
  const first: Space = { ...s, id: newId(), front: null };
  // New parts start empty (ADR-089): a divider adds a divider and nothing else.
  const children: Space[] = [first, ...Array.from({ length: n - 1 }, () => makeSpace('empty'))];
  return {
    id: s.id,
    kind: 'split',
    axis,
    sizes: children.map(() => fr()),
    children,
    front: s.front ?? null,
  };
}

/** Collapse a split back into a plain space (keeps id, doors). */
export const unsplit = (s: Space): Space =>
  s.kind === 'split' ? { id: s.id, kind: 'shelves', count: 2, front: s.front ?? null } : s;

/**
 * A row of bays: vertical dividers, the same number of fixed shelves in every bay and the same doors on each.
 * The quick layout for base and wall units; anything finer is edited space by space.
 */
export interface BayLayout {
  bays: number;
  shelves: number;
  doors: 0 | 1 | 2;
}
export const MAX_BAYS = 8;

/** The bay layout a space tree already has, or null when its inside is laid out some other way. */
export function bayLayoutOf(s: Space): BayLayout | null {
  const one = (c: Space): Omit<BayLayout, 'bays'> | null =>
    c.kind === 'shelves' && !c.adjustable
      ? { shelves: c.count, doors: (c.front?.count ?? 0) as BayLayout['doors'] }
      : null;
  if (s.kind !== 'split') {
    const b = one(s);
    return b ? { bays: 1, ...b } : null;
  }
  if (s.axis !== 'x' || s.front) return null;
  const kids = s.children.map(one);
  const first = kids[0];
  if (!first || kids.some((k) => !k || k.shelves !== first.shelves || k.doors !== first.doors))
    return null;
  return { bays: s.children.length, ...first };
}

/**
 * Lay a space out as bays. Keeps the root id and existing bay ids (so selection and fixed bay widths survive),
 * and the handle of the first bay on every bay.
 */
export function makeBays(l: BayLayout, prev: Space): Space {
  const bays = Math.max(1, Math.min(MAX_BAYS, Math.round(l.bays)));
  const shelves = Math.max(0, Math.min(MAX_SHELVES, Math.round(l.shelves)));
  const front = l.doors ? { kind: 'doors' as const, count: l.doors } : null;
  const old = prev.kind === 'split' && prev.axis === 'x' ? prev.children : [prev];
  const handle = old[0]?.handle;
  const bay = (i: number, id: string): Space => {
    const was = old[i];
    const hinge =
      was?.front?.kind === 'doors' && was.front.count === 1 && l.doors === 1
        ? was.front.hinge
        : undefined;
    return {
      id,
      kind: 'shelves',
      count: shelves,
      front: front && hinge ? { ...front, hinge } : front,
      ...(handle ? { handle } : {}),
    };
  };
  if (bays === 1) return bay(0, prev.id);
  const sizes =
    prev.kind === 'split' && prev.axis === 'x' && prev.sizes.length === bays
      ? prev.sizes
      : Array.from({ length: bays }, () => fr());
  const children = Array.from({ length: bays }, (_, i) =>
    bay(i, old[i] && old[i].id !== prev.id ? old[i].id : newId()),
  );
  return { id: prev.id, kind: 'split', axis: 'x', sizes, children, front: null };
}

// ---------------------------------------------------------------------------
// Editable space roots of any product (cabinet interior, desk drawer units)
// ---------------------------------------------------------------------------

export const usesPedestal = (p: DeskParams, side: PedestalSide) =>
  p.support === 'two-pedestals' ||
  p.support === (side === 'left' ? 'pedestal-left' : 'pedestal-right');

/** The stored tree, or the legacy equal-drawers unit with a stable id. */
export const pedestalRoot = (p: DeskParams, side: PedestalSide, deskId: string): Space =>
  p.pedestal[side] ?? {
    id: `${deskId}:ped-${side}:drawers`,
    kind: 'drawers',
    count: p.pedestal.drawerCount,
  };

/** Editable space trees of a product, each with the name shown in breadcrumbs. */
export interface ProductRoot {
  root: Space;
  label: string;
  side?: PedestalSide;
  wing?: 'a' | 'b';
}

export function productRoots(prod: Product): ProductRoot[] {
  if (prod.kind === 'cabinet') return [{ root: prod.params.interior, label: 'Interior' }];
  if (prod.kind === 'panel' || prod.kind === 'frame' || prod.kind === 'panels') return [];
  if (prod.kind === 'corner') {
    if (prod.params.variant === 'diagonal')
      return [{ root: prod.params.interior, label: 'Interior', wing: 'a' }];
    return prod.params.variant === 'blind'
      ? [{ root: prod.params.interior, label: 'Usable section', wing: 'a' }]
      : [
          { root: prod.params.interior, label: 'Back-wall wing', wing: 'a' },
          { root: prod.params.wingInterior, label: 'Side-wall wing', wing: 'b' },
        ];
  }
  const desk = prod.params;
  return (['left', 'right'] as const)
    .filter((s) => usesPedestal(desk, s))
    .map((side) => ({
      root: pedestalRoot(desk, side, prod.id),
      side,
      label: `${side === 'left' ? 'Left' : 'Right'} drawer unit`,
    }));
}

export function findInProduct(
  prod: Product,
  id: string,
): ({ space: Space } & ProductRoot) | undefined {
  for (const r of productRoots(prod)) {
    const space = findSpace(r.root, id);
    if (space) return { space, ...r };
  }
  return undefined;
}

export function mapProductSpace(prod: Product, id: string, fn: (s: Space) => Space): Product {
  if (prod.kind === 'cabinet') {
    const interior = mapSpace(prod.params.interior, id, fn);
    return interior === prod.params.interior
      ? prod
      : { ...prod, params: { ...prod.params, interior } };
  }
  if (prod.kind === 'corner') {
    const interior = mapSpace(prod.params.interior, id, fn);
    if (interior !== prod.params.interior) return { ...prod, params: { ...prod.params, interior } };
    const wingInterior = mapSpace(prod.params.wingInterior, id, fn);
    return wingInterior === prod.params.wingInterior
      ? prod
      : { ...prod, params: { ...prod.params, wingInterior } };
  }
  if (prod.kind !== 'desk') return prod;
  const desk = prod.params;
  for (const { root, side } of productRoots(prod)) {
    const next = mapSpace(root, id, fn);
    if (next !== root)
      return { ...prod, params: { ...desk, pedestal: { ...desk.pedestal, [side!]: next } } };
  }
  return prod;
}

export function setProductParams<P extends Product>(prod: P, patch: Partial<P['params']>): P {
  return { ...prod, params: { ...prod.params, ...patch } } as P;
}

// ---------------------------------------------------------------------------
// Validation of an untrusted design (JSON import / storage)
// ---------------------------------------------------------------------------

export const MAX_SHELVES = 50;
export const MAX_MM = 100_000;
export const MAX_DRAWERS = 20;
export const MAX_LOOSE = 100;

const isObj = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === 'object' && !Array.isArray(v);
const isInt = (v: unknown, min = 0) => typeof v === 'number' && Number.isSafeInteger(v) && v >= min;
const isStr = (v: unknown) => typeof v === 'string' && v.length > 0 && v.length < 500;

const validSize = (z: unknown) =>
  isObj(z) &&
  ((z.mode === 'mm' && isInt(z.value, 1) && (z.value as number) <= MAX_MM) ||
    (z.mode === 'fr' && typeof z.value === 'number' && z.value >= 0.01 && z.value <= 1000));

function validFront(f: unknown): boolean {
  if (!isObj(f)) return false;
  if (f.kind === 'doors')
    return (
      (f.count === 1 || f.count === 2) &&
      (f.hinge === undefined || f.hinge === 'left' || f.hinge === 'right')
    );
  if (f.kind === 'sliding')
    return (
      [2, 3, 4].includes(f.count as number) &&
      (f.overlap === undefined || (isInt(f.overlap) && (f.overlap as number) <= 200)) &&
      (f.track === undefined || (isInt(f.track, 1) && (f.track as number) <= 300))
    );
  if (f.kind === 'flap')
    return (
      f.count === 1 &&
      (f.direction === 'up' || f.direction === 'down') &&
      (f.fitting === undefined || (typeof f.fitting === 'string' && f.fitting.length <= 200))
    );
  return false;
}

const isOptStr = (v: unknown, max = 300) =>
  v === undefined || (typeof v === 'string' && v.length <= max);

/** ADR-028: optional catalog metadata; checked when present, never throws. */
function validateCatalog(c: unknown, errs: string[]) {
  if (c === undefined) return;
  if (!isObj(c)) {
    errs.push('Invalid catalog metadata');
    return;
  }
  for (const k of ['category', 'brand', 'productName', 'articleNumber', 'hardwareToChoose'])
    if (!isOptStr(c[k])) errs.push(`Invalid catalog ${k}`);
  const o = c.origin;
  if (o === undefined) return;
  if (
    !isObj(o) ||
    !isStr(o.catalogId) ||
    !isInt(o.revision) ||
    !isStr(o.productName) ||
    !isStr(o.takenAt) ||
    !isOptStr(o.brand) ||
    !isOptStr(o.variantId)
  ) {
    errs.push('Invalid catalog origin');
    return;
  }
  if (
    o.sourceUrl !== undefined &&
    !(
      typeof o.sourceUrl === 'string' &&
      /^https?:\/\//.test(o.sourceUrl) &&
      o.sourceUrl.length < 2000
    )
  )
    errs.push('Catalog source link must be an http(s) address');
}

/** ADR-046: the wizard answers a piece was made from; checked when present, never geometry. */
function validateWizard(w: unknown, errs: string[]) {
  if (w === undefined) return;
  const a = isObj(w) ? w.answers : undefined;
  if (!isObj(a) || Object.keys(a).length > 100 || JSON.stringify(a).length > 20_000) {
    errs.push('Invalid wizard answers');
    return;
  }
  const scalar = (v: unknown) =>
    (typeof v === 'string' && v.length <= 500) || (typeof v === 'number' && Number.isFinite(v));
  const item = (v: unknown) =>
    scalar(v) ||
    (isObj(v) &&
      typeof v.kind === 'string' &&
      v.kind.length <= 50 &&
      typeof v.shelves === 'number' &&
      Number.isFinite(v.shelves) &&
      typeof v.drawers === 'number' &&
      Number.isFinite(v.drawers));
  for (const v of Object.values(a))
    if (!(scalar(v) || (Array.isArray(v) && v.length <= 20 && v.every(item)))) {
      errs.push('Invalid wizard answers');
      return;
    }
}

function validateRules(s: unknown, errs: string[]) {
  if (s === undefined) return;
  if (!isObj(s) || (s.rules !== undefined && !isObj(s.rules))) {
    errs.push('Invalid settings');
    return;
  }
  const r = (s.rules ?? {}) as Record<string, unknown>;
  for (const k of ['shelfSpan', 'doorMaxWidth', 'hangerDepth', 'roomHeight'])
    if (r[k] !== undefined && (!isInt(r[k], 1) || (r[k] as number) > MAX_MM))
      errs.push(`Invalid rule setting ${k}`);
}

function validateSpace(s: unknown, errs: string[], seen: Set<string>, depth = 0) {
  if (depth > 12) {
    errs.push('Space tree is too deep');
    return;
  }
  if (!isObj(s) || !isStr(s.id)) {
    errs.push('Invalid space');
    return;
  }
  if (seen.has(s.id as string)) errs.push(`Duplicate space id ${String(s.id)}`);
  seen.add(s.id as string);
  if (s.front != null && !validFront(s.front)) errs.push('Invalid doors');
  if (
    s.handle != null &&
    !(
      isObj(s.handle) &&
      ['bar', 'knob', 'push'].includes(s.handle.kind as string) &&
      (s.handle.holeSpacing === undefined ||
        (isInt(s.handle.holeSpacing, 16) && (s.handle.holeSpacing as number) <= 2000)) &&
      (s.handle.position === undefined ||
        ['top', 'centre', 'bottom'].includes(s.handle.position as string))
    )
  )
    errs.push('Invalid handle');
  switch (s.kind) {
    case 'empty':
      if (
        s.appliance !== undefined &&
        !(
          isObj(s.appliance) &&
          ['oven', 'microwave', 'fridge', 'dishwasher', 'hob', 'other'].includes(
            s.appliance.kind as string,
          ) &&
          isInt(s.appliance.w, 1) &&
          isInt(s.appliance.h, 1) &&
          isInt(s.appliance.d, 1) &&
          [s.appliance.w, s.appliance.h, s.appliance.d].every((v) => (v as number) <= MAX_MM)
        )
      )
        errs.push('Invalid appliance niche');
      return;
    case 'shelves':
      if (!isInt(s.count) || (s.count as number) > MAX_SHELVES) errs.push('Invalid shelf count');
      if (s.adjustable !== undefined && typeof s.adjustable !== 'boolean')
        errs.push('Invalid adjustable flag');
      return;
    case 'drawers':
      if (!isInt(s.count, 1) || (s.count as number) > MAX_DRAWERS)
        errs.push('Invalid drawer count');
      if (
        s.uCut != null &&
        !(
          isObj(s.uCut) &&
          isInt(s.uCut.width, 1) &&
          isInt(s.uCut.depth, 1) &&
          (s.uCut.width as number) <= MAX_MM &&
          (s.uCut.depth as number) <= MAX_MM
        )
      )
        errs.push('Invalid U-cut');
      if (s.fixedTop !== undefined && typeof s.fixedTop !== 'boolean')
        errs.push('Invalid fixed front');
      if (s.heights !== undefined) {
        if (!Array.isArray(s.heights) || s.heights.length !== s.count)
          errs.push('Drawer heights must list one size per drawer');
        else for (const z of s.heights) if (!validSize(z)) errs.push('Invalid drawer height');
      }
      return;
    case 'hanging':
      if (!isInt(s.railDrop)) errs.push('Invalid rail drop');
      return;
    case 'split':
      if (
        (s.axis !== 'x' && s.axis !== 'y') ||
        !Array.isArray(s.children) ||
        !Array.isArray(s.sizes) ||
        s.children.length !== s.sizes.length ||
        s.children.length < 2
      ) {
        errs.push('Invalid split');
        return;
      }
      for (const z of s.sizes) if (!validSize(z)) errs.push('Invalid split size');
      for (const c of s.children) validateSpace(c, errs, seen, depth + 1);
      return;
    default:
      errs.push(`Unknown space kind ${String(s.kind)}`);
  }
}

export function validateDesign(d: unknown): string[] {
  const errs: string[] = [];
  if (!isObj(d)) return ['Design must be an object'];
  if (d.schemaVersion !== 1 && d.schemaVersion !== 2 && d.schemaVersion !== 3)
    errs.push('Unsupported schemaVersion');
  if (
    d.cutting !== undefined &&
    !(isObj(d.cutting) && isInt(d.cutting.kerf) && (d.cutting.kerf as number) <= 20)
  )
    errs.push('Invalid cutting settings');
  if (!isStr(d.id) || !isStr(d.name)) errs.push('Missing id or name');
  if (!Array.isArray(d.materials) || !d.materials.length) return [...errs, 'Materials missing'];
  const mids = new Set<string>();
  for (const m of d.materials) {
    if (
      !isObj(m) ||
      !isStr(m.id) ||
      !isStr(m.name) ||
      !isInt(m.thickness, 1) ||
      (m.thickness as number) > 200 ||
      typeof m.grain !== 'boolean' ||
      typeof m.color !== 'string'
    )
      errs.push('Invalid material');
    else if (
      m.sheet !== undefined &&
      !(
        isObj(m.sheet) &&
        isInt(m.sheet.length, 100) &&
        isInt(m.sheet.width, 100) &&
        isInt(m.sheet.trim) &&
        2 * (m.sheet.trim as number) <
          Math.min(m.sheet.length as number, m.sheet.width as number) &&
        (m.sheet.count === null || isInt(m.sheet.count))
      )
    )
      errs.push(`Invalid sheet for ${String(m.name)}`);
    else if (m.stock !== undefined && m.stock !== 'sheet' && m.stock !== 'solid')
      errs.push(`Invalid stock for ${String(m.name)}`);
    else if (
      m.lengths !== undefined &&
      !(
        Array.isArray(m.lengths) &&
        m.lengths.length > 0 &&
        m.lengths.every((v) => isInt(v, 100) && (v as number) <= 20_000)
      )
    )
      errs.push(`Invalid stock lengths for ${String(m.name)}`);
    else if (m.image !== undefined && materialImageProblems(m.image).length)
      errs.push(
        `Invalid picture for ${String(m.name)}: ${materialImageProblems(m.image).join(', ')}`,
      );
    else if (m.finish !== undefined && !isFinish(m.finish))
      errs.push(`Invalid finish for ${String(m.name)}: use matte, satin or gloss`);
    else if (m.band !== undefined && bandProblems(m.band).length)
      errs.push(`Invalid edge band for ${String(m.name)}: ${bandProblems(m.band).join(', ')}`);
    else if (m.frontBand !== undefined && bandProblems(m.frontBand).length)
      errs.push(
        `Invalid front edge band for ${String(m.name)}: ${bandProblems(m.frontBand).join(', ')}`,
      );
    else if (materialLabelProblems(m).length)
      errs.push(`Invalid labels for ${String(m.name)}: ${materialLabelProblems(m).join(', ')}`);
    else if (mids.has(m.id as string)) errs.push(`Duplicate material ${String(m.id)}`);
    else mids.add(m.id as string);
  }
  const p = d.product;
  if (!isObj(p) || !isStr(p.id) || !isObj(p.params)) return [...errs, 'Invalid product'];
  const params = p.params;
  // Sizes are whole mm up to 100 m: generous for furniture, far from floating-point trouble.
  const ints = (keys: string[], obj: Record<string, unknown>) =>
    keys.forEach((k) => {
      if (!isInt(obj[k]) || (obj[k] as number) > MAX_MM)
        errs.push(`${k} must be a whole number of mm`);
    });
  const matRef = (k: string, obj: Record<string, unknown>) => {
    if (!mids.has(obj[k] as string)) errs.push(`${k} refers to an unknown material`);
  };
  validateCatalog(d.catalog, errs);
  validateRules(d.settings, errs);
  validateWizard(d.wizard, errs);
  if (p.kind === 'panels') {
    if (!Array.isArray(params.panels) || params.panels.length > MAX_LOOSE)
      return [...errs, 'Invalid panel list'];
    const ids = new Set<string>();
    for (const lp of params.panels) {
      if (
        !isObj(lp) ||
        !isStr(lp.id) ||
        ids.has(lp.id as string) ||
        typeof lp.name !== 'string' ||
        lp.name.length > 200
      ) {
        errs.push('Invalid panel');
        continue;
      }
      ids.add(lp.id as string);
      ints(['length', 'width'], lp);
      if (!isInt(lp.quantity, 1) || (lp.quantity as number) > MAX_LOOSE)
        errs.push(`Quantity of ${String(lp.name)} must be 1 to ${MAX_LOOSE}`);
      matRef('materialId', lp);
      if (lp.place !== undefined) {
        const pl = lp.place;
        if (
          !isObj(pl) ||
          !['flat-x', 'flat-z', 'edge-x', 'edge-z', 'up-x', 'up-z'].includes(pl.lie as string)
        )
          errs.push(`Invalid place for ${String(lp.name)}`);
        else ints(['x', 'y', 'z'], pl);
        if (lp.quantity !== 1)
          errs.push(
            `${String(lp.name)}: a placed panel has quantity 1 (list each copy with its own place)`,
          );
      }
    }
    if (params.joints !== undefined) {
      if (!Array.isArray(params.joints) || params.joints.length > 4 * MAX_LOOSE)
        errs.push('Invalid joints');
      else
        for (const j of params.joints)
          if (
            !isObj(j) ||
            j.kind !== 'screwed' ||
            !ids.has(j.a as string) ||
            !ids.has(j.b as string) ||
            j.a === j.b
          )
            errs.push('Invalid joint');
    }
    if (params.note !== undefined && typeof params.note !== 'string') errs.push('Invalid note');
    return errs;
  }
  if (p.kind === 'panel') {
    ints(['width', 'height'], params);
    matRef('materialId', params);
    if (!['dishwasher', 'fridge', 'cover', 'filler'].includes(params.purpose as string))
      errs.push('Invalid panel purpose');
    if (
      params.handle != null &&
      !(isObj(params.handle) && ['bar', 'knob', 'push'].includes(params.handle.kind as string))
    )
      errs.push('Invalid handle');
    return errs;
  }
  if (p.kind === 'frame') {
    validateFrame(params, errs, ints, matRef);
    return errs;
  }
  const dr = params.drawers;
  if (!isObj(dr) || !Array.isArray(dr.runnerLengths) || !dr.runnerLengths.every((v) => isInt(v, 1)))
    errs.push('Invalid drawer settings');
  else {
    ints(['sideClearance', 'verticalClearance', 'rearClearance'], dr);
    matRef('boxMaterialId', dr);
    matRef('bottomMaterialId', dr);
  }
  if (p.kind === 'cabinet') {
    ints(
      [
        'width',
        'height',
        'depth',
        'backInset',
        'plinthHeight',
        'plinthSetback',
        'frontGap',
        'shelfSetback',
      ],
      params,
    );
    ['bodyMaterialId', 'frontMaterialId', 'backMaterialId'].forEach((k) => matRef(k, params));
    if (params.top !== 'over' && params.top !== 'between') errs.push('Invalid top joint');
    if (
      params.bottom !== undefined &&
      !['between', 'under', 'none'].includes(params.bottom as string)
    )
      errs.push('Invalid bottom joint');
    if (params.topKind !== undefined && params.topKind !== 'panel' && params.topKind !== 'rails')
      errs.push('Invalid top kind');
    if (
      params.railDepth !== undefined &&
      (!isInt(params.railDepth, 1) || (params.railDepth as number) > 1000)
    )
      errs.push('railDepth must be a whole number of mm');
    if (
      params.shelfClearance !== undefined &&
      (!isInt(params.shelfClearance) || (params.shelfClearance as number) > 20)
    )
      errs.push('shelfClearance must be a whole number of mm');
    if (
      params.pinRowSetback !== undefined &&
      (!isInt(params.pinRowSetback, 8) || (params.pinRowSetback as number) > 300)
    )
      errs.push('pinRowSetback must be 8 to 300 mm');
    if (
      params.frontStyle !== undefined &&
      !['overlay', 'half', 'inset'].includes(params.frontStyle as string)
    )
      errs.push('Invalid front style');
    if (params.mount !== undefined && params.mount !== 'floor' && params.mount !== 'wall')
      errs.push('Invalid mount');
    if (params.mountHeight !== undefined && !isInt(params.mountHeight))
      errs.push('mountHeight must be a whole number of mm');
    if (!['none', 'applied', 'inset'].includes(params.back as string)) errs.push('Invalid back');
    validateSpace(params.interior, errs, new Set());
  } else if (p.kind === 'desk') {
    ints(['width', 'depth', 'height', 'frontOverhang', 'frontGap'], params);
    ['topMaterialId', 'bodyMaterialId', 'frontMaterialId'].forEach((k) => matRef(k, params));
    if (
      !['gables', 'pedestal-left', 'pedestal-right', 'two-pedestals'].includes(
        params.support as string,
      )
    )
      errs.push('Invalid support');
    if (
      !isObj(params.pedestal) ||
      !isInt(params.pedestal.width, 1) ||
      !isInt(params.pedestal.drawerCount, 1) ||
      (params.pedestal.drawerCount as number) > MAX_DRAWERS
    )
      errs.push('Invalid pedestal');
    else {
      const seen = new Set<string>();
      for (const side of ['left', 'right'] as const)
        if (params.pedestal[side] !== undefined) validateSpace(params.pedestal[side], errs, seen);
    }
    if (
      !isObj(params.modesty) ||
      typeof params.modesty.enabled !== 'boolean' ||
      !isInt(params.modesty.height) ||
      !isInt(params.modesty.setback)
    )
      errs.push('Invalid modesty panel');
  } else if (p.kind === 'corner') {
    ints(
      [
        'width',
        'wingWidth',
        'blindWidth',
        'height',
        'depth',
        'backInset',
        'plinthHeight',
        'plinthSetback',
        'frontGap',
        'shelfSetback',
      ],
      params,
    );
    ['bodyMaterialId', 'frontMaterialId', 'backMaterialId'].forEach((k) => matRef(k, params));
    if (!['blind', 'l-shape', 'diagonal'].includes(params.variant as string))
      errs.push('Invalid corner variant');
    if (params.side !== 'left' && params.side !== 'right') errs.push('Invalid corner side');
    if (params.top !== 'over' && params.top !== 'between') errs.push('Invalid top joint');
    if (!['none', 'applied', 'inset'].includes(params.back as string)) errs.push('Invalid back');
    const seen = new Set<string>();
    validateSpace(params.interior, errs, seen);
    validateSpace(params.wingInterior, errs, seen);
  } else errs.push('Unknown product kind');
  return errs;
}

function validateFrame(
  f: Record<string, unknown>,
  errs: string[],
  ints: (keys: string[], obj: Record<string, unknown>) => void,
  matRef: (k: string, obj: Record<string, unknown>) => void,
) {
  if (!['table', 'bench', 'stool', 'chair', 'bed'].includes(f.kind as string))
    errs.push('Invalid frame kind');
  ints(['width', 'depth', 'height', 'legInset', 'stretcherHeight'], f);
  matRef('panelMaterialId', f);
  matRef('solidMaterialId', f);
  if (f.top !== 'panel' && f.top !== 'slats') errs.push('Invalid frame top');
  if (!['none', 'box', 'h'].includes(f.stretchers as string)) errs.push('Invalid stretchers');
  const obj = (k: string, keys: string[], min = 0) => {
    const o = f[k];
    if (!isObj(o)) {
      errs.push(`Invalid ${k}`);
      return;
    }
    for (const key of keys)
      if (!isInt(o[key], min) || (o[key] as number) > MAX_MM)
        errs.push(`${k}.${key} must be a whole number of mm`);
  };
  obj('leg', ['w', 'd'], 1);
  obj('apron', ['height', 'thickness']);
  obj('slats', ['width', 'thickness', 'gap']);
  if (isObj(f.slats) && (!isInt(f.slats.width, 1) || !isInt(f.slats.thickness, 1)))
    errs.push('Slats need a size');
  if (f.shelf != null && !(isObj(f.shelf) && isInt(f.shelf.height, 1)))
    errs.push('Invalid lower shelf');
  if (f.back != null) {
    const b = f.back;
    if (
      !isObj(b) ||
      !isInt(b.seatHeight, 1) ||
      !isInt(b.railHeight, 1) ||
      !isInt(b.count, 1) ||
      (b.count as number) > 20 ||
      (b.style !== 'slats' && b.style !== 'panel')
    )
      errs.push('Invalid back');
    else if (b.angleDeg !== undefined && (!isInt(b.angleDeg) || (b.angleDeg as number) > 60))
      errs.push('Back rake must be a whole number of degrees from 0 to 60');
  }
  // ADR-040: positions are seat-to-back angles in whole degrees, 91–179 (180 = flat); `at` picks the one shown.
  const positions = (o: Record<string, unknown>) =>
    Array.isArray(o.positions) &&
    o.positions.length >= 1 &&
    o.positions.length <= 6 &&
    o.positions.every((v) => isInt(v) && (v as number) > 90 && (v as number) < 180) &&
    isInt(o.at) &&
    (o.at as number) < o.positions.length;
  if (f.recline != null) {
    const r = f.recline;
    if (!isObj(r) || !positions(r)) errs.push('Invalid recline positions');
    else if (
      r.footrest != null &&
      !(
        isObj(r.footrest) &&
        isInt(r.footrest.length, 50) &&
        (r.footrest.length as number) <= 1500 &&
        Array.isArray(r.footrest.angles) &&
        r.footrest.angles.length === (r.positions as unknown[]).length &&
        r.footrest.angles.every((v) => isInt(v) && (v as number) <= 90)
      )
    )
      errs.push('Invalid footrest');
    if (f.back == null) errs.push('A reclining frame needs a back');
  }
  if (f.backrest != null) {
    const r = f.backrest;
    if (!isObj(r) || !positions(r) || !isInt(r.length, 100) || (r.length as number) > MAX_MM)
      errs.push('Invalid backrest');
    if (f.top !== 'slats') errs.push('A lifting backrest needs a slatted seat');
  }
  if (
    f.arms != null &&
    !(isObj(f.arms) && isInt(f.arms.height, 1) && (f.arms.height as number) <= MAX_MM)
  )
    errs.push('Invalid arms');
  if (f.base !== undefined && f.base !== 'legs' && f.base !== 'bought') errs.push('Invalid base');
  if (f.kind === 'bed') {
    const b = f.bed;
    if (
      !isObj(b) ||
      !isObj(b.mattress) ||
      !isInt(b.mattress.w, 1) ||
      !isInt(b.mattress.l, 1) ||
      ![
        'clearance',
        'deckHeight',
        'railHeight',
        'headboardHeight',
        'footboardHeight',
        'sidePanelHeight',
        'tierGap',
        'guardHeight',
      ].every((k) => isInt(b[k]) && (b[k] as number) <= MAX_MM)
    )
      errs.push('Invalid bed settings');
  }
}
