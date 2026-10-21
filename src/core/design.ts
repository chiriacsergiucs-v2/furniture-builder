import type {
  CabinetParams, DeskParams, Design, DrawerSettings, Material, Product, Space, SpaceKind, SplitSize,
} from './types'

export type PedestalSide = 'left' | 'right'

export const newId = (): string =>
  (globalThis.crypto?.randomUUID?.() ?? `${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`).slice(0, 8)

/** User's stock (2026-10-21): PAL and HDF 2800 × 2070, MDF 2440 × 1220, 10 mm trim per edge, 4 mm kerf. */
export const DEFAULT_KERF = 4
export const DEFAULT_TRIM = 10
export function defaultSheetFor(m: Pick<Material, 'id' | 'name'>): NonNullable<Material['sheet']> {
  const mdf = /mdf/i.test(m.id) || /mdf/i.test(m.name)
  return mdf ? { length: 2440, width: 1220, trim: DEFAULT_TRIM, count: null } : { length: 2800, width: 2070, trim: DEFAULT_TRIM, count: null }
}
export const sheetOf = (m: Material) => m.sheet ?? defaultSheetFor(m)
export const kerfOf = (d: Design) => d.cutting?.kerf ?? DEFAULT_KERF

/** Version-1 → 2 in memory: fill stock sheets and cutting settings. Returns the same object when already v2. */
export function upgradeDesign(d: Design): Design {
  if (d.schemaVersion === 2 && d.cutting && d.materials.every(m => m.sheet)) return d
  return { ...d, schemaVersion: 2, cutting: d.cutting ?? { kerf: DEFAULT_KERF }, materials: d.materials.map(m => (m.sheet ? m : { ...m, sheet: defaultSheetFor(m) })) }
}

const baseMaterials = (): Material[] => [
  { id: 'pal18', name: 'PAL 18 white', thickness: 18, grain: false, color: '#ecebe6' },
  { id: 'pal18oak', name: 'PAL 18 oak', thickness: 18, grain: true, color: '#c9a36b' },
  { id: 'pal16', name: 'PAL 16 white', thickness: 16, grain: false, color: '#f1f0ea' },
  { id: 'mdf18', name: 'MDF 18 painted', thickness: 18, grain: false, color: '#b9c4c9' },
  { id: 'hdf3', name: 'HDF 3', thickness: 3, grain: false, color: '#a89a86' },
]
export const defaultMaterials = (): Material[] => baseMaterials().map(m => ({ ...m, sheet: defaultSheetFor(m) }))

export const defaultDrawers = (): DrawerSettings => ({
  sideClearance: 13, verticalClearance: 30, rearClearance: 10,
  runnerLengths: [250, 300, 350, 400, 450, 500, 550, 600],
  boxMaterialId: 'pal16', bottomMaterialId: 'hdf3',
})

export function makeSpace(kind: SpaceKind, id = newId()): Space {
  switch (kind) {
    case 'empty': return { id, kind }
    case 'shelves': return { id, kind, count: 2 }
    case 'hanging': return { id, kind, railDrop: 60 }
    case 'drawers': return { id, kind, count: 3 }
    case 'split': return { id, kind, axis: 'x', sizes: [fr(), fr()], children: [makeSpace('shelves'), makeSpace('shelves')] }
  }
}
export const fr = (value = 1): SplitSize => ({ mode: 'fr', value })
export const mm = (value: number): SplitSize => ({ mode: 'mm', value })

export const cabinetDefaults = (interior: Space): CabinetParams => ({
  width: 800, height: 900, depth: 450,
  bodyMaterialId: 'pal18', frontMaterialId: 'mdf18', backMaterialId: 'hdf3',
  top: 'over', back: 'applied', backInset: 15, plinthHeight: 80, plinthSetback: 40,
  frontGap: 3, shelfSetback: 20, shelfClearance: 1, pinRowSetback: 37, drawers: defaultDrawers(), interior,
})

