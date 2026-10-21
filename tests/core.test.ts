import { describe, expect, it } from 'vitest'
import { buildModel, hasErrors } from '../src/core/build'
import { cutlist, hardwareSummary } from '../src/core/cutlist'
import { changeKind, mapSpace, splitSpace, templates, validateDesign } from '../src/core/design'
import { cutDimensions, distribute, overlaps } from '../src/core/geometry'
import type { CabinetParams, Design, Panel } from '../src/core/types'

const byTemplate = (id: string) => templates.find(t => t.id === id)!.create()
const cab = (d: Design) => { if (d.product.kind !== 'cabinet') throw Error('not cabinet'); return d.product.params }
const withCab = (d: Design, patch: Partial<CabinetParams>): Design =>
  ({ ...d, product: { ...d.product, params: { ...cab(d), ...patch } } as Design['product'] })
const errors = (d: Design) => buildModel(d).diagnostics.filter(x => x.severity === 'error')
const role = (panels: Panel[], r: Panel['role']) => panels.filter(p => p.role === r)

describe('geometry', () => {
  it('distributes integer millimetres exactly', () => {
    expect(distribute(1000, [{ mode: 'fr', value: 1 }, { mode: 'fr', value: 2 }])).toEqual([333, 667])
    expect(distribute(1000, [{ mode: 'mm', value: 300 }, { mode: 'fr', value: 1 }, { mode: 'fr', value: 1 }])).toEqual([300, 350, 350])
    expect(distribute(100, [{ mode: 'mm', value: 300 }, { mode: 'fr', value: 1 }])).toBeNull()
    for (let t = 50; t < 3000; t += 37) {
      const parts = distribute(t, [{ mode: 'fr', value: 1 }, { mode: 'fr', value: 3 }, { mode: 'fr', value: 7 }])!
      expect(parts.reduce((a, b) => a + b, 0)).toBe(t)
    }
  })
  it('treats touching boxes as not overlapping', () => {
    expect(overlaps({ x: 0, y: 0, z: 0, w: 10, h: 10, d: 10 }, { x: 10, y: 0, z: 0, w: 10, h: 10, d: 10 })).toBe(false)
    expect(overlaps({ x: 0, y: 0, z: 0, w: 10, h: 10, d: 10 }, { x: 9, y: 0, z: 0, w: 10, h: 10, d: 10 })).toBe(true)
  })
})

describe('every template', () => {
  for (const t of templates) {
    it(`${t.id}: builds with no errors, integer mm, no overlaps, valid document`, () => {
      const d = t.create()
      expect(validateDesign(d)).toEqual([])
      const m = buildModel(d)
      expect(m.diagnostics.filter(x => x.severity === 'error')).toEqual([])
      expect(m.panels.length).toBeGreaterThanOrEqual(4)
      for (const p of m.panels) for (const v of Object.values(p.box)) expect(Number.isSafeInteger(v)).toBe(true)
      expect(new Set(m.panels.map(p => p.id)).size).toBe(m.panels.length)
      // cut list conserves every panel
      expect(cutlist(m, d.materials).reduce((n, r) => n + r.quantity, 0)).toBe(m.panels.length)
    })
  }
})

