/**
 * Research catalog logic (ADR-043): validate and merge research bundles, plan re-imports without touching user
 * decisions, account for every line of a source document, and project features for the catalog page. Pure functions;
 * user input never throws (ADR-008) — problems come back as lists.
 */
import {
  ASSESSMENT_CRITERIA,
  COMPLEXITY_SCALE,
  CONFIDENCE_SCALE,
  IMPLEMENTATIONS,
  RESEARCH_FORMAT,
  RESEARCH_SCHEMA,
  SELECTIONS,
  USER_PRIORITIES,
  type Assessment,
  type BibEntry,
  type Citation,
  type Competitor,
  type Contradiction,
  type Implementation,
  type ResearchBundle,
  type ResearchCategory,
  type ResearchDocument,
  type ResearchFeature,
  type ResearchFinding,
  type ResearchMark,
  type ResearchSection,
  type Selection,
  type Unextracted,
} from './types';
import { t, tr } from '../i18n';

// ── Stored versions ─────────────────────────────────────────────────────────────────────────────────────────────

/** One imported edition of a paper, as stored on the device. */
export interface StoredBundle {
  /** `<document id>@<version>` */
  key: string;
  docId: string;
  version: number;
  importedAt: string;
  bundle: ResearchBundle;
}
export const bundleKey = (b: ResearchBundle) => `${b.document.id}@${b.document.version}`;
export const storedOf = (bundle: ResearchBundle, importedAt: string): StoredBundle => ({
  key: bundleKey(bundle),
  docId: bundle.document.id,
  version: bundle.document.version,
  importedAt,
  bundle,
});

// ── Validation ──────────────────────────────────────────────────────────────────────────────────────────────────

const isStr = (v: unknown): v is string => typeof v === 'string';
const isStrArr = (v: unknown): v is string[] => Array.isArray(v) && v.every(isStr);
const isLines = (v: unknown): v is [number, number] =>
  Array.isArray(v) &&
  v.length === 2 &&
  v.every((n) => Number.isInteger(n) && n >= 1) &&
  v[0] <= v[1];

