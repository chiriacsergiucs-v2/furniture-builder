import 'fake-indexeddb/auto';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import {
  implementationOf,
  implementationSource,
  mergedOf,
  UNMERGED,
  assessedValue,
  assessmentStats,
  complexityOf,
  fullyRated,
  rating,
  validateAssessment,
  auditChecks,
  buildView,
  coverage,
  descendants,
  EMPTY_QUERY,
  filterFeatures,
  groupFeatures,
  sortFeatures,
  stats,
  storedOf,
  validateBundle,
  validateMark,
  type StoredBundle,
} from '../src/core/research/catalog';
import {
  ENSEMBLE_BUNDLE,
  MVP_ROWS,
  RANKED_ROWS,
  RECOMMENDATION_ROWS,
  rankLine,
  recommendationLine,
} from '../src/core/research/ensemble-2026-10-23';
import {
  ASSESSMENT_CRITERIA,
  type ResearchBundle,
  type ResearchMark,
} from '../src/core/research/types';
import { db, listResearchBundles, listResearchMarks, saveResearchBundle } from '../src/persist/db';
import { seedShipped, useResearch } from '../src/store/researchStore';
import { ResearchPage } from '../src/ui/Research';

const FILE = 'docs/research/2026-10-23-furniture-ensemble-builder.md';
const TEXT = readFileSync(FILE, 'utf8');
const LINES = TEXT.split('\n');
const B = ENSEMBLE_BUNDLE;
const AT = '2026-10-23T12:00:00.000Z';
const clone = <T>(x: T): T => structuredClone(x);
const cells = (line: number) =>
  LINES[line - 1]
    .split('|')
    .slice(1, -1)
    .map((c) =>
      c
        .replace(/\*\*/g, '')
        .replace(/\s*\[\^ref-\d+\]/g, '')
        .trim(),
    );
/** A consistent edition without feature `id` (no record keeps pointing at it). */
function dropFeature(b: ResearchBundle, id: string): ResearchBundle {
  return {
    ...b,
    features: b.features
      .filter((f) => f.id !== id)
      .map((f) => ({
        ...f,
        related: f.related.filter((x) => x !== id),
        dependencies: f.dependencies.filter((x) => x !== id),
        parent: f.parent === id ? undefined : f.parent,
      })),
    contradictions: b.contradictions.map((c) => ({
      ...c,
      features: c.features.filter((x) => x !== id),
    })),
  };
}
const mark = (id: string, patch: Partial<ResearchMark> = {}): ResearchMark => ({
  id,
  selection: 'approved',
  implementation: 'not-started',
  priority: 'P1',
  notes: 'mine',
  reviewed: false,
  links: [],
  createdAt: AT,
  updatedAt: AT,
  ...patch,
});