describe('chest of drawers', () => {
  const d = byTemplate('chest')
  const m = buildModel(d)
  const p = cab(d)

  it('has the expected parts', () => {
    expect(role(m.panels, 'side')).toHaveLength(2)
    expect(role(m.panels, 'drawer-front')).toHaveLength(4)
    expect(role(m.panels, 'drawer-side')).toHaveLength(8)
    expect(role(m.panels, 'plinth')).toHaveLength(1)
    expect(role(m.panels, 'back')).toHaveLength(1)
  })

  it('picks the longest runner that fits and schedules one pair per drawer', () => {
    // depth 450 − 3 mm applied back = 447 opening; −10 rear clearance → 437 → 400 runner
    const hw = hardwareSummary(m)
    expect(hw).toEqual([expect.objectContaining({ kind: 'drawer-runner-pair', quantity: 4, sizeMm: 400 })])
    for (const s of role(m.panels, 'drawer-side')) expect(s.box.d).toBe(400)
  })

  it('lays out fronts with exact gaps and half-gap outer reveals', () => {
    const fronts = role(m.panels, 'drawer-front').sort((a, b) => b.box.y - a.box.y)
    expect(fronts[0].box.y + fronts[0].box.h).toBe(p.height - 1)
    expect(fronts[3].box.y).toBe(p.plinthHeight + 1)
    for (let i = 0; i < 3; i++) expect(fronts[i].box.y - (fronts[i + 1].box.y + fronts[i + 1].box.h)).toBe(3)
    for (const f of fronts) { expect(f.box.x).toBe(1); expect(f.box.w).toBe(p.width - 2); expect(f.box.z).toBe(p.depth) }
  })

  it('drawer boxes clear the carcass sides by the runner clearance', () => {
    const t = 18
    const sides = role(m.panels, 'drawer-side')
    const left = Math.min(...sides.map(s => s.box.x))
    const right = Math.max(...sides.map(s => s.box.x + s.box.w))
    expect(left).toBe(t + 13)
    expect(right).toBe(p.width - t - 13)
  })

  it('keeps panel ids stable when the cabinet is resized', () => {
    const resized = buildModel(withCab(d, { width: 1000, height: 1100, depth: 500 }))
    expect(resized.panels.map(x => x.id).sort()).toEqual(m.panels.map(x => x.id).sort())
    expect(resized.diagnostics.filter(x => x.severity === 'error')).toEqual([])
  })

  it('groups identical parts in the cut list with grain and edge notation', () => {
    const rows = cutlist(m, d.materials)
    const sides = rows.find(r => r.labels.includes('Left side'))!
    expect(sides.quantity).toBe(2)
    expect(sides.length).toBe(p.height - 18) // top sits over the sides
    expect(sides.width).toBe(p.depth - 3) // applied back
    expect(sides.edgesL).toBe(1) // front edge runs along the length
    expect(sides.edgesW).toBe(0)
    const fronts = rows.find(r => r.labels.includes('Drawer front'))!
    expect(fronts.edgesL + fronts.edgesW).toBe(4)
  })
})

