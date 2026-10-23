import { Fragment, useEffect, useMemo, useState, type ReactNode } from 'react'
import {
  assessedValue, assessmentStats, buildView, coverage, DEMAND_SCALE, descendants, EMPTY_QUERY, filterFeatures, groupFeatures, markOf, rating,
  specMarkdown, sortFeatures, stats, VALUE_BANDS, type CatalogView, type RatingDim, type FeatureQuery, type GroupBy, type ImportPlan, type SortKey, type ViewFeature, type ViewFinding,
} from '../core/research/catalog'
import {
  ASSESSMENT_CRITERIA, COMPLEXITY_SCALE, CONFIDENCE_SCALE, FINDING_KIND_LABEL, IMPLEMENTATION_LABEL, IMPLEMENTATIONS, SELECTION_LABEL, SELECTIONS, USER_PRIORITIES,
  type FindingKind, type Implementation, type ResearchMark, type Selection,
} from '../core/research/types'
import { useResearch, type MarkPatch } from '../store/researchStore'
import { askConfirm } from './Confirm'
import { Icon } from './icons'

export type Tab = 'overview' | 'features' | 'compare' | 'findings' | 'competitors' | 'contradictions' | 'sources' | 'coverage' | 'import'
const TABS: [Tab, string][] = [
  ['overview', 'Overview'], ['features', 'Features'], ['compare', 'Compare'], ['findings', 'Findings'], ['competitors', 'Competitors'],
  ['contradictions', 'Contradictions'], ['sources', 'Sources'], ['coverage', 'Coverage audit'], ['import', 'Import & export'],
]
const PICK_KEY = 'furniture-builder:research-picked'
const readPicked = (): string[] => { try { const v = JSON.parse(localStorage.getItem(PICK_KEY) ?? '[]'); return Array.isArray(v) ? v.filter(x => typeof x === 'string') : [] } catch { return [] } }
const writePicked = (ids: string[]) => { try { localStorage.setItem(PICK_KEY, JSON.stringify(ids)) } catch { /* private mode */ } }

