/**
 * Projects (ADR-0022): several pieces placed in a room, cut and bought together.
 * Each item embeds its own copy of a design (library edits never flow in by themselves); positions are whole
 * millimetres and rotations quarter turns about the vertical axis, so every panel stays an axis-aligned box.
 */
import { buildModel } from './build'
import { cutlist, hardwareSummary, type CutRow } from './cutlist'
import { DEFAULT_KERF, newId, sheetOf, upgradeDesign, validateDesign } from './design'
import { overlaps, union } from './geometry'
import type { SheetSettings } from './nesting'
import { jobsFromCutlist } from './nesting'
import type { NestJob } from './nesting/types'
import type { Box, Design, Diagnostic, Face, FurnitureModel, HardwareItem, Material, Mm, Panel } from './types'

export type QuarterTurn = 0 | 90 | 180 | 270

/**
 * How a piece is placed (ADR-0031). The stored `position` is kept in step with it by `resolvePlacements`:
 *  - floor: stands on the floor (height 0), moved freely along the walls;
 *  - wall: hung on the wall, its underside `height` mm above the floor;
 *  - above: sits on another piece (gap 0) or hangs `gap` mm above it, back faces aligned, `offsetX` mm from its
 *    left edge; it follows that piece when it moves.
 * Absent = free: `position` is used as stored (projects saved before placement existed).
 */
export type Placement =
  | { kind: 'floor' }
  | { kind: 'wall'; height: Mm }
  | { kind: 'above'; baseId: string; gap: Mm; offsetX: Mm }

export interface ProjectItem {
  id: string
  /** Embedded copy; edited inside the project only. */
  design: Design
  /** Identical copies of this piece (cut and bought; one is placed). */
  quantity: number
  /** Where the rotated piece's lowest corner (min x, y, z) sits in the room. */
  position: { x: Mm; y: Mm; z: Mm }
  /** Quarter turn about the vertical axis; 90 turns the piece's front to face +x. */
  rotationY: QuarterTurn
  /** The saved design this copy came from, for "Update from library". */
  libraryId?: string
  placement?: Placement
}

export interface Project {
  schemaVersion: 1
  id: string
  name: string
  createdAt: string
  updatedAt: string
  items: ProjectItem[]
  cutting?: { kerf: Mm }
}

export function newProject(name = 'New project'): Project {
  const now = new Date().toISOString()
  return { schemaVersion: 1, id: newId(), name, createdAt: now, updatedAt: now, items: [], cutting: { kerf: DEFAULT_KERF } }
}

/** A copy of a design as a new project item, placed to the right of what is already there. */
export function makeItem(project: Project, design: Design, libraryId?: string): ProjectItem {
  const right = project.items.length ? Math.max(...project.items.map(i => placedBounds(i).x + placedBounds(i).w)) : 0
  const d = upgradeDesign(design)
  const wall = isWallHung(d)
  const y = wall ? (d.product.kind === 'cabinet' ? d.product.params.mountHeight ?? 1450 : 1450) : 0
  const placement: Placement = wall ? { kind: 'wall', height: y } : { kind: 'floor' }
  return { id: newId(), design: structuredClone(d), quantity: 1, position: { x: right, y, z: 0 }, rotationY: 0, placement, ...(libraryId ? { libraryId } : {}) }
}

/** The piece is built to hang on the wall (brackets and rail scheduled). */
export const isWallHung = (d: Design) => d.product.kind === 'cabinet' && d.product.params.mount === 'wall'

// ---------------------------------------------------------------------------
// Placement: floor, wall, on or above another piece (ADR-0031)
// ---------------------------------------------------------------------------

/** Pieces an item may sit on or hang above: not itself and nothing that (directly or not) sits on it. */
export function placementBases(project: Project, id: string): ProjectItem[] {
  const byId = new Map(project.items.map(i => [i.id, i]))
  const restsOn = (it: ProjectItem): boolean => {
    for (let cur: ProjectItem | undefined = it, n = 0; cur && n <= project.items.length; n++) {
      if (cur.id === id) return true
      cur = cur.placement?.kind === 'above' ? byId.get(cur.placement.baseId) : undefined
    }
    return false
  }
  return project.items.filter(i => i.id !== id && !restsOn(i))
}

