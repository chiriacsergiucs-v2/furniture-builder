import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { templates } from '../src/core/design';
import {
  buildProjectModel,
  dragPosition,
  makeItem,
  newProject,
  type Project,
  type ProjectItem,
} from '../src/core/project';
import { shapeOutline, type Room } from '../src/core/room';
import { connectorsOf, dropTarget, roomConnectors, SNAP_RANGE, snapDrag } from '../src/core/snap';
import { useDesign } from '../src/store/designStore';

const t = (id: string) => templates.find((x) => x.id === id)!.create();
const st = () => useDesign.getState();

/** A project with the given pieces at the given x / z (and turn), optionally in a room. */
function project(
  pieces: { tpl: string; x: number; z?: number; r?: ProjectItem['rotationY'] }[],
  room?: Room,
): Project {
  let p = newProject('Snap');
  for (const s of pieces) {
    const it = makeItem(p, t(s.tpl));
    p = {
      ...p,
      items: [
        ...p.items,
        { ...it, position: { ...it.position, x: s.x, z: s.z ?? 0 }, rotationY: s.r ?? 0 },
      ],
    };
  }
  return room ? { ...p, room } : p;
}
const model = (p: Project) => buildProjectModel(p);
const widthOf = (p: Project, i: number) => model(p).pieces[i].bounds.w;
const room = (shape: 'rectangle' | 'l-shape', W = 4000, D = 3000): Room => ({
  height: 2500,
  outline: shapeOutline(shape, { width: W, depth: D, cutWidth: 1500, cutDepth: 1200, offset: 0 }),
  features: [],
});

describe('connectors (ADR-070)', () => {
  it('a piece has a back, a front and two sides, turned with it', () => {
    const p = project([{ tpl: 'base-door', x: 1000, z: 0 }]);
    const pc = model(p).pieces[0];
    const f = connectorsOf([pc], undefined).faces;
    const back = f.find((c) => c.face === 'back')!;
    expect(back).toMatchObject({ axis: 'z', at: pc.bounds.z, normal: -1 });
    expect(f.filter((c) => c.face === 'side').map((c) => [c.axis, c.at])).toEqual([
      ['x', pc.bounds.x],
      ['x', pc.bounds.x + pc.bounds.w],
    ]);
    const turned = model(project([{ tpl: 'base-door', x: 0, z: 500, r: 90 }])).pieces[0];
    const tb = connectorsOf([turned], undefined).faces.find((c) => c.face === 'back')!;
    expect(tb).toMatchObject({ axis: 'x', at: turned.bounds.x, normal: -1 });
  });
  it('an L room has its walls pointing in and only its inside corners', () => {
    const { walls, corners } = roomConnectors(room('l-shape'));
    expect(walls).toHaveLength(6);
    expect(walls[0]).toMatchObject({ axis: 'z', at: 0, normal: 1 });
    expect(walls[1]).toMatchObject({ axis: 'x', at: 4000, normal: -1 });
    // Six corners, one of them (the cut-out's inner corner) points into the room.
    expect(corners).toHaveLength(5);
    expect(corners.find((c) => c.x === 2500 && c.z === 1800)).toBeUndefined();
  });
  it('without a room the back wall at z = 0 is the one wall', () => {
    expect(roomConnectors(undefined).walls).toEqual([
      { wall: -1, axis: 'z', at: 0, normal: 1, lo: -Infinity, hi: Infinity },
    ]);
  });
});

