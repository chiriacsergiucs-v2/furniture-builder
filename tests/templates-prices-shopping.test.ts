import 'fake-indexeddb/auto'
import Dexie from 'dexie'
import { describe, expect, it } from 'vitest'
import { buildModel } from '../src/core/build'
import { cutlist, hardwareSummary } from '../src/core/cutlist'
import { templates } from '../src/core/design'
import { estimate, parsePricesCsv, pricesCsv, type PriceEntry } from '../src/core/prices'
import { buildProjectModel, makeItem, materialKey, newProject, projectCutlist, projectHardware, suggestRunParts, validateProject, type Project } from '../src/core/project'
import { projectFromTemplate, templateFromProject, validateProjectTemplate } from '../src/core/projectTemplate'
import { shoppingCsvRo, shoppingList } from '../src/core/shopping'
import { shapeOutline } from '../src/core/room'
import type { Design, Space } from '../src/core/types'
import { db, listPrices, listProjectTemplates, saveProjectTemplate, savePrices } from '../src/persist/db'

const t = (id: string) => templates.find(x => x.id === id)!.create()
function kitchen(): Project {
  let p = newProject('Kitchen')
  for (const id of ['base-door', 'base-door', 'chest']) p = { ...p, items: [...p.items, makeItem(p, t(id))] }
  p = { ...p, items: p.items.map(it => ({ ...it, position: { ...it.position, x: it.position.x + 300, z: 50 } })) }
  return { ...p, runParts: suggestRunParts(p), runSettings: { scribe: 10, auto: true } }
}

describe('project templates (ADR-0057)', () => {
  it('save → use gives the same pieces at the same relative places, new ids, run parts suggested again', () => {
    const p = kitchen()
    const tpl = templateFromProject(p, 'My kitchen')
    expect(validateProjectTemplate(tpl)).toEqual([])
    expect(tpl.items[0].offset).toEqual({ x: 0, y: 0, z: 0 })
    const q = projectFromTemplate(tpl, 'Copy')
    expect(validateProject(q)).toEqual([])
    expect(q.items.map(i => i.design.name)).toEqual(p.items.map(i => i.design.name))
    expect(q.items.some(i => p.items.some(j => j.id === i.id))).toBe(false)
    expect(q.items[1].position.x - q.items[0].position.x).toBe(p.items[1].position.x - p.items[0].position.x)
    // Run parts are suggested again for where the pieces now stand (against the corner: no left cover).
    expect(q.runParts).toEqual(suggestRunParts(q))
    expect(q.runParts!.some(r => r.kind === 'worktop')).toBe(true)
    expect(q.runSettings).toEqual({ scribe: 10, auto: true })
    expect(buildProjectModel(q).diagnostics.filter(d => d.severity === 'error')).toEqual([])
  })
  it('the room is optional; with it, positions stay absolute', () => {
    const p = { ...kitchen(), room: { height: 2500, outline: shapeOutline('rectangle', { width: 4000, depth: 3000, cutWidth: 0, cutDepth: 0, offset: 0 }), features: [] } }
    expect(templateFromProject(p, 'a').room).toBeUndefined()
    const withRoom = templateFromProject(p, 'b', { includeRoom: true })
    expect(withRoom.room).toBeDefined()
    expect(projectFromTemplate(withRoom).items[0].position.x).toBe(p.items[0].position.x)
  })
  it('stored in Dexie v7 next to everything else; an unreadable row is skipped and kept', async () => {
    expect(db.verno).toBe(7)
    const tpl = templateFromProject(kitchen(), 'Stored')
    await saveProjectTemplate(tpl)
    await db.projectTemplates.put({ id: 'bad', name: 'bad', updatedAt: '2020', template: { nope: 1 } as never })
    const list = await listProjectTemplates()
    expect(list.map(x => x.id)).toContain(tpl.id)
    expect(list.map(x => x.id)).not.toContain('bad')
    expect(await db.projectTemplates.get('bad')).toBeDefined()
  })
  it('a v6 database upgrades to v7 keeping its tables', async () => {
    const name = 'upgrade-test'
    const old = new Dexie(name)
    old.version(6).stores({ designs: 'id, updatedAt, name', projects: 'id, updatedAt, name', templates: 'id, updatedAt', researchDocs: 'key, docId', researchMarks: 'id, updatedAt', images: 'id', decors: 'id' })
    await old.open()
    await old.table('decors').put({ id: 'x' })
    old.close()
    const { db: _ } = await import('../src/persist/db'); void _
    const Fresh = (await import('../src/persist/db')).db.constructor as new (n: string) => typeof db
    const nw = new Fresh(name)
    await nw.open()
    expect(nw.verno).toBe(7)
    expect(await nw.decors.get('x')).toBeDefined()
    expect(await nw.prices.count()).toBe(0)
    nw.close()
  })
})

