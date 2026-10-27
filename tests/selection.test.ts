import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { templates } from '../src/core/design';
import {
  makeItem,
  newProject,
  placedBounds,
  PROJECT_SCHEMA,
  resolvePlacements,
  setLocked,
  validateProject,
  type Project,
} from '../src/core/project';
import {
  duplicateItems,
  groupItems,
  groupOf,
  itemsAt,
  itemsInBox,
  moveItems,
  nextUnder,
  selectionBounds,
  turnSelection,
  ungroup,
} from '../src/core/selection';
import { loadProject, saveProject } from '../src/persist/db';
import { useDesign } from '../src/store/designStore';

const t = (id: string) => templates.find((x) => x.id === id)!.create();
function run(ids: string[]): Project {
  let p = newProject('Selection');
  for (const id of ids) p = { ...p, items: [...p.items, makeItem(p, t(id))] };
  return resolvePlacements(p);
}
const boxes = (p: Project) => resolvePlacements(p).items.map(placedBounds);
const whole = (p: Project) =>
  p.items.every((i) => [i.position.x, i.position.y, i.position.z].every(Number.isInteger));
/** A base cabinet with a wall cabinet standing on it, and a chest beside. */
function stacked(): Project {
  const p = run(['base-door', 'wall-cabinet', 'chest']);
  const [base, top, chest] = p.items;
  return resolvePlacements({
    ...p,
    items: [
      base,
      { ...top, placement: { kind: 'above', baseId: base.id, gap: 0, offsetX: 0 } },
      chest,
    ],
  });
}

describe('moving a selection (ADR-097)', () => {
  it('moves every selected piece by the same whole mm; others stay', () => {
    const p = run(['base-door', 'base-door', 'chest']);
    const ids = p.items.slice(0, 2).map((i) => i.id);
    const res = moveItems(p, ids, 333.4, -20.6);
    expect(res.reason).toBeUndefined();
    const [a, b] = boxes(p),
      [a2, b2, c2] = boxes(res.project);
    expect([a2.x - a.x, a2.z - a.z]).toEqual([333, -21]);
    expect([b2.x - b.x, b2.z - b.z]).toEqual([333, -21]);
    expect(c2).toEqual(boxes(p)[2]);
    expect(whole(res.project)).toBe(true);
    expect(moveItems(p, ids, 0.2, 0).project).toBe(p);
    // On the drag step, as a drag rounds (ADR-065).
    const stepped = moveItems(p, ids, 333, 0, 10).project;
    expect(boxes(stepped)[0].x - boxes(p)[0].x).toBe(330);
    expect(moveItems(p, [], 100, 0).project).toBe(p);
  });

  it('a piece on a selected base keeps resting on it; one whose base is not selected is lifted off', () => {
    const p = stacked();
    const [base, top] = p.items;
    const both = resolvePlacements(moveItems(p, [base.id, top.id], 500, 0).project);
    expect(both.items[1].placement).toEqual(p.items[1].placement);
    expect(placedBounds(both.items[1]).x).toBe(placedBounds(p.items[1]).x + 500);
    const alone = moveItems(p, [top.id, p.items[2].id], 500, 0).project;
    expect(alone.items[1].placement?.kind).toBe('wall');
  });

  it('locks apply to each piece: refused with the reason naming it', () => {
    const p = run(['base-door', 'chest']);
    const q = setLocked(p, p.items[1].id, true);
    const res = moveItems(
      q,
      q.items.map((i) => i.id),
      100,
      0,
    );
    expect(res.project).toBe(q);
    expect(res.reason).toContain(q.items[1].design.name);
    // A selected base carrying a locked piece outside the selection is refused too.
    const s = stacked();
    const lockedTop = setLocked(s, s.items[1].id, true);
    expect(moveItems(lockedTop, [s.items[0].id], 100, 0).reason).toMatch(/sits on/);
  });
});

