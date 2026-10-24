import { describe, expect, it } from 'vitest'
import { applyFinish, finishTargets, projectBoards, roleBoard } from '../src/core/finish'
import { templates } from '../src/core/design'
import { makeItem, materialKey, newProject, projectCutlist, suggestRunParts, type Project } from '../src/core/project'
import { catalogFamilies, insertVariant } from '../src/core/catalog'

const t = (id: string) => templates.find(x => x.id === id)!.create()
const bed = () => { const f = catalogFamilies.find(x => x.id === 'bed')!; return insertVariant(f, f.variants[0])! }
function room(): Project {
  let p = newProject('Finish')
  for (const d of [t('base-door'), t('base-door'), t('wardrobe'), bed()]) p = { ...p, items: [...p.items, makeItem(p, d)] }
  // The wardrobe and bed stand apart from the run of two base units.
  return { ...p, items: p.items.map((it, i) => (i >= 2 ? { ...it, position: { ...it.position, x: it.position.x + 500 } } : it)) }
}
const front = (p: Project, i: number) => { const d = p.items[i].design; return d.materials.find(m => m.id === roleBoard(d, 'front'))! }

describe('finish scope (ADR-0052)', () => {
  it('whole project sets every front and skips a piece without fronts, with the reason', () => {
    const p = room()
    const oak = projectBoards(p).find(m => /oak/i.test(m.name)) ?? { id: 'x', name: 'Oak test', thickness: 18, grain: true, color: '#aa8855' }
    const r = applyFinish(p, p.items[0].id, 'front', oak, 'project')
    expect(r.applied).toHaveLength(3)
    expect(r.skipped.join()).toMatch(/has no fronts/)
    for (const i of [0, 1, 2]) expect(materialKey(front(r.project, i))).toBe(materialKey(oak))
    expect(r.project.items[3]).toBe(p.items[3])
  })
  it('run scope changes only the run; fillers and covers follow, the worktop does not', () => {
    const p0 = room()
    const p = { ...p0, runParts: suggestRunParts(p0) }
    expect(finishTargets(p, p.items[0].id, 'run').map(i => i.id)).toEqual([p.items[0].id, p.items[1].id])
    const blue = { id: 'b', name: 'MDF blue', thickness: 18, grain: false, color: '#3355aa' }
    const r = applyFinish(p, p.items[1].id, 'front', blue, 'run')
    expect(front(r.project, 0).name).toBe('MDF blue')
    expect(front(r.project, 2).name).toBe(front(p, 2).name)
    for (const rp of r.project.runParts!) expect(rp.material.name === 'MDF blue').toBe(rp.kind === 'cover' || rp.kind === 'filler')
    expect(projectCutlist(r.project).some(row => row.materialName === 'MDF blue')).toBe(true)
  })
  it('carcass scope sets the body board; the same board is reused, not duplicated', () => {
    const p = room()
    const b = front(p, 0)
    const r = applyFinish(p, p.items[0].id, 'body', b, 'piece')
    const d = r.project.items[0].design
    expect(d.materials.length).toBe(p.items[0].design.materials.length)
    expect(roleBoard(d, 'body')).toBe(b.id)
  })
})
