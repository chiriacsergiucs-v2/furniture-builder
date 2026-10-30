// ADR-164: value sets, their duplicates, the room per set and save a set as a separate project.
import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { templates } from '../src/core/design';
import {
  buildProjectModel,
  makeItem,
  newProject,
  validateProject,
  type Project,
  type ProjectItem,
} from '../src/core/project';
import { shapeOutline, type Room } from '../src/core/room';
import { groupItems } from '../src/core/selection';
import {
  addSet,
  projectFromSet,
  removeSet,
  roomAt,
  setComplete,
  setMembers,
  setRooms,
  syncSets,
  updateSet,
} from '../src/core/sets';
import { addVariable, applyBindings, setBinding } from '../src/core/variables';
import type { CabinetParams } from '../src/core/types';
import { loadProject } from '../src/persist/db';
import { useDesign } from '../src/store/designStore';

const tpl = (id: string) => templates.find((x) => x.id === id)!.create();
const st = () => useDesign.getState();
const cab = (i: { design: { product: { params: unknown } } }) =>
  i.design.product.params as CabinetParams;
const room: Room = {
  height: 2500,
  outline: shapeOutline('rectangle', {
    width: 3000,
    depth: 3000,
    cutWidth: 0,
    cutDepth: 0,
    offset: 0,
  }),
  features: [
    {
      id: 'o',
      kind: 'obstacle',
      wall: null,
      from: 0,
      width: 300,
      sill: 0,
      height: 1000,
      depth: 300,
      x: 2000,
      z: 2000,
      label: 'Pillar',
    },
  ],
};

/** Two base cabinets (the first bound on height) and a wall cabinet above the first, in a 3000-wide room. */
function bound(): { p: Project; ids: string[]; varId: string } {
  let p = newProject('Sets');
  const ids: string[] = [];
  for (const id of ['base-door', 'base-door', 'wall-cabinet']) {
    const it = makeItem(p, tpl(id));
    ids.push(it.id);
    p = { ...p, items: [...p.items, it] };
  }
  p = { ...p, room };
  const v = addVariable(p, 'bottom height', '400');
  p = setBinding(v.project, ids[0], 'height', 'bottom height');
  p = {
    ...p,
    items: p.items.map((i) =>
      i.id === ids[2]
        ? { ...i, placement: { kind: 'above', baseId: ids[0], gap: 500, offsetX: 0 } }
        : i,
    ),
  };
  return { p: applyBindings(p), ids, varId: v.id };
}
const sync = (p: Project) => applyBindings(syncSets(p));

