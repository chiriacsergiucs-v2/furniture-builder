// ADR-168: stored connections between touching pieces — check, automatic connect on snap, disconnect when parted,
// move together, the broken warning, validation and sets.
import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  carryUnits,
  connect,
  connectedTo,
  connectionCheck,
  connectionSeams,
  disconnect,
  isConnected,
  movingSet,
  pruneConnections,
  settleConnections,
} from '../src/core/connections';
import { templates } from '../src/core/design';
import { describeChange } from '../src/core/history';
import {
  buildProjectModel,
  makeItem,
  moveBy,
  newProject,
  PROJECT_SCHEMA,
  removeProjectItem,
  validateProject,
  type Project,
} from '../src/core/project';
import { moveItems } from '../src/core/selection';
import { addSet, syncSets, updateSet } from '../src/core/sets';
import { tryTurn } from '../src/core/arrange';
import { addVariable, applyBindings, setBinding } from '../src/core/variables';
import { useDesign } from '../src/store/designStore';

const t = (id: string) => templates.find((x) => x.id === id)!.create();
/** Pieces placed one after the other, each at the previous one's right edge (`makeItem`). */
function row(...ids: string[]): Project {
  let p = newProject('Connections');
  for (const id of ids) p = { ...p, items: [...p.items, makeItem(p, t(id))] };
  return p;
}
const ids = (p: Project) => p.items.map((i) => i.id);
const pos = (p: Project, id: string) => p.items.find((i) => i.id === id)!.position;
const codes = (p: Project) => buildProjectModel(p).diagnostics.map((d) => d.code);
const errors = (p: Project) =>
  buildProjectModel(p).diagnostics.filter((d) => d.severity === 'error');
const st = () => useDesign.getState();

describe('connectionCheck (ADR-168)', () => {
  it('accepts two base units standing side by side and names the reason otherwise', () => {
    const p = row('base-door', 'base-door');
    const [a, b] = ids(p);
    expect(connectionCheck(p, a, b).reason).toBeNull();
    expect(connectionCheck(p, a, a).reason).toMatch(/itself/);
    expect(connectionCheck(p, a, 'nope').reason).toMatch(/removed/);
    const apart = moveBy(p, b, 100, 0, 1).project;
    expect(connectionCheck(apart, a, b).reason).toMatch(/side by side/);
  });
  it('a refusing compatibility rule (ADR-100) refuses the pair: a wall unit beside a base unit', () => {
    const p = row('base-door', 'wall-cabinet');
    const [a, b] = ids(p);
    // Put the wall unit on the floor next to the base so the boxes touch; the rule still refuses the join.
    const floored: Project = {
      ...p,
      items: p.items.map((i) =>
        i.id === b ? { ...i, position: { ...i.position, y: 0 }, placement: undefined } : i,
      ),
    };
    const r = connectionCheck(floored, a, b).reason;
    expect(r).not.toBeNull();
  });
});

describe('connect, disconnect, prune and settle (ADR-168)', () => {
  it('connect is idempotent; disconnect removes; a removed piece prunes its connection', () => {
    const p = row('base-door', 'base-door', 'base-door');
    const [a, b, c] = ids(p);
    const one = connect(p, a, b);
    expect(connect(one, b, a)).toBe(one);
    expect(one.connections).toHaveLength(1);
    expect(isConnected(one, b, a)).toBe(true);
    expect(connectedTo(one, a)).toEqual([b]);
    expect(disconnect(one, a, b).connections).toBeUndefined();
    expect(disconnect(one, a, c)).toBe(one);
    expect(removeProjectItem(one, b).connections).toBeUndefined();
    expect(pruneConnections(one)).toBe(one);
    const stale: Project = {
      ...one,
      connections: [...one.connections!, { id: 'x', itemIds: [a, 'gone'] }],
    };
    expect(pruneConnections(stale).connections).toHaveLength(1);
    expect(validateProject(one)).toEqual([]);
  });
  it('a snapped drop connects valid touching neighbours; a drop that parts them disconnects; unsnapped adds none', () => {
    const p = row('base-door', 'base-door', 'base-door');
    const [a, b, c] = ids(p);
    const snapped = settleConnections(p, [b], true);
    expect(isConnected(snapped, a, b)).toBe(true);
    expect(isConnected(snapped, b, c)).toBe(true);
    expect(isConnected(snapped, a, c)).toBe(false);
    expect(settleConnections(p, [b], false)).toBe(p);
    // Dragging c away alone: its connection goes, a–b stays.
    const apart = moveBy(snapped, c, 200, 0, 1).project;
    const settled = settleConnections(apart, [c], false);
    expect(isConnected(settled, b, c)).toBe(false);
    expect(isConnected(settled, a, b)).toBe(true);
    expect(settleConnections(settled, [c], false)).toBe(settled);
  });
});

