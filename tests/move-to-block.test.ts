import { beforeEach, describe, expect, it } from 'vitest';
import { templates } from '../src/core/design';
import { moveTo, moveToOptions, MOVE_TO_ACTIONS, type MoveToAction } from '../src/core/moveTo';
import {
  makeItem,
  newProject,
  placedBounds,
  resolvePlacements,
  type Project,
  type ProjectItem,
} from '../src/core/project';
import { shapeOutline, type Room } from '../src/core/room';
import { useDesign } from '../src/store/designStore';

// Move to on a multi-selection moves it as one block (ADR-182): one offset for every piece, the block's leading edge
// meets the wall or the first piece outside the selection, and a locked piece refuses with its reason.

const t = (id: string) => templates.find((x) => x.id === id)!.create();

interface Spec {
  tpl: string;
  x: number;
  z?: number;
  locked?: true;
}
/** A project with the given pieces (ids p0, p1, …) in a 4000 × 3000 × 2500 room. */
function project(pieces: Spec[]): Project {
  let p = newProject('Move to block');
  pieces.forEach((s, i) => {
    const it = makeItem(p, t(s.tpl));
    p = {
      ...p,
      items: [
        ...p.items,
        {
          ...it,
          id: `p${i}`,
          position: { ...it.position, x: s.x, z: s.z ?? 0 },
          rotationY: 0,
          ...(s.locked ? { locked: s.locked } : {}),
        },
      ],
    };
  });
  const room: Room = {
    height: 2500,
    outline: shapeOutline('rectangle', {
      width: 4000,
      depth: 3000,
      cutWidth: 0,
      cutDepth: 0,
      offset: 0,
    }),
    features: [],
  };
  return resolvePlacements({ ...p, room });
}
const box = (p: Project, id: string) => placedBounds(p.items.find((i) => i.id === id)!);
const item = (p: Project, id: string): ProjectItem => p.items.find((i) => i.id === id)!;
const go = (p: Project, ids: string[], a: MoveToAction) => {
  const r = moveTo(p, ids, a);
  expect(r.reason).toBeUndefined();
  expect(r.project).not.toBe(p);
  return r.project;
};
/** How far each piece moved, as [dx, dy, dz]. */
const moved = (p: Project, q: Project, ids: string[]) =>
  ids.map((id) => {
    const a = box(p, id),
      b = box(q, id);
    return [b.x - a.x, b.y - a.y, b.z - a.z];
  });

