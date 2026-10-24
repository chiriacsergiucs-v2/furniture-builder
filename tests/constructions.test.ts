import { describe, expect, it } from 'vitest'
import { buildModel } from '../src/core/build'
import { cutlist, lengthsList } from '../src/core/cutlist'
import { cabinet, cabinetDefaults, frameDefaults, newId, panelDefaults, validateDesign, wrap } from '../src/core/design'
import { nestingJobs } from '../src/core/nesting/fromDesign'
import { overlaps } from '../src/core/geometry'
import type { CabinetParams, Design, FrameParams, Space } from '../src/core/types'

const noOverlaps = (d: Design) => {
  const P = buildModel(d).panels
  for (let i = 0; i < P.length; i++) for (let j = i + 1; j < P.length; j++) expect(overlaps(P[i].box, P[j].box), `${P[i].id} × ${P[j].id}`).toBe(false)
}
const errors = (d: Design) => buildModel(d).diagnostics.filter(x => x.severity === 'error')
const codes = (d: Design) => buildModel(d).diagnostics.map(x => x.code)
const cab = (over: Partial<CabinetParams>, interior: Space = { id: 'in', kind: 'shelves', count: 1 }) => cabinet('T', over, interior)
const frame = (kind: FrameParams['kind'], over: Partial<FrameParams> = {}) => wrap('F', { kind: 'frame', id: 'F', params: { ...frameDefaults(kind), ...over } })

describe('kitchen construction flags (ADR-036)', () => {
  it('rails instead of a top: two rails, no top panel, nothing overlaps', () => {
    const d = cab({ width: 800, height: 720, depth: 560, topKind: 'rails', railDepth: 100, back: 'none' })
    const m = buildModel(d)
    expect(m.panels.filter(p => p.role === 'top')).toHaveLength(0)
    const rails = m.panels.filter(p => p.role === 'rail')
    expect(rails).toHaveLength(2)
    expect(rails.every(r => r.box.d === 100)).toBe(true)
    expect(errors(d)).toEqual([])
    noOverlaps(d)
  })
  it('rails too deep for the carcass are an error, never a throw', () => {
    expect(codes(cab({ depth: 300, topKind: 'rails', railDepth: 200 }))).toContain('rail-depth')
  })
  it('no bottom: the opening runs down to the plinth, and a floor unit gets a warning', () => {
    const wall = cab({ mount: 'wall', bottom: 'none', plinthHeight: 0 })
    expect(buildModel(wall).panels.some(p => p.role === 'bottom')).toBe(false)
    expect(buildModel(wall).spaces[0].box.y).toBe(0)
    expect(codes(wall)).not.toContain('no-bottom')
    expect(codes(cab({ bottom: 'none' }))).toContain('no-bottom')
    noOverlaps(wall)
  })
  it('an appliance niche that does not fit is an error; one that fits is scheduled with its entered size', () => {
    const fits = cab({ width: 600, height: 720, depth: 560 }, { id: 'n', kind: 'empty', appliance: { kind: 'oven', w: 560, h: 590, d: 550 } })
    expect(codes(fits)).not.toContain('appliance-fit')
    expect(buildModel(fits).hardware.find(h => h.kind === 'appliance')?.note).toContain('560×590×550')
    const tooBig = cab({ width: 600, height: 720, depth: 560 }, { id: 'n', kind: 'empty', appliance: { kind: 'oven', w: 590, h: 590, d: 550 } })
    expect(codes(tooBig)).toContain('appliance-fit')
  })
  it('a front-only panel is one part with a fixing-kit line and no carcass', () => {
    const d = wrap('DW', { kind: 'panel', id: 'P', params: panelDefaults('dishwasher') })
    const m = buildModel(d)
    expect(m.panels).toHaveLength(1)
    expect(m.hardware.map(h => h.kind)).toContain('front-fixing')
    expect(validateDesign(d)).toEqual([])
    expect(cutlist(m, d.materials)).toHaveLength(1)
  })
})