export const deskDefaults = (): DeskParams => ({
  width: 1400, depth: 700, height: 750, topMaterialId: 'pal18oak', bodyMaterialId: 'pal18',
  frontOverhang: 30, support: 'pedestal-left',
  pedestal: { width: 420, drawerCount: 3, left: { id: newId(), kind: 'drawers', count: 3 }, right: { id: newId(), kind: 'drawers', count: 3 } },
  modesty: { enabled: true, height: 350, setback: 120 }, drawers: defaultDrawers(),
  frontMaterialId: 'mdf18', frontGap: 3,
})

function wrap(name: string, product: Product): Design {
  const now = new Date().toISOString()
  return { schemaVersion: 2, id: newId(), name, createdAt: now, updatedAt: now, materials: defaultMaterials(), product, cutting: { kerf: DEFAULT_KERF } }
}
const cabinet = (name: string, over: Partial<CabinetParams>, interior: Space) =>
  wrap(name, { kind: 'cabinet', id: newId(), params: { ...cabinetDefaults(interior), ...over, interior } })

export interface Template { id: string; name: string; description: string; create: () => Design }

export const templates: Template[] = [
  { id: 'chest', name: 'Chest of drawers', description: '800 × 900 × 450, four drawers on a plinth',
    create: () => cabinet('Chest of drawers', {}, { id: newId(), kind: 'drawers', count: 4 }) },
  { id: 'bookcase', name: 'Bookcase', description: '800 × 1800 × 300, four shelves, white body',
    create: () => cabinet('Bookcase', { height: 1800, depth: 300, plinthHeight: 60, shelfSetback: 0 }, { id: newId(), kind: 'shelves', count: 4 }) },
  { id: 'base-door', name: 'Base cabinet', description: '600 × 720 × 560, one shelf behind a door',
    create: () => cabinet('Base cabinet', { width: 600, height: 720, depth: 560, plinthHeight: 100, plinthSetback: 50 },
      { id: newId(), kind: 'shelves', count: 1, front: { kind: 'doors', count: 1 } }) },
  { id: 'sideboard', name: 'Sideboard', description: '1600 × 800 × 450, doors either side of a drawer bank',
    create: () => cabinet('Sideboard', { width: 1600, height: 800, bodyMaterialId: 'pal18oak' }, {
      id: newId(), kind: 'split', axis: 'x', sizes: [fr(), mm(500), fr()], children: [
        { id: newId(), kind: 'shelves', count: 1, front: { kind: 'doors', count: 1 } },
        { id: newId(), kind: 'drawers', count: 3 },
        { id: newId(), kind: 'shelves', count: 1, front: { kind: 'doors', count: 1 } },
      ] }) },
  { id: 'wardrobe', name: 'Wardrobe', description: '1200 × 2100 × 600, hanging + shelves behind two doors',
    create: () => cabinet('Wardrobe', { width: 1200, height: 2100, depth: 600, plinthHeight: 80 }, {
      id: newId(), kind: 'split', axis: 'x', sizes: [fr(), fr()], front: { kind: 'doors', count: 2 }, children: [
        { id: newId(), kind: 'split', axis: 'y', sizes: [mm(300), fr()], children: [
          { id: newId(), kind: 'empty' }, { id: newId(), kind: 'hanging', railDrop: 50 }] },
        { id: newId(), kind: 'shelves', count: 5 },
      ] }) },
  { id: 'desk-pedestal', name: 'Desk with pedestal', description: '1400 × 700 × 750, three-drawer pedestal left',
    create: () => wrap('Desk with pedestal', { kind: 'desk', id: newId(), params: deskDefaults() }) },
  { id: 'desk-gables', name: 'Panel desk', description: '1200 × 600 × 750, two panel gables',
    create: () => wrap('Panel desk', { kind: 'desk', id: newId(), params: { ...deskDefaults(), width: 1200, depth: 600, support: 'gables' } }) },
]

