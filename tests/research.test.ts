import 'fake-indexeddb/auto'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import {
  auditChecks, buildView, coverage, descendants, EMPTY_QUERY, filterFeatures, groupFeatures, mergeMarks, planImport, sortFeatures,
  specMarkdown, stats, storedOf, validateBundle, type StoredBundle,
} from '../src/core/research/catalog'
import { ENSEMBLE_BUNDLE, MVP_ROWS, RANKED_ROWS, RECOMMENDATION_ROWS, rankLine, recommendationLine } from '../src/core/research/ensemble-2026-10-23'
import type { ResearchBundle, ResearchMark } from '../src/core/research/types'
import { db, listResearchBundles, listResearchMarks } from '../src/persist/db'
import { seedShipped, useResearch } from '../src/store/researchStore'
import { ResearchPage } from '../src/ui/Research'

const FILE = 'docs/research/2026-10-23-furniture-ensemble-builder.md'
const TEXT = readFileSync(FILE, 'utf8')
const LINES = TEXT.split('\n')
const B = ENSEMBLE_BUNDLE
const AT = '2026-10-23T12:00:00.000Z'
const clone = <T,>(x: T): T => structuredClone(x)
const cells = (line: number) => LINES[line - 1].split('|').slice(1, -1).map(c => c.replace(/\*\*/g, '').replace(/\s*\[\^ref-\d+\]/g, '').trim())
/** A consistent edition without feature `id` (no record keeps pointing at it). */
function dropFeature(b: ResearchBundle, id: string): ResearchBundle {
  return { ...b, features: b.features.filter(f => f.id !== id).map(f => ({ ...f, related: f.related.filter(x => x !== id), dependencies: f.dependencies.filter(x => x !== id), parent: f.parent === id ? undefined : f.parent })),
    contradictions: b.contradictions.map(c => ({ ...c, features: c.features.filter(x => x !== id) })) }
}
const mark = (id: string, patch: Partial<ResearchMark> = {}): ResearchMark => ({ id, selection: 'approved', implementation: 'not-started', priority: 'P1', notes: 'mine', reviewed: false, links: [], createdAt: AT, updatedAt: AT, ...patch })

describe('research catalog: extracted data (ADR-0043)', () => {
  it('is the committed paper, quoted verbatim', () => {
    expect(B.document.text).toBe(TEXT)
    expect(createHash('sha256').update(TEXT).digest('hex')).toBe(B.document.sha256)
    const view = buildView([storedOf(B, AT)])
    const f = view.findings.get('ens.n.010')!
    expect(f.excerpt).toBe(LINES[17])
    expect(f.allRefs).toContain('ref-3')
  })
  it('validates, with unique ids and every reference resolved', () => {
    expect(validateBundle(B)).toEqual([])
    const ids = new Set(B.features.map(f => f.id))
    for (const f of B.features) {
      for (const d of [...f.dependencies, ...f.related, ...(f.parent ? [f.parent] : [])]) expect(ids.has(d), `${f.id} → ${d}`).toBe(true)
      expect(f.findings.length, `${f.id} has evidence`).toBeGreaterThan(0)
    }
    // No parent cycles.
    for (const f of B.features) { let cur = f, n = 0; while (cur.parent && n++ < 30) cur = B.features.find(x => x.id === cur.parent)! ; expect(n).toBeLessThan(30) }
  })
  it('has a feature for every ranked row, with the paper\'s ratings word for word', () => {
    expect(RANKED_ROWS).toHaveLength(39)
    for (const [rank, name] of RANKED_ROWS) {
      const c = cells(rankLine(rank))
      expect(c[1]).toBe(name)
      const f = B.features.find(x => x.rank === rank)!
      expect(f, `rank ${rank}`).toBeDefined()
      expect([f.demand, f.appreciation, f.adoption, f.complexity, f.impact, f.confidence, f.priority]).toEqual(c.slice(2))
      expect(f.findings).toContain(`ens.n.rank-${String(rank).padStart(2, '0')}`)
    }
  })
  it('links every top-fifteen recommendation and every MVP row to a feature', () => {
    for (const [r, name] of RECOMMENDATION_ROWS) {
      expect(LINES[recommendationLine(r) - 1]).toContain(`**${name}**`)
      expect(B.features.some(f => f.recommendationRank === r), `recommendation ${r}`).toBe(true)
    }
    for (const [line, name] of MVP_ROWS) {
      expect(cells(line)[0]).toBe(name)
      const f = B.features.find(x => x.mvp === cells(line)[1])
      expect(f, `MVP ${name}`).toBeDefined()
    }
  })
  it('has a record for every compared competitor, every footnote and every listed source', () => {
    for (let l = 40; l <= 55; l++) {
      const name = cells(l)[0]
      const c = B.competitors.find(x => x.line === l)!
      expect(c.name).toBe(name)
      expect(c.behaviour).toBe(cells(l)[1])
      expect(c.commercial).toBe(cells(l)[3])
    }
    expect(B.citations).toHaveLength(122)
    const urlLines = LINES.map((l, i) => [l, i + 1] as const).filter(([l]) => /^\[[^\]]+\]\(https?:/.test(l))
    expect(B.bibliography).toHaveLength(urlLines.length)
    for (const [l, n] of urlLines) expect(B.bibliography.find(b => b.line === n)?.url).toBe(l.match(/\((https?:[^)]+)\)/)![1])
  })
  it('accounts for every line of the paper and passes every audit check', () => {
    const r = coverage(B)
    for (const s of r.sections) expect(s.status, `${s.section.title}: ${s.warnings.join('; ')}`).toBe('complete')
    for (const c of r.checks) expect(c.ok, `${c.label}: ${c.detail}`).toBe(true)
    expect(r.coveredLines).toBe(r.sections.reduce((n, s) => n + s.total, 0))
  })
  it('catches an omission: dropping a finding leaves its lines uncovered', () => {
    const b = clone(B)
    b.findings = b.findings.filter(f => f.id !== 'ens.n.016' && f.id !== 'ens.n.014' && f.id !== 'ens.n.015')
    b.features = b.features.map(f => ({ ...f, findings: f.findings.filter(n => !['ens.n.014', 'ens.n.015', 'ens.n.016'].includes(n)) }))
    const exec = coverage(b).sections.find(s => s.section.id === 'ens.s.exec')!
    expect(exec.status).toBe('partial')
    expect(exec.uncovered).toEqual([22])
  })
  it('marks inferred features and never lets them pass as research', () => {
    const inferred = B.features.filter(f => f.origin === 'inferred')
    expect(inferred.length).toBeGreaterThan(0)
    for (const f of inferred) expect(f.inferredFrom!.length).toBeGreaterThan(0)
    const b = clone(B)
    b.features[0] = { ...b.features[0], origin: 'inferred', inferredFrom: [] }
    expect(validateBundle(b).join()).toMatch(/inferred feature must list/)
  })
})

