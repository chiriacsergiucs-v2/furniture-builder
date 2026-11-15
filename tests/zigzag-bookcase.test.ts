import { describe, expect, it } from 'vitest';
import { buildModel } from '../src/core/build';
import { findFamily, insertVariant } from '../src/core/catalog';
import { cutlist } from '../src/core/cutlist';

describe('zigzag bookcase template', () => {
  const family = findFamily('zigzag-bookcase')!;
  const design = () => insertVariant(family, family.variants[0]!)!;
  const model = () => buildModel(design());

  it('builds 19 placed parts of 16 mm board with no error', () => {
    const m = model();
    expect(m.diagnostics.filter((d) => d.severity === 'error')).toEqual([]);
    expect(m.diagnostics.map((d) => d.code)).not.toContain('not-assembled');
    expect(m.panels).toHaveLength(6 + 3 * 3 + 2 * 2);
    for (const p of m.panels) expect(p.materialId).toBe('pal16');
  });

  it('is 600 wide, 1696 high and 240 deep, with no two parts overlapping', () => {
    const { panels } = model();
    const maxOf = (f: (b: (typeof panels)[number]['box']) => number) =>
      Math.max(...panels.map((p) => f(p.box)));
    expect(maxOf((b) => b.x + b.w)).toBe(600);
    expect(maxOf((b) => b.y + b.h)).toBe(1696);
    expect(maxOf((b) => b.z + b.d)).toBe(240);
    for (let i = 0; i < panels.length; i++)
      for (let j = i + 1; j < panels.length; j++) {
        const a = panels[i]!.box,
          b = panels[j]!.box;
        const overlap =
          a.x < b.x + b.w &&
          b.x < a.x + a.w &&
          a.y < b.y + b.h &&
          b.y < a.y + a.h &&
          a.z < b.z + b.d &&
          b.z < a.z + a.d;
        expect(overlap, `${panels[i]!.label} / ${panels[j]!.label}`).toBe(false);
      }
  });

  it('lists the parts in the cut list', () => {
    const rows = cutlist(model(), design().materials);
    expect(rows.reduce((n, r) => n + r.quantity, 0)).toBe(19);
  });
});