// ---------------------------------------------------------------------------
// Space tree operations (pure, immutable)
// ---------------------------------------------------------------------------

export function findSpace(root: Space, id: string): Space | undefined {
  if (root.id === id) return root
  if (root.kind === 'split') for (const c of root.children) { const f = findSpace(c, id); if (f) return f }
  return undefined
}

export function parentOf(root: Space, id: string): Space | undefined {
  if (root.kind !== 'split') return undefined
  for (const c of root.children) {
    if (c.id === id) return root
    const f = parentOf(c, id); if (f) return f
  }
  return undefined
}

export function mapSpace(root: Space, id: string, fn: (s: Space) => Space): Space {
  if (root.id === id) return fn(root)
  if (root.kind === 'split') {
    let changed = false
    const children = root.children.map(c => { const n = mapSpace(c, id, fn); if (n !== c) changed = true; return n })
    return changed ? { ...root, children } : root
  }
  return root
}

/** Change what a space contains, keeping its id and doors. Drawers cannot keep doors' role as fronts. */
export function changeKind(s: Space, kind: SpaceKind): Space {
  if (s.kind === kind) return s
  const next = makeSpace(kind, s.id)
  return { ...next, front: s.front ?? null, ...(s.handle ? { handle: s.handle } : {}) }
}

/** Change a drawer count, keeping custom heights in step (new drawers share the rest). */
export function setDrawerCount(s: Space, count: number): Space {
  if (s.kind !== 'drawers') return s
  const heights = s.heights
    ? count > s.heights.length ? [...s.heights, ...Array.from({ length: count - s.heights.length }, () => fr())] : s.heights.slice(0, count)
    : undefined
  return { ...s, count, ...(heights ? { heights } : {}) }
}

export function splitSpace(s: Space, axis: 'x' | 'y', parts: number): Space {
  const n = Math.max(2, Math.min(8, Math.round(parts)))
  const first: Space = { ...s, id: newId(), front: null }
  const children: Space[] = [first, ...Array.from({ length: n - 1 }, () => makeSpace('shelves'))]
  return { id: s.id, kind: 'split', axis, sizes: children.map(() => fr()), children, front: s.front ?? null }
}

/** Collapse a split back into a plain space (keeps id, doors). */
export const unsplit = (s: Space): Space => (s.kind === 'split' ? { id: s.id, kind: 'shelves', count: 2, front: s.front ?? null } : s)

// ---------------------------------------------------------------------------
// Editable space roots of any product (cabinet interior, desk drawer units)
// ---------------------------------------------------------------------------

export const usesPedestal = (p: DeskParams, side: PedestalSide) =>
  p.support === 'two-pedestals' || p.support === (side === 'left' ? 'pedestal-left' : 'pedestal-right')

/** The stored tree, or the legacy equal-drawers unit with a stable id. */
export const pedestalRoot = (p: DeskParams, side: PedestalSide, deskId: string): Space =>
  p.pedestal[side] ?? { id: `${deskId}:ped-${side}:drawers`, kind: 'drawers', count: p.pedestal.drawerCount }

export function productRoots(prod: Product): { root: Space; side?: PedestalSide }[] {
  if (prod.kind === 'cabinet') return [{ root: prod.params.interior }]
  return (['left', 'right'] as const).filter(s => usesPedestal(prod.params, s)).map(side => ({ root: pedestalRoot(prod.params, side, prod.id), side }))
}

export function findInProduct(prod: Product, id: string): { space: Space; root: Space; side?: PedestalSide } | undefined {
  for (const r of productRoots(prod)) { const space = findSpace(r.root, id); if (space) return { space, ...r } }
  return undefined
}

export function mapProductSpace(prod: Product, id: string, fn: (s: Space) => Space): Product {
  if (prod.kind === 'cabinet') {
    const interior = mapSpace(prod.params.interior, id, fn)
    return interior === prod.params.interior ? prod : { ...prod, params: { ...prod.params, interior } }
  }
  for (const { root, side } of productRoots(prod)) {
    const next = mapSpace(root, id, fn)
    if (next !== root) return { ...prod, params: { ...prod.params, pedestal: { ...prod.params.pedestal, [side!]: next } } }
  }
  return prod
}

