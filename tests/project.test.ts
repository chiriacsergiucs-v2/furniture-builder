import 'fake-indexeddb/auto'
import { describe, expect, it } from 'vitest'
import { buildModel } from '../src/core/build'
import { cutlist } from '../src/core/cutlist'
import { templates } from '../src/core/design'
import { nest } from '../src/core/nesting'
import { buildProjectModel, makeItem, newProject, placeItem, projectCutlist, projectHardware, projectNestingJobs, rotateBox, suggestRunParts, validateProject, type Project, type QuarterTurn } from '../src/core/project'
import { overlaps } from '../src/core/geometry'
import { db, listProjects, loadProject, saveProject } from '../src/persist/db'

const t = (id: string) => templates.find(x => x.id === id)!.create()
function kitchen(): Project {
  let p = newProject('Kitchen')
  for (const id of ['base-door', 'base-door', 'chest', 'wall-cabinet']) p = { ...p, items: [...p.items, makeItem(p, t(id))] }
  return p
}

describe('projects (ADR-0022)', () => {
  it('quarter turns are exact and keep the footprint size', () => {
    const b = { x: 10, y: 0, z: 20, w: 600, h: 720, d: 560 }
    for (const r of [0, 90, 180, 270] as QuarterTurn[]) {
      const rb = rotateBox(b, r)
      expect(rb.w * rb.d).toBe(b.w * b.d)
      expect(rotateBox(rotateBox(rotateBox(rotateBox(b, 90), 90), 90), 90)).toEqual(b)
    }
  })
  it('new pieces are placed side by side without overlapping; wall cabinets at mounting height', () => {
    const p = kitchen()
    const pm = buildProjectModel(p)
    expect(pm.diagnostics).toEqual([])
    expect(pm.pieces[1].bounds.x).toBe(pm.pieces[0].bounds.x + pm.pieces[0].bounds.w)
    expect(pm.pieces[3].bounds.y).toBe(1450)
  })
  it('a rotated piece keeps its panels intact and its front faces +x at 90°', () => {
    const p = kitchen()
    const item = { ...p.items[0], rotationY: 90 as const, position: { x: 0, y: 0, z: 2000 } }
    const pc = placeItem(item)
    const flat = buildModel(item.design)
    expect(pc.panels.length).toBe(flat.panels.length)
    expect(pc.bounds.x).toBe(0); expect(pc.bounds.z).toBe(2000)
    const door = pc.panels.find(x => x.role === 'door')!
    expect(door.box.x + door.box.w).toBe(pc.bounds.x + pc.bounds.w) // fronts at the +x side
    expect(door.thicknessAxis).toBe('x')
  })
  it('overlapping pieces are reported', () => {
    const p = kitchen()
    const clash = { ...p, items: p.items.map((it, i) => (i === 1 ? { ...it, position: { ...it.position, x: it.position.x - 100 } } : it)) }
    expect(buildProjectModel(clash).diagnostics.map(d => d.code)).toContain('pieces-overlap')
    for (let a = 0; a < 2; a++) expect(overlaps(buildProjectModel(p).pieces[a].bounds, buildProjectModel(p).pieces[a + 1].bounds)).toBe(false)
  })
  it('combined parts equal the sum of each piece × quantity', () => {
    const p0 = kitchen()
    const p = { ...p0, items: p0.items.map((it, i) => (i === 2 ? { ...it, quantity: 3 } : it)) }
    const total = projectCutlist(p).reduce((n, r) => n + r.quantity, 0)
    const expected = p.items.reduce((n, it) => n + cutlist(buildModel(it.design), it.design.materials).reduce((m, r) => m + r.quantity, 0) * it.quantity, 0)
    expect(total).toBe(expected)
    const runners = projectHardware(p).find(h => h.kind === 'drawer-runner-pair')!
    expect(runners.quantity).toBe(4 * 3)
  })
  it('the whole project lays out on stock sheets with valid layouts', () => {
    const p = kitchen()
    for (const j of projectNestingJobs(p)) { const r = nest(j, { maxMs: 10_000 }); expect(r.valid).toBe(true); expect(r.unplaced).toEqual([]) }
  })
  it('validates and stores projects in Dexie version 2 next to designs', async () => {
    const p = kitchen()
    expect(validateProject(p)).toEqual([])
    expect(validateProject({ ...p, items: [{ ...p.items[0], rotationY: 45 }] })).toContain('Item rotation must be a quarter turn')
    await saveProject(p)
    expect((await listProjects()).map(x => x.id)).toContain(p.id)
    expect((await loadProject(p.id))?.items.length).toBe(4)
    expect(db.verno).toBe(7)
  })
})