/**
 * Bring every stored position in line with its placement. Bases are placed before the pieces on them; a piece whose
 * base is missing or that rests on itself through a chain keeps its stored position (reported by `placementIssues`).
 * Returns the same project when nothing moves.
 */
export function resolvePlacements(project: Project): Project {
  const byId = new Map(project.items.map(i => [i.id, i]))
  const out = new Map<string, ProjectItem>()
  const busy = new Set<string>()
  const resolve = (it: ProjectItem): ProjectItem => {
    const done = out.get(it.id)
    if (done) return done
    if (busy.has(it.id)) return it
    busy.add(it.id)
    const pl = it.placement
    let position = it.position
    if (pl?.kind === 'floor') position = { ...position, y: 0 }
    else if (pl?.kind === 'wall') position = { ...position, y: pl.height }
    else if (pl?.kind === 'above') {
      const base = byId.get(pl.baseId)
      if (base && !busy.has(base.id)) {
        const b = placedBounds(resolve(base))
        position = { x: b.x + pl.offsetX, y: b.y + b.h + pl.gap, z: b.z }
      }
    }
    busy.delete(it.id)
    const next = position.x === it.position.x && position.y === it.position.y && position.z === it.position.z ? it : { ...it, position }
    out.set(it.id, next)
    return next
  }
  const items = project.items.map(resolve)
  return items.every((it, i) => it === project.items[i]) ? project : { ...project, items }
}

/** Remove a piece; pieces that sat on it stay where they are (their placement becomes free). */
export function removeProjectItem(project: Project, id: string): Project {
  const items = project.items.filter(i => i.id !== id).map(i => {
    if (i.placement?.kind !== 'above' || i.placement.baseId !== id) return i
    const { placement: _gone, ...rest } = i
    void _gone
    return rest
  })
  return { ...project, items }
}

/** Placement problems: a missing base, a piece resting on itself, a piece in the air that is not built to hang. */
export function placementIssues(project: Project): Diagnostic[] {
  const out: Diagnostic[] = []
  const byId = new Map(project.items.map(i => [i.id, i]))
  for (const it of project.items) {
    const pl = it.placement
    const name = it.design.name
    if (pl?.kind === 'above') {
      const base = byId.get(pl.baseId)
      if (!base) out.push({ severity: 'warning', code: 'placement-base-missing', message: `${name} was placed on a piece that is no longer in the project; it stays where it is.`, nodeId: it.id })
      else if (!placementBases(project, it.id).some(b => b.id === base.id)) out.push({ severity: 'error', code: 'placement-cycle', message: `${name} and ${base.design.name} are placed on each other.`, nodeId: it.id })
    }
    const hangs = pl?.kind === 'wall' ? pl.height > 0 : pl?.kind === 'above' ? pl.gap > 0 : false
    if (hangs && !isWallHung(it.design)) out.push({ severity: 'warning', code: 'placement-not-hung', message: `${name} is off the floor with nothing under it; set it to hang on wall brackets (Whole cabinet → Stands on).`, nodeId: it.id })
    if (pl?.kind === 'floor' && isWallHung(it.design)) out.push({ severity: 'warning', code: 'placement-wall-on-floor', message: `${name} is built to hang on the wall but is placed on the floor.`, nodeId: it.id })
  }
  return out
}

// ---------------------------------------------------------------------------
// Quarter-turn placement
// ---------------------------------------------------------------------------

const ROT_FACE: Record<QuarterTurn, Record<Face, Face>> = {
  0: { '+x': '+x', '-x': '-x', '+y': '+y', '-y': '-y', '+z': '+z', '-z': '-z' },
  90: { '+z': '+x', '-z': '-x', '+x': '-z', '-x': '+z', '+y': '+y', '-y': '-y' },
  180: { '+x': '-x', '-x': '+x', '+z': '-z', '-z': '+z', '+y': '+y', '-y': '-y' },
  270: { '+z': '-x', '-z': '+x', '+x': '+z', '-x': '-z', '+y': '+y', '-y': '-y' },
}