export function setProductParams<P extends Product>(prod: P, patch: Partial<P['params']>): P {
  return { ...prod, params: { ...prod.params, ...patch } } as P
}

// ---------------------------------------------------------------------------
// Validation of an untrusted design (JSON import / storage)
// ---------------------------------------------------------------------------

export const MAX_SHELVES = 50
export const MAX_DRAWERS = 20

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v)
const isInt = (v: unknown, min = 0) => typeof v === 'number' && Number.isSafeInteger(v) && v >= min
const isStr = (v: unknown) => typeof v === 'string' && v.length > 0 && v.length < 500

const validSize = (z: unknown) => isObj(z) && ((z.mode === 'mm' && isInt(z.value, 1)) || (z.mode === 'fr' && typeof z.value === 'number' && z.value > 0 && z.value < 1000))

function validateSpace(s: unknown, errs: string[], seen: Set<string>, depth = 0) {
  if (depth > 12) { errs.push('Space tree is too deep'); return }
  if (!isObj(s) || !isStr(s.id)) { errs.push('Invalid space'); return }
  if (seen.has(s.id as string)) errs.push(`Duplicate space id ${String(s.id)}`)
  seen.add(s.id as string)
  if (s.front != null && !(isObj(s.front) && s.front.kind === 'doors' && (s.front.count === 1 || s.front.count === 2) && (s.front.hinge === undefined || s.front.hinge === 'left' || s.front.hinge === 'right'))) errs.push('Invalid doors')
  if (s.handle != null && !(isObj(s.handle) && ['bar', 'knob', 'push'].includes(s.handle.kind as string) &&
    (s.handle.holeSpacing === undefined || isInt(s.handle.holeSpacing, 16)) &&
    (s.handle.position === undefined || ['top', 'centre', 'bottom'].includes(s.handle.position as string)))) errs.push('Invalid handle')
  switch (s.kind) {
    case 'empty': return
    case 'shelves':
      if (!isInt(s.count) || (s.count as number) > MAX_SHELVES) errs.push('Invalid shelf count')
      if (s.adjustable !== undefined && typeof s.adjustable !== 'boolean') errs.push('Invalid adjustable flag')
      return
    case 'drawers':
      if (!isInt(s.count, 1) || (s.count as number) > MAX_DRAWERS) errs.push('Invalid drawer count')
      if (s.heights !== undefined) {
        if (!Array.isArray(s.heights) || s.heights.length !== s.count) errs.push('Drawer heights must list one size per drawer')
        else for (const z of s.heights) if (!validSize(z)) errs.push('Invalid drawer height')
      }
      return
    case 'hanging': if (!isInt(s.railDrop)) errs.push('Invalid rail drop'); return
    case 'split':
      if ((s.axis !== 'x' && s.axis !== 'y') || !Array.isArray(s.children) || !Array.isArray(s.sizes) || s.children.length !== s.sizes.length || s.children.length < 2) { errs.push('Invalid split'); return }
      for (const z of s.sizes) if (!validSize(z)) errs.push('Invalid split size')
      for (const c of s.children) validateSpace(c, errs, seen, depth + 1)
      return
    default: errs.push(`Unknown space kind ${String(s.kind)}`)
  }
}