describe('connected pieces move together (ADR-168)', () => {
  it('movingSet reaches through connections and groups; carryUnits carries the neighbour', () => {
    const base = row('base-door', 'base-door', 'base-door');
    const [a, b, c] = ids(base);
    const joined = connect(connect(base, a, b), b, c);
    expect(movingSet(joined, [a])).toEqual([a, b, c]);
    expect(movingSet(joined, [a], false)).toEqual([a]);
    const moved = moveItems(joined, movingSet(joined, [a]), 50, 0).project;
    expect(pos(moved, c).x - pos(joined, c).x).toBe(50);
    // A change that moved only `a` (typed) is carried to b and c by carryUnits.
    const typed = moveBy(joined, a, 30, 0, 1).project;
    const carried = carryUnits(joined, typed, [a]);
    expect(carried.reason).toBeUndefined();
    expect(pos(carried.project, b).x - pos(joined, b).x).toBe(30);
    expect(carried.project.groups).toBeUndefined();
    // Every connection still holds after the move: no warning.
    expect(codes(carried.project)).not.toContain('connection-broken');
  });
});

describe('the broken warning (ADR-168, ADR-008)', () => {
  it('a resized or parted pair warns, never errors; touching again clears it', () => {
    const base = row('base-door', 'base-door');
    const [a, b] = ids(base);
    const p = connect(base, a, b);
    expect(codes(p)).not.toContain('connection-broken');
    const parted = moveBy(p, b, 100, 0, 1).project;
    expect(codes(parted)).toContain('connection-broken');
    expect(errors(parted)).toEqual([]);
    const back = moveBy(parted, b, -100, 0, 1).project;
    expect(codes(back)).not.toContain('connection-broken');
    const wider = {
      ...p,
      items: p.items.map((i) =>
        i.id === a && i.design.product.kind === 'cabinet'
          ? {
              ...i,
              design: {
                ...i.design,
                product: {
                  ...i.design.product,
                  params: { ...i.design.product.params, width: i.design.product.params.width - 10 },
                },
              },
            }
          : i,
      ),
    } as Project;
    expect(codes(wider)).toContain('connection-broken');
    // A quarter turn of one member parts the pair too (the other keeps its place).
    const turned = tryTurn(p, a, 1).project;
    expect(codes(turned)).toContain('connection-broken');
    expect(errors(turned)).toEqual([]);
  });
});