describe('research catalog: extracted data (ADR-043)', () => {
  it('is the committed paper, quoted verbatim', () => {
    expect(B.document.text).toBe(TEXT);
    expect(createHash('sha256').update(TEXT).digest('hex')).toBe(B.document.sha256);
    const view = buildView([storedOf(B, AT)]);
    const f = view.findings.get('ens.n.010')!;
    expect(f.excerpt).toBe(LINES[17]);
    expect(f.allRefs).toContain('ref-3');
  });
  it('validates, with unique ids and every reference resolved', () => {
    expect(validateBundle(B)).toEqual([]);
    const ids = new Set(B.features.map((f) => f.id));
    for (const f of B.features) {
      for (const d of [...f.dependencies, ...f.related, ...(f.parent ? [f.parent] : [])])
        expect(ids.has(d), `${f.id} → ${d}`).toBe(true);
      expect(f.findings.length, `${f.id} has evidence`).toBeGreaterThan(0);
    }
    // No parent cycles.
    for (const f of B.features) {
      let cur = f,
        n = 0;
      while (cur.parent && n++ < 30) cur = B.features.find((x) => x.id === cur.parent)!;
      expect(n).toBeLessThan(30);
    }
  });
  it("has a feature for every ranked row, with the paper's ratings word for word", () => {
    expect(RANKED_ROWS).toHaveLength(39);
    for (const [rank, name] of RANKED_ROWS) {
      const c = cells(rankLine(rank));
      expect(c[1]).toBe(name);
      const f = B.features.find((x) => x.rank === rank)!;
      expect(f, `rank ${rank}`).toBeDefined();
      expect([
        f.demand,
        f.appreciation,
        f.adoption,
        f.complexity,
        f.impact,
        f.confidence,
        f.priority,
      ]).toEqual(c.slice(2));
      expect(f.findings).toContain(`ens.n.rank-${String(rank).padStart(2, '0')}`);
    }
  });
  it('links every top-fifteen recommendation and every MVP row to a feature', () => {
    for (const [r, name] of RECOMMENDATION_ROWS) {
      expect(LINES[recommendationLine(r) - 1]).toContain(`**${name}**`);
      expect(
        B.features.some((f) => f.recommendationRank === r),
        `recommendation ${r}`,
      ).toBe(true);
    }
    for (const [line, name] of MVP_ROWS) {
      expect(cells(line)[0]).toBe(name);
      const f = B.features.find((x) => x.mvp === cells(line)[1]);
      expect(f, `MVP ${name}`).toBeDefined();
    }
  });
  it('has a record for every compared competitor, every footnote and every listed source', () => {
    for (let l = 40; l <= 55; l++) {
      const name = cells(l)[0];
      const c = B.competitors.find((x) => x.line === l)!;
      expect(c.name).toBe(name);
      expect(c.behaviour).toBe(cells(l)[1]);
      expect(c.commercial).toBe(cells(l)[3]);
    }
    expect(B.citations).toHaveLength(122);
    const urlLines = LINES.map((l, i) => [l, i + 1] as const).filter(([l]) =>
      /^\[[^\]]+\]\(https?:/.test(l),
    );
    expect(B.bibliography).toHaveLength(urlLines.length);
    for (const [l, n] of urlLines)
      expect(B.bibliography.find((b) => b.line === n)?.url).toBe(l.match(/\((https?:[^)]+)\)/)![1]);
  });
  it('accounts for every line of the paper and passes every audit check', () => {
    const r = coverage(B);
    for (const s of r.sections)
      expect(s.status, `${s.section.title}: ${s.warnings.join('; ')}`).toBe('complete');
    for (const c of r.checks) expect(c.ok, `${c.label}: ${c.detail}`).toBe(true);
    expect(r.coveredLines).toBe(r.sections.reduce((n, s) => n + s.total, 0));
  });
  it('catches an omission: dropping a finding leaves its lines uncovered', () => {
    const b = clone(B);
    b.findings = b.findings.filter(
      (f) => f.id !== 'ens.n.016' && f.id !== 'ens.n.014' && f.id !== 'ens.n.015',
    );
    b.features = b.features.map((f) => ({
      ...f,
      findings: f.findings.filter((n) => !['ens.n.014', 'ens.n.015', 'ens.n.016'].includes(n)),
    }));
    const exec = coverage(b).sections.find((s) => s.section.id === 'ens.s.exec')!;
    expect(exec.status).toBe('partial');
    expect(exec.uncovered).toEqual([22]);
  });
  it('marks inferred features and never lets them pass as research', () => {
    const inferred = B.features.filter((f) => f.origin === 'inferred');
    expect(inferred.length).toBeGreaterThan(0);
    for (const f of inferred) expect(f.inferredFrom!.length).toBeGreaterThan(0);
    const b = clone(B);
    b.features[0] = { ...b.features[0], origin: 'inferred', inferredFrom: [] };
    expect(validateBundle(b).join()).toMatch(/inferred feature must list/);
  });
});

