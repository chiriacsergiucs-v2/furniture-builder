import 'fake-indexeddb/auto'
import { describe, expect, it } from 'vitest'
import { catalogFamilies, insertVariant } from '../src/core/catalog'
import { shadowOf } from '../src/core/catalog/local'
import { validateDesign } from '../src/core/design'
import { makeItem, newProject } from '../src/core/project'
import { useDesign } from '../src/store/designStore'

describe('catalog origin survives every copy (ADR-0028)', () => {
  it('insert → edit → duplicate → export → import → embed keeps the origin byte-identical', () => {
    const f = catalogFamilies.find(x => x.id === 'wardrobe')!
    const d = insertVariant(f, f.variants[1])!
    const origin = JSON.stringify(d.catalog!.origin)
    useDesign.getState().load(d)
    useDesign.getState().updateCabinet({ width: 1900 })
    const edited = useDesign.getState().design
    const duplicated = { ...edited, id: 'dup' }
    const imported = JSON.parse(JSON.stringify(duplicated))
    expect(validateDesign(imported)).toEqual([])
    const embedded = makeItem(newProject(), imported).design
    for (const x of [edited, duplicated, imported, embedded]) expect(JSON.stringify(x.catalog!.origin)).toBe(origin)
  })
  it('the first edit clears a brand but keeps the origin', () => {
    const f = catalogFamilies.find(x => x.id === 'chest')!
    const d = insertVariant(f, f.variants[0])!
    const branded = { ...d, catalog: { ...d.catalog!, brand: 'ACME', origin: { ...d.catalog!.origin!, brand: 'ACME' } } }
    useDesign.getState().load(branded)
    useDesign.getState().rename('My chest')
    const after = useDesign.getState().design.catalog!
    expect(after.brand).toBeUndefined()
    expect(after.origin?.brand).toBe('ACME')
  })
})

describe('template edit mode (ADR-0034)', () => {
  it('edits a variant design, then returns to the piece that was open; cancel keeps the template unchanged', () => {
    const t = shadowOf(catalogFamilies.find(x => x.id === 'bookcase')!)
    const open = insertVariant(catalogFamilies[0], catalogFamilies[0].variants[0])!
    useDesign.getState().load(open)
    useDesign.getState().editTemplateVariant(t, t.family.variants[0].id)
    useDesign.getState().updateCabinet({ height: 1500 })
    const saved = useDesign.getState().finishTemplateEdit(true)!
    const v = saved.family.variants[0].design!
    expect(v.product.kind === 'cabinet' && v.product.params.height).toBe(1500)
    expect(saved.revision).toBe(t.revision + 1)
    expect(useDesign.getState().design.id).toBe(open.id)
    useDesign.getState().editTemplateVariant(t, t.family.variants[0].id)
    useDesign.getState().updateCabinet({ height: 1200 })
    expect(useDesign.getState().finishTemplateEdit(false)).toBeNull()
    const kept = t.family.variants[0].design!
    expect(kept.product.kind === 'cabinet' && kept.product.params.height).toBe(1800)
  })
})