describe('splits and fronts', () => {
  it('sideboard: fronts across dividers keep the same 3 mm gap', () => {
    const d = byTemplate('sideboard')
    const m = buildModel(d)
    const fronts = [...role(m.panels, 'door'), ...role(m.panels, 'drawer-front')]
    const doors = role(m.panels, 'door').sort((a, b) => a.box.x - b.box.x)
    const drawer = role(m.panels, 'drawer-front')[0]
    expect(drawer.box.x - (doors[0].box.x + doors[0].box.w)).toBe(3)
    expect(doors[1].box.x - (drawer.box.x + drawer.box.w)).toBe(3)
    expect(doors[0].box.x).toBe(1)
    expect(doors[1].box.x + doors[1].box.w).toBe(cab(d).width - 1)
    for (const f of fronts) expect(f.box.z).toBe(cab(d).depth)
    expect(hasErrors(m)).toBe(false)
  })

  it('doors over drawers turn them into internal drawers instead of colliding', () => {
    const d = byTemplate('chest')
    const p = cab(d)
    const withDoors = withCab(d, { interior: { ...p.interior, front: { kind: 'doors', count: 2 } } })
    const m = buildModel(withDoors)
    expect(role(m.panels, 'drawer-front')).toHaveLength(0)
    expect(role(m.panels, 'door')).toHaveLength(2)
    expect(m.diagnostics.filter(x => x.severity === 'error')).toEqual([])
    expect(m.diagnostics.some(x => x.code === 'internal-drawers')).toBe(true)
  })

  it('doors inside doors are reported', () => {
    const d = byTemplate('wardrobe')
    const p = cab(d)
    if (p.interior.kind !== 'split') throw Error()
    const inner = p.interior.children[1]
    const bad = withCab(d, { interior: mapSpace(p.interior, inner.id, s => ({ ...s, front: { kind: 'doors', count: 1 } })) })
    const codes = errors(bad).map(e => e.code)
    expect(codes).toContain('doors-behind-doors')
    expect(codes).toContain('overlap')
  })

  it('splitting and changing kinds keeps a valid, buildable tree', () => {
    const d = byTemplate('bookcase')
    const p = cab(d)
    const split = splitSpace(p.interior, 'x', 3)
    const d2 = withCab(d, { interior: split })
    expect(validateDesign(d2)).toEqual([])
    expect(errors(d2)).toEqual([])
    expect(role(buildModel(d2).panels, 'divider')).toHaveLength(2)
    if (split.kind !== 'split') throw Error()
    const d3 = withCab(d2, { interior: mapSpace(split, split.children[1].id, s => changeKind(s, 'drawers')) })
    expect(errors(withCab(d3, { depth: 450 }))).toEqual([])
  })

  it('reports fixed split sizes that do not fit', () => {
    const d = byTemplate('sideboard')
    const p = cab(d)
    if (p.interior.kind !== 'split') throw Error()
    const bad = withCab(d, { width: 500 })
    expect(errors(bad).map(e => e.code)).toContain('split-fit')
  })

  it('reports drawers too deep for any runner', () => {
    expect(errors(withCab(byTemplate('chest'), { depth: 200 })).map(e => e.code)).toContain('runner-fit')
  })

  it('reports a cabinet too small for its panels', () => {
    expect(errors(withCab(byTemplate('chest'), { width: 40 })).map(e => e.code)).toContain('carcass-too-small')
  })
})

describe('cut dimensions', () => {
  it('length follows grain on grained boards and the long side otherwise', () => {
    const p: Panel = { id: 'a', nodeId: 'n', role: 'side', label: 'Side', materialId: 'm', box: { x: 0, y: 0, z: 0, w: 18, h: 300, d: 500 }, thicknessAxis: 'x', grainAxis: 'y', banded: ['+z'] }
    expect(cutDimensions(p, true)).toMatchObject({ length: 300, width: 500, edgesL: 1, edgesW: 0 })
    expect(cutDimensions(p, false)).toMatchObject({ length: 500, width: 300, edgesL: 0, edgesW: 1 })
  })
})

describe('desk', () => {
  it('pedestal desk reuses the cabinet generator and leaves knee space', () => {
    const d = byTemplate('desk-pedestal')
    const m = buildModel(d)
    expect(hasErrors(m)).toBe(false)
    expect(role(m.panels, 'worktop')).toHaveLength(1)
    expect(role(m.panels, 'drawer-front')).toHaveLength(3)
    expect(role(m.panels, 'gable')).toHaveLength(1)
    expect(m.panels.every(p => p.nodeId === d.product.id)).toBe(true)
    const top = role(m.panels, 'worktop')[0]
    for (const p of m.panels) if (p !== top) expect(p.box.y + p.box.h).toBeLessThanOrEqual(top.box.y)
  })
  it('two pedestals too wide for the desk is an error', () => {
    const d = byTemplate('desk-pedestal')
    if (d.product.kind !== 'desk') throw Error()
    const bad: Design = { ...d, product: { ...d.product, params: { ...d.product.params, support: 'two-pedestals', width: 800 } } }
    expect(errors(bad).map(e => e.code)).toContain('no-knee-space')
  })
})