describe('sliding doors and flaps (ADR-037)', () => {
  const sliding = (count: 2 | 3 | 4, overlap = 30) => cab({ width: 1800, height: 2100, depth: 600 }, { id: 's', kind: 'hanging', railDrop: 60, front: { kind: 'sliding', count, overlap, track: 80 } })
  it('doors cover the front zone exactly with the stated overlaps, in two planes, with no hinges', () => {
    for (const n of [2, 3, 4] as const) {
      const d = sliding(n)
      const m = buildModel(d)
      const doors = m.panels.filter(p => p.role === 'door').sort((a, b) => a.box.x - b.box.x)
      expect(doors).toHaveLength(n)
      const g = d.product.kind === 'cabinet' ? d.product.params.frontGap : 0
      expect(doors[0].box.x).toBe(Math.floor(g / 2))
      expect(doors[n - 1].box.x + doors[n - 1].box.w).toBe(1800 - Math.floor(g / 2))
      for (let i = 1; i < n; i++) expect(doors[i - 1].box.x + doors[i - 1].box.w - doors[i].box.x).toBe(30)
      expect(new Set(doors.map(p => p.box.z)).size).toBe(2)
      expect(m.hardware.some(h => h.kind === 'hinge')).toBe(false)
      expect(m.hardware.find(h => h.kind === 'sliding-track')?.note).toContain('datasheet')
      expect(errors(d)).toEqual([])
      noOverlaps(d)
    }
  })
  it('a track too shallow for two planes is an error', () => {
    const d = cab({}, { id: 's', kind: 'shelves', count: 1, front: { kind: 'sliding', count: 2, track: 20 } })
    expect(codes(d)).toContain('sliding-track')
  })
  it('a flap schedules its stay and warns until the fitting is named', () => {
    const open = cab({ width: 800, height: 400, depth: 320, mount: 'wall' }, { id: 'f', kind: 'shelves', count: 0, front: { kind: 'flap', count: 1, direction: 'up' } })
    expect(codes(open)).toContain('flap-fitting')
    expect(buildModel(open).hardware.some(h => h.kind === 'flap-stay')).toBe(true)
    const named = cab({ width: 800, height: 400, depth: 320, mount: 'wall' }, { id: 'f', kind: 'shelves', count: 0, front: { kind: 'flap', count: 1, direction: 'up', fitting: 'My lift system' } })
    expect(codes(named)).not.toContain('flap-fitting')
  })
  it('validation accepts the new fronts and rejects nonsense', () => {
    expect(validateDesign(sliding(3))).toEqual([])
    const bad = cab({}, { id: 'x', kind: 'shelves', count: 1, front: { kind: 'sliding', count: 7 } as never })
    expect(validateDesign(bad)).toContain('Invalid doors')
  })
})

describe('frame root and solid stock (ADR-038)', () => {
  it('every frame kind builds without errors or overlaps at its default size', () => {
    for (const k of ['table', 'bench', 'stool', 'chair', 'bed'] as const) {
      const d = frame(k)
      expect(validateDesign(d), k).toEqual([])
      expect(errors(d), k).toEqual([])
      noOverlaps(d)
    }
  })
  it('a wide bed gets a centre rail on legs; a narrow one does not', () => {
    const wide = buildModel(frame('bed'))
    expect(wide.panels.some(p => p.label === 'Centre rail')).toBe(true)
    expect(wide.panels.filter(p => p.label === 'Centre leg')).toHaveLength(2)
    const narrow = frame('bed', { bed: { ...frameDefaults('bed').bed!, mattress: { w: 900, l: 2000 } } })
    expect(buildModel(narrow).panels.some(p => p.label === 'Centre rail')).toBe(false)
  })
  it('a bunk bed has two decks, guard rails, a ladder and a permanent safety warning', () => {
    const d = frame('bed', { bed: { ...frameDefaults('bed').bed!, mattress: { w: 900, l: 2000 }, tierGap: 900 } })
    const m = buildModel(d)
    expect(m.panels.filter(p => p.role === 'slat').length).toBeGreaterThan(20)
    expect(m.panels.some(p => p.label === 'Guard rail left')).toBe(true)
    expect(m.panels.some(p => p.role === 'rung')).toBe(true)
    expect(codes(d)).toContain('safety-not-checked')
    expect(errors(d)).toEqual([])
    noOverlaps(d)
  })
  it('solid parts never reach the sheet layout and appear in the lengths list', () => {
    const d = frame('table')
    const m = buildModel(d)
    const { jobs, rows } = nestingJobs(d, m)
    expect(rows.some(r => r.solid)).toBe(true)
    expect(jobs.every(j => d.materials.find(x => x.id === j.materialId)?.stock !== 'solid')).toBe(true)
    const lists = lengthsList(rows, id => d.materials.find(x => x.id === id)?.lengths ?? [2400], 4)
    const legs = rows.filter(r => r.solid).reduce((n, r) => n + r.quantity, 0)
    expect(lists.reduce((n, g) => n + g.bars.reduce((k, b) => k + b.parts.length, 0) + g.tooLong.length, 0)).toBe(legs)
    for (const g of lists) for (const b of g.bars) expect(b.parts.reduce((s, p) => s + p.length, 0) + (b.parts.length - 1) * 4 + b.waste).toBe(b.stock)
  })
  it('a part longer than any stocked length is reported, not dropped', () => {
    const d = frame('table', { width: 2800 })
    const { rows } = nestingJobs(d, buildModel(d))
    const lists = lengthsList(rows, () => [2400], 4)
    expect(lists.some(g => g.tooLong.length > 0)).toBe(true)
  })
  it('a slatted top without rails is an error, never a throw', () => {
    expect(codes(frame('bench', { top: 'slats', apron: { height: 0, thickness: 22 } }))).toContain('slats-need-rails')
  })
})