export function validateDesign(d: unknown): string[] {
  const errs: string[] = []
  if (!isObj(d)) return ['Design must be an object']
  if (d.schemaVersion !== 1 && d.schemaVersion !== 2) errs.push('Unsupported schemaVersion')
  if (d.cutting !== undefined && !(isObj(d.cutting) && isInt(d.cutting.kerf) && (d.cutting.kerf as number) <= 20)) errs.push('Invalid cutting settings')
  if (!isStr(d.id) || !isStr(d.name)) errs.push('Missing id or name')
  if (!Array.isArray(d.materials) || !d.materials.length) return [...errs, 'Materials missing']
  const mids = new Set<string>()
  for (const m of d.materials) {
    if (!isObj(m) || !isStr(m.id) || !isStr(m.name) || !isInt(m.thickness, 1) || typeof m.grain !== 'boolean' || typeof m.color !== 'string') errs.push('Invalid material')
    else if (m.sheet !== undefined && !(isObj(m.sheet) && isInt(m.sheet.length, 100) && isInt(m.sheet.width, 100) && isInt(m.sheet.trim) &&
      2 * (m.sheet.trim as number) < Math.min(m.sheet.length as number, m.sheet.width as number) && (m.sheet.count === null || isInt(m.sheet.count)))) errs.push(`Invalid sheet for ${String(m.name)}`)
    else if (mids.has(m.id as string)) errs.push(`Duplicate material ${String(m.id)}`)
    else mids.add(m.id as string)
  }
  const p = d.product
  if (!isObj(p) || !isStr(p.id) || !isObj(p.params)) return [...errs, 'Invalid product']
  const params = p.params
  const ints = (keys: string[], obj: Record<string, unknown>) => keys.forEach(k => { if (!isInt(obj[k])) errs.push(`${k} must be a whole number of mm`) })
  const matRef = (k: string, obj: Record<string, unknown>) => { if (!mids.has(obj[k] as string)) errs.push(`${k} refers to an unknown material`) }
  const dr = params.drawers
  if (!isObj(dr) || !Array.isArray(dr.runnerLengths) || !dr.runnerLengths.every(v => isInt(v, 1))) errs.push('Invalid drawer settings')
  else { ints(['sideClearance', 'verticalClearance', 'rearClearance'], dr); matRef('boxMaterialId', dr); matRef('bottomMaterialId', dr) }
  if (p.kind === 'cabinet') {
    ints(['width', 'height', 'depth', 'backInset', 'plinthHeight', 'plinthSetback', 'frontGap', 'shelfSetback'], params)
    ;['bodyMaterialId', 'frontMaterialId', 'backMaterialId'].forEach(k => matRef(k, params))
    if (params.top !== 'over' && params.top !== 'between') errs.push('Invalid top joint')
    for (const k of ['shelfClearance', 'pinRowSetback']) if (params[k] !== undefined && !isInt(params[k])) errs.push(`${k} must be a whole number of mm`)
    if (params.frontStyle !== undefined && !['overlay', 'half', 'inset'].includes(params.frontStyle as string)) errs.push('Invalid front style')
    if (!['none', 'applied', 'inset'].includes(params.back as string)) errs.push('Invalid back')
    validateSpace(params.interior, errs, new Set())
  } else if (p.kind === 'desk') {
    ints(['width', 'depth', 'height', 'frontOverhang', 'frontGap'], params)
    ;['topMaterialId', 'bodyMaterialId', 'frontMaterialId'].forEach(k => matRef(k, params))
    if (!['gables', 'pedestal-left', 'pedestal-right', 'two-pedestals'].includes(params.support as string)) errs.push('Invalid support')
    if (!isObj(params.pedestal) || !isInt(params.pedestal.width, 1) || !isInt(params.pedestal.drawerCount, 1) || (params.pedestal.drawerCount as number) > MAX_DRAWERS) errs.push('Invalid pedestal')
    else {
      const seen = new Set<string>()
      for (const side of ['left', 'right'] as const) if (params.pedestal[side] !== undefined) validateSpace(params.pedestal[side], errs, seen)
    }
    if (!isObj(params.modesty) || typeof params.modesty.enabled !== 'boolean' || !isInt(params.modesty.height) || !isInt(params.modesty.setback)) errs.push('Invalid modesty panel')
  } else errs.push('Unknown product kind')
  return errs
}
