import { describe, expect, it } from 'vitest'
import { buildModel } from '../src/core/build'
import { templates } from '../src/core/design'
import { explode } from '../src/core/explode'
import { overlaps, union } from '../src/core/geometry'
import { buildProjectModel, leftNeighbour, makeItem, newProject, setGapLeft, type Project } from '../src/core/project'
import type { Panel } from '../src/core/types'

const t = (id: string) => templates.find(x => x.id === id)!.create()
function noOverlaps(ps: Panel[]) {
  for (let a = 0; a < ps.length; a++) for (let b = a + 1; b < ps.length; b++) expect(overlaps(ps[a].box, ps[b].box), `${ps[a].id} / ${ps[b].id}`).toBe(false)
}
function run(ids: string[]): Project {
  let p = newProject('Run')
  for (const id of ids) p = { ...p, items: [...p.items, makeItem(p, t(id))] }
  return p
}

describe('exploded view', () => {
  it('moves panels apart without resizing them, keeps whole mm, stays on the floor, never overlaps', () => {
    for (const tpl of templates) {
      const m = buildModel(tpl.create())
      const ex = explode([m.panels])
      expect(ex.length).toBe(m.panels.length)
      ex.forEach((p, i) => {
        const b = m.panels[i].box
        expect([p.box.w, p.box.h, p.box.d]).toEqual([b.w, b.h, b.d])
        for (const v of [p.box.x, p.box.y, p.box.z]) expect(Number.isSafeInteger(v)).toBe(true)
      })
      expect(union(ex.map(p => p.box)).y).toBe(m.bounds.y)
      noOverlaps(ex)
      // Touching panels come apart: the exploded piece is bigger than the built one.
      if (m.panels.length > 1) expect(union(ex.map(p => p.box)).w).toBeGreaterThan(m.bounds.w)
    }
  })
  it('never changes the model it is given', () => {
    const m = buildModel(t('sideboard'))
    const before = JSON.stringify(m.panels)
    explode([m.panels])
    expect(JSON.stringify(m.panels)).toBe(before)
  })
  it('spreads a whole project piece by piece without pieces running into each other', () => {
    const pm = buildProjectModel(run(['base-door', 'chest', 'base-door', 'wall-cabinet']))
    const ex = explode(pm.piecePanels)
    expect(ex.length).toBe(pm.model.panels.length)
    noOverlaps(ex)
    expect(union(ex.map(p => p.box)).y).toBe(0)
  })
})

describe('gaps between pieces in a project', () => {
  it('finds the piece on the left in the same run; wall cabinets are a run of their own', () => {
    const p = run(['base-door', 'chest', 'wall-cabinet'])
    expect(leftNeighbour(p, p.items[0].id)).toBeNull()
    expect(leftNeighbour(p, p.items[1].id)).toEqual({ item: p.items[0], gap: 0 })
    expect(leftNeighbour(p, p.items[2].id)).toBeNull() // hangs above the base run
  })
  it('opens a gap and moves the rest of the run with it', () => {
    const p = run(['base-door', 'chest', 'base-door'])
    const next = setGapLeft(p, p.items[1].id, 600)
    expect(leftNeighbour(next, next.items[1].id)!.gap).toBe(600)
    expect(leftNeighbour(next, next.items[2].id)!.gap).toBe(0)
    expect(next.items[2].position.x).toBe(p.items[2].position.x + 600)
    expect(next.items[0]).toEqual(p.items[0])
    expect(buildProjectModel(next).diagnostics).toEqual([])
    // Closing it again restores the run exactly.
    expect(setGapLeft(next, next.items[1].id, 0).items).toEqual(p.items)
  })
  it('can move only the selected piece; a gap that pushes it into the next piece is reported, not thrown', () => {
    const p = run(['base-door', 'chest', 'base-door'])
    const next = setGapLeft(p, p.items[1].id, 100, false)
    expect(next.items[2]).toEqual(p.items[2])
    expect(buildProjectModel(next).diagnostics.map(d => d.code)).toContain('pieces-overlap')
  })
  it('ignores negative, fractional and unknown requests', () => {
    const p = run(['base-door', 'chest'])
    for (const g of [-1, 1.5, Number.NaN]) expect(setGapLeft(p, p.items[1].id, g)).toBe(p)
    expect(setGapLeft(p, 'nope', 10)).toBe(p)
    expect(setGapLeft(p, p.items[0].id, 10)).toBe(p)
  })
})
