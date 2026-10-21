import 'fake-indexeddb/auto'
import { describe, expect, it } from 'vitest'
import { buildModel } from '../src/core/build'
import { cutlist } from '../src/core/cutlist'
import { templates } from '../src/core/design'
import { nest } from '../src/core/nesting'
import { buildProjectModel, makeItem, newProject, placeItem, projectCutlist, projectHardware, projectNestingJobs, rotateBox, validateProject, type Project, type QuarterTurn } from '../src/core/project'
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
    expect(db.verno).toBe(2)
  })
})
