import { Fragment, useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  APPRECIATION_KEYS,
  assessedValue,
  assessmentStats,
  implementationOf,
  implementationSource,
  mergedOf,
  UNMERGED,
  buildView,
  DEMAND_SCALE,
  descendants,
  EMPTY_QUERY,
  filterFeatures,
  groupFeatures,
  markOf,
  rating,
  sortFeatures,
  stats,
  VALUE_BANDS,
  type CatalogView,
  type RatingDim,
  type FeatureQuery,
  type GroupBy,
  type SortKey,
  type ViewFeature,
  type ViewFinding,
} from '../core/research/catalog';
import {
  ASSESSMENT_CRITERIA,
  COMPLEXITY_SCALE,
  CONFIDENCE_SCALE,
  FINDING_KIND_LABEL,
  IMPLEMENTATION_LABEL,
  IMPLEMENTATIONS,
  SELECTION_LABEL,
  SELECTIONS,
  USER_PRIORITIES,
  type FindingKind,
  type Implementation,
  type ResearchMark,
  type Selection,
} from '../core/research/types';
import { APP_CHECKED } from '../core/research/ensemble-2026-10-23.app';
import { useResearch, type MarkPatch } from '../store/researchStore';
import { askConfirm } from './Confirm';
import { Icon } from './icons';

/** Features (with the assessment dashboard above the list) and Competitors (ADR-110). */
export type Tab = 'features' | 'competitors';
const TABS: [Tab, string][] = [
  ['features', 'Features'],
  ['competitors', 'Competitors'],
];

const ne = (s: string) =>
  s === 'not evaluated' || s === 'unknown' ? <span className="ne">{s}</span> : s;
/** A rating with its source: the paper's own words, or our assessment marked "A" (never shown as research). */
function Rated({ f, dim }: { f: ViewFeature; dim: RatingDim }) {
  const r = rating(f, dim);
  if (r.source === 'none') return <span className="ne">{r.value}</span>;
  return (
    <span className={`rated ${r.source}`}>
      {r.value}
      {r.source === 'assessment' && (
        <abbr
          className="assessed"
          title="Assessed from the paper's evidence with the paper's method — not a rating in the paper"
        >
          A
        </abbr>
      )}
    </span>
  );
}
const catLabel = (view: CatalogView, id: string) =>
  view.categories.find((c) => c.id === id)?.label ?? id;

/**
 * Feature Research & Catalog (ADR-043): every record extracted from the research papers, searchable and selectable
 * for later work. Reached from the "Feature Research" tab in the top bar or the #research link. Selecting a feature is a
 * planning decision only; nothing here starts an implementation.
 */
export function ResearchPage({
  onDone,
  initialTab = 'features',
  initialDetail = null,
}: {
  onDone: () => void;
  initialTab?: Tab;
  initialDetail?: string | null;
}) {
  const stored = useResearch((s) => s.stored);
  const marks = useResearch((s) => s.marks);
  const error = useResearch((s) => s.error);
  const loaded = useResearch((s) => s.loaded);
  useEffect(() => {
    if (!loaded) void useResearch.getState().init();
  }, [loaded]);
  const view = useMemo(() => buildView(stored), [stored]);
  const [tab, setTab] = useState<Tab>(initialTab);
  const [detail, setDetail] = useState<string | null>(initialDetail);
  const [query, setQuery] = useState<FeatureQuery>(EMPTY_QUERY);
  const open = (id: string) => {
    setDetail(id);
    setTab('features');
    window.scrollTo({ top: 0 });
  };
  const go = (t: Tab, q?: Partial<FeatureQuery>) => {
    if (q) setQuery({ ...EMPTY_QUERY, ...q });
    setDetail(null);
    setTab(t);
    window.scrollTo({ top: 0 });
  };
  const st = useMemo(() => stats(view, marks), [view, marks]);
  const ctx: Ctx = { view, marks, open, go };
  return (
    <main className="catalog-page research-page" aria-label="Feature Research & Catalog">
      <header className="catalog-head">
        <div>
          <h1>Feature Research &amp; Catalog</h1>
          <p className="hint">
            <strong className="num">{st.features} features</strong> ({st.topLevel} features,{' '}
            {st.subfeatures} sub-features) and {st.findings} findings from {view.documents.length}{' '}
            research {view.documents.length === 1 ? 'paper' : 'papers'}. Selecting a feature records
            a decision only — nothing is implemented from here.
          </p>
        </div>
        <button type="button" className="btn outline" onClick={onDone}>
          <Icon name="chevron-right" className="sm" />
          Back to the editor
        </button>
      </header>
      {error && (
        <p className="alert warning" role="status">
          <Icon name="alert-triangle" className="sm" />
          <span>{error}</span>
        </p>
      )}
      <nav className="segmented small research-tabs" role="tablist" aria-label="Research sections">
        {TABS.map(([t, label]) => (
          <button
            key={t}
            type="button"
            role="tab"
            aria-selected={tab === t}
            className={tab === t ? 'on' : ''}
            onClick={() => go(t)}
          >
            {label}
          </button>
        ))}
      </nav>
      {tab === 'features' &&
        (detail && view.features.has(detail) ? (
          <FeatureDetail
            key={detail}
            ctx={ctx}
            f={view.features.get(detail)!}
            onBack={() => setDetail(null)}
          />
        ) : (
          <>
            <AppSummary ctx={ctx} />
            <AssessmentDashboard ctx={ctx} />
            <Explorer ctx={ctx} query={query} setQuery={setQuery} />
          </>
        ))}
      {tab === 'competitors' && <Competitors ctx={ctx} />}
    </main>
  );
}

interface Ctx {
  view: CatalogView;
  marks: Record<string, ResearchMark>;
  open: (id: string) => void;
  go: (t: Tab, q?: Partial<FeatureQuery>) => void;
}
const setMarks = (ids: string[], patch: MarkPatch) =>
  void useResearch.getState().setMarks(ids, patch);

// ── Assessment dashboard ───────────────────────────────────────────────────────────────────────────────────────

