import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { templates } from '../src/core/design'
import { newProject } from '../src/core/project'
import { useDesign } from '../src/store/designStore'

const t = (id: string) => templates.find(x => x.id === id)!.create()
const st = () => useDesign.getState()

describe('project undo/redo (ADR-0050)', () => {
  beforeEach(() => {
    st().openProject(newProject('Undo'))
    st().addPiece(t('base-door'))
    st().addPiece(t('base-door'))
  })
  it('each action is one step; undo returns the identical project, redo the changed one', () => {
    const before = st().project!
    const id = before.items[1].id
    st().updateItem(id, { position: { ...before.items[1].position, x: 2000 } })
    const after = st().project!
    st().undo()
    expect(st().project).toBe(before)
    st().redo()
    expect(st().project).toBe(after)
    st().removeItem(before.items[0].id)
    expect(st().project!.items).toHaveLength(1)
    st().undo()
    expect(st().project!.items).toHaveLength(2)
  })
  it('a gap that moves the pieces on the right, a merge and run-part suggestions are one step each', () => {
    st().addPiece(t('base-door'))
    const p0 = st().project!
    st().setGap(p0.items[1].id, 100, true)
    expect(st().project!.items[2].position.x).toBe(p0.items[2].position.x + 100)
    st().undo()
    expect(st().project).toBe(p0)
    const issues = st().mergeItems(p0.items[0].id, p0.items[1].id)
    expect(issues).toEqual([])
    expect(st().project!.items).toHaveLength(2)
    st().undo()
    expect(st().project).toBe(p0)
  })
  it('a new action clears redo; a piece edited in the project is one project step', () => {
    const p0 = st().project!
    st().updateItem(p0.items[0].id, { quantity: 3 })
    st().undo()
    st().updateItem(p0.items[0].id, { quantity: 2 })
    expect(st().projectFuture).toEqual([])
    const p1 = st().project!
    st().editItem(p1.items[0].id)
    st().updateCabinet({ width: 500 })
    st().updateCabinet({ width: 450 })
    st().backToProject()
    const prod = st().project!.items[0].design.product
    expect(prod.kind === 'cabinet' ? prod.params.width : 0).toBe(450)
    st().undo()
    expect(st().project!.items[0].design).toBe(p1.items[0].design)
  })
  it('opening another project clears the history', () => {
    st().openProject(newProject('Other'))
    expect(st().projectPast).toEqual([])
    st().undo()
    expect(st().project!.name).toBe('Other')
  })
})

describe('tap the plan to place (ADR-0053)', () => {
  it('an added piece waits to be placed; a plan point sets its left-back corner in whole mm, one undo step', () => {
    st().openProject(newProject('Place'))
    st().addPiece(t('base-door'))
    st().addPiece(t('chest'))
    const id = st().placingItemId!
    expect(id).toBe(st().project!.items[1].id)
    const before = st().project!
    st().placeAt(1234.4, 456.6)
    const it = st().project!.items[1]
    expect(it.position).toEqual({ x: 1234, y: 0, z: 457 })
    expect(st().placingItemId).toBeNull()
    st().undo()
    expect(st().project).toBe(before)
    st().addPiece(t('wall-cabinet'))
    st().placeAt(-50, -10)
    const w = st().project!.items[2]
    expect([w.position.x, w.position.z, w.position.y]).toEqual([0, 0, 1450])
  })
})