describe('research catalog: view, filters and relationships', () => {
  const view = buildView([storedOf(B, AT)]);
  it('builds the parent / sub-feature tree', () => {
    const st = stats(view, {});
    expect(st.features).toBe(B.features.length);
    expect(st.topLevel + st.subfeatures).toBe(st.features);
    expect(st.subfeatures).toBeGreaterThan(50);
    expect(view.features.get('ens.f.guided-snapping')!.children).toEqual(
      expect.arrayContaining(['ens.f.snap-preview', 'ens.f.snap-override']),
    );
    expect(descendants(view, 'ens.f.collision-clearance').map((f) => f.id)).toContain(
      'ens.f.env-drawer',
    );
    expect(view.competitors.get('c.planner5d')!.features).toContain('ens.f.snap-override');
  });
  it('searches, filters, sorts and groups', () => {
    const marks = {
      'ens.f.countertops': mark('ens.f.countertops', { selection: 'shortlisted' }),
      'ens.f.auto-bom': mark('ens.f.auto-bom'),
    };
    expect(
      filterFeatures(view, {}, { ...EMPTY_QUERY, q: 'disable snapping' }).map((f) => f.id),
    ).toContain('ens.f.snap-override');
    expect(
      filterFeatures(view, marks, { ...EMPTY_QUERY, planned: true })
        .map((f) => f.id)
        .sort(),
    ).toEqual(['ens.f.auto-bom', 'ens.f.countertops']);
    expect(
      filterFeatures(view, {}, { ...EMPTY_QUERY, category: 'ai' }).every(
        (f) => f.category === 'ai',
      ),
    ).toBe(true);
    expect(filterFeatures(view, {}, { ...EMPTY_QUERY, origin: 'inferred' }).length).toBe(2);
    expect(filterFeatures(view, {}, { ...EMPTY_QUERY, evidence: 'without' })).toEqual([]);
    const byValue = sortFeatures([...view.features.values()], 'impact', {});
    expect(byValue[0].impact).toBe('5.0');
    expect(sortFeatures([...view.features.values()], 'research', {})[0].id).toBe(
      'ens.f.guided-snapping',
    );
    const groups = groupFeatures([...view.features.values()], 'priority', view, {});
    expect(groups[0].key).toBe('P0');
    expect(
      groupFeatures([...view.features.values()], 'selection', view, marks).map((g) => g.key),
    ).toEqual(['unreviewed', 'shortlisted', 'approved']);
    expect(
      groupFeatures([...view.features.values()], 'parent', view, {}).find(
        (g) => g.key === 'ens.f.generated-parts',
      )!.items.length,
    ).toBeGreaterThan(10);
  });
  it('keeps contradictions and conflicting estimates visible and resolvable to records', () => {
    for (const c of view.contradictions) {
      for (const n of c.findings) expect(view.findings.has(n), `${c.id} → ${n}`).toBe(true);
      for (const f of c.features) expect(view.features.has(f), `${c.id} → ${f}`).toBe(true);
    }
    expect(view.features.get('ens.f.auto-bom')!.priority).toBe('P0/P1');
    expect(view.contradictions.find((c) => c.title.startsWith('BOM priority'))!.features).toContain(
      'ens.f.auto-bom',
    );
  });
  it('reports a feature that has no evidence instead of hiding it', () => {
    const b = clone(B);
    b.features.push({
      ...b.features[0],
      id: 'ens.f.bare',
      parent: undefined,
      findings: [],
      rank: undefined,
      recommendationRank: undefined,
    });
    const v = buildView([storedOf(b, AT)]);
    expect(stats(v, {}).withoutEvidence).toBe(1);
    expect(filterFeatures(v, {}, { ...EMPTY_QUERY, evidence: 'without' }).map((f) => f.id)).toEqual(
      ['ens.f.bare'],
    );
    expect(auditChecks(b).find((c) => c.id === 'evidence')!.ok).toBe(false);
  });
});

describe('research catalog: a newer shipped edition (paper import removed, ADR-102)', () => {
  const v1 = storedOf(B, AT);
  it('uses the newest edition; features it drops stay visible as retired', () => {
    const v2 = dropFeature(clone(B), 'ens.f.ar-placement');
    v2.document.version = 2;
    v2.features.find((f) => f.id === 'ens.f.countertops')!.description = 'Edition 2 wording.';
    const view = buildView([v1, storedOf(v2, AT)]);
    expect(view.features.get('ens.f.countertops')!.description).toBe('Edition 2 wording.');
    expect(view.features.get('ens.f.ar-placement')!.retired).toBe(true);
    expect(view.documents[0].versions).toEqual([1, 2]);
  });
  it('rejects malformed bundles and never throws on bad input', () => {
    for (const bad of [
      null,
      42,
      'x',
      {},
      { format: 'furniture-builder-research', schemaVersion: 1 },
      { ...clone(B), features: 'no' },
    ])
      expect(validateBundle(bad).length).toBeGreaterThan(0);
  });
});