describe('turning a selection (ADR-097)', () => {
  it('turns each piece a quarter and its footprint about the selection centre, whole mm', () => {
    const p = run(['base-door', 'base-door']);
    const ids = p.items.map((i) => i.id);
    const before = selectionBounds(p, ids)!;
    const res = turnSelection(p, ids, 1);
    expect(res.reason).toBeUndefined();
    expect(res.project.items.map((i) => i.rotationY)).toEqual([90, 90]);
    expect(whole(res.project)).toBe(true);
    const after = selectionBounds(res.project, ids)!;
    // The footprint turns: width and depth swap; the centre moves at most ½ mm each way.
    expect([after.w, after.d]).toEqual([before.d, before.w]);
    expect(Math.abs(after.x + after.w / 2 - (before.x + before.w / 2))).toBeLessThanOrEqual(1);
    expect(Math.abs(after.z + after.d / 2 - (before.z + before.d / 2))).toBeLessThanOrEqual(1);
    // The pieces stay side by side, now along z: they do not overlap.
    const [a, b] = boxes(res.project);
    expect(a.z + a.d <= b.z || b.z + b.d <= a.z).toBe(true);
    // Back and forth gives the same rotations; a piece on a selected base stays on it.
    expect(turnSelection(res.project, ids, -1).project.items.map((i) => i.rotationY)).toEqual([
      0, 0,
    ]);
    // A piece standing on a selected base turns with it and keeps its exact turned place (now free).
    const s = stacked();
    const sel = [s.items[0].id];
    const before2 = boxes(s);
    const turned = resolvePlacements(turnSelection(s, sel, 1).project);
    expect(turned.items[1].rotationY).toBe(90);
    expect(turned.items[1].placement).toBeUndefined();
    const [tb, tt] = boxes(turned);
    // Same relation as before, turned a quarter: backs stay together (z → x) and the top's overhang past the base's
    // right end now runs towards the back (x → −z); same height.
    const [b0, t0] = before2;
    expect(tt.y).toBe(t0.y);
    expect(tt.x - tb.x).toBe(t0.z - b0.z);
    expect(tb.z - tt.z).toBe(t0.x + t0.w - (b0.x + b0.w));
    expect([tb.w, tb.d]).toEqual([before2[0].d, before2[0].w]);
  });

  it('a locked piece refuses the turn', () => {
    const p = run(['base-door', 'chest']);
    const q = setLocked(p, p.items[0].id, true);
    const res = turnSelection(
      q,
      q.items.map((i) => i.id),
      1,
    );
    expect(res.project).toBe(q);
    expect(res.reason).toMatch(/locked/);
  });
});

describe('duplicate, box, cycle (ADR-097)', () => {
  it('duplicates the selection as a block to its right with new ids, unlocked, stacking kept', () => {
    const p = stacked();
    const q = setLocked(p, p.items[0].id, true);
    const ids = q.items.slice(0, 2).map((i) => i.id);
    const res = duplicateItems(q, ids);
    expect(res.ids.length).toBe(2);
    const copies = res.project.items.slice(3);
    expect(copies.map((c) => c.id)).toEqual(res.ids);
    expect(copies.every((c) => !c.locked)).toBe(true);
    const pl = copies[1].placement;
    expect(pl?.kind === 'above' && pl.baseId).toBe(copies[0].id);
    const w = selectionBounds(q, ids)!.w;
    expect(placedBounds(resolvePlacements(res.project).items[3]).x).toBe(
      placedBounds(q.items[0]).x + w,
    );
    // Copying only the top: its base is not copied, so the copy stands free at its place in the block.
    const top = duplicateItems(q, [q.items[1].id]);
    const copy = resolvePlacements(top.project).items[3];
    expect(copy.placement).toBeUndefined();
    expect(placedBounds(copy).y).toBe(placedBounds(resolvePlacements(q).items[1]).y);
  });

  it('a box selects the pieces it touches; a point lists stacked pieces in drawing order', () => {
    const p = stacked();
    const [base, top, chest] = boxes(p);
    expect(itemsInBox(p, { x: base.x + 10, z: 10 }, { x: base.x + 20, z: 20 })).toEqual([
      p.items[0].id,
      p.items[1].id,
    ]);
    expect(
      itemsInBox(p, { x: chest.x + chest.w + 5000, z: 0 }, { x: base.x - 10, z: 9000 }),
    ).toEqual(p.items.map((i) => i.id));
    const under = itemsAt(p, top.x + 5, top.z + 5);
    expect(under).toEqual([p.items[0].id, p.items[1].id]);
    expect(nextUnder(under, under[0])).toBe(under[1]);
    expect(nextUnder(under, under[1])).toBe(under[0]);
    expect(nextUnder([], 'x')).toBeUndefined();
  });
});