/** Rotate a box about the origin (no translation): exact in integers. */
export function rotateBox(b: Box, r: QuarterTurn): Box {
  switch (r) {
    case 0: return b
    case 90: return { x: b.z, y: b.y, z: -(b.x + b.w), w: b.d, h: b.h, d: b.w }
    case 180: return { x: -(b.x + b.w), y: b.y, z: -(b.z + b.d), w: b.w, h: b.h, d: b.d }
    case 270: return { x: -(b.z + b.d), y: b.y, z: b.x, w: b.d, h: b.h, d: b.w }
  }
}

const swap = (a: Panel['thicknessAxis'], r: QuarterTurn) => (r % 180 === 0 ? a : a === 'x' ? 'z' : a === 'z' ? 'x' : 'y')

export interface PlacedPiece { item: ProjectItem; model: FurnitureModel; panels: Panel[]; bounds: Box }

/** Build one item and move its panels into the room. Panel and node ids are prefixed with the item id. */
export function placeItem(item: ProjectItem): PlacedPiece {
  const model = buildModel(item.design)
  const r = item.rotationY
  const rotated = model.panels.map(p => rotateBox(p.box, r))
  const rb = union(rotated)
  const dx = item.position.x - rb.x, dy = item.position.y - rb.y, dz = item.position.z - rb.z
  const panels = model.panels.map((p, i): Panel => ({
    ...p,
    id: `${item.id}:${p.id}`,
    nodeId: `${item.id}:${p.nodeId}`,
    box: { ...rotated[i], x: rotated[i].x + dx, y: rotated[i].y + dy, z: rotated[i].z + dz },
    thicknessAxis: swap(p.thicknessAxis, r),
    grainAxis: swap(p.grainAxis, r),
    banded: p.banded.map(f => ROT_FACE[r][f]),
    ...(p.pinRows ? { pinRows: p.pinRows.map(x => ({ ...x, face: ROT_FACE[r][x.face] })) } : {}),
  }))
  return { item, model, panels, bounds: union(panels.map(p => p.box)) }
}

export const placedBounds = (item: ProjectItem): Box => placeItem(item).bounds

// ---------------------------------------------------------------------------
// The whole room
// ---------------------------------------------------------------------------

/** Materials of all pieces merged by name + thickness + grain (grained and plain boards never share a sheet). */
export const materialKey = (m: Pick<Material, 'name' | 'thickness' | 'grain'>) => `mat:${m.name}|${m.thickness}|${m.grain ? 'grain' : 'plain'}`

export interface ProjectModel {
  pieces: PlacedPiece[]
  /** All panels in room coordinates, material ids replaced by merged material keys. */
  model: FurnitureModel
  /** The same panels grouped by piece, in item order (the exploded view spreads each piece on its own). */
  piecePanels: Panel[][]
  materials: Material[]
  diagnostics: Diagnostic[]
}