describe('connectionSeams (ADR-179)', () => {
  /** The plan tick as ConnectionTicks worked it out in UI code before ADR-179, from the two pieces' bounds. */
  function oldTick(p: Project, c: { itemIds: [string, string] }, half: number) {
    const pieces = buildProjectModel(p).pieces;
    const A = pieces.find((x) => x.item.id === c.itemIds[0])!.bounds;
    const B = pieces.find((x) => x.item.id === c.itemIds[1])!.bounds;
    if (A.x + A.w === B.x || B.x + B.w === A.x) {
      const x = A.x + A.w === B.x ? B.x : A.x;
      const zm = (Math.max(A.z, B.z) + Math.min(A.z + A.d, B.z + B.d)) / 2;
      return [x - half, zm, x + half, zm];
    }
    const z = A.z + A.d === B.z ? B.z : A.z;
    const xm = (Math.max(A.x, B.x) + Math.min(A.x + A.w, B.x + B.w)) / 2;
    return [xm, z - half, xm, z + half];
  }
  /** The plan tick drawn from a seam (ConnectionTicks since ADR-179). */
  function newTick(s: ReturnType<typeof connectionSeams>[number], half: number) {
    const xm = (s.x1 + s.x2) / 2,
      zm = (s.z1 + s.z2) / 2;
    return s.x1 === s.x2 ? [xm - half, zm, xm + half, zm] : [xm, zm - half, xm, zm + half];
  }

  it('one seam per holding connection, at the shared edge, in integer mm, with its height and front end', () => {
    const base = row('base-door', 'base-door', 'base-door');
    const [a, b, c] = ids(base);
    const p = connect(connect(base, a, b), b, c);
    const pieces = buildProjectModel(p).pieces;
    const seams = connectionSeams(p, pieces);
    expect(seams.map((s) => s.id)).toEqual(p.connections!.map((x) => x.id));
    const A = pieces.find((x) => x.item.id === a)!.bounds;
    const B = pieces.find((x) => x.item.id === b)!.bounds;
    const s = seams[0];
    expect(s.itemIds).toEqual([a, b]);
    expect(s.x1).toBe(A.x + A.w);
    expect(s.x2).toBe(B.x);
    expect([s.z1, s.z2]).toEqual([Math.max(A.z, B.z), Math.min(A.z + A.d, B.z + B.d)]);
    expect([s.y1, s.y2]).toEqual([Math.max(A.y, B.y), Math.min(A.y + A.h, B.y + B.h)]);
    // Against the back wall the front faces +z: the front end is the seam's larger z.
    expect(s.front).toEqual([s.x1, s.z2]);
    for (const x of seams)
      for (const v of [x.x1, x.x2, x.z1, x.z2, x.y1, x.y2, ...x.front])
        expect(Number.isInteger(v)).toBe(true);
  });
  it('a broken connection (parted, or one piece removed from the pieces) has no seam; none without connections', () => {
    const base = row('base-door', 'base-door');
    const [a, b] = ids(base);
    expect(connectionSeams(base, buildProjectModel(base).pieces)).toEqual([]);
    const p = connect(base, a, b);
    const parted = moveBy(p, b, 100, 0, 1).project;
    expect(parted.connections).toHaveLength(1);
    expect(connectionSeams(parted, buildProjectModel(parted).pieces)).toEqual([]);
    const pieces = buildProjectModel(p).pieces;
    expect(connectionSeams(p, pieces.slice(0, 1))).toEqual([]);
  });
  it("the plan's ticks are unchanged: a tick from the seam equals the old tick from the bounds", () => {
    const base = row('base-door', 'base-door', 'base-door');
    const [a, b, c] = ids(base);
    let p = connect(connect(base, a, b), b, c);
    // Different depths and a forward offset still touch side by side.
    p = moveBy(p, c, 0, 40, 1).project;
    const pieces = buildProjectModel(p).pieces;
    const seams = connectionSeams(p, pieces);
    expect(seams.length).toBeGreaterThan(0);
    for (const half of [6, 13.5])
      for (const s of seams) {
        const conn = p.connections!.find((x) => x.id === s.id)!;
        expect(newTick(s, half)).toEqual(oldTick(p, conn, half));
      }
  });
});

describe('validation and schema (ADR-168, ADR-011)', () => {
  it('schemaVersion 18 validates pairs; older projects load unchanged; bad pairs are refused', () => {
    expect(PROJECT_SCHEMA).toBe(20);
    const p = row('base-door', 'base-door');
    const [a, b] = ids(p);
    const old = { ...p, schemaVersion: 17 as const };
    expect(validateProject(old)).toEqual([]);
    expect(validateProject({ ...old, connections: [{ id: 'c', itemIds: [a, b] }] })).not.toEqual(
      [],
    );
    const ok = connect(p, a, b);
    expect(validateProject(ok)).toEqual([]);
    const bad = (connections: unknown) => validateProject({ ...p, connections } as Project);
    expect(bad([{ id: 'c', itemIds: [a, a] }])).toContain('Invalid connection');
    expect(bad([{ id: 'c', itemIds: [a, 'x'] }])).toContain('Invalid connection');
    expect(bad([{ id: 'c', itemIds: [a] }])).toContain('Invalid connection');
    expect(
      bad([
        { id: 'c', itemIds: [a, b] },
        { id: 'd', itemIds: [b, a] },
      ]),
    ).toContain('Invalid connection');
    expect(bad('no')).toContain('Invalid connections');
  });
});

