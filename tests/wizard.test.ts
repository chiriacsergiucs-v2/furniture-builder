import 'fake-indexeddb/auto'
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { buildModel, hasErrors } from '../src/core/build'
import { validateDesign } from '../src/core/design'
import type { Space } from '../src/core/types'
import { check, createPiece, editedSinceWizard, storedAnswers, fieldProblems, nextOpenStep, resolve, stepsWriting, toDesign, visibleFields, visibleSteps } from '../src/core/wizard/engine'
import { CONSTRUCTION_TYPES } from '../src/core/wizard/registry'
import { STEPS, stepById } from '../src/core/wizard/steps'
import { candidatePicks, rankByVariety, suggestions } from '../src/core/wizard/suggest'
import type { Answers } from '../src/core/wizard/types'
import { listDesigns, loadDesign, saveDesign } from '../src/persist/db'

const leaves = (s: Space): Space[] => (s.kind === 'split' ? s.children.flatMap(leaves) : [s])
const cabinetOf = (a: Answers) => { const d = toDesign(a)!; if (d.product.kind !== 'cabinet') throw new Error('not a cabinet'); return d.product.params }

describe('wizard: answers → model input', () => {
  it('every shipped type builds from its defaults without errors and passes design validation', () => {
    for (const t of CONSTRUCTION_TYPES) {
      const c = check({ type: t.id })
      expect(c.errors, `${t.id}: ${c.problems.map(p => p.message).join('; ')}`).toBe(0)
      expect(validateDesign(c.design)).toEqual([])
      expect(c.model!.panels.length).toBeGreaterThan(3)
    }
  })

  it('cabinet: sizes, board, dividers, contents, fronts, base and back reach the cabinet parameters', () => {
    const p = cabinetOf({ type: 'cabinet', width: 1200, height: 800, depth: 500, board: 'pal18oak', dividers: 2,
      compartments: [{ kind: 'drawers', shelves: 0, drawers: 4 }, { kind: 'shelves', shelves: 3, drawers: 1 }, { kind: 'open', shelves: 0, drawers: 1 }],
      fronts: 'per', frontsPer: ['none', 'single', 'pair'], base: 'none', back: 'inset' })
    expect([p.width, p.height, p.depth, p.bodyMaterialId, p.plinthHeight, p.back]).toEqual([1200, 800, 500, 'pal18oak', 0, 'inset'])
    expect(p.interior.kind).toBe('split')
    const kids = (p.interior as Extract<Space, { kind: 'split' }>).children
    expect(kids.map(k => k.kind)).toEqual(['drawers', 'shelves', 'empty'])
    expect(kids.map(k => k.front?.kind === 'doors' ? k.front.count : 0)).toEqual([0, 1, 2])
    expect(kids[0].kind === 'drawers' && kids[0].count).toBe(4)
  })

  it('custom widths become fixed sizes, 0 shares the rest; shelves over drawers is a stacked split', () => {
    const p = cabinetOf({ type: 'cabinet', dividers: 1, spacing: 'custom', widths: [300, 0], compartments: [{ kind: 'shelves-drawers', shelves: 2, drawers: 2 }] })
    const s = p.interior as Extract<Space, { kind: 'split' }>
    expect(s.sizes).toEqual([{ mode: 'mm', value: 300 }, { mode: 'fr', value: 1 }])
    expect(s.children[0].kind === 'split' && s.children[0].axis).toBe('y')
    expect(leaves(p.interior).map(l => l.kind)).toEqual(['shelves', 'drawers', 'shelves', 'drawers'])
  })

  it('whole-piece doors and wall mounting', () => {
    const p = cabinetOf({ type: 'cabinet', dividers: 1, fronts: 'sliding', base: 'wall', mountHeight: 1400 })
    expect(p.interior.front).toEqual({ kind: 'sliding', count: 2 })
    expect([p.mount, p.mountHeight, p.plinthHeight]).toEqual(['wall', 1400, 0])
  })

  it('open shelving has no doors step and only open/shelves contents', () => {
    const a = { type: 'shelving' }
    expect(visibleSteps(a).map(s => s.id)).toEqual(['basics', 'type', 'divisions', 'contents', 'base', 'carcass', 'review'])
    expect(fieldProblems({ ...a, compartments: [{ kind: 'drawers', shelves: 0, drawers: 3 }] }).some(p => p.field === 'compartments')).toBe(true)
    const p = cabinetOf(a)
    expect(p.back).toBe('none')
    expect(leaves(p.interior).every(l => !l.front)).toBe(true)
  })

  it('table, bench and desk answers reach the frame and desk parameters', () => {
    const t = toDesign({ type: 'table', top: 'slats', stretchers: 'h', lowerShelf: 'yes', shelfHeight: 200, legSize: 70, width: 1400 })!
    expect(t.product.kind).toBe('frame')
    if (t.product.kind === 'frame') expect([t.product.params.kind, t.product.params.top, t.product.params.stretchers, t.product.params.shelf, t.product.params.leg, t.product.params.width])
      .toEqual(['table', 'slats', 'h', { height: 200 }, { w: 70, d: 70 }, 1400])
    const b = toDesign({ type: 'bench' })!
    expect(b.product.kind === 'frame' && b.product.params.kind).toBe('bench')
    const d = toDesign({ type: 'desk', support: 'two-pedestals', pedestalDrawers: 4, modesty: 'no' })!
    if (d.product.kind !== 'desk') throw new Error('desk')
    expect([d.product.params.support, d.product.params.pedestal.drawerCount, d.product.params.modesty.enabled]).toEqual(['two-pedestals', 4, false])
    expect(d.product.params.pedestal.left).toMatchObject({ kind: 'drawers', count: 4 })
  })

  it('name and category reach the design (category is catalog metadata)', () => {
    const d = toDesign({ type: 'cabinet', name: 'Hall cupboard', category: 'storage' })!
    expect(d.name).toBe('Hall cupboard')
    expect(d.catalog?.category).toBe('Storage and display')
  })
})

