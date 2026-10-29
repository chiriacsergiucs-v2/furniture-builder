import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { templates } from '../src/core/design';
import { carryGroups, withGroups } from '../src/core/groupMove';
import { groupSizeFields, resizeGroup } from '../src/core/groupSize';
import { setWallHeight } from '../src/core/height';
import {
  makeItem,
  newProject,
  placedBounds,
  resolvePlacements,
  setLocked,
  type Project,
} from '../src/core/project';
import { groupItems } from '../src/core/selection';
import { setSizeLocked } from '../src/core/sizeLock';
import { useDesign } from '../src/store/designStore';

const t = (id: string) => templates.find((x) => x.id === id)!.create();
const st = () => useDesign.getState();
/** Pieces side by side from the left, all in one group. */
function grouped(ids: string[]): Project {
  let p = newProject('Groups');
  for (const id of ids) p = { ...p, items: [...p.items, makeItem(p, t(id))] };
  p = resolvePlacements(p);
  return groupItems(
    p,
    p.items.map((i) => i.id),
  ).project;
}
const boxes = (p: Project) => resolvePlacements(p).items.map(placedBounds);
const ids = (p: Project) => p.items.map((i) => i.id);
const param = (p: Project, i: number, k: string) =>
  (p.items[i].design.product.params as unknown as Record<string, number>)[k];
/** Each piece touches the next one. */
const touching = (p: Project) =>
  boxes(p).every((b, i, all) => i === 0 || all[i - 1].x + all[i - 1].w === b.x);

describe('group width (ADR-148)', () => {
  it('Equally: the same for each column, leftover mm to the leftmost; pieces stay touching', () => {
    const p = grouped(['base-door', 'base-door', 'base-door']);
    const w = groupSizeFields(p, ids(p))[0];
    expect(w.key).toBe('width');
    const res = resizeGroup(p, ids(p), 'width', w.value + 302, 'equal');
    expect(res.reason).toBeUndefined();
    const grow = [0, 1, 2].map((i) => param(res.project, i, 'width') - param(p, i, 'width'));
    expect(grow).toEqual([101, 101, 100]);
    expect(touching(res.project)).toBe(true);
    expect(groupSizeFields(res.project, ids(p))[0].value).toBe(w.value + 302);
    expect(boxes(res.project)[0].x).toBe(boxes(p)[0].x);
  });
  it('Proportionally: by each column width; a gap between pieces stays', () => {
    let p = grouped(['base-door', 'chest']);
    // A 50 mm gap before the second piece.
    p = {
      ...p,
      items: p.items.map((it, i) =>
        i ? { ...it, position: { ...it.position, x: it.position.x + 50 } } : it,
      ),
    };
    const [a, b] = boxes(p);
    const res = resizeGroup(p, ids(p), 'width', b.x + b.w - a.x + 100, 'proportional');
    const grow = [0, 1].map((i) => param(res.project, i, 'width') - param(p, i, 'width'));
    expect(grow[0] + grow[1]).toBe(100);
    expect(Math.abs(grow[0] - Math.trunc((100 * a.w) / (a.w + b.w)))).toBeLessThanOrEqual(1);
    const [a2, b2] = boxes(res.project);
    expect(b2.x - (a2.x + a2.w)).toBe(50);
  });
  it('a wall unit over its base unit is one column and keeps resting on it', () => {
    let p = newProject('Stack');
    const base = makeItem(p, t('base-door'));
    p = { ...p, items: [base] };
    const top = makeItem(p, t('wall-cabinet'));
    p = resolvePlacements({
      ...p,
      items: [base, { ...top, placement: { kind: 'above', baseId: base.id, gap: 0, offsetX: 0 } }],
    });
    // Same width for both, so they share a column.
    const w0 = boxes(p)[0].w;
    p = {
      ...p,
      items: p.items.map((it) => ({
        ...it,
        design: {
          ...it.design,
          product: {
            ...it.design.product,
            params: { ...it.design.product.params, width: w0 },
          } as typeof it.design.product,
        },
      })),
    };
    p = groupItems(p, ids(p)).project;
    const res = resizeGroup(p, ids(p), 'width', w0 + 100, 'equal');
    expect(res.reason).toBeUndefined();
    const [b, w] = boxes(res.project);
    expect([b.w, w.w, w.x]).toEqual([w0 + 100, w0 + 100, b.x]);
  });
  it('pieces not in columns are refused with the reason', () => {
    let p = grouped(['base-door', 'base-door']);
    p = {
      ...p,
      items: p.items.map((it, i) =>
        i ? { ...it, position: { ...it.position, x: it.position.x - 100 } } : it,
      ),
    };
    const res = resizeGroup(p, ids(p), 'width', 2000, 'equal');
    expect(res.project).toBe(p);
    expect(res.reason).toMatch(/Width needs the pieces side by side in columns/);
  });
  it('a size-locked piece keeps its width and is named; the others take the change', () => {
    let p = grouped(['base-door', 'chest']);
    p = setSizeLocked(p, p.items[1].id, true);
    const w = groupSizeFields(p, ids(p))[0].value;
    const res = resizeGroup(p, ids(p), 'width', w + 80, 'equal');
    expect(param(res.project, 1, 'width')).toBe(param(p, 1, 'width'));
    expect(param(res.project, 0, 'width')).toBe(param(p, 0, 'width') + 80);
    expect(res.kept).toEqual([p.items[1].design.name]);
    expect(touching(res.project)).toBe(true);
  });
  it('refuses outside the Settings limits, when no piece can change, and when a locked piece must shift', () => {
    let p = grouped(['base-door', 'base-door']);
    expect(resizeGroup(p, ids(p), 'width', 99999, 'equal').reason).toMatch(/takes 100–4000 mm/);
    const both = setSizeLocked(setSizeLocked(p, p.items[0].id, true), p.items[1].id, true);
    expect(resizeGroup(both, ids(p), 'width', 2000, 'equal').reason).toMatch(
      /No piece in the group/,
    );
    p = setLocked(p, p.items[1].id, true);
    expect(resizeGroup(p, ids(p), 'width', 2000, 'equal').reason).toMatch(/is locked/);
  });
});