describe('project materials (review fix 2026-10-22)', () => {
  it('a grained and a plain board of the same name never share a sheet; conflicting sheets are flagged', () => {
    let p = newProject('Mixed')
    const a = t('base-door'), b = t('base-door')
    b.materials = b.materials.map(m => ({ ...m, grain: !m.grain, sheet: { length: 2440, width: 1220, trim: 10, count: null } }))
    const c = t('base-door')
    c.materials = c.materials.map(m => ({ ...m, sheet: { length: 2440, width: 1220, trim: 10, count: null } }))
    for (const d of [a, b, c]) p = { ...p, items: [...p.items, makeItem(p, d)] }
    const pm = buildProjectModel(p)
    const jobs = projectNestingJobs(p), rows = projectCutlist(p)
    const names = jobs.map(j => j.materialName)
    for (const j of jobs) for (const r of rows.filter(r => r.materialId === j.materialId)) expect(r.grain).toBe(j.grain)
    expect(names.length).toBeGreaterThan(new Set(names).size) // same name split by grain
    expect(pm.diagnostics.some(d => d.code === 'material-sheet-conflict')).toBe(true)
  })
})

describe('run parts (ADR-0036)', () => {
  const run = (): Project => {
    let p = newProject('Run')
    for (const id of ['base-door', 'base-door', 'chest']) p = { ...p, items: [...p.items, makeItem(p, t(id))] }
    // Move the run off the wall corner and open a 37 mm gap before the third unit.
    return { ...p, items: p.items.map((it, i) => ({ ...it, position: { ...it.position, x: it.position.x + 100 + (i === 2 ? 37 : 0) } })) }
  }
  it('a run gets one worktop, a filler in the gap and a cover panel on each exposed end, each with a reason', () => {
    const p = run()
    const parts = suggestRunParts(p)
    expect(parts.filter(x => x.kind === 'worktop')).toHaveLength(1)
    const filler = parts.find(x => x.kind === 'filler')!
    expect(filler.box.w).toBe(37)
    expect(filler.reason).toContain('37 mm')
    expect(parts.filter(x => x.kind === 'cover')).toHaveLength(2)
    expect(parts.every(x => x.reason.length > 0)).toBe(true)
    const wt = parts.find(x => x.kind === 'worktop')!
    const pm0 = buildProjectModel(p)
    expect(wt.box.y).toBe(Math.max(...pm0.pieces.map(pc => pc.bounds.y + pc.bounds.h)))
  })
  it('run parts join the model, the cut list (once each) and the sheets without overlapping anything', () => {
    const p0 = run()
    const p = { ...p0, runParts: suggestRunParts(p0) }
    const pm = buildProjectModel(p)
    expect(pm.diagnostics.filter(d => d.severity === 'error')).toEqual([])
    const rows = projectCutlist(p).filter(r => r.labels.some(l => l.startsWith('Run:')))
    expect(rows.reduce((n, r) => n + r.quantity, 0)).toBe(p.runParts.length)
    for (const j of projectNestingJobs(p)) { const r = nest(j, { maxMs: 10_000 }); expect(r.valid).toBe(true) }
    expect(validateProject(p)).toEqual([])
    expect(validateProject({ ...p, runParts: [{ ...p.runParts[0], kind: 'skirting' }] } as unknown as Project)).toContain('Invalid run part')
  })
  it('a run part that now overlaps a moved piece is an error', () => {
    const p0 = run()
    const p = { ...p0, runParts: suggestRunParts(p0) }
    const moved = { ...p, items: p.items.map((it, i) => (i === 2 ? { ...it, position: { ...it.position, x: it.position.x - 30 } } : it)) }
    expect(buildProjectModel(moved).diagnostics.map(d => d.code)).toContain('run-part-overlap')
  })
})