describe('value sets copy connections (ADR-168, ADR-167)', () => {
  it('a set-1 connection is copied to each set as a connection between the duplicates', () => {
    let p = row('base-door', 'base-door');
    const [a, b] = ids(p);
    const v = addVariable(p, 'h', '720');
    p = v.project;
    p = setBinding(p, a, 'height', 'h');
    p = setBinding(p, b, 'height', 'h');
    p = applyBindings(connect(p, a, b));
    const s = addSet(p);
    p = syncSets(updateSet(s.project, s.id, { values: { [v.id]: '600' } }));
    expect(validateProject(p)).toEqual([]);
    const dups = p.items.filter((i) => i.set);
    expect(dups).toHaveLength(2);
    expect(isConnected(p, dups[0].id, dups[1].id)).toBe(true);
    expect(p.connections).toHaveLength(2);
    expect(syncSets(p)).toBe(p);
    expect(codes(p)).not.toContain('connection-broken');
  });
});

describe('store (ADR-168)', () => {
  beforeEach(() => st().openProject(row('base-door', 'base-door', 'base-door')));
  it('a snapped drop connects as part of the move step; Alt moves alone; undo names', () => {
    const [a, b, c] = ids(st().project!);
    st().moveItemBy(b, 0, 0, 1, { snapped: true });
    // No move happened: nothing to settle in a step that did not commit.
    expect(st().project!.connections).toBeUndefined();
    st().moveItemBy(c, 10, 0, 1, { snapped: true });
    st().moveItemBy(c, -10, 0, 1, { snapped: true });
    expect(isConnected(st().project!, b, c)).toBe(true);
    expect(st().projectPastNames.at(-1)).toMatch(/^Move/);
    // Alone: a moves without b; a connected neighbour moves along otherwise.
    st().selectItems([a, b]);
    st().setConnected(true);
    expect(st().projectPastNames.at(-1)).toBe('Connect');
    const before = st().project!;
    st().moveItemBy(a, -100, 0, 1, { alone: true });
    expect(pos(st().project!, b)).toEqual(pos(before, b));
    expect(isConnected(st().project!, a, b)).toBe(false);
    st().undoProject();
    st().moveItemBy(a, -100, 0, 1);
    expect(pos(st().project!, b).x - pos(before, b).x).toBe(-100);
    expect(pos(st().project!, c).x - pos(before, c).x).toBe(-100);
    expect(isConnected(st().project!, a, b)).toBe(true);
    st().selectItems([a, b]);
    st().setConnected(false);
    expect(st().projectPastNames.at(-1)).toBe('Disconnect');
    expect(isConnected(st().project!, a, b)).toBe(false);
    expect(describeChange(before, disconnect(before, a, b))).toBe('Disconnect');
  });
  it('a 3D Move drop goes through the same path: snapped connects, Alt alone parts (ADR-093, ADR-168)', () => {
    const [a, b, c] = ids(st().project!);
    // Moved 300 mm away, then dragged back to 10 mm short: the snap puts it against b and connects.
    st().moveItemBy(c, 300, 0, 1);
    const from = { x: pos(st().project!, c).x, z: pos(st().project!, c).z };
    expect(st().dropItemAt(c, from, { x: from.x - 290, z: from.z }, true)).toBeNull();
    expect(pos(st().project!, c).x).toBe(from.x - 300);
    expect(isConnected(st().project!, b, c)).toBe(true);
    expect(isConnected(st().project!, a, c)).toBe(false);
    // Alt (alone) and far: b stays, the pair parts.
    const before = st().project!;
    const at = { x: pos(before, c).x, z: pos(before, c).z };
    expect(st().dropItemAt(c, at, { x: at.x + 500, z: at.z }, false, true)).toBeNull();
    expect(pos(st().project!, b)).toEqual(pos(before, b));
    expect(isConnected(st().project!, b, c)).toBe(false);
  });
  it('a typed move parts a pair and warns; the record stays until disconnected (ADR-168)', () => {
    const [a, b, c] = ids(st().project!);
    st().moveItemBy(c, 300, 0, 1);
    st().selectItems([a, b]);
    expect(st().setConnected(true)).toBe('');
    st().updateItem(b, {
      position: { ...pos(st().project!, b), x: pos(st().project!, b).x + 100 },
    });
    expect(isConnected(st().project!, a, b)).toBe(true);
    expect(st().projectModel!.diagnostics.map((d) => d.code)).toContain('connection-broken');
    expect(st().projectModel!.diagnostics.filter((d) => d.severity === 'error')).toEqual([]);
    st().selectItems([a, b]);
    expect(st().setConnected(false)).toBe('');
    expect(st().projectModel!.diagnostics.map((d) => d.code)).not.toContain('connection-broken');
  });
  it('Move to carries the connected neighbours and connects at the landing (ADR-147, ADR-168)', () => {
    const [a, b, c] = ids(st().project!);
    st().selectItems([a, b]);
    expect(st().setConnected(true)).toBe('');
    st().moveItemBy(c, 300, 0, 1);
    const before = st().project!;
    expect(st().moveItemTo(b, 'right')).toBeNull();
    const p = st().project!;
    const d = pos(p, b).x - pos(before, b).x;
    expect(d).toBe(300);
    expect(pos(p, a).x - pos(before, a).x).toBe(300);
    expect(isConnected(p, a, b)).toBe(true);
    expect(isConnected(p, b, c)).toBe(true);
  });
  it('setConnected refuses pairs that are not side by side with the reason; Move to a neighbour connects', () => {
    const [a, , c] = ids(st().project!);
    st().selectItems([a, c]);
    expect(st().setConnected(true)).toMatch(/side by side/);
    expect(st().project!.connections).toBeUndefined();
    st().moveItemBy(c, 300, 0, 1);
    st().moveItemTo(c, 'left');
    const p = st().project!;
    const b = ids(p)[1];
    expect(isConnected(p, b, c)).toBe(true);
    expect(st().setConnected(true)).toMatch(/exactly two|side by side/);
  });
});

