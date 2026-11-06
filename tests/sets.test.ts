// ADR-167: value sets, their duplicates, the room per set and save a set as a separate project.
import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { templates } from '../src/core/design';
import {
  buildProjectModel,
  makeItem,
  newProject,
  projectCutlist,
  refreshRunParts,
  requestKey,
  validateProject,
  type Project,
  type ProjectItem,
  type RunRequest,
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

describe('value sets (ADR-167)', () => {
  it('an empty set draws nothing; a complete set duplicates the members at the set origin with its values', () => {
    const { p, ids, varId } = bound();
    const added = addSet(p);
    let next = sync(added.project);
    expect(next.items).toHaveLength(3);
    expect(setComplete(next, next.variableSets![0])).toBe(false);
    expect(next.variableSets![0].origin).toEqual({ x: 3500, z: 0 });
    next = sync(updateSet(next, added.id, { values: { [varId]: '450' } }));
    const dups = next.items.filter((i) => i.set?.id === added.id);
    // The bound base and the wall cabinet above it (G-327), not the second base.
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

/**
 * `bound()` with both bases in one group (so both are set members), automatic run parts, a worktop asked for over the
 * two bases, a run handle on them and a sink on the first (ADR-175).
 */
function withRun(): { p: Project; ids: string[]; varId: string } {
  const b = bound();
  const g = groupItems(b.p, [b.ids[0], b.ids[1]]).project;
  const worktop: RunRequest = { kind: 'worktop', from: [b.ids[0], b.ids[1]], front: 30, side: 0 };
  // Bottoms under the sides, so the two bases can share a run plinth (ADR-054).
  const items = g.items.map((i) =>
    i.id === b.ids[0] || i.id === b.ids[1]
      ? ({
          ...i,
          design: {
            ...i.design,
            product: { ...i.design.product, params: { ...cab(i), bottom: 'under' } },
          },
        } as ProjectItem)
      : i,
  );
  const p: Project = {
    ...g,
    items,
    runSettings: { scribe: 0, auto: true },
    runRequests: [worktop],
    runHandles: [
      { id: 'rh1', from: [b.ids[0], b.ids[1]], handle: { kind: 'bar', holeSpacing: 128 } },
    ],
    sinks: [{ id: 'sk1', baseId: b.ids[0], w: 500, d: 400 }],
  };
  return { ...b, p: refreshRunParts(p) };
}
/** As the store commits: sets, then the run parts. */
const commit = (p: Project) => refreshRunParts(sync(p));
const dupIn = (p: Project, setId: string, of: string) =>
  p.items.find((i) => i.set?.id === setId && i.set.of === of)!.id;

describe('run requests, run handles and sinks per set (ADR-175)', () => {
  it('a complete set gets its own worktop, plinth, run handle and sink on its duplicates', () => {
    const { p, ids, varId } = withRun();
    const added = addSet(p);
    const next = commit(updateSet(added.project, added.id, { values: { [varId]: '450' } }));
    const d0 = dupIn(next, added.id, ids[0]),
      d1 = dupIn(next, added.id, ids[1]);
    expect(next.runRequests).toEqual([
      { kind: 'worktop', from: [ids[0], ids[1]], front: 30, side: 0 },
      { kind: 'worktop', from: [d0, d1], front: 30, side: 0 },
    ]);
    expect(next.runHandles).toHaveLength(2);
    const rh = next.runHandles![1];
    expect(rh).toMatchObject({ from: [d0, d1], handle: { kind: 'bar', holeSpacing: 128 } });
    expect(rh.id).not.toBe('rh1');
    expect(next.sinks).toHaveLength(2);
    expect(next.sinks![1]).toMatchObject({ baseId: d0, w: 500, d: 400 });
    expect(next.sinks![1].id).not.toBe('sk1');
    const parts = next.runParts ?? [];
    const worktops = parts.filter((rp) => rp.kind === 'worktop');
    expect(worktops.map((rp) => rp.key).sort()).toEqual(
      [requestKey(next.runRequests![0]), requestKey(next.runRequests![1])].sort(),
    );
    const plinths = parts.filter((rp) => rp.kind === 'plinth');
    expect(plinths.map((rp) => rp.from)).toEqual([
      [ids[0], ids[1]],
      [d0, d1],
    ]);
    expect(validateProject(next)).toEqual([]);
    const codes = buildProjectModel(next).diagnostics.map((d) => d.code);
    expect(codes).not.toContain('run-request');
    expect(sync(next)).toBe(next);
  });
  it('changing or deleting the set-1 run request changes or deletes the copy; syncing twice gives the same project', () => {
    const { p, ids, varId } = withRun();
    const added = addSet(p);
    let next = commit(updateSet(added.project, added.id, { values: { [varId]: '450' } }));
    const d0 = dupIn(next, added.id, ids[0]);
    const copyHandleId = next.runHandles![1].id;
    next = commit({
      ...next,
      runRequests: next.runRequests!.map((r) => (r.from[0] === ids[0] ? { ...r, front: 50 } : r)),
      runHandles: next.runHandles!.map((h) => (h.id === 'rh1' ? { ...h, height: 700 } : h)),
      sinks: next.sinks!.map((sk) => (sk.id === 'sk1' ? { ...sk, w: 600 } : sk)),
    });
    expect(next.runRequests![1]).toMatchObject({ from: [d0, expect.any(String)], front: 50 });
    // Updated in place: the copy keeps its id.
    expect(next.runHandles![1]).toMatchObject({ id: copyHandleId, height: 700 });
    expect(next.sinks![1]).toMatchObject({ baseId: d0, w: 600 });
    expect(sync(next)).toBe(next);
    expect(sync(sync(next))).toBe(next);
    // An edit of the copy is overwritten by set 1 (one way, ADR-167).
    next = commit({
      ...next,
      runRequests: next.runRequests!.map((r) => (r.from[0] === d0 ? { ...r, front: 10 } : r)),
    });
    expect(next.runRequests![1].front).toBe(50);
    next = commit({
      ...next,
      runRequests: next.runRequests!.filter((r) => r.from[0] !== ids[0]),
      runHandles: next.runHandles!.filter((h) => h.id !== 'rh1'),
      sinks: next.sinks!.filter((sk) => sk.id !== 'sk1'),
    });
    expect(next.runRequests).toEqual([]);
    expect(next.runHandles).toEqual([]);
    expect(next.sinks).toEqual([]);
    expect(sync(next)).toBe(next);
    // Removing the set takes its copies with it.
    const again = commit(updateSet(added.project, added.id, { values: { [varId]: '450' } }));
    const removed = removeSet(again, added.id);
    expect(removed.runRequests).toEqual([
      { kind: 'worktop', from: [ids[0], ids[1]], front: 30, side: 0 },
    ]);
    expect(removed.runHandles!.map((h) => h.id)).toEqual(['rh1']);
    expect(removed.sinks!.map((sk) => sk.id)).toEqual(['sk1']);
  });
  it('a run request on pieces that are not members is left alone; members only are copied', () => {
    const b = bound();
    // The second base is not a member (not bound, not grouped).
    const lone: RunRequest = { kind: 'worktop', from: [b.ids[1]] };
    const mixed: RunRequest = { kind: 'crown', from: [b.ids[2], 'gone'], height: 60 };
    const p: Project = {
      ...b.p,
      runRequests: [lone, mixed],
      sinks: [{ id: 'sk2', baseId: b.ids[1], w: 400, d: 400 }],
    };
    const added = addSet(p);
    const next = sync(updateSet(added.project, added.id, { values: { [b.varId]: '450' } }));
    const w = dupIn(next, added.id, b.ids[2]);
    expect(next.runRequests).toEqual([lone, mixed, { kind: 'crown', from: [w], height: 60 }]);
    expect(next.runRequests![0]).toBe(lone);
    expect(next.sinks).toEqual(p.sinks);
    expect(sync(next)).toBe(next);
  });
  it('an incomplete set gets no copies', () => {
    const { p } = withRun();
    const added = addSet(p);
    const next = commit(added.project);
    expect(next.items.some((i) => i.set)).toBe(false);
    expect(next.runRequests).toHaveLength(1);
    expect(next.runHandles).toHaveLength(1);
    expect(next.sinks).toHaveLength(1);
    expect(sync(next)).toBe(next);
  });
  it('the project cut list counts two worktops', () => {
    const { p, varId } = withRun();
    const added = addSet(p);
    const worktops = (q: Project) =>
      projectCutlist(q).filter((r) => r.labels.some((l) => /worktop/i.test(l)));
    expect(worktops(p).map((r) => r.quantity)).toEqual([1]);
    const next = commit(updateSet(added.project, added.id, { values: { [varId]: '450' } }));
    const rows = worktops(next);
    expect(rows.reduce((n, r) => n + r.quantity, 0)).toBe(2);
    // Set 2's worktop is set 1's request (30 mm front overhang, not a suggested 20) with the sink cut-out. Its length
    // differs by the left cover panel set 1 has no room for at x 0.
    for (const r of rows) {
      expect(r.width).toBe(560 + 30 + 18);
      // ADR-205: the sink note is in the row's notes column, not its label.
      expect(r.labels).toEqual(['Run: Worktop']);
      expect(r.drilling).toContain('sink cut-out 500 × 400 mm');
    }
  });
});

describe('store (ADR-167)', () => {
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

describe('seeded fuzz: random sets build with no throw (ADR-167)', () => {
  it('projects with sets', () => {
    let seed = 11;
    const rnd = () => {
      seed = (seed * 1664525 + 1013904223) % 4294967296;
      return seed / 4294967296;
    };
    const N = Math.ceil(Number(process.env.FUZZ_N ?? 3000) / 20);
    for (let n = 0; n < N; n++) {
      // Half with a worktop, run handle and sink on set 1 (ADR-175).
      const b = rnd() < 0.5 ? bound() : withRun();
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