describe('Move to a selection as one block (ADR-182)', () => {
  it('three pieces to the back wall: all move by the same dz and the block’s back meets the wall', () => {
    const p = project([
      { tpl: 'base-door', x: 0, z: 500 },
      { tpl: 'base-door', x: 600, z: 800 },
      { tpl: 'base-door', x: 1200, z: 500 },
    ]);
    const ids = ['p0', 'p1', 'p2'];
    const q = go(p, ids, 'wall');
    expect(moved(p, q, ids)).toEqual(Array(3).fill([0, 0, -500]));
    expect(Math.min(...ids.map((id) => box(q, id).z))).toBe(0);
    // It keeps its layout: the middle piece is still 300 mm ahead.
    expect(box(q, 'p1').z).toBe(300);
  });

  it('to a neighbour stops at the first piece outside the selection', () => {
    const p = project([
      { tpl: 'base-door', x: 0 },
      { tpl: 'base-door', x: 600 },
      { tpl: 'base-door', x: 2400 },
    ]);
    const w = box(p, 'p0').w;
    const q = go(p, ['p0', 'p1'], 'right');
    // The block's right edge (p1) meets p2; p0 next to it is not in the way and keeps its place in the block.
    expect(box(q, 'p1').x + w).toBe(2400);
    expect(moved(p, q, ['p0', 'p1'])).toEqual(Array(2).fill([2400 - 600 - w, 0, 0]));
    expect(box(q, 'p2').x).toBe(2400);
  });

  it('a piece outside the selection between its pieces stops the block', () => {
    const p = project([
      { tpl: 'base-door', x: 0 },
      { tpl: 'base-door', x: 1000 },
      { tpl: 'base-door', x: 2000 },
    ]);
    const w = box(p, 'p0').w;
    const q = go(p, ['p0', 'p2'], 'right');
    // p0 meets p1 (400 mm away) before p2 meets the wall.
    expect(moved(p, q, ['p0', 'p2'])).toEqual(Array(2).fill([1000 - w, 0, 0]));
    expect(box(q, 'p1').x).toBe(1000);
  });

  it('a locked piece in the selection refuses every action with its reason; the project is unchanged', () => {
    const p = project([
      { tpl: 'base-door', x: 0, z: 500 },
      { tpl: 'base-door', x: 600, z: 500, locked: true },
    ]);
    const r = moveTo(p, ['p0', 'p1'], 'wall');
    expect(r.project).toBe(p);
    expect(r.reason).toMatch(/is locked/);
    const o = moveToOptions(p, ['p0', 'p1']);
    for (const a of MOVE_TO_ACTIONS) expect(o[a]).toMatch(/is locked/);
  });

  it('to ceiling: the block’s top meets the ceiling, every piece by the same dy, all wall-hung', () => {
    const p = project([
      { tpl: 'base-door', x: 0 },
      { tpl: 'wall-cabinet', x: 600 },
    ]);
    const q = go(p, ['p0', 'p1'], 'ceiling');
    const [a, b] = moved(p, q, ['p0', 'p1']);
    expect(a).toEqual(b);
    expect(a[1]).toBeGreaterThan(0);
    expect(Math.max(...['p0', 'p1'].map((id) => box(q, id).y + box(q, id).h))).toBe(2500);
    expect(item(q, 'p0').placement?.kind).toBe('wall');
    expect(item(q, 'p1').placement?.kind).toBe('wall');
  });

  it('down: the block drops until its first piece lands on a piece outside it', () => {
    const p = project([
      { tpl: 'base-door', x: 0 },
      { tpl: 'wall-cabinet', x: 0 },
      { tpl: 'wall-cabinet', x: 600 },
    ]);
    const q = go(p, ['p1', 'p2'], 'down');
    const [a, b] = moved(p, q, ['p1', 'p2']);
    expect(a).toEqual(b);
    expect(item(q, 'p1').placement).toMatchObject({ kind: 'above', baseId: 'p0', gap: 0 });
    expect(box(q, 'p2').y).toBe(box(p, 'p0').h);
  });

  it('a floor piece in the selection keeps Down off with its name', () => {
    const p = project([
      { tpl: 'base-door', x: 0 },
      { tpl: 'wall-cabinet', x: 600 },
    ]);
    const r = moveTo(p, ['p1', 'p0'], 'down');
    expect(r.project).toBe(p);
    expect(r.reason).toMatch(/already sits on the floor or on a piece/);
  });

  it('the block carries the groups and connected pieces of its pieces (ADR-148, ADR-168)', () => {
    const base = project([
      { tpl: 'base-door', x: 0, z: 400 },
      { tpl: 'base-door', x: 600, z: 400 },
      { tpl: 'base-door', x: 1200, z: 700 },
      { tpl: 'base-door', x: 1800, z: 400 },
    ]);
    const p: Project = {
      ...base,
      groups: [{ id: 'g', name: 'Pair', itemIds: ['p1', 'p2'] }],
      connections: [{ id: 'c', itemIds: ['p0', 'p3'] }],
    };
    const ids = ['p0', 'p1', 'p2', 'p3'];
    const q = go(p, ['p0', 'p1'], 'wall');
    expect(moved(p, q, ids)).toEqual(Array(4).fill([0, 0, -400]));
    expect(q.groups).toEqual(p.groups);
  });

  it('options and moves agree for every action on a selection', () => {
    const p = project([
      { tpl: 'base-door', x: 0, z: 300 },
      { tpl: 'base-door', x: 900, z: 300 },
      { tpl: 'wall-cabinet', x: 1800 },
      { tpl: 'base-door', x: 3000 },
    ]);
    for (const ids of [
      ['p0', 'p1'],
      ['p1', 'p2'],
      ['p0', 'p2', 'p3'],
    ])
      for (const a of MOVE_TO_ACTIONS) {
        const off = moveToOptions(p, ids)[a];
        const r = moveTo(p, ids, a);
        expect(r.reason ?? null).toBe(off);
        expect(r.project === p).toBe(off !== null);
      }
  });
});

describe('Move to a selection in the store (ADR-182)', () => {
  const s = () => useDesign.getState();
  beforeEach(() =>
    s().openProject(
      project([
        { tpl: 'base-door', x: 0, z: 500 },
        { tpl: 'base-door', x: 600, z: 800 },
      ]),
    ),
  );

  it('one tap moves the block and is one undo step', () => {
    const ids = s().project!.items.map((i) => i.id);
    const past = s().projectPast.length;
    expect(s().moveItemTo(ids, 'wall')).toBeNull();
    expect(ids.map((id) => box(s().project!, id).z)).toEqual([0, 300]);
    expect(s().projectPast).toHaveLength(past + 1);
    s().undoProject();
    expect(ids.map((id) => box(s().project!, id).z)).toEqual([500, 800]);
  });
});
