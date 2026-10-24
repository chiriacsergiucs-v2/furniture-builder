/**
 * Project templates (ADR-0057): a project saved for reuse. Pieces are kept as copies (ADR-0032) with positions
 * relative to the leftmost-back piece (or to the room when the room is included); run parts are kept as a recipe
 * and suggested again when the template is used, so they always fit the pieces.
 */
import { newId, validateDesign } from './design'
import { planRuns, validateProject, type Placement, type Project, type QuarterTurn, type RunSettings } from './project'
import { validateRoom, type Room } from './room'
import type { Design, Mm } from './types'

export interface TemplateItem {
  /** Id inside the template, so placements can point at their base. */
  ref: string
  design: Design
  quantity: number
  rotationY: QuarterTurn
  offset: { x: Mm; y: Mm; z: Mm }
  placement?: Placement
}

export interface ProjectTemplate {
  kind: 'project-template'
  schemaVersion: 1
  id: string
  name: string
  description: string
  createdAt: string
  updatedAt: string
  items: TemplateItem[]
  /** Suggest run parts again with these settings when used (absent = the project had none). */
  runRecipe?: { settings: RunSettings }
  room?: Room
}

export function templateFromProject(p: Project, name: string, opts: { description?: string; includeRoom?: boolean } = {}): ProjectTemplate {
  const withRoom = !!opts.includeRoom && !!p.room
  const ox = withRoom || !p.items.length ? 0 : Math.min(...p.items.map(i => i.position.x))
  const oz = withRoom || !p.items.length ? 0 : Math.min(...p.items.map(i => i.position.z))
  const now = new Date().toISOString()
  return {
    kind: 'project-template', schemaVersion: 1, id: newId(), name, description: opts.description ?? '', createdAt: now, updatedAt: now,
    items: p.items.map(i => ({
      ref: i.id, design: structuredClone(i.design), quantity: i.quantity, rotationY: i.rotationY,
      offset: { x: i.position.x - ox, y: i.position.y, z: i.position.z - oz }, ...(i.placement ? { placement: structuredClone(i.placement) } : {}),
    })),
    ...(p.runParts?.length || p.runSettings ? { runRecipe: { settings: { scribe: p.runSettings?.scribe ?? 0, auto: p.runSettings?.auto ?? true } } } : {}),
    ...(withRoom ? { room: structuredClone(p.room!) } : {}),
  }
}

/** A new project from a template: fresh ids (placements follow), run parts suggested from the recipe. */
export function projectFromTemplate(t: ProjectTemplate, name = t.name): Project {
  const now = new Date().toISOString()
  const ids = new Map(t.items.map(i => [i.ref, newId()]))
  const items = t.items.map(i => {
    const pl = i.placement?.kind === 'above' ? { ...i.placement, baseId: ids.get(i.placement.baseId) ?? i.placement.baseId } : i.placement
    return { id: ids.get(i.ref)!, design: { ...structuredClone(i.design), id: newId() }, quantity: i.quantity, position: { ...i.offset }, rotationY: i.rotationY, ...(pl ? { placement: pl } : {}) }
  })
  const base: Project = { schemaVersion: 1, id: newId(), name, createdAt: now, updatedAt: now, items, cutting: { kerf: 4 }, ...(t.room ? { room: structuredClone(t.room) } : {}) }
  if (!t.runRecipe) return base
  const withSettings = { ...base, runSettings: { ...t.runRecipe.settings } }
  return { ...withSettings, runParts: planRuns(withSettings).parts }
}

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v)

export function validateProjectTemplate(t: unknown): string[] {
  if (!isObj(t)) return ['Template must be an object']
  const errs: string[] = []
  if (t.kind !== 'project-template' || t.schemaVersion !== 1) errs.push('Not a project template')
  if (typeof t.id !== 'string' || !t.id || typeof t.name !== 'string' || !t.name) errs.push('Missing template id or name')
  if (typeof t.description !== 'string') errs.push('Missing description')
  if (!Array.isArray(t.items)) return [...errs, 'Items missing']
  for (const it of t.items) {
    if (!isObj(it) || typeof it.ref !== 'string') { errs.push('Invalid template item'); continue }
    const de = validateDesign(it.design)
    if (de.length) errs.push(`Item ${it.ref}: ${de[0]}`)
  }
  if (t.room !== undefined) errs.push(...validateRoom(t.room))
  if (!errs.length) {
    // The project it makes must be valid too (positions, quarter turns, placements, run settings).
    const pe = validateProject(projectFromTemplate(t as unknown as ProjectTemplate))
    if (pe.length) errs.push(...pe)
  }
  return errs
}