describe('research catalog: view, filters and relationships', () => {
  const view = buildView([storedOf(B, AT)])
  it('builds the parent / sub-feature tree', () => {
    const st = stats(view, {})
    expect(st.features).toBe(B.features.length)
    expect(st.topLevel + st.subfeatures).toBe(st.features)
    expect(st.subfeatures).toBeGreaterThan(50)
    expect(view.features.get('ens.f.guided-snapping')!.children).toEqual(expect.arrayContaining(['ens.f.snap-preview', 'ens.f.snap-override']))
    expect(descendants(view, 'ens.f.collision-clearance').map(f => f.id)).toContain('ens.f.env-drawer')
    expect(view.competitors.get('c.planner5d')!.features).toContain('ens.f.snap-override')
  })
  it('searches, filters, sorts and groups', () => {
    const marks = { 'ens.f.countertops': mark('ens.f.countertops', { selection: 'shortlisted' }), 'ens.f.auto-bom': mark('ens.f.auto-bom') }
    expect(filterFeatures(view, {}, { ...EMPTY_QUERY, q: 'disable snapping' }).map(f => f.id)).toContain('ens.f.snap-override')
    expect(filterFeatures(view, marks, { ...EMPTY_QUERY, planned: true }).map(f => f.id).sort()).toEqual(['ens.f.auto-bom', 'ens.f.countertops'])
    expect(filterFeatures(view, {}, { ...EMPTY_QUERY, category: 'ai' }).every(f => f.category === 'ai')).toBe(true)
    expect(filterFeatures(view, {}, { ...EMPTY_QUERY, origin: 'inferred' }).length).toBe(2)
    expect(filterFeatures(view, {}, { ...EMPTY_QUERY, evidence: 'without' })).toEqual([])
    const byValue = sortFeatures([...view.features.values()], 'impact', {})
    expect(byValue[0].impact).toBe('5.0')
    expect(sortFeatures([...view.features.values()], 'research', {})[0].id).toBe('ens.f.guided-snapping')
    const groups = groupFeatures([...view.features.values()], 'priority', view, {})
    expect(groups[0].key).toBe('P0')
    expect(groupFeatures([...view.features.values()], 'selection', view, marks).map(g => g.key)).toEqual(['unreviewed', 'shortlisted', 'approved'])
    expect(groupFeatures([...view.features.values()], 'parent', view, {}).find(g => g.key === 'ens.f.generated-parts')!.items.length).toBeGreaterThan(10)
  })
  it('keeps contradictions and conflicting estimates visible and resolvable to records', () => {
    for (const c of view.contradictions) {
      for (const n of c.findings) expect(view.findings.has(n), `${c.id} → ${n}`).toBe(true)
      for (const f of c.features) expect(view.features.has(f), `${c.id} → ${f}`).toBe(true)
    }
    expect(view.features.get('ens.f.auto-bom')!.priority).toBe('P0/P1')
    const md = specMarkdown(view, {}, ['ens.f.auto-bom'], AT)
    expect(md).toMatch(/BOM priority: P0\/P1/)
    expect(md).toMatch(/None of these features has been started/)
    expect(md).toMatch(/lines 89–89/)
  })
  it('reports a feature that has no evidence instead of hiding it', () => {
    const b = clone(B)
    b.features.push({ ...b.features[0], id: 'ens.f.bare', parent: undefined, findings: [], rank: undefined, recommendationRank: undefined })
    const v = buildView([storedOf(b, AT)])
    expect(stats(v, {}).withoutEvidence).toBe(1)
    expect(filterFeatures(v, {}, { ...EMPTY_QUERY, evidence: 'without' }).map(f => f.id)).toEqual(['ens.f.bare'])
    expect(auditChecks(b).find(c => c.id === 'evidence')!.ok).toBe(false)
  })
})

