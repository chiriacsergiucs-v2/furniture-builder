import { describe, expect, it } from 'vitest'
import { buildModel } from '../src/core/build'
import { bayLayoutOf, makeBays, templates, validateDesign } from '../src/core/design'
import { overlaps } from '../src/core/geometry'
import { nest } from '../src/core/nesting'
import {
  buildProjectModel, makeItem, newProject, placementBases, placementIssues, projectCutlist, projectNestingJobs,
  removeProjectItem, resolvePlacements, setGapLeft, validateProject, type Project,
} from '../src/core/project'
import { mobilaDormitor, mobilaLiving, sampleProjects } from '../src/core/samples/mobila'
import type { CabinetParams, Design } from '../src/core/types'

const t = (id: string) => templates.find(x => x.id === id)!.create()
const cab = (d: Design) => (d.product as { params: CabinetParams }).params
const withParams = (d: Design, patch: Partial<CabinetParams>): Design => ({ ...d, product: { ...d.product, params: { ...cab(d), ...patch } } as Design['product'] })

describe('cabinet bottom under the sides', () => {
  it('runs the full width and the sides stand on it', () => {
    const d = withParams(t('base-door'), { bottom: 'under' })
    const m = buildModel(d)
    const p = cab(d)
    const bottom = m.panels.find(x => x.role === 'bottom')!
    const sides = m.panels.filter(x => x.role === 'side')
    expect(bottom.box.x).toBe(0)
    expect(bottom.box.w).toBe(p.width)
    for (const s of sides) expect(s.box.y).toBe(bottom.box.y + bottom.box.h)
    expect(m.diagnostics.filter(x => x.severity === 'error')).toEqual([])
    for (let i = 0; i < m.panels.length; i++) for (let j = i + 1; j < m.panels.length; j++) expect(overlaps(m.panels[i].box, m.panels[j].box)).toBe(false)
  })
  it('validates', () => {
    expect(validateDesign(withParams(t('base-door'), { bottom: 'under' }))).toEqual([])
    expect(validateDesign(withParams(t('base-door'), { bottom: 'sideways' as never }))).toContain('Invalid bottom joint')
  })
})

describe('bay layout', () => {
  it('builds bays with uprights, shelves and doors, and reads them back', () => {
    const d = t('base-door')
    const interior = makeBays({ bays: 3, shelves: 2, doors: 1 }, cab(d).interior)
    expect(interior.id).toBe(cab(d).interior.id)
    expect(bayLayoutOf(interior)).toEqual({ bays: 3, shelves: 2, doors: 1 })
    const m = buildModel(withParams(withParams(d, { width: 1200 }), { interior }))
    expect(m.panels.filter(p => p.role === 'divider')).toHaveLength(2)
    expect(m.panels.filter(p => p.role === 'shelf')).toHaveLength(6)
    expect(m.panels.filter(p => p.role === 'door')).toHaveLength(3)
  })
  it('keeps bay ids and fixed widths when only shelves change, and collapses to one bay', () => {
    const a = makeBays({ bays: 2, shelves: 1, doors: 0 }, { id: 'r', kind: 'empty' })
    const fixed = a.kind === 'split' ? { ...a, sizes: [{ mode: 'mm' as const, value: 300 }, a.sizes[1]] } : a
    const b = makeBays({ bays: 2, shelves: 3, doors: 2 }, fixed)
    expect(b.kind === 'split' && a.kind === 'split' && b.children.map(c => c.id)).toEqual(a.kind === 'split' && a.children.map(c => c.id))
    expect(b.kind === 'split' && b.sizes[0]).toEqual({ mode: 'mm', value: 300 })
    const one = makeBays({ bays: 1, shelves: 3, doors: 1 }, b)
    expect(one).toMatchObject({ id: 'r', kind: 'shelves', count: 3, front: { kind: 'doors', count: 1 } })
  })
  it('does not claim a layout for other insides', () => {
    expect(bayLayoutOf({ id: 'd', kind: 'drawers', count: 3 })).toBeNull()
    expect(bayLayoutOf(cab(t('wardrobe')).interior)).toBeNull()
  })
})