export function buildProjectModel(input: Project): ProjectModel {
  const project = resolvePlacements(input)
  const pieces = project.items.map(placeItem)
  const materials = new Map<string, Material>()
  const panels: Panel[] = []
  const piecePanels: Panel[][] = []
  const hardware: HardwareItem[] = []
  const diagnostics: Diagnostic[] = placementIssues(project)
  for (const pc of pieces) {
    const mats = new Map(pc.item.design.materials.map(m => [m.id, m]))
    for (const m of pc.item.design.materials) {
      const k = materialKey(m), seen = materials.get(k)
      if (!seen) { materials.set(k, { ...m, id: k, sheet: sheetOf(m) }); continue }
      const a = seen.sheet!, b = sheetOf(m)
      if (a.length !== b.length || a.width !== b.width || a.trim !== b.trim || a.count !== b.count) {
        diagnostics.push({ severity: 'warning', code: 'material-sheet-conflict', message: `${m.name} has different sheet settings in ${pc.item.design.name}; the first piece's sheet (${a.length} × ${a.width}) is used for the whole project.`, nodeId: pc.item.id })
      }
    }
    const own = pc.panels.map(p => { const m = mats.get(p.materialId); return { ...p, materialId: m ? materialKey(m) : p.materialId } })
    piecePanels.push(own)
    panels.push(...own)
    for (const h of pc.model.hardware) hardware.push({ ...h, nodeId: `${pc.item.id}:${h.nodeId}`, quantity: h.quantity * pc.item.quantity })
    const errs = pc.model.diagnostics.filter(d => d.severity === 'error').length
    if (errs) diagnostics.push({ severity: 'error', code: 'piece-errors', message: `${pc.item.design.name} has ${errs} ${errs === 1 ? 'problem' : 'problems'}; open it to fix.`, nodeId: pc.item.id })
  }
  // Pieces may touch but not occupy the same space (bounding boxes first, then panels).
  for (let a = 0; a < pieces.length; a++) for (let b = a + 1; b < pieces.length; b++) {
    if (!overlaps(pieces[a].bounds, pieces[b].bounds)) continue
    const hit = pieces[a].panels.find(p => pieces[b].panels.some(q => overlaps(p.box, q.box)))
    if (hit) diagnostics.push({ severity: 'error', code: 'pieces-overlap', message: `${pieces[a].item.design.name} and ${pieces[b].item.design.name} overlap in the room.`, nodeId: pieces[b].item.id })
  }
  for (const pc of pieces) if (pc.bounds.y < 0) diagnostics.push({ severity: 'error', code: 'below-floor', message: `${pc.item.design.name} goes below the floor.`, nodeId: pc.item.id })
  const model: FurnitureModel = { panels, spaces: [], hardware, diagnostics, bounds: union(panels.map(p => p.box)) }
  return { pieces, model, piecePanels, materials: [...materials.values()], diagnostics }
}

// ---------------------------------------------------------------------------
// Gaps between pieces in a run
// ---------------------------------------------------------------------------

/** Open-interval overlap: pieces that only touch are not in each other's way. */
const spans = (a0: Mm, a1: Mm, b0: Mm, b1: Mm) => Math.min(a1, b1) > Math.max(a0, b0)

/** Pieces at the same height and depth as `b`: a run along the wall (wall cabinets form their own run). */
const sameRun = (a: Box, b: Box) => spans(a.y, a.y + a.h, b.y, b.y + b.h) && spans(a.z, a.z + a.d, b.z, b.z + b.d)

/** The nearest piece on the left of `id` in the same run, and the free space between them (null if none). */
export function leftNeighbour(project: Project, id: string): { item: ProjectItem; gap: Mm } | null {
  const pieces = project.items.map(placeItem)
  const me = pieces.find(p => p.item.id === id)
  if (!me) return null
  let best: PlacedPiece | null = null
  for (const pc of pieces) {
    if (pc === me || !sameRun(pc.bounds, me.bounds)) continue
    const right = pc.bounds.x + pc.bounds.w
    if (right > me.bounds.x) continue
    if (!best || right > best.bounds.x + best.bounds.w) best = pc
  }
  return best ? { item: best.item, gap: me.bounds.x - (best.bounds.x + best.bounds.w) } : null
}

/**
 * Leave `gap` mm between piece `id` and its left neighbour by moving it along the wall. With `moveRight`, the pieces
 * on its right in the same run move by the same amount, so the rest of the run keeps its spacing.
 */
export function setGapLeft(project: Project, id: string, gap: Mm, moveRight = true): Project {
  const nb = leftNeighbour(project, id)
  const me = project.items.find(i => i.id === id)
  if (!nb || !me || !Number.isSafeInteger(gap) || gap < 0) return project
  const dx = gap - nb.gap
  if (!dx) return project
  const mine = placedBounds(me)
  const moves = (it: ProjectItem) => {
    if (it.id === id) return true
    if (it.placement?.kind === 'above') return false
    if (!moveRight) return false
    const b = placedBounds(it)
    return b.x >= mine.x + mine.w && sameRun(b, mine)
  }
  return resolvePlacements({ ...project, items: project.items.map(it => (moves(it) ? { ...it, position: { ...it.position, x: it.position.x + dx } } : it)) })
}