describe('group height and depth (ADR-148)', () => {
  it('set on every piece; placements stay; one undo step', () => {
    const p = grouped(['base-door', 'chest']);
    st().openProject(p);
    const g = st().project!.groups![0];
    expect(st().resizeGroup(g.id, 'height', 900, 'equal')).toBe('');
    expect([0, 1].map((i) => param(st().project!, i, 'height'))).toEqual([900, 900]);
    expect(boxes(st().project!).map((b) => b.y)).toEqual(boxes(p).map((b) => b.y));
    st().resizeGroup(g.id, 'depth', 500, 'equal');
    expect([0, 1].map((i) => param(st().project!, i, 'depth'))).toEqual([500, 500]);
    st().undoProject();
    expect(param(st().project!, 0, 'depth')).toBe(param(p, 0, 'depth'));
    expect(param(st().project!, 0, 'height')).toBe(900);
  });
  it('fields show the largest piece and say when pieces differ', () => {
    const p = grouped(['base-door', 'chest']);
    const h = groupSizeFields(p, ids(p)).find((f) => f.key === 'height')!;
    const hs = [param(p, 0, 'height'), param(p, 1, 'height')];
    expect(h.value).toBe(Math.max(...hs));
    expect(h.differs).toBe(hs[0] !== hs[1]);
  });
});

