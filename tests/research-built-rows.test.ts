// ADR-184: the research data lists only what is left to build — built rows are deleted (ADR-149, ADR-152).
import { describe, expect, it } from 'vitest';
import { validateBundle } from '../src/core/research/catalog';
import { ENSEMBLE_BUNDLE } from '../src/core/research/ensemble-2026-10-23';
import { ENSEMBLE_APP_STATUS, ENSEMBLE_MERGES } from '../src/core/research/ensemble-2026-10-23.app';
import {
  ENSEMBLE_APPRECIATION,
  ENSEMBLE_ASSESSMENTS,
  ENSEMBLE_PRIORITIES,
} from '../src/core/research/ensemble-2026-10-23.assessment';
import { SHIPPED_RESEARCH } from '../src/core/research';

/** The 9 Verified features of ADR-184 and the 3 features merged into them. */
const DELETED = [
  'transactional-undo',
  'assembly-sequence',
  'ensemble-templates',
  'live-price',
  'independent-selection',
  'direct-manipulation',
  'versioned-save',
  'deterministic-alternatives',
  'locks-overrides',
  'transform-gizmos',
  'budget-style-filters',
  'layout-optimisation',
];

describe('research data without built rows (ADR-184)', () => {
  it('no shipped feature is Verified or Implemented', () => {
    for (const b of SHIPPED_RESEARCH)
      expect(
        b.features
          .filter((f) => f.app?.status === 'verified' || f.app?.status === 'implemented')
          .map((f) => f.id),
      ).toEqual([]);
    for (const [slug, [status]] of Object.entries(ENSEMBLE_APP_STATUS))
      expect([slug, status]).toEqual([slug, 'in-progress']);
  });

  it('the deleted features leave no row, status, merge, assessment or link behind', () => {
    const ids = new Set(DELETED.map((s) => `ens.f.${s}`));
    const b = ENSEMBLE_BUNDLE;
    expect(b.features.filter((f) => ids.has(f.id)).map((f) => f.id)).toEqual([]);
    for (const s of DELETED) {
      expect(ENSEMBLE_APP_STATUS[s]).toBeUndefined();
      expect(ENSEMBLE_MERGES[s]).toBeUndefined();
      expect(ENSEMBLE_ASSESSMENTS[s]).toBeUndefined();
      expect(ENSEMBLE_PRIORITIES[s]).toBeUndefined();
      expect(ENSEMBLE_APPRECIATION[s]).toBeUndefined();
    }
    const links = b.features.flatMap((f) => [
      f.parent ?? '',
      f.mergedInto ?? '',
      ...f.related,
      ...f.dependencies,
    ]);
    expect(links.filter((l) => ids.has(l))).toEqual([]);
    expect(b.contradictions.flatMap((c) => c.features ?? []).filter((f) => ids.has(f))).toEqual([]);
    expect(b.contradictions.every((c) => (c.features ?? []).length > 0)).toBe(true);
  });

  it('In Progress rows stay with what is missing, and the bundle validates', () => {
    const inProgress = ENSEMBLE_BUNDLE.features.filter((f) => f.app?.status === 'in-progress');
    expect(inProgress.length).toBe(10);
    expect(inProgress.every((f) => !!f.app?.missing?.trim())).toBe(true);
    expect(validateBundle(ENSEMBLE_BUNDLE)).toEqual([]);
  });
});