describe('document validation', () => {
  it('rejects non-integer sizes, unknown materials and duplicate ids', () => {
    const d = byTemplate('chest')
    expect(validateDesign(withCab(d, { width: 800.5 }))).toContain('width must be a whole number of mm')
    expect(validateDesign(withCab(d, { bodyMaterialId: 'nope' }))).toContain('bodyMaterialId refers to an unknown material')
    const p = cab(d)
    const dup = withCab(d, { interior: { id: 'x', kind: 'split', axis: 'x', sizes: [{ mode: 'fr', value: 1 }, { mode: 'fr', value: 1 }], children: [{ id: 'y', kind: 'empty' }, { id: 'y', kind: 'empty' }] } })
    expect(validateDesign(dup).some(e => e.startsWith('Duplicate space id'))).toBe(true)
    expect(p).toBeTruthy()
  })
})

describe('regressions from independent review', () => {
  it('rejects absurd counts before building (no crash)', () => {
    const d = withCab(byTemplate('chest'), { interior: { id: 'a', kind: 'drawers', count: 2 ** 32 } })
    expect(validateDesign(d)).toContain('Invalid drawer count')
    expect(() => buildModel(d)).not.toThrow()
    expect(errors(d).map(e => e.code)).toContain('drawer-count')
    const tooMany = withCab(byTemplate('chest'), { interior: { id: 'a', kind: 'drawers', count: 15 } })
    expect(errors(tooMany).map(e => e.code)).toContain('drawer-low')
  })
  it('warns when fixed split sizes do not add up', () => {
    const d = withCab(byTemplate('chest'), { interior: { id: 'a', kind: 'split', axis: 'x', sizes: [{ mode: 'mm', value: 200 }, { mode: 'mm', value: 200 }], children: [{ id: 'b', kind: 'empty' }, { id: 'c', kind: 'empty' }] } })
    expect(buildModel(d).diagnostics.map(x => x.code)).toContain('split-resized')
  })
  it('warns when desk drawer fronts stand proud of the worktop', () => {
    const d = byTemplate('desk-pedestal')
    if (d.product.kind !== 'desk') throw Error()
    const bad: Design = { ...d, product: { ...d.product, params: { ...d.product.params, frontOverhang: 0 } } }
    expect(buildModel(bad).diagnostics.map(x => x.code)).toContain('fronts-proud')
  })
  it('keeps separate hinge lines for doors of different heights', () => {
    const d = withCab(byTemplate('wardrobe'), {
      width: 1000, height: 2000,
      interior: { id: 'r', kind: 'split', axis: 'x', sizes: [{ mode: 'fr', value: 1 }, { mode: 'fr', value: 1 }], children: [
        { id: 'a', kind: 'shelves', count: 4, front: { kind: 'doors', count: 1 } },
        { id: 'b', kind: 'split', axis: 'y', sizes: [{ mode: 'fr', value: 1 }, { mode: 'fr', value: 1 }], children: [
          { id: 'c', kind: 'shelves', count: 1, front: { kind: 'doors', count: 1 } },
          { id: 'e', kind: 'shelves', count: 1, front: { kind: 'doors', count: 1 } }] }] },
    })
    const hinges = hardwareSummary(buildModel(d)).filter(h => h.kind === 'hinge')
    expect(hinges.length).toBe(2)
    expect(hinges.reduce((n, h) => n + h.quantity, 0)).toBe(4 + 3 + 3)
  })
  it('internal drawers keep clear of the doors', () => {
    const d = byTemplate('chest')
    const p = cab(d)
    const m = buildModel(withCab(d, { shelfSetback: 0, interior: { ...p.interior, front: { kind: 'doors', count: 1 } } }))
    const maxZ = Math.max(...m.panels.filter(x => x.role.startsWith('drawer')).map(x => x.box.z + x.box.d))
    expect(maxZ).toBeLessThanOrEqual(p.depth - 20)
  })
  it('a desk with no usable knee space is an error', () => {
    const d = byTemplate('desk-pedestal')
    if (d.product.kind !== 'desk') throw Error()
    const bad: Design = { ...d, product: { ...d.product, params: { ...d.product.params, support: 'two-pedestals', width: 900, pedestal: { width: 440, drawerCount: 3 } } } }
    expect(errors(bad).map(e => e.code)).toContain('knee-narrow')
  })
})