describe('research catalog: persistence', () => {
  it('seeds the shipped paper, keeps decisions across reloads and across a new edition', async () => {
    await db.researchDocs.clear();
    await db.researchMarks.clear();
    useResearch.setState({ loaded: false, marks: {} });
    await useResearch.getState().init();
    expect((await listResearchBundles()).map((s) => s.key)).toEqual(['ens-2026-10-23@1']);
    await useResearch
      .getState()
      .setMarks(['ens.f.countertops', 'ens.f.auto-bom'], { selection: 'shortlisted' });
    await useResearch.getState().setMarks(['ens.f.countertops'], {
      notes: 'Kitchen first',
      priority: 'P0',
      implementation: 'planned',
    });
    await useResearch.getState().setMarks(['ens.n.010'], { reviewed: true });
    // Reload from storage.
    useResearch.setState({ loaded: false, marks: {} });
    await useResearch.getState().init();
    const m = useResearch.getState().marks['ens.f.countertops'];
    expect([m.selection, m.notes, m.priority, m.implementation]).toEqual([
      'shortlisted',
      'Kitchen first',
      'P0',
      'planned',
    ]);
    expect(useResearch.getState().marks['ens.n.010'].reviewed).toBe(true);
    // A new edition imported: decisions untouched.
    const v2 = dropFeature(clone(B), 'ens.f.auto-bom');
    v2.document.version = 2;
    await saveResearchBundle(storedOf(v2, AT));
    useResearch.setState({ loaded: false, marks: {} });
    await useResearch.getState().init();
    expect((await listResearchMarks()).find((x) => x.id === 'ens.f.auto-bom')!.selection).toBe(
      'shortlisted',
    );
    expect((await listResearchBundles()).map((s) => s.key).sort()).toEqual([
      'ens-2026-10-23@1',
      'ens-2026-10-23@2',
    ]);
  });
  it('refreshes a shipped edition whose content changed, never a different edition', () => {
    const old = storedOf({ ...clone(B), features: [] }, AT);
    expect(seedShipped([old], [B], AT).map((s) => s.key)).toEqual(['ens-2026-10-23@1']);
    expect(seedShipped([storedOf(B, AT)], [B], AT)).toEqual([]);
  });
  it('skips and keeps an unreadable stored row', async () => {
    await db.researchDocs.put({
      key: 'bad@1',
      docId: 'bad',
      version: 1,
      importedAt: AT,
      bundle: { format: 'nope' } as never,
    } as StoredBundle);
    expect((await listResearchBundles()).some((s) => s.key === 'bad@1')).toBe(false);
    expect(await db.researchDocs.get('bad@1')).toBeDefined();
  });
});

describe('research catalog: page', () => {
  const render = (props: Record<string, unknown>) =>
    renderToStaticMarkup(createElement(ResearchPage, { onDone: () => {}, ...props }));
  it('has only the Features and Competitors tabs, opens on Features with the dashboard, and has no tick boxes', () => {
    const html = render({});
    expect(html).toContain('Feature Research &amp; Catalog');
    const tabs = [...html.matchAll(/role="tab"[^>]*>([^<]+)</g)].map((m) => m[1]);
    expect(tabs).toEqual(['Features', 'Competitors']);
    for (const gone of [
      'Overview',
      'Compare',
      'Findings',
      'Contradictions',
      'Sources',
      'Coverage audit',
      'Import &amp; export',
    ])
      expect(tabs).not.toContain(gone);
    expect(html).toContain('Built in this app');
    expect(html).toContain('Assessment: demand, value, complexity, confidence');
    expect(html).toContain('Search features');
    expect(html).not.toContain('Tick ');
    expect(html).not.toContain('Export specification');
  });
  it('lists every feature and sub-feature not merged into another, with decision and implementation controls', () => {
    const html = render({ initialTab: 'features' });
    const label = (name: string) =>
      `Your decision on ${name.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/'/g, '&#x27;')}`;
    for (const f of B.features.filter((x) => !x.mergedInto)) expect(html).toContain(label(f.name));
    for (const f of B.features.filter((x) => x.mergedInto))
      expect(html, f.id).not.toContain(label(f.name));
    expect(html).toContain('Implementation status');
  });
  it('shows a feature in full: sub-features, requirements, evidence with sources', () => {
    const html = render({ initialTab: 'features', initialDetail: 'ens.f.guided-snapping' });
    for (const s of [
      'Snap preview before commit',
      'Snap override',
      'Functional requirements',
      'Competitor comparison',
      'Pain points and complaints',
      'reddit.com',
      'lines 75',
    ])
      expect(html).toContain(s);
  });
});

