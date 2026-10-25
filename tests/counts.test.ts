import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { buildModel } from '../src/core/build';
import { countRows, stepCount, type CountKey } from '../src/core/counts';
import { findInProduct, templates } from '../src/core/design';
import type { Design, Space } from '../src/core/types';
import { useDesign } from '../src/store/designStore';

const byTemplate = (id: string) => templates.find((t) => t.id === id)!.create();
const interior = (d: Design): Space => {
  if (d.product.kind !== 'cabinet') throw Error('not cabinet');
  return d.product.params.interior;
};
const rowsOf = (d: Design, id: string) =>
  Object.fromEntries(countRows(d.product, id).map((r) => [r.key, r]));
const st = () => useDesign.getState();
const value = (key: CountKey) =>
  countRows(st().design.product, st().selectedId!).find((r) => r.key === key)?.value;

describe('quick count rows (ADR-083)', () => {
  it('a drawer space shows both divider rows at 0 and its drawers', () => {
    const d = byTemplate('chest');
    const r = rowsOf(d, interior(d).id);
    expect(Object.keys(r)).toEqual(['vdiv', 'hdiv', 'drawers']);
    expect([r.vdiv.value, r.hdiv.value, r.drawers.value]).toEqual([0, 0, 4]);
    expect([r.drawers.min, r.drawers.max]).toEqual([1, 10]);
  });
  it('a shelf space behind a door shows shelves and doors; sliding doors show their own row', () => {
    const d = byTemplate('base-door');
    const s = interior(d);
    expect(Object.keys(rowsOf(d, s.id))).toEqual(['vdiv', 'hdiv', 'shelves', 'doors']);
    const sliding = { ...s, front: { kind: 'sliding', count: 2 } } as Space;
    expect(stepCount(sliding, 'sliding', 1).front).toMatchObject({ count: 3 });
    expect(stepCount(sliding, 'sliding', -1)).toBe(sliding);
  });
  it('a bay of a side-by-side split counts its parent’s vertical dividers', () => {
    const d = byTemplate('sideboard');
    const split = interior(d);
    if (split.kind !== 'split') throw Error();
    const bay = rowsOf(d, split.children[1].id);
    expect(bay.vdiv).toMatchObject({ value: 2, target: split.id });
    expect(bay.hdiv).toMatchObject({ value: 0, target: split.children[1].id });
    expect(rowsOf(d, split.id).vdiv).toMatchObject({ value: 2, target: split.id });
  });
  it('an id that is not a space gives no rows', () => {
    const d = byTemplate('chest');
    expect(countRows(d.product, 'nope')).toEqual([]);
    expect(countRows(byTemplate('panels').product, 'x')).toEqual([]);
  });
});

describe('stepping counts (ADR-083)', () => {
  it('shelves, drawers and doors step both ways and stop at their bounds', () => {
    const shelves: Space = { id: 's', kind: 'shelves', count: 0 };
    expect(stepCount(shelves, 'shelves', -1)).toBe(shelves);
    expect(stepCount(shelves, 'shelves', 1)).toMatchObject({ count: 1 });
    expect(stepCount({ ...shelves, count: 12 }, 'shelves', 1)).toMatchObject({ count: 12 });
    const drawers: Space = {
      id: 'd',
      kind: 'drawers',
      count: 1,
      heights: [{ mode: 'mm', value: 200 }],
    };
    expect(stepCount(drawers, 'drawers', -1)).toBe(drawers);
    expect(stepCount(drawers, 'drawers', 1)).toMatchObject({
      count: 2,
      heights: [
        { mode: 'mm', value: 200 },
        { mode: 'fr', value: 1 },
      ],
    });
    const door: Space = { ...shelves, front: { kind: 'doors', count: 1 } };
    expect(stepCount(door, 'doors', 1).front).toMatchObject({ count: 2 });
    expect(stepCount(door, 'doors', -1)).toBe(door);
  });
  it('+ on a leaf divides it; + on a split adds a bay with 2 shelves at the end', () => {
    const leaf: Space = { id: 'a', kind: 'drawers', count: 3 };
    const one = stepCount(leaf, 'hdiv', 1);
    expect(one).toMatchObject({ id: 'a', kind: 'split', axis: 'y' });
    if (one.kind !== 'split') throw Error();
    expect(one.children[0]).toMatchObject({ kind: 'drawers', count: 3 });
    const two = stepCount(one, 'hdiv', 1);
    if (two.kind !== 'split') throw Error();
    expect(two.children).toHaveLength(3);
    expect(two.children[2]).toMatchObject({ kind: 'shelves', count: 2 });
    expect(two.sizes).toHaveLength(3);
  });
  it('− removes the last bay and its size; from one divider the first bay’s contents stay', () => {
    const d = byTemplate('sideboard');
    const split = interior(d);
    if (split.kind !== 'split') throw Error();
    const fewer = stepCount(split, 'vdiv', -1);
    if (fewer.kind !== 'split') throw Error();
    expect(fewer.children.map((c) => c.id)).toEqual(split.children.slice(0, 2).map((c) => c.id));
    expect(fewer.sizes).toEqual(split.sizes.slice(0, 2));
    const none = stepCount(fewer, 'vdiv', -1);
    expect(none).toMatchObject({ id: split.id, kind: 'shelves', count: 1 });
    expect(none.front).toMatchObject({ kind: 'doors', count: 1 });
    expect(stepCount(none, 'vdiv', -1)).toBe(none);
  });
  it('more drawers than fit give the existing error diagnostic, not a clamp', () => {
    const d = byTemplate('chest');
    const id = interior(d).id;
    useDesign.getState().load({
      ...d,
      product: {
        ...d.product,
        params: { ...(d.product.params as object), height: 600 },
      } as Design['product'],
    });
    useDesign.getState().select(id);
    expect(buildModel(st().design).diagnostics.some((x) => x.severity === 'error')).toBe(false);
    for (let i = 0; i < 6; i++) useDesign.getState().stepCount('drawers', 1);
    expect(value('drawers')).toBe(10);
    expect(buildModel(st().design).diagnostics.some((x) => x.severity === 'error')).toBe(true);
  });
});

describe('quick counts in the store (ADR-083)', () => {
  it('each press is one undo step', () => {
    const d = byTemplate('chest');
    st().load(d);
    st().select(interior(d).id);
    st().stepCount('drawers', 1);
    st().stepCount('drawers', 1);
    expect(value('drawers')).toBe(6);
    st().undo();
    expect(value('drawers')).toBe(5);
    st().undo();
    expect(value('drawers')).toBe(4);
  });
  it('removing the selected bay selects the space that held it', () => {
    const d = byTemplate('sideboard');
    const split = interior(d);
    if (split.kind !== 'split') throw Error();
    st().load(d);
    st().select(split.children[2].id);
    st().stepCount('vdiv', -1);
    expect(st().selectedId).toBe(split.id);
    expect(findInProduct(st().design.product, split.id)?.space.kind).toBe('split');
  });
});