function Dist({
  title,
  rows,
  onPick,
}: {
  title: string;
  rows: { key: string; label?: string; n: number }[];
  onPick?: (key: string) => void;
}) {
  const max = Math.max(1, ...rows.map((r) => r.n));
  return (
    <section aria-label={title}>
      <h3>{title}</h3>
      <ul className="bars">
        {rows.map((r) => (
          <li key={r.key}>
            {onPick && r.key !== 'Other' ? (
              <button type="button" className="link" onClick={() => onPick(r.key)}>
                {r.label ?? r.key}
              </button>
            ) : (
              <span>{r.label ?? r.key}</span>
            )}
            <span className="bar-track">
              <span style={{ width: `${(r.n / max) * 100}%` }} />
            </span>
            <span className="num">{r.n}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function RankedList({
  ctx,
  title,
  items,
  empty,
}: {
  ctx: Ctx;
  title: string;
  items: ViewFeature[];
  empty: string;
}) {
  return (
    <section aria-label={title}>
      <h3>
        {title} <span className="count">{items.length}</span>
      </h3>
      {items.length ? (
        <ol className="ranked">
          {items.map((f) => (
            <li key={f.id}>
              <button type="button" className="link" onClick={() => ctx.open(f.id)}>
                {f.name}
              </button>
              <span className="facts">
                Value <Rated f={f} dim="impact" /> · Demand <Rated f={f} dim="demand" /> ·
                Complexity <Rated f={f} dim="complexity" /> · Confidence{' '}
                <Rated f={f} dim="confidence" />
              </span>
            </li>
          ))}
        </ol>
      ) : (
        <p className="ne">{empty}</p>
      )}
    </section>
  );
}

/** What the app has built of the research (ADR-092), from the repository's record or the user's own status. */
function AppSummary({ ctx }: { ctx: Ctx }) {
  const { view, marks, go } = ctx;
  const all = [...view.features.values()];
  const shown = all.filter((f) => !mergedOf(f, marks));
  const n = (s: Implementation) => shown.filter((f) => implementationOf(f, marks) === s).length;
  const left = shown.length - n('implemented') - n('verified');
  return (
    <section className="app-summary" aria-label="Built in this app">
      <h2 className="group-head">Built in this app</h2>
      <p className="alert ok">
        <Icon name="check" className="sm" />
        <span>
          Of {shown.length} features (after {all.length - shown.length} merged as the same idea):{' '}
          <button
            type="button"
            className="link"
            onClick={() => go('features', { implementation: 'verified' })}
          >
            <strong className="num">{n('verified')}</strong> verified
          </button>
          ,{' '}
          <button
            type="button"
            className="link"
            onClick={() => go('features', { implementation: 'implemented' })}
          >
            <strong className="num">{n('implemented')}</strong> implemented
          </button>
          ,{' '}
          <button
            type="button"
            className="link"
            onClick={() => go('features', { implementation: 'in-progress' })}
          >
            <strong className="num">{n('in-progress')}</strong> in progress
          </button>
          ,{' '}
          <button type="button" className="link" onClick={() => go('features', { left: true })}>
            <strong className="num">{left}</strong> left to build
          </button>
          . From the backlog and ADRs (checked {APP_CHECKED}); a status you set yourself wins.{' '}
          <button
            type="button"
            className="link"
            onClick={() => go('features', { showMerged: true, q: '' })}
          >
            See merged features
          </button>
        </span>
      </p>
    </section>
  );
}

/** Demand, value, complexity and confidence of every feature: the paper's own ratings, else our assessment. */
function AssessmentDashboard({ ctx }: { ctx: Ctx }) {
  const { view, marks, go } = ctx;
  const [scope, setScope] = useState<'left' | 'all'>('left');
  const all = useMemo(
    () => [...view.features.values()].filter((f) => !mergedOf(f, marks)),
    [view, marks],
  );
  const built = useMemo(
    () =>
      new Set(
        all
          .filter((f) => ['implemented', 'verified'].includes(implementationOf(f, marks)))
          .map((f) => f.id),
      ),
    [all, marks],
  );
  const list = useMemo(
    () => (scope === 'all' ? all : all.filter((f) => !built.has(f.id))),
    [scope, all, built],
  );
  const a = useMemo(() => assessmentStats(list), [list]);
  return (
    <section className="assessment" aria-label="Assessment">
      <h2 className="group-head">Assessment: demand, value, complexity, confidence</h2>
      <div className="segmented small" role="radiogroup" aria-label="Features in the assessment">
        <button
          type="button"
          role="radio"
          aria-checked={scope === 'left'}
          className={scope === 'left' ? 'on' : ''}
          onClick={() => setScope('left')}
        >
          Left to build ({all.length - built.size})
        </button>
        <button
          type="button"
          role="radio"
          aria-checked={scope === 'all'}
          className={scope === 'all' ? 'on' : ''}
          onClick={() => setScope('all')}
        >
          All features ({all.length})
        </button>
      </div>
      <p className="alert info">
        <Icon name="info" className="sm" />
        <span>
          <strong className="num">
            {list.length - a.unrated} of {list.length}
          </strong>{' '}
          features rated: <strong>{a.ratedByPaper}</strong> by the paper itself,{' '}
          <strong>{a.assessed}</strong> assessed here (demand, appreciation, value, complexity,
          confidence and research priority) from the paper’s evidence with the paper’s own method
          (marked <abbr className="assessed">A</abbr>). Value = core relevance 30 % · demand 20 % ·
          UX 20 % · competitor adoption 15 % · differentiation 10 % · downstream leverage 5 %, each
          1–5. Assessments are judgements, not research results; open a feature for its scores and
          rationale.
        </span>
      </p>
      <div className="table-wrap">
        <table className="cut matrix" aria-label="Value by complexity">
          <caption>
            Value (rows) × complexity (columns) — number of features; pick a cell to list them
          </caption>
          <thead>
            <tr>
              <th>Value</th>
              {COMPLEXITY_SCALE.map((c) => (
                <th key={c}>{c}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {a.matrix.map((r) => (
              <tr key={r.band}>
                <th scope="row" className="num">
                  {r.label}
                </th>
                {r.cells.map((c) => (
                  <td
                    key={c.complexity}
                    className={`cell v${r.band.replace('.', '')} c${(COMPLEXITY_SCALE as readonly string[]).indexOf(c.complexity)}`}
                  >
                    {c.ids.length ? (
                      <button
                        type="button"
                        className="cell-btn num"
                        title={c.ids.map((id) => view.features.get(id)?.name).join('\n')}
                        aria-label={`${c.ids.length} features with value ${r.label} and ${c.complexity} complexity`}
                        onClick={() =>
                          go('features', {
                            valueBand: r.band,
                            complexity: c.complexity,
                            showMerged: false,
                          })
                        }
                      >
                        {c.ids.length}
                      </button>
                    ) : (
                      <span className="ne">·</span>
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="overview-cols four">
        <Dist title="Demand" rows={a.byDemand} onPick={(k) => go('features', { demand: k })} />
        <Dist
          title="Appreciation"
          rows={a.byAppreciation}
          onPick={(k) => go('features', { appreciation: k })}
        />
        <Dist
          title="Value (1–5)"
          rows={a.byValue}
          onPick={(k) => go('features', { valueBand: k })}
        />
        <Dist
          title="Complexity"
          rows={a.byComplexity}
          onPick={(k) => go('features', { complexity: k })}
        />
        <Dist
          title="Confidence in the evidence"
          rows={a.byConfidence}
          onPick={(k) => go('features', { confidence: k })}
        />
        <Dist
          title="Research priority"
          rows={a.byPriority.map((r) => ({
            ...r,
            label: {
              P0: 'P0 foundational',
              P1: 'P1 next stage',
              P2: 'P2 advanced/professional',
              P3: 'P3 experimental/later',
            }[r.key],
          }))}
          onPick={(k) => go('features', { priority: k })}
        />
      </div>
      <div className="overview-cols">
        <RankedList ctx={ctx} title="Highest value" items={a.top} empty="No rated features." />
        <RankedList
          ctx={ctx}
          title="Quick wins (value ≥ 4.0, complexity Medium or lower)"
          items={a.quickWins}
          empty="None."
        />
        <RankedList
          ctx={ctx}
          title="High value, weak evidence (check before committing)"
          items={a.weakEvidence}
          empty="Every feature valued 4.0 or more has at least medium confidence."
        />
      </div>
    </section>
  );
}

// ── Explorer ────────────────────────────────────────────────────────────────────────────────────────────────────

const SORTS: [SortKey, string][] = [
  ['research', 'Research rank'],
  ['name', 'Name'],
  ['category', 'Category'],
  ['impact', 'Value 1–5 (impact)'],
  ['demand', 'Demand'],
  ['complexity', 'Complexity (low first)'],
  ['confidence', 'Confidence'],
  ['priority', 'Research priority'],
  ['selection', 'Your decision'],
  ['yours', 'Your priority'],
];
const GROUPS: [GroupBy, string][] = [
  ['category', 'Category'],
  ['parent', 'Parent feature'],
  ['priority', 'Research priority'],
  ['selection', 'Your decision'],
  ['none', 'No grouping'],
];

function SelectionSelect({ id, value, label }: { id: string; value: Selection; label?: string }) {
  return (
    <select
      aria-label={label ?? 'Your decision'}
      className={`sel-${value}`}
      value={value}
      onChange={(e) => setMarks([id], { selection: e.target.value as Selection })}
    >
      {SELECTIONS.map((s) => (
        <option key={s} value={s}>
          {SELECTION_LABEL[s]}
        </option>
      ))}
    </select>
  );
}
function ImplementationSelect({ id, value }: { id: string; value: Implementation }) {
  return (
    <select
      aria-label="Implementation status"
      value={value}
      onChange={(e) => setMarks([id], { implementation: e.target.value as Implementation })}
    >
      {IMPLEMENTATIONS.map((s) => (
        <option key={s} value={s}>
          {IMPLEMENTATION_LABEL[s]}
        </option>
      ))}
    </select>
  );
}

function Explorer({
  ctx,
  query,
  setQuery,
}: {
  ctx: Ctx;
  query: FeatureQuery;
  setQuery: (q: FeatureQuery) => void;
}) {
  const { view, marks, open } = ctx;
  const [sort, setSort] = useState<SortKey>('research');
  const [desc, setDesc] = useState(false);
  const [group, setGroup] = useState<GroupBy>('category');
  const q = (patch: Partial<FeatureQuery>) => setQuery({ ...query, ...patch });
  const list = useMemo(
    () => sortFeatures(filterFeatures(view, marks, query), sort, marks, desc),
    [view, marks, query, sort, desc],
  );
  const groups = useMemo(() => groupFeatures(list, group, view, marks), [list, group, view, marks]);
  const priorities = useMemo(
    () =>
      [...new Set([...view.features.values()].map((f) => rating(f, 'priority').value))]
        .filter((p) => p !== 'not evaluated')
        .sort(),
    [view],
  );
  return (
    <div className="explorer">
      <div className="catalog-toolbar research-toolbar">
        <label className="search">
          <Icon name="search" className="sm" />
          <input
            type="search"
            placeholder="Search features, e.g. snapping, countertop, BOM"
            aria-label="Search features"
            value={query.q}
            onChange={(e) => q({ q: e.target.value })}
          />
        </label>
        <select
          aria-label="Category"
          value={query.category}
          onChange={(e) => q({ category: e.target.value })}
        >
          <option value="">All categories</option>
          {view.categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.label}
            </option>
          ))}
        </select>
        <select
          aria-label="Filter by your decision"
          value={query.selection}
          onChange={(e) => q({ selection: e.target.value as Selection | '' })}
        >
          <option value="">Any decision</option>
          {SELECTIONS.map((s) => (
            <option key={s} value={s}>
              {SELECTION_LABEL[s]}
            </option>
          ))}
        </select>
        <select
          aria-label="Filter by implementation status"
          value={query.implementation}
          onChange={(e) => q({ implementation: e.target.value as Implementation | '' })}
        >
          <option value="">Any implementation</option>
          {IMPLEMENTATIONS.map((s) => (
            <option key={s} value={s}>
              {IMPLEMENTATION_LABEL[s]}
            </option>
          ))}
        </select>
        <select
          aria-label="Research priority"
          value={query.priority}
          onChange={(e) => q({ priority: e.target.value })}
        >
          <option value="">Any research priority</option>
          {priorities.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
        <select
          aria-label="Origin"
          value={query.origin}
          onChange={(e) => q({ origin: e.target.value as FeatureQuery['origin'] })}
        >
          <option value="">Named or inferred</option>
          <option value="explicit">Named in the research</option>
          <option value="inferred">Inferred opportunities</option>
        </select>
        <select
          aria-label="Demand"
          value={query.demand}
          onChange={(e) => q({ demand: e.target.value })}
        >
          <option value="">Any demand</option>
          {[...DEMAND_SCALE, 'Indirect / emerging'].map((d) => (
            <option key={d} value={d}>
              {d}
            </option>
          ))}
        </select>
        <select
          aria-label="Appreciation"
          value={query.appreciation}
          onChange={(e) => q({ appreciation: e.target.value })}
        >
          <option value="">Any appreciation</option>
          {APPRECIATION_KEYS.map((d) => (
            <option key={d} value={d}>
              {d}
            </option>
          ))}
        </select>
        <select
          aria-label="Value"
          value={query.valueBand}
          onChange={(e) => q({ valueBand: e.target.value })}
        >
          <option value="">Any value</option>
          {VALUE_BANDS.map(([k, l]) => (
            <option key={k} value={k}>
              Value {l}
            </option>
          ))}
        </select>
        <select
          aria-label="Complexity"
          value={query.complexity}
          onChange={(e) => q({ complexity: e.target.value })}
        >
          <option value="">Any complexity</option>
          {COMPLEXITY_SCALE.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <select
          aria-label="Confidence"
          value={query.confidence}
          onChange={(e) => q({ confidence: e.target.value })}
        >
          <option value="">Any confidence</option>
          {[...CONFIDENCE_SCALE].reverse().map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <select
          aria-label="Rated by"
          value={query.rated}
          onChange={(e) => q({ rated: e.target.value as FeatureQuery['rated'] })}
        >
          <option value="">Rated by paper or assessment</option>
          <option value="paper">Rated by the paper</option>
          <option value="assessment">Assessed here (A)</option>
        </select>
        <select
          aria-label="Evidence"
          value={query.evidence}
          onChange={(e) => q({ evidence: e.target.value as FeatureQuery['evidence'] })}
        >
          <option value="">Any evidence</option>
          <option value="with">With evidence</option>
          <option value="without">Missing evidence</option>
        </select>
      </div>
      <div className="catalog-actions">
        <label className="toggle small">
          <input
            type="checkbox"
            checked={query.planned}
            onChange={(e) => q({ planned: e.target.checked })}
          />
          <span>Shortlisted and approved only</span>
        </label>
        <label className="toggle small">
          <input
            type="checkbox"
            checked={query.topLevel}
            onChange={(e) => q({ topLevel: e.target.checked })}
          />
          <span>Top-level only</span>
        </label>
        <label className="toggle small">
          <input
            type="checkbox"
            checked={query.showMerged}
            onChange={(e) => q({ showMerged: e.target.checked })}
          />
          <span>Show merged</span>
        </label>
        <label className="toggle small">
          <input
            type="checkbox"
            checked={query.left}
            onChange={(e) => q({ left: e.target.checked })}
          />
          <span>Left to build only</span>
        </label>
        <label className="inline-field">
          Group by{' '}
          <select value={group} onChange={(e) => setGroup(e.target.value as GroupBy)}>
            {GROUPS.map(([k, l]) => (
              <option key={k} value={k}>
                {l}
              </option>
            ))}
          </select>
        </label>
        <label className="inline-field">
          Sort by{' '}
          <select value={sort} onChange={(e) => setSort(e.target.value as SortKey)}>
            {SORTS.map(([k, l]) => (
              <option key={k} value={k}>
                {l}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          className="btn sm"
          onClick={() => setDesc(!desc)}
          aria-label={desc ? 'Sort ascending' : 'Sort descending'}
        >
          {desc ? '↓ Reversed' : '↑ Normal order'}
        </button>
        <button type="button" className="btn sm ghost" onClick={() => setQuery(EMPTY_QUERY)}>
          Clear filters
        </button>
      </div>
      <p className="hint">
        <strong className="num">{list.length}</strong> of {view.features.size} features shown.
      </p>
      {list.length === 0 && (
        <p className="empty center">
          <Icon name="search" />
          No feature matches these filters.
        </p>
      )}
      {groups.map((g) => {
        return (
          <section key={g.key} className="catalog-group" aria-label={g.label}>
            <h2 className="group-head">
              {g.label} <span className="count">{g.items.length}</span>
            </h2>
            <div className="table-wrap">
              <table className="cut features-table">
                <thead>
                  <tr>
                    <th>Feature</th>
                    <th>Category</th>
                    <th>Description</th>
                    <th>Demand</th>
                    <th>Value 1–5 (impact)</th>
                    <th>Complexity</th>
                    <th>Confidence</th>
                    <th>Dependencies</th>
                    <th>Your decision</th>
                    <th>Implementation</th>
                  </tr>
                </thead>
                <tbody>
                  {g.items.map((f) => (
                    <FeatureRow key={f.id} f={f} ctx={ctx} onOpen={() => open(f.id)} />
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        );
      })}
    </div>
  );
}

function FeatureRow({ f, ctx, onOpen }: { f: ViewFeature; ctx: Ctx; onOpen: () => void }) {
  const { view, marks } = ctx;
  const m = markOf(marks, f.id);
  const parent = f.parent ? view.features.get(f.parent) : undefined;
  return (
    <tr className={mergedOf(f, marks) ? 'merged' : ''}>
      <td data-label="Feature" className="fname">
        <button type="button" className="link" onClick={onOpen}>
          {f.name}
        </button>
        <span className="chips">
          {f.rank && <span className="chip subtle">#{f.rank}</span>}
          {rating(f, 'priority').source !== 'none' && (
            <span className="chip">
              <Rated f={f} dim="priority" />
            </span>
          )}
          {f.mvp && <span className="chip edited">MVP</span>}
          {f.origin === 'inferred' && <span className="chip safety">Inferred</span>}
          {f.children.length > 0 && (
            <span className="chip subtle">{f.children.length} sub-features</span>
          )}
          {parent && <span className="chip subtle">in {parent.name}</span>}
          {f.retired && <span className="chip reference">Retired</span>}
          {mergedOf(f, marks) && <span className="chip reference">Merged</span>}
          {!f.findings.length && <span className="chip safety">No evidence</span>}
        </span>
      </td>
      <td data-label="Category">
        <span>
          {catLabel(view, f.category)}
          <span className="sub">{f.subcategory}</span>
        </span>
      </td>
      <td data-label="Description" className="desc">
        {f.description}
      </td>
      <td data-label="Demand">
        <Rated f={f} dim="demand" />
      </td>
      <td data-label="Value 1–5 (impact)" className="num">
        <Rated f={f} dim="impact" />
      </td>
      <td data-label="Complexity">
        <Rated f={f} dim="complexity" />
      </td>
      <td data-label="Confidence">
        <Rated f={f} dim="confidence" />
      </td>
      <td data-label="Dependencies">
        {f.dependencies.length ? (
          f.dependencies.map((d) => view.features.get(d)?.name ?? d).join(', ')
        ) : (
          <span className="ne">none listed</span>
        )}
      </td>
      <td data-label="Your decision">
        <SelectionSelect id={f.id} value={m.selection} label={`Your decision on ${f.name}`} />
      </td>
      <td data-label="Implementation">
        <ImplementationSelect id={f.id} value={implementationOf(f, marks)} />
        {implementationSource(f, marks) === 'app' && (
          <span className="sub" title={f.app!.evidence}>
            from this app’s record{f.app!.missing ? ` — missing: ${f.app!.missing}` : ''}
          </span>
        )}
      </td>
    </tr>
  );
}

// ── Feature detail ──────────────────────────────────────────────────────────────────────────────────────────────

const EVIDENCE_GROUPS: { label: string; kinds: FindingKind[] }[] = [
  { label: 'Demand — user requests', kinds: ['request'] },
  { label: 'Appreciation — praise', kinds: ['praise'] },
  { label: 'Pain points and complaints', kinds: ['complaint'] },
  { label: 'Adoption — competitor implementations', kinds: ['competitor', 'adoption', 'pricing'] },
  {
    label: 'Ranked and recommended in the research',
    kinds: ['feature', 'recommendation', 'conclusion', 'strategy'],
  },
  {
    label: 'Requirements, workflows and principles',
    kinds: ['requirement', 'workflow', 'principle', 'example', 'claim'],
  },
  { label: 'Technical and architecture findings', kinds: ['technical', 'architecture'] },
  {
    label: 'Caveats, limitations and estimates',
    kinds: ['caveat', 'limitation', 'estimate', 'methodology', 'source', 'question'],
  },
];

function List({ items, none = 'not evaluated' }: { items: ReactNode[]; none?: string }) {
  return items.length ? (
    <ul className="detail-list">
      {items.map((x, i) => (
        <li key={i}>{x}</li>
      ))}
    </ul>
  ) : (
    <p className="ne">{none}</p>
  );
}

function FeatureLink({ ctx, id }: { ctx: Ctx; id: string }) {
  const f = ctx.view.features.get(id);
  return f ? (
    <button type="button" className="link" onClick={() => ctx.open(id)}>
      {f.name}
    </button>
  ) : (
    <span className="ne">{id} (not in the catalog)</span>
  );
}

function FeatureDetail({ ctx, f, onBack }: { ctx: Ctx; f: ViewFeature; onBack: () => void }) {
  const { view, marks } = ctx;
  const m = markOf(marks, f.id);
  const [notes, setNotes] = useState(m.notes);
  const [linkTo, setLinkTo] = useState('');
  const parent = f.parent ? view.features.get(f.parent) : undefined;
  const subs = descendants(view, f.id);
  const mergedIn = [...view.features.values()].filter((x) => mergedOf(x, marks) === f.id);
  const merged = mergedOf(f, marks);
  const impl = implementationOf(f, marks);
  const implSource = implementationSource(f, marks);
  const findingIds = [
    ...new Set([...f.findings, ...(f.inferredFrom ?? []), ...mergedIn.flatMap((x) => x.findings)]),
  ];
  const findings = findingIds
    .map((id) => view.findings.get(id))
    .filter((x): x is ViewFinding => !!x);
  const contra = view.contradictions.filter((c) => c.features.includes(f.id));
  const others = useMemo(
    () =>
      [...view.features.values()]
        // Not itself merged, and nothing merged into this one may move under another (no chains).
        .filter((x) => x.id !== f.id && !mergedOf(x, marks))
        .sort((a, b) => a.name.localeCompare(b.name)),
    [view, f.id, marks],
  );
  return (
    <article className="feature-detail" aria-label={f.name}>
      <button type="button" className="btn sm back" onClick={onBack}>
        ← All features
      </button>
      <header>
        <h2>{f.name}</h2>
        <p className="chips">
          <span className="chip">{catLabel(view, f.category)}</span>
          <span className="chip subtle">{f.subcategory}</span>
          <span className={`chip ${f.origin === 'inferred' ? 'safety' : 'subtle'}`}>
            {f.origin === 'inferred' ? 'Inferred opportunity' : 'Named in the research'}
          </span>
          {f.rank && <span className="chip subtle">Ranked #{f.rank} of 39</span>}
          {f.recommendationRank && (
            <span className="chip subtle">Recommendation #{f.recommendationRank} of 15</span>
          )}
          {f.mvp && <span className="chip edited">MVP capability</span>}
          {f.phase && <span className="chip subtle">{f.phase}</span>}
          {f.retired && <span className="chip reference">Retired in the latest edition</span>}
          <span className="chip subtle num">{f.id}</span>
        </p>
        {parent && (
          <p className="hint">
            Part of <FeatureLink ctx={ctx} id={parent.id} />
          </p>
        )}
      </header>
      {f.origin === 'inferred' && (
        <p className="alert warning">
          <Icon name="alert-triangle" className="sm" />
          <span>
            This is an opportunity inferred from the findings below —{' '}
            <strong>not a research conclusion</strong>.
          </span>
        </p>
      )}
      {merged && (
        <p className="alert info">
          <Icon name="info" className="sm" />
          <span>
            {m.mergedInto === merged ? 'You merged' : 'Merged'} this feature into{' '}
            <FeatureLink ctx={ctx} id={merged} />
            {m.mergedInto !== merged && f.mergeReason ? (
              <> — same idea: {f.mergeReason}</>
            ) : null}{' '}
            Its evidence is shown there too; nothing was deleted.{' '}
            <button
              type="button"
              className="link"
              onClick={() =>
                // Undo the user's own merge first (back to the app's merge, if any), else undo the app's merge.
                setMarks([f.id], {
                  mergedInto: m.mergedInto && m.mergedInto !== UNMERGED ? undefined : UNMERGED,
                })
              }
            >
              Undo merge
            </button>
          </span>
        </p>
      )}
      <section className="app-status card-like" aria-label="This app">
        <h3>
          This app: <span className={`chip impl-${impl}`}>{IMPLEMENTATION_LABEL[impl]}</span>
        </h3>
        {f.app ? (
          <>
            <p>
              <strong>Built:</strong> {f.app.evidence}
            </p>
            {f.app.missing && (
              <p>
                <strong>Missing:</strong> {f.app.missing}
              </p>
            )}
            <p className="hint">
              From the repository (backlog and ADRs), checked {f.app.checked}. Not research.
              {implSource === 'user' && (
                <>
                  {' '}
                  You set the status to {IMPLEMENTATION_LABEL[impl]} yourself, so it is shown
                  instead of the app’s record ({IMPLEMENTATION_LABEL[f.app.status]}).{' '}
                  <button
                    type="button"
                    className="link"
                    onClick={() =>
                      setMarks([f.id], {
                        implementation: 'not-started',
                        implementationSetAt: undefined,
                      })
                    }
                  >
                    Use the app’s record
                  </button>
                </>
              )}
            </p>
          </>
        ) : (
          <p className="hint">
            Nothing in the backlog or the ADRs builds this yet (checked {APP_CHECKED}).
          </p>
        )}
      </section>

      <section className="decision card-like" aria-label="Your decision">
        <div className="dims3">
          <div className="field">
            <label htmlFor="d-sel">Your decision</label>
            <select
              id="d-sel"
              value={m.selection}
              onChange={(e) => setMarks([f.id], { selection: e.target.value as Selection })}
            >
              {SELECTIONS.map((s) => (
                <option key={s} value={s}>
                  {SELECTION_LABEL[s]}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="d-impl">Implementation status</label>
            <select
              id="d-impl"
              value={impl}
              onChange={(e) =>
                setMarks([f.id], { implementation: e.target.value as Implementation })
              }
            >
              {IMPLEMENTATIONS.map((s) => (
                <option key={s} value={s}>
                  {IMPLEMENTATION_LABEL[s]}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="d-pri">Your priority</label>
            <select
              id="d-pri"
              value={m.priority}
              onChange={(e) =>
                setMarks([f.id], { priority: e.target.value as ResearchMark['priority'] })
              }
            >
              {USER_PRIORITIES.map((p) => (
                <option key={p} value={p}>
                  {p || 'Not set'}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="field">
          <label htmlFor="d-notes">Your notes</label>
          <textarea
            id="d-notes"
            rows={3}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            onBlur={() => {
              if (notes !== m.notes) setMarks([f.id], { notes });
            }}
            placeholder="Saved on this device when you leave the box"
          />
        </div>
        <div className="action-row">
          <label className="inline-field">
            Link or merge with{' '}
            <select value={linkTo} onChange={(e) => setLinkTo(e.target.value)}>
              <option value="">Choose a feature…</option>
              {others.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            className="btn sm"
            disabled={!linkTo || m.links.includes(linkTo)}
            onClick={() => {
              setMarks([f.id], { links: [...m.links, linkTo] });
              setLinkTo('');
            }}
          >
            Add link
          </button>
          <button
            type="button"
            className="btn sm"
            disabled={!linkTo || linkTo === m.mergedInto}
            onClick={async () => {
              const target = view.features.get(linkTo);
              if (
                target &&
                (await askConfirm(
                  `Merge “${f.name}” into “${target.name}”? It is hidden from the list and its evidence shows on “${target.name}”. Nothing is deleted; you can undo it.`,
                  { confirmLabel: 'Merge' },
                ))
              ) {
                setMarks([f.id], { mergedInto: linkTo });
                setLinkTo('');
              }
            }}
          >
            Merge into it
          </button>
        </div>
        <p className="hint">
          Your decision and implementation status are independent. Approving a feature never starts
          its implementation.
        </p>
      </section>

      <section aria-label="Description">
        <h3>Description</h3>
        <p>{f.description}</p>
        <dl className="pairs">
          <dt>User problem</dt>
          <dd>{ne(f.userProblem)}</dd>
          <dt>User benefit</dt>
          <dd>{ne(f.userBenefit)}</dd>
          {f.mvp && (
            <>
              <dt>MVP acceptance criterion</dt>
              <dd>{f.mvp}</dd>
            </>
          )}
        </dl>
      </section>
      <section aria-label="Ratings">
        <h3>Ratings</h3>
        <div className="table-wrap">
          <table className="cut ratings-table">
            <thead>
              <tr>
                <th>Rating</th>
                <th>Value</th>
                <th>Source</th>
              </tr>
            </thead>
            <tbody>
              {(
                [
                  ['User demand', 'demand'],
                  ['Appreciation', 'appreciation'],
                  ['Value (impact), 1–5', 'impact'],
                  ['Implementation complexity', 'complexity'],
                  ['Evidence confidence', 'confidence'],
                  ['Research priority', 'priority'],
                  ['Competitor adoption', 'adoption'],
                ] as const
              ).map(([k, d]) => {
                const r = rating(f, d);
                return (
                  <tr key={k}>
                    <th scope="row">{k}</th>
                    <td>
                      <Rated f={f} dim={d} />
                    </td>
                    <td>
                      {r.source === 'paper'
                        ? 'The paper (ranked table)'
                        : r.source === 'assessment'
                          ? 'Assessment — not from the paper'
                          : '—'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {f.assessment && (
          <div className="assessment-box">
            <p className="alert warning">
              <Icon name="alert-triangle" className="sm" />
              <span>
                <strong>Assessment, not research.</strong> The paper does not rate this feature.
                These scores apply the paper’s own method (line 71) to the findings linked below.{' '}
                {f.assessment.by}, {f.assessment.date}.
              </span>
            </p>
            <div className="table-wrap">
              <table className="cut">
                <thead>
                  <tr>
                    <th>Criterion</th>
                    <th>Weight</th>
                    <th>Score (1–5)</th>
                  </tr>
                </thead>
                <tbody>
                  {ASSESSMENT_CRITERIA.map(([k, label, w]) => (
                    <tr key={k}>
                      <th scope="row">{label}</th>
                      <td className="num">{Math.round(w * 100)} %</td>
                      <td className="num">{f.assessment!.scores[k]}</td>
                    </tr>
                  ))}
                  <tr>
                    <th scope="row">Value (weighted)</th>
                    <td />
                    <td className="num">
                      <strong>{assessedValue(f.assessment)}</strong>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p>
              <strong>Why:</strong> {f.assessment.rationale}
            </p>
            <p>
              <strong>
                Research priority <Rated f={f} dim="priority" />
              </strong>{' '}
              — {f.assessment.priorityBasis}
            </p>
            <p>
              <strong>
                Appreciation <Rated f={f} dim="appreciation" />
              </strong>{' '}
              — {f.assessment.appreciationBasis}
            </p>
            {f.assessment.internal && (
              <p className="hint">
                Internal capability: users do not ask for it by name, so demand reads “Indirect”, as
                the paper does for its internal rows.
              </p>
            )}
          </div>
        )}
      </section>
      <div className="detail-cols">
        <section aria-label="Functional requirements">
          <h3>Functional requirements</h3>
          <List items={f.requirements} />
        </section>
        <section aria-label="Use cases">
          <h3>User scenarios</h3>
          <List items={f.useCases} />
        </section>
        <section aria-label="Workflow">
          <h3>User workflow</h3>
          {f.workflow.length ? (
            <ol className="detail-list">
              {f.workflow.map((w, i) => (
                <li key={i}>{w}</li>
              ))}
            </ol>
          ) : (
            <p className="ne">not evaluated</p>
          )}
        </section>
        <section aria-label="Technical considerations">
          <h3>Technical considerations</h3>
          <List items={f.technical} />
        </section>
        <section aria-label="Sub-features">
          <h3>
            Sub-features <span className="count">{subs.length}</span>
          </h3>
          <List
            none="none"
            items={subs.map((s) => (
              <>
                <FeatureLink ctx={ctx} id={s.id} />
                {s.parent !== f.id && (
                  <span className="hint"> (in {view.features.get(s.parent!)?.name})</span>
                )}
              </>
            ))}
          />
        </section>
        <section aria-label="Dependencies and related">
          <h3>Dependencies</h3>
          <List
            none="none listed"
            items={f.dependencies.map((d) => (
              <FeatureLink ctx={ctx} id={d} />
            ))}
          />
          <h3>Related</h3>
          <List
            none="none listed"
            items={[
              ...f.related.map((d) => <FeatureLink ctx={ctx} id={d} />),
              ...m.links.map((d) => (
                <>
                  <FeatureLink ctx={ctx} id={d} /> <span className="hint">your link</span>{' '}
                  <button
                    type="button"
                    className="link danger"
                    onClick={() => setMarks([f.id], { links: m.links.filter((x) => x !== d) })}
                  >
                    remove
                  </button>
                </>
              )),
            ]}
          />
          {mergedIn.length > 0 && (
            <>
              <h3>Merged into this</h3>
              <List
                items={mergedIn.map((x) => (
                  <>
                    <FeatureLink ctx={ctx} id={x.id} />{' '}
                    <span className="hint">
                      ({IMPLEMENTATION_LABEL[implementationOf(x, marks)]})
                      {x.mergeReason ? ` — ${x.mergeReason}` : ''}
                    </span>
                  </>
                ))}
              />
            </>
          )}
        </section>
      </div>
      {f.appNotes?.length ? (
        <p className="alert info">
          <Icon name="info" className="sm" />
          <span>
            <strong>This app today</strong> (repository observation, not research):{' '}
            {f.appNotes.join(' ')}
          </span>
        </p>
      ) : null}
      <section aria-label="Competitors">
        <h3>Competitor comparison</h3>
        {f.competitors.length ? (
          <div className="table-wrap">
            <table className="cut">
              <thead>
                <tr>
                  <th>Product</th>
                  <th>Ensemble behaviour</th>
                  <th>Praise / complaints</th>
                  <th>Confidence</th>
                </tr>
              </thead>
              <tbody>
                {f.competitors.map((c) => {
                  const x = view.competitors.get(c);
                  return (
                    <tr key={c}>
                      <td data-label="Product">
                        <strong>{x?.name ?? c}</strong>
                        <span className="sub">{x?.group}</span>
                      </td>
                      <td data-label="Behaviour">{x?.behaviour}</td>
                      <td data-label="Signal">{x?.signal}</td>
                      <td data-label="Confidence">{x?.confidence}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="ne">No competitor named for this feature.</p>
        )}
      </section>
      {contra.length > 0 && (
        <section aria-label="Contradictions">
          <h3>Contradictions and conflicts</h3>
          {contra.map((c) => (
            <ContradictionCard key={c.id} ctx={ctx} c={c} />
          ))}
        </section>
      )}
      <section aria-label="Research evidence">
        <h3>
          Research evidence <span className="count">{findings.length}</span>
        </h3>
        {findings.length === 0 && (
          <p className="alert warning">
            <Icon name="alert-triangle" className="sm" />
            <span>No supporting finding is linked to this feature.</span>
          </p>
        )}
        {EVIDENCE_GROUPS.map((g) => {
          const items = findings.filter((x) => g.kinds.includes(x.kind));
          return items.length ? (
            <div key={g.label} className="evidence-group">
              <h4>
                {g.label} <span className="count">{items.length}</span>
              </h4>
              {items.map((x) => (
                <FindingCard key={x.id} ctx={ctx} f={x} showFeatures={false} />
              ))}
            </div>
          ) : null;
        })}
      </section>
    </article>
  );
}

// ── Findings ────────────────────────────────────────────────────────────────────────────────────────────────────

function citationsOf(view: CatalogView, f: ViewFinding) {
  return f.allRefs.map((r) => ({ id: r, c: view.citations.get(`${f.doc}#${r}`) }));
}

function FindingCard({
  ctx,
  f,
  showFeatures = true,
}: {
  ctx: Ctx;
  f: ViewFinding;
  showFeatures?: boolean;
}) {
  const { view, marks } = ctx;
  const doc = view.documents.find((d) => d.doc.id === f.doc)?.doc;
  const section = view.sections.find((s) => s.id === f.section);
  const linked = [...view.features.values()].filter(
    (x) => x.findings.includes(f.id) || x.inferredFrom?.includes(f.id),
  );
  const reviewed = !!marks[f.id]?.reviewed;
  return (
    <div className={`finding ${f.polarity ?? ''}`}>
      <p className="finding-head">
        <span
          className={`chip ${f.kind === 'complaint' ? 'safety' : f.kind === 'praise' ? '' : 'subtle'}`}
        >
          {FINDING_KIND_LABEL[f.kind]}
        </span>
        {f.polarity && <span className="chip subtle">{f.polarity}</span>}
        {f.quality && <span className="chip subtle">evidence: {f.quality}</span>}
        <span className="src num">
          {doc?.file ?? f.doc} · lines {f.lines[0]}
          {f.lines[1] !== f.lines[0] ? `–${f.lines[1]}` : ''} · {section?.title}
        </span>
        <label className="toggle small reviewed">
          <input
            type="checkbox"
            checked={reviewed}
            onChange={(e) => setMarks([f.id], { reviewed: e.target.checked })}
          />
          <span>Reviewed</span>
        </label>
      </p>
      <p className="statement">{f.statement}</p>
      {f.excerpt && (
        <details>
          <summary>Original text</summary>
          <blockquote className="excerpt">{f.excerpt}</blockquote>
        </details>
      )}
      {f.allRefs.length > 0 && (
        <p className="cites">
          {citationsOf(view, f).map(({ id, c }) => (
            <span key={id} className="cite">
              <span className="num">[{id}]</span>{' '}
              {c ? (
                c.urls.map((u) => (
                  <a key={u} href={u} target="_blank" rel="noreferrer noopener">
                    {new URL(u).hostname.replace(/^www\./, '')}
                  </a>
                ))
              ) : (
                <span className="ne">no record</span>
              )}
            </span>
          ))}
        </p>
      )}
      {(f.competitors?.length ?? 0) > 0 && (
        <p className="hint">
          Competitors: {f.competitors!.map((c) => view.competitors.get(c)?.name ?? c).join(', ')}
        </p>
      )}
      {showFeatures && (
        <p className="hint">
          Features:{' '}
          {linked.length ? (
            linked.map((x, i) => (
              <Fragment key={x.id}>
                {i > 0 && ', '}
                <FeatureLink ctx={ctx} id={x.id} />
              </Fragment>
            ))
          ) : (
            <span className="ne">none — kept as supporting research</span>
          )}
        </p>
      )}
      <span className="sub num">{f.id}</span>
    </div>
  );
}

// ── Competitors, contradictions, sources ────────────────────────────────────────────────────────────────────────

function Competitors({ ctx }: { ctx: Ctx }) {
  const { view } = ctx;
  return (
    <div className="competitors">
      <p className="hint">
        {view.competitors.size} products, as compared in the research. Confidence is the paper’s own
        evidence rating.
      </p>
      <div className="fam-grid">
        {[...view.competitors.values()].map((c) => (
          <article key={c.id} className="fam-card" aria-label={c.name}>
            <h3>{c.name}</h3>
            <p className="chips">
              <span className="chip subtle">{c.group}</span>
              <span className="chip">{c.confidence}</span>
            </p>
            <dl className="pairs">
              <dt>Ensemble behaviour</dt>
              <dd>{c.behaviour}</dd>
              <dt>Praise / complaints / missing</dt>
              <dd>{c.signal}</dd>
              <dt>Commercial model</dt>
              <dd>{c.commercial}</dd>
            </dl>
            <p className="hint">
              {c.findings.length} findings · line {c.line}
            </p>
            {c.features.length > 0 && (
              <details>
                <summary>{c.features.length} related features</summary>
                <ul className="detail-list">
                  {c.features.map((id) => (
                    <li key={id}>
                      <FeatureLink ctx={ctx} id={id} />
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </article>
        ))}
      </div>
    </div>
  );
}

const BASIS = {
  paper: 'Stated in the paper',
  inferred: 'Inferred tension (not stated by the paper)',
  app: 'Research vs this app',
} as const;
function ContradictionCard({ ctx, c }: { ctx: Ctx; c: CatalogView['contradictions'][number] }) {
  return (
    <div className="finding contradiction">
      <p className="finding-head">
        <span className={`chip ${c.basis === 'paper' ? 'subtle' : 'safety'}`}>
          {BASIS[c.basis]}
        </span>
        <strong>{c.title}</strong>
      </p>
      <p className="statement">{c.description}</p>
      <p className="hint">
        Findings:{' '}
        {c.findings
          .map((id) => {
            const f = ctx.view.findings.get(id);
            return f
              ? `${id.replace(/^.*\.n\./, '')} (lines ${f.lines[0]}${f.lines[1] !== f.lines[0] ? `–${f.lines[1]}` : ''})`
              : id;
          })
          .join(' · ')}
      </p>
      <p className="hint">
        Features:{' '}
        {c.features.map((id, i) => (
          <Fragment key={id}>
            {i > 0 && ', '}
            <FeatureLink ctx={ctx} id={id} />
          </Fragment>
        ))}
      </p>
    </div>
  );
}