describe('snapping a dragged piece (ADR-070)', () => {
  it('a floor unit within 60 mm of another floor unit’s side snaps flush', () => {
    const p = project([
      { tpl: 'base-door', x: 0 },
      { tpl: 'base-door', x: 2000 },
    ]);
    const w = widthOf(p, 0);
    const pm = model(p);
    const id = p.items[1].id;
    // Dragged to 45 mm right of the first piece's side (on the 10 mm step from x 2000: 2000 − 1955 + w).
    const dx = w + 45 - 2000;
    const r = snapDrag(p, pm.pieces, id, dx, 0)!;
    expect(r.position.x).toBe(w);
    // Already on the back wall (0 mm away, ranked first), it joins the neighbour on x as well.
    expect(r.snap?.label).toMatch(/^Against the back wall · joins /);
    // Overlapping by 30 mm also snaps flush.
    expect(snapDrag(p, pm.pieces, id, w - 30 - 2000, 0)!.position.x).toBe(w);
    // Beyond the range it does not.
    const far = snapDrag(p, pm.pieces, id, w + SNAP_RANGE + 20 - 2000, 0)!;
    expect(far.position.x).toBe(dragPosition(p.items[1], w + SNAP_RANGE + 20 - 2000, 0).x);
    expect(far.snap?.label ?? '').not.toMatch(/Joins/);
  });
  it('a wall unit does not join a floor unit, and the hint says why', () => {
    const p = project([
      { tpl: 'base-door', x: 0 },
      { tpl: 'wall-cabinet', x: 2000, z: 300 },
    ]);
    const w = widthOf(p, 0);
    const r = snapDrag(p, model(p).pieces, p.items[1].id, w + 40 - 2000, 0)!;
    expect(r.snap).toBeNull();
    expect(r.position.x).toBe(w + 40);
    expect(r.hint).toMatch(/wall unit cannot join a floor unit/);
  });
  it('two wall units join; a depth difference is named', () => {
    const p = project([
      { tpl: 'wall-cabinet', x: 0 },
      { tpl: 'wall-cabinet', x: 2000, z: 300 },
    ]);
    const w = widthOf(p, 0);
    const r = snapDrag(p, model(p).pieces, p.items[1].id, w + 20 - 2000, 0)!;
    expect(r.snap?.kind).toBe('side');
    expect(r.position.x).toBe(w);
    const base = project([
      { tpl: 'base-door', x: 0 },
      { tpl: 'base-door', x: 2000, z: 300 },
    ]);
    const deeper = structuredClone(base);
    const d1 = deeper.items[1].design;
    if (d1.product.kind === 'cabinet') d1.product.params.depth = 500;
    const wb = widthOf(base, 0);
    const r2 = snapDrag(deeper, model(deeper).pieces, deeper.items[1].id, wb + 20 - 2000, 0)!;
    expect(r2.position.x).toBe(wb);
    expect(r2.snap?.notes.some((n) => /^depth \d+ vs \d+$/.test(n))).toBe(true);
  });
  it('the back of a piece snaps to a wall', () => {
    const p = project([{ tpl: 'base-door', x: 1000, z: 500 }], room('rectangle'));
    const r = snapDrag(p, model(p).pieces, p.items[0].id, 0, -450)!;
    expect(r.snap).toMatchObject({ kind: 'wall', label: 'Against wall 1' });
    expect(r.position.z).toBe(0);
    expect(r.position.x).toBe(1000);
  });
  it('a piece snaps into an inside corner of an L room', () => {
    const p = project([{ tpl: 'base-door', x: 1000, z: 500 }], room('l-shape'));
    const w = widthOf(p, 0);
    const id = p.items[0].id;
    // Near the back-right corner (wall 1 meets wall 2 at x 4000).
    const r = snapDrag(p, model(p).pieces, id, 4000 - w - 1000 - 40, -470)!;
    expect(r.snap).toMatchObject({ kind: 'corner', label: 'Into the corner of walls 1 and 2' });
    expect(r.position).toMatchObject({ x: 4000 - w, z: 0 });
    // Near the L's outside (reflex) corner nothing pulls it into the cut-out.
    const pm = model(p);
    const depth = pm.pieces[0].bounds.d;
    const out = snapDrag(p, pm.pieces, id, 2500 - 1000 + 30, 1800 - depth - 500 + 30)!;
    expect(out.snap?.kind).not.toBe('corner');
  });
  it('a turned piece snaps its back (now along x) to a side wall', () => {
    const p = project([{ tpl: 'base-door', x: 300, z: 1000, r: 90 }], room('rectangle'));
    const r = snapDrag(p, model(p).pieces, p.items[0].id, -250, 0)!;
    expect(r.snap?.label).toBe('Against wall 4');
    expect(r.position.x).toBe(0);
  });
  it('a side alone does not snap to a wall: the hint names the rule', () => {
    const p = project([{ tpl: 'base-door', x: 1000, z: 1000 }], room('rectangle'));
    const r = snapDrag(p, model(p).pieces, p.items[0].id, -970, 0)!;
    expect(r.snap).toBeNull();
    expect(r.hint).toMatch(/only the back of a piece goes against a wall/);
  });
  it('is deterministic: the same drag gives the same snap; ties go by kind then id', () => {
    const p = project(
      [
        { tpl: 'base-door', x: 0 },
        { tpl: 'base-door', x: 2000 },
        { tpl: 'base-door', x: 3000 },
      ],
      room('rectangle', 5000),
    );
    const pm = model(p);
    const w = pm.pieces[0].bounds.w;
    const a = snapDrag(p, pm.pieces, p.items[1].id, w + 37 - 2000, 33);
    const b = snapDrag(p, pm.pieces, p.items[1].id, w + 37 - 2000, 33);
    expect(a).toEqual(b);
    // Side snap on x, plus the back wall on z: both axes in one drop.
    expect(a?.snap?.label).toMatch(/^Against wall 1 · joins /);
    expect(a?.position).toMatchObject({ x: w, z: 0 });
  });
  it('a second-axis snap that would leave the joined neighbour is not added', () => {
    const p = project([
      { tpl: 'base-door', x: 1000, z: 600 },
      { tpl: 'base-door', x: 2000 },
    ]);
    const pm = model(p);
    const w = pm.pieces[1].bounds.w;
    // B's right side 40 mm from A's left side, overlapping A by 28 mm in depth; its back 50 mm from the back wall.
    const r = snapDrag(p, pm.pieces, p.items[1].id, 1000 - w - 40 - 2000, 50)!;
    expect(r.snap?.label).toMatch(/^Joins /);
    expect(r.snap?.label).not.toMatch(/back wall/);
    expect(r.position).toMatchObject({ x: 1000 - w, z: 50 });
  });
  it('nothing near: the drop is the stepped drop and the hint says so', () => {
    const p = project([{ tpl: 'base-door', x: 1000, z: 1000 }], room('rectangle'));
    const r = snapDrag(p, model(p).pieces, p.items[0].id, 203, 207)!;
    expect(r.snap).toBeNull();
    expect(r.position).toEqual(dragPosition(p.items[0], 203, 207));
    expect(r.hint).toBe('Nothing to snap to within 60 mm.');
  });
  it('a piece resting on the dragged one is not a neighbour', () => {
    const p = project([
      { tpl: 'base-door', x: 0 },
      { tpl: 'base-door', x: 2000 },
    ]);
    p.items[1] = {
      ...p.items[1],
      placement: { kind: 'above', baseId: p.items[0].id, gap: 0, offsetX: 600 },
    };
    const pm = model(p);
    const r = snapDrag(p, pm.pieces, p.items[0].id, 30, 0)!;
    expect(r.snap?.label ?? '').not.toMatch(/Joins/);
  });
  it('never throws on odd input', () => {
    const p = project([{ tpl: 'base-door', x: 0 }], room('rectangle'));
    const pm = model(p);
    expect(snapDrag(p, pm.pieces, 'missing', 0, 0)).toBeNull();
    expect(() => snapDrag(p, pm.pieces, p.items[0].id, Number.NaN, Infinity)).not.toThrow();
    const flat = {
      ...p,
      room: {
        ...p.room!,
        outline: [
          [0, 0],
          [10, 0],
        ] as Room['outline'],
      },
    };
    expect(() => snapDrag(flat, pm.pieces, p.items[0].id, 5, 5)).not.toThrow();
  });
});

