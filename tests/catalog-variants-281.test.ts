import { describe, expect, it } from 'vitest';
import { buildModel } from '../src/core/build';
import { catalogFamilies, insertable, setSafetyConfirmed } from '../src/core/catalog';
import { VARIANT_RO } from '../src/core/catalog/ro';

/** ADR-281: six new variants in each of six families, each a different design, none with an error diagnostic. */
const GROWN = {
  'base-doors': 11,
  'base-drawers': 11,
  'wall-cabinet': 11,
  'tall-cabinet': 11,
  wardrobe: 11,
  'media-console': 10,
} as const;

describe('variants added by ADR-281', () => {
  setSafetyConfirmed(true);
  for (const [id, count] of Object.entries(GROWN)) {
    const f = catalogFamilies.find((x) => x.id === id)!;
    it(`${id}: ${count} variants, each with a Romanian name`, () => {
      expect(f.variants).toHaveLength(count);
      for (const v of f.variants) expect(VARIANT_RO[v.id], v.id).toBeTruthy();
    });
    it(`${id}: every variant builds without an error and no two cut lists are the same`, () => {
      const seen = new Map<string, string>();
      for (const v of f.variants.filter(insertable)) {
        const m = buildModel(v.create!());
        expect(
          m.diagnostics.filter((d) => d.severity === 'error').map((d) => d.code),
          v.id,
        ).toEqual([]);
        const sig = m.panels
          .map((p) => `${p.role}:${p.box.w}x${p.box.h}x${p.box.d}`)
          .sort()
          .join('|');
        expect(seen.get(sig), `${v.id} repeats ${seen.get(sig)}`).toBeUndefined();
        seen.set(sig, v.id);
      }
    });
  }
});