describe('wizard: steps and visibility', () => {
  it('each type sees only its steps; fields show on their predicates', () => {
    expect(visibleSteps({}).map(s => s.id)).toEqual(['basics', 'type', 'review'])
    expect(visibleSteps({ type: 'table' }).map(s => s.id)).toEqual(['basics', 'type', 'frame', 'review'])
    expect(visibleSteps({ type: 'desk' }).map(s => s.id)).toEqual(['basics', 'type', 'desk', 'review'])
    const div = stepById.get('divisions')!
    expect(visibleFields(div, { type: 'cabinet', dividers: 0 }).map(f => f.id)).toEqual(['dividers'])
    expect(visibleFields(div, { type: 'cabinet', dividers: 2, spacing: 'custom' }).map(f => f.id)).toEqual(['dividers', 'spacing', 'widths'])
    expect(visibleFields(stepById.get('base')!, { type: 'cabinet', base: 'wall' }).map(f => f.id)).toEqual(['base', 'mountHeight'])
    expect(visibleFields(stepById.get('fronts')!, { type: 'cabinet', fronts: 'per' }).map(f => f.id)).toEqual(['fronts', 'frontsPer', 'handle'])
    expect(visibleFields(stepById.get('desk')!, { type: 'desk', support: 'gables' }).map(f => f.id)).toEqual(['support', 'modesty'])
  })

  it('every step a type names exists, field ids are unique across the library', () => {
    const ids = STEPS.flatMap(s => s.fields.map(f => f.id))
    expect(new Set(ids).size).toBe(ids.length)
    for (const t of CONSTRUCTION_TYPES) for (const s of t.steps) expect(stepById.has(s), `${t.id} → ${s}`).toBe(true)
  })

  it('the next open step skips steps already done and ends on Review', () => {
    const a = { type: 'cabinet' }
    expect(nextOpenStep(a, 'type', new Set(['divisions', 'contents']))).toBe('fronts')
    expect(nextOpenStep(a, 'fronts', new Set(['base', 'carcass']))).toBe('review')
  })
})