/** Problems with a bundle (empty = importable). Checks shape, unique ids and that every reference resolves inside it. */
export function validateBundle(x: unknown): string[] {
  const e: string[] = [];
  if (!x || typeof x !== 'object') return ['Not a research file.'];
  const b = x as Partial<ResearchBundle>;
  if (b.format !== RESEARCH_FORMAT)
    return [`Not a research file (format must be "${RESEARCH_FORMAT}").`];
  if (b.schemaVersion !== RESEARCH_SCHEMA)
    return [`Unsupported research file version ${String(b.schemaVersion)}.`];
  const d = b.document as Partial<ResearchDocument> | undefined;
  if (
    !d ||
    !isStr(d.id) ||
    !d.id ||
    !isStr(d.title) ||
    !Number.isInteger(d.version) ||
    (d.version ?? 0) < 1 ||
    !isStr(d.date)
  )
    e.push('Document needs id, title, date and a whole version ≥ 1.');
  for (const k of [
    'categories',
    'sections',
    'findings',
    'citations',
    'bibliography',
    'competitors',
    'features',
    'contradictions',
    'unextracted',
  ] as const) {
    if (!Array.isArray(b[k])) e.push(t('"{k}" must be a list.', { k }));
  }
  if (e.length) return e;
  const lineCount = isStr(d!.text) ? d!.text.split('\n').length : Infinity;
  const unique = (kind: string, ids: unknown[]) => {
    const seen = new Set<unknown>();
    for (const i of ids) {
      if (!isStr(i) || !i) e.push(t('{kind}: missing id.', { kind: tr(kind) }));
      else if (seen.has(i)) e.push(t('{kind}: duplicate id {i}.', { kind: tr(kind), i }));
      seen.add(i);
    }
    return seen as Set<string>;
  };
  const cats = unique(
    'Category',
    b.categories!.map((c) => c?.id),
  );
  const secs = unique(
    'Section',
    b.sections!.map((s) => s?.id),
  );
  const finds = unique(
    'Finding',
    b.findings!.map((f) => f?.id),
  );
  unique(
    'Citation',
    b.citations!.map((c) => c?.id),
  );
  unique(
    'Source',
    b.bibliography!.map((s) => s?.id),
  );
  const comps = unique(
    'Competitor',
    b.competitors!.map((c) => c?.id),
  );
  const feats = unique(
    'Feature',
    b.features!.map((f) => f?.id),
  );
  unique(
    'Contradiction',
    b.contradictions!.map((c) => c?.id),
  );
  unique(
    'Unextracted',
    b.unextracted!.map((u) => u?.id),
  );
  const inDoc = (what: string, l: unknown) => {
    if (!isLines(l)) e.push(t('{what}: lines must be [first, last].', { what }));
    else if (l[1] > lineCount)
      e.push(
        t('{what}: lines {first}–{last} are past the end of the document.', {
          what,
          first: l[0],
          last: l[1],
        }),
      );
  };
  for (const s of b.sections!) {
    if (!isStr(s.title)) e.push(t('Section {id}: missing title.', { id: s.id }));
    inDoc(t('Section {id}', { id: s.id }), s.lines);
    if (s.parent && !secs.has(s.parent))
      e.push(t('Section {id}: unknown parent {parent}.', { id: s.id, parent: s.parent }));
  }
  for (const f of b.findings!) {
    if (!secs.has(f.section))
      e.push(t('Finding {id}: unknown section {section}.', { id: f.id, section: f.section }));
    if (!isStr(f.statement) || !f.statement)
      e.push(t('Finding {id}: missing statement.', { id: f.id }));
    inDoc(t('Finding {id}', { id: f.id }), f.lines);
    for (const c of f.competitors ?? [])
      if (!comps.has(c)) e.push(t('Finding {id}: unknown competitor {c}.', { id: f.id, c }));
  }
  for (const c of b.citations!)
    if (!isStrArr(c.urls)) e.push(t('Citation {id}: urls must be a list.', { id: c.id }));
  for (const c of b.competitors!)
    if (!isStr(c.name) || !c.name) e.push(t('Competitor {id}: missing name.', { id: c.id }));
  for (const f of b.features!) {
    const at = t('Feature {id}', { id: f.id });
    if (!isStr(f.name) || !f.name || !isStr(f.description))
      e.push(t('{at}: needs a name and a description.', { at }));
    if (!cats.has(f.category))
      e.push(t('{at}: unknown category {category}.', { at, category: f.category }));
    for (const k of [
      'useCases',
      'workflow',
      'requirements',
      'technical',
      'dependencies',
      'related',
      'competitors',
      'findings',
      'tags',
    ] as const)
      if (!isStrArr(f[k])) e.push(t('{at}: "{k}" must be a list of text.', { at, k }));
    if (!isStrArr(f.findings)) continue;
    for (const n of f.findings)
      if (!finds.has(n)) e.push(t('{at}: unknown finding {n}.', { at, n }));
    for (const c of f.competitors ?? [])
      if (!comps.has(c)) e.push(t('{at}: unknown competitor {c}.', { at, c }));
    if (
      f.origin === 'inferred' &&
      !(f.inferredFrom?.length && f.inferredFrom.every((n) => finds.has(n)))
    )
      e.push(t('{at}: an inferred feature must list the findings it is inferred from.', { at }));
    if (f.origin !== 'explicit' && f.origin !== 'inferred')
      e.push(t('{at}: origin must be explicit or inferred.', { at }));
    if (f.parent === f.id) e.push(t('{at}: is its own parent.', { at }));
    if ('selection' in f || 'notes' in f)
      e.push(t('{at}: user decisions are not part of a research file.', { at }));
    if (f.assessment)
      e.push(...validateAssessment(f.assessment).map((x) => `${at}: assessment ${x}`));
    if (f.app) {
      if (!IMPLEMENTATIONS.includes(f.app.status)) e.push(t('{at}: unknown app status.', { at }));
      if (!isStr(f.app.evidence) || !f.app.evidence.trim())
        e.push(t('{at}: app status needs its evidence.', { at }));
      if (f.app.status === 'in-progress' && !f.app.missing?.trim())
        e.push(t('{at}: In Progress must say what is missing.', { at }));
      if ((f.app.status === 'verified' || f.app.status === 'implemented') && f.app.missing)
        e.push(
          t('{at}: something is missing, so it is In Progress, not {status}.', {
            at,
            status: f.app.status,
          }),
        );
    }
    if (f.mergedInto !== undefined) {
      const target = b.features!.find((x) => x.id === f.mergedInto);
      if (!target)
        e.push(t('{at}: merged into an unknown feature {target}.', { at, target: f.mergedInto }));
      else if (target.mergedInto)
        e.push(
          t('{at}: merged into {target}, which is itself merged.', { at, target: f.mergedInto }),
        );
      else if (target.app?.status === 'verified' || target.app?.status === 'implemented')
        e.push(
          `${at}: merged into ${f.mergedInto}, which the app has built — that would hide work left to do.`,
        );
      if (f.app?.status === 'verified' || f.app?.status === 'implemented')
        e.push(t('{at}: built by the app, so it is not merged.', { at }));
      if (f.mergedInto === f.id) e.push(t('{at}: merged into itself.', { at }));
      if (!isStr(f.mergeReason) || !f.mergeReason.trim())
        e.push(t('{at}: a merge needs its reason.', { at }));
    }
  }
  for (const c of b.contradictions!) {
    for (const n of c.findings ?? [])
      if (!finds.has(n)) e.push(t('Contradiction {id}: unknown finding {n}.', { id: c.id, n }));
    for (const f of c.features ?? [])
      if (!feats.has(f)) e.push(t('Contradiction {id}: unknown feature {f}.', { id: c.id, f }));
  }
  for (const u of b.unextracted!) {
    inDoc(t('Unextracted {id}', { id: u.id }), u.lines);
    if (!isStr(u.reason) || !u.reason)
      e.push(t('Unextracted {id}: a reason is required.', { id: u.id }));
  }
  return e;
}

