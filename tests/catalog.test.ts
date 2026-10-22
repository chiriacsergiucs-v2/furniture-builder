import { readFileSync, writeFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { buildModel } from '../src/core/build'
import { catalogFamilies, FUNCTIONS, insertable, insertVariant, ROOMS, startFamilies, BUILT_CAPABILITIES, setSafetyConfirmed } from '../src/core/catalog'
import { VARIANT_RO } from '../src/core/catalog/ro'
import { CATALOG_BEGIN, CATALOG_END, catalogMarkdown } from '../src/core/catalog/markdown'
import { templates, validateDesign } from '../src/core/design'

/** Warnings a shipped variant may carry at its default size, each by design (ADR-0035 compliance). */
const EXPECTED_WARNINGS = new Set(['internal-drawers', 'hardware-to-choose', 'flap-fitting', 'shelf-support'])
// Long frames carry the "centre leg" reminder by design.
const EXTRA: Record<string, string[]> = { 'sofa-3-frame': ['frame-span'], 'sectional-main': ['frame-span'], 'lounger-flat': ['frame-span'] }

describe('template catalog (ADR-0032, ADR-0033, ADR-0039)', () => {
  it('every family has 1–5 variants, known rooms and function, unique ids', () => {
    const ids = new Set<string>(), vids = new Set<string>()
    for (const f of catalogFamilies) {
      expect(f.variants.length, f.id).toBeGreaterThanOrEqual(1)
      expect(f.variants.length, f.id).toBeLessThanOrEqual(5)
      expect(FUNCTIONS).toContain(f.function)
      for (const r of f.rooms) expect(ROOMS).toContain(r)
      expect(ids.has(f.id)).toBe(false); ids.add(f.id)
      for (const v of f.variants) { expect(vids.has(v.id), v.id).toBe(false); vids.add(v.id) }
      expect(f.structure.length).toBeGreaterThan(10)
      expect(f.configurations.length).toBeGreaterThan(0)
    }
    expect(catalogFamilies).toHaveLength(42)
  })
  it('kitchen cabinets carry the most variants, simple open storage the fewest', () => {
    const avg = (fn: string) => { const l = catalogFamilies.filter(f => f.function === fn); return l.reduce((n, f) => n + f.variants.length, 0) / l.length }
    expect(avg('kitchen')).toBeGreaterThan(avg('storage'))
    expect(catalogFamilies.find(f => f.id === 'bookcase')!.variants).toHaveLength(1)
  })
  it('every insertable variant validates and builds without errors; warnings are only the documented ones', () => {
    for (const f of catalogFamilies) for (const v of f.variants) {
      if (!insertable(v)) continue
      const d = insertVariant(f, v)!
      expect(validateDesign(d), `${f.id}/${v.id}`).toEqual([])
      const m = buildModel(d)
      expect(m.diagnostics.filter(x => x.severity === 'error'), `${f.id}/${v.id}`).toEqual([])
      const allowed = new Set([...EXPECTED_WARNINGS, ...(EXTRA[v.id] ?? [])])
      expect(m.diagnostics.filter(x => !allowed.has(x.code)).map(x => x.code), `${f.id}/${v.id}`).toEqual([])
    }
  })
  it('a ready family starts with an insertable default; reference families stay out of Start from', () => {
    for (const f of catalogFamilies.filter(x => x.support === 'ready')) expect(insertable(f.variants[0]), f.id).toBe(true)
    const start = startFamilies().map(f => f.id)
    for (const f of catalogFamilies.filter(x => x.support === 'reference')) expect(start).not.toContain(f.id)
  })
  it('a variant with unmet requirements cannot be inserted, and says what it waits for', () => {
    const waiting = catalogFamilies.flatMap(f => f.variants.filter(v => v.requires.some(c => !BUILT_CAPABILITIES.has(c))).map(v => ({ f, v })))
    expect(waiting.length).toBeGreaterThan(0)
    for (const { f, v } of waiting) expect(insertVariant(f, v), v.id).toBeNull()
    const bunk = catalogFamilies.find(f => f.id === 'bunk-bed')!.variants[0]
    expect(bunk.create).toBeDefined() // built geometry, gated until safety values are confirmed
    expect(insertable(bunk)).toBe(false)
  })
  it('insert = deep copy: new id each time, origin recorded, the shipped data untouched', () => {
    const f = catalogFamilies.find(x => x.id === 'wardrobe')!
    const v = f.variants[0]
    const a = insertVariant(f, v, '2026-10-23T00:00:00.000Z')!, b = insertVariant(f, v)!
    expect(a.id).not.toBe(b.id)
    expect(a.catalog?.origin).toMatchObject({ catalogId: 'wardrobe', variantId: 'wardrobe', revision: 1, takenAt: '2026-10-23T00:00:00.000Z' })
    const before = JSON.stringify(v.create!().product.params.width)
    if (a.product.kind === 'cabinet') a.product.params.width = 9999
    expect(JSON.stringify(v.create!().product.params.width)).toBe(before)
    const hw = catalogFamilies.find(x => x.id === 'pullout-base')!
    expect(insertVariant(hw, hw.variants[0])!.catalog?.hardwareToChoose).toBe('pull-out frame')
  })
  it('more than 100 items; every family has at least one item that opens; every item has a Romanian name', () => {
    const all = catalogFamilies.flatMap(f => f.variants)
    expect(all.length).toBeGreaterThan(100)
    for (const f of catalogFamilies.filter(x => x.support !== 'safety')) expect(f.variants.some(insertable), f.id).toBe(true)
    for (const v of all) expect(VARIANT_RO[v.id], v.id).toBeTruthy()
  })
  it('safety-regulated items open once the user confirms they check them, and keep their warning', () => {
    const bunk = catalogFamilies.find(f => f.id === 'bunk-bed')!
    expect(insertVariant(bunk, bunk.variants[0])).toBeNull()
    setSafetyConfirmed(true)
    try {
      const d = insertVariant(bunk, bunk.variants[0])!
      expect(buildModel(d).diagnostics.map(x => x.code)).toContain('safety-not-checked')
      expect(buildModel(d).diagnostics.filter(x => x.severity === 'error')).toEqual([])
    } finally { setSafetyConfirmed(false) }
  })
  it('the ten existing templates are kept as variant ids', () => {
    const vids = new Set(catalogFamilies.flatMap(f => f.variants.map(v => v.id)))
    for (const t of templates) expect(vids.has(t.id), t.id).toBe(true)
  })
  it('docs/catalog.md lists exactly the families and variants in code', () => {
    const path = new URL('../docs/catalog.md', import.meta.url)
    const doc = readFileSync(path, 'utf8')
    const block = `${CATALOG_BEGIN}\n${catalogMarkdown()}\n${CATALOG_END}`
    const re = /<!-- catalog:begin[\s\S]*?<!-- catalog:end -->/
    if (process.env.UPDATE_CATALOG_DOC) writeFileSync(path, doc.replace(re, block))
    expect(readFileSync(path, 'utf8').match(re)?.[0]).toBe(block)
  })
})

describe('brand entries from the catalog feed (ADR-0027, ADR-0029)', () => {
  it('a brand entry opens as a copy with its origin; the shipped entry is unchanged', async () => {
    const { brandEntries, copyBrandEntry } = await import('../src/core/catalog/brands')
    expect(Array.isArray(brandEntries)).toBe(true)
    const design = { ...templates[1].create(), catalog: { brand: 'IKEA', productName: 'BILLY 80', category: 'Bookcase', origin: { catalogId: 'x', revision: 1, productName: 'BILLY 80', sourceUrl: 'https://www.ikea.com/x.pdf', takenAt: 't' } } }
    const entry = { catalogId: 'ikea-billy-80', design }
    const before = JSON.stringify(entry)
    const copy = copyBrandEntry(entry, 'new-id', '2026-10-23T00:00:00Z')
    expect(copy.id).toBe('new-id')
    expect(copy.catalog?.origin).toMatchObject({ catalogId: 'ikea-billy-80', brand: 'IKEA', productName: 'BILLY 80', sourceUrl: 'https://www.ikea.com/x.pdf' })
    expect(validateDesign(copy)).toEqual([])
    expect(JSON.stringify(entry)).toBe(before)
  })
})
