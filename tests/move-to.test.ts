import { beforeEach, describe, expect, it } from 'vitest';
import { templates } from '../src/core/design';
import { moveTo, moveToOptions, MOVE_TO_ACTIONS, type MoveToAction } from '../src/core/moveTo';
import {
  makeItem,
  newProject,
  placedBounds,
  resolvePlacements,
  type Placement,
  type Project,
  type ProjectItem,
} from '../src/core/project';
import { shapeOutline, type Room } from '../src/core/room';
import { useDesign } from '../src/store/designStore';

const t = (id: string) => templates.find((x) => x.id === id)!.create();

interface Spec {
  tpl: string;
  x: number;
  z?: number;
  r?: ProjectItem['rotationY'];
  placement?: Placement;
  angle?: number;
  locked?: true;
}
/** A project with the given pieces (ids p0, p1, …), in a 4000 × 3000 × 2500 room unless `room` is false. */
function project(pieces: Spec[], withRoom = true): Project {
  let p = newProject('Move to');
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
          rotationY: s.r ?? 0,
          ...(s.placement ? { placement: s.placement } : {}),
          ...(s.angle ? { angle: s.angle } : {}),
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
  return resolvePlacements(withRoom ? { ...p, room } : p);
}
const box = (p: Project, id: string) => placedBounds(p.items.find((i) => i.id === id)!);
const item = (p: Project, id: string) => p.items.find((i) => i.id === id)!;
const go = (p: Project, id: string, a: MoveToAction) => {
  const r = moveTo(p, id, a);
  expect(r.reason).toBeUndefined();
  return r.project;
};

describe('Move to: sliding (ADR-147)', () => {
  it('to wall slides back until it touches the wall, any distance', () => {
    const p = project([{ tpl: 'base-door', x: 1000, z: 900 }]);
    const b = box(go(p, 'p0', 'wall'), 'p0');
    expect(b.z).toBe(0);
    expect(b.x).toBe(1000);
  });

  it('left and right slide to the first piece, then to the wall', () => {
    const p = project([
      { tpl: 'base-door', x: 0 },
      { tpl: 'base-door', x: 1500 },
    ]);
    const w = box(p, 'p0').w;
    expect(box(go(p, 'p1', 'left'), 'p1').x).toBe(w);
    const right = go(p, 'p1', 'right');
    expect(box(right, 'p1').x + box(right, 'p1').w).toBe(4000);
    // Whole millimetres.
    expect(Number.isInteger(box(right, 'p1').x)).toBe(true);
  });

  it('a wall unit slides past a base unit below it (no height overlap)', () => {
    const p = project([
      { tpl: 'base-door', x: 0 },
      { tpl: 'wall-cabinet', x: 1500 },
    ]);
    expect(box(go(p, 'p1', 'left'), 'p1').x).toBe(0);
  });

  it.each([
    [90, 'left', 'z', 1],
    [90, 'right', 'z', -1],
    [180, 'left', 'x', 1],
    [270, 'left', 'z', -1],
    [270, 'wall', 'x', 1],
    [90, 'wall', 'x', -1],
    [180, 'wall', 'z', 1],
  ] as const)('turned %i°: %s moves along %s, sign %i, to the wall', (r, action, axis, sign) => {
    const p = project([{ tpl: 'base-door', x: 1500, z: 1000, r }]);
    const before = box(p, 'p0');
    const after = box(go(p, 'p0', action), 'p0');
    const lo = axis === 'x' ? after.x : after.z;
    const hi = axis === 'x' ? after.x + after.w : after.z + after.d;
    const was = axis === 'x' ? before.x : before.z;
    expect(Math.sign(lo - was)).toBe(sign);
    if (sign > 0) expect(hi).toBe(axis === 'x' ? 4000 : 3000);
    else expect(lo).toBe(0);
  });

  it('into corner: back to the wall, then the nearer side', () => {
    const p = project([{ tpl: 'base-door', x: 800, z: 700 }]);
    const b = box(go(p, 'p0', 'corner'), 'p0');
    expect([b.x, b.z]).toEqual([0, 0]);
  });

  it('centre: between the pieces or walls on each side; odd mm round left', () => {
    const p = project([
      { tpl: 'base-door', x: 0 },
      { tpl: 'base-door', x: 1001 },
    ]);
    const w = box(p, 'p0').w;
    const b = box(go(p, 'p1', 'centre'), 'p1');
    const left = b.x - w,
      right = 4000 - (b.x + b.w);
    expect(right - left).toBeGreaterThanOrEqual(0);
    expect(right - left).toBeLessThanOrEqual(1);
  });
});

describe('Move to: up and down (ADR-147)', () => {
  it('to ceiling turns a floor piece wall-hung with its top at the room height', () => {
    const p = project([{ tpl: 'base-door', x: 0 }]);
    const h = box(p, 'p0').h;
    const q = go(p, 'p0', 'ceiling');
    expect(item(q, 'p0').placement).toEqual({ kind: 'wall', height: 2500 - h });
    expect(box(q, 'p0').y + h).toBe(2500);
  });

  it('down lands a wall unit on the piece under it, or on the floor', () => {
    const p = project([
      { tpl: 'base-door', x: 0 },
      { tpl: 'wall-cabinet', x: 0 },
      { tpl: 'wall-cabinet', x: 2000 },
    ]);
    const q = go(p, 'p1', 'down');
    expect(item(q, 'p1').placement).toMatchObject({ kind: 'above', baseId: 'p0', gap: 0 });
    expect(box(q, 'p1').y).toBe(box(p, 'p0').h);
    const r = go(p, 'p2', 'down');
    expect(item(r, 'p2').placement).toEqual({ kind: 'floor' });
    expect(box(r, 'p2').y).toBe(0);
  });

  it('align top matches the neighbour; a floor piece cannot change height', () => {
    const p = project([
      { tpl: 'wall-cabinet', x: 0, placement: { kind: 'wall', height: 1400 } },
      { tpl: 'wall-cabinet', x: 1500, placement: { kind: 'wall', height: 1600 } },
    ]);
    const q = go(p, 'p1', 'alignTopLeft');
    expect(box(q, 'p1').y + box(q, 'p1').h).toBe(box(p, 'p0').y + box(p, 'p0').h);
    const f = project([
      { tpl: 'base-door', x: 0 },
      { tpl: 'base-door', x: 1500 },
    ]);
    expect(moveToOptions(f, 'p1').alignTopLeft).toMatch(/Already at that height/);
  });

  it('align front lines up the front edges', () => {
    const p = project([
      { tpl: 'base-door', x: 0 },
      { tpl: 'base-door', x: 1500, z: 200 },
    ]);
    const q = go(p, 'p1', 'alignFrontLeft');
    expect(box(q, 'p1').z + box(q, 'p1').d).toBe(box(p, 'p0').z + box(p, 'p0').d);
  });
});