describe('wizard: invalid input is a diagnostic, never an exception', () => {
  it.each<[string, Answers]>([
    ['width below the type limit', { type: 'cabinet', width: 50 }],
    ['not a number', { type: 'cabinet', height: 'abc' }],
    ['fraction of a mm', { type: 'cabinet', depth: 450.5 }],
    ['too many drawers for the height', { type: 'cabinet', height: 300, compartments: [{ kind: 'drawers', shelves: 0, drawers: 8 }] }],
    ['empty name', { type: 'cabinet', name: '  ' }],
    ['unknown board', { type: 'table', board: 'gold' }],
    ['negative custom width', { type: 'cabinet', dividers: 1, spacing: 'custom', widths: [-5, 0] }],
    ['no type yet', {}],
  ])('%s', (_, a) => {
    expect(() => check(a)).not.toThrow()
    const c = check(a)
    expect(c.errors).toBeGreaterThan(0)
    const res = createPiece(a)
    expect(res.ok).toBe(false)
  })
})

describe('suggestions', () => {
  const cabinet = { type: 'cabinet' }

  it('no card ever builds with an error; cards carry their warning count', () => {
    for (const t of CONSTRUCTION_TYPES) for (const g of t.generators) {
      for (const s of suggestions({ type: t.id }, g.at)) {
        expect(hasErrors(buildModel(s.design)), `${t.id}/${g.at}: ${s.label}`).toBe(false)
        expect(s.warnings).toBe(check(s.answers).warnings)
      }
    }
  })

  it('the default comes first and the first six cards of a cabinet vary: shelves, drawers, doors and no doors', () => {
    const list = suggestions(cabinet, 'type')
    expect(list[0].isDefault).toBe(true)
    expect(list[0].label).toBe('no dividers · 2 shelves · pair of doors · on a plinth')
    const six = list.slice(0, 6).map(s => s.label).join(' / ')
    for (const word of ['shel', 'drawer', 'door', 'no doors']) expect(six).toContain(word)
  })

  it('cards depend on the sizes: a low cabinet loses the cards with many drawers', () => {
    const drawerCounts = (a: Answers) => new Set(suggestions(a, 'type').flatMap(s => resolve(s.answers).compartments as { kind: string; drawers: number }[])
      .filter(c => c.kind === 'drawers').map(c => c.drawers))
    const tall = drawerCounts({ type: 'cabinet', height: 900 })
    const low = drawerCounts({ type: 'cabinet', height: 350 })
    expect(Math.max(...tall)).toBeGreaterThan(Math.max(...low))
    expect(suggestions({ type: 'cabinet', height: 350 }, 'type').length).toBeLessThan(suggestions({ type: 'cabinet', height: 900 }, 'type').length)
  })

  it('duplicates are removed: no two cards build the same product', () => {
    const sig = (s: { design: { product: unknown } }) => JSON.stringify(s.design.product, (k, v) => (k === 'id' ? undefined : v))
    for (const t of CONSTRUCTION_TYPES) {
      const sigs = suggestions({ type: t.id }, 'type').map(sig)
      expect(new Set(sigs).size).toBe(sigs.length)
    }
  })

  it('candidate generation is capped, starts with the default and spreads over every axis', () => {
    const picks = [...candidatePicks([3, 5, 5, 5, 4, 2], [0, 0, 1, 0, 1, 0], 64)]
    expect(picks.length).toBe(64)
    expect(picks[0]).toEqual([0, 0, 1, 0, 1, 0])
    for (let k = 0; k < 6; k++) expect(new Set(picks.map(p => p[k])).size).toBeGreaterThan(1)
    expect([...candidatePicks([2, 3], [1, 2], 64)].length).toBe(6)
  })

  it('variety ranking picks the farthest candidate next', () => {
    const r = rankByVariety([{ picks: [0, 0, 0] }, { picks: [0, 0, 1] }, { picks: [1, 1, 1] }, { picks: [0, 1, 0] }])
    expect(r.map(x => x.picks.join(''))).toEqual(['000', '111', '001', '010'])
  })

  it('a card fills in the wizard; later-step cards keep earlier answers', () => {
    const base: Answers = { type: 'cabinet', width: 1000, height: 1200, depth: 400, dividers: 2, name: 'Mine' }
    const later = suggestions(base, 'fronts')
    expect(later.length).toBeGreaterThan(2)
    for (const s of later) {
      const r = resolve(s.answers)
      expect([r.width, r.height, r.depth, r.dividers, r.name]).toEqual([1000, 1200, 400, 2, 'Mine'])
    }
    const contents = suggestions(base, 'contents')
    expect(contents.every(s => resolve(s.answers).dividers === 2)).toBe(true)
    const card = suggestions(cabinet, 'type').find(s => /drawer/.test(s.label))!
    expect(toDesign(card.answers)!.product).toEqual(expect.objectContaining({ kind: 'cabinet' }))
    expect(check(card.answers).errors).toBe(0)
  })

  it('no axis writes an answer owned by a step before the one its cards appear on', () => {
    for (const t of CONSTRUCTION_TYPES) {
      const order = visibleSteps({ type: t.id }).map(s => s.id)
      for (const g of t.generators) {
        const at = order.indexOf(g.at)
        expect(at, `${t.id}: ${g.at}`).toBeGreaterThan(0)
        const owners = stepsWriting({ type: t.id, fronts: 'per', spacing: 'custom', dividers: 1, base: 'wall', lowerShelf: 'yes' }, g.axes.flatMap(ax => ax.writes))
        for (const o of owners) expect(order.indexOf(o), `${t.id}/${g.id} writes into ${o}`).toBeGreaterThanOrEqual(at)
      }
    }
  })

  it('cards also appear on later steps for at least one type', () => {
    expect(suggestions({ type: 'cabinet' }, 'contents').length).toBeGreaterThan(5)
    expect(suggestions({ type: 'cabinet' }, 'base').length).toBeGreaterThan(1)
    expect(suggestions({ type: 'table' }, 'frame').length).toBeGreaterThan(5)
  })
})

