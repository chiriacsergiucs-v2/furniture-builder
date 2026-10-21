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
  const y = d.product.kind === 'cabinet' && d.product.params.mount === 'wall' ? d.product.params.mountHeight ?? 1450 : 0
  return { id: newId(), design: structuredClone(d), quantity: 1, position: { x: right, y, z: 0 }, rotationY: 0, ...(libraryId ? { libraryId } : {}) }
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
  materials: Material[]
  diagnostics: Diagnostic[]
}

export function buildProjectModel(project: Project): ProjectModel {
  const pieces = project.items.map(placeItem)
  const materials = new Map<string, Material>()
  const panels: Panel[] = []
  const hardware: HardwareItem[] = []
  const diagnostics: Diagnostic[] = []
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
    for (const p of pc.panels) { const m = mats.get(p.materialId); panels.push({ ...p, materialId: m ? materialKey(m) : p.materialId }) }
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
  return { pieces, model, materials: [...materials.values()], diagnostics }
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
    const de = validateDesign(it.design)
    if (de.length) errs.push(`Item ${String(it.id)}: ${de[0]}`)
  }
  return errs
}