/** Problems with an assessment: every criterion scored 1–5, words from the paper's scales, a rationale and an author. */
export function validateAssessment(a: Assessment): string[] {
  const e: string[] = [];
  for (const [k] of ASSESSMENT_CRITERIA) {
    const v = a.scores?.[k];
    if (!Number.isInteger(v) || v < 1 || v > 5) e.push(t('{k} must be a whole score 1–5.', { k }));
  }
  if (!COMPLEXITY_SCALE.includes(a.complexity))
    e.push(t('complexity must be one of {list}.', { list: COMPLEXITY_SCALE.join(', ') }));
  if (!CONFIDENCE_SCALE.includes(a.confidence))
    e.push(t('confidence must be one of {list}.', { list: CONFIDENCE_SCALE.join(', ') }));
  if (!isStr(a.priority) || !/^P[0-3](\/P[0-3])?$/.test(a.priority))
    e.push('priority must be P0–P3 (or two bands such as P0/P1).');
  if (!isStr(a.priorityBasis) || !a.priorityBasis.trim()) e.push('priority needs its basis.');
  if (!isStr(a.appreciation) || !a.appreciation.trim()) e.push('needs an appreciation.');
  if (!isStr(a.appreciationBasis) || !a.appreciationBasis.trim())
    e.push('appreciation needs its basis.');
  if (!isStr(a.rationale) || !a.rationale.trim()) e.push('needs a rationale.');
  if (!isStr(a.by) || !a.by || !isStr(a.date)) e.push('needs an author and a date.');
  return e;
}

// ── Assessment ───────────────────────────────────────────────────────────────────────────────────────────────────

const SCORE_WORD = ['', 'Low', 'Low-medium', 'Medium', 'Medium-high', 'High'] as const;
/** The paper's weighted sum, one decimal (line 71). */
export function assessedValue(a: Assessment): string {
  const v = ASSESSMENT_CRITERIA.reduce((n, [k, , w]) => n + a.scores[k] * w, 0);
  return (Math.round(v * 10 + 1e-9) / 10).toFixed(1);
}
export const assessedDemand = (a: Assessment) =>
  a.internal ? 'Indirect' : SCORE_WORD[a.scores.demand];
export const assessedAdoption = (a: Assessment) => SCORE_WORD[a.scores.adoption];

export type RatingDim =
  'demand' | 'impact' | 'complexity' | 'confidence' | 'adoption' | 'priority' | 'appreciation';
export interface Rating {
  value: string;
  source: 'paper' | 'assessment' | 'none';
}
const NE = 'not evaluated';
/** The paper's rating when it gives one, else the assessment, else "not evaluated" — always with its source. */
export function rating(f: ResearchFeature, dim: RatingDim): Rating {
  const paper = f[dim];
  if (paper && paper !== NE && paper !== 'unknown') return { value: paper, source: 'paper' };
  const a = f.assessment;
  if (!a) return { value: NE, source: 'none' };
  const value =
    dim === 'impact'
      ? assessedValue(a)
      : dim === 'demand'
        ? assessedDemand(a)
        : dim === 'adoption'
          ? assessedAdoption(a)
          : dim === 'priority'
            ? `${a.priority}${a.internal ? ' internal' : ''}`
            : dim === 'appreciation'
              ? a.appreciation
              : a[dim];
  return { value, source: 'assessment' };
}
/** All core ratings present (from the paper or assessed): demand, appreciation, value, complexity, confidence, priority. */
export const fullyRated = (f: ResearchFeature) =>
  (['demand', 'appreciation', 'impact', 'complexity', 'confidence', 'priority'] as const).every(
    (d) => rating(f, d).source !== 'none',
  );

/** Buckets for the paper's free-form words ("High for cabinetry" → High, "Medium if data exists" → Medium). */
export function scaleBucket(s: string, scale: readonly string[]): string {
  const t = s.toLowerCase().replace('high/medium', 'medium-high');
  const sorted = [...scale].sort((a, b) => b.length - a.length);
  return sorted.find((w) => t.startsWith(w.toLowerCase())) ?? 'Other';
}
export const DEMAND_SCALE = ['High', 'Medium-high', 'Medium', 'Low-medium', 'Low'] as const;
export const VALUE_BANDS = [
  ['4.5', '4.5–5.0', 4.5, 5.01],
  ['4.0', '4.0–4.4', 4, 4.5],
  ['3.5', '3.5–3.9', 3.5, 4],
  ['3.0', '3.0–3.4', 3, 3.5],
  ['2.0', '2.0–2.9', 2, 3],
  ['1.0', 'below 2.0', 0, 2],
] as const;
export function valueBand(f: ResearchFeature): string {
  const v = Number.parseFloat(rating(f, 'impact').value);
  if (Number.isNaN(v)) return '';
  return VALUE_BANDS.find(([, , lo, hi]) => v >= lo && v < hi)?.[0] ?? '';
}
export const complexityOf = (f: ResearchFeature) =>
  scaleBucket(rating(f, 'complexity').value, COMPLEXITY_SCALE);
