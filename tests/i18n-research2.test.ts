import { describe, expect, it } from 'vitest';
import { hasRu } from '../src/core/i18n';
import { APPRECIATION_KEYS, DEMAND_SCALE, VALUE_BANDS } from '../src/core/research/catalog';
import { ENSEMBLE_APP_STATUS, ENSEMBLE_MERGES } from '../src/core/research/ensemble-2026-10-23.app';
import {
  ASSESSOR,
  ENSEMBLE_APPRECIATION,
  ENSEMBLE_ASSESSMENTS,
  ENSEMBLE_PRIORITIES,
} from '../src/core/research/ensemble-2026-10-23.assessment';
import {
  ENSEMBLE_CONTRADICTIONS,
  ENSEMBLE_FEATURES,
} from '../src/core/research/ensemble-2026-10-23.features';
import {
  ASSESSMENT_CRITERIA,
  COMPLEXITY_SCALE,
  CONFIDENCE_SCALE,
  FINDING_KIND_LABEL,
  IMPLEMENTATION_LABEL,
  SELECTION_LABEL,
} from '../src/core/research/types';

/** Text that is a code, not words: priorities (P0, P1/P2), ids, numbers. */
const isCode = (s: string) => !/[a-z]{2}/i.test(s) || /^P[0-3]([/ –-]P?[0-3])*$/.test(s);

/** Every user-visible text of the research files other than the paper's own record (ADR-155). */
export function researchTexts(): string[] {
  const out: string[] = [];
  const add = (...xs: (string | undefined)[]) => {
    for (const x of xs) if (x && !isCode(x)) out.push(x);
  };
  add(...Object.values(FINDING_KIND_LABEL), ...Object.values(SELECTION_LABEL));
  add(...Object.values(IMPLEMENTATION_LABEL), ...COMPLEXITY_SCALE, ...CONFIDENCE_SCALE);
  add(...ASSESSMENT_CRITERIA.map(([, label]) => label));
  add(...DEMAND_SCALE, ...APPRECIATION_KEYS, ...VALUE_BANDS.map(([, label]) => label));
  add('All features', 'Research priority: not evaluated', 'Other', 'Indirect / emerging');
  add('not evaluated', 'unknown', 'Not a research file.', 'Decision without an id.');
  add('Document needs id, title, date and a whole version ≥ 1.', ASSESSOR);
  for (const f of ENSEMBLE_FEATURES) {
    add(f.name, f.description, f.subcategory, f.userProblem, f.userBenefit);
    add(...f.useCases, ...f.workflow, ...f.requirements, ...f.technical, ...(f.appNotes ?? []));
    add(f.demand, f.appreciation, f.adoption, f.impact, f.complexity, f.confidence, f.priority);
    add(f.mvp, f.phase, f.mergeReason, f.app?.evidence, f.app?.missing);
    const a = f.assessment;
    if (a) add(a.complexity, a.confidence, a.priority, a.priorityBasis, a.appreciation);
    if (a) add(a.appreciationBasis, a.rationale, a.by);
  }
  for (const c of ENSEMBLE_CONTRADICTIONS) add(c.title, c.description);
  for (const r of Object.values(ENSEMBLE_ASSESSMENTS)) add(r[6], r[7], r[8]);
  for (const [p, basis] of Object.values(ENSEMBLE_PRIORITIES)) add(p, basis);
  for (const [w, basis] of Object.values(ENSEMBLE_APPRECIATION)) add(w, basis);
  for (const [, evidence, missing] of Object.values(ENSEMBLE_APP_STATUS)) add(evidence, missing);
  for (const [, reason] of Object.values(ENSEMBLE_MERGES)) add(reason);
  return [...new Set(out)];
}

describe('Russian text for the research catalog data (ADR-155)', () => {
  it('has a Russian entry for every text of the research files', () => {
    const missing = researchTexts().filter((s) => !hasRu(s));
    expect(missing).toEqual([]);
  });
});