describe('research catalog: re-import never overwrites decisions', () => {
  const v1 = storedOf(B, AT)
  const marks = { 'ens.f.countertops': mark('ens.f.countertops'), 'ens.f.ar-placement': mark('ens.f.ar-placement', { selection: 'rejected' }) }
  it('treats the same edition as unchanged, and different content under the same edition as a conflict', () => {
    expect(planImport([v1], clone(B), marks).status).toBe('unchanged')
    const edited = clone(B); edited.features[0].description = 'changed'
    const p = planImport([v1], edited, marks)
    expect(p.status).toBe('conflict'); expect(p.store).toBe(false)
  })
  it('stores a new edition: changed and dropped features are reported, dropped ones stay as retired', () => {
    const v2 = dropFeature(clone(B), 'ens.f.ar-placement')
    v2.document.version = 2
    v2.features.find(f => f.id === 'ens.f.countertops')!.description = 'Edition 2 wording.'
    const p = planImport([v1], v2, marks)
    expect(p.status).toBe('new-version')
    expect(p.changed).toEqual(['ens.f.countertops'])
    expect(p.retired).toEqual(['ens.f.ar-placement'])
    expect(p.decisionsKept).toBe(2)
    const view = buildView([v1, storedOf(v2, AT)])
    expect(view.features.get('ens.f.countertops')!.description).toBe('Edition 2 wording.')
    expect(view.features.get('ens.f.ar-placement')!.retired).toBe(true)
    expect(view.documents[0].versions).toEqual([1, 2])
  })
  it('adds another paper\'s evidence to a shared feature id and flags likely duplicates', () => {
    const other: ResearchBundle = {
      ...clone(B), document: { id: 'other', title: 'Other paper', version: 1, date: '2026-11-01', text: 'line one\nline two' },
      sections: [{ id: 'o.s', title: 'All', lines: [1, 2] }],
      findings: [{ id: 'o.n.1', section: 'o.s', lines: [1, 1], kind: 'request', statement: 'Users want countertops.' }],
      citations: [], bibliography: [], competitors: [], contradictions: [], unextracted: [],
      features: [
        { ...clone(B.features.find(f => f.id === 'ens.f.countertops')!), description: 'Other wording', findings: ['o.n.1'], competitors: [], parent: undefined, dependencies: [], related: [] },
        { ...clone(B.features.find(f => f.id === 'ens.f.cut-list')!), id: 'o.f.cutlist', findings: ['o.n.1'], competitors: [], dependencies: [], related: [] },
      ],
    }
    const p = planImport([v1], other, marks)
    expect(p.status).toBe('new-document')
    expect(p.mergedEvidence).toEqual(['ens.f.countertops'])
    expect(p.possibleDuplicates).toEqual([['o.f.cutlist', 'ens.f.cut-list']])
    const view = buildView([v1, storedOf(other, AT)])
    const f = view.features.get('ens.f.countertops')!
    expect(f.description).not.toBe('Other wording') // first paper keeps its fields
    expect(f.findings).toEqual(expect.arrayContaining(['ens.n.rank-13', 'o.n.1']))
    expect(f.docs).toEqual(['ens-2026-10-23', 'other'])
  })
  it('refuses finding ids that belong to another paper, and never throws on bad input', () => {
    const clash = clone(B); clash.document = { ...clash.document, id: 'copy' }
    expect(planImport([v1], clash).errors.join()).toMatch(/already belong to another paper/)
    for (const bad of [null, 42, 'x', {}, { format: 'furniture-builder-research', schemaVersion: 1 }, { ...clone(B), features: 'no' }]) {
      const p = planImport([v1], bad)
      expect(p.status).toBe('invalid'); expect(p.errors.length).toBeGreaterThan(0)
    }
  })
  it('keeps the device\'s decision when a decisions file disagrees', () => {
    const r = mergeMarks(marks, [mark('ens.f.countertops', { selection: 'rejected' }), mark('ens.f.cut-list'), { id: 'junk' }])
    expect(r.add.map(m => m.id)).toEqual(['ens.f.cut-list'])
    expect(r.kept).toBe(1); expect(r.invalid).toBe(1)
  })
})

