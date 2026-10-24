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

describe('placement (ADR-031)', () => {
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
  it('living (user 2026-10-24): catalog base cabinets 1 door + 2 doors + 1 door, on the floor and the same hung at the ceiling', () => {
    const p = mobilaLiving()
    const pm = buildProjectModel(p)
    const b = pm.pieces.map(x => [x.bounds.x, x.bounds.y, x.bounds.w, x.bounds.h])
    expect(b).toEqual([
      [0, 0, 805, 435], [805, 0, 1610, 435], [2415, 0, 805, 435],
      [0, 2165, 805, 435], [805, 2165, 1610, 435], [2415, 2165, 805, 435],
    ])
    // every piece comes from the catalog's base cabinet family, with one or two doors
    expect(p.items.map(i => i.design.catalog?.origin?.variantId)).toEqual(['base-door', 'base-2-doors', 'base-door', 'base-door', 'base-2-doors', 'base-door'])
    expect(p.items.map(i => buildModel(i.design).panels.filter(x => x.role === 'door').length)).toEqual([1, 2, 1, 1, 2, 1])
    // ceiling row hangs on brackets above its floor cabinet; overall 3220 × 2600, the file's envelope
    expect(p.items.slice(3).map(i => i.placement)).toEqual([1, 2, 3].map(n => ({ kind: 'above', baseId: `living-jos-${n}`, gap: 1730, offsetX: 0 })))
    expect([pm.model.bounds.w, pm.model.bounds.h]).toEqual([3220, 2600])
    for (const [x, y] of [[0, 1], [3, 4], [1, 2], [4, 5]]) expect(overlaps(pm.pieces[x].bounds, pm.pieces[y].bounds)).toBe(false)
  })
  it('living cut list: 38 parts, 8 fronts 803 × 433', () => {
    const rows = projectCutlist(mobilaLiving())
    const got = rows.map(r => [r.length, r.width, r.materialName.slice(0, 3), r.quantity])
    expect(got).toEqual(expect.arrayContaining([
      [803, 433, 'MDF', 8], [1610, 400, 'PAL', 4], [1574, 400, 'PAL', 2], [805, 400, 'PAL', 8], [769, 400, 'PAL', 4], [400, 399, 'PAL', 12],
    ]))
    expect(rows.reduce((a, r) => a + r.quantity, 0)).toBe(38)
  })
  it('nightstand A: two units, fronts 446 wide, top front 160', () => {
    const p = mobilaDormitor()
    expect(p.items[0].quantity).toBe(2)
    const rows = projectCutlist(p)
    expect(rows.find(r => r.length === 446 && r.width === 160)?.quantity).toBe(2)
    expect(rows.find(r => r.length === 450 && r.width === 332)?.quantity).toBe(2)
  })
  it("Pat Noi: the file's cut panels; sides screwed to the foot board (user 2026-10-23), headboard trim in the pile", () => {
    const p = mobilaDormitor()
    const bed = p.items.find(i => i.id === 'dormitor-pat-noi')!
    expect(bed.design.product.kind).toBe('panels')
    const pm = buildProjectModel(p)
    const piece = pm.pieces.find(x => x.item.id === bed.id)!
    expect(piece.model.diagnostics.map(d => d.code)).toContain('not-assembled')
    expect(piece.model.diagnostics.filter(d => d.severity === 'error')).toEqual([])
    const m = buildModel(bed.design)
    const at = (label: string) => m.panels.find(x => x.label === label)!.box
    // Sides on edge behind the foot board, flush with its ends; foot board across the front.
    expect(at('Laterală pat stânga')).toEqual({ x: 0, y: 0, z: 0, w: 18, h: 270, d: 1800 })
    expect(at('Laterală pat dreapta')).toEqual({ x: 2022, y: 0, z: 0, w: 18, h: 270, d: 1800 })
    expect(at('Cap pe picioare')).toEqual({ x: 0, y: 0, z: 1800, w: 2040, h: 270, d: 18 })
    // Headboard trim stays in the pile, clear of the frame.
    expect(at('Traversă tăblie').x).toBe(2140)
    expect(m.hardware.filter(h => h.kind === 'screws').map(h => h.label)).toEqual(['Screws: Laterală pat stânga to Cap pe picioare', 'Screws: Laterală pat dreapta to Cap pe picioare'])
    const rows = projectCutlist({ ...p, items: [bed] })
    const got = rows.map(r => [r.length, r.width, r.thickness, r.materialName.slice(0, 3), r.quantity])
    expect(got).toEqual(expect.arrayContaining([
      [1800, 270, 18, 'PAL', 2], [2040, 270, 18, 'PAL', 1], [2100, 100, 18, 'MDF', 1], [2100, 80, 18, 'MDF', 1], [450, 80, 18, 'MDF', 2],
    ]))
    expect(rows.reduce((a, r) => a + r.quantity, 0)).toBe(7)
    // The bed does not overlap the nightstand in the plan.
    const [ns, b] = pm.pieces.map(x => x.bounds)
    expect(overlaps(ns, b)).toBe(false)
  })
  it('sheets lay out for every room', () => {
    for (const s of sampleProjects) {
      const p = s.create()
      for (const job of projectNestingJobs(p)) expect(nest(job).unplaced).toEqual([])
    }
  })
})