describe('grouped pieces move together (ADR-148)', () => {
  it('a drag or arrow key on one grouped piece moves the whole group', () => {
    const p = grouped(['base-door', 'base-door', 'chest']);
    st().openProject(p);
    st().moveItemBy(p.items[1].id, 100, 0, 1);
    const moved = boxes(st().project!);
    boxes(p).forEach((b, i) => expect(moved[i].x - b.x).toBe(100));
  });
  it('the X field, align and distribute carry the group; a turn turns the group', () => {
    const p = grouped(['base-door', 'base-door']);
    st().openProject(p);
    const it = st().project!.items[0];
    st().updateItem(it.id, { position: { ...it.position, x: it.position.x + 40 } });
    boxes(st().project!).forEach((b, i) => expect(b.x - boxes(p)[i].x).toBe(40));
    st().turnItem(p.items[0].id, 1);
    expect(st().project!.items.map((i) => i.rotationY)).toEqual([90, 90]);
    // Align with a piece outside the group moves the whole group.
    let q = grouped(['base-door', 'base-door']);
    q = { ...q, items: [...q.items, makeItem(q, t('chest'))] };
    const chest = q.items[2];
    q = {
      ...q,
      items: q.items.map((x) =>
        x.id === chest.id ? { ...x, position: { ...x.position, z: 300 } } : x,
      ),
    };
    const before = boxes(q);
    st().openProject(q);
    st().selectItems([chest.id, q.items[0].id]);
    st().alignSelection('back');
    const after = boxes(st().project!);
    expect(after[0].z).toBe(before[2].z);
    expect(after[1].z).toBe(before[2].z);
  });
  it('align: a group aligns as one block; the first piece’s own group stays and says why', () => {
    // Base 600 at 0, chest 800 at 600, wardrobe at 1400; the first two grouped.
    let p = newProject('Align groups');
    for (const id of ['base-door', 'chest', 'wardrobe'])
      p = { ...p, items: [...p.items, makeItem(p, t(id))] };
    p = resolvePlacements(p);
    const [a, b, c] = ids(p);
    const whole = groupItems(p, [a, b, c]).project;
    st().openProject(whole);
    // All three in one group, the rightmost first: Align left must not slide the group right.
    st().selectItems([c, a, b]);
    expect(st().alignSelection('left')).toMatch(/same group as .*; ungroup to align them\./);
    expect(boxes(st().project!).map((x) => x.x)).toEqual(boxes(whole).map((x) => x.x));
    // A group aligns by its outer box to a piece outside it, its members moving together.
    const two = groupItems(p, [a, b]).project;
    const before = boxes(two);
    st().openProject(two);
    st().selectItems([c, b]);
    expect(st().alignSelection('right')).toBe('');
    const after = boxes(st().project!);
    expect(after[1].x + after[1].w).toBe(before[2].x + before[2].w);
    expect(after[0].x - before[0].x).toBe(after[1].x - before[1].x);
    st().openProject(two);
    st().selectItems([c, b]);
    st().alignSelection('left');
    expect(boxes(st().project!)[0].x).toBe(before[2].x);
  });
  it('distribute: a group counts as one block; fewer than three blocks is refused', () => {
    let p = newProject('Distribute groups');
    for (const id of ['base-door', 'base-door', 'base-door', 'base-door'])
      p = { ...p, items: [...p.items, makeItem(p, t(id))] };
    p = resolvePlacements(p);
    const [a, b, c, d] = ids(p);
    // The last piece 600 mm further right; the middle two grouped.
    p = {
      ...p,
      items: p.items.map((x) =>
        x.id === d ? { ...x, position: { ...x.position, x: x.position.x + 600 } } : x,
      ),
    };
    const g = groupItems(p, [b, c]).project;
    const before = boxes(g);
    for (const sel of [
      [a, b, c, d],
      [a, b, d],
    ]) {
      st().openProject(g);
      st().selectItems(sel);
      expect(st().distributeSelection()).toBe('Gaps now 300 · 300 mm.');
      const after = boxes(st().project!);
      // The group moved as one: 300 mm gap each side of it, its pieces still touching.
      expect(after[1].x - (after[0].x + after[0].w)).toBe(300);
      expect(after[3].x - (after[2].x + after[2].w)).toBe(300);
      expect(after[2].x).toBe(after[1].x + after[1].w);
      expect([after[0].x, after[3].x]).toEqual([before[0].x, before[3].x]);
    }
    st().openProject(g);
    st().selectItems([a, b, c]);
    expect(st().distributeSelection()).toMatch(/three or more pieces or groups/);
    expect(boxes(st().project!)).toEqual(before);
  });
  it('up and down: wall units follow; a floor piece refuses with the reason', () => {
    let p = newProject('Wall');
    for (const id of ['wall-cabinet', 'wall-cabinet'])
      p = { ...p, items: [...p.items, makeItem(p, t(id))] };
    p = groupItems(resolvePlacements(p), ids(p)).project;
    const one = setWallHeight(p, p.items[0].id, 1500);
    const res = carryGroups(p, one.project, [p.items[0].id]);
    expect(res.reason).toBeUndefined();
    expect(res.project.items.map((i) => (i.placement as { height: number }).height)).toEqual([
      1500, 1500,
    ]);
    let q = newProject('Mixed');
    for (const id of ['wall-cabinet', 'base-door'])
      q = { ...q, items: [...q.items, makeItem(q, t(id))] };
    q = groupItems(resolvePlacements(q), ids(q)).project;
    const up = setWallHeight(q, q.items[0].id, 1500);
    const no = carryGroups(q, up.project, [q.items[0].id]);
    expect(no.project).toBe(q);
    expect(no.reason).toMatch(/stands on the floor/);
  });
  it('a locked member stops the whole move', () => {
    let p = grouped(['base-door', 'base-door']);
    p = setLocked(p, p.items[1].id, true);
    st().openProject(p);
    expect(st().moveItemBy(p.items[0].id, 100, 0, 1)).toMatch(/is locked/);
    expect(boxes(st().project!)).toEqual(boxes(p));
  });
  it('withGroups adds the other members after the given ids', () => {
    const p = grouped(['base-door', 'chest']);
    expect(withGroups(p, [p.items[1].id])).toEqual([p.items[1].id, p.items[0].id]);
  });
});
