import { describe, expect, it } from 'vitest';
import { buildModel } from '../src/core/build';
import { splitSpace, templates, upgradeDesign, validateDesign } from '../src/core/design';
import {
  DEFAULT_STAGGER_WIDTHS,
  dividerPositions,
  refreshStagger,
  rowSpans,
  staggerRows,
} from '../src/core/stagger';
import type { Design, Space } from '../src/core/types';

/** An open cabinet whose interior is a staggered stacked split of `rows` rows (ADR-282). */
function staggered(width: number, rows = 3, seed = 7, kept?: number[]): Design {
  const d = templates.find((t) => t.id === 'chest')!.create();
  if (d.product.kind !== 'cabinet') throw Error('not cabinet');
  const split = splitSpace({ id: 'root', kind: 'empty' }, 'y', rows);
  if (split.kind !== 'split') throw Error('not split');
  const interior: Space = {
    ...split,
    stagger: { widths: [...DEFAULT_STAGGER_WIDTHS], seed, ...(kept ? { kept } : {}) },
  };
  const raw: Design = {
    ...d,
    product: { ...d.product, params: { ...d.product.params, width, interior } },
  };
  return refreshStagger(raw, buildModel(raw));
}
const rows = (d: Design) => {
  if (d.product.kind !== 'cabinet' || d.product.params.interior.kind !== 'split') throw Error();
  return d.product.params.interior.children;
};
const inner = (d: Design) => buildModel(d).spaces.find((s) => s.nodeId === 'root')!.box.w;

describe('staggered rows (ADR-282)', () => {
  it('every row fills the inside exactly with the 3 widths plus one span between them', () => {
    for (const width of [600, 800, 1000, 1200, 1600]) {
      const d = staggered(width);
      const w = inner(d);
      for (const r of rows(d)) {
        const spans = rowSpans(r, w)!;
        expect(spans.reduce((a, v) => a + v, 0) + (spans.length - 1) * 18).toBe(w);
        const odd = spans.filter((v) => !DEFAULT_STAGGER_WIDTHS.includes(v));
        expect(odd.length).toBeLessThanOrEqual(1);
        for (const v of odd) expect(v >= 200 && v <= 360).toBe(true);
      }
      expect(buildModel(d).diagnostics.filter((x) => x.code.startsWith('stagger'))).toEqual([]);
    }
  });
  it('neighbouring rows do not line up', () => {
    const d = staggered(1200, 5);
    const w = inner(d);
    const pos = rows(d).map((r) => dividerPositions(rowSpans(r, w)!, 18));
    for (let i = 1; i < pos.length; i++)
      for (const a of pos[i])
        for (const b of pos[i - 1]) expect(Math.abs(a - b)).toBeGreaterThanOrEqual(18);
  });
  it('the same seed gives the same rows; another seed may differ; a second refresh changes nothing', () => {
    const a = staggered(1200, 4, 11);
    const sizes = (d: Design) => rows(d).map((r) => rowSpans(r, inner(d)));
    expect(sizes(staggered(1200, 4, 11))).toEqual(sizes(a));
    expect(refreshStagger(a, buildModel(a))).toBe(a);
    const seeds = new Set([1, 2, 3, 4, 5].map((s) => JSON.stringify(sizes(staggered(1200, 4, s)))));
    expect(seeds.size).toBeGreaterThan(1);
  });
  it('a kept row stays as set by hand when the width changes', () => {
    const d = staggered(1200, 3, 5, [1]);
    const before = rows(d)[1];
    if (d.product.kind !== 'cabinet') throw Error();
    const wider: Design = {
      ...d,
      product: { ...d.product, params: { ...d.product.params, width: 1400 } },
    };
    const after = refreshStagger(wider, buildModel(wider));
    expect(rows(after)[1]).toBe(before);
    expect(rows(after)[0]).not.toBe(rows(d)[0]);
  });
  it('a row the widths cannot fill is an error, never a stretched span', () => {
    // 150 mm inside: smaller than the smallest width.
    expect(staggerRows({ widths: [200, 280, 360], seed: 1 }, 150, 18, [null])[0].spans).toBeNull();
    const d = staggered(1000);
    if (d.product.kind !== 'cabinet' || d.product.params.interior.kind !== 'split') throw Error();
    const broken: Design = {
      ...d,
      product: {
        ...d.product,
        params: {
          ...d.product.params,
          interior: {
            ...d.product.params.interior,
            children: [{ id: 'r', kind: 'empty' }, ...rows(d).slice(1)],
          },
        },
      },
    };
    expect(buildModel(broken).diagnostics.map((x) => x.code)).toContain('stagger-fill');
  });
  it('validation: schemaVersion 10 needed, shape checked; version 9 designs still load', () => {
    const d = staggered(800);
    expect(validateDesign(d)).toEqual([]);
    expect(validateDesign({ ...d, schemaVersion: 9 })).toContain(
      'Staggered rows need schemaVersion 10',
    );
    if (d.product.kind !== 'cabinet' || d.product.params.interior.kind !== 'split') throw Error();
    const bad = {
      ...d,
      product: {
        ...d.product,
        params: {
          ...d.product.params,
          interior: { ...d.product.params.interior, stagger: { widths: [200, 280], seed: 1 } },
        },
      },
    };
    expect(validateDesign(bad)).toContain('Invalid staggered rows');
    const old = templates[0].create();
    expect(validateDesign(upgradeDesign({ ...old, schemaVersion: 9 }))).toEqual([]);
  });
});