export const confidenceOf = (f: ResearchFeature) =>
  scaleBucket(rating(f, 'confidence').value, CONFIDENCE_SCALE);
/** Appreciation bucket: the scale word, or Mixed / Unproven / Indirect as the paper writes them. */
export const appreciationOf = (f: ResearchFeature) => {
  const r = rating(f, 'appreciation').value;
  return /^(indirect|mixed|unproven)/i.test(r) ? r.split(' ')[0] : scaleBucket(r, DEMAND_SCALE);
};
export const APPRECIATION_KEYS = [...DEMAND_SCALE, 'Mixed', 'Unproven', 'Indirect'] as const;
export const demandOf = (f: ResearchFeature) => {
  const r = rating(f, 'demand').value;
  return /^(indirect|emerging)/i.test(r) ? 'Indirect / emerging' : scaleBucket(r, DEMAND_SCALE);
};

// ── Merged view ─────────────────────────────────────────────────────────────────────────────────────────────────

export interface ViewFinding extends ResearchFinding {
  doc: string;
  excerpt: string;
  /** Explicit refs plus every `[^ref-N]` in the excerpt. */
  allRefs: string[];
}
export interface ViewFeature extends ResearchFeature {
  /** Documents this feature appears in, first one defines its fields. */
  docs: string[];
  children: string[];
  /** In an earlier edition of its paper but not in the latest one. Kept, never deleted. */
  retired: boolean;
}
export interface ViewCompetitor extends Competitor {
  docs: string[];
  findings: string[];
  features: string[];
}
export interface ViewDocument {
  doc: ResearchDocument;
  versions: number[];
  importedAt: string;
  latest: ResearchBundle;
}

export interface CatalogView {
  documents: ViewDocument[];
  categories: ResearchCategory[];
  sections: (ResearchSection & { doc: string })[];
  findings: Map<string, ViewFinding>;
  /** Keyed `<doc id>#<citation id>` (footnote ids are local to a paper). */
  citations: Map<string, Citation & { doc: string }>;
  bibliography: (BibEntry & { doc: string })[];
  competitors: Map<string, ViewCompetitor>;
  features: Map<string, ViewFeature>;
  contradictions: (Contradiction & { doc: string })[];
  unextracted: (Unextracted & { doc: string })[];
}

const REF = /\[\^(ref-\d+)\]/g;
export const excerptOf = (text: string | undefined, [a, b]: [number, number]) =>
  text
    ? text
        .split('\n')
        .slice(a - 1, b)
        .join('\n')
    : '';
const union = (a: string[], b: string[]) => [...new Set([...a, ...b])];

/** Latest edition of each paper, merged into one view. Older editions only add features they had (as retired). */
export function buildView(stored: StoredBundle[]): CatalogView {
  const byDoc = new Map<string, StoredBundle[]>();
  for (const s of stored) byDoc.set(s.docId, [...(byDoc.get(s.docId) ?? []), s]);
  const documents: ViewDocument[] = [...byDoc.values()]
    .map((list) => {
      const sorted = [...list].sort((a, b) => a.version - b.version);
      const last = sorted[sorted.length - 1];
      return {
        doc: last.bundle.document,
        versions: sorted.map((s) => s.version),
        importedAt: last.importedAt,
        latest: last.bundle,
      };
    })
    .sort((a, b) => a.doc.date.localeCompare(b.doc.date) || a.doc.id.localeCompare(b.doc.id));

  const view: CatalogView = {
    documents,
    categories: [],
    sections: [],
    findings: new Map(),
    citations: new Map(),
    bibliography: [],
    competitors: new Map(),
    features: new Map(),
    contradictions: [],
    unextracted: [],
  };
  const addFeature = (f: ResearchFeature, doc: string, retired: boolean) => {
    const cur = view.features.get(f.id);
    if (!cur) {
      view.features.set(f.id, { ...f, docs: [doc], children: [], retired });
      return;
    }
    if (!cur.docs.includes(doc)) cur.docs.push(doc);
    cur.findings = union(cur.findings, f.findings);
    cur.competitors = union(cur.competitors, f.competitors);
    cur.tags = union(cur.tags, f.tags);
    cur.related = union(cur.related, f.related);
    cur.dependencies = union(cur.dependencies, f.dependencies);
    if (!retired) cur.retired = false;
  };
  for (const { latest: b, doc } of documents) {
    const id = doc.id;
    for (const c of b.categories)
      if (!view.categories.some((x) => x.id === c.id)) view.categories.push(c);
    view.sections.push(...b.sections.map((s) => ({ ...s, doc: id })));
    for (const f of b.findings) {
      const excerpt = excerptOf(doc.text, f.lines);
      view.findings.set(f.id, {
        ...f,
        doc: id,
        excerpt,
        allRefs: union(
          f.refs ?? [],
          [...excerpt.matchAll(REF)].map((m) => m[1]),
        ),
      });
    }
    for (const c of b.citations) view.citations.set(`${id}#${c.id}`, { ...c, doc: id });
    view.bibliography.push(...b.bibliography.map((x) => ({ ...x, doc: id })));
    for (const c of b.competitors) {
      const cur = view.competitors.get(c.id);
      if (cur) {
        if (!cur.docs.includes(id)) cur.docs.push(id);
      } else view.competitors.set(c.id, { ...c, docs: [id], findings: [], features: [] });
    }
    for (const f of b.features) addFeature(f, id, false);
    view.contradictions.push(...b.contradictions.map((c) => ({ ...c, doc: id })));
    view.unextracted.push(...b.unextracted.map((u) => ({ ...u, doc: id })));
  }
  // Features an older edition had and the latest dropped stay visible as retired.
  for (const list of byDoc.values()) {
    const latest = list.reduce((a, b) => (b.version > a.version ? b : a));
    for (const s of list)
      if (s !== latest)
        for (const f of s.bundle.features)
          if (!view.features.has(f.id)) {
            addFeature(
              { ...f, findings: f.findings.filter((n) => view.findings.has(n)) },
              s.docId,
              true,
            );
          }
  }
  for (const f of view.features.values())
    if (f.parent) view.features.get(f.parent)?.children.push(f.id);
  for (const fd of view.findings.values())
    for (const c of fd.competitors ?? []) view.competitors.get(c)?.findings.push(fd.id);
  for (const f of view.features.values())
    for (const c of f.competitors) {
      const vc = view.competitors.get(c);
      if (vc && !vc.features.includes(f.id)) vc.features.push(f.id);
    }
  return view;
}