describe('panel set (ADR-041)', () => {
  const set = (): Design => ({
    ...t('panels'),
    product: { kind: 'panels', id: 'ps', params: { panels: [
      { id: 'a', name: 'Small', length: 400, width: 200, materialId: 'pal18', quantity: 2 },
      { id: 'b', name: 'Big', length: 1800, width: 270, materialId: 'hdf3', quantity: 1 },
    ] } },
  })
  it('lies flat in one pile, largest at the bottom, sizes and boards as listed', () => {
    const m = buildModel(set())
    expect(m.panels.map(p => [p.label, p.box.x, p.box.y, p.box.z, p.box.w, p.box.h, p.box.d])).toEqual([
      ['Big', 0, 0, 0, 1800, 3, 270], ['Small', 0, 3, 0, 400, 18, 200], ['Small', 0, 21, 0, 400, 18, 200],
    ])
    expect(m.diagnostics.filter(d => d.severity === 'error')).toEqual([])
    expect(m.diagnostics.map(d => d.code)).toEqual(['not-assembled'])
  })
  it('an empty set or an unknown board is an error, not a crash', () => {
    const d = set()
    const empty = { ...d, product: { ...d.product, params: { panels: [] } } } as Design
    expect(buildModel(empty).diagnostics.map(x => x.code)).toContain('no-panels')
    const bad = { ...d, product: { ...d.product, params: { panels: [{ id: 'x', name: 'X', length: 100, width: 100, materialId: 'nope', quantity: 1 }] } } } as Design
    expect(buildModel(bad).diagnostics.map(x => x.code)).toContain('material-missing')
  })
  it('placed panels are built where they sit; joints are scheduled; the rest stays in a pile beside them', () => {
    const d = set()
    const placed = { ...d, product: { ...d.product, params: { panels: [
      { id: 'side', name: 'Side', length: 800, width: 300, materialId: 'pal18', quantity: 1, place: { x: 0, y: 0, z: 0, lie: 'up-z' } },
      { id: 'top', name: 'Top', length: 600, width: 300, materialId: 'pal18', quantity: 1, place: { x: 18, y: 782, z: 0, lie: 'flat-x' } },
      { id: 'spare', name: 'Spare', length: 400, width: 200, materialId: 'pal18', quantity: 1 },
    ], joints: [{ a: 'side', b: 'top', kind: 'screwed' }] } } } as Design
    expect(validateDesign(placed)).toEqual([])
    const m = buildModel(placed)
    expect(m.panels.map(x => [x.label, x.box.x, x.box.y, x.box.z, x.box.w, x.box.h, x.box.d, x.thicknessAxis])).toEqual([
      ['Side', 0, 0, 0, 18, 800, 300, 'x'], ['Top', 18, 782, 0, 600, 18, 300, 'y'], ['Spare', 718, 0, 0, 400, 18, 200, 'y'],
    ])
    expect(m.hardware).toEqual([expect.objectContaining({ kind: 'screws', quantity: 1 })])
    expect(m.diagnostics.filter(x => x.severity === 'error')).toEqual([])
    // Two placed panels in the same space are caught by the independent overlap check.
    const clash = structuredClone(placed)
    if (clash.product.kind === 'panels') clash.product.params.panels[1].place!.x = 0
    expect(buildModel(clash).diagnostics.map(x => x.code)).toContain('overlap')
  })
  it('placements and joints are validated, never thrown', () => {
    const d = set()
    const with1 = (lp: object, joints?: object[]) => ({ ...d, product: { ...d.product, params: { panels: [lp, { id: 'o', name: 'O', length: 100, width: 100, materialId: 'pal18', quantity: 1 }], ...(joints ? { joints } : {}) } } })
    const base = { id: 'x', name: 'X', length: 100, width: 100, materialId: 'pal18', quantity: 1 }
    expect(validateDesign(with1({ ...base, place: { x: 0, y: 0, z: 0, lie: 'sideways' } }))).toContain('Invalid place for X')
    expect(validateDesign(with1({ ...base, place: { x: 0.5, y: 0, z: 0, lie: 'flat-x' } }))).toContain('x must be a whole number of mm')
    expect(validateDesign(with1({ ...base, quantity: 2, place: { x: 0, y: 0, z: 0, lie: 'flat-x' } }))).toContain('X: a placed panel has quantity 1 (list each copy with its own place)')
    expect(validateDesign(with1(base, [{ a: 'x', b: 'nope', kind: 'screwed' }]))).toContain('Invalid joint')
    const unplaced = with1(base, [{ a: 'x', b: 'o', kind: 'screwed' }]) as Design
    expect(buildModel(unplaced).diagnostics.map(x => x.code)).toContain('joint-unplaced')
  })
  it('validates panels on import', () => {
    const d = set()
    expect(validateDesign(d)).toEqual([])
    const with1 = (lp: object) => ({ ...d, product: { ...d.product, params: { panels: [lp] } } })
    expect(validateDesign(with1({ id: 'x', name: 'X', length: 100, width: 100, materialId: 'pal18', quantity: 0 }))).toContain('Quantity of X must be 1 to 100')
    expect(validateDesign(with1({ id: 'x', name: 'X', length: 10.5, width: 100, materialId: 'pal18', quantity: 1 }))).toContain('length must be a whole number of mm')
    expect(validateDesign(with1({ id: 'x', name: 'X', length: 100, width: 100, materialId: 'nope', quantity: 1 }))).toContain('materialId refers to an unknown material')
    const two = { ...d, product: { ...d.product, params: { panels: [d.product.kind === 'panels' && d.product.params.panels[0], d.product.kind === 'panels' && d.product.params.panels[0]] } } }
    expect(validateDesign(two)).toContain('Invalid panel')
  })
})
