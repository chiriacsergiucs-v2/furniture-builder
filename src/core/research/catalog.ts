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
    if (!Array.isArray(b[k])) e.push(`"${k}" must be a list.`);
  }
  if (e.length) return e;
  const lineCount = isStr(d!.text) ? d!.text.split('\n').length : Infinity;
  const unique = (kind: string, ids: unknown[]) => {
    const seen = new Set<unknown>();
    for (const i of ids) {
      if (!isStr(i) || !i) e.push(`${kind}: missing id.`);
      else if (seen.has(i)) e.push(`${kind}: duplicate id ${i}.`);
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
    if (!isLines(l)) e.push(`${what}: lines must be [first, last].`);
    else if (l[1] > lineCount)
      e.push(`${what}: lines ${l[0]}–${l[1]} are past the end of the document.`);
  };
  for (const s of b.sections!) {
    if (!isStr(s.title)) e.push(`Section ${s.id}: missing title.`);
    inDoc(`Section ${s.id}`, s.lines);
    if (s.parent && !secs.has(s.parent)) e.push(`Section ${s.id}: unknown parent ${s.parent}.`);
  }
  for (const f of b.findings!) {
    if (!secs.has(f.section)) e.push(`Finding ${f.id}: unknown section ${f.section}.`);
    if (!isStr(f.statement) || !f.statement) e.push(`Finding ${f.id}: missing statement.`);
    inDoc(`Finding ${f.id}`, f.lines);
    for (const c of f.competitors ?? [])
      if (!comps.has(c)) e.push(`Finding ${f.id}: unknown competitor ${c}.`);
  }
  for (const c of b.citations!)
    if (!isStrArr(c.urls)) e.push(`Citation ${c.id}: urls must be a list.`);
  for (const c of b.competitors!)
    if (!isStr(c.name) || !c.name) e.push(`Competitor ${c.id}: missing name.`);
  for (const f of b.features!) {
    const at = `Feature ${f.id}`;
    if (!isStr(f.name) || !f.name || !isStr(f.description))
      e.push(`${at}: needs a name and a description.`);
    if (!cats.has(f.category)) e.push(`${at}: unknown category ${f.category}.`);
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
      if (!isStrArr(f[k])) e.push(`${at}: "${k}" must be a list of text.`);
    if (!isStrArr(f.findings)) continue;
    for (const n of f.findings) if (!finds.has(n)) e.push(`${at}: unknown finding ${n}.`);
    for (const c of f.competitors ?? [])
      if (!comps.has(c)) e.push(`${at}: unknown competitor ${c}.`);
    if (
      f.origin === 'inferred' &&
      !(f.inferredFrom?.length && f.inferredFrom.every((n) => finds.has(n)))
    )
      e.push(`${at}: an inferred feature must list the findings it is inferred from.`);
    if (f.origin !== 'explicit' && f.origin !== 'inferred')
      e.push(`${at}: origin must be explicit or inferred.`);
    if (f.parent === f.id) e.push(`${at}: is its own parent.`);
    if ('selection' in f || 'notes' in f)
      e.push(`${at}: user decisions are not part of a research file.`);
    if (f.assessment)
      e.push(...validateAssessment(f.assessment).map((x) => `${at}: assessment ${x}`));
  }
  for (const c of b.contradictions!) {
    for (const n of c.findings ?? [])
      if (!finds.has(n)) e.push(`Contradiction ${c.id}: unknown finding ${n}.`);
    for (const f of c.features ?? [])
      if (!feats.has(f)) e.push(`Contradiction ${c.id}: unknown feature ${f}.`);
  }
  for (const u of b.unextracted!) {
    inDoc(`Unextracted ${u.id}`, u.lines);
    if (!isStr(u.reason) || !u.reason) e.push(`Unextracted ${u.id}: a reason is required.`);
  }
  return e;
}