describe('universal: engine and UI know no construction type', () => {
  it('neither the engine, the suggestion engine nor the wizard UI names a type id', () => {
    const files = ['src/core/wizard/engine.ts', 'src/core/wizard/suggest.ts', 'src/ui/Wizard.tsx'].map(f => readFileSync(f, 'utf8'))
    for (const t of CONSTRUCTION_TYPES) for (const src of files) expect(src).not.toMatch(new RegExp(`['"\`]${t.id}['"\`]`))
  })
})

describe('result → catalog (ADR-046)', () => {
  it('creates a valid design with a fresh id, saves it in the existing designs table and reads it back unchanged', async () => {
    const a: Answers = { type: 'shelving', name: 'Wizard bookcase', width: 900 }
    const res = createPiece(a, '2026-10-23T10:00:00.000Z')
    if (!res.ok) throw new Error(res.problems.map(p => p.message).join('; '))
    expect(validateDesign(res.design)).toEqual([])
    expect(res.design.createdAt).toBe('2026-10-23T10:00:00.000Z')
    expect(createPiece(a).ok && (createPiece(a) as { design: { id: string } }).design.id).not.toBe(res.design.id)
    await saveDesign(res.design)
    expect((await listDesigns()).map(r => r.name)).toContain('Wizard bookcase')
    expect(await loadDesign(res.design.id)).toEqual(res.design)
  })

  it('every shipped type can be created and saved', async () => {
    for (const t of CONSTRUCTION_TYPES) {
      const res = createPiece({ type: t.id })
      expect(res.ok, t.id).toBe(true)
      if (res.ok) { await saveDesign(res.design); expect(await loadDesign(res.design.id)).toEqual(res.design) }
    }
  })
})