describe('snap off or Alt held (ADR-070)', () => {
  beforeEach(() => {
    st().openProject(newProject('Snap'));
    st().addPiece(t('base-door'));
    st().stopPlacing();
    st().addPiece(t('base-door'));
    st().stopPlacing();
  });
  it('the drop is exactly the ADR-065 drop; with snap on it is flush, in one undo step', () => {
    const p = st().project!;
    const pm = st().projectModel!;
    const [a, b] = p.items;
    const w = pm.pieces[0].bounds.w;
    // b starts flush at x = w; drag it 1000 mm away and back to 35 mm from a.
    st().moveItemBy(b.id, 1000, 0);
    const p2 = st().project!;
    const dx = w + 35 - p2.items[1].position.x;
    const off = dropTarget(p2, st().projectModel!.pieces, b.id, dx, 0, false)!;
    expect(off.position).toEqual(dragPosition(p2.items[1], dx, 0));
    expect(off.snap).toBeNull();
    const on = dropTarget(p2, st().projectModel!.pieces, b.id, dx, 0, true)!;
    expect(on.position.x).toBe(w);
    const past = st().projectPast.length;
    st().moveItemBy(
      b.id,
      on.position.x - p2.items[1].position.x,
      on.position.z - p2.items[1].position.z,
      1,
    );
    expect(st().project!.items[1].position.x).toBe(w);
    expect(st().projectPast.length).toBe(past + 1);
    void a;
  });
});