describe('research catalog: assessment of demand, value, complexity and confidence', () => {
  const view = buildView([storedOf(B, AT)]);
  const all = [...view.features.values()];
  it("rates every feature: the paper's words where it rates, an assessment everywhere else", () => {
    for (const f of all) expect(fullyRated(f), f.id).toBe(true);
    for (const f of all.filter((x) => x.rank)) {
      expect(f.assessment, `${f.id} keeps the paper's ratings`).toBeUndefined();
      for (const d of ['demand', 'impact', 'complexity', 'confidence'] as const)
        expect(rating(f, d).source).toBe('paper');
    }
    const assessed = all.filter((x) => !x.rank);
    expect(assessed).toHaveLength(118);
    for (const f of assessed) {
      expect(f.assessment, f.id).toBeDefined();
      expect(validateAssessment(f.assessment!), f.id).toEqual([]);
      expect(rating(f, 'impact').source).toBe('assessment');
    }
  });
  it("computes value with the paper's weights", () => {
    expect(ASSESSMENT_CRITERIA.reduce((n, [, , w]) => n + w, 0)).toBeCloseTo(1);
    const so = view.features.get('ens.f.snap-override')!;
    expect(so.assessment!.scores).toEqual({
      relevance: 5,
      demand: 5,
      ux: 5,
      adoption: 4,
      differentiation: 3,
      leverage: 2,
    });
    expect(assessedValue(so.assessment!)).toBe('4.5'); // 1.5 + 1 + 1 + .6 + .3 + .1
    expect(rating(view.features.get('ens.f.composition-layer')!, 'demand').value).toBe('Indirect');
  });
  it("gives every assessed feature a research priority with its basis; the paper's priorities stay as written", () => {
    for (const f of all.filter((x) => x.assessment)) {
      expect(f.assessment!.priority, f.id).toMatch(/^P[0-3](\/P[0-3])?$/);
      expect(f.assessment!.priorityBasis.length, f.id).toBeGreaterThan(10);
      expect(rating(f, 'priority').source).toBe('assessment');
    }
    for (const f of all.filter((x) => x.rank))
      expect(rating(f, 'priority')).toEqual({ value: f.priority, source: 'paper' });
    expect(rating(view.features.get('ens.f.snap-override')!, 'priority').value).toBe('P0'); // MVP table row
    expect(rating(view.features.get('ens.f.clearance-envelopes')!, 'priority').value).toBe('P1'); // phase 2
    expect(rating(view.features.get('ens.f.composition-layer')!, 'priority').value).toBe(
      'P0 internal',
    );
    // A basis that names an MVP row or a phase must agree with the priority it gives.
    for (const f of all.filter((x) => x.assessment)) {
      const { priority, priorityBasis } = f.assessment!;
      if (priorityBasis.startsWith('MVP table')) expect(priority, f.id).toBe('P0');
      const ph = priorityBasis.match(/^Phase (\d)/);
      if (ph) expect(priority, f.id).toBe(`P${Number(ph[1]) - 1}`);
      const parent = priorityBasis.match(/^Parent: ([^(]+?) \(/);
      if (parent && f.parent) {
        const p = rating(view.features.get(f.parent)!, 'priority').value.replace(' internal', '');
        expect(priority, `${f.id} follows its parent`).toBe(p);
      }
    }
    expect(
      groupFeatures(all, 'priority', view, {}).some((g) => g.label.includes('not evaluated')),
    ).toBe(false);
    expect(assessmentStats(all).byPriority.reduce((n, r) => n + r.n, 0)).toBe(all.length);
    expect(
      filterFeatures(view, {}, { ...EMPTY_QUERY, priority: 'P3' }).every((f) =>
        rating(f, 'priority').value.includes('P3'),
      ),
    ).toBe(true);
  });
  it('gives every assessed feature an appreciation with its basis; requests are never counted as praise', () => {
    for (const f of all.filter((x) => x.assessment)) {
      expect(f.assessment!.appreciation.length, f.id).toBeGreaterThan(0);
      expect(f.assessment!.appreciationBasis.length, f.id).toBeGreaterThan(10);
      expect(rating(f, 'appreciation').source).toBe('assessment');
      if (f.assessment!.internal && f.id !== 'ens.f.local-propagation')
        expect(f.assessment!.appreciation, f.id).toBe('Indirect');
      const parent = f.assessment!.appreciationBasis.match(
        /^Parent: (.+?) \("(.+?)", rank (\d+)\)/,
      );
      if (parent)
        expect(all.find((x) => x.rank === Number(parent[3]))!.appreciation, f.id).toBe(parent[2]);
    }
    for (const f of all.filter((x) => x.rank))
      expect(rating(f, 'appreciation')).toEqual({ value: f.appreciation, source: 'paper' });
    expect(rating(view.features.get('ens.f.cross-family')!, 'appreciation').value).toBe('Unproven');
    expect(rating(view.features.get('ens.f.env-chair')!, 'appreciation').value).toBe('Unproven');
    expect(rating(view.features.get('ens.f.snap-preview')!, 'appreciation').value).toBe('High');
    const st = assessmentStats(all);
    expect(st.byAppreciation.reduce((n, r) => n + r.n, 0)).toBe(all.length);
    expect(st.byAppreciation.find((r) => r.key === 'Other')).toBeUndefined();
    expect(
      filterFeatures(view, {}, { ...EMPTY_QUERY, appreciation: 'Unproven' }).every((f) =>
        /^Unproven/.test(rating(f, 'appreciation').value),
      ),
    ).toBe(true);
    expect(
      validateAssessment({
        ...view.features.get('ens.f.snap-override')!.assessment!,
        appreciationBasis: '',
      }).join(),
    ).toMatch(/appreciation needs/);
  });
  it('rejects an assessment off the scales or without a rationale', () => {
    const a = { ...view.features.get('ens.f.snap-override')!.assessment! };
    expect(validateAssessment({ ...a, scores: { ...a.scores, ux: 6 } }).join()).toMatch(/ux/);
    expect(validateAssessment({ ...a, complexity: 'Tiny' as never }).join()).toMatch(/complexity/);
    expect(validateAssessment({ ...a, rationale: ' ' }).join()).toMatch(/rationale/);
    expect(validateAssessment({ ...a, priority: 'P5' }).join()).toMatch(/priority must/);
    expect(validateAssessment({ ...a, priorityBasis: '' }).join()).toMatch(/basis/);
    const b = clone(B);
    b.features.find((f) => f.assessment)!.assessment!.confidence = 'Sure' as never;
    expect(validateBundle(b).join()).toMatch(/assessment confidence/);
  });
  it('summarises the assessment for the dashboard and filters by it', () => {
    const st = assessmentStats(all);
    expect(st.ratedByPaper).toBe(39);
    expect(st.assessed).toBe(118);
    expect(st.unrated).toBe(0);
    expect(st.matrix.flatMap((r) => r.cells.flatMap((c) => c.ids)).length).toBe(all.length);
    for (const k of ['byDemand', 'byComplexity', 'byConfidence', 'byValue'] as const)
      expect(
        st[k].reduce((n, r) => n + r.n, 0),
        k,
      ).toBe(all.length);
    expect(st.top[0].impact).toBe('5.0');
    for (const f of st.quickWins) {
      expect(Number(rating(f, 'impact').value)).toBeGreaterThanOrEqual(4);
      expect(['Low', 'Low-medium', 'Medium']).toContain(complexityOf(f));
    }
    expect(st.quickWins.map((f) => f.id)).toContain('ens.f.snap-override');
    const cell = filterFeatures(
      view,
      {},
      { ...EMPTY_QUERY, valueBand: '4.5', complexity: 'Low' },
    ).map((f) => f.id);
    expect(cell).toEqual(
      st.matrix[0].cells[0].ids.slice().sort((a, b) => cell.indexOf(a) - cell.indexOf(b)),
    );
    expect(
      filterFeatures(view, {}, { ...EMPTY_QUERY, rated: 'paper', showMerged: true }),
    ).toHaveLength(39);
  });
  it('shows the assessment on the dashboard and on the feature, labelled as such', () => {
    const over = renderToStaticMarkup(createElement(ResearchPage, { onDone: () => {} }));
    for (const t of [
      'P0 foundational',
      'P3 experimental/later',
      'Assessment: demand, value, complexity, confidence',
      'Value (rows) × complexity (columns)',
      'Quick wins',
      'High value, weak evidence',
      'by the paper itself',
    ])
      expect(over).toContain(t);
    const det = renderToStaticMarkup(
      createElement(ResearchPage, {
        onDone: () => {},
        initialTab: 'features',
        initialDetail: 'ens.f.snap-override',
      }),
    );
    expect(det).toContain('Assessment, not research.');
    expect(det).toContain('Assessment — not from the paper');
    const paper = renderToStaticMarkup(
      createElement(ResearchPage, {
        onDone: () => {},
        initialTab: 'features',
        initialDetail: 'ens.f.guided-snapping',
      }),
    );
    expect(paper).not.toContain('Assessment, not research.');
  });
});

describe('research catalog: what the app has built, and merged duplicates (ADR-092)', () => {
  const view = buildView([storedOf(B, AT)]);
  const all = [...view.features.values()];
  it("records the app's status with evidence; In Progress always says what is missing", () => {
    const withApp = all.filter((f) => f.app);
    expect(withApp.length).toBeGreaterThan(80);
    for (const f of withApp) {
      expect(f.app!.evidence, f.id).toMatch(/\b(N\d+|F\d+|ADR-\d+)\b/);
      if (f.app!.status === 'in-progress') expect(f.app!.missing, f.id).toBeTruthy();
    }
    expect(implementationOf(view.features.get('ens.f.guided-snapping')!, {})).toBe('verified');
    expect(implementationOf(view.features.get('ens.f.semantic-connectors')!, {})).toBe(
      'in-progress',
    );
    expect(implementationOf(view.features.get('ens.f.ar-placement')!, {})).toBe('not-started');
    const b = clone(B);
    b.features.find((f) => f.app?.status === 'in-progress')!.app!.missing = '';
    expect(validateBundle(b).join()).toMatch(/In Progress must say what is missing/);
  });
  it("lets the user's own status win, including an explicit Not Started, and never changes it by itself", () => {
    const f = view.features.get('ens.f.guided-snapping')!;
    const user = { [f.id]: mark(f.id, { implementation: 'not-started', implementationSetAt: AT }) };
    expect(implementationOf(f, user)).toBe('not-started');
    expect(implementationSource(f, user)).toBe('user');
    const older = { [f.id]: mark(f.id, { implementation: 'planned' }) }; // set before ADR-092: no timestamp
    expect(implementationOf(f, older)).toBe('planned');
    const untouched = { [f.id]: mark(f.id, { implementation: 'not-started' }) }; // the default, never chosen
    expect(implementationOf(f, untouched)).toBe('verified');
    expect(implementationSource(f, untouched)).toBe('app');
  });
  it('merges only features the app has not built, into a target that is not merged itself, with a reason', () => {
    const merged = all.filter((f) => f.mergedInto);
    expect(merged.length).toBeGreaterThanOrEqual(30);
    for (const f of merged) {
      const t = view.features.get(f.mergedInto!)!;
      expect(t, f.id).toBeDefined();
      expect(t.mergedInto, `${f.id} → ${t.id} is not a chain`).toBeUndefined();
      expect(['implemented', 'verified'], `${f.id} was left to build`).not.toContain(
        implementationOf(f, {}),
      );
      expect(f.mergeReason!.length, f.id).toBeGreaterThan(10);
    }
    const b = clone(B);
    const one = b.features.find((x) => x.mergedInto)!;
    b.features.find((x) => x.id === one.mergedInto)!.mergedInto = one.id;
    expect(validateBundle(b).join()).toMatch(/itself merged/);
  });
  it('never merges into a built feature, and never calls something with a gap Verified (review 2026-10-26)', () => {
    for (const f of all.filter((x) => x.mergedInto)) {
      const t = view.features.get(f.mergedInto!)!;
      expect(
        ['implemented', 'verified'],
        `${f.id} → ${t.id} would hide work left to do`,
      ).not.toContain(t.app?.status ?? 'not-started');
    }
    for (const f of all.filter((x) => x.app && x.app.status !== 'in-progress'))
      expect(f.app!.missing, `${f.id} has a gap, so it is In Progress`).toBeUndefined();
    const b = clone(B);
    const target = b.features.find((x) => x.app?.status === 'verified')!;
    b.features.find((x) => x.mergedInto)!.mergedInto = target.id;
    expect(validateBundle(b).join()).toMatch(/which the app has built/);
    const c = clone(B);
    c.features.find((x) => x.app?.status === 'verified')!.app!.missing = 'something';
    expect(validateBundle(c).join()).toMatch(/so it is In Progress/);
  });
  it("keeps the user's status through a new edition of the paper", async () => {
    const f = 'ens.f.guided-snapping';
    const marks = { [f]: mark(f, { implementation: 'planned', implementationSetAt: AT }) };
    const v2 = clone(B);
    v2.document.version = 2;
    const after = buildView([storedOf(B, AT), storedOf(v2, AT)]);
    expect(implementationOf(after.features.get(f)!, marks)).toBe('planned');
    expect(validateMark({ ...mark(f), implementationSetAt: 42 }).join()).toMatch(
      /implementation date/,
    );
  });
  it('counts implementation statuses over the features shown, not the merged ones', () => {
    const st = stats(view, {});
    const shown = all.filter((x) => !mergedOf(x, {})).length;
    expect(Object.values(st.byImplementation).reduce((n, x) => n + x, 0)).toBe(shown);
    expect(st.byImplementation['not-started']).toBe(
      filterFeatures(view, {}, { ...EMPTY_QUERY, implementation: 'not-started' }).length,
    );
  });
  it('keeps merged features and their evidence: hidden from the list, shown on the target, undoable', () => {
    const f = view.features.get('ens.f.build-a-run')!;
    expect(mergedOf(f, {})).toBe('ens.f.auto-fit-span');
    expect(filterFeatures(view, {}, EMPTY_QUERY).map((x) => x.id)).not.toContain(f.id);
    expect(
      filterFeatures(view, {}, { ...EMPTY_QUERY, showMerged: true }).map((x) => x.id),
    ).toContain(f.id);
    expect(mergedOf(f, { [f.id]: mark(f.id, { mergedInto: UNMERGED }) })).toBeUndefined();
    const html = renderToStaticMarkup(
      createElement(ResearchPage, {
        onDone: () => {},
        initialTab: 'features',
        initialDetail: 'ens.f.auto-fit-span',
      }),
    );
    expect(html).toContain('Merged into this');
    expect(html).toContain('&quot;Build a run&quot; workflow');
  });
  it('filters to what is left to build and summarises it on the Overview', () => {
    const left = filterFeatures(view, {}, { ...EMPTY_QUERY, left: true });
    expect(left.length).toBeGreaterThan(0);
    for (const f of left)
      expect(['implemented', 'verified']).not.toContain(implementationOf(f, {}));
    const over = renderToStaticMarkup(createElement(ResearchPage, { onDone: () => {} }));
    expect(over).toContain('Built in this app');
    expect(over).toMatch(/Left to build \(\d+\)/);
    const det = renderToStaticMarkup(
      createElement(ResearchPage, {
        onDone: () => {},
        initialTab: 'features',
        initialDetail: 'ens.f.cad-cnc-export',
      }),
    );
    expect(det).toContain('This app: <span class="chip impl-in-progress">In Progress</span>');
    expect(det).toContain('DXF, STEP and CNC output');
  });
});