describe('Move to: stacked and freely turned pieces (ADR-147, G-295, G-297)', () => {
  it('a stacked piece slides along its base and stops at the base end', () => {
    const p = project([
      { tpl: 'sideboard', x: 1000 },
      { tpl: 'chest', x: 0, placement: { kind: 'above', baseId: 'p0', gap: 0, offsetX: 100 } },
    ]);
    const q = go(p, 'p1', 'left');
    expect(item(q, 'p1').placement).toMatchObject({ kind: 'above', offsetX: 0 });
    expect(box(q, 'p1').x).toBe(box(p, 'p0').x);
    expect(moveToOptions(p, 'p1').wall).toMatch(/Sits on another piece/);
  });

  it('a freely turned piece has only To ceiling and Down', () => {
    const p = project([{ tpl: 'wall-cabinet', x: 1000, angle: 30 }]);
    const o = moveToOptions(p, 'p0');
    expect(o.ceiling).toBeNull();
    expect(o.down).toBeNull();
    for (const a of MOVE_TO_ACTIONS.filter((x) => x !== 'ceiling' && x !== 'down'))
      expect(o[a]).toMatch(/Turned freely/);
  });
});

describe('Move to: refused with the reason (ADR-147, ADR-008)', () => {
  it('a locked piece does not move and says why', () => {
    const p = project([{ tpl: 'base-door', x: 1000, z: 500, locked: true }]);
    const r = moveTo(p, 'p0', 'wall');
    expect(r.project).toBe(p);
    expect(r.reason).toMatch(/locked/);
  });

  it('no room: wall, corner and ceiling ask for the room', () => {
    const p = project([{ tpl: 'base-door', x: 1000, z: 500 }], false);
    const o = moveToOptions(p, 'p0');
    expect([o.wall, o.corner, o.ceiling]).toEqual(Array(3).fill('Draw the room first.'));
  });

  it('nothing in the way or already touching: off, project unchanged', () => {
    const p = project([{ tpl: 'base-door', x: 1000 }], false);
    expect(moveToOptions(p, 'p0').left).toBe('Nothing on its left.');
    const q = project([{ tpl: 'base-door', x: 0 }]);
    const r = moveTo(q, 'p0', 'left');
    expect(r.project).toBe(q);
    expect(r.reason).toBe('Already touching wall 4.');
  });

  it('options and moves agree for every action', () => {
    const p = project([
      { tpl: 'base-door', x: 0 },
      { tpl: 'base-door', x: 1500, z: 300 },
      { tpl: 'wall-cabinet', x: 700 },
    ]);
    for (const id of ['p0', 'p1', 'p2'])
      for (const a of MOVE_TO_ACTIONS) {
        const off = moveToOptions(p, id)[a];
        const r = moveTo(p, id, a);
        expect(r.reason ?? null).toBe(off);
        expect(r.project === p).toBe(off !== null);
      }
  });
});

describe('Move to with grouped pieces (ADR-147, ADR-148)', () => {
  it('a grouped piece takes its group along; its group-mate is not in the way', () => {
    const base = project([
      { tpl: 'base-door', x: 1000, z: 600 },
      { tpl: 'base-door', x: 1600, z: 600 },
    ]);
    const p = { ...base, groups: [{ id: 'g', name: 'Pair', itemIds: ['p0', 'p1'] }] };
    const q = go(p, 'p1', 'wall');
    expect([box(q, 'p0').z, box(q, 'p1').z]).toEqual([0, 0]);
    // The group stops when its first member reaches the wall.
    const r = go(p, 'p1', 'left');
    expect(box(r, 'p1').x - box(r, 'p0').x).toBe(box(p, 'p1').x - box(p, 'p0').x);
    expect(box(r, 'p0').x).toBe(0);
    expect(box(r, 'p1').x).toBe(1600 - 1000);
  });
});

describe('Move to in the store (ADR-147)', () => {
  const s = () => useDesign.getState();
  beforeEach(() => s().openProject(project([{ tpl: 'base-door', x: 1000, z: 800 }])));

  it('one undo step per tap', () => {
    const id = s().project!.items[0].id;
    expect(s().moveItemTo(id, 'corner')).toBeNull();
    expect(box(s().project!, id)).toMatchObject({ x: 0, z: 0 });
    s().undoProject();
    expect(box(s().project!, id)).toMatchObject({ x: 1000, z: 800 });
  });

  it('a refused tap leaves the project and history alone and says why', () => {
    const id = s().project!.items[0].id;
    const past = s().projectPast.length;
    expect(s().moveItemTo(id, 'down')).toBe('Already on the floor.');
    expect(s().projectPast).toHaveLength(past);
  });
});
