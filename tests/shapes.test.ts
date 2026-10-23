import { describe, expect, it } from 'vitest'
import { cutDimensions } from '../src/core/geometry'
import { drillingText } from '../src/core/cutlist'
import { aabbOf, panelsOverlap, shapeProblems, solidOf, turnPoint, turnShape, type V3 } from '../src/core/shape'
import { rotateBox } from '../src/core/project'
import type { Box, Panel, PanelShape } from '../src/core/types'

const panel = (box: Box, shape?: PanelShape, t: Panel['thicknessAxis'] = 'z'): Panel =>
  ({ id: 'p', nodeId: 'n', role: 'seat', label: 'Part', materialId: 'm', box, thicknessAxis: t, grainAxis: 'y', banded: [], ...(shape ? { shape } : {}) })
const b = (x: number, y: number, z: number, w: number, h: number, d: number): Box => ({ x, y, z, w, h, d })

describe('shaped parts core (ADR-0040)', () => {
  // A 20 mm board 1000 high, leaning back 10° about its bottom-back edge (top towards −z).
  const back = panel(b(0, 0, 100, 400, 1000, 20), { kind: 'tilt', axis: 'x', angleDeg: -10, pivot: [0, 0, 0] })

  it('a tilted board is cut at its blank size; placement only', () => {
    expect(cutDimensions(back, true)).toMatchObject({ length: 1000, width: 400, thickness: 20 })
    expect(drillingText(back)).toBe('')
  })

  it('bounds cover the tilted solid in whole mm', () => {
    const a = aabbOf(back)
    // Top edge moves back by 1000·sin 10° ≈ 173.6 mm; height drops to ≈ 988 + the board's own rotation.
    expect(a.z).toBe(Math.floor(100 - 1000 * Math.sin(Math.PI / 18)))
    expect(a.y).toBe(0)
    expect(a.h).toBe(Math.ceil(1000 * Math.cos(Math.PI / 18) + 20 * Math.sin(Math.PI / 18)))
  })

  it('overlaps: the leaning board hits a box behind its top, not one in front of it; touching plain boxes never overlap', () => {
    expect(panelsOverlap(back, panel(b(0, 900, -100, 400, 50, 50)))).toBe(true)
    expect(panelsOverlap(back, panel(b(0, 900, 0, 400, 50, 60)))).toBe(false) // where the upright board would have been
    expect(panelsOverlap(back, panel(b(0, 0, 120, 400, 1000, 20)))).toBe(false)
    expect(panelsOverlap(panel(b(0, 0, 0, 10, 10, 10)), panel(b(10, 0, 0, 10, 10, 10)))).toBe(false)
    expect(panelsOverlap(panel(b(0, 0, 0, 10, 10, 10)), panel(b(9, 0, 0, 10, 10, 10)))).toBe(true)
  })

  it('a profile overlaps by its outline: a diagonal cut leaves the corner free', () => {
    // Pentagon-shaped shelf: 500 × 500 blank with the front-right corner cut off diagonally.
    const shelf = panel(b(0, 0, 0, 500, 18, 500), { kind: 'profile', points: [[0, 0], [500, 0], [500, 300], [300, 500], [0, 500]] }, 'y')
    expect(panelsOverlap(shelf, panel(b(460, 0, 460, 40, 18, 40)))).toBe(false)
    expect(panelsOverlap(shelf, panel(b(400, 0, 300, 40, 18, 40)))).toBe(true)
    expect(drillingText(shelf)).toBe('cut to template (5 points)')
  })

  it('shape problems are reported, never thrown', () => {
    const tilt = (angleDeg: number) => shapeProblems(panel(b(0, 0, 0, 10, 100, 10), { kind: 'tilt', axis: 'x', angleDeg, pivot: [0, 0, 0] }))
    expect(tilt(0)).toHaveLength(1)
    expect(tilt(90)).toHaveLength(1)
    expect(tilt(4.5)).toHaveLength(1)
    expect(tilt(-80)).toEqual([])
    const prof = (points: [number, number][]) => shapeProblems(panel(b(0, 0, 0, 100, 18, 100), { kind: 'profile', points }, 'y'))
    expect(prof([[0, 0], [101, 0], [0, 100]])[0]).toMatch(/inside its 100 × 100 mm blank/)
    expect(prof([[0, 0], [50, 50], [100, 100]])[0]).toMatch(/no area/)
    expect(prof([[0, 0], [100, 0]])[0]).toMatch(/at least 3 points/)
  })

  it('a quarter turn of a piece turns its shaped parts exactly like their solids', () => {
    const shelf = panel(b(10, 0, 20, 500, 18, 400), { kind: 'profile', points: [[0, 0], [500, 0], [500, 200], [300, 400], [0, 400]] }, 'y')
    const swap = (a: Panel['thicknessAxis'], r: number) => (r % 180 === 0 ? a : a === 'x' ? 'z' : a === 'z' ? 'x' : 'y')
    const key = (v: V3) => v.map(c => Math.round(c * 1000) / 1000).join(',')
    for (const p of [back, shelf, panel(b(5, 0, 7, 20, 300, 400), { kind: 'tilt', axis: 'z', angleDeg: 30, pivot: [20, 0, 0] }, 'x')]) {
      for (const r of [90, 180, 270] as const) {
        const box = rotateBox(p.box, r)
        const turned: Panel = { ...p, box, thicknessAxis: swap(p.thicknessAxis, r), shape: turnShape(p.shape!, p.box, box, p.thicknessAxis, swap(p.thicknessAxis, r), r) }
        expect(new Set(solidOf(turned).vertices.map(key))).toEqual(new Set(solidOf(p).vertices.map(v => key(turnPoint(v, r)))))
      }
    }
  })
})