describe('placement (ADR-0031)', () => {
  const two = (): Project => {
    let p = newProject('Run')
    p = { ...p, items: [...p.items, makeItem(p, t('base-door'))] }
    p = { ...p, items: [...p.items, makeItem(p, t('wall-cabinet'))] }
    return p
  }
  it('new pieces get floor or wall placement', () => {
    const p = two()
    expect(p.items[0].placement).toEqual({ kind: 'floor' })
    expect(p.items[1].placement).toEqual({ kind: 'wall', height: 1450 })
    expect(validateProject(p)).toEqual([])
  })
  it('a piece on another stands on its top, back aligned, and follows it', () => {
    const p0 = two()
    const [base, top] = p0.items
    let p = resolvePlacements({ ...p0, items: [base, { ...top, placement: { kind: 'above', baseId: base.id, gap: 0, offsetX: 50 } }] })
    let pm = buildProjectModel(p)
    const b = pm.pieces[0].bounds, a = pm.pieces[1].bounds
    expect(a.y).toBe(b.y + b.h)
    expect(a.x).toBe(b.x + 50)
    expect(a.z).toBe(b.z)
    expect(pm.diagnostics.filter(d => d.code === 'pieces-overlap')).toEqual([])
    // move the base: the piece on it follows
    p = resolvePlacements({ ...p, items: p.items.map(i => (i.id === base.id ? { ...i, position: { ...i.position, x: 700 } } : i)) })
    pm = buildProjectModel(p)
    expect(pm.pieces[1].bounds.x).toBe(750)
    // hanging above with a gap
    p = resolvePlacements({ ...p, items: p.items.map(i => (i.id === top.id ? { ...i, placement: { kind: 'above', baseId: base.id, gap: 600, offsetX: 0 } } : i)) })
    expect(buildProjectModel(p).pieces[1].bounds.y).toBe(b.y + b.h + 600)
  })
  it('warns about a floor cabinet in the air and a wall cabinet on the floor', () => {
    const p0 = two()
    const [base, top] = p0.items
    const air = { ...p0, items: [{ ...base, placement: { kind: 'wall' as const, height: 900 } }, { ...top, placement: { kind: 'floor' as const } }] }
    const codes = placementIssues(air).map(d => d.code)
    expect(codes).toContain('placement-not-hung')
    expect(codes).toContain('placement-wall-on-floor')
  })
  it('refuses cycles, reports a missing base and frees pieces whose base is removed', () => {
    const p0 = two()
    const [a, b] = p0.items
    expect(placementBases({ ...p0, items: [a, { ...b, placement: { kind: 'above', baseId: a.id, gap: 0, offsetX: 0 } }] }, a.id).map(i => i.id)).toEqual([])
    const loop: Project = { ...p0, items: [{ ...a, placement: { kind: 'above', baseId: b.id, gap: 0, offsetX: 0 } }, { ...b, placement: { kind: 'above', baseId: a.id, gap: 0, offsetX: 0 } }] }
    expect(() => buildProjectModel(loop)).not.toThrow()
    expect(buildProjectModel(loop).diagnostics.some(d => d.code === 'placement-cycle' && d.severity === 'error')).toBe(true)
    const orphan: Project = { ...p0, items: [{ ...b, placement: { kind: 'above', baseId: 'gone', gap: 0, offsetX: 0 } }] }
    expect(placementIssues(orphan).map(d => d.code)).toEqual(['placement-base-missing'])
    const stacked: Project = { ...p0, items: [a, { ...b, placement: { kind: 'above', baseId: a.id, gap: 0, offsetX: 0 } }] }
    const left = removeProjectItem(stacked, a.id)
    expect(left.items).toHaveLength(1)
    expect(left.items[0].placement).toBeUndefined()
    expect(left.items[0].position).toEqual(stacked.items[1].position)
  })
  it('rejects malformed placements on import', () => {
    const p = two()
    const bad = (placement: unknown) => validateProject({ ...p, items: [{ ...p.items[0], placement }] })
    expect(bad({ kind: 'wall', height: -1 })).toContain('Invalid item placement')
    expect(bad({ kind: 'above', baseId: p.items[0].id, gap: 0, offsetX: 0 })).toContain('Invalid item placement')
    expect(bad({ kind: 'roof' })).toContain('Invalid item placement')
    expect(bad(undefined)).toEqual([])
  })
  it('a gap change on the base moves the pieces on it, not past them', () => {
    let p = newProject('Run')
    for (const id of ['base-door', 'base-door']) p = { ...p, items: [...p.items, makeItem(p, t(id))] }
    p = { ...p, items: [...p.items, { ...makeItem(p, t('wall-cabinet')), placement: { kind: 'above', baseId: p.items[1].id, gap: 700, offsetX: 0 } }] }
    p = resolvePlacements(p)
    const moved = setGapLeft(p, p.items[1].id, 100)
    const pm = buildProjectModel(moved)
    expect(pm.pieces[2].bounds.x).toBe(pm.pieces[1].bounds.x)
  })
})

