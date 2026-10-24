/**
 * Templates edited on this device (ADR-034). Shipped families are read-only; an edit is stored as a local template
 * that shadows the shipped one (`shadows`), or a new family made from a saved design. Variant designs are stored as
 * data, so a local template is self-contained and survives app updates; nothing is replaced without the user's say.
 */
import { newId, validateDesign } from '../design'
import type { Design } from '../types'
import { BUILT_CAPABILITIES, FUNCTIONS, ROOMS, type CatalogFamily, type CatalogVariant, type Capability } from './types'

export interface LocalVariant extends Omit<CatalogVariant, 'create'> { design?: Design }
export interface LocalFamily extends Omit<CatalogFamily, 'variants'> { variants: LocalVariant[] }
export interface LocalTemplate {
  id: string
  /** The shipped family id this one replaces on this device. */
  shadows?: string
  /** Shipped `catalogVersion` this copy was taken from, to tell the user when the shipped template changed. */
  basedOn?: number
  revision: number
  updatedAt: string
  family: LocalFamily
}

/** A family as shown: shipped or local, with how it relates to the shipped catalog. */
export interface ViewFamily extends CatalogFamily {
  localId?: string
  /** The local template shadows a shipped family that has since been updated. */
  shippedUpdated?: boolean
  /** Local family with no shipped counterpart. */
  own?: boolean
}

export function toLocal(f: CatalogFamily): LocalFamily {
  const { variants, ...rest } = f
  return { ...structuredClone(rest), variants: variants.map(({ create, ...v }) => ({ ...structuredClone(v), ...(create ? { design: create() } : {}) })) }
}

export function fromLocal(t: LocalTemplate, shipped?: CatalogFamily): ViewFamily {
  const { variants, ...rest } = t.family
  return {
    ...rest, localId: t.id, own: !t.shadows,
    shippedUpdated: !!shipped && t.basedOn !== undefined && shipped.catalogVersion > t.basedOn,
    variants: variants.map(({ design, ...v }) => ({ ...v, ...(design ? { create: () => structuredClone(design) } : {}) })),
  }
}

/**
 * Shipped families with the local ones mixed in (ADR-034, user decision 2026-10-23): an edited family takes the
 * shipped one's place, the user's own new families follow, so grouping by room or type places them like any other.
 */
export function mergeCatalog(shipped: CatalogFamily[], locals: LocalTemplate[]): ViewFamily[] {
  const byShipped = new Map(locals.filter(t => t.shadows).map(t => [t.shadows!, t]))
  const own = locals.filter(t => !t.shadows).map(t => fromLocal(t))
  return [...shipped.map(f => { const t = byShipped.get(f.id); return t ? fromLocal(t, f) : f }), ...own]
}

/** Start editing a shipped family: a local copy that shadows it. */
export const shadowOf = (f: CatalogFamily, now = new Date().toISOString()): LocalTemplate =>
  ({ id: newId(), shadows: f.id, basedOn: f.catalogVersion, revision: 1, updatedAt: now, family: toLocal(f) })

/** "Save as template": a new family from a saved design. */
export function templateFromDesign(d: Design, meta: Pick<CatalogFamily, 'name' | 'function' | 'rooms'>, now = new Date().toISOString()): LocalTemplate {
  const root = d.product.kind
  return {
    id: newId(), revision: 1, updatedAt: now,
    family: {
      id: `own-${newId()}`, name: meta.name, nameRo: meta.name, aliases: [], function: meta.function, rooms: meta.rooms, root, support: 'ready',
      structure: 'Saved from one of your designs.', configurations: ['Edit it like any design'], dims: { min: [1, 1, 1], max: [100_000, 100_000, 100_000] }, catalogVersion: 1,
      variants: [{ id: `own-${newId()}`, name: d.name, summary: 'Your design', kind: 'interior', requires: [], design: structuredClone({ ...d, catalog: undefined }) }],
    },
  }
}

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v)
const isStr = (v: unknown, max = 500) => typeof v === 'string' && v.length > 0 && v.length <= max
const CAPS = new Set<string>([...BUILT_CAPABILITIES, 'shape', 'front:fixed', 'front:lid', 'frame:arms', 'frame:modules', 'frame:under-storage', 'safety:user-confirmed'] satisfies Capability[])

/** Validate an untrusted local template (storage, file import). Never throws. */
export function validateLocalTemplate(t: unknown): string[] {
  if (!isObj(t)) return ['Template must be an object']
  const errs: string[] = []
  if (!isStr(t.id) || !Number.isSafeInteger(t.revision) || !isStr(t.updatedAt)) errs.push('Missing template id, revision or date')
  if (t.shadows !== undefined && !isStr(t.shadows)) errs.push('Invalid shadowed family')
  const f = t.family
  if (!isObj(f)) return [...errs, 'Missing family']
  if (!isStr(f.id) || !isStr(f.name, 200)) errs.push('Family needs an id and a name')
  if (!FUNCTIONS.includes(f.function as never)) errs.push('Unknown function group')
  if (!Array.isArray(f.rooms) || !f.rooms.length || !f.rooms.every(r => ROOMS.includes(r as never))) errs.push('Rooms must be known room names')
  if (!Array.isArray(f.aliases) || !f.aliases.every(a => isStr(a, 100))) errs.push('Invalid aliases')
  if (!Array.isArray(f.configurations) || !f.configurations.every(c => isStr(c, 300))) errs.push('Invalid configurations')
  if (typeof f.structure !== 'string' || f.structure.length > 1000) errs.push('Invalid structure text')
  if (!Array.isArray(f.variants) || f.variants.length < 1 || f.variants.length > 5) return [...errs, 'A template has 1 to 5 variants']
  const ids = new Set<string>()
  for (const v of f.variants) {
    if (!isObj(v) || !isStr(v.id) || !isStr(v.name, 200) || typeof v.summary !== 'string' || (v.kind !== 'interior' && v.kind !== 'construction') ||
      !Array.isArray(v.requires) || !v.requires.every(c => CAPS.has(c as string))) { errs.push('Invalid variant'); continue }
    if (ids.has(v.id as string)) errs.push(`Duplicate variant ${String(v.id)}`)
    ids.add(v.id as string)
    if (v.design !== undefined) { const de = validateDesign(v.design); if (de.length) errs.push(`Variant ${String(v.name)}: ${de[0]}`) }
  }
  return errs
}
