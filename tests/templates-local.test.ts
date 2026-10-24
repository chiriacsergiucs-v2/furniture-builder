import 'fake-indexeddb/auto'
import Dexie from 'dexie'
import { describe, expect, it } from 'vitest'
import { catalogFamilies, findFamily, insertVariant } from '../src/core/catalog'
import { mergeCatalog, shadowOf, templateFromDesign, validateLocalTemplate } from '../src/core/catalog/local'
import { applyLayout, layoutPresets } from '../src/core/catalog/presets'
import { buildModel } from '../src/core/build'
import { templates } from '../src/core/design'
import { deleteTemplate, listTemplates, saveTemplate } from '../src/persist/db'

describe('editable templates on this device (ADR-0034)', () => {
  it('upgrading an existing version-2 database keeps every design and project row', async () => {
    const name = 'fb-upgrade-test'
    const old = new Dexie(name)
    old.version(1).stores({ designs: 'id, updatedAt, name' })
    old.version(2).stores({ designs: 'id, updatedAt, name', projects: 'id, updatedAt, name' })
    const d = templates[0].create()
    await old.table('designs').put({ id: d.id, name: d.name, updatedAt: d.updatedAt, design: d })
    await old.table('projects').put({ id: 'p1', name: 'P', updatedAt: d.updatedAt, project: { broken: true } })
    old.close()
    const mod = await import('../src/persist/db')
    const Db = (mod.db.constructor as new (n: string) => typeof mod.db)
    const fresh = new Db(name)
    await fresh.open()
    expect(fresh.verno).toBe(7)
    expect(await fresh.designs.count()).toBe(1)
    expect(await fresh.projects.count()).toBe(1) // unreadable rows are kept
    expect(await fresh.templates.count()).toBe(0)
    expect(await fresh.images.count()).toBe(0)
    fresh.close()
  })
  it('an edited family is stored locally and wins over the shipped one; reset removes only that row', async () => {
    const shipped = findFamily('wardrobe')!
    const before = JSON.stringify(shipped.variants.map(v => v.id))
    const local = shadowOf(shipped)
    local.family.name = 'My wardrobe'
    local.family.variants = local.family.variants.slice(0, 2)
    await saveTemplate(local)
    const other = shadowOf(findFamily('chest')!)
    await saveTemplate(other)
    const merged = mergeCatalog(catalogFamilies, await listTemplates())
    expect(merged.filter(f => f.name === 'Wardrobe')).toHaveLength(0)
    expect(merged.find(f => f.name === 'My wardrobe')?.variants).toHaveLength(2)
    expect(merged.length).toBe(catalogFamilies.length)
    await deleteTemplate(local.id)
    const after = mergeCatalog(catalogFamilies, await listTemplates())
    expect(after.find(f => f.id === 'wardrobe')?.name).toBe('Wardrobe')
    expect(after.find(f => f.id === 'chest')?.localId).toBe(other.id)
    expect(JSON.stringify(shipped.variants.map(v => v.id))).toBe(before)
  })
  it('inserting from a local template (stored design data) still gives a new id each time', () => {
    const merged = mergeCatalog(catalogFamilies, [shadowOf(findFamily('dresser')!)])
    const f = merged.find(x => x.id === 'dresser')!
    const a = insertVariant(f, f.variants[0])!, b = insertVariant(f, f.variants[0])!
    expect(a.id).not.toBe(b.id)
    expect(a.id).not.toBe(f.variants[0].create!().id)
  })
  it("the user's own templates are mixed in after the shipped ones, not listed first", () => {
    const own = templateFromDesign(templates[0].create(), { name: 'Mine', function: 'storage', rooms: ['bedroom'] })
    const merged = mergeCatalog(catalogFamilies, [own])
    expect(merged[merged.length - 1].localId).toBe(own.id)
    expect(merged[0].id).toBe(catalogFamilies[0].id)
  })
  it('a corrupt template row is skipped and still present', async () => {
    const t = shadowOf(findFamily('bookcase')!)
    const { db } = await import('../src/persist/db')
    await db.templates.put({ id: 'bad', updatedAt: '2030-01-01', template: { ...t, id: 'bad', family: { ...t.family, variants: [] } } })
    expect((await listTemplates()).some(x => x.id === 'bad')).toBe(false)
    expect(await db.templates.get('bad')).toBeDefined()
  })
  it('a newer shipped catalog version is reported, never applied', () => {
    const shipped = findFamily('sideboard')!
    const t = { ...shadowOf(shipped), basedOn: 0 }
    const merged = mergeCatalog(catalogFamilies, [t])
    expect(merged.find(f => f.localId === t.id)?.shippedUpdated).toBe(true)
  })
  it('a saved design becomes a new family; invalid templates are reported, never thrown', () => {
    const t = templateFromDesign(templates[1].create(), { name: 'Hall shelf', function: 'storage', rooms: ['hallway'] })
    expect(validateLocalTemplate(t)).toEqual([])
    expect(validateLocalTemplate({ ...t, family: { ...t.family, rooms: ['moon'] } })).toContain('Rooms must be known room names')
    expect(validateLocalTemplate({ ...t, family: { ...t.family, variants: Array(6).fill(t.family.variants[0]) } })).toContain('A template has 1 to 5 variants')
    expect(validateLocalTemplate(null)).toEqual(['Template must be an object'])
  })
})

describe('layout presets (ADR-0033)', () => {
  it('applying a preset keeps the space id and the outer size, and builds', () => {
    const presets = layoutPresets(catalogFamilies)
    expect(presets.length).toBeGreaterThan(20)
    const d = templates.find(t => t.id === 'sideboard')!.create()
    if (d.product.kind !== 'cabinet') throw new Error('cabinet expected')
    const root = d.product.params.interior
    const before = buildModel(d).bounds
    for (const p of presets) {
      const next = applyLayout(root, p.space())
      expect(next.id).toBe(root.id)
      const nd = { ...d, product: { ...d.product, params: { ...d.product.params, interior: next } } }
      const m = buildModel(nd)
      expect(m.bounds.w).toBe(before.w)
      expect(m.bounds.h).toBe(before.h)
    }
  })
})
