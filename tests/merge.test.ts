import { describe, expect, it } from 'vitest'
import { buildModel } from '../src/core/build'
import { templates } from '../src/core/design'
import { mergeCandidates, mergeItems } from '../src/core/merge'
import { buildProjectModel, makeItem, newProject, placeItem, type Project, type QuarterTurn } from '../src/core/project'
import type { CabinetParams } from '../src/core/types'

const t = (id: string) => templates.find(x => x.id === id)!.create()
function run(ids: string[]): Project {
  let p = newProject('Run')
  for (const id of ids) p = { ...p, items: [...p.items, makeItem(p, t(id))] }
  return p
}
const params = (p: Project, i: number) => p.items[i].design.product.params as CabinetParams

describe('merging two pieces of a project (ADR-0047)', () => {
  it('two touching base cabinets become one cabinet with the same footprint and both interiors', () => {
    const p = run(['base-door', 'base-door'])
    const before = buildProjectModel(p)
    const [a, b] = p.items
    expect(mergeCandidates(p, a.id)).toEqual([{ item: b, side: 'right', issues: [] }])
    const { project, mergedId, issues } = mergeItems(p, a.id, b.id)
    expect(issues).toEqual([])
    expect(project.items).toHaveLength(1)
    expect(project.items[0].id).toBe(mergedId)
    const m = params(project, 0)
    expect(m.width).toBe(1200)
    expect(m.interior.kind === 'split' && m.interior.children).toEqual([params(p, 0).interior, params(p, 1).interior])
    const after = buildProjectModel(project)
    expect(after.diagnostics).toEqual([])
    expect(after.model.bounds).toEqual(before.model.bounds)
    // One carcass: three uprights (two sides + one divider) instead of four sides; the divider is centred on the old joint.
    const uprights = buildModel(project.items[0].design).panels.filter(x => x.role === 'side' || x.role === 'divider')
    expect(uprights).toHaveLength(3)
    const div = uprights.find(x => x.role === 'divider')!
    expect(div.box.x + div.box.w / 2).toBe(600)
    for (const x of after.model.panels) for (const k of ['x', 'y', 'z', 'w', 'h', 'd'] as const) expect(Number.isInteger(x.box[k])).toBe(true)
  })
  it('works from either piece and with every quarter turn', () => {
    for (const r of [0, 90, 180, 270] as QuarterTurn[]) {
      let p = run(['base-door', 'sideboard'])
      // Put the two in a turned run, touching, left→right in their own frame.
      const [a, b] = p.items.map(i => ({ ...i, rotationY: r, placement: undefined }))
      const wa = 600, wb = 1600
      const at = (off: number) => (r === 0 ? { x: off, y: 0, z: 0 } : r === 180 ? { x: 4000 - off, y: 0, z: 0 } : r === 90 ? { x: 0, y: 0, z: 4000 - off } : { x: 0, y: 0, z: off })
      const ia = { ...a, position: r === 180 || r === 90 ? at(wa) : at(0) }
      const ib = { ...b, position: r === 180 || r === 90 ? at(wa + wb) : at(wa) }
      // back planes line up only when the depths match: give the sideboard the base cabinet's height and depth.
      const sp = ib.design.product.params as CabinetParams, ap = ia.design.product.params as CabinetParams
      ib.design = { ...ib.design, materials: ia.design.materials, product: { ...ib.design.product, params: { ...ap, width: sp.width, interior: sp.interior } } as typeof ib.design.product }
      p = { ...p, items: [ib, ia] }
      const fromB = mergeCandidates(p, ib.id)
      expect(fromB.map(c => [c.item.id, c.side, c.issues])).toEqual([[ia.id, 'left', []]])
      const before = buildProjectModel(p).model.bounds
      const { project, issues } = mergeItems(p, ib.id, ia.id)
      expect(issues).toEqual([])
      const m = project.items[0]
      expect((m.design.product.params as CabinetParams).width).toBe(2200)
      // the base cabinet (own left) is the first part
      const ip = m.design.product.params as CabinetParams
      expect(ip.interior.kind === 'split' && ip.interior.children[0]).toEqual(ap.interior)
      expect(placeItem(m).bounds).toEqual(before)
    }
  })
  it('refuses with the reasons when the pieces differ, and leaves the project unchanged', () => {
    const p = run(['base-door', 'chest'])
    const [a, b] = p.items
    const c = mergeCandidates(p, a.id)
    expect(c).toHaveLength(1)
    expect(c[0].issues.join(' ')).toMatch(/Different height, depth/)
    const res = mergeItems(p, a.id, b.id)
    expect(res.project).toBe(p)
    expect(res.mergedId).toBeNull()
    expect(res.issues).toEqual(c[0].issues)
  })
  it('only cabinets merge; pieces with a gap are not offered', () => {
    const desk = run(['base-door', 'desk-gables'])
    expect(mergeCandidates(desk, desk.items[0].id)[0].issues[0]).toMatch(/Only two cabinets/)
    const gap = run(['base-door', 'base-door'])
    const moved = { ...gap, items: [gap.items[0], { ...gap.items[1], position: { ...gap.items[1].position, x: 650 } }] }
    expect(mergeCandidates(moved, gap.items[0].id)).toEqual([])
    expect(mergeItems(moved, gap.items[0].id, gap.items[1].id).issues).toEqual(['The two pieces do not touch side by side.'])
    expect(mergeItems(moved, 'nope', 'nada').project).toBe(moved)
  })
  it('different copies, boards or placements are reported', () => {
    const p = run(['base-door', 'base-door'])
    const [a, b] = p.items
    const q = { ...p, items: [a, { ...b, quantity: 2, design: { ...b.design, materials: b.design.materials.map(m => (m.id === 'pal18' ? { ...m, thickness: 16 } : m)) } }] }
    const issues = mergeCandidates(q, a.id)[0].issues.join(' ')
    expect(issues).toMatch(/copies differ/)
    expect(issues).toMatch(/PAL 18 white/)
  })
  it('a wall cabinet resting above either piece now rests on the merged one, in the same place', () => {
    const p = run(['base-door', 'base-door', 'wall-cabinet'])
    const [a, b, w] = p.items
    const onB = { ...p, items: [a, b, { ...w, placement: { kind: 'above' as const, baseId: b.id, gap: 700, offsetX: 0 } }] }
    const before = buildProjectModel(onB).pieces[2].bounds
    const { project, mergedId } = mergeItems(onB, a.id, b.id)
    const wall = project.items.find(i => i.id === w.id)!
    expect(wall.placement).toEqual({ kind: 'above', baseId: mergedId, gap: 700, offsetX: 600 })
    expect(buildProjectModel(project).pieces[1].bounds).toEqual(before)
  })
})