describe('research catalog: persistence', () => {
  it('seeds the shipped paper, keeps decisions across reloads and across a new edition', async () => {
    await db.researchDocs.clear(); await db.researchMarks.clear()
    useResearch.setState({ loaded: false, marks: {} })
    await useResearch.getState().init()
    expect((await listResearchBundles()).map(s => s.key)).toEqual(['ens-2026-10-23@1'])
    await useResearch.getState().setMarks(['ens.f.countertops', 'ens.f.auto-bom'], { selection: 'shortlisted' })
    await useResearch.getState().setMarks(['ens.f.countertops'], { notes: 'Kitchen first', priority: 'P0', implementation: 'planned' })
    await useResearch.getState().setMarks(['ens.n.010'], { reviewed: true })
    // Reload from storage.
    useResearch.setState({ loaded: false, marks: {} })
    await useResearch.getState().init()
    const m = useResearch.getState().marks['ens.f.countertops']
    expect([m.selection, m.notes, m.priority, m.implementation]).toEqual(['shortlisted', 'Kitchen first', 'P0', 'planned'])
    expect(useResearch.getState().marks['ens.n.010'].reviewed).toBe(true)
    // A new edition imported: decisions untouched.
    const v2 = dropFeature(clone(B), 'ens.f.auto-bom'); v2.document.version = 2
    const p = await useResearch.getState().importBundle(v2)
    expect(p.status).toBe('new-version')
    expect((await listResearchMarks()).find(x => x.id === 'ens.f.auto-bom')!.selection).toBe('shortlisted')
    expect((await listResearchBundles()).map(s => s.key).sort()).toEqual(['ens-2026-10-23@1', 'ens-2026-10-23@2'])
  })
  it('refreshes a shipped edition whose content changed, never a different edition', () => {
    const old = storedOf({ ...clone(B), features: [] }, AT)
    expect(seedShipped([old], [B], AT).map(s => s.key)).toEqual(['ens-2026-10-23@1'])
    expect(seedShipped([storedOf(B, AT)], [B], AT)).toEqual([])
  })
  it('skips and keeps an unreadable stored row', async () => {
    await db.researchDocs.put({ key: 'bad@1', docId: 'bad', version: 1, importedAt: AT, bundle: { format: 'nope' } as never } as StoredBundle)
    expect((await listResearchBundles()).some(s => s.key === 'bad@1')).toBe(false)
    expect(await db.researchDocs.get('bad@1')).toBeDefined()
  })
})

describe('research catalog: page', () => {
  const render = (props: Record<string, unknown>) => renderToStaticMarkup(createElement(ResearchPage, { onDone: () => {}, ...props }))
  it('shows the overview with totals', () => {
    const html = render({})
    expect(html).toContain('Feature Research &amp; Catalog')
    expect(html).toContain('Sub-features')
    expect(html).toContain('Unreviewed findings')
    expect(html).toContain('Source-document coverage')
  })
  it('lists every feature and sub-feature with decision and implementation controls', () => {
    const html = render({ initialTab: 'features' })
    for (const f of B.features) expect(html).toContain(`Your decision on ${f.name.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/'/g, '&#x27;')}`)
    expect(html).toContain('Implementation status')
  })
  it('shows a feature in full: sub-features, requirements, evidence with sources', () => {
    const html = render({ initialTab: 'features', initialDetail: 'ens.f.guided-snapping' })
    for (const s of ['Snap preview before commit', 'Snap override', 'Functional requirements', 'Competitor comparison', 'Pain points and complaints', 'reddit.com', 'lines 75']) expect(html).toContain(s)
  })
  it('shows the coverage audit', () => {
    const html = render({ initialTab: 'coverage' })
    expect(html).toContain('Extraction complete')
    expect(html).toContain('Nothing in this paper is marked UNEXTRACTED')
  })
})
