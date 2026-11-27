import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { buildModel } from '../src/core/build';
import { splitSpace, templates } from '../src/core/design';
import { groupSizeFields } from '../src/core/groupSize';
import { makeItem, newProject, resolvePlacements, type Project } from '../src/core/project';
import { groupItems } from '../src/core/selection';
import { DEFAULT_STAGGER_WIDTHS, refreshStagger, rowSpans } from '../src/core/stagger';
import type { Design, Space } from '../src/core/types';
import { useDesign } from '../src/store/designStore';

const st = () => useDesign.getState();

/** An open chest whose interior is a staggered stacked split of 3 rows (ADR-282). */
function staggered(width: number): Design {
  const d = templates.find((t) => t.id === 'chest')!.create();
  if (d.product.kind !== 'cabinet') throw Error('not cabinet');
  const split = splitSpace({ id: 'root', kind: 'empty' }, 'y', 3);
  if (split.kind !== 'split') throw Error('not split');
  const interior: Space = { ...split, stagger: { widths: [...DEFAULT_STAGGER_WIDTHS], seed: 7 } };
  const raw: Design = {
    ...d,
    product: { ...d.product, params: { ...d.product.params, width, interior } },
  };
  return refreshStagger(raw, buildModel(raw));
}
const staggerCodes = (d: Design) =>
  buildModel(d)
    .diagnostics.map((x) => x.code)
    .filter((c) => c.startsWith('stagger'));
const rowSums = (d: Design) => {
  if (d.product.kind !== 'cabinet' || d.product.params.interior.kind !== 'split') throw Error();
  const w = buildModel(d).spaces.find((s) => s.nodeId === 'root')!.box.w;
  return d.product.params.interior.children.map((r) => {
    const spans = rowSpans(r, w)!;
    return spans.reduce((a, v) => a + v, 0) + (spans.length - 1) * 18 - w;
  });
};

describe('staggered rows follow project-level resizes (G-576)', () => {
  it('a group width change rewrites the rows; no stagger-fill error', () => {
    let p: Project = newProject('Stagger');
    p = { ...p, items: [makeItem(p, staggered(1200))] };
    p = { ...p, items: [...p.items, makeItem(p, staggered(1200))] };
    p = resolvePlacements(p);
    p = groupItems(
      p,
      p.items.map((i) => i.id),
    ).project;
    expect(staggerCodes(p.items[0].design)).toEqual([]);
    st().openProject(p);
    const g = st().project!.groups![0];
    const w = groupSizeFields(p, st().project!.groups![0].itemIds)[0];
    expect(w.key).toBe('width');
    expect(st().resizeGroup(g.id, 'width', w.value + 400, 'equal')).toBe('');
    for (const it of st().project!.items) {
      if (it.design.product.kind !== 'cabinet') throw Error();
      expect(it.design.product.params.width).toBe(1400);
      expect(staggerCodes(it.design)).toEqual([]);
      expect(rowSums(it.design)).toEqual([0, 0, 0]);
    }
  });
  it('a project variable bound to the width rewrites the rows; no stagger-fill error', () => {
    let p: Project = newProject('Stagger');
    p = resolvePlacements({ ...p, items: [makeItem(p, staggered(1200))] });
    st().openProject(p);
    const id = st().project!.items[0].id;
    const vid = st().addVariable('run width', '1200');
    st().bindTarget(id, 'width', 'run width');
    st().updateVariable(vid, { expr: '1000' });
    const d = st().project!.items[0].design;
    if (d.product.kind !== 'cabinet') throw Error();
    expect(d.product.params.width).toBe(1000);
    expect(staggerCodes(d)).toEqual([]);
    expect(rowSums(d)).toEqual([0, 0, 0]);
  });
});
