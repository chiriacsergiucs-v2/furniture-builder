// G-484 (ADR-216): a template description states the size of the piece its Start from row builds.
import { describe, expect, it } from 'vitest';
import { templates, withPieceSize } from '../src/core/design';
import { catalogFamilies } from '../src/core/catalog';
import { data_catalog } from '../src/core/i18n/ru/data-catalog';

const piece = (id: string) => {
  for (const f of catalogFamilies)
    for (const v of f.variants) if (v.id === id && v.create) return v.create();
  throw new Error(id);
};
const text = (id: string) => templates.find((t) => t.id === id)!.description;

describe('withPieceSize (G-484)', () => {
  it('states the height and the order the row builds', () => {
    expect(withPieceSize(text('base-door'), piece('base-door'))).toBe(
      '600 × 820 × 560, one shelf behind a door',
    );
    expect(withPieceSize(text('desk-pedestal'), piece('desk-pedestal'))).toBe(
      '1400 × 750 × 700, three-drawer pedestal left',
    );
    expect(withPieceSize(text('corner-blind'), piece('corner-blind'))).toMatch(
      /^1000 × 820 × 560, 610 mm/,
    );
    expect(withPieceSize(text('chest'), piece('chest'))).toBe(text('chest'));
  });
  it('works on the Russian text and leaves text without a leading size alone', () => {
    const ru = data_catalog[text('base-door')];
    expect(withPieceSize(ru, piece('base-door'))).toBe('600 × 820 × 560, одна полка за дверцей');
    expect(withPieceSize(text('panels'), piece('panels'))).toBe(text('panels'));
  });
});