/** Finished sizes and quantities from the file's `grouped_current_cut_list_by_material_and_room` (living). */
const SOURCE_LIVING: [number, number, number][] = [
  [2600, 400, 2], [2685, 400, 4], [400, 399, 12], [499, 400, 7], [510, 400, 4], [519, 400, 6],
]

describe('Mobila rooms from the project file', () => {
  it('every sample validates and builds without errors', () => {
    for (const s of sampleProjects) {
      const p = s.create()
      expect(validateProject(p)).toEqual([])
      const pm = buildProjectModel(p)
      expect(pm.diagnostics.filter(d => d.severity === 'error')).toEqual([])
      for (const pc of pm.pieces) expect(pc.model.diagnostics.filter(d => d.severity === 'error')).toEqual([])
    }
  })
  it('living: column at the left, JOS on the floor, SUS hung with its underside at 2165 like the file', () => {
    const pm = buildProjectModel(mobilaLiving())
    const [col, jos, sus] = pm.pieces.map(p => p.bounds)
    expect([col.x, col.w, col.h]).toEqual([0, 535, 2600])
    expect([jos.x, jos.y, jos.w, jos.h]).toEqual([535, 0, 2685, 435])
    expect([sus.x, sus.y, sus.w, sus.h]).toEqual([535, 2165, 2685, 435])
    // overall 3220 × 2600, as the file's envelope
    expect([pm.model.bounds.w, pm.model.bounds.h]).toEqual([3220, 2600])
  })
  it('living carcass parts match the file one for one (47 parts in all)', () => {
    const rows = projectCutlist(mobilaLiving())
    for (const [l, w, q] of SOURCE_LIVING) expect(rows.find(r => r.length === l && r.width === w && r.thickness === 18 && r.materialName.startsWith('PAL'))?.quantity).toBe(q)
    expect(rows.reduce((a, r) => a + r.quantity, 0)).toBe(47)
    const fronts = rows.filter(r => r.materialName.startsWith('MDF')).reduce((a, r) => a + r.quantity, 0)
    expect(fronts).toBe(12)
  })
  it('nightstand A: two units, fronts 446 wide, top front 160', () => {
    const p = mobilaDormitor()
    expect(p.items[0].quantity).toBe(2)
    const rows = projectCutlist(p)
    expect(rows.find(r => r.length === 446 && r.width === 160)?.quantity).toBe(2)
    expect(rows.find(r => r.length === 450 && r.width === 332)?.quantity).toBe(2)
  })
  it('sheets lay out for both rooms', () => {
    for (const s of sampleProjects) {
      const p = s.create()
      for (const job of projectNestingJobs(p)) expect(nest(job).unplaced).toEqual([])
    }
  })
})
