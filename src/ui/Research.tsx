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
import { t, tr } from '../core/i18n';
import { askConfirm } from './Confirm';
import { tNode } from './i18n';
import { Icon } from './icons';

/** Features (with the assessment dashboard above the list) and Competitors (ADR-110). */
export type Tab = 'features' | 'competitors';
const TABS: [Tab, string][] = [
  ['features', t('Features')],
  ['competitors', t('Competitors')],
];

const ne = (s: string) =>
  s === 'not evaluated' || s === 'unknown' ? <span className="ne">{tr(s)}</span> : tr(s);
/** A rating with its source: the paper's own words, or our assessment marked "A" (never shown as research). */
function Rated({ f, dim }: { f: ViewFeature; dim: RatingDim }) {
  const r = rating(f, dim);
  if (r.source === 'none') return <span className="ne">{tr(r.value)}</span>;
  return (
    <span className={`rated ${r.source}`}>
      {tr(r.value)}
      {r.source === 'assessment' && (
        <abbr
          className="assessed"
          title={t(
            "Assessed from the paper's evidence with the paper's method — not a rating in the paper",
          )}
        >
          {t('A')}
        </abbr>
      )}
    </span>
  );
}
const catLabel = (view: CatalogView, id: string) =>
  tr(view.categories.find((c) => c.id === id)?.label ?? id);

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
  const go = (tb: Tab, q?: Partial<FeatureQuery>) => {
    if (q) setQuery({ ...EMPTY_QUERY, ...q });
    setDetail(null);
    setTab(tb);
    window.scrollTo({ top: 0 });
  };
  const st = useMemo(() => stats(view, marks), [view, marks]);
  const ctx: Ctx = { view, marks, open, go };
  return (
    <main className="catalog-page research-page" aria-label={t('Feature Research & Catalog')}>
      <header className="catalog-head">
        <div>
          <h1>{t('Feature Research & Catalog')}</h1>
          <p className="hint">
            {tNode(
              '{total} ({top}, {subs}) and {findings} from {papers}. Selecting a feature records a decision only — nothing is implemented from here.',
              {
                total: <strong className="num">{t('{n} features', { n: st.features })}</strong>,
                top: t('{n} features', { n: st.topLevel }),
                subs: t('{n} sub-features', { n: st.subfeatures }),
                findings: t('{n} findings', { n: st.findings }),
                papers: t('{n|# research paper|# research papers}', {
                  n: view.documents.length,
                }),
              },
            )}
          </p>
        </div>
        <button type="button" className="btn outline" onClick={onDone}>
          <Icon name="chevron-left" className="sm" />
          {t('Back to the editor')}
        </button>
      </header>
      {error && (
        <p className="alert warning" role="status">
          <Icon name="alert-triangle" className="sm" />
          <span>{error}</span>
        </p>
      )}
      <nav
        className="segmented small research-tabs"
        role="tablist"
        aria-label={t('Research sections')}
      >
        {TABS.map(([tb, label]) => (
          <button
            key={tb}
            type="button"
            role="tab"
            aria-selected={tab === tb}
            className={tab === tb ? 'on' : ''}
            onClick={() => go(tb)}
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
                {tr(r.label ?? r.key)}
              </button>
            ) : (
              <span>{tr(r.label ?? r.key)}</span>
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
                {tr(f.name)}
              </button>
              <span className="facts">
                {tNode(
                  'Value {impact} · Demand {demand} · Complexity {complexity} · Confidence {confidence}',
                  {
                    impact: <Rated f={f} dim="impact" />,
                    demand: <Rated f={f} dim="demand" />,
                    complexity: <Rated f={f} dim="complexity" />,
                    confidence: <Rated f={f} dim="confidence" />,
                  },
                )}
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
  const built = n('implemented') + n('verified');
  return (
    <section className="app-summary" aria-label={t('Built in this app')}>
      <h2 className="group-head">{t('Built in this app')}</h2>
      <p className="alert ok">
        <Icon name="check" className="sm" />
        <span>
          {t(
            'Features the app has built are no longer listed (ADR-149). Of the {left} left (after {merged} merged as the same idea):',
            { left: shown.length, merged: all.length - shown.length },
          )}{' '}
          <button
            type="button"
            className="link"
            onClick={() => go('features', { implementation: 'in-progress' })}
          >
            {tNode('{n} in progress', { n: <strong className="num">{n('in-progress')}</strong> })}
          </button>
          ,{' '}
          <button
            type="button"
            className="link"
            onClick={() => go('features', { implementation: 'not-started' })}
          >
            {tNode('{n} not started', { n: <strong className="num">{n('not-started')}</strong> })}
          </button>
          {n('planned') > 0 && (
            <>
              ,{' '}
              <button
                type="button"
                className="link"
                onClick={() => go('features', { implementation: 'planned' })}
              >
                {tNode('{n} planned', { n: <strong className="num">{n('planned')}</strong> })}
              </button>
            </>
          )}
          {built > 0 && (
            <>
              ,{' '}
              {tNode('{n} built by a status you set', {
                n: <strong className="num">{built}</strong>,
              })}
            </>
          )}
          .{' '}
          {t('From the backlog and ADRs (checked {date}); a status you set yourself wins.', {
            date: APP_CHECKED,
          })}{' '}
          <button
            type="button"
            className="link"
            onClick={() => go('features', { showMerged: true, q: '' })}
          >
            {t('See merged features')}
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
    <section className="assessment" aria-label={t('Assessment')}>
      <h2 className="group-head">{t('Assessment: demand, value, complexity, confidence')}</h2>
      <div
        className="segmented small"
        role="radiogroup"
        aria-label={t('Features in the assessment')}
      >
        <button
          type="button"
          role="radio"
          aria-checked={scope === 'left'}
          className={scope === 'left' ? 'on' : ''}
          onClick={() => setScope('left')}
        >
          {t('Left to build ({n})', { n: all.length - built.size })}
        </button>
        <button
          type="button"
          role="radio"
          aria-checked={scope === 'all'}
          className={scope === 'all' ? 'on' : ''}
          onClick={() => setScope('all')}
        >
          {t('All features ({n})', { n: all.length })}
        </button>
      </div>
      <p className="alert info">
        <Icon name="info" className="sm" />
        <span>
          {tNode(
            '{rated} features rated: {paper} by the paper itself, {assessed} assessed here (demand, appreciation, value, complexity, confidence and research priority) from the paper’s evidence with the paper’s own method (marked {a}). Value = core relevance 30 % · demand 20 % · UX 20 % · competitor adoption 15 % · differentiation 10 % · downstream leverage 5 %, each 1–5. Assessments are judgements, not research results; open a feature for its scores and rationale.',
            {
              rated: (
                <strong className="num">
                  {t('{n} of {total}', { n: list.length - a.unrated, total: list.length })}
                </strong>
              ),
              paper: <strong>{a.ratedByPaper}</strong>,
              assessed: <strong>{a.assessed}</strong>,
              a: <abbr className="assessed">{t('A')}</abbr>,
            },
          )}
        </span>
      </p>
      <div className="table-wrap">
        <table className="cut matrix" aria-label={t('Value by complexity')}>
          <caption>
            {t(
              'Value (rows) × complexity (columns) — number of features; pick a cell to list them',
            )}
          </caption>
          <thead>
            <tr>
              <th>{t('Value')}</th>
              {COMPLEXITY_SCALE.map((c) => (
                <th key={c}>{tr(c)}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {a.matrix.map((r) => (
              <tr key={r.band}>
                <th scope="row" className="num">
                  {tr(r.label)}
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
                        title={c.ids.map((id) => tr(view.features.get(id)?.name ?? '')).join('\n')}
                        aria-label={t(
                          '{n} features with value {value} and {complexity} complexity',
                          {
                            n: c.ids.length,
                            value: tr(r.label),
                            complexity: tr(c.complexity),
                          },
                        )}
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
        <Dist title={t('Demand')} rows={a.byDemand} onPick={(k) => go('features', { demand: k })} />
        <Dist
          title={t('Appreciation')}
          rows={a.byAppreciation}
          onPick={(k) => go('features', { appreciation: k })}
        />
        <Dist
          title={t('Value (1–5)')}
          rows={a.byValue}
          onPick={(k) => go('features', { valueBand: k })}
        />
        <Dist
          title={t('Complexity')}
          rows={a.byComplexity}
          onPick={(k) => go('features', { complexity: k })}
        />
        <Dist
          title={t('Confidence in the evidence')}
          rows={a.byConfidence}
          onPick={(k) => go('features', { confidence: k })}
        />
        <Dist
          title={t('Research priority')}
          rows={a.byPriority.map((r) => ({
            ...r,
            label: {
              P0: t('P0 foundational'),
              P1: t('P1 next stage'),
              P2: t('P2 advanced/professional'),
              P3: t('P3 experimental/later'),
            }[r.key],
          }))}
          onPick={(k) => go('features', { priority: k })}
        />
      </div>
      <div className="overview-cols">
        <RankedList
          ctx={ctx}
          title={t('Highest value')}
          items={a.top}
          empty={t('No rated features.')}
        />
        <RankedList
          ctx={ctx}
          title={t('Quick wins (value ≥ 4.0, complexity Medium or lower)')}
          items={a.quickWins}
          empty={t('None.')}
        />
        <RankedList
          ctx={ctx}
          title={t('High value, weak evidence (check before committing)')}
          items={a.weakEvidence}
          empty={t('Every feature valued 4.0 or more has at least medium confidence.')}
        />
      </div>
    </section>
  );
}

// ── Explorer ────────────────────────────────────────────────────────────────────────────────────────────────────

const SORTS: [SortKey, string][] = [
  ['research', t('Research rank')],
  ['name', t('Name')],
  ['category', t('Category')],
  ['impact', t('Value 1–5 (impact)')],
  ['demand', t('Demand')],
  ['complexity', t('Complexity (low first)')],
  ['confidence', t('Confidence')],
  ['priority', t('Research priority')],
  ['selection', t('Your decision')],
  ['yours', t('Your priority')],
];
const GROUPS: [GroupBy, string][] = [
  ['category', t('Category')],
  ['parent', t('Parent feature')],
  ['priority', t('Research priority')],
  ['selection', t('Your decision')],
  ['none', t('No grouping')],
];

function SelectionSelect({ id, value, label }: { id: string; value: Selection; label?: string }) {
  return (
    <select
      aria-label={label ?? t('Your decision')}
      className={`sel-${value}`}
      value={value}
      onChange={(e) => setMarks([id], { selection: e.target.value as Selection })}
    >
      {SELECTIONS.map((s) => (
        <option key={s} value={s}>
          {tr(SELECTION_LABEL[s])}
        </option>
      ))}
    </select>
  );
}
function ImplementationSelect({ id, value }: { id: string; value: Implementation }) {
  return (
    <select
      aria-label={t('Implementation status')}
      value={value}
      onChange={(e) => setMarks([id], { implementation: e.target.value as Implementation })}
    >
      {IMPLEMENTATIONS.map((s) => (
        <option key={s} value={s}>
          {tr(IMPLEMENTATION_LABEL[s])}
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
            placeholder={t('Search features, e.g. snapping, countertop, BOM')}
            aria-label={t('Search features')}
            value={query.q}
            onChange={(e) => q({ q: e.target.value })}
          />
        </label>
        <select
          aria-label={t('Category')}
          value={query.category}
          onChange={(e) => q({ category: e.target.value })}
        >
          <option value="">{t('All categories')}</option>
          {view.categories.map((c) => (
            <option key={c.id} value={c.id}>
              {tr(c.label)}
            </option>
          ))}
        </select>
        <select
          aria-label={t('Filter by your decision')}
          value={query.selection}
          onChange={(e) => q({ selection: e.target.value as Selection | '' })}
        >
          <option value="">{t('Any decision')}</option>
          {SELECTIONS.map((s) => (
            <option key={s} value={s}>
              {tr(SELECTION_LABEL[s])}
            </option>
          ))}
        </select>
        <select
          aria-label={t('Filter by implementation status')}
          value={query.implementation}
          onChange={(e) => q({ implementation: e.target.value as Implementation | '' })}
        >
          <option value="">{t('Any implementation')}</option>
          {IMPLEMENTATIONS.map((s) => (
            <option key={s} value={s}>
              {tr(IMPLEMENTATION_LABEL[s])}
            </option>
          ))}
        </select>
        <select
          aria-label={t('Research priority')}
          value={query.priority}
          onChange={(e) => q({ priority: e.target.value })}
        >
          <option value="">{t('Any research priority')}</option>
          {priorities.map((p) => (
            <option key={p} value={p}>
              {tr(p)}
            </option>
          ))}
        </select>
        <select
          aria-label={t('Origin')}
          value={query.origin}
          onChange={(e) => q({ origin: e.target.value as FeatureQuery['origin'] })}
        >
          <option value="">{t('Named or inferred')}</option>
          <option value="explicit">{t('Named in the research')}</option>
          <option value="inferred">{t('Inferred opportunities')}</option>
        </select>
        <select
          aria-label={t('Demand')}
          value={query.demand}
          onChange={(e) => q({ demand: e.target.value })}
        >
          <option value="">{t('Any demand')}</option>
          {[...DEMAND_SCALE, 'Indirect / emerging'].map((d) => (
            <option key={d} value={d}>
              {tr(d)}
            </option>
          ))}
        </select>
        <select
          aria-label={t('Appreciation')}
          value={query.appreciation}
          onChange={(e) => q({ appreciation: e.target.value })}
        >
          <option value="">{t('Any appreciation')}</option>
          {APPRECIATION_KEYS.map((d) => (
            <option key={d} value={d}>
              {tr(d)}
            </option>
          ))}
        </select>
        <select
          aria-label={t('Value')}
          value={query.valueBand}
          onChange={(e) => q({ valueBand: e.target.value })}
        >
          <option value="">{t('Any value')}</option>
          {VALUE_BANDS.map(([k, l]) => (
            <option key={k} value={k}>
              {t('Value {band}', { band: tr(l) })}
            </option>
          ))}
        </select>
        <select
          aria-label={t('Complexity')}
          value={query.complexity}
          onChange={(e) => q({ complexity: e.target.value })}
        >
          <option value="">{t('Any complexity')}</option>
          {COMPLEXITY_SCALE.map((c) => (
            <option key={c} value={c}>
              {tr(c)}
            </option>
          ))}
        </select>
        <select
          aria-label={t('Confidence')}
          value={query.confidence}
          onChange={(e) => q({ confidence: e.target.value })}
        >
          <option value="">{t('Any confidence')}</option>
          {[...CONFIDENCE_SCALE].reverse().map((c) => (
            <option key={c} value={c}>
              {tr(c)}
            </option>
          ))}
        </select>
        <select
          aria-label={t('Rated by')}
          value={query.rated}
          onChange={(e) => q({ rated: e.target.value as FeatureQuery['rated'] })}
        >
          <option value="">{t('Rated by paper or assessment')}</option>
          <option value="paper">{t('Rated by the paper')}</option>
          <option value="assessment">{t('Assessed here (A)')}</option>
        </select>
        <select
          aria-label={t('Evidence')}
          value={query.evidence}
          onChange={(e) => q({ evidence: e.target.value as FeatureQuery['evidence'] })}
        >
          <option value="">{t('Any evidence')}</option>
          <option value="with">{t('With evidence')}</option>
          <option value="without">{t('Missing evidence')}</option>
        </select>
      </div>
      <div className="catalog-actions">
        <label className="toggle small">
          <input
            type="checkbox"
            checked={query.planned}
            onChange={(e) => q({ planned: e.target.checked })}
          />
          <span>{t('Shortlisted and approved only')}</span>
        </label>
        <label className="toggle small">
          <input
            type="checkbox"
            checked={query.topLevel}
            onChange={(e) => q({ topLevel: e.target.checked })}
          />
          <span>{t('Top-level only')}</span>
        </label>
        <label className="toggle small">
          <input
            type="checkbox"
            checked={query.showMerged}
            onChange={(e) => q({ showMerged: e.target.checked })}
          />
          <span>{t('Show merged')}</span>
        </label>
        <label className="toggle small">
          <input
            type="checkbox"
            checked={query.left}
            onChange={(e) => q({ left: e.target.checked })}
          />
          <span>{t('Left to build only')}</span>
        </label>
        <label className="inline-field">
          {t('Group by')}{' '}
          <select value={group} onChange={(e) => setGroup(e.target.value as GroupBy)}>
            {GROUPS.map(([k, l]) => (
              <option key={k} value={k}>
                {l}
              </option>
            ))}
          </select>
        </label>
        <label className="inline-field">
          {t('Sort by')}{' '}
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
          aria-label={desc ? t('Sort ascending') : t('Sort descending')}
        >
          {desc ? t('↓ Reversed') : t('↑ Normal order')}
        </button>
        <button type="button" className="btn sm ghost" onClick={() => setQuery(EMPTY_QUERY)}>
          {t('Clear filters')}
        </button>
      </div>
      <p className="hint">
        {tNode('{n} of {total} features shown.', {
          n: <strong className="num">{list.length}</strong>,
          total: view.features.size,
        })}
      </p>
      {list.length === 0 && (
        <p className="empty center">
          <Icon name="search" />
          {t('No feature matches these filters.')}
        </p>
      )}
      {groups.map((g) => {
        // The core writes "Research priority P0"; translate the words and the rating apart.
        const label =
          group === 'priority' && g.label === `Research priority ${g.key}`
            ? tr('Research priority {value}', { value: tr(g.key) })
            : tr(g.label);
        return (
          <section key={g.key} className="catalog-group" aria-label={label}>
            <h2 className="group-head">
              {label} <span className="count">{g.items.length}</span>
            </h2>
            <div className="table-wrap">
              <table className="cut features-table">
                <thead>
                  <tr>
                    <th>{t('Feature')}</th>
                    <th>{t('Category')}</th>
                    <th>{t('Description')}</th>
                    <th>{t('Demand')}</th>
                    <th>{t('Value 1–5 (impact)')}</th>
                    <th>{t('Complexity')}</th>
                    <th>{t('Confidence')}</th>
                    <th>{t('Dependencies')}</th>
                    <th>{t('Your decision')}</th>
                    <th>{t('Implementation')}</th>
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
      <td data-label={t('Feature')} className="fname">
        <button type="button" className="link" onClick={onOpen}>
          {tr(f.name)}
        </button>
        <span className="chips">
          {f.rank && <span className="chip subtle">#{f.rank}</span>}
          {rating(f, 'priority').source !== 'none' && (
            <span className="chip">
              <Rated f={f} dim="priority" />
            </span>
          )}
          {f.mvp && <span className="chip edited">{t('MVP')}</span>}
          {f.origin === 'inferred' && <span className="chip safety">{t('Inferred')}</span>}
          {f.children.length > 0 && (
            <span className="chip subtle">{t('{n} sub-features', { n: f.children.length })}</span>
          )}
          {parent && (
            <span className="chip subtle">{t('in {name}', { name: tr(parent.name) })}</span>
          )}
          {f.retired && <span className="chip reference">{t('Retired')}</span>}
          {mergedOf(f, marks) && <span className="chip reference">{t('Merged')}</span>}
          {!f.findings.length && <span className="chip safety">{t('No evidence')}</span>}
        </span>
      </td>
      <td data-label={t('Category')}>
        <span>
          {catLabel(view, f.category)}
          <span className="sub">{tr(f.subcategory)}</span>
        </span>
      </td>
      <td data-label={t('Description')} className="desc">
        {tr(f.description)}
      </td>
      <td data-label={t('Demand')}>
        <Rated f={f} dim="demand" />
      </td>
      <td data-label={t('Value 1–5 (impact)')} className="num">
        <Rated f={f} dim="impact" />
      </td>
      <td data-label={t('Complexity')}>
        <Rated f={f} dim="complexity" />
      </td>
      <td data-label={t('Confidence')}>
        <Rated f={f} dim="confidence" />
      </td>
      <td data-label={t('Dependencies')}>
        {f.dependencies.length ? (
          f.dependencies.map((d) => tr(view.features.get(d)?.name ?? d)).join(', ')
        ) : (
          <span className="ne">{t('none listed')}</span>
        )}
      </td>
      <td data-label={t('Your decision')}>
        <SelectionSelect
          id={f.id}
          value={m.selection}
          label={t('Your decision on {name}', { name: tr(f.name) })}
        />
      </td>
      <td data-label={t('Implementation')}>
        <ImplementationSelect id={f.id} value={implementationOf(f, marks)} />
        {implementationSource(f, marks) === 'app' && (
          <span className="sub" title={tr(f.app!.evidence)}>
            {t('from this app’s record')}
            {f.app!.missing ? t(' — missing: {missing}', { missing: tr(f.app!.missing) }) : ''}
          </span>
        )}
      </td>
    </tr>
  );
}

// ── Feature detail ──────────────────────────────────────────────────────────────────────────────────────────────

const EVIDENCE_GROUPS: { label: string; kinds: FindingKind[] }[] = [
  { label: t('Demand — user requests'), kinds: ['request'] },
  { label: t('Appreciation — praise'), kinds: ['praise'] },
  { label: t('Pain points and complaints'), kinds: ['complaint'] },
  {
    label: t('Adoption — competitor implementations'),
    kinds: ['competitor', 'adoption', 'pricing'],
  },
  {
    label: t('Ranked and recommended in the research'),
    kinds: ['feature', 'recommendation', 'conclusion', 'strategy'],
  },
  {
    label: t('Requirements, workflows and principles'),
    kinds: ['requirement', 'workflow', 'principle', 'example', 'claim'],
  },
  { label: t('Technical and architecture findings'), kinds: ['technical', 'architecture'] },
  {
    label: t('Caveats, limitations and estimates'),
    kinds: ['caveat', 'limitation', 'estimate', 'methodology', 'source', 'question'],
  },
];

function List({ items, none = tr('not evaluated') }: { items: ReactNode[]; none?: string }) {
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
      {tr(f.name)}
    </button>
  ) : (
    <span className="ne">{t('{id} (not in the catalog)', { id })}</span>
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
    <article className="feature-detail" aria-label={tr(f.name)}>
      <button type="button" className="btn sm back" onClick={onBack}>
        {t('← All features')}
      </button>
      <header>
        <h2>{tr(f.name)}</h2>
        <p className="chips">
          <span className="chip">{catLabel(view, f.category)}</span>
          <span className="chip subtle">{tr(f.subcategory)}</span>
          <span className={`chip ${f.origin === 'inferred' ? 'safety' : 'subtle'}`}>
            {f.origin === 'inferred' ? t('Inferred opportunity') : t('Named in the research')}
          </span>
          {f.rank && <span className="chip subtle">{t('Ranked #{n} of 39', { n: f.rank })}</span>}
          {f.recommendationRank && (
            <span className="chip subtle">
              {t('Recommendation #{n} of 15', { n: f.recommendationRank })}
            </span>
          )}
          {f.mvp && <span className="chip edited">{t('MVP capability')}</span>}
          {f.phase && <span className="chip subtle">{tr(f.phase)}</span>}
          {f.retired && (
            <span className="chip reference">{t('Retired in the latest edition')}</span>
          )}
          <span className="chip subtle num">{f.id}</span>
        </p>
        {parent && (
          <p className="hint">
            {tNode('Part of {feature}', { feature: <FeatureLink ctx={ctx} id={parent.id} /> })}
          </p>
        )}
      </header>
      {f.origin === 'inferred' && (
        <p className="alert warning">
          <Icon name="alert-triangle" className="sm" />
          <span>
            {tNode('This is an opportunity inferred from the findings below — {not}.', {
              not: <strong>{t('not a research conclusion')}</strong>,
            })}
          </span>
        </p>
      )}
      {merged && (
        <p className="alert info">
          <Icon name="info" className="sm" />
          <span>
            {tNode(
              m.mergedInto === merged
                ? 'You merged this feature into {feature}'
                : 'Merged this feature into {feature}',
              { feature: <FeatureLink ctx={ctx} id={merged} /> },
            )}
            {m.mergedInto !== merged && f.mergeReason
              ? t(' — same idea: {reason}', { reason: tr(f.mergeReason) })
              : null}{' '}
            {t('Its evidence is shown there too; nothing was deleted.')}{' '}
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
              {t('Undo merge')}
            </button>
          </span>
        </p>
      )}
      <section className="app-status card-like" aria-label={t('This app')}>
        <h3>
          {tNode('This app: {status}', {
            status: <span className={`chip impl-${impl}`}>{tr(IMPLEMENTATION_LABEL[impl])}</span>,
          })}
        </h3>
        {f.app ? (
          <>
            <p>
              <strong>{t('Built:')}</strong> {tr(f.app.evidence)}
            </p>
            {f.app.missing && (
              <p>
                <strong>{t('Missing:')}</strong> {tr(f.app.missing)}
              </p>
            )}
            <p className="hint">
              {t('From the repository (backlog and ADRs), checked {date}. Not research.', {
                date: f.app.checked,
              })}
              {implSource === 'user' && (
                <>
                  {' '}
                  {t(
                    'You set the status to {status} yourself, so it is shown instead of the app’s record ({record}).',
                    {
                      status: tr(IMPLEMENTATION_LABEL[impl]),
                      record: tr(IMPLEMENTATION_LABEL[f.app.status]),
                    },
                  )}{' '}
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
                    {t('Use the app’s record')}
                  </button>
                </>
              )}
            </p>
          </>
        ) : (
          <p className="hint">
            {t('Nothing in the backlog or the ADRs builds this yet (checked {date}).', {
              date: APP_CHECKED,
            })}
          </p>
        )}
      </section>

      <section className="decision card-like" aria-label={t('Your decision')}>
        <div className="dims3">
          <div className="field">
            <label htmlFor="d-sel">{t('Your decision')}</label>
            <select
              id="d-sel"
              value={m.selection}
              onChange={(e) => setMarks([f.id], { selection: e.target.value as Selection })}
            >
              {SELECTIONS.map((s) => (
                <option key={s} value={s}>
                  {tr(SELECTION_LABEL[s])}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="d-impl">{t('Implementation status')}</label>
            <select
              id="d-impl"
              value={impl}
              onChange={(e) =>
                setMarks([f.id], { implementation: e.target.value as Implementation })
              }
            >
              {IMPLEMENTATIONS.map((s) => (
                <option key={s} value={s}>
                  {tr(IMPLEMENTATION_LABEL[s])}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="d-pri">{t('Your priority')}</label>
            <select
              id="d-pri"
              value={m.priority}
              onChange={(e) =>
                setMarks([f.id], { priority: e.target.value as ResearchMark['priority'] })
              }
            >
              {USER_PRIORITIES.map((p) => (
                <option key={p} value={p}>
                  {p || t('Not set')}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="field">
          <label htmlFor="d-notes">{t('Your notes')}</label>
          <textarea
            id="d-notes"
            rows={3}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            onBlur={() => {
              if (notes !== m.notes) setMarks([f.id], { notes });
            }}
            placeholder={t('Saved on this device when you leave the box')}
          />
        </div>
        <div className="action-row">
          <label className="inline-field">
            {t('Link or merge with')}{' '}
            <select value={linkTo} onChange={(e) => setLinkTo(e.target.value)}>
              <option value="">{t('Choose a feature…')}</option>
              {others.map((o) => (
                <option key={o.id} value={o.id}>
                  {tr(o.name)}
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
            {t('Add link')}
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
                  t(
                    'Merge “{name}” into “{target}”? It is hidden from the list and its evidence shows on “{target}”. Nothing is deleted; you can undo it.',
                    { name: tr(f.name), target: tr(target.name) },
                  ),
                  { confirmLabel: t('Merge') },
                ))
              ) {
                setMarks([f.id], { mergedInto: linkTo });
                setLinkTo('');
              }
            }}
          >
            {t('Merge into it')}
          </button>
        </div>
        <p className="hint">
          {t(
            'Your decision and implementation status are independent. Approving a feature never starts its implementation.',
          )}
        </p>
      </section>

      <section aria-label={t('Description')}>
        <h3>{t('Description')}</h3>
        <p>{tr(f.description)}</p>
        <dl className="pairs">
          <dt>{t('User problem')}</dt>
          <dd>{ne(f.userProblem)}</dd>
          <dt>{t('User benefit')}</dt>
          <dd>{ne(f.userBenefit)}</dd>
          {f.mvp && (
            <>
              <dt>{t('MVP acceptance criterion')}</dt>
              <dd>{tr(f.mvp)}</dd>
            </>
          )}
        </dl>
      </section>
      <section aria-label={t('Ratings')}>
        <h3>{t('Ratings')}</h3>
        <div className="table-wrap">
          <table className="cut ratings-table">
            <thead>
              <tr>
                <th>{t('Rating')}</th>
                <th>{t('Value')}</th>
                <th>{t('Source')}</th>
              </tr>
            </thead>
            <tbody>
              {(
                [
                  [t('User demand'), 'demand'],
                  [t('Appreciation'), 'appreciation'],
                  [t('Value (impact), 1–5'), 'impact'],
                  [t('Implementation complexity'), 'complexity'],
                  [t('Evidence confidence'), 'confidence'],
                  [t('Research priority'), 'priority'],
                  [t('Competitor adoption'), 'adoption'],
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
                        ? t('The paper (ranked table)')
                        : r.source === 'assessment'
                          ? t('Assessment — not from the paper')
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
                <strong>{t('Assessment, not research.')}</strong>{' '}
                {t(
                  'The paper does not rate this feature. These scores apply the paper’s own method (line 71) to the findings linked below.',
                )}{' '}
                {tr(f.assessment.by)}, {f.assessment.date}.
              </span>
            </p>
            <div className="table-wrap">
              <table className="cut">
                <thead>
                  <tr>
                    <th>{t('Criterion')}</th>
                    <th>{t('Weight')}</th>
                    <th>{t('Score (1–5)')}</th>
                  </tr>
                </thead>
                <tbody>
                  {ASSESSMENT_CRITERIA.map(([k, label, w]) => (
                    <tr key={k}>
                      <th scope="row">{tr(label)}</th>
                      <td className="num">{Math.round(w * 100)} %</td>
                      <td className="num">{f.assessment!.scores[k]}</td>
                    </tr>
                  ))}
                  <tr>
                    <th scope="row">{t('Value (weighted)')}</th>
                    <td />
                    <td className="num">
                      <strong>{assessedValue(f.assessment)}</strong>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p>
              <strong>{t('Why:')}</strong> {tr(f.assessment.rationale)}
            </p>
            <p>
              <strong>
                {t('Research priority')} <Rated f={f} dim="priority" />
              </strong>{' '}
              — {tr(f.assessment.priorityBasis)}
            </p>
            <p>
              <strong>
                {t('Appreciation')} <Rated f={f} dim="appreciation" />
              </strong>{' '}
              — {tr(f.assessment.appreciationBasis)}
            </p>
            {f.assessment.internal && (
              <p className="hint">
                {t(
                  'Internal capability: users do not ask for it by name, so demand reads “Indirect”, as the paper does for its internal rows.',
                )}
              </p>
            )}
          </div>
        )}
      </section>
      <div className="detail-cols">
        <section aria-label={t('Functional requirements')}>
          <h3>{t('Functional requirements')}</h3>
          <List items={f.requirements.map((x) => tr(x))} />
        </section>
        <section aria-label={t('Use cases')}>
          <h3>{t('User scenarios')}</h3>
          <List items={f.useCases.map((x) => tr(x))} />
        </section>
        <section aria-label={t('Workflow')}>
          <h3>{t('User workflow')}</h3>
          {f.workflow.length ? (
            <ol className="detail-list">
              {f.workflow.map((w, i) => (
                <li key={i}>{tr(w)}</li>
              ))}
            </ol>
          ) : (
            <p className="ne">{tr('not evaluated')}</p>
          )}
        </section>
        <section aria-label={t('Technical considerations')}>
          <h3>{t('Technical considerations')}</h3>
          <List items={f.technical.map((x) => tr(x))} />
        </section>
        <section aria-label={t('Sub-features')}>
          <h3>
            {t('Sub-features')} <span className="count">{subs.length}</span>
          </h3>
          <List
            none={t('none')}
            items={subs.map((s) => (
              <>
                <FeatureLink ctx={ctx} id={s.id} />
                {s.parent !== f.id && (
                  <span className="hint">
                    {t(' (in {name})', { name: tr(view.features.get(s.parent!)?.name ?? '') })}
                  </span>
                )}
              </>
            ))}
          />
        </section>
        <section aria-label={t('Dependencies and related')}>
          <h3>{t('Dependencies')}</h3>
          <List
            none={t('none listed')}
            items={f.dependencies.map((d) => (
              <FeatureLink ctx={ctx} id={d} />
            ))}
          />
          <h3>{t('Related')}</h3>
          <List
            none={t('none listed')}
            items={[
              ...f.related.map((d) => <FeatureLink ctx={ctx} id={d} />),
              ...m.links.map((d) => (
                <>
                  <FeatureLink ctx={ctx} id={d} /> <span className="hint">{t('your link')}</span>{' '}
                  <button
                    type="button"
                    className="link danger"
                    onClick={() => setMarks([f.id], { links: m.links.filter((x) => x !== d) })}
                  >
                    {t('remove')}
                  </button>
                </>
              )),
            ]}
          />
          {mergedIn.length > 0 && (
            <>
              <h3>{t('Merged into this')}</h3>
              <List
                items={mergedIn.map((x) => (
                  <>
                    <FeatureLink ctx={ctx} id={x.id} />{' '}
                    <span className="hint">
                      ({tr(IMPLEMENTATION_LABEL[implementationOf(x, marks)])})
                      {x.mergeReason ? ` — ${tr(x.mergeReason)}` : ''}
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
            <strong>{t('This app today')}</strong> {t('(repository observation, not research):')}{' '}
            {f.appNotes.map((x) => tr(x)).join(' ')}
          </span>
        </p>
      ) : null}
      <section aria-label={t('Competitors')}>
        <h3>{t('Competitor comparison')}</h3>
        {f.competitors.length ? (
          <div className="table-wrap">
            <table className="cut">
              <thead>
                <tr>
                  <th>{t('Product')}</th>
                  <th>{t('Ensemble behaviour')}</th>
                  <th>{t('Praise / complaints')}</th>
                  <th>{t('Confidence')}</th>
                </tr>
              </thead>
              <tbody>
                {f.competitors.map((c) => {
                  const x = view.competitors.get(c);
                  return (
                    <tr key={c}>
                      <td data-label={t('Product')}>
                        <strong>{x?.name ?? c}</strong>
                        <span className="sub">{x?.group && tr(x.group)}</span>
                      </td>
                      <td data-label={t('Behaviour')}>{x?.behaviour && tr(x.behaviour)}</td>
                      <td data-label={t('Signal')}>{x?.signal && tr(x.signal)}</td>
                      <td data-label={t('Confidence')}>{x?.confidence && tr(x.confidence)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="ne">{t('No competitor named for this feature.')}</p>
        )}
      </section>
      {contra.length > 0 && (
        <section aria-label={t('Contradictions')}>
          <h3>{t('Contradictions and conflicts')}</h3>
          {contra.map((c) => (
            <ContradictionCard key={c.id} ctx={ctx} c={c} />
          ))}
        </section>
      )}
      <section aria-label={t('Research evidence')}>
        <h3>
          {t('Research evidence')} <span className="count">{findings.length}</span>
        </h3>
        {findings.length === 0 && (
          <p className="alert warning">
            <Icon name="alert-triangle" className="sm" />
            <span>{t('No supporting finding is linked to this feature.')}</span>
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
          {tr(FINDING_KIND_LABEL[f.kind])}
        </span>
        {f.polarity && <span className="chip subtle">{tr(f.polarity)}</span>}
        {f.quality && (
          <span className="chip subtle">
            {t('evidence: {quality}', { quality: tr(f.quality) })}
          </span>
        )}
        <span className="src num">
          {doc?.file ?? f.doc} · {t('lines')} {f.lines[0]}
          {f.lines[1] !== f.lines[0] ? `–${f.lines[1]}` : ''} ·{' '}
          {section?.title && tr(section.title)}
        </span>
        <label className="toggle small reviewed">
          <input
            type="checkbox"
            checked={reviewed}
            onChange={(e) => setMarks([f.id], { reviewed: e.target.checked })}
          />
          <span>{t('Reviewed')}</span>
        </label>
      </p>
      <p className="statement">{tr(f.statement)}</p>
      {f.excerpt && (
        <details>
          <summary>{t('Original text')}</summary>
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
                <span className="ne">{t('no record')}</span>
              )}
            </span>
          ))}
        </p>
      )}
      {(f.competitors?.length ?? 0) > 0 && (
        <p className="hint">
          {t('Competitors: {list}', {
            list: f.competitors!.map((c) => view.competitors.get(c)?.name ?? c).join(', '),
          })}
        </p>
      )}
      {showFeatures && (
        <p className="hint">
          {t('Features:')}{' '}
          {linked.length ? (
            linked.map((x, i) => (
              <Fragment key={x.id}>
                {i > 0 && ', '}
                <FeatureLink ctx={ctx} id={x.id} />
              </Fragment>
            ))
          ) : (
            <span className="ne">{t('none — kept as supporting research')}</span>
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
        {t(
          '{n} products, as compared in the research. Confidence is the paper’s own evidence rating.',
          { n: view.competitors.size },
        )}
      </p>
      <div className="fam-grid">
        {[...view.competitors.values()].map((c) => (
          <article key={c.id} className="fam-card" aria-label={c.name}>
            <h3>{c.name}</h3>
            <p className="chips">
              <span className="chip subtle">{tr(c.group)}</span>
              <span className="chip">{tr(c.confidence)}</span>
            </p>
            <dl className="pairs">
              <dt>{t('Ensemble behaviour')}</dt>
              <dd>{tr(c.behaviour)}</dd>
              <dt>{t('Praise / complaints / missing')}</dt>
              <dd>{tr(c.signal)}</dd>
              <dt>{t('Commercial model')}</dt>
              <dd>{tr(c.commercial)}</dd>
            </dl>
            <p className="hint">
              {t('{n} findings · line {line}', { n: c.findings.length, line: c.line })}
            </p>
            {c.features.length > 0 && (
              <details>
                <summary>{t('{n} related features', { n: c.features.length })}</summary>
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
  paper: t('Stated in the paper'),
  inferred: t('Inferred tension (not stated by the paper)'),
  app: t('Research vs this app'),
} as const;
function ContradictionCard({ ctx, c }: { ctx: Ctx; c: CatalogView['contradictions'][number] }) {
  return (
    <div className="finding contradiction">
      <p className="finding-head">
        <span className={`chip ${c.basis === 'paper' ? 'subtle' : 'safety'}`}>
          {BASIS[c.basis]}
        </span>
        <strong>{tr(c.title)}</strong>
      </p>
      <p className="statement">{tr(c.description)}</p>
      <p className="hint">
        {t('Findings:')}{' '}
        {c.findings
          .map((id) => {
            const f = ctx.view.findings.get(id);
            return f
              ? `${id.replace(/^.*\.n\./, '')} (${t('lines')} ${f.lines[0]}${f.lines[1] !== f.lines[0] ? `–${f.lines[1]}` : ''})`
              : id;
          })
          .join(' · ')}
      </p>
      <p className="hint">
        {t('Features:')}{' '}
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