describe('rules registry (ADR-035)', () => {
  it('shelf span warns on a long shelf, scaled by thickness, and stays quiet within the limit', () => {
    expect(codes(cab({ width: 1200 }, { id: 'sh', kind: 'shelves', count: 2 }))).toContain('shelf-span')
    expect(codes(cab({ width: 800 }, { id: 'sh', kind: 'shelves', count: 2 }))).not.toContain('shelf-span')
    const tuned = { ...cab({ width: 1200 }, { id: 'sh', kind: 'shelves', count: 2 }), settings: { rules: { shelfSpan: 1200 } } }
    expect(codes(tuned)).not.toContain('shelf-span')
  })
  it('a wide hinged door warns; the message says typical', () => {
    const d = cab({ width: 800 }, { id: 'dd', kind: 'shelves', count: 1, front: { kind: 'doors', count: 1 } })
    const w = buildModel(d).diagnostics.find(x => x.code === 'door-wide')
    expect(w?.message).toContain('typical')
  })
  it('tall floor storage gets an anti-tip fixing line, wall units do not', () => {
    expect(buildModel(cab({ height: 2000 })).hardware.some(h => h.kind === 'wall-fixing')).toBe(true)
    expect(buildModel(cab({ height: 2000, mount: 'wall' })).hardware.some(h => h.kind === 'wall-fixing')).toBe(false)
    expect(buildModel(cab({ height: 900 })).hardware.some(h => h.kind === 'wall-fixing')).toBe(false)
  })
  it('tilt-up runs only when a room height is set', () => {
    const tall = cab({ height: 2400, depth: 600 })
    expect(codes(tall)).not.toContain('tilt-up')
    expect(codes({ ...tall, settings: { rules: { roomHeight: 2450 } } })).toContain('tilt-up')
  })
  it('hardware to choose stays a warning until cleared; rule settings are validated', () => {
    const d = { ...cab({}), catalog: { hardwareToChoose: 'pull-out frame' } }
    expect(codes(d)).toContain('hardware-to-choose')
    expect(validateDesign({ ...cab({}), settings: { rules: { shelfSpan: -3 } } })).toContain('Invalid rule setting shelfSpan')
  })
  it('no rule ever produces an error', () => {
    const d = cab({ width: 3000, height: 2400 }, { id: 'a', kind: 'shelves', count: 3, front: { kind: 'doors', count: 1 } })
    const m = buildModel({ ...d, settings: { rules: { roomHeight: 1000 } }, catalog: { hardwareToChoose: 'x' } })
    const ruleCodes = new Set(['shelf-span', 'door-wide', 'hanging-shallow', 'tilt-up', 'hardware-to-choose', 'slat-gap', 'safety-not-checked', 'frame-span'])
    expect(m.diagnostics.filter(x => ruleCodes.has(x.code)).every(x => x.severity === 'warning')).toBe(true)
  })
})

describe('catalog metadata in the design (ADR-028)', () => {
  const withMeta = (catalog: unknown) => ({ ...cab({}), catalog }) as Design
  it('absent is valid; good metadata is valid; bad values are reported, never thrown', () => {
    expect(validateDesign(cab({}))).toEqual([])
    expect(validateDesign(withMeta({ category: 'Wardrobe', origin: { catalogId: 'wardrobe', variantId: 'v1', revision: 1, productName: 'Wardrobe', takenAt: '2026-10-23T00:00:00Z' } }))).toEqual([])
    expect(validateDesign(withMeta({ origin: { catalogId: 'x', revision: 1.5, productName: 'X', takenAt: 't' } }))).toContain('Invalid catalog origin')
    expect(validateDesign(withMeta({ origin: { catalogId: 'x', revision: 1, productName: 'X', takenAt: 't', sourceUrl: 'javascript:alert(1)' } }))).toContain('Catalog source link must be an http(s) address')
    expect(validateDesign(withMeta('nope'))).toContain('Invalid catalog metadata')
  })
  it('every existing default still validates unchanged', () => {
    expect(validateDesign(cabinet('X', {}, { id: newId(), kind: 'empty' }))).toEqual([])
    expect(validateDesign(wrap('C', { kind: 'cabinet', id: 'c', params: cabinetDefaults({ id: 'i', kind: 'empty' }) }))).toEqual([])
  })
})