describe('value sets (ADR-164)', () => {
  it('an empty set draws nothing; a complete set duplicates the members at the set origin with its values', () => {
    const { p, ids, varId } = bound();
    const added = addSet(p);
    let next = sync(added.project);
    expect(next.items).toHaveLength(3);
    expect(setComplete(next, next.variableSets![0])).toBe(false);
    expect(next.variableSets![0].origin).toEqual({ x: 3500, z: 0 });
    next = sync(updateSet(next, added.id, { values: { [varId]: '450' } }));
    const dups = next.items.filter((i) => i.set?.id === added.id);
    // The bound base and the wall cabinet above it (G-321), not the second base.
    expect(dups.map((d) => d.set!.of).sort()).toEqual([ids[0], ids[2]].sort());
    const base = dups.find((d) => d.set!.of === ids[0])!;
    const above = dups.find((d) => d.set!.of === ids[2])!;
    expect(cab(base).height).toBe(450);
    expect(cab(next.items[0]).height).toBe(400);
    expect(base.position.x).toBe(next.items[0].position.x + 3500);
    expect(above.placement).toMatchObject({ kind: 'above', baseId: base.id });
    expect(base.linkId).toBeUndefined();
    expect(validateProject(next)).toEqual([]);
    expect(sync(next)).toBe(next);
  });
  it('grouped pieces join the set and the group is mirrored', () => {
    const { p, ids, varId } = bound();
    const g = groupItems(p, [ids[0], ids[1]]);
    const added = addSet(g.project);
    const next = sync(updateSet(added.project, added.id, { values: { [varId]: '1' } }));
    expect(setMembers(next).has(ids[1])).toBe(true);
    expect(next.items.filter((i) => i.set).length).toBe(3);
    expect(next.groups!.length).toBe(2);
  });
  it('design edits go one way: the original reaches the duplicate, the duplicate is overwritten', () => {
    const { p, ids, varId } = bound();
    const added = addSet(p);
    let next = sync(updateSet(added.project, added.id, { values: { [varId]: '450' } }));
    const dupId = next.items.find((i) => i.set?.of === ids[0])!.id;
    const widen = (q: Project, id: string, width: number): Project => ({
      ...q,
      items: q.items.map((i) =>
        i.id === id
          ? ({
              ...i,
              design: {
                ...i.design,
                product: {
                  ...i.design.product,
                  params: { ...(i.design.product.params as CabinetParams), width },
                },
              },
            } as ProjectItem)
          : i,
      ),
    });
    next = sync(widen(next, ids[0], 900));
    const dup = () => next.items.find((i) => i.id === dupId)!;
    expect(cab(dup()).width).toBe(900);
    expect(cab(dup()).height).toBe(450);
    next = sync(widen(next, dupId, 500));
    expect(cab(dup()).width).toBe(900);
    expect(cab(next.items[0]).width).toBe(900);
  });
  it('unbinding removes the duplicates; removing the set removes its pieces', () => {
    const { p, ids, varId } = bound();
    const added = addSet(p);
    let next = sync(updateSet(added.project, added.id, { values: { [varId]: '450' } }));
    expect(next.items).toHaveLength(5);
    next = sync(setBinding(next, ids[0], 'height', null));
    expect(next.items).toHaveLength(3);
    next = sync(setBinding(next, ids[0], 'height', 'bottom height'));
    expect(next.items).toHaveLength(5);
    next = removeSet(next, added.id);
    expect(next.items).toHaveLength(3);
    expect(next.variableSets).toBeUndefined();
  });
  it('the room is drawn and checked at the set origin', () => {
    const { p, varId } = bound();
    const added = addSet(p);
    const next = sync(updateSet(added.project, added.id, { values: { [varId]: '450' } }));
    const rooms = setRooms(next);
    expect(rooms).toHaveLength(1);
    expect(rooms[0].room.outline[0]).toEqual([3500, 0]);
    expect(rooms[0].room.features[0]).toMatchObject({ x: 5500, z: 2000 });
    expect(roomAt(room, { x: 0, z: 0 })).toBe(room);
    const model = buildProjectModel(next);
    // No piece is outside its room: the duplicates sit inside the translated room.
    expect(model.diagnostics.filter((d) => d.code === 'outside-room')).toEqual([]);
    // Move the set onto set 1: the duplicates overlap the originals, as any two pieces would.
    const moved = sync(updateSet(next, added.id, { origin: { x: 300, z: 0 } }));
    const dup = moved.items.find((i) => i.set)!;
    expect(dup.position.x).toBe(next.items.find((i) => i.set)!.position.x - 3200);
    const m2 = buildProjectModel(moved);
    expect(m2.diagnostics.some((d) => d.code === 'pieces-overlap')).toBe(true);
  });
  it('an incomplete set with pieces warns; set values that fail are errors', () => {
    const { p, varId } = bound();
    const added = addSet(p);
    let next = sync(updateSet(added.project, added.id, { values: { [varId]: '450' } }));
    next = sync(updateSet(next, added.id, { values: { [varId]: '' } }));
    expect(next.items).toHaveLength(5);
    const codes = buildProjectModel(next).diagnostics.map((d) => d.code);
    expect(codes).toContain('set-incomplete');
    next = sync(updateSet(next, added.id, { values: { [varId]: 'x / 0' } }));
    expect(buildProjectModel(next).diagnostics.map((d) => d.code)).toContain('variable-problem');
  });
  it('save as separate project: new ids, pieces at the originals’ positions, the set’s values as set 1', () => {
    const { p, ids, varId } = bound();
    const added = addSet(p);
    const next = sync(updateSet(added.project, added.id, { values: { [varId]: '450' } }));
    const saved = projectFromSet(next, added.id)!;
    expect(saved).not.toBeNull();
    expect(saved.id).not.toBe(next.id);
    expect(saved.name).toBe('Sets — Set 2');
    expect(saved.items).toHaveLength(3);
    expect(saved.items.every((i) => !i.set && !ids.includes(i.id))).toBe(true);
    expect(saved.variableSets).toBeUndefined();
    expect(saved.variables![0].expr).toBe('450');
    expect(saved.room).toEqual(room);
    const base = saved.items[0];
    expect(cab(base).height).toBe(450);
    expect(base.position).toEqual(next.items[0].position);
    const above = saved.items[2];
    expect(above.placement).toMatchObject({ kind: 'above', baseId: base.id });
    expect(validateProject(saved)).toEqual([]);
    expect(applyBindings(saved)).toBe(saved);
    expect(projectFromSet(next, 'nope')).toBeNull();
  });
});

