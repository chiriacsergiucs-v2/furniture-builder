import { describe, expect, it } from 'vitest';
import { hasRu } from '../src/core/i18n';
import { CONSTRUCTION_TYPES } from '../src/core/wizard/registry';
import { STEPS } from '../src/core/wizard/steps';

/** Every text the wizard data shows: step titles and hints, field labels and hints, options, types (ADR-155). */
function wizardTexts(): string[] {
  const out: string[] = [];
  const add = (s: string | undefined) => {
    if (s) out.push(s);
  };
  for (const s of STEPS) {
    add(s.title);
    add(s.help);
    for (const f of s.fields) {
      add(f.label);
      add(f.help);
      for (const o of f.options ?? []) {
        add(o.label);
        add(o.help);
      }
    }
  }
  for (const t of CONSTRUCTION_TYPES) {
    add(t.label);
    add(t.description);
    for (const l of Object.values(t.labels ?? {})) add(l);
  }
  return [...new Set(out)];
}

describe('wizard data in Russian (ADR-155)', () => {
  it('has a Russian entry for every text the wizard data shows', () => {
    const texts = wizardTexts();
    expect(texts.length).toBeGreaterThan(50);
    expect(texts.filter((x) => !hasRu(x))).toEqual([]);
  });
});
