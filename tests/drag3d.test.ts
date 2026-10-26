import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { templates } from '../src/core/design';
import { turnAboutCentre } from '../src/core/arrange';
import { floorDrop, floorPoint, landingY, MAX_REACH } from '../src/core/drag3d';
import { buildProjectModel, newProject } from '../src/core/project';
import { dropTarget } from '../src/core/snap';
import { useDesign } from '../src/store/designStore';

const t = (id: string) => templates.find((x) => x.id === id)!.create();
const st = () => useDesign.getState();

describe('floorPoint: the pointer ray on the floor plane (ADR-093)', () => {
  it('meets the horizontal plane at the given height', () => {
    // From 1000 mm up, looking 45° down along +x: lands 1000 mm further on the floor.
    expect(floorPoint({ origin: [0, 1000, 500], dir: [1, -1, 0] }, 0)).toEqual({ x: 1000, z: 500 });
    // The plane at a wall unit's base height.
    expect(floorPoint({ origin: [0, 2000, 0], dir: [0, -1, 2] }, 1500)).toEqual({ x: 0, z: 1000 });
  });
  it('is null along, away from, or too far over the plane, and never throws', () => {
    expect(floorPoint({ origin: [0, 1000, 0], dir: [1, 0, 0] }, 0)).toBeNull();
    expect(floorPoint({ origin: [0, 1000, 0], dir: [0, 1, 1] }, 0)).toBeNull();
    expect(floorPoint({ origin: [0, 1000, 0], dir: [1, -0.001, 0] }, 0)).toBeNull();
    expect(floorPoint({ origin: [0, 1000, 0], dir: [1, -0.001, 0] }, 0, 2_000_000)).not.toBeNull();
    expect(floorPoint({ origin: [0, 1000, 0], dir: [0, 0, 0] }, 0)).toBeNull();
    expect(floorPoint({ origin: [Number.NaN, 1000, 0], dir: [0, -1, 0] }, 0)).toBeNull();
    expect(MAX_REACH).toBeGreaterThan(10_000);
  });
});

describe('floorDrop: a 3D drag gives the Plan’s drop (ADR-093, ADR-065, ADR-070)', () => {
  let p = newProject('3D');
  beforeEach(() => {
    st().openProject(newProject('3D'));
    st().addPiece(t('base-door'));
    st().stopPlacing();
    st().addPiece(t('base-door'));
    st().stopPlacing();
    p = st().project!;
  });
  it('matches a Plan drag by the same move, snap on and off (Alt), in whole mm', () => {
    const pieces = buildProjectModel(p).pieces;
    const id = p.items[1].id;
    const from = { x: 1234.4, z: 321.7 };
    for (const [dx, dz] of [
      [0, 0],
      [12.6, -3.2],
      [-35, 40],
      [-300.4, 17.9],
      [512.5, 899.1],
      [-4000, 2500],
    ])
      for (const snap of [true, false]) {
        const to = { x: from.x + dx, z: from.z + dz };
        const got = floorDrop(p, pieces, id, from, to, snap)!;
        const plan = dropTarget(p, pieces, id, to.x - from.x, to.z - from.z, snap)!;
        expect(got).toEqual(plan);
        expect(Number.isInteger(got.position.x) && Number.isInteger(got.position.z)).toBe(true);
        // Snap off (or Alt): the ADR-065 10 mm step, never a snap.
        if (!snap) {
          expect(Math.abs((got.position.x - p.items[1].position.x) % 10)).toBe(0);
          expect(got.snap).toBeNull();
        }
      }
  });
  it('snaps to a neighbour’s side with Snap on, not with Alt', () => {
    const pieces = buildProjectModel(p).pieces;
    const [a, b] = pieces;
    const id = b.item.id;
    // Drag the second piece to 25 mm right of the first one's right side.
    const gap = a.bounds.x + a.bounds.w + 25 - b.bounds.x;
    const from = { x: 0, z: 0 };
    const to = { x: gap, z: 0 };
    const snapped = floorDrop(p, pieces, id, from, to, true)!;
    expect(snapped.snap?.label).toMatch(/joins/i);
    expect(snapped.box.x).toBe(a.bounds.x + a.bounds.w);
    const free = floorDrop(p, pieces, id, from, to, false)!;
    expect(free.snap).toBeNull();
    expect(free.box.x).not.toBe(a.bounds.x + a.bounds.w);
  });
  it('dropItemAt commits that drop as one undo step; undo puts it back', () => {
    const id = p.items[1].id;
    const pieces = st().projectModel!.pieces;
    const past = st().projectPast.length;
    const from = { x: 100, z: 100 };
    const to = { x: 1337, z: 612 };
    const want = floorDrop(p, pieces, id, from, to, false)!.position;
    st().dropItemAt(id, from, to, false);
    expect(st().project!.items[1].position).toEqual(want);
    expect(st().projectPast.length).toBe(past + 1);
    st().undoProject();
    expect(st().project).toBe(p);
    // With Snap on, it lands where the snapped preview showed.
    const snapTo = floorDrop(p, pieces, id, from, { x: 160, z: 100 }, true)!.position;
    st().dropItemAt(id, from, { x: 160, z: 100 }, true);
    expect(st().project!.items[1].position).toEqual(snapTo);
  });
  it('a drag that does not move the piece makes no undo step', () => {
    const past = st().projectPast.length;
    st().dropItemAt(p.items[1].id, { x: 5, z: 5 }, { x: 7, z: 3 }, false);
    expect(st().projectPast.length).toBe(past);
    expect(st().project).toBe(p);
  });
});

describe('turning in 3D (ADR-093, ADR-069)', () => {
  beforeEach(() => {
    st().openProject(newProject('Turn'));
    st().addPiece(t('base-door'));
    st().stopPlacing();
  });
  it('is the ADR-069 turn about the centre, one undo step each way', () => {
    const p = st().project!;
    const id = p.items[0].id;
    const past = st().projectPast.length;
    // The 3D Turn buttons and R / Shift+R call the store's turnItem.
    st().turnItem(id, 1);
    expect(st().project!.items).toEqual(turnAboutCentre(p, id, 1).items);
    expect(st().projectPast.length).toBe(past + 1);
    st().undoProject();
    expect(st().project).toBe(p);
    st().turnItem(id, -1);
    expect(st().project!.items).toEqual(turnAboutCentre(p, id, -1).items);
    expect(st().project!.items[0].rotationY).toBe(270);
    expect(st().projectPast.length).toBe(past + 1);
  });
});

describe('landingY: the preview’s height (ADR-093, ADR-065 lift-off)', () => {
  const base = { position: { x: 0, y: 870, z: 0 } };
  it('keeps the height, or lifts a piece off its base to the floor or the wall', () => {
    const floor = { ...base, design: t('base-door'), placement: { kind: 'floor' } };
    expect(landingY(floor as never)).toBe(870);
    const on = { ...base, design: t('base-door'), placement: { kind: 'above', baseId: 'x' } };
    expect(landingY(on as never)).toBe(0);
    const wall = { ...base, design: t('wall-cabinet'), placement: { kind: 'above', baseId: 'x' } };
    expect(landingY(wall as never)).toBe(870);
  });
});