/** Parts for the whole project: each piece's cut list × its quantity, merged across pieces. */
export function projectCutlist(project: Project): CutRow[] {
  const rows = new Map<string, CutRow>()
  for (const item of project.items) {
    const model = buildModel(item.design)
    for (const r of cutlist(model, item.design.materials)) {
      const mat = item.design.materials.find(m => m.id === r.materialId)!
      const id = materialKey(mat)
      const key = [id, r.length, r.width, r.edgesL, r.edgesW, r.drilling].join('|')
      const labels = r.labels.map(l => `${item.design.name}: ${l}`)
      const panelIds = r.panelIds.map(p => `${item.id}:${p}`)
      const cur = rows.get(key)
      if (cur) {
        cur.quantity += r.quantity * item.quantity
        cur.panelIds.push(...panelIds)
        for (const l of labels) if (!cur.labels.includes(l)) cur.labels.push(l)
      } else rows.set(key, { ...r, materialId: id, quantity: r.quantity * item.quantity, labels, panelIds })
    }
  }
  return [...rows.values()].sort((a, b) => a.materialName.localeCompare(b.materialName) || b.thickness - a.thickness || b.length - a.length || b.width - a.width)
}

export function projectHardware(project: Project): HardwareItem[] {
  return hardwareSummary({ panels: [], spaces: [], diagnostics: [], bounds: { x: 0, y: 0, z: 0, w: 0, h: 0, d: 0 },
    hardware: project.items.flatMap(i => buildModel(i.design).hardware.map(h => ({ ...h, quantity: h.quantity * i.quantity }))) })
}

export function projectNestingJobs(project: Project, rows = projectCutlist(project), materials = buildProjectModel(project).materials): NestJob[] {
  const kerf = project.cutting?.kerf ?? DEFAULT_KERF
  const settings = new Map<string, SheetSettings>()
  for (const m of materials) { const s = sheetOf(m); settings.set(m.id, { sheet: { length: s.length, width: s.width, count: s.count }, trim: s.trim, kerf }) }
  return jobsFromCutlist(rows, settings)
}

// ---------------------------------------------------------------------------
// Validation (storage, import)
// ---------------------------------------------------------------------------

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v)
const isInt = (v: unknown, min = -1e7) => typeof v === 'number' && Number.isSafeInteger(v) && v >= min && v <= 1e7

export function validateProject(p: unknown): string[] {
  if (!isObj(p)) return ['Project must be an object']
  const errs: string[] = []
  if (p.schemaVersion !== 1) errs.push('Unsupported project schemaVersion')
  if (typeof p.id !== 'string' || !p.id || typeof p.name !== 'string' || !p.name) errs.push('Missing project id or name')
  if (p.cutting !== undefined && !(isObj(p.cutting) && isInt(p.cutting.kerf, 0) && (p.cutting.kerf as number) <= 20)) errs.push('Invalid cutting settings')
  if (!Array.isArray(p.items)) return [...errs, 'Items missing']
  const ids = new Set<string>()
  for (const it of p.items) {
    if (!isObj(it) || typeof it.id !== 'string' || !it.id) { errs.push('Invalid item'); continue }
    if (ids.has(it.id)) errs.push(`Duplicate item ${it.id}`)
    ids.add(it.id)
    if (!isInt(it.quantity, 1) || (it.quantity as number) > 99) errs.push('Item quantity must be 1 to 99')
    if (!isObj(it.position) || !isInt(it.position.x) || !isInt(it.position.y, 0) || !isInt(it.position.z)) errs.push('Item position must be whole mm (height ≥ 0)')
    if (![0, 90, 180, 270].includes(it.rotationY as number)) errs.push('Item rotation must be a quarter turn')
    const pl = it.placement
    if (pl !== undefined && !(isObj(pl) && (pl.kind === 'floor' ||
      (pl.kind === 'wall' && isInt(pl.height, 0)) ||
      (pl.kind === 'above' && typeof pl.baseId === 'string' && !!pl.baseId && pl.baseId !== it.id && isInt(pl.gap, 0) && isInt(pl.offsetX))))) errs.push('Invalid item placement')
    const de = validateDesign(it.design)
    if (de.length) errs.push(`Item ${String(it.id)}: ${de[0]}`)
  }
  return errs
}