describe('shopping list (ADR-0061) and estimate (ADR-0059)', () => {
  const sink = (): Design => {
    const d = t('chest')
    const fix = (s: Space): Space => (s.kind === 'drawers' ? { ...s, fixedTop: true } : s.kind === 'split' ? { ...s, children: s.children.map(fix) } : s)
    return d.product.kind === 'cabinet' ? { ...d, product: { ...d.product, params: { ...d.product.params, interior: fix(d.product.params.interior) } } } : d
  }
  it('lists boards, banding, hardware, run parts, and what is still to choose; screws are not counted', () => {
    let p = kitchen()
    p = { ...p, items: [...p.items, { ...makeItem(p, sink()), position: { x: 5000, y: 0, z: 0 } }] }
    const pm = buildProjectModel(p)
    const lines = shoppingList({ rows: projectCutlist(p), materials: pm.materials, hardware: projectHardware(p), sheets: null, runParts: p.runParts })
    const sections = new Set(lines.map(l => l.section))
    for (const s of ['boards', 'banding', 'hardware', 'run', 'choose'] as const) expect(sections.has(s)).toBe(true)
    expect(lines.find(l => l.section === 'choose')!.label).toMatch(/fixed \(false\) front/)
    expect(lines.some(l => l.section === 'hardware' && /runner/i.test(l.label))).toBe(true)
    const tall = buildModel(t('wardrobe'))
    const safety = shoppingList({ rows: [], materials: [], hardware: [], sheets: null, diagnostics: [...tall.diagnostics, { severity: 'warning', code: 'anti-tip', message: 'Fix it to the wall.' }] })
    expect(safety.some(l => l.section === 'choose' && l.label === 'Anti-tip fixing')).toBe(true)
    const csv = shoppingCsvRo(lines)
    expect(csv).toContain('Plăci')
    expect(csv).toContain('not counted')
  })
  it('estimate per sheet and per m²; missing prices are listed and nothing is guessed; CSV round trip', () => {
    const d = t('chest'), m = buildModel(d)
    const rows = cutlist(m, d.materials)
    const body = d.materials.find(x => rows.some(r => r.materialId === x.id))!
    const sheets = new Map([[body.id, 2]])
    const lines = shoppingList({ rows, materials: d.materials, hardware: hardwareSummary(m), sheets })
    const board = lines.find(l => l.priceKey === `board:${materialKey(body)}`)!
    expect(board.unit).toBe('sheet')
    const perSheet: PriceEntry = { id: board.priceKey!, unit: 'sheet', amount: 25000 }
    const e1 = estimate(lines, [perSheet])
    expect(e1.total).toBe(50000)
    expect(e1.missing.length).toBe(lines.filter(l => l.priceKey).length - 1)
    const perM2: PriceEntry = { ...perSheet, unit: 'm2', amount: 10000 }
    expect(estimate(lines, [perM2]).total).toBe(Math.round(board.m2! * 10000))
    const csv = pricesCsv([perSheet, { id: 'currency', unit: 'piece', amount: 0, text: 'EUR' }])
    const back = parsePricesCsv(csv)
    expect(back.problems).toEqual([])
    expect(back.prices).toEqual([perSheet, { id: 'currency', unit: 'piece', amount: 0, text: 'EUR' }])
    expect(parsePricesCsv('key;unit;price\nboard:x;sheet;abc\nboard:y;bad;1').problems).toHaveLength(2)
  })
  it('prices are stored on this device; unreadable rows are skipped and kept', async () => {
    await savePrices([{ id: 'hw:Knob', unit: 'piece', amount: 350 }])
    await db.prices.put({ id: 'broken', unit: 'x', amount: -1 } as never)
    const list = await listPrices()
    expect(list.map(p => p.id)).toContain('hw:Knob')
    expect(list.map(p => p.id)).not.toContain('broken')
    expect(await db.prices.get('broken')).toBeDefined()
  })
})