describe('seeded fuzz: random connections never throw (ADR-168)', () => {
  it('settle, prune and build hold their invariants', () => {
    let seed = 7;
    const rnd = () => {
      seed = (seed * 1664525 + 1013904223) % 4294967296;
      return seed / 4294967296;
    };
    const N = Math.ceil(Number(process.env.FUZZ_N ?? 3000) / 20);
    const kinds = ['base-door', 'base-door', 'wall-cabinet', 'base-door'];
    for (let n = 0; n < N; n++) {
      let p = row(
        ...Array.from(
          { length: 2 + Math.floor(rnd() * 3) },
          () => kinds[Math.floor(rnd() * kinds.length)],
        ),
      );
      const all = ids(p);
      for (let k = 0; k < 3; k++) {
        const a = all[Math.floor(rnd() * all.length)],
          b = all[Math.floor(rnd() * all.length)];
        if (rnd() < 0.5 && connectionCheck(p, a, b).reason === null) p = connect(p, a, b);
        const id = all[Math.floor(rnd() * all.length)];
        p = moveBy(p, id, Math.floor(rnd() * 200) - 100, 0, 1).project;
        p = settleConnections(p, [id], rnd() < 0.5);
      }
      expect(validateProject(p)).toEqual([]);
      expect(pruneConnections(p)).toBe(p);
      // Every stored pair is two different pieces of the project, once.
      const keys = (p.connections ?? []).map((c) => [...c.itemIds].sort().join('|'));
      expect(new Set(keys).size).toBe(keys.length);
      buildProjectModel(p);
      const moved = moveItems(p, movingSet(p, [all[0]]), 40, 0).project;
      buildProjectModel(moved);
    }
  });
});