describe('N35: wardrobe and bed types', () => {
  it('wardrobe: hanging on the left, shelves on the right, pair of doors by default; hanging-left cards exist', () => {
    const p = cabinetOf({ type: 'wardrobe' })
    expect(leaves(p.interior).map(l => l.kind)).toEqual(['hanging', 'shelves'])
    expect(p.interior.front).toEqual({ kind: 'doors', count: 2 })
    expect(suggestions({ type: 'wardrobe' }, 'type')[0].label).toBe('1 divider · hanging rail | 5 shelves · pair of doors · on a plinth')
    expect(suggestions({ type: 'wardrobe' }, 'type').some(s => /hanging rail \| \d+ shelves \| \d+ shelves/.test(s.label))).toBe(true)
  })

  it('bed: width and depth are not asked, height is the headboard; mattress, deck and footboard reach the bed', () => {
    const basics = stepById.get('basics')!
    const f = visibleFields(basics, { type: 'bed' })
    expect(f.map(x => x.id)).not.toContain('width')
    expect(f.map(x => x.id)).not.toContain('depth')
    expect(f.find(x => x.id === 'height')!.label).toBe('Headboard height')
    const d = toDesign({ type: 'bed', height: 1100, mattressWidth: 1400, mattressLength: 1900, deckHeight: 300, footboard: 'yes', footboardHeight: 700 })!
    if (d.product.kind !== 'frame') throw new Error('frame')
    expect(d.product.params.kind).toBe('bed')
    expect(d.product.params.bed).toMatchObject({ mattress: { w: 1400, l: 1900 }, deckHeight: 300, headboardHeight: 1100, footboardHeight: 700, tierGap: 0 })
    const m = buildModel(d)
    expect(m.bounds.h).toBe(1100)
    expect(fieldProblems({ type: 'bed', mattressWidth: 5000 }).some(x => x.field === 'mattressWidth')).toBe(true)
  })

  it('bed cards change with the mattress width only through the model (all valid, varied)', () => {
    const list = suggestions({ type: 'bed' }, 'type')
    expect(new Set(list.map(s => resolve(s.answers).mattressWidth)).size).toBeGreaterThan(2)
  })
})

describe('N35: answers kept with the piece, reopened in the wizard (ADR-046)', () => {
  it('a created piece carries its answers; they validate and rebuild the same piece', () => {
    const res = createPiece({ type: 'wardrobe', name: 'Hall wardrobe', width: 1000 })
    if (!res.ok) throw new Error('not created')
    expect(res.design.wizard?.answers).toMatchObject({ type: 'wardrobe', name: 'Hall wardrobe', width: 1000 })
    expect(validateDesign(res.design)).toEqual([])
    expect(editedSinceWizard(res.design)).toBe(false)
    expect(resolve(storedAnswers(res.design)!).width).toBe(1000)
  })

  it('an edit in the editor is detected; updating keeps the id, creation date and catalog fields', () => {
    const res = createPiece({ type: 'cabinet', name: 'Box' }, '2026-10-01T00:00:00.000Z')
    if (!res.ok) throw new Error('not created')
    const edited = { ...res.design, catalog: { ...res.design.catalog, brand: 'Mine' }, product: { ...res.design.product, params: { ...res.design.product.params, width: 950 } } } as typeof res.design
    expect(editedSinceWizard(edited)).toBe(true)
    const again = createPiece({ ...storedAnswers(edited)!, dividers: 1 }, '2026-10-23T00:00:00.000Z', edited)
    if (!again.ok) throw new Error('not updated')
    expect([again.design.id, again.design.createdAt, again.design.updatedAt]).toEqual([edited.id, '2026-10-01T00:00:00.000Z', '2026-10-23T00:00:00.000Z'])
    expect(again.design.catalog).toMatchObject({ brand: 'Mine', category: 'Storage and display' })
    expect(editedSinceWizard(again.design)).toBe(false)
  })

  it.each([
    ['not an object', 'x'],
    ['answers missing', {}],
    ['a value of the wrong type', { answers: { width: { a: 1 } } }],
    ['a compartment without counts', { answers: { compartments: [{ kind: 'shelves' }] } }],
    ['too large', { answers: { name: 'x'.repeat(30_000) } }],
  ])('bad stored answers are reported, never thrown: %s', (_, wizard) => {
    const res = createPiece({ type: 'desk' })
    if (!res.ok) throw new Error('not created')
    expect(validateDesign({ ...res.design, wizard })).toContain('Invalid wizard answers')
  })
})