import { buildModel } from '../src/core/build'
import { catalogFamilies, insertVariant } from '../src/core/catalog'
import { cornerDefaults, frameDefaults, wrap } from '../src/core/design'
import { cutlist } from '../src/core/cutlist'
import { buildProjectModel, newProject } from '../src/core/project'
import { profileTemplates } from '../src/core/template'
import type { CornerParams, Design, FrameParams } from '../src/core/types'

const frame = (over: Partial<FrameParams>, kind: FrameParams['kind'] = 'chair'): Design => wrap('f', { kind: 'frame', id: 'F', params: { ...frameDefaults(kind), ...over } })
const item = (id: string): Design => { const f = catalogFamilies.find(x => x.variants.some(v => v.id === id))!; return insertVariant(f, f.variants.find(v => v.id === id)!, '')! }
const errors = (d: Design) => buildModel(d).diagnostics.filter(x => x.severity === 'error').map(x => x.message)

describe('first users of shaped parts (ADR-0040)', () => {
  it('a raked chair back leans as one piece about the seat frame; cut sizes stay the straight lengths; no rake = no shapes', () => {
    const d = frame({})
    const m = buildModel(d)
    expect(errors(d)).toEqual([])
    const tilted = m.panels.filter(p => p.shape?.kind === 'tilt')
    expect(tilted.map(p => p.label).sort()).toEqual(['Back post left', 'Back post right', 'Back rail bottom', 'Back rail top', ...Array(tilted.length - 4).fill('Back slat')].sort())
    expect(new Set(tilted.map(p => (p.shape?.kind === 'tilt' ? `${p.shape.axis}${p.shape.angleDeg}` : '')))).toEqual(new Set(['x-8']))
    const post = tilted.find(p => p.label === 'Back post left')!
    expect(cutlist(m, d.materials).find(r => r.labels.includes('Back post left'))!.length).toBe(post.box.h)
    const upright = frame({ back: { ...frameDefaults('chair').back!, angleDeg: undefined } })
    expect(buildModel(upright).panels.some(p => p.shape)).toBe(false)
    expect(buildModel(upright).panels.find(p => p.label === 'Back post left')!.box.h).toBe(880)
  })

  it('reclining positions 100° / 120° / 150° set the rake; the footrest hangs, swings to 45° and lies level', () => {
    const base = item('recliner-reference')
    const at = (i: number) => { const d = structuredClone(base); if (d.product.kind === 'frame') d.product.params.recline!.at = i; return buildModel(d) }
    const rakes = [0, 1, 2].map(i => at(i).panels.find(p => p.label === 'Back post left')!.shape)
    expect(rakes.map(s => s?.kind === 'tilt' && s.angleDeg)).toEqual([-10, -30, -60])
    const foot = [0, 1, 2].map(i => at(i).panels.find(p => p.label === 'Footrest')!)
    expect(foot[0].shape).toBeUndefined()
    expect(foot[0].thicknessAxis).toBe('z')
    expect(foot[1].shape).toMatchObject({ kind: 'tilt', axis: 'x', angleDeg: -45 })
    expect(foot[2].thicknessAxis).toBe('y')
    for (const i of [0, 1, 2]) expect(at(i).diagnostics.filter(x => x.severity === 'error')).toEqual([])
    expect(at(0).hardware.some(h => h.label.startsWith('Reclining mechanism (positions 100°, 120°, 150°)'))).toBe(true)
  })

  it('a lounger backrest lifts about its hinge: 80°, 60° and 30° from flat for 100°, 120°, 150°', () => {
    const base = item('lounger-reference')
    for (const [i, lift] of [[0, 80], [1, 60], [2, 30]]) {
      const d = structuredClone(base); if (d.product.kind === 'frame') d.product.params.backrest!.at = i
      const m = buildModel(d)
      expect(m.diagnostics.filter(x => x.severity === 'error')).toEqual([])
      const slat = m.panels.find(p => p.label === 'Backrest slat')!
      expect(slat.shape).toMatchObject({ kind: 'tilt', axis: 'z', angleDeg: -lift })
    }
  })

  it('arm rests stand on the seat and run back to the posts; too low is an error', () => {
    const d = item('garden-bench-back')
    expect(errors(d)).toEqual([])
    expect(buildModel(d).panels.filter(p => p.label.startsWith('Arm')).length).toBe(4)
    expect(errors(frame({ arms: { height: 480 } }))[0]).toMatch(/too close to the 460 mm seat/)
  })

  it('a chair on a bought base is two boards and a scheduled base', () => {
    const m = buildModel(item('office-chair-reference'))
    expect(m.panels.map(p => p.label)).toEqual(['Seat', 'Back panel'])
    expect(m.hardware.map(h => h.label)).toEqual(expect.arrayContaining(['Gas lift, synchro mechanism and five-star base', 'Back support bar (joins seat and back)']))
    expect(m.diagnostics.map(x => x.code)).toContain('bought-base')
  })

  it('a diagonal corner: five-sided boards, doors at 45°, a mirror image on the right', () => {
    const mk = (side: 'left' | 'right', count: 1 | 2): Design => wrap('c', { kind: 'corner', id: 'C', params: { ...cornerDefaults('diagonal'), side, height: 820, plinthHeight: 100,
      interior: { id: 'i', kind: 'shelves', count: 1, front: { kind: 'doors', count } } } as CornerParams })
    for (const count of [1, 2] as const) {
      const [l, r] = [buildModel(mk('left', count)), buildModel(mk('right', count))]
      expect(l.diagnostics.filter(x => x.severity === 'error')).toEqual([])
      expect(r.diagnostics.filter(x => x.severity === 'error')).toEqual([])
      expect(l.panels.filter(p => p.shape?.kind === 'profile').map(p => p.label)).toEqual(['Bottom', 'Top', 'Shelf'])
      expect(l.panels.filter(p => p.role === 'door').map(p => p.shape)).toEqual(Array(count).fill({ kind: 'tilt', axis: 'y', angleDeg: 45, pivot: [0, 0, 0] }))
      // Mirror image: same size, bounds reflected about the unit's width.
      expect([r.bounds.w, r.bounds.h, r.bounds.d]).toEqual([l.bounds.w, l.bounds.h, l.bounds.d])
      expect(r.bounds.x).toBe(900 - (l.bounds.x + l.bounds.w))
    }
    // The cut list lists the five-sided boards at their blank size, cut to template.
    const d = mk('left', 1)
    const rows = cutlist(buildModel(d), d.materials).filter(x => x.drilling.includes('cut to template'))
    expect(rows.map(x => [x.length, x.width, x.quantity])).toEqual([[879, 879, 3]])
    const tp = profileTemplates(buildModel(d).panels)
    expect(tp).toHaveLength(1)
    expect(tp[0]).toMatchObject({ quantity: 3, w: 879, h: 879, cols: 5, rows: 4 })
    expect(tp[0].tiles).toHaveLength(20)
  })

  it('a U-cut sink drawer: the bottom is cut to a U, the back runs round the notch; a notch that does not fit is an error', () => {
    const d = item('sink-u-drawer')
    const m = buildModel(d)
    expect(m.diagnostics.filter(x => x.severity === 'error')).toEqual([])
    const bottom = m.panels.find(p => p.label === 'Drawer 1 bottom')!
    expect(bottom.shape?.kind === 'profile' && bottom.shape.points.length).toBe(8)
    expect(m.panels.filter(p => /^Drawer 1 (back|trap)/.test(p.label)).map(p => p.label)).toEqual(['Drawer 1 back left', 'Drawer 1 back right', 'Drawer 1 trap side', 'Drawer 1 trap side', 'Drawer 1 trap front'])
    expect(m.panels.find(p => p.label === 'Drawer 2 bottom')!.shape).toBeUndefined()
    const big = structuredClone(d)
    if (big.product.kind === 'cabinet' && big.product.params.interior.kind === 'drawers') big.product.params.interior.uCut = { width: 700, depth: 200 }
    expect(errors(big)[0]).toMatch(/notch does not fit/)
  })

  it('shaped pieces turned in a project keep their shapes and stay clear of each other', () => {
    const p = newProject()
    const items = ['recliner-reference', 'corner-diagonal', 'sink-u-drawer'].map((id, i) => ({
      id: `it${i}`, design: item(id), quantity: 1, position: { x: i * 2500, y: 0, z: 0 }, rotationY: ([90, 180, 270] as const)[i], placement: { kind: 'floor' as const },
    }))
    const pm = buildProjectModel({ ...p, items })
    expect(pm.model.diagnostics.filter(x => x.severity === 'error')).toEqual([])
    for (const pc of pm.pieces) expect(pc.panels.filter(q => q.shape).length).toBe(pc.model.panels.filter(q => q.shape).length)
  })

  it('every catalog item that waited only for shapes now opens and builds', () => {
    for (const id of ['garden-bench-back', 'recliner-reference', 'office-chair-reference', 'lounger-reference', 'sink-u-drawer', 'corner-diagonal']) expect(errors(item(id)), id).toEqual([])
  })
})

