// Display-only 3D models move and turn in 3D Move mode (ADR-203, G-105): the 3D drag gives the plan's drop
// (`modelDrop` in drag3d over `modelPlace.modelDrop`), committed by the store's `dropModel` as one undo step; Turn 90°
// changes `rotationY` by ±90 keeping the model's centre (`turnModelItem`).
import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { templates } from '../src/core/design';
import { modelDrop } from '../src/core/drag3d';
import { makeModelItem, modelBox, turnModelItem, type ModelItem } from '../src/core/model3d';
import { modelDrop as planDrop } from '../src/core/modelPlace';
import { buildProjectModel, newProject, PROJECT_SCHEMA, type Project } from '../src/core/project';
import { useDesign } from '../src/store/designStore';

const st = () => useDesign.getState();
const t = (id: string) => templates.find((x) => x.id === id)!.create();
const fridge = (over: Partial<ModelItem> = {}): ModelItem => ({
  ...makeModelItem('m1', { id: 'mdl-1', name: 'Fridge', size: { w: 600, h: 1800, d: 650 } }, 2000),
  ...over,
});
const centre = (m: ModelItem) => {
  const b = modelBox(m);
  return { x: b.x + b.w / 2, z: b.z + b.d / 2 };
};

describe('modelDrop in 3D: the plan drop of a model (ADR-203, G-105)', () => {
  let p: Project;
  beforeEach(() => {
    st().openProject(newProject('Models'));
    st().addPiece(t('base-door'));
    st().stopPlacing();
    p = { ...st().project!, schemaVersion: PROJECT_SCHEMA, models: [fridge()] };
  });

  it('matches the plan drag by the same move, snap on and off, in whole mm', () => {
    const pieces = buildProjectModel(p).pieces;
    const from = { x: 2300.4, z: 300.6 };
    for (const [dx, dz] of [
      [0, 0],
      [12.6, -3.2],
      [-35, 40],
      [-512.4, 17.9],
      [900.5, 899.1],
    ])
      for (const snap of [true, false]) {
        const to = { x: from.x + dx, z: from.z + dz };
        const got = modelDrop(p, pieces, 'm1', from, to, snap)!;
        const plan = planDrop(p, pieces, 'm1', to.x - from.x, to.z - from.z, snap)!;
        expect(got.position).toEqual(plan.position);
        expect(got.box).toEqual(plan.box);
        expect(got.snap?.label ?? null).toBe(plan.snap);
        expect(Number.isInteger(got.position.x) && Number.isInteger(got.position.z)).toBe(true);
        if (!snap) {
          // Snap off (Alt): the 10 mm step from where it was, never a snap.
          expect(Math.abs((got.position.x - 2000) % 10)).toBe(0);
          expect(got.snap).toBeNull();
        }
      }
  });

  it('snaps to the piece beside it with Snap on; an unknown model gives null and nothing throws', () => {
    const pieces = buildProjectModel(p).pieces;
    const right = pieces[0].bounds.x + pieces[0].bounds.w;
    // Dragged left to within a few mm of the piece's right side.
    const from = { x: 2300, z: 300 };
    const to = { x: from.x - (2000 - right) + 7, z: 300 };
    const got = modelDrop(p, pieces, 'm1', from, to, true)!;
    expect(got.box.x).toBe(right);
    expect(got.snap?.label).toBeTruthy();
    expect(modelDrop(p, pieces, 'm1', from, to, false)!.box.x).not.toBe(right);
    expect(modelDrop(p, pieces, 'nope', from, to, true)).toBeNull();
    expect(() => modelDrop(p, pieces, 'm1', from, { x: NaN, z: Infinity }, true)).not.toThrow();
  });

  it('the store commits the drop as one undo step; undo puts it back', () => {
    st().updateProject(() => p);
    const past = st().projectPast.length;
    st().dropModel('m1', 400, 120, false);
    const m = st().project!.models![0];
    expect(m.position.x).toBe(2400);
    expect(m.position.z).toBe(120);
    expect(st().projectPast.length).toBe(past + 1);
    st().undoProject();
    expect(st().project!.models![0].position).toEqual(fridge().position);
    // A drop that does not move it makes no undo step.
    st().dropModel('m1', 0, 0, false);
    expect(st().projectPast.length).toBe(past);
  });
});

describe('Turn 90° for a model (ADR-203, G-105)', () => {
  it('changes rotationY by ±90 and keeps the centre; four turns and a turn back return it exactly', () => {
    const odd = fridge({ size: { w: 601, h: 1800, d: 650 } });
    for (const m of [fridge(), odd]) {
      const c = centre(m);
      const l = turnModelItem(m, 1);
      expect(l.rotationY).toBe(90);
      expect(turnModelItem(m, -1).rotationY).toBe(270);
      const b = modelBox(l);
      expect([b.w, b.d]).toEqual([m.size.d, m.size.w]);
      expect(Math.abs(centre(l).x - c.x)).toBeLessThanOrEqual(0.5);
      expect(Math.abs(centre(l).z - c.z)).toBeLessThanOrEqual(0.5);
      expect(Number.isInteger(l.position.x) && Number.isInteger(l.position.z)).toBe(true);
      expect(turnModelItem(l, -1)).toEqual(m);
      let r = m;
      for (let i = 0; i < 4; i++) r = turnModelItem(r, 1);
      expect(r).toEqual(m);
      // Height, size and name are unchanged.
      expect({ ...l, rotationY: 0, position: m.position }).toEqual(m);
    }
  });

  it('a model with a front fix turns from its total turn', () => {
    const m = fridge({ front: 'left' });
    const l = turnModelItem(m, 1);
    expect(l.rotationY).toBe(90);
    expect(l.front).toBe('left');
    expect(Math.abs(centre(l).x - centre(m).x)).toBeLessThanOrEqual(0.5);
  });

  it('the store turns a model as one undo step', () => {
    st().openProject({ ...newProject('Turn'), schemaVersion: PROJECT_SCHEMA, models: [fridge()] });
    st().turnModel('m1', 1);
    expect(st().project!.models![0].rotationY).toBe(90);
    expect(st().projectPast.length).toBe(1);
    st().turnModel('m1', -1);
    expect(st().project!.models![0]).toEqual(fridge());
    st().undoProject();
    expect(st().project!.models![0].rotationY).toBe(90);
    st().turnModel('nope', 1);
    expect(st().projectPast.length).toBe(1);
  });
});