/** Problems with an assessment: every criterion scored 1–5, words from the paper's scales, a rationale and an author. */
export function validateAssessment(a: Assessment): string[] {
  const e: string[] = [];
  for (const [k] of ASSESSMENT_CRITERIA) {
    const v = a.scores?.[k];
    if (!Number.isInteger(v) || v < 1 || v > 5) e.push(`${k} must be a whole score 1–5.`);
  }
  if (!COMPLEXITY_SCALE.includes(a.complexity))
    e.push(`complexity must be one of ${COMPLEXITY_SCALE.join(', ')}.`);
  if (!CONFIDENCE_SCALE.includes(a.confidence))
    e.push(`confidence must be one of ${CONFIDENCE_SCALE.join(', ')}.`);
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

// ── Import planning ─────────────────────────────────────────────────────────────────────────────────────────────

export type ImportStatus =
  'invalid' | 'new-document' | 'new-version' | 'unchanged' | 'conflict' | 'older-version';
export interface ImportPlan {
  status: ImportStatus;
  /** Store it (new document, new version, or an older edition kept as history). */
  store: boolean;
  errors: string[];
  docId: string;
  version: number;
  added: string[];
  changed: string[];
  /** Features of the previous edition missing from this one: kept, shown as retired. */
  retired: string[];
  /** Features of this paper that already exist from another paper: evidence is added, fields are kept. */
  mergedEvidence: string[];
  /** Different id, same name as a feature already in the catalog: offer to merge, never automatic. */
  possibleDuplicates: [string, string][];
  /** User decisions on this paper's features; never changed by an import. */
  decisionsKept: number;
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
const normName = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

/** What importing `incoming` would do, given what is stored and the user's decisions. Nothing is written here. */
export function planImport(
  stored: StoredBundle[],
  incoming: unknown,
  marks: Record<string, ResearchMark> = {},
): ImportPlan {
  const errors = validateBundle(incoming);
  const b = incoming as ResearchBundle;
  const base: ImportPlan = {
    status: 'invalid',
    store: false,
    errors,
    docId: b?.document?.id ?? '',
    version: b?.document?.version ?? 0,
    added: [],
    changed: [],
    retired: [],
    mergedEvidence: [],
    possibleDuplicates: [],
    decisionsKept: 0,
  };
  if (errors.length) return base;
  const same = stored.filter((s) => s.docId === b.document.id);
  const others = stored.filter((s) => s.docId !== b.document.id);
  const exact = same.find((s) => s.version === b.document.version);
  if (exact) {
    const equal = canonical(exact.bundle) === canonical(b);
    return {
      ...base,
      status: equal ? 'unchanged' : 'conflict',
      errors: equal
        ? []
        : [
            `Version ${b.document.version} of “${b.document.title}” is already stored with different content. Raise the version number to import the new edition.`,
          ],
    };
  }
  // Ids that must be unique across papers (findings and sections are evidence of one paper only).
  const otherView = buildView(others);
  const clash = b.findings
    .filter((f) => otherView.findings.has(f.id))
    .map((f) => f.id)
    .concat(
      b.sections.filter((s) => otherView.sections.some((x) => x.id === s.id)).map((s) => s.id),
    );
  if (clash.length)
    return {
      ...base,
      errors: [
        `These ids already belong to another paper: ${clash.slice(0, 8).join(', ')}${clash.length > 8 ? ' …' : ''}.`,
      ],
    };
  const newest = same.reduce<StoredBundle | undefined>(
    (a, s) => (!a || s.version > a.version ? s : a),
    undefined,
  );
  const status: ImportStatus = !newest
    ? 'new-document'
    : b.document.version > newest.version
      ? 'new-version'
      : 'older-version';
  const prev = new Map((newest?.bundle.features ?? []).map((f) => [f.id, f]));
  const next = new Set(b.features.map((f) => f.id));
  const added: string[] = [],
    changed: string[] = [];
  for (const f of b.features) {
    const p = prev.get(f.id);
    if (!p) added.push(f.id);
    else if (canonical(p) !== canonical(f)) changed.push(f.id);
  }
  const retired = status === 'new-version' ? [...prev.keys()].filter((id) => !next.has(id)) : [];
  const mergedEvidence = b.features.filter((f) => otherView.features.has(f.id)).map((f) => f.id);
  const names = new Map([...otherView.features.values()].map((f) => [normName(f.name), f.id]));
  const possibleDuplicates = b.features.flatMap((f) => {
    const hit = names.get(normName(f.name));
    return hit && hit !== f.id ? [[f.id, hit] as [string, string]] : [];
  });
  const decisionsKept = [...new Set([...b.features.map((f) => f.id), ...prev.keys()])].filter(
    (id) => marks[id],
  ).length;
  return {
    ...base,
    status,
    store: true,
    added: status === 'new-document' ? b.features.map((f) => f.id) : added,
    changed,
    retired,
    mergedEvidence,
    possibleDuplicates,
    decisionsKept,
  };
}

// ── Coverage audit ──────────────────────────────────────────────────────────────────────────────────────────────

export interface SectionCoverage {
  section: ResearchSection;
  /** Lines with content (not blank, not a table rule or `---`). */
  total: number;
  covered: number;
  uncovered: number[];
  findings: string[];
  features: string[];
  supporting: string[];
  /** Findings linked to no feature, competitor or contradiction: kept as supporting research (method, caveats, sources…). */
  supportingOnly: string[];
  warnings: string[];
  status: 'complete' | 'partial' | 'no-text';
}
export interface AuditCheck {
  id: string;
  label: string;
  ok: boolean;
  detail: string;
}
export interface CoverageReport {
  doc: ResearchDocument;
  sections: SectionCoverage[];
  checks: AuditCheck[];
  lines: number;
  coveredLines: number;
}

const STRUCTURAL = /^\s*$|^\s*-{3,}\s*$|^\|?(\s*:?-{3,}:?\s*\|)+\s*$/;
const within = (l: number, [a, b]: [number, number]) => l >= a && l <= b;

/** Line-by-line account of one paper: which record holds each line, per section, plus integrity checks. */
export function coverage(b: ResearchBundle): CoverageReport {
  const text = b.document.text;
  const lines = text ? text.split('\n') : [];
  const covered = new Set<number>();
  const mark = ([a, z]: [number, number]) => {
    for (let l = a; l <= z; l++) covered.add(l);
  };
  for (const f of b.findings) mark(f.lines);
  for (const c of b.competitors) mark([c.line, c.line]);
  for (const s of b.bibliography) mark([s.line, s.line]);
  for (const c of b.citations) mark([c.line, c.line]);
  for (const s of b.sections) mark([s.lines[0], s.lines[0]]);
  lines.forEach((l, i) => {
    if (/^#{1,6}\s/.test(l)) covered.add(i + 1);
  });
  const unextracted = new Set<number>();
  for (const u of b.unextracted) for (let l = u.lines[0]; l <= u.lines[1]; l++) unextracted.add(l);
  const linked = new Set(b.features.flatMap((f) => [...f.findings, ...(f.inferredFrom ?? [])]));
  const contra = new Set(b.contradictions.flatMap((c) => c.findings));
  // Most specific section for a line: the smallest range that holds it.
  const sectionOf = (l: number) =>
    b.sections
      .filter((s) => within(l, s.lines))
      .sort((x, y) => x.lines[1] - x.lines[0] - (y.lines[1] - y.lines[0]))[0];
  const featuresOf = (ids: string[]) =>
    b.features.filter((f) => f.findings.some((n) => ids.includes(n))).map((f) => f.id);
  const sections: SectionCoverage[] = b.sections.map((s) => {
    const own = (l: number) => sectionOf(l)?.id === s.id;
    const findings = b.findings.filter((f) => f.section === s.id).map((f) => f.id);
    const supporting = [
      ...b.competitors.filter((c) => own(c.line)).map((c) => c.id),
      ...b.bibliography.filter((x) => own(x.line)).map((x) => x.id),
      ...b.citations.filter((c) => own(c.line)).map((c) => c.id),
      ...b.contradictions
        .filter((c) => c.findings.some((n) => findings.includes(n)))
        .map((c) => c.id),
    ];
    const supportingOnly = findings.filter(
      (n) =>
        !linked.has(n) &&
        !contra.has(n) &&
        !b.findings.find((f) => f.id === n)?.competitors?.length,
    );
    if (!text)
      return {
        section: s,
        total: 0,
        covered: 0,
        uncovered: [],
        findings,
        features: featuresOf(findings),
        supporting,
        supportingOnly,
        warnings: ['The document text is not stored, so lines cannot be checked.'],
        status: 'no-text' as const,
      };
    let total = 0,
      ok = 0;
    const uncovered: number[] = [];
    for (let l = s.lines[0]; l <= s.lines[1]; l++) {
      if (!own(l) || STRUCTURAL.test(lines[l - 1] ?? '')) continue;
      total++;
      if (covered.has(l)) ok++;
      else if (!unextracted.has(l)) uncovered.push(l);
    }
    const warnings: string[] = [];
    if (uncovered.length)
      warnings.push(
        `${uncovered.length} line(s) not held by any record: ${uncovered.slice(0, 12).join(', ')}${uncovered.length > 12 ? ' …' : ''}`,
      );
    for (const u of b.unextracted)
      if (u.lines.some((l) => own(l)))
        warnings.push(`UNEXTRACTED lines ${u.lines[0]}–${u.lines[1]}: ${u.reason}`);
    return {
      section: s,
      total,
      covered: ok,
      uncovered,
      findings,
      features: featuresOf(findings),
      supporting,
      supportingOnly,
      warnings,
      status: uncovered.length || warnings.length ? ('partial' as const) : ('complete' as const),
    };
  });
  return {
    doc: b.document,
    sections,
    checks: auditChecks(b),
    lines: lines.length,
    coveredLines: sections.reduce((n, s) => n + s.covered, 0),
  };
}

/** Second, independent pass: does every citation, URL, request, complaint and ranked item have a record? */
export function auditChecks(b: ResearchBundle): AuditCheck[] {
  const text = b.document.text ?? '';
  const used = [...new Set([...text.matchAll(REF)].map((m) => m[1]))];
  const cites = new Set(b.citations.map((c) => c.id));
  const urls = [...new Set([...text.matchAll(/https?:\/\/[^\s)>\]]+/g)].map((m) => m[0]))];
  const known = new Set([
    ...b.citations.flatMap((c) => c.urls),
    ...b.bibliography.map((x) => x.url),
  ]);
  const linked = new Set(b.features.flatMap((f) => f.findings));
  const lines = text.split('\n');
  const unlinked = (kinds: ResearchFinding['kind'][]) =>
    b.findings.filter((f) => kinds.includes(f.kind) && !linked.has(f.id)).map((f) => f.id);
  const withComp = new Set([
    ...b.findings.flatMap((f) => f.competitors ?? []),
    ...b.features.flatMap((f) => f.competitors),
  ]);
  const check = (id: string, label: string, bad: string[], what: string): AuditCheck => ({
    id,
    label,
    ok: bad.length === 0,
    detail: bad.length
      ? `${bad.length} ${what}: ${bad.slice(0, 10).join(', ')}${bad.length > 10 ? ' …' : ''}`
      : 'All accounted for.',
  });
  return [
    check(
      'citations-defined',
      'Every citation used in the text has a citation record',
      used.filter((r) => !cites.has(r)),
      'without a record',
    ),
    check(
      'citations-match',
      'Every citation record matches its footnote line',
      text
        ? b.citations
            .filter(
              (c) =>
                !(lines[c.line - 1] ?? '').startsWith(`[^${c.id}]:`) ||
                c.urls.some((u) => !(lines[c.line - 1] ?? '').includes(u)),
            )
            .map((c) => c.id)
        : [],
      'not matching the document',
    ),
    check(
      'urls',
      'Every URL in the text is in a citation or source record',
      urls.filter((u) => !known.has(u)),
      'URLs without a record',
    ),
    check(
      'ranked',
      'Every ranked feature row is linked to a feature',
      unlinked(['feature']),
      'rows not linked',
    ),
    check(
      'recommendations',
      'Every recommendation is linked to a feature',
      unlinked(['recommendation']),
      'not linked',
    ),
    check(
      'requests',
      'Every user request and complaint is linked to a feature',
      unlinked(['request', 'complaint']),
      'not linked',
    ),
    check(
      'requirements',
      'Every requirement is linked to a feature',
      unlinked(['requirement']),
      'not linked',
    ),
    check(
      'competitors',
      'Every competitor has at least one finding or feature',
      b.competitors.filter((c) => !withComp.has(c.id)).map((c) => c.id),
      'competitors without evidence',
    ),
    check(
      'inferred',
      'Every inferred feature names the findings it comes from',
      b.features.filter((f) => f.origin === 'inferred' && !f.inferredFrom?.length).map((f) => f.id),
      'inferred without basis',
    ),
    check(
      'evidence',
      'Every feature has at least one supporting finding',
      b.features.filter((f) => !f.findings.length).map((f) => f.id),
      'features without evidence',
    ),
    check(
      'unextracted',
      'Nothing is marked UNEXTRACTED',
      b.unextracted.map((u) => `${u.lines[0]}–${u.lines[1]}`),
      'UNEXTRACTED ranges',
    ),
  ];
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
  if (!SELECTIONS.includes(m.selection as Selection)) e.push(`${m.id}: unknown selection state.`);
  if (!IMPLEMENTATIONS.includes(m.implementation as Implementation))
    e.push(`${m.id}: unknown implementation status.`);
  if (!USER_PRIORITIES.includes(m.priority as never)) e.push(`${m.id}: unknown priority.`);
  if (
    !isStr(m.notes) ||
    typeof m.reviewed !== 'boolean' ||
    !isStrArr(m.links) ||
    !isStr(m.createdAt) ||
    !isStr(m.updatedAt)
  )
    e.push(`${m.id}: incomplete decision.`);
  if (m.mergedInto !== undefined && !isStr(m.mergedInto)) e.push(`${m.id}: bad merge target.`);
  return e;
}

/** Decisions from a file join the device's; when both have one for the same record, the device's is kept. */
export function mergeMarks(
  local: Record<string, ResearchMark>,
  incoming: unknown[],
): { add: ResearchMark[]; kept: number; invalid: number } {
  const add: ResearchMark[] = [];
  let kept = 0,
    invalid = 0;
  for (const m of incoming) {
    if (validateMark(m).length) {
      invalid++;
      continue;
    }
    const mk = m as ResearchMark;
    const cur = local[mk.id];
    if (!cur) add.push(mk);
    else if (canonical(cur) !== canonical(mk)) kept++;
  }
  return { add, kept, invalid };
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
  demand: '',
  valueBand: '',
  complexity: '',
  confidence: '',
  rated: '',
  appreciation: '',
};

export const markOf = (marks: Record<string, ResearchMark>, id: string): ResearchMark =>
  marks[id] ?? defaultMark(id, '');

export function filterFeatures(
  view: CatalogView,
  marks: Record<string, ResearchMark>,
  q: FeatureQuery,
): ViewFeature[] {
  const words = q.q.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const compName = (id: string) => view.competitors.get(id)?.name ?? id;
  return [...view.features.values()].filter((f) => {
    const m = markOf(marks, f.id);
    if (m.mergedInto && !q.showMerged) return false;
    if (q.category && f.category !== q.category) return false;
    if (q.selection && m.selection !== q.selection) return false;
    if (q.implementation && m.implementation !== q.implementation) return false;
    if (q.origin && f.origin !== q.origin) return false;
    if (q.priority && !rating(f, 'priority').value.includes(q.priority)) return false;
    if (q.evidence === 'with' && !f.findings.length) return false;
    if (q.evidence === 'without' && f.findings.length) return false;
    if (q.planned && m.selection !== 'shortlisted' && m.selection !== 'approved') return false;
    if (q.topLevel && f.parent) return false;
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
  coverage: { doc: string; title: string; covered: number; total: number; complete: boolean }[];
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
    byImplementation[m.implementation]++;
  }
  return {
    features: all.length,
    topLevel: all.filter((f) => !f.parent).length,
    subfeatures: all.filter((f) => f.parent).length,
    inferred: all.filter((f) => f.origin === 'inferred').length,
    retired: all.filter((f) => f.retired).length,
    merged: all.filter((f) => markOf(marks, f.id).mergedInto).length,
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
    coverage: view.documents.map((d) => {
      const r = coverage(d.latest);
      const total = r.sections.reduce((n, s) => n + s.total, 0);
      return {
        doc: d.doc.id,
        title: d.doc.title,
        covered: r.coveredLines,
        total,
        complete: r.sections.every((s) => s.status === 'complete') && r.checks.every((c) => c.ok),
      };
    }),
  };
}

// ── Specification export ────────────────────────────────────────────────────────────────────────────────────────

const bullet = (items: string[], none = '_not evaluated_') =>
  items.length ? items.map((s) => `- ${s}`).join('\n') : none;

/** Markdown specification of chosen features for a later development session. Selection only; nothing is built. */
export function specMarkdown(
  view: CatalogView,
  marks: Record<string, ResearchMark>,
  ids: string[],
  generatedAt: string,
): string {
  const name = (id: string) => view.features.get(id)?.name ?? id;
  const out: string[] = [
    '# Selected features — specification for a future development session',
    '',
    `Generated ${generatedAt} from the Feature Research & Catalog page. ${ids.length} feature(s).`,
    '',
    '> Selection is a planning decision only. None of these features has been started because it was selected; implementation is a separate, explicitly approved step.',
    '',
    `Sources: ${view.documents.map((d) => `${d.doc.title} (v${d.doc.version}, ${d.doc.date}${d.doc.file ? `, \`${d.doc.file}\`` : ''})`).join('; ')}.`,
  ];
  for (const id of ids) {
    const f = view.features.get(id);
    if (!f) continue;
    const m = markOf(marks, id);
    const cat = view.categories.find((c) => c.id === f.category)?.label ?? f.category;
    out.push(
      '',
      `## ${f.name}`,
      '',
      `\`${f.id}\` · ${cat} › ${f.subcategory}${f.parent ? ` · part of ${name(f.parent)}` : ''} · ${f.origin === 'inferred' ? '**Inferred opportunity (not a research conclusion)**' : 'Named in the research'}${f.retired ? ' · retired in the latest paper edition' : ''}`,
      '',
    );
    const r = (d: RatingDim) => {
      const x = rating(f, d);
      return x.source === 'assessment' ? `${x.value} (assessed)` : x.value;
    };
    out.push(
      `| Your decision | Implementation | Your priority | Research priority | Value | Complexity | Demand | Appreciation | Competitor adoption | Confidence |`,
      '|---|---|---|---|---|---|---|---|---|---|',
      `| ${m.selection} | ${m.implementation} | ${m.priority || '—'} | ${r('priority')} | ${r('impact')} | ${r('complexity')} | ${r('demand')} | ${r('appreciation')} | ${r('adoption')} | ${r('confidence')} |`,
      '',
    );
    if (f.assessment)
      out.push(
        `> **Assessment, not research:** the paper does not rate this feature. Scores (1–5) with the paper's method — ${ASSESSMENT_CRITERIA.map(([k, label]) => `${label} ${f.assessment!.scores[k]}`).join(', ')} → value ${assessedValue(f.assessment)}. ${f.assessment.rationale} Research priority ${r('priority')}: ${f.assessment.priorityBasis} Appreciation ${r('appreciation')}: ${f.assessment.appreciationBasis} (${f.assessment.by}, ${f.assessment.date})`,
        '',
      );
    out.push(f.description, '');
    out.push(`**User problem:** ${f.userProblem}`, '', `**User benefit:** ${f.userBenefit}`, '');
    if (f.mvp) out.push(`**MVP acceptance criterion (research):** ${f.mvp}`, '');
    out.push(
      '**Functional requirements**',
      '',
      bullet(f.requirements),
      '',
      '**Use cases**',
      '',
      bullet(f.useCases),
      '',
      '**Workflow**',
      '',
      bullet(f.workflow),
      '',
      '**Technical considerations**',
      '',
      bullet(f.technical),
      '',
    );
    out.push(
      '**Sub-features**',
      '',
      bullet(
        descendants(view, id).map((c) => `${c.name} (\`${c.id}\`)`),
        '_none_',
      ),
      '',
    );
    out.push(
      '**Dependencies**',
      '',
      bullet(
        f.dependencies.map((d) => `${name(d)} (\`${d}\`)`),
        '_none listed_',
      ),
      '',
      '**Related**',
      '',
      bullet(
        union(f.related, m.links).map((d) => `${name(d)} (\`${d}\`)`),
        '_none listed_',
      ),
      '',
    );
    out.push(
      '**Competitors**',
      '',
      bullet(
        f.competitors.map((c) => view.competitors.get(c)?.name ?? c),
        '_none listed_',
      ),
      '',
    );
    const contra = view.contradictions.filter((c) => c.features.includes(id));
    if (contra.length)
      out.push(
        '**Contradictions and conflicts**',
        '',
        bullet(
          contra.map(
            (c) =>
              `${c.title} (${c.basis === 'app' ? 'research vs this app' : c.basis === 'inferred' ? 'inferred tension' : 'stated in the paper'}): ${c.description}`,
          ),
        ),
        '',
      );
    if (f.appNotes?.length)
      out.push(
        '**This app today (repository observation, not research)**',
        '',
        bullet(f.appNotes),
        '',
      );
    out.push('**Research evidence**', '');
    for (const n of union(f.findings, f.inferredFrom ?? [])) {
      const fd = view.findings.get(n);
      if (!fd) continue;
      const doc = view.documents.find((d) => d.doc.id === fd.doc)?.doc;
      const urls = fd.allRefs.flatMap((r) => view.citations.get(`${fd.doc}#${r}`)?.urls ?? []);
      out.push(
        `- \`${fd.id}\` (${fd.kind}${fd.polarity ? `, ${fd.polarity}` : ''}) — ${fd.statement} _[${doc?.file ?? fd.doc}, lines ${fd.lines[0]}–${fd.lines[1]}]_${urls.length ? `\n  - Sources: ${[...new Set(urls)].join(' · ')}` : ''}`,
      );
    }
    if (m.notes.trim()) out.push('', '**Your notes**', '', m.notes.trim());
  }
  return out.join('\n') + '\n';
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