function download(name: string, text: string, type: string) {
  const url = URL.createObjectURL(new Blob([text], { type }))
  Object.assign(document.createElement('a'), { href: url, download: name }).click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
const today = () => new Date().toISOString().slice(0, 10)
const ne = (s: string) => (s === 'not evaluated' || s === 'unknown' ? <span className="ne">{s}</span> : s)
/** A rating with its source: the paper's own words, or our assessment marked "A" (never shown as research). */
function Rated({ f, dim }: { f: ViewFeature; dim: RatingDim }) {
  const r = rating(f, dim)
  if (r.source === 'none') return <span className="ne">{r.value}</span>
  return <span className={`rated ${r.source}`}>{r.value}{r.source === 'assessment' && <abbr className="assessed" title="Assessed from the paper's evidence with the paper's method — not a rating in the paper">A</abbr>}</span>
}
const catLabel = (view: CatalogView, id: string) => view.categories.find(c => c.id === id)?.label ?? id

/**
 * Feature Research & Catalog (ADR-0043): every record extracted from the research papers, searchable and selectable
 * for later work. Reached from the "Feature Research" tab in the top bar or the #research link. Selecting a feature is a
 * planning decision only; nothing here starts an implementation.
 */
export function ResearchPage({ onDone, initialTab = 'overview', initialDetail = null }: { onDone: () => void; initialTab?: Tab; initialDetail?: string | null }) {
  const stored = useResearch(s => s.stored)
  const marks = useResearch(s => s.marks)
  const error = useResearch(s => s.error)
  const loaded = useResearch(s => s.loaded)
  useEffect(() => { if (!loaded) void useResearch.getState().init() }, [loaded])
  const view = useMemo(() => buildView(stored), [stored])
  const [tab, setTab] = useState<Tab>(initialTab)
  const [detail, setDetail] = useState<string | null>(initialDetail)
  const [picked, setPickedState] = useState<string[]>(readPicked)
  const [query, setQuery] = useState<FeatureQuery>(EMPTY_QUERY)
  const setPicked = (ids: string[]) => { writePicked(ids); setPickedState(ids) }
  const togglePick = (id: string, on?: boolean) => setPicked((on ?? !picked.includes(id)) ? [...new Set([...picked, id])] : picked.filter(x => x !== id))
  const open = (id: string) => { setDetail(id); setTab('features'); window.scrollTo({ top: 0 }) }
  const go = (t: Tab, q?: Partial<FeatureQuery>) => { if (q) setQuery({ ...EMPTY_QUERY, ...q }); setDetail(null); setTab(t); window.scrollTo({ top: 0 }) }
  const st = useMemo(() => stats(view, marks), [view, marks])
  const ctx: Ctx = { view, marks, open, go, picked, togglePick, setPicked }
  return (
    <main className="catalog-page research-page" aria-label="Feature Research & Catalog">
      <header className="catalog-head">
        <div>
          <h1>Feature Research &amp; Catalog</h1>
          <p className="hint"><strong className="num">{st.features} features</strong> ({st.topLevel} features, {st.subfeatures} sub-features) and {st.findings} findings from {view.documents.length} research {view.documents.length === 1 ? 'paper' : 'papers'}. Selecting a feature records a decision only — nothing is implemented from here.</p>
        </div>
        <button type="button" className="btn outline" onClick={onDone}><Icon name="chevron-right" className="sm" />Back to the editor</button>
      </header>
      {error && <p className="alert warning" role="status"><Icon name="alert-triangle" className="sm" /><span>{error}</span></p>}
      <nav className="segmented small research-tabs" role="tablist" aria-label="Research sections">
        {TABS.map(([t, label]) => (
          <button key={t} type="button" role="tab" aria-selected={tab === t} className={tab === t ? 'on' : ''} onClick={() => go(t)}>
            {label}{t === 'compare' && picked.length > 0 && <span className="count"> {picked.length}</span>}
          </button>
        ))}
      </nav>
      {tab === 'overview' && <Overview ctx={ctx} />}
      {tab === 'features' && (detail && view.features.has(detail)
        ? <FeatureDetail key={detail} ctx={ctx} f={view.features.get(detail)!} onBack={() => setDetail(null)} />
        : <Explorer ctx={ctx} query={query} setQuery={setQuery} />)}
      {tab === 'compare' && <Compare ctx={ctx} />}
      {tab === 'findings' && <Findings ctx={ctx} />}
      {tab === 'competitors' && <Competitors ctx={ctx} />}
      {tab === 'contradictions' && <Contradictions ctx={ctx} />}
      {tab === 'sources' && <Sources ctx={ctx} />}
      {tab === 'coverage' && <Coverage ctx={ctx} />}
      {tab === 'import' && <ImportExport ctx={ctx} />}
    </main>
  )
}

interface Ctx {
  view: CatalogView
  marks: Record<string, ResearchMark>
  open: (id: string) => void
  go: (t: Tab, q?: Partial<FeatureQuery>) => void
  picked: string[]
  togglePick: (id: string, on?: boolean) => void
  setPicked: (ids: string[]) => void
}
const setMarks = (ids: string[], patch: MarkPatch) => void useResearch.getState().setMarks(ids, patch)

// ── Overview ────────────────────────────────────────────────────────────────────────────────────────────────────

function Tile({ n, label, onClick }: { n: number | string; label: string; onClick?: () => void }) {
  const body = <><strong className="num">{n}</strong><span>{label}</span></>
  return onClick ? <button type="button" className="tile" onClick={onClick}>{body}</button> : <div className="tile">{body}</div>
}

function Overview({ ctx }: { ctx: Ctx }) {
  const { view, marks, go } = ctx
  const st = useMemo(() => stats(view, marks), [view, marks])
  const max = Math.max(1, ...st.byCategory.map(c => c.n))
  return (
    <div className="research-overview">
      <AssessmentDashboard ctx={ctx} />
      <section className="tiles" aria-label="Totals">
        <Tile n={st.features} label="Features in total" onClick={() => go('features')} />
        <Tile n={st.topLevel} label="Top-level features" onClick={() => go('features', { topLevel: true })} />
        <Tile n={st.subfeatures} label="Sub-features" />
        <Tile n={st.withEvidence} label="With research evidence" onClick={() => go('features', { evidence: 'with' })} />
        <Tile n={st.withoutEvidence} label="Missing supporting evidence" onClick={() => go('features', { evidence: 'without' })} />
        <Tile n={st.inferred} label="Inferred opportunities" onClick={() => go('features', { origin: 'inferred' })} />
        <Tile n={st.findings} label="Research findings" onClick={() => go('findings')} />
        <Tile n={st.unreviewedFindings} label="Unreviewed findings" onClick={() => go('findings')} />
        <Tile n={st.competitors} label="Competitors" onClick={() => go('competitors')} />
        <Tile n={`${st.sources} + ${st.citations}`} label="Sources + citations" onClick={() => go('sources')} />
        <Tile n={st.contradictions} label="Contradictions and conflicts" onClick={() => go('contradictions')} />
        {st.retired > 0 && <Tile n={st.retired} label="Retired in a newer edition" />}
      </section>
      <p className="alert info"><Icon name="info" className="sm" /><span><strong>No usage telemetry exists in the research.</strong> “Competitor adoption” means how broadly products implement a pattern; demand and appreciation are qualitative public feedback; “Value” is the researcher’s 1–5 judgement. Ratings are shown exactly as the paper writes them.</span></p>
      <div className="overview-cols">
        <section aria-label="Features by category">
          <h2 className="group-head">By category</h2>
          <ul className="bars">
            {st.byCategory.filter(c => c.n).map(c => (
              <li key={c.id}><button type="button" className="link" onClick={() => go('features', { category: c.id })}>{c.label}</button>
                <span className="bar-track"><span style={{ width: `${(c.n / max) * 100}%` }} /></span><span className="num">{c.n}</span></li>
            ))}
          </ul>
        </section>
        <section aria-label="Features by decision">
          <h2 className="group-head">By your decision</h2>
          <ul className="bars plain">{SELECTIONS.map(s => <li key={s}><button type="button" className="link" onClick={() => go('features', { selection: s })}>{SELECTION_LABEL[s]}</button><span className="num">{st.bySelection[s]}</span></li>)}</ul>
          <h2 className="group-head">By implementation status</h2>
          <ul className="bars plain">{IMPLEMENTATIONS.map(s => <li key={s}><button type="button" className="link" onClick={() => go('features', { implementation: s })}>{IMPLEMENTATION_LABEL[s]}</button><span className="num">{st.byImplementation[s]}</span></li>)}</ul>
        </section>
        <section aria-label="Source coverage">
          <h2 className="group-head">Source-document coverage</h2>
          <ul className="bars plain">{st.coverage.map(c => (
            <li key={c.doc}><button type="button" className="link" onClick={() => go('coverage')}>{c.title}</button>
              <span className="num">{c.covered}/{c.total} lines</span><span className={`chip ${c.complete ? '' : 'safety'}`}>{c.complete ? 'Complete' : 'Gaps'}</span></li>
          ))}</ul>
          <p className="hint">Every line of the paper is held by a finding, competitor, source, citation or heading record; the audit lists anything that is not.</p>
        </section>
      </div>
    </div>
  )
}

// ── Assessment dashboard ───────────────────────────────────────────────────────────────────────────────────────

function Dist({ title, rows, onPick }: { title: string; rows: { key: string; label?: string; n: number }[]; onPick?: (key: string) => void }) {
  const max = Math.max(1, ...rows.map(r => r.n))
  return (
    <section aria-label={title}><h3>{title}</h3>
      <ul className="bars">{rows.map(r => (
        <li key={r.key}>{onPick && r.key !== 'Other' ? <button type="button" className="link" onClick={() => onPick(r.key)}>{r.label ?? r.key}</button> : <span>{r.label ?? r.key}</span>}
          <span className="bar-track"><span style={{ width: `${(r.n / max) * 100}%` }} /></span><span className="num">{r.n}</span></li>
      ))}</ul>
    </section>
  )
}

function RankedList({ ctx, title, items, empty }: { ctx: Ctx; title: string; items: ViewFeature[]; empty: string }) {
  return (
    <section aria-label={title}><h3>{title} <span className="count">{items.length}</span></h3>
      {items.length ? <ol className="ranked">{items.map(f => (
        <li key={f.id}><button type="button" className="link" onClick={() => ctx.open(f.id)}>{f.name}</button>
          <span className="facts">Value <Rated f={f} dim="impact" /> · Demand <Rated f={f} dim="demand" /> · Complexity <Rated f={f} dim="complexity" /> · Confidence <Rated f={f} dim="confidence" /></span></li>
      ))}</ol> : <p className="ne">{empty}</p>}
    </section>
  )
}

/** Demand, value, complexity and confidence of every feature: the paper's own ratings, else our assessment. */
function AssessmentDashboard({ ctx }: { ctx: Ctx }) {
  const { view, marks, go } = ctx
  const list = useMemo(() => [...view.features.values()].filter(f => !markOf(marks, f.id).mergedInto), [view, marks])
  const a = useMemo(() => assessmentStats(list), [list])
  return (
    <section className="assessment" aria-label="Assessment">
      <h2 className="group-head">Assessment: demand, value, complexity, confidence</h2>
      <p className="alert info"><Icon name="info" className="sm" /><span><strong className="num">{list.length - a.unrated} of {list.length}</strong> features rated: <strong>{a.ratedByPaper}</strong> by the paper itself, <strong>{a.assessed}</strong> assessed here from the paper’s evidence with the paper’s own method (marked <abbr className="assessed">A</abbr>). Value = core relevance 30 % · demand 20 % · UX 20 % · competitor adoption 15 % · differentiation 10 % · downstream leverage 5 %, each 1–5. Assessments are judgements, not research results; open a feature for its scores and rationale.</span></p>
      <div className="table-wrap"><table className="cut matrix" aria-label="Value by complexity">
        <caption>Value (rows) × complexity (columns) — number of features; pick a cell to list them</caption>
        <thead><tr><th>Value</th>{COMPLEXITY_SCALE.map(c => <th key={c}>{c}</th>)}</tr></thead>
        <tbody>{a.matrix.map(r => (
          <tr key={r.band}><th scope="row" className="num">{r.label}</th>{r.cells.map(c => (
            <td key={c.complexity} className={`cell v${r.band.replace('.', '')} c${(COMPLEXITY_SCALE as readonly string[]).indexOf(c.complexity)}`}>
              {c.ids.length ? <button type="button" className="cell-btn num" title={c.ids.map(id => view.features.get(id)?.name).join('\n')} aria-label={`${c.ids.length} features with value ${r.label} and ${c.complexity} complexity`} onClick={() => go('features', { valueBand: r.band, complexity: c.complexity, showMerged: false })}>{c.ids.length}</button> : <span className="ne">·</span>}
            </td>))}</tr>
        ))}</tbody>
      </table></div>
      <div className="overview-cols four">
        <Dist title="Demand" rows={a.byDemand} onPick={k => go('features', { demand: k })} />
        <Dist title="Value (1–5)" rows={a.byValue} onPick={k => go('features', { valueBand: k })} />
        <Dist title="Complexity" rows={a.byComplexity} onPick={k => go('features', { complexity: k })} />
        <Dist title="Confidence in the evidence" rows={a.byConfidence} onPick={k => go('features', { confidence: k })} />
      </div>
      <div className="overview-cols">
        <RankedList ctx={ctx} title="Highest value" items={a.top} empty="No rated features." />
        <RankedList ctx={ctx} title="Quick wins (value ≥ 4.0, complexity Medium or lower)" items={a.quickWins} empty="None." />
        <RankedList ctx={ctx} title="High value, weak evidence (check before committing)" items={a.weakEvidence} empty="Every feature valued 4.0 or more has at least medium confidence." />
      </div>
    </section>
  )
}

// ── Explorer ────────────────────────────────────────────────────────────────────────────────────────────────────

const SORTS: [SortKey, string][] = [['research', 'Research rank'], ['name', 'Name'], ['category', 'Category'], ['impact', 'Value 1–5 (impact)'], ['demand', 'Demand'], ['complexity', 'Complexity (low first)'], ['confidence', 'Confidence'], ['priority', 'Research priority'], ['selection', 'Your decision'], ['yours', 'Your priority']]
const GROUPS: [GroupBy, string][] = [['category', 'Category'], ['parent', 'Parent feature'], ['priority', 'Research priority'], ['selection', 'Your decision'], ['none', 'No grouping']]

function SelectionSelect({ id, value, label }: { id: string; value: Selection; label?: string }) {
  return (
    <select aria-label={label ?? 'Your decision'} className={`sel-${value}`} value={value} onChange={e => setMarks([id], { selection: e.target.value as Selection })}>
      {SELECTIONS.map(s => <option key={s} value={s}>{SELECTION_LABEL[s]}</option>)}
    </select>
  )
}
function ImplementationSelect({ id, value }: { id: string; value: Implementation }) {
  return (
    <select aria-label="Implementation status" value={value} onChange={e => setMarks([id], { implementation: e.target.value as Implementation })}>
      {IMPLEMENTATIONS.map(s => <option key={s} value={s}>{IMPLEMENTATION_LABEL[s]}</option>)}
    </select>
  )
}

function Explorer({ ctx, query, setQuery }: { ctx: Ctx; query: FeatureQuery; setQuery: (q: FeatureQuery) => void }) {
  const { view, marks, open, picked, togglePick, setPicked } = ctx
  const [sort, setSort] = useState<SortKey>('research')
  const [desc, setDesc] = useState(false)
  const [group, setGroup] = useState<GroupBy>('category')
  const [bulk, setBulk] = useState<Selection | ''>('')
  const q = (patch: Partial<FeatureQuery>) => setQuery({ ...query, ...patch })
  const list = useMemo(() => sortFeatures(filterFeatures(view, marks, query), sort, marks, desc), [view, marks, query, sort, desc])
  const groups = useMemo(() => groupFeatures(list, group, view, marks), [list, group, view, marks])
  const priorities = useMemo(() => [...new Set([...view.features.values()].map(f => f.priority))].sort(), [view])
  const pickedHere = picked.filter(id => view.features.has(id))
  return (
    <div className="explorer">
      <div className="catalog-toolbar research-toolbar">
        <label className="search"><Icon name="search" className="sm" /><input type="search" placeholder="Search features, e.g. snapping, countertop, BOM" aria-label="Search features" value={query.q} onChange={e => q({ q: e.target.value })} /></label>
        <select aria-label="Category" value={query.category} onChange={e => q({ category: e.target.value })}><option value="">All categories</option>{view.categories.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}</select>
        <select aria-label="Filter by your decision" value={query.selection} onChange={e => q({ selection: e.target.value as Selection | '' })}><option value="">Any decision</option>{SELECTIONS.map(s => <option key={s} value={s}>{SELECTION_LABEL[s]}</option>)}</select>
        <select aria-label="Filter by implementation status" value={query.implementation} onChange={e => q({ implementation: e.target.value as Implementation | '' })}><option value="">Any implementation</option>{IMPLEMENTATIONS.map(s => <option key={s} value={s}>{IMPLEMENTATION_LABEL[s]}</option>)}</select>
        <select aria-label="Research priority" value={query.priority} onChange={e => q({ priority: e.target.value })}><option value="">Any research priority</option>{priorities.map(p => <option key={p} value={p}>{p}</option>)}</select>
        <select aria-label="Origin" value={query.origin} onChange={e => q({ origin: e.target.value as FeatureQuery['origin'] })}><option value="">Named or inferred</option><option value="explicit">Named in the research</option><option value="inferred">Inferred opportunities</option></select>
        <select aria-label="Demand" value={query.demand} onChange={e => q({ demand: e.target.value })}><option value="">Any demand</option>{[...DEMAND_SCALE, 'Indirect / emerging'].map(d => <option key={d} value={d}>{d}</option>)}</select>
        <select aria-label="Value" value={query.valueBand} onChange={e => q({ valueBand: e.target.value })}><option value="">Any value</option>{VALUE_BANDS.map(([k, l]) => <option key={k} value={k}>Value {l}</option>)}</select>
        <select aria-label="Complexity" value={query.complexity} onChange={e => q({ complexity: e.target.value })}><option value="">Any complexity</option>{COMPLEXITY_SCALE.map(c => <option key={c} value={c}>{c}</option>)}</select>
        <select aria-label="Confidence" value={query.confidence} onChange={e => q({ confidence: e.target.value })}><option value="">Any confidence</option>{[...CONFIDENCE_SCALE].reverse().map(c => <option key={c} value={c}>{c}</option>)}</select>
        <select aria-label="Rated by" value={query.rated} onChange={e => q({ rated: e.target.value as FeatureQuery['rated'] })}><option value="">Rated by paper or assessment</option><option value="paper">Rated by the paper</option><option value="assessment">Assessed here (A)</option></select>
        <select aria-label="Evidence" value={query.evidence} onChange={e => q({ evidence: e.target.value as FeatureQuery['evidence'] })}><option value="">Any evidence</option><option value="with">With evidence</option><option value="without">Missing evidence</option></select>
      </div>
      <div className="catalog-actions">
        <label className="toggle small"><input type="checkbox" checked={query.planned} onChange={e => q({ planned: e.target.checked })} /><span>Shortlisted and approved only</span></label>
        <label className="toggle small"><input type="checkbox" checked={query.topLevel} onChange={e => q({ topLevel: e.target.checked })} /><span>Top-level only</span></label>
        <label className="toggle small"><input type="checkbox" checked={query.showMerged} onChange={e => q({ showMerged: e.target.checked })} /><span>Show merged</span></label>
        <label className="inline-field">Group by <select value={group} onChange={e => setGroup(e.target.value as GroupBy)}>{GROUPS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></label>
        <label className="inline-field">Sort by <select value={sort} onChange={e => setSort(e.target.value as SortKey)}>{SORTS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></label>
        <button type="button" className="btn sm" onClick={() => setDesc(!desc)} aria-label={desc ? 'Sort ascending' : 'Sort descending'}>{desc ? '↓ Reversed' : '↑ Normal order'}</button>
        <button type="button" className="btn sm ghost" onClick={() => setQuery(EMPTY_QUERY)}>Clear filters</button>
      </div>
      <p className="hint"><strong className="num">{list.length}</strong> of {view.features.size} features shown.</p>
      {pickedHere.length > 0 && (
        <div className="bulk-bar" role="region" aria-label="Selected features">
          <strong className="num">{pickedHere.length} ticked</strong>
          <label className="inline-field">Set decision <select value={bulk} onChange={e => setBulk(e.target.value as Selection | '')}><option value="">Choose…</option>{SELECTIONS.map(s => <option key={s} value={s}>{SELECTION_LABEL[s]}</option>)}</select></label>
          <button type="button" className="btn sm solid" disabled={!bulk} onClick={() => { if (bulk) { setMarks(pickedHere, { selection: bulk }); setBulk('') } }}>Apply</button>
          <button type="button" className="btn sm" onClick={() => ctx.go('compare')}>Compare</button>
          <button type="button" className="btn sm" onClick={() => download(`feature-spec-${today()}.md`, specMarkdown(view, marks, pickedHere, new Date().toISOString()), 'text/markdown')}><Icon name="download" className="sm" />Export specification</button>
          <button type="button" className="btn sm ghost" onClick={() => setPicked([])}>Untick all</button>
        </div>
      )}
      {list.length === 0 && <p className="empty center"><Icon name="search" />No feature matches these filters.</p>}
      {groups.map(g => {
        const all = g.items.every(f => picked.includes(f.id))
        return (
          <section key={g.key} className="catalog-group" aria-label={g.label}>
            <h2 className="group-head">
              <label className="toggle"><input type="checkbox" aria-label={`Tick every feature in ${g.label}`} checked={all} onChange={e => setPicked(e.target.checked ? [...new Set([...picked, ...g.items.map(f => f.id)])] : picked.filter(id => !g.items.some(f => f.id === id)))} /></label>
              {g.label} <span className="count">{g.items.length}</span>
            </h2>
            <div className="table-wrap">
              <table className="cut features-table">
                <thead><tr><th aria-label="Tick" /><th>Feature</th><th>Category</th><th>Description</th><th>Demand</th><th>Value 1–5 (impact)</th><th>Complexity</th><th>Confidence</th><th>Dependencies</th><th>Your decision</th><th>Implementation</th></tr></thead>
                <tbody>
                  {g.items.map(f => <FeatureRow key={f.id} f={f} ctx={ctx} ticked={picked.includes(f.id)} onTick={on => togglePick(f.id, on)} onOpen={() => open(f.id)} />)}
                </tbody>
              </table>
            </div>
          </section>
        )
      })}
    </div>
  )
}

function FeatureRow({ f, ctx, ticked, onTick, onOpen }: { f: ViewFeature; ctx: Ctx; ticked: boolean; onTick: (on: boolean) => void; onOpen: () => void }) {
  const { view, marks } = ctx
  const m = markOf(marks, f.id)
  const parent = f.parent ? view.features.get(f.parent) : undefined
  return (
    <tr className={m.mergedInto ? 'merged' : ''}>
      <td data-label=""><input type="checkbox" aria-label={`Tick ${f.name}`} checked={ticked} onChange={e => onTick(e.target.checked)} /></td>
      <td data-label="Feature" className="fname">
        <button type="button" className="link" onClick={onOpen}>{f.name}</button>
        <span className="chips">
          {f.rank && <span className="chip subtle">#{f.rank}</span>}
          {f.priority !== 'not evaluated' && <span className="chip">{f.priority}</span>}
          {f.mvp && <span className="chip edited">MVP</span>}
          {f.origin === 'inferred' && <span className="chip safety">Inferred</span>}
          {f.children.length > 0 && <span className="chip subtle">{f.children.length} sub-features</span>}
          {parent && <span className="chip subtle">in {parent.name}</span>}
          {f.retired && <span className="chip reference">Retired</span>}
          {m.mergedInto && <span className="chip reference">Merged</span>}
          {!f.findings.length && <span className="chip safety">No evidence</span>}
        </span>
      </td>
      <td data-label="Category"><span>{catLabel(view, f.category)}<span className="sub">{f.subcategory}</span></span></td>
      <td data-label="Description" className="desc">{f.description}</td>
      <td data-label="Demand"><Rated f={f} dim="demand" /></td>
      <td data-label="Value 1–5 (impact)" className="num"><Rated f={f} dim="impact" /></td>
      <td data-label="Complexity"><Rated f={f} dim="complexity" /></td>
      <td data-label="Confidence"><Rated f={f} dim="confidence" /></td>
      <td data-label="Dependencies">{f.dependencies.length ? f.dependencies.map(d => view.features.get(d)?.name ?? d).join(', ') : <span className="ne">none listed</span>}</td>
      <td data-label="Your decision"><SelectionSelect id={f.id} value={m.selection} label={`Your decision on ${f.name}`} /></td>
      <td data-label="Implementation"><ImplementationSelect id={f.id} value={m.implementation} /></td>
    </tr>
  )
}

// ── Feature detail ──────────────────────────────────────────────────────────────────────────────────────────────

const EVIDENCE_GROUPS: { label: string; kinds: FindingKind[] }[] = [
  { label: 'Demand — user requests', kinds: ['request'] },
  { label: 'Appreciation — praise', kinds: ['praise'] },
  { label: 'Pain points and complaints', kinds: ['complaint'] },
  { label: 'Adoption — competitor implementations', kinds: ['competitor', 'adoption', 'pricing'] },
  { label: 'Ranked and recommended in the research', kinds: ['feature', 'recommendation', 'conclusion', 'strategy'] },
  { label: 'Requirements, workflows and principles', kinds: ['requirement', 'workflow', 'principle', 'example', 'claim'] },
  { label: 'Technical and architecture findings', kinds: ['technical', 'architecture'] },
  { label: 'Caveats, limitations and estimates', kinds: ['caveat', 'limitation', 'estimate', 'methodology', 'source', 'question'] },
]

function List({ items, none = 'not evaluated' }: { items: ReactNode[]; none?: string }) {
  return items.length ? <ul className="detail-list">{items.map((x, i) => <li key={i}>{x}</li>)}</ul> : <p className="ne">{none}</p>
}

function FeatureLink({ ctx, id }: { ctx: Ctx; id: string }) {
  const f = ctx.view.features.get(id)
  return f ? <button type="button" className="link" onClick={() => ctx.open(id)}>{f.name}</button> : <span className="ne">{id} (not in the catalog)</span>
}

function FeatureDetail({ ctx, f, onBack }: { ctx: Ctx; f: ViewFeature; onBack: () => void }) {
  const { view, marks, picked, togglePick } = ctx
  const m = markOf(marks, f.id)
  const [notes, setNotes] = useState(m.notes)
  const [linkTo, setLinkTo] = useState('')
  const parent = f.parent ? view.features.get(f.parent) : undefined
  const subs = descendants(view, f.id)
  const mergedIn = [...view.features.values()].filter(x => markOf(marks, x.id).mergedInto === f.id)
  const findingIds = [...new Set([...f.findings, ...(f.inferredFrom ?? []), ...mergedIn.flatMap(x => x.findings)])]
  const findings = findingIds.map(id => view.findings.get(id)).filter((x): x is ViewFinding => !!x)
  const contra = view.contradictions.filter(c => c.features.includes(f.id))
  const others = useMemo(() => [...view.features.values()].filter(x => x.id !== f.id).sort((a, b) => a.name.localeCompare(b.name)), [view, f.id])
  const ratings: [string, string][] = [['User demand', f.demand], ['Appreciation', f.appreciation], ['Competitor adoption', f.adoption], ['Value (impact) — researcher judgement 1–5', f.impact], ['Implementation complexity', f.complexity], ['Evidence confidence', f.confidence], ['Research priority', f.priority]]
  return (
    <article className="feature-detail" aria-label={f.name}>
      <button type="button" className="btn sm back" onClick={onBack}>← All features</button>
      <header>
        <h2>{f.name}</h2>
        <p className="chips">
          <span className="chip">{catLabel(view, f.category)}</span><span className="chip subtle">{f.subcategory}</span>
          <span className={`chip ${f.origin === 'inferred' ? 'safety' : 'subtle'}`}>{f.origin === 'inferred' ? 'Inferred opportunity' : 'Named in the research'}</span>
          {f.rank && <span className="chip subtle">Ranked #{f.rank} of 39</span>}
          {f.recommendationRank && <span className="chip subtle">Recommendation #{f.recommendationRank} of 15</span>}
          {f.mvp && <span className="chip edited">MVP capability</span>}
          {f.phase && <span className="chip subtle">{f.phase}</span>}
          {f.retired && <span className="chip reference">Retired in the latest edition</span>}
          <span className="chip subtle num">{f.id}</span>
        </p>
        {parent && <p className="hint">Part of <FeatureLink ctx={ctx} id={parent.id} /></p>}
      </header>
      {f.origin === 'inferred' && <p className="alert warning"><Icon name="alert-triangle" className="sm" /><span>This is an opportunity inferred from the findings below — <strong>not a research conclusion</strong>.</span></p>}
      {m.mergedInto && <p className="alert info"><Icon name="info" className="sm" /><span>You merged this feature into <FeatureLink ctx={ctx} id={m.mergedInto} />. Its evidence is shown there too; nothing was deleted. <button type="button" className="link" onClick={() => setMarks([f.id], { mergedInto: undefined })}>Undo merge</button></span></p>}

      <section className="decision card-like" aria-label="Your decision">
        <div className="dims3">
          <div className="field"><label htmlFor="d-sel">Your decision</label><select id="d-sel" value={m.selection} onChange={e => setMarks([f.id], { selection: e.target.value as Selection })}>{SELECTIONS.map(s => <option key={s} value={s}>{SELECTION_LABEL[s]}</option>)}</select></div>
          <div className="field"><label htmlFor="d-impl">Implementation status</label><select id="d-impl" value={m.implementation} onChange={e => setMarks([f.id], { implementation: e.target.value as Implementation })}>{IMPLEMENTATIONS.map(s => <option key={s} value={s}>{IMPLEMENTATION_LABEL[s]}</option>)}</select></div>
          <div className="field"><label htmlFor="d-pri">Your priority</label><select id="d-pri" value={m.priority} onChange={e => setMarks([f.id], { priority: e.target.value as ResearchMark['priority'] })}>{USER_PRIORITIES.map(p => <option key={p} value={p}>{p || 'Not set'}</option>)}</select></div>
        </div>
        <div className="field"><label htmlFor="d-notes">Your notes</label><textarea id="d-notes" rows={3} value={notes} onChange={e => setNotes(e.target.value)} onBlur={() => { if (notes !== m.notes) setMarks([f.id], { notes }) }} placeholder="Saved on this device when you leave the box" /></div>
        <div className="action-row">
          <label className="toggle small"><input type="checkbox" checked={picked.includes(f.id)} onChange={e => togglePick(f.id, e.target.checked)} /><span>Tick for compare and export</span></label>
          {subs.length > 0 && <button type="button" className="btn sm" onClick={() => ctx.setPicked([...new Set([...picked, f.id, ...subs.map(s => s.id)])])}>Tick with all {subs.length} sub-features</button>}
        </div>
        <div className="action-row">
          <label className="inline-field">Link or merge with <select value={linkTo} onChange={e => setLinkTo(e.target.value)}><option value="">Choose a feature…</option>{others.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}</select></label>
          <button type="button" className="btn sm" disabled={!linkTo || m.links.includes(linkTo)} onClick={() => { setMarks([f.id], { links: [...m.links, linkTo] }); setLinkTo('') }}>Add link</button>
          <button type="button" className="btn sm" disabled={!linkTo || linkTo === m.mergedInto} onClick={async () => {
            const target = view.features.get(linkTo)
            if (target && await askConfirm(`Merge “${f.name}” into “${target.name}”? It is hidden from the list and its evidence shows on “${target.name}”. Nothing is deleted; you can undo it.`, { confirmLabel: 'Merge' })) { setMarks([f.id], { mergedInto: linkTo }); setLinkTo('') }
          }}>Merge into it</button>
        </div>
        <p className="hint">Your decision and implementation status are independent. Approving a feature never starts its implementation.</p>
      </section>

      <section aria-label="Description"><h3>Description</h3><p>{f.description}</p>
        <dl className="pairs"><dt>User problem</dt><dd>{ne(f.userProblem)}</dd><dt>User benefit</dt><dd>{ne(f.userBenefit)}</dd>{f.mvp && <><dt>MVP acceptance criterion</dt><dd>{f.mvp}</dd></>}</dl>
      </section>
      <section aria-label="Ratings"><h3>Ratings</h3>
        <div className="table-wrap"><table className="cut ratings-table">
          <thead><tr><th>Rating</th><th>Value</th><th>Source</th></tr></thead>
          <tbody>
            {([['User demand', 'demand'], ['Value (impact), 1–5', 'impact'], ['Implementation complexity', 'complexity'], ['Evidence confidence', 'confidence'], ['Competitor adoption', 'adoption']] as const).map(([k, d]) => {
              const r = rating(f, d)
              return <tr key={k}><th scope="row">{k}</th><td><Rated f={f} dim={d} /></td><td>{r.source === 'paper' ? 'The paper (ranked table)' : r.source === 'assessment' ? 'Assessment — not from the paper' : '—'}</td></tr>
            })}
            {ratings.filter(([k]) => k === 'Appreciation' || k === 'Research priority').map(([k, v]) => <tr key={k}><th scope="row">{k}</th><td>{ne(v)}</td><td>{v === 'not evaluated' ? 'not rated by the paper; not assessed' : 'The paper (ranked table)'}</td></tr>)}
          </tbody>
        </table></div>
        {f.assessment && (
          <div className="assessment-box">
            <p className="alert warning"><Icon name="alert-triangle" className="sm" /><span><strong>Assessment, not research.</strong> The paper does not rate this feature. These scores apply the paper’s own method (line 71) to the findings linked below. {f.assessment.by}, {f.assessment.date}.</span></p>
            <div className="table-wrap"><table className="cut">
              <thead><tr><th>Criterion</th><th>Weight</th><th>Score (1–5)</th></tr></thead>
              <tbody>{ASSESSMENT_CRITERIA.map(([k, label, w]) => <tr key={k}><th scope="row">{label}</th><td className="num">{Math.round(w * 100)} %</td><td className="num">{f.assessment!.scores[k]}</td></tr>)}
                <tr><th scope="row">Value (weighted)</th><td /><td className="num"><strong>{assessedValue(f.assessment)}</strong></td></tr></tbody>
            </table></div>
            <p><strong>Why:</strong> {f.assessment.rationale}</p>
            {f.assessment.internal && <p className="hint">Internal capability: users do not ask for it by name, so demand reads “Indirect”, as the paper does for its internal rows.</p>}
          </div>
        )}
      </section>
      <div className="detail-cols">
        <section aria-label="Functional requirements"><h3>Functional requirements</h3><List items={f.requirements} /></section>
        <section aria-label="Use cases"><h3>User scenarios</h3><List items={f.useCases} /></section>
        <section aria-label="Workflow"><h3>User workflow</h3>{f.workflow.length ? <ol className="detail-list">{f.workflow.map((w, i) => <li key={i}>{w}</li>)}</ol> : <p className="ne">not evaluated</p>}</section>
        <section aria-label="Technical considerations"><h3>Technical considerations</h3><List items={f.technical} /></section>
        <section aria-label="Sub-features"><h3>Sub-features <span className="count">{subs.length}</span></h3><List none="none" items={subs.map(s => <><FeatureLink ctx={ctx} id={s.id} />{s.parent !== f.id && <span className="hint"> (in {view.features.get(s.parent!)?.name})</span>}</>)} /></section>
        <section aria-label="Dependencies and related"><h3>Dependencies</h3><List none="none listed" items={f.dependencies.map(d => <FeatureLink ctx={ctx} id={d} />)} />
          <h3>Related</h3><List none="none listed" items={[...f.related.map(d => <FeatureLink ctx={ctx} id={d} />), ...m.links.map(d => <><FeatureLink ctx={ctx} id={d} /> <span className="hint">your link</span> <button type="button" className="link danger" onClick={() => setMarks([f.id], { links: m.links.filter(x => x !== d) })}>remove</button></>)]} />
          {mergedIn.length > 0 && <><h3>Merged into this</h3><List items={mergedIn.map(x => <FeatureLink ctx={ctx} id={x.id} />)} /></>}
        </section>
      </div>
      {f.appNotes?.length ? <p className="alert info"><Icon name="info" className="sm" /><span><strong>This app today</strong> (repository observation, not research): {f.appNotes.join(' ')}</span></p> : null}
      <section aria-label="Competitors"><h3>Competitor comparison</h3>
        {f.competitors.length ? <div className="table-wrap"><table className="cut"><thead><tr><th>Product</th><th>Ensemble behaviour</th><th>Praise / complaints</th><th>Confidence</th></tr></thead>
          <tbody>{f.competitors.map(c => { const x = view.competitors.get(c); return <tr key={c}><td data-label="Product"><strong>{x?.name ?? c}</strong><span className="sub">{x?.group}</span></td><td data-label="Behaviour">{x?.behaviour}</td><td data-label="Signal">{x?.signal}</td><td data-label="Confidence">{x?.confidence}</td></tr> })}</tbody></table></div>
          : <p className="ne">No competitor named for this feature.</p>}
      </section>
      {contra.length > 0 && <section aria-label="Contradictions"><h3>Contradictions and conflicts</h3>{contra.map(c => <ContradictionCard key={c.id} ctx={ctx} c={c} />)}</section>}
      <section aria-label="Research evidence"><h3>Research evidence <span className="count">{findings.length}</span></h3>
        {findings.length === 0 && <p className="alert warning"><Icon name="alert-triangle" className="sm" /><span>No supporting finding is linked to this feature.</span></p>}
        {EVIDENCE_GROUPS.map(g => { const items = findings.filter(x => g.kinds.includes(x.kind)); return items.length ? <div key={g.label} className="evidence-group"><h4>{g.label} <span className="count">{items.length}</span></h4>{items.map(x => <FindingCard key={x.id} ctx={ctx} f={x} showFeatures={false} />)}</div> : null })}
      </section>
    </article>
  )
}

// ── Findings ────────────────────────────────────────────────────────────────────────────────────────────────────

function citationsOf(view: CatalogView, f: ViewFinding) {
  return f.allRefs.map(r => ({ id: r, c: view.citations.get(`${f.doc}#${r}`) }))
}

function FindingCard({ ctx, f, showFeatures = true }: { ctx: Ctx; f: ViewFinding; showFeatures?: boolean }) {
  const { view, marks } = ctx
  const doc = view.documents.find(d => d.doc.id === f.doc)?.doc
  const section = view.sections.find(s => s.id === f.section)
  const linked = [...view.features.values()].filter(x => x.findings.includes(f.id) || x.inferredFrom?.includes(f.id))
  const reviewed = !!marks[f.id]?.reviewed
  return (
    <div className={`finding ${f.polarity ?? ''}`}>
      <p className="finding-head">
        <span className={`chip ${f.kind === 'complaint' ? 'safety' : f.kind === 'praise' ? '' : 'subtle'}`}>{FINDING_KIND_LABEL[f.kind]}</span>
        {f.polarity && <span className="chip subtle">{f.polarity}</span>}
        {f.quality && <span className="chip subtle">evidence: {f.quality}</span>}
        <span className="src num">{doc?.file ?? f.doc} · lines {f.lines[0]}{f.lines[1] !== f.lines[0] ? `–${f.lines[1]}` : ''} · {section?.title}</span>
        <label className="toggle small reviewed"><input type="checkbox" checked={reviewed} onChange={e => setMarks([f.id], { reviewed: e.target.checked })} /><span>Reviewed</span></label>
      </p>
      <p className="statement">{f.statement}</p>
      {f.excerpt && <details><summary>Original text</summary><blockquote className="excerpt">{f.excerpt}</blockquote></details>}
      {f.allRefs.length > 0 && <p className="cites">{citationsOf(view, f).map(({ id, c }) => <span key={id} className="cite"><span className="num">[{id}]</span> {c ? c.urls.map(u => <a key={u} href={u} target="_blank" rel="noreferrer noopener">{new URL(u).hostname.replace(/^www\./, '')}</a>) : <span className="ne">no record</span>}</span>)}</p>}
      {(f.competitors?.length ?? 0) > 0 && <p className="hint">Competitors: {f.competitors!.map(c => view.competitors.get(c)?.name ?? c).join(', ')}</p>}
      {showFeatures && <p className="hint">Features: {linked.length ? linked.map((x, i) => <Fragment key={x.id}>{i > 0 && ', '}<FeatureLink ctx={ctx} id={x.id} /></Fragment>) : <span className="ne">none — kept as supporting research</span>}</p>}
      <span className="sub num">{f.id}</span>
    </div>
  )
}

const FINDING_FILTERS: [string, string, (f: ViewFinding, linked: boolean) => boolean][] = [
  ['all', 'All', () => true], ['pain', 'Pain points', f => f.kind === 'complaint'], ['requests', 'User requests', f => f.kind === 'request'],
  ['praise', 'Praise', f => f.kind === 'praise'], ['conclusions', 'Conclusions and recommendations', f => ['conclusion', 'recommendation', 'strategy'].includes(f.kind)],
  ['technical', 'Technical observations', f => ['technical', 'architecture', 'principle'].includes(f.kind)],
  ['caveats', 'Caveats and limitations', f => ['caveat', 'limitation', 'estimate'].includes(f.kind)], ['method', 'Method and sources', f => ['methodology', 'source', 'question'].includes(f.kind)],
  ['supporting', 'Not linked to a feature', (_f, linked) => !linked],
]

function Findings({ ctx }: { ctx: Ctx }) {
  const { view, marks } = ctx
  const [filter, setFilter] = useState('all')
  const [section, setSection] = useState('')
  const [unreviewed, setUnreviewed] = useState(false)
  const [text, setText] = useState('')
  const linked = useMemo(() => new Set([...view.features.values()].flatMap(f => [...f.findings, ...(f.inferredFrom ?? [])])), [view])
  const test = FINDING_FILTERS.find(x => x[0] === filter)![2]
  const words = text.trim().toLowerCase()
  const list = [...view.findings.values()].filter(f => test(f, linked.has(f.id)) && (!section || f.section === section) && (!unreviewed || !marks[f.id]?.reviewed) && (!words || `${f.statement} ${f.excerpt}`.toLowerCase().includes(words)))
  return (
    <div className="findings">
      <div className="catalog-toolbar">
        <label className="search"><Icon name="search" className="sm" /><input type="search" placeholder="Search findings and original text" aria-label="Search findings" value={text} onChange={e => setText(e.target.value)} /></label>
        <select aria-label="Section" value={section} onChange={e => setSection(e.target.value)}><option value="">All sections</option>{view.sections.map(s => <option key={s.id} value={s.id}>{s.title}</option>)}</select>
        <label className="toggle small"><input type="checkbox" checked={unreviewed} onChange={e => setUnreviewed(e.target.checked)} /><span>Unreviewed only</span></label>
      </div>
      <div className="group-index" role="group" aria-label="Kind of finding">{FINDING_FILTERS.map(([k, l]) => <button key={k} type="button" className={`pill ${filter === k ? 'on' : ''}`} aria-pressed={filter === k} onClick={() => setFilter(k)}>{l}</button>)}</div>
      <p className="hint"><strong className="num">{list.length}</strong> of {view.findings.size} findings. Tick “Reviewed” as you read; the Overview counts what is left.</p>
      {list.length > 0 && <button type="button" className="btn sm" onClick={() => setMarks(list.map(f => f.id), { reviewed: true })}>Mark these {list.length} as reviewed</button>}
      {list.map(f => <FindingCard key={f.id} ctx={ctx} f={f} />)}
    </div>
  )
}

// ── Competitors, contradictions, sources ────────────────────────────────────────────────────────────────────────

function Competitors({ ctx }: { ctx: Ctx }) {
  const { view } = ctx
  return (
    <div className="competitors">
      <p className="hint">{view.competitors.size} products, as compared in the research. Confidence is the paper’s own evidence rating.</p>
      <div className="fam-grid">
        {[...view.competitors.values()].map(c => (
          <article key={c.id} className="fam-card" aria-label={c.name}>
            <h3>{c.name}</h3>
            <p className="chips"><span className="chip subtle">{c.group}</span><span className="chip">{c.confidence}</span></p>
            <dl className="pairs"><dt>Ensemble behaviour</dt><dd>{c.behaviour}</dd><dt>Praise / complaints / missing</dt><dd>{c.signal}</dd><dt>Commercial model</dt><dd>{c.commercial}</dd></dl>
            <p className="hint">{c.findings.length} findings · line {c.line}</p>
            {c.features.length > 0 && <details><summary>{c.features.length} related features</summary><ul className="detail-list">{c.features.map(id => <li key={id}><FeatureLink ctx={ctx} id={id} /></li>)}</ul></details>}
          </article>
        ))}
      </div>
    </div>
  )
}

const BASIS = { paper: 'Stated in the paper', inferred: 'Inferred tension (not stated by the paper)', app: 'Research vs this app' } as const
function ContradictionCard({ ctx, c }: { ctx: Ctx; c: CatalogView['contradictions'][number] }) {
  return (
    <div className="finding contradiction">
      <p className="finding-head"><span className={`chip ${c.basis === 'paper' ? 'subtle' : 'safety'}`}>{BASIS[c.basis]}</span><strong>{c.title}</strong></p>
      <p className="statement">{c.description}</p>
      <p className="hint">Findings: {c.findings.map(id => { const f = ctx.view.findings.get(id); return f ? `${id.replace(/^.*\.n\./, '')} (lines ${f.lines[0]}${f.lines[1] !== f.lines[0] ? `–${f.lines[1]}` : ''})` : id }).join(' · ')}</p>
      <p className="hint">Features: {c.features.map((id, i) => <Fragment key={id}>{i > 0 && ', '}<FeatureLink ctx={ctx} id={id} /></Fragment>)}</p>
    </div>
  )
}
function Contradictions({ ctx }: { ctx: Ctx }) {
  return <div className="contradictions"><p className="hint">Conflicting estimates, mixed evidence and conflicts with this app’s decisions are kept side by side; none is resolved for you.</p>{ctx.view.contradictions.map(c => <ContradictionCard key={c.id} ctx={ctx} c={c} />)}</div>
}

function Sources({ ctx }: { ctx: Ctx }) {
  const { view } = ctx
  const groups = [...new Set(view.bibliography.map(b => b.group))]
  const used = useMemo(() => { const m = new Map<string, string[]>(); for (const f of view.findings.values()) for (const r of f.allRefs) m.set(`${f.doc}#${r}`, [...(m.get(`${f.doc}#${r}`) ?? []), f.id]); return m }, [view])
  return (
    <div className="sources">
      {view.documents.map(d => <p key={d.doc.id} className="alert info"><Icon name="catalog" className="sm" /><span><strong>{d.doc.title}</strong> — research snapshot {d.doc.date}, edition {d.versions.join(', ')}{d.doc.file ? <> · <span className="num">{d.doc.file}</span></> : null}. {d.doc.question}</span></p>)}
      <h2 className="group-head">Bibliography <span className="count">{view.bibliography.length}</span></h2>
      {groups.map(g => (
        <section key={g} aria-label={g}><h3>{g}</h3>
          <ul className="detail-list">{view.bibliography.filter(b => b.group === g).map(b => <li key={b.id}><a href={b.url} target="_blank" rel="noreferrer noopener">{b.title}</a> — {b.note} <span className="hint num">line {b.line}</span></li>)}</ul>
        </section>
      ))}
      <h2 className="group-head">Citations <span className="count">{view.citations.size}</span></h2>
      <p className="hint">URLs and original citation ids are listed as the paper writes them; the original ids are often not in URL order, so do not pair them by position.</p>
      <div className="table-wrap"><table className="cut citations">
        <thead><tr><th>Citation</th><th>Sources</th><th>Original ids</th><th>Used by</th></tr></thead>
        <tbody>{[...view.citations.entries()].map(([k, c]) => <tr key={k}><td data-label="Citation" className="num">{c.id} · line {c.line}</td><td data-label="Sources">{c.urls.map(u => <a key={u} href={u} target="_blank" rel="noreferrer noopener" className="url">{u}</a>)}</td><td data-label="Original ids" className="num">{c.originalIds.join(', ')}</td><td data-label="Used by" className="num">{(used.get(k) ?? []).map(x => x.replace(/^.*\.n\./, '')).join(', ') || '—'}</td></tr>)}</tbody>
      </table></div>
    </div>
  )
}

// ── Coverage audit ──────────────────────────────────────────────────────────────────────────────────────────────

function Coverage({ ctx }: { ctx: Ctx }) {
  const reports = useMemo(() => ctx.view.documents.map(d => coverage(d.latest)), [ctx.view])
  return (
    <div className="coverage">
      {reports.map(r => {
        const total = r.sections.reduce((n, s) => n + s.total, 0)
        const complete = r.sections.every(s => s.status === 'complete') && r.checks.every(c => c.ok)
        return (
          <section key={r.doc.id} aria-label={`Coverage of ${r.doc.title}`}>
            <h2 className="group-head">{r.doc.title} <span className="count">edition {r.doc.version}</span></h2>
            <p className={`alert ${complete ? 'ok' : 'warning'}`}><Icon name={complete ? 'check' : 'alert-triangle'} className="sm" /><span><strong className="num">{r.coveredLines} of {total}</strong> content lines are held by a record. {complete ? 'Extraction complete: every section is accounted for and every check passes.' : 'Extraction has gaps — see the warnings below.'}</span></p>
            <h3>Second pass — integrity checks</h3>
            <ul className="checks">{r.checks.map(c => <li key={c.id} className={c.ok ? 'ok' : 'bad'}><Icon name={c.ok ? 'check' : 'alert-circle'} className="sm" /><span><strong>{c.label}</strong> — {c.detail}</span></li>)}</ul>
            <h3>By section</h3>
            <div className="table-wrap"><table className="cut coverage-table">
              <thead><tr><th>Section</th><th>Lines</th><th>Covered</th><th>Findings</th><th>Features</th><th>Supporting records</th><th>Supporting-only findings</th><th>Warnings</th><th>Status</th></tr></thead>
              <tbody>{r.sections.map(s => (
                <tr key={s.section.id}>
                  <td data-label="Section">{s.section.parent ? '↳ ' : ''}{s.section.title}</td>
                  <td data-label="Lines" className="num">{s.section.lines[0]}–{s.section.lines[1]}</td>
                  <td data-label="Covered" className="num">{s.covered}/{s.total}</td>
                  <td data-label="Findings"><details><summary className="num">{s.findings.length}</summary><span className="num ids">{s.findings.join(', ')}</span></details></td>
                  <td data-label="Features"><details><summary className="num">{s.features.length}</summary><span className="ids">{s.features.map((id, i) => <Fragment key={id}>{i > 0 && ', '}<FeatureLink ctx={ctx} id={id} /></Fragment>)}</span></details></td>
                  <td data-label="Supporting records"><details><summary className="num">{s.supporting.length}</summary><span className="num ids">{s.supporting.join(', ')}</span></details></td>
                  <td data-label="Supporting-only findings" className="num" title="Findings kept as research records without a feature (method, caveats, sources)">{s.supportingOnly.length ? s.supportingOnly.map(x => x.replace(/^.*\.n\./, '')).join(', ') : '—'}</td>
                  <td data-label="Warnings">{s.warnings.length ? s.warnings.join(' · ') : '—'}</td>
                  <td data-label="Status"><span className={`chip ${s.status === 'complete' ? '' : 'safety'}`}>{s.status === 'complete' ? 'Complete' : s.status === 'no-text' ? 'Text not stored' : 'Partial'}</span></td>
                </tr>
              ))}</tbody>
            </table></div>
            <h3>UNEXTRACTED</h3>
            {ctx.view.unextracted.filter(u => u.doc === r.doc.id).length
              ? <ul className="detail-list">{ctx.view.unextracted.filter(u => u.doc === r.doc.id).map(u => <li key={u.id}>UNEXTRACTED lines {u.lines[0]}–{u.lines[1]}: {u.reason}</li>)}</ul>
              : <p className="hint">Nothing in this paper is marked UNEXTRACTED.</p>}
          </section>
        )
      })}
    </div>
  )
}

// ── Compare ─────────────────────────────────────────────────────────────────────────────────────────────────────

function Compare({ ctx }: { ctx: Ctx }) {
  const { view, marks, picked, togglePick } = ctx
  const list = picked.map(id => view.features.get(id)).filter((f): f is ViewFeature => !!f)
  if (!list.length) return <p className="empty center"><Icon name="grid" />Tick features in the Features list (or “Tick for compare” on a feature) to compare them side by side.</p>
  const rows: [string, (f: ViewFeature) => ReactNode][] = [
    ['Category', f => `${catLabel(view, f.category)} › ${f.subcategory}`], ['Origin', f => (f.origin === 'inferred' ? 'Inferred opportunity' : 'Named in the research')],
    ['Your decision', f => <SelectionSelect id={f.id} value={markOf(marks, f.id).selection} label={`Your decision on ${f.name}`} />], ['Implementation', f => <ImplementationSelect id={f.id} value={markOf(marks, f.id).implementation} />],
    ['Your priority', f => markOf(marks, f.id).priority || '—'], ['Research priority', f => ne(f.priority)], ['Value 1–5 (impact)', f => <Rated f={f} dim="impact" />],
    ['Demand', f => <Rated f={f} dim="demand" />], ['Appreciation', f => ne(f.appreciation)], ['Competitor adoption', f => <Rated f={f} dim="adoption" />], ['Complexity', f => <Rated f={f} dim="complexity" />],
    ['Confidence', f => <Rated f={f} dim="confidence" />], ['Assessment rationale', f => f.assessment?.rationale ?? 'Rated by the paper'], ['Phase', f => f.phase ?? '—'], ['MVP criterion', f => f.mvp ?? '—'],
    ['Dependencies', f => f.dependencies.map(d => view.features.get(d)?.name ?? d).join(', ') || '—'], ['Sub-features', f => String(descendants(view, f.id).length)],
    ['Competitors', f => f.competitors.map(c => view.competitors.get(c)?.name ?? c).join(', ') || '—'], ['Findings', f => String(f.findings.length)],
    ['Description', f => f.description], ['Your notes', f => markOf(marks, f.id).notes || '—'],
  ]
  return (
    <div className="compare">
      <div className="action-row">
        <button type="button" className="btn sm" onClick={() => download(`feature-spec-${today()}.md`, specMarkdown(view, marks, list.map(f => f.id), new Date().toISOString()), 'text/markdown')}><Icon name="download" className="sm" />Export specification of these {list.length}</button>
        <button type="button" className="btn sm ghost" onClick={() => ctx.setPicked([])}>Untick all</button>
      </div>
      <div className="table-wrap"><table className="cut compare-table">
        <thead><tr><th>Field</th>{list.map(f => <th key={f.id}><button type="button" className="link" onClick={() => ctx.open(f.id)}>{f.name}</button> <button type="button" className="btn icon ghost sm" aria-label={`Remove ${f.name} from the comparison`} onClick={() => togglePick(f.id, false)}><Icon name="x" className="sm" /></button></th>)}</tr></thead>
        <tbody>{rows.map(([label, get]) => <tr key={label}><th scope="row">{label}</th>{list.map(f => <td key={f.id}>{get(f)}</td>)}</tr>)}</tbody>
      </table></div>
    </div>
  )
}

// ── Import & export ─────────────────────────────────────────────────────────────────────────────────────────────

const STATUS_TEXT: Record<ImportPlan['status'], string> = {
  invalid: 'Not imported: the file has problems.', 'new-document': 'New paper.', 'new-version': 'New edition of a paper already here.',
  unchanged: 'Already imported; nothing changed.', conflict: 'Not imported: this edition is already stored with different content.', 'older-version': 'Older edition; kept as history, the newer one stays in use.',
}

function ImportExport({ ctx }: { ctx: Ctx }) {
  const { view, marks } = ctx
  const [plan, setPlan] = useState<ImportPlan | null>(null)
  const [pending, setPending] = useState<unknown>(null)
  const [msg, setMsg] = useState<string | null>(null)
  const readJson = async (file: File): Promise<unknown> => { try { return JSON.parse(await file.text()) } catch { return null } }
  const chooseBundle = async (file: File) => {
    const data = await readJson(file)
    const { planImport } = await import('../core/research/catalog')
    const p = planImport(useResearch.getState().stored, data, marks)
    if (data === null) p.errors = ['That file is not JSON.']
    setPlan(p); setPending(p.store ? data : null); setMsg(null)
  }
  const shortlisted = [...view.features.values()].filter(f => { const s = markOf(marks, f.id).selection; return s === 'shortlisted' || s === 'approved' }).map(f => f.id)
  return (
    <div className="import-export">
      <section aria-label="Export"><h2 className="group-head">Export</h2>
        <div className="action-row">
          <button type="button" className="btn sm" disabled={!shortlisted.length} onClick={() => download(`feature-spec-${today()}.md`, specMarkdown(view, marks, shortlisted, new Date().toISOString()), 'text/markdown')}><Icon name="download" className="sm" />Specification of shortlisted + approved ({shortlisted.length})</button>
          <button type="button" className="btn sm" onClick={() => download(`research-decisions-${today()}.json`, JSON.stringify({ kind: 'furniture-builder-research-decisions', marks: Object.values(marks) }, null, 2), 'application/json')}><Icon name="download" className="sm" />My decisions and notes ({Object.keys(marks).length})</button>
          {view.documents.map(d => <button key={d.doc.id} type="button" className="btn sm" onClick={() => download(`${d.doc.id}-v${d.doc.version}.research.json`, JSON.stringify(d.latest, null, 2), 'application/json')}><Icon name="download" className="sm" />Research file: {d.doc.title.slice(0, 40)}{d.doc.title.length > 40 ? '…' : ''}</button>)}
        </div>
        <p className="hint">The research file is also the import format: copy it, change the document id (a new paper) or raise its version (a new edition), and import it.</p>
      </section>
      <section aria-label="Import a research paper"><h2 className="group-head">Import a research paper</h2>
        <p className="hint">A structured research file (JSON, format “furniture-builder-research”). Importing never changes your decisions: they are stored separately and keyed by feature id. The same feature id in another paper adds its evidence; features dropped by a new edition stay, marked retired. Automatic reading of PDFs or free text is not supported — the paper must be turned into this format first.</p>
        <label className="btn sm file-btn"><Icon name="upload" className="sm" />Choose a research file
          <input type="file" accept="application/json,.json" onChange={e => { const file = e.target.files?.[0]; if (file) void chooseBundle(file); e.target.value = '' }} />
        </label>
        {plan && (
          <div className={`alert ${plan.errors.length ? 'error' : 'info'}`} role="status"><Icon name={plan.errors.length ? 'alert-circle' : 'info'} className="sm" />
            <div>
              <p><strong>{STATUS_TEXT[plan.status]}</strong> {plan.docId && <span className="num">{plan.docId} edition {plan.version}</span>}</p>
              {plan.errors.length > 0 && <ul className="detail-list">{plan.errors.slice(0, 12).map(e => <li key={e}>{e}</li>)}{plan.errors.length > 12 && <li>… {plan.errors.length - 12} more</li>}</ul>}
              {plan.store && <ul className="detail-list">
                <li>{plan.added.length} new features, {plan.changed.length} changed, {plan.retired.length} retired (kept).</li>
                <li>{plan.mergedEvidence.length} features already in the catalog from another paper get this paper’s evidence.</li>
                {plan.possibleDuplicates.length > 0 && <li>Possible duplicates (same name, different id — merge them on the feature page if they are the same): {plan.possibleDuplicates.map(([a, b]) => `${a} ≈ ${b}`).join('; ')}</li>}
                <li>{plan.decisionsKept} of your decisions on these features stay exactly as they are.</li>
              </ul>}
              {pending !== null && <div className="action-row"><button type="button" className="btn sm primary" onClick={async () => { const p = await useResearch.getState().importBundle(pending); setPending(null); setPlan(null); setMsg(`${STATUS_TEXT[p.status]} ${p.docId} edition ${p.version} stored on this device.`) }}>Import it</button><button type="button" className="btn sm" onClick={() => { setPending(null); setPlan(null) }}>Cancel</button></div>}
            </div>
          </div>
        )}
        {msg && <p className="alert ok" role="status"><Icon name="check" className="sm" /><span>{msg}</span></p>}
      </section>
      <section aria-label="Import decisions"><h2 className="group-head">Import decisions</h2>
        <p className="hint">Decisions exported from another device are added; where you already have a decision for the same record, yours is kept.</p>
        <label className="btn sm file-btn"><Icon name="upload" className="sm" />Choose a decisions file
          <input type="file" accept="application/json,.json" onChange={async e => {
            const file = e.target.files?.[0]; e.target.value = ''
            if (!file) return
            const data = await readJson(file) as { marks?: unknown[] } | null
            if (!data || !Array.isArray(data.marks)) { setMsg('That file is not a decisions file.'); return }
            const r = await useResearch.getState().importMarks(data.marks)
            setMsg(`${r.added} decisions added, ${r.kept} kept as they were on this device${r.invalid ? `, ${r.invalid} skipped (not valid)` : ''}.`)
          }} />
        </label>
      </section>
      <section aria-label="Stored editions"><h2 className="group-head">Papers on this device</h2>
        <ul className="detail-list">{view.documents.map(d => <li key={d.doc.id}><strong>{d.doc.title}</strong> — <span className="num">{d.doc.id}</span>, editions {d.versions.join(', ')} (latest in use), snapshot {d.doc.date}, stored {d.importedAt.slice(0, 10)}</li>)}</ul>
      </section>
    </div>
  )
}