describe('groups (ADR-097)', () => {
  it('a piece is in at most one group; ungroup removes it; deleted pieces leave their group', () => {
    const p = run(['base-door', 'base-door', 'chest']);
    const [a, b, c] = p.items.map((i) => i.id);
    const g1 = groupItems(p, [a, b]);
    expect(g1.project.groups?.[0]).toMatchObject({ name: 'Group 1', itemIds: [a, b] });
    expect(groupItems(p, [a]).groupId).toBeNull();
    const g2 = groupItems(g1.project, [b, c]);
    // Group 1 is left with one piece: no group any more.
    expect(g2.project.groups?.map((g) => g.itemIds)).toEqual([[b, c]]);
    expect(g2.project.groups?.[0].name).toBe('Group 2');
    expect(groupOf(g2.project, c)?.id).toBe(g2.groupId);
    expect(groupOf(g2.project, a)).toBeUndefined();
    expect(ungroup(g2.project, g2.groupId!).groups?.length).toBe(0);
    expect(ungroup(g2.project, 'nope')).toBe(g2.project);
  });

  it('groups save and reload; older versions load; groups need version 8; bad groups are refused', async () => {
    const p = run(['base-door', 'chest']);
    const g = groupItems(
      p,
      p.items.map((i) => i.id),
    ).project;
    expect(g.schemaVersion).toBe(PROJECT_SCHEMA);
    expect(validateProject(g)).toEqual([]);
    await saveProject(g);
    expect((await loadProject(g.id))?.groups).toEqual(g.groups);
    for (const v of [1, 2, 3, 4, 5, 6, 7])
      expect(validateProject({ ...p, schemaVersion: v })).toEqual([]);
    expect(validateProject({ ...g, schemaVersion: 7 })).toContain(
      'Groups need project schemaVersion 8',
    );
    const bad = (groups: unknown) => validateProject({ ...g, groups } as never);
    expect(bad([{ id: 'x', name: 'G', itemIds: ['missing'] }])).toContain('Invalid group');
    expect(bad([{ id: 'x', name: '', itemIds: p.items.map((i) => i.id) }])).toContain(
      'Invalid group',
    );
    expect(bad([{ id: 'x', name: 'One', itemIds: [p.items[0].id] }])).toContain('Invalid group');
    const id0 = p.items[0].id;
    const id1 = p.items[1].id;
    expect(
      bad([
        { id: 'x', name: 'A', itemIds: [id0, id1] },
        { id: 'y', name: 'B', itemIds: [id1, id0] },
      ]),
    ).toContain('Invalid group');
    const v7 = { ...p, id: 'v7', schemaVersion: 7 as const };
    await saveProject(v7);
    expect(await loadProject('v7')).toEqual(v7);
  });
});

describe('the selection in the store (ADR-097)', () => {
  const s = () => useDesign.getState();
  beforeEach(() => s().openProject(run(['base-door', 'base-door', 'chest'])));

  it('toggle, select all, Esc-clear; the main piece is first', () => {
    const [a, b, c] = s().project!.items.map((i) => i.id);
    s().selectItem(a);
    s().toggleItem(b);
    expect(s().selectedItemIds).toEqual([a, b]);
    expect(s().selectedItemId).toBe(a);
    s().toggleItem(a);
    expect(s().selectedItemIds).toEqual([b]);
    s().selectAll();
    expect(s().selectedItemIds).toEqual([a, b, c]);
    s().selectItem(null);
    expect(s().selectedItemIds).toEqual([]);
  });

  it('every selection action is one undo step', () => {
    const ids = s()
      .project!.items.slice(0, 2)
      .map((i) => i.id);
    const steps = () => s().projectPast.length;
    const act = (f: () => unknown) => {
      s().selectItems(ids);
      const n = steps();
      const before = s().project;
      f();
      expect(steps()).toBe(n + 1);
      s().undoProject();
      expect(s().project).toBe(before);
    };
    act(() => s().moveSelectionBy(200, 0));
    act(() => s().turnSelectionBy(1));
    act(() => s().duplicateSelection());
    act(() => s().groupSelection());
    act(() => s().deleteSelection());
    act(() =>
      s().applyFinish(ids[0], 'front', s().project!.items[0].design.materials[0], 'selection'),
    );
    // Ungroup too.
    s().selectItems(ids);
    const gid = s().groupSelection()!;
    const n = steps();
    s().ungroup(gid);
    expect(steps()).toBe(n + 1);
  });

  it('delete removes every selected piece; undo brings them back', () => {
    const ids = s()
      .project!.items.slice(0, 2)
      .map((i) => i.id);
    s().selectItems(ids);
    s().deleteSelection();
    expect(s().project!.items.length).toBe(1);
    expect(s().selectedItemIds).toEqual([]);
    s().undoProject();
    expect(
      s()
        .project!.items.map((i) => i.id)
        .slice(0, 2),
    ).toEqual(ids);
  });

  it('a tap on a grouped piece selects the group first, then the piece', () => {
    const [a, b] = s().project!.items.map((i) => i.id);
    s().selectItems([a, b]);
    s().groupSelection();
    s().selectItem(null);
    s().tapItem(b);
    expect(s().selectedItemIds).toEqual([b, a]);
    s().tapItem(b);
    expect(s().selectedItemIds).toEqual([b]);
    expect(s().drillItemId).toBe(b);
  });

  it('a deleted piece leaves its group', () => {
    const [a, b, c] = s().project!.items.map((i) => i.id);
    s().selectItems([a, b, c]);
    s().groupSelection();
    s().removeItem(c);
    expect(s().project!.groups?.[0].itemIds).toEqual([a, b]);
    // One piece left is no group.
    s().removeItem(a);
    expect(s().project!.groups).toEqual([]);
  });
});
