import { describe, expect, it } from 'vitest';
import { hasRu } from '../src/core/i18n';
import {
  ENSEMBLE_BIBLIOGRAPHY,
  ENSEMBLE_BUNDLE,
  ENSEMBLE_CATEGORIES,
  ENSEMBLE_COMPETITORS,
  ENSEMBLE_FINDINGS,
  ENSEMBLE_SECTIONS,
  MVP_ROWS,
  RANKED_ROWS,
  RECOMMENDATION_ROWS,
} from '../src/core/research/ensemble-2026-10-23';

/**
 * Every user-visible text of the paper's own record (ADR-155). Not translated: ids, URLs, dates, product names
 * and the titles of the cited sources.
 */
function ensembleTexts(): string[] {
  const out: string[] = [];
  const add = (...xs: (string | undefined)[]) => {
    for (const x of xs) if (x) out.push(x);
  };
  add(ENSEMBLE_BUNDLE.document.title, ENSEMBLE_BUNDLE.document.question);
  for (const c of ENSEMBLE_CATEGORIES) add(c.label);
  for (const s of ENSEMBLE_SECTIONS) add(s.title);
  for (const rows of [RANKED_ROWS, RECOMMENDATION_ROWS, MVP_ROWS]) for (const [, n] of rows) add(n);
  for (const f of ENSEMBLE_FINDINGS) add(f.statement, f.quality);
  for (const c of ENSEMBLE_COMPETITORS)
    add(c.group, c.behaviour, c.signal, c.commercial, c.confidence);
  for (const b of ENSEMBLE_BIBLIOGRAPHY) add(b.group, b.note);
  return [...new Set(out)];
}

describe('ensemble-2026-10-23.ts', () => {
  it('has a Russian entry for every text of the paper record', () => {
    const texts = ensembleTexts();
    expect(texts.length).toBeGreaterThan(400);
    expect(texts.filter((s) => !hasRu(s))).toEqual([]);
  });
});