describe('store (ADR-164)', () => {
  beforeEach(() => st().openProject(bound().p));
  it('addVariableSet, updateVariableSet and removeVariableSet are one undo step each', async () => {
    const varId = st().project!.variables![0].id;
    const setId = st().addVariableSet();
    expect(st().project!.items).toHaveLength(3);
    st().updateVariableSet(setId, { values: { [varId]: '450' } });
    expect(st().project!.items).toHaveLength(5);
    // The fresh duplicate takes the set's value in the same step.
    expect(cab(st().project!.items.find((i) => i.set)!).height).toBe(450);
    const saved = projectFromSet(st().project!, setId)!;
    const { saveProject } = await import('../src/persist/db');
    await saveProject(saved);
    expect((await loadProject(saved.id))?.items).toHaveLength(3);
    st().removeVariableSet(setId);
    expect(st().project!.items).toHaveLength(3);
    st().undoProject();
    expect(st().project!.items).toHaveLength(5);
    st().undoProject();
    expect(st().project!.items).toHaveLength(3);
  });
  it('a duplicate is not drilled for inside edits', () => {
    const varId = st().project!.variables![0].id;
    const setId = st().addVariableSet();
    st().updateVariableSet(setId, { values: { [varId]: '450' } });
    const dup = st().project!.items.find((i) => i.set)!;
    st().selectItem(dup.id);
    expect(st().drillItemId).toBeNull();
    st().selectItem(st().project!.items[0].id);
    expect(st().drillItemId).toBe(st().project!.items[0].id);
  });
});

describe('seeded fuzz: random sets build with no throw (ADR-164)', () => {
  it('projects with sets', () => {
    let seed = 11;
    const rnd = () => {
      seed = (seed * 1664525 + 1013904223) % 4294967296;
      return seed / 4294967296;
    };
    const N = Math.ceil(Number(process.env.FUZZ_N ?? 3000) / 20);
    for (let n = 0; n < N; n++) {
      const b = bound();
      let p = b.p;
      const varId = b.varId;
      const k = 1 + Math.floor(rnd() * 3);
      for (let s = 0; s < k; s++) {
        const a = addSet(p);
        p = updateSet(a.project, a.id, {
          values: rnd() < 0.8 ? { [varId]: String(100 + Math.floor(rnd() * 800)) } : {},
          origin: { x: Math.floor(rnd() * 8000), z: Math.floor(rnd() * 3000) },
        });
        p = sync(p);
      }
      expect(validateProject(p)).toEqual([]);
      buildProjectModel(p);
      for (const s of p.variableSets ?? []) projectFromSet(p, s.id);
      expect(sync(p)).toBe(p);
    }
  });
});