/** JSON with sorted keys, so two copies of the same content compare equal whatever their key order. */
export function canonical(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(canonical).join(',')}]`;
  if (v && typeof v === 'object')
    return `{${Object.keys(v)
      .sort()
      .filter((k) => (v as Record<string, unknown>)[k] !== undefined)
      .map((k) => `${JSON.stringify(k)}:${canonical((v as Record<string, unknown>)[k])}`)
      .join(',')}}`;
  return JSON.stringify(v);
}
// ── Decisions ───────────────────────────────────────────────────────────────────────────────────────────────────

export const defaultMark = (id: string, now: string): ResearchMark => ({
  id,
  selection: 'unreviewed',
  implementation: 'not-started',
  priority: '',
  notes: '',
  reviewed: false,
  links: [],
  createdAt: now,
  updatedAt: now,
});

export function validateMark(x: unknown): string[] {
  const m = x as Partial<ResearchMark>;
  if (!m || typeof m !== 'object' || !isStr(m.id) || !m.id) return ['Decision without an id.'];
  const e: string[] = [];
  if (!SELECTIONS.includes(m.selection as Selection))
    e.push(t('{id}: unknown selection state.', { id: m.id }));
  if (!IMPLEMENTATIONS.includes(m.implementation as Implementation))
    e.push(t('{id}: unknown implementation status.', { id: m.id }));
  if (!USER_PRIORITIES.includes(m.priority as never))
    e.push(t('{id}: unknown priority.', { id: m.id }));
  if (
    !isStr(m.notes) ||
    typeof m.reviewed !== 'boolean' ||
    !isStrArr(m.links) ||
    !isStr(m.createdAt) ||
    !isStr(m.updatedAt)
  )
    e.push(t('{id}: incomplete decision.', { id: m.id }));
  if (m.mergedInto !== undefined && !isStr(m.mergedInto))
    e.push(t('{id}: bad merge target.', { id: m.id }));
  if (m.implementationSetAt !== undefined && !isStr(m.implementationSetAt))
    e.push(t('{id}: bad implementation date.', { id: m.id }));
  return e;
}

// ── Catalog projection ──────────────────────────────────────────────────────────────────────────────────────────

/** Ordinal reading of the paper's rating words, for sorting only ("High for cabinetry" → 4). Not a research value. */
export function level(s: string): number {
  const t = s.toLowerCase();
  if (t.startsWith('not evaluated') || t === 'unknown') return 0;
  const num = Number.parseFloat(t);
  if (!Number.isNaN(num)) return num;
  for (const [w, v] of [
    ['very high', 5],
    ['high/medium', 3.75],
    ['medium-high', 3.5],
    ['medium-low', 2.5],
    ['low-medium', 2.5],
    ['high', 4],
    ['medium', 3],
    ['low', 2],
  ] as const)
    if (t.startsWith(w)) return v;
  return 1;
}
/** P0 → 0, P0/P1 → 0.5, P1 internal → 1, not evaluated → 9. */
export function priorityRank(s: string): number {
  const m = s.match(/P(\d)(?:\/P(\d))?/);
  if (!m) return 9;
  return m[2] ? (Number(m[1]) + Number(m[2])) / 2 : Number(m[1]);
}

export interface FeatureQuery {
  q: string;
  category: string;
  selection: Selection | '';
  implementation: Implementation | '';
  origin: 'explicit' | 'inferred' | '';
  priority: string;
  evidence: '' | 'with' | 'without';
  /** Only Shortlisted and Approved. */
  planned: boolean;
  /** Only features without a parent. */
  topLevel: boolean;
  showMerged: boolean;
  /** Only features the app has not built yet (Not Started, Planned, In Progress) — ADR-092. */
  left: boolean;
  /** Rating filters (effective rating: the paper's, else the assessment). */
  demand: string;
  valueBand: string;
  complexity: string;
  confidence: string;
  rated: '' | 'paper' | 'assessment';
  appreciation: string;
}
export const EMPTY_QUERY: FeatureQuery = {
  q: '',
  category: '',
  selection: '',
  implementation: '',
  origin: '',
  priority: '',
  evidence: '',
  planned: false,
  topLevel: false,
  showMerged: false,
  left: false,
  demand: '',
  valueBand: '',
  complexity: '',
  confidence: '',
  rated: '',
  appreciation: '',
};

export const markOf = (marks: Record<string, ResearchMark>, id: string): ResearchMark =>
  marks[id] ?? defaultMark(id, '');

/**
 * Implementation status shown for a feature (ADR-092): the user's choice when they set one (or any status other
 * than the default from before ADR-092), else the app's own record, else Not Started.
 */
export function implementationOf(
  f: ResearchFeature,
  marks: Record<string, ResearchMark>,
): Implementation {
  const m = marks[f.id];
  if (m && (m.implementationSetAt || m.implementation !== 'not-started')) return m.implementation;
  return f.app?.status ?? 'not-started';
}
/** Who decided the shown status. */
export const implementationSource = (
  f: ResearchFeature,
  marks: Record<string, ResearchMark>,
): 'user' | 'app' | 'none' => {
  const m = marks[f.id];
  if (m && (m.implementationSetAt || m.implementation !== 'not-started')) return 'user';
  return f.app ? 'app' : 'none';
};
/** "none" in a mark undoes a curated merge on this device. */
export const UNMERGED = 'none';
/** Merge target shown for a feature: the user's merge or un-merge, else the curated merge (ADR-092). */
export function mergedOf(
  f: ResearchFeature,
  marks: Record<string, ResearchMark>,
): string | undefined {
  const m = marks[f.id]?.mergedInto;
  if (m === UNMERGED) return undefined;
  return m || f.mergedInto;
}

export function filterFeatures(
  view: CatalogView,
  marks: Record<string, ResearchMark>,
  q: FeatureQuery,
): ViewFeature[] {
  const words = q.q.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const compName = (id: string) => view.competitors.get(id)?.name ?? id;
  return [...view.features.values()].filter((f) => {
    const m = markOf(marks, f.id);
    if (mergedOf(f, marks) && !q.showMerged) return false;
    if (q.category && f.category !== q.category) return false;
    if (q.selection && m.selection !== q.selection) return false;
    if (q.implementation && implementationOf(f, marks) !== q.implementation) return false;
    if (q.origin && f.origin !== q.origin) return false;
    if (q.priority && !rating(f, 'priority').value.includes(q.priority)) return false;
    if (q.evidence === 'with' && !f.findings.length) return false;
    if (q.evidence === 'without' && f.findings.length) return false;
    if (q.planned && m.selection !== 'shortlisted' && m.selection !== 'approved') return false;
    if (q.topLevel && f.parent) return false;
    if (q.left && ['implemented', 'verified'].includes(implementationOf(f, marks))) return false;
    if (q.demand && demandOf(f) !== q.demand) return false;
    if (q.valueBand && valueBand(f) !== q.valueBand) return false;
    if (q.complexity && complexityOf(f) !== q.complexity) return false;
    if (q.confidence && confidenceOf(f) !== q.confidence) return false;
    if (q.rated && rating(f, 'impact').source !== q.rated) return false;
    if (q.appreciation && appreciationOf(f) !== q.appreciation) return false;
    if (!words.length) return true;
    const hay = [
      f.id,
      f.name,
      f.description,
      f.subcategory,
      f.userProblem,
      ...f.tags,
      ...f.requirements,
      ...f.useCases,
      ...f.competitors.map(compName),
      m.notes,
    ]
      .join(' ')
      .toLowerCase();
    return words.every((w) => hay.includes(w));
  });
}

export type SortKey =
  | 'research'
  | 'name'
  | 'category'
  | 'impact'
  | 'demand'
  | 'complexity'
  | 'confidence'
  | 'priority'
  | 'selection'
  | 'yours';
export function sortFeatures(
  list: ViewFeature[],
  key: SortKey,
  marks: Record<string, ResearchMark>,
  desc = false,
): ViewFeature[] {
  const sel = (f: ViewFeature) => SELECTIONS.indexOf(markOf(marks, f.id).selection);
  const yours = (f: ViewFeature) => {
    const p = markOf(marks, f.id).priority;
    return p ? Number(p[1]) : 9;
  };
  const research = (f: ViewFeature) =>
    f.rank ?? (f.recommendationRank ? 40 + f.recommendationRank : 100);
  const val: Record<SortKey, (f: ViewFeature) => number | string> = {
    research,
    name: (f) => f.name.toLowerCase(),
    category: (f) => f.category,
    impact: (f) => -level(rating(f, 'impact').value),
    demand: (f) => -level(rating(f, 'demand').value),
    complexity: (f) => level(rating(f, 'complexity').value) || 9,
    confidence: (f) => -level(rating(f, 'confidence').value),
    priority: (f) => priorityRank(rating(f, 'priority').value),
    selection: sel,
    yours,
  };
  const get = val[key];
  const out = [...list].sort((a, b) => {
    const x = get(a),
      y = get(b);
    return x < y ? -1 : x > y ? 1 : research(a) - research(b) || a.name.localeCompare(b.name);
  });
  return desc ? out.reverse() : out;
}

export type GroupBy = 'none' | 'category' | 'parent' | 'priority' | 'selection';
export interface FeatureGroup {
  key: string;
  label: string;
  items: ViewFeature[];
}
export function groupFeatures(
  list: ViewFeature[],
  by: GroupBy,
  view: CatalogView,
  marks: Record<string, ResearchMark>,
): FeatureGroup[] {
  if (by === 'none') return [{ key: 'all', label: 'All features', items: list }];
  const groups = new Map<string, FeatureGroup>();
  const put = (key: string, label: string, f: ViewFeature) => {
    const g = groups.get(key) ?? { key, label, items: [] };
    g.items.push(f);
    groups.set(key, g);
  };
  for (const f of list) {
    if (by === 'category')
      put(f.category, view.categories.find((c) => c.id === f.category)?.label ?? f.category, f);
    else if (by === 'parent') {
      const top = rootOf(view, f);
      put(top.id, top.name, f);
    } else if (by === 'priority') {
      const p = rating(f, 'priority');
      put(
        p.value,
        p.source === 'none' ? 'Research priority: not evaluated' : `Research priority ${p.value}`,
        f,
      );
    } else {
      const s = markOf(marks, f.id).selection;
      put(s, s[0].toUpperCase() + s.slice(1), f);
    }
  }
  const order =
    by === 'category'
      ? (g: FeatureGroup) => view.categories.findIndex((c) => c.id === g.key)
      : by === 'priority'
        ? (g: FeatureGroup) => priorityRank(g.key)
        : by === 'selection'
          ? (g: FeatureGroup) => SELECTIONS.indexOf(g.key as Selection)
          : () => 0;
  return [...groups.values()].sort((a, b) => order(a) - order(b) || a.label.localeCompare(b.label));
}
export function rootOf(view: CatalogView, f: ViewFeature): ViewFeature {
  let cur = f;
  for (let i = 0; i < 20 && cur.parent; i++) {
    const p = view.features.get(cur.parent);
    if (!p) break;
    cur = p;
  }
  return cur;
}
/** All descendants of a feature, depth first. */
export function descendants(view: CatalogView, id: string): ViewFeature[] {
  const out: ViewFeature[] = [];
  const walk = (x: string, depth: number) => {
    if (depth > 20) return;
    for (const c of view.features.get(x)?.children ?? []) {
      const f = view.features.get(c);
      if (f) {
        out.push(f);
        walk(c, depth + 1);
      }
    }
  };
  walk(id, 0);
  return out;
}

// ── Overview ────────────────────────────────────────────────────────────────────────────────────────────────────

export interface CatalogStats {
  features: number;
  topLevel: number;
  subfeatures: number;
  inferred: number;
  retired: number;
  merged: number;
  byCategory: { id: string; label: string; n: number }[];
  bySelection: Record<Selection, number>;
  byImplementation: Record<Implementation, number>;
  withEvidence: number;
  withoutEvidence: number;
  findings: number;
  unreviewedFindings: number;
  competitors: number;
  citations: number;
  sources: number;
  contradictions: number;
}

export function stats(view: CatalogView, marks: Record<string, ResearchMark>): CatalogStats {
  const all = [...view.features.values()];
  const bySelection = Object.fromEntries(SELECTIONS.map((s) => [s, 0])) as Record<
    Selection,
    number
  >;
  const byImplementation = Object.fromEntries(IMPLEMENTATIONS.map((s) => [s, 0])) as Record<
    Implementation,
    number
  >;
  for (const f of all) {
    const m = markOf(marks, f.id);
    bySelection[m.selection]++;
    // Merged features are hidden from the lists, so they are not counted here either (review 2026-10-26).
    if (!mergedOf(f, marks)) byImplementation[implementationOf(f, marks)]++;
  }
  return {
    features: all.length,
    topLevel: all.filter((f) => !f.parent).length,
    subfeatures: all.filter((f) => f.parent).length,
    inferred: all.filter((f) => f.origin === 'inferred').length,
    retired: all.filter((f) => f.retired).length,
    merged: all.filter((f) => mergedOf(f, marks)).length,
    byCategory: view.categories.map((c) => ({
      id: c.id,
      label: c.label,
      n: all.filter((f) => f.category === c.id).length,
    })),
    bySelection,
    byImplementation,
    withEvidence: all.filter((f) => f.findings.length).length,
    withoutEvidence: all.filter((f) => !f.findings.length).length,
    findings: view.findings.size,
    unreviewedFindings: [...view.findings.keys()].filter((id) => !marks[id]?.reviewed).length,
    competitors: view.competitors.size,
    citations: view.citations.size,
    sources: view.bibliography.length,
    contradictions: view.contradictions.length,
  };
}

/** First band of the effective research priority ("P0/P1" → P0, "P1 internal" → P1); '' when none. */
export const priorityBand = (f: ResearchFeature) =>
  rating(f, 'priority').value.match(/P[0-3]/)?.[0] ?? '';

// ── Assessment dashboard ────────────────────────────────────────────────────────────────────────────────────────

export interface AssessmentStats {
  ratedByPaper: number;
  assessed: number;
  unrated: number;
  byDemand: { key: string; n: number }[];
  byComplexity: { key: string; n: number }[];
  byConfidence: { key: string; n: number }[];
  byValue: { key: string; label: string; n: number }[];
  /** Value band (rows) × complexity (columns): feature ids. */
  matrix: { band: string; label: string; cells: { complexity: string; ids: string[] }[] }[];
  /** Highest value first; ties: lower complexity, higher confidence. */
  top: ViewFeature[];
  /** Value ≥ 4.0 and complexity Medium or lower. */
  quickWins: ViewFeature[];
  /** Value ≥ 4.0 but confidence Low-medium or lower: check before committing. */
  weakEvidence: ViewFeature[];
  /** P0 … P3 (dual bands such as P0/P1 counted under their first band). */
  byPriority: { key: string; n: number }[];
  byAppreciation: { key: string; n: number }[];
}

const num = (f: ResearchFeature) => Number.parseFloat(rating(f, 'impact').value) || 0;
const byValue = (a: ViewFeature, b: ViewFeature) =>
  num(b) - num(a) ||
  level(rating(a, 'complexity').value) - level(rating(b, 'complexity').value) ||
  level(rating(b, 'confidence').value) - level(rating(a, 'confidence').value) ||
  a.name.localeCompare(b.name);

/** Distribution of demand, value, complexity and confidence over the listed features (merged ones excluded by the caller). */
export function assessmentStats(list: ViewFeature[]): AssessmentStats {
  const count = <K extends string>(keys: readonly K[], of: (f: ViewFeature) => string) => {
    const out = keys.map((key) => ({
      key: key as string,
      n: list.filter((f) => of(f) === key).length,
    }));
    const other = list.filter((f) => !keys.includes(of(f) as K)).length;
    return other ? [...out, { key: 'Other', n: other }] : out;
  };
  const sorted = [...list].sort(byValue);
  const lowComplexity = new Set<string>(['Low', 'Low-medium', 'Medium']);
  return {
    ratedByPaper: list.filter((f) => rating(f, 'impact').source === 'paper').length,
    assessed: list.filter((f) => rating(f, 'impact').source === 'assessment').length,
    unrated: list.filter((f) => !fullyRated(f)).length,
    byDemand: count([...DEMAND_SCALE, 'Indirect / emerging'], demandOf),
    byComplexity: count(COMPLEXITY_SCALE, complexityOf),
    byConfidence: count([...CONFIDENCE_SCALE].reverse(), confidenceOf),
    byValue: VALUE_BANDS.map(([key, label]) => ({
      key,
      label,
      n: list.filter((f) => valueBand(f) === key).length,
    })),
    matrix: VALUE_BANDS.map(([band, label]) => ({
      band,
      label,
      cells: COMPLEXITY_SCALE.map((c) => ({
        complexity: c,
        ids: sorted.filter((f) => valueBand(f) === band && complexityOf(f) === c).map((f) => f.id),
      })),
    })),
    top: sorted.slice(0, 12),
    quickWins: sorted.filter((f) => num(f) >= 4 && lowComplexity.has(complexityOf(f))),
    weakEvidence: sorted.filter(
      (f) => num(f) >= 4 && ['Low', 'Low-medium'].includes(confidenceOf(f)),
    ),
    byAppreciation: count(APPRECIATION_KEYS, appreciationOf),
    byPriority: ['P0', 'P1', 'P2', 'P3'].map((key) => ({
      key,
      n: list.filter((f) => priorityBand(f) === key).length,
    })),
  };
}
