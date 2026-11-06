// ADR-207: typed connections (side, corner, stacked, wall) with their checks and `CompatRule.joins`; snap-made
// connections; moving, sliding along a wall, Alt; Mirror a run with stacked pieces; Merge; `connection-broken` per
// kind; document versions (project 21, design 9, template 3); Fit hardware lighting its panels; editable steps;
// Link identical pieces; lounger and daybed ends.
import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { mirrorDesign, mirrorRun } from '../src/core/arrange';
import {
  assemblySteps,
  moveStep,
  orderSteps,
  renameStep,
  stepLitIds,
  stepTitle,
} from '../src/core/assembly';
import { buildModel } from '../src/core/build';
import { catalogFamilies, insertVariant } from '../src/core/catalog';
import { COMPAT_RULES, evaluate, sideJoin } from '../src/core/compat';
import {
  alongWalls,
  connect,
  connectionCheck,
  connectionDiagnostics,
  connectionSeams,
  connectionsOf,
  connectWall,
  isConnected,
  isStacked,
  kindName,
  meetInCorner,
  mergeConnections,
  movingSet,
  pruneConnections,
  settleConnections,
  wallAgainst,
  wallCheck,
  wallsOf,
} from '../src/core/connections';
import { SCHEMA_VERSION, templates, validateDesign } from '../src/core/design';
import { droppedWallConnections, insertTemplate } from '../src/core/insertTemplate';
import { identicalPieces, linkIdentical, sameDesign } from '../src/core/linked';
import {
  buildProjectModel,
  makeItem,
  newProject,
  placeItem,
  PROJECT_SCHEMA,
  validateProject,
  type Project,
  type ProjectItem,
} from '../src/core/project';
import {
  projectFromTemplate,
  templateFromProject,
  validateProjectTemplate,
} from '../src/core/projectTemplate';
import type { Room } from '../src/core/room';
import type { Design, FrameParams } from '../src/core/types';
import { useDesign } from '../src/store/designStore';

const t = (id: string) => templates.find((x) => x.id === id)!.create();
const st = () => useDesign.getState();
const ids = (p: Project) => p.items.map((i) => i.id);
const item = (p: Project, id: string) => p.items.find((i) => i.id === id)!;
const pos = (p: Project, id: string) => item(p, id).position;
const bounds = (p: Project, id: string) => placeItem(item(p, id)).bounds;
const codes = (p: Project) => buildProjectModel(p).diagnostics.map((d) => d.code);
const broken = (p: Project) =>
  buildProjectModel(p).diagnostics.filter((d) => d.code === 'connection-broken');
const errors = (p: Project) =>
  buildProjectModel(p).diagnostics.filter((d) => d.severity === 'error');

/** A 4 × 3 m rectangular room: wall 0 is the back wall (z = 0), wall 1 the right, wall 2 the front, wall 3 the left. */
const ROOM: Room = {
  height: 2500,
  outline: [
    [0, 0],
    [4000, 0],
    [4000, 3000],
    [0, 3000],
  ],
  features: [],
};

function row(...designs: (string | Design)[]): Project {
  let p = newProject('Typed');
  for (const d of designs)
    p = { ...p, items: [...p.items, makeItem(p, typeof d === 'string' ? t(d) : d)] };
  return p;
}
const patch = (p: Project, id: string, change: Partial<ProjectItem>): Project => ({
  ...p,
  items: p.items.map((i) => (i.id === id ? { ...i, ...change } : i)),
});
/** Move the piece so its outline's left-back corner is at (x, z). */
function putAt(p: Project, id: string, x: number, z: number): Project {
  const b = bounds(p, id);
  const at = pos(p, id);
  return patch(p, id, { position: { ...at, x: at.x + x - b.x, z: at.z + z - b.z } });
}
/** Two base units in a corner: A along the back wall, B turned a quarter (facing along x) at A's right end. */
function cornerPair(): Project {
  let p = row('base-door', 'base-door');
  const [, b] = ids(p);
  p = patch(p, b, { rotationY: 90 });
  return putAt(p, b, 600, 0);
}
/** A base unit with the wall cabinet hung over it. */
function stackedPair(): Project {
  const p = row('base-door', 'wall-cabinet');
  const [, w] = ids(p);
  return putAt(p, w, 0, 0);
}

describe('connection kinds and their checks (ADR-207)', () => {
  it('side: two base units side by side; the kind is found as side and stored without a kind', () => {
    const p = row('base-door', 'base-door');
    const [a, b] = ids(p);
    expect(connectionCheck(p, a, b)).toEqual({ reason: null, kind: 'side' });
    const c = connect(p, a, b);
    expect(c.connections![0].kind).toBeUndefined();
    expect(connectionsOf(c, a)).toEqual([{ kind: 'side', other: b }]);
    expect(kindName('side')).toBe('side by side');
  });

  it('corner: two pieces turned a quarter apart sharing an edge, heights overlapping', () => {
    const p = cornerPair();
    const [a, b] = ids(p);
    const pieces = buildProjectModel(p).pieces;
    expect(meetInCorner(pieces[0], pieces[1])).toBe(true);
    expect(connectionCheck(p, a, b)).toEqual({ reason: null, kind: 'corner' });
    expect(connectionCheck(p, a, b, undefined, 'corner').reason).toBeNull();
    // Not side by side: checked as side it names the side reason.
    expect(connectionCheck(p, a, b, undefined, 'side').reason).toBe(
      'Base cabinet and Base cabinet do not stand side by side.',
    );
    // Moved apart: the corner check names its reason.
    const apart = putAt(p, b, 700, 0);
    expect(connectionCheck(apart, a, b, undefined, 'corner').reason).toBe(
      'Base cabinet and Base cabinet do not meet in a corner.',
    );
    // Turned the same way: no corner.
    const plain = row('base-door', 'base-door');
    const sp = buildProjectModel(plain).pieces;
    expect(meetInCorner(sp[0], sp[1])).toBe(false);
    expect(kindName('corner')).toBe('in the corner');
    // Its seam draws as a side seam does (ADR-179).
    const c = connect(p, a, b, 'corner');
    expect(c.connections![0].kind).toBe('corner');
    expect(connectionSeams(c, buildProjectModel(c).pieces)).toHaveLength(1);
  });

  it('stacked: a wall unit over a floor unit, or a piece placed on another; not when beside it', () => {
    const p = stackedPair();
    const [base, wall] = ids(p);
    const pieces = buildProjectModel(p).pieces;
    expect(isStacked(pieces[0], pieces[1])).toBe(true);
    expect(connectionCheck(p, base, wall)).toEqual({ reason: null, kind: 'stacked' });
    // Beside the base (the default place, to its right): neither stacked nor joined.
    const beside = row('base-door', 'wall-cabinet');
    const [b0, w0] = ids(beside);
    expect(connectionCheck(beside, b0, w0, undefined, 'stacked').reason).toBe(
      'Base cabinet and Wall cabinet are not one over the other.',
    );
    expect(connectionCheck(beside, b0, w0).reason).toBe(
      'Base cabinet and Wall cabinet are not side by side, in a corner or one over the other.',
    );
    // A piece placed on another (`above`) is stacked on it.
    const on = row('base-door', 'base-door');
    const [x, y] = ids(on);
    const placed = patch(on, y, { placement: { kind: 'above', baseId: x, gap: 0, offsetX: 0 } });
    const built = buildProjectModel(placed).pieces;
    expect(isStacked(built[0], built[1])).toBe(true);
    expect(connectionCheck(placed, x, y, built).kind).toBe('stacked');
    expect(kindName('stacked')).toBe('stacked');
    // A stacked pair has no seam.
    const c = connect(p, base, wall, 'stacked');
    expect(connectionSeams(c, buildProjectModel(c).pieces)).toEqual([]);
  });

  it('wall: the back lies on that wall within its length; otherwise the reason', () => {
    const p: Project = { ...row('base-door'), room: ROOM };
    const [a] = ids(p);
    expect(wallCheck(p, a, 0)).toBeNull();
    expect(wallAgainst(p, a)).toEqual({ wall: 0, reason: null });
    expect(wallCheck(p, a, 1)).toBe('The back of Base cabinet does not face wall 2.');
    expect(wallCheck(p, a, 7)).toBe('The room has no wall 8.');
    const off = putAt(p, a, 100, 50);
    expect(wallCheck(off, a, 0)).toBe('The back of Base cabinet is not against wall 1.');
    expect(wallAgainst(off, a).reason).toBe('The back of Base cabinet is not against a wall.');
    const past = putAt(p, a, 3700, 0);
    expect(wallCheck(past, a, 0)).toBe('Base cabinet reaches past the end of wall 1.');
    expect(wallAgainst(row('base-door'), a).reason).toMatch(/Draw the room first/);
    // Against the wall: one piece written twice plus the wall index.
    const w = connectWall(p, a, 0);
    expect(w.connections).toEqual([
      { id: expect.any(String), kind: 'wall', itemIds: [a, a], wall: 0 },
    ]);
    expect(connectWall(w, a, 0)).toBe(w);
    expect(wallsOf(w, a)).toEqual([0]);
    expect(connectionsOf(w, a)).toEqual([{ kind: 'wall', wall: 0 }]);
    expect(kindName('wall', 0)).toBe('against wall 1');
    expect(validateProject(w)).toEqual([]);
    expect(pruneConnections(w)).toBe(w);
    // A wall connection is never a pair.
    expect(connectionCheck(p, a, 'x', undefined, 'wall').reason).toMatch(/removed/);
  });

  it('rules: absent joins = side (every ADR-100 rule as before); same-mount also runs on corner joins', () => {
    for (const r of COMPAT_RULES)
      if (r.id === 'same-mount') expect(r.joins).toEqual(['side', 'corner']);
      else expect(r.joins, r.id).toBeUndefined();
    // A wall unit standing on the floor beside a base unit: refused as before on a side join.
    let p = row('base-door', 'wall-cabinet');
    const [a, b] = ids(p);
    p = patch(p, b, { position: { ...pos(p, b), y: 0 }, placement: undefined });
    const pieces = buildProjectModel(p).pieces;
    const side = evaluate('snap', { ...sideJoin(pieces[0], pieces[1]), join: 'side' });
    expect(side.map((f) => f.rule.id)).toContain('same-mount');
    expect(evaluate('snap', sideJoin(pieces[0], pieces[1])).map((f) => f.rule.id)).toEqual(
      side.map((f) => f.rule.id),
    );
    expect(connectionCheck(p, a, b).reason).toMatch(/cannot join/);
    // The same pair turned into a corner: same-mount refuses the corner join too.
    let q = patch(p, b, { rotationY: 90 });
    q = putAt(q, b, 600, 0);
    const cq = buildProjectModel(q).pieces;
    expect(meetInCorner(cq[0], cq[1])).toBe(true);
    expect(connectionCheck(q, a, b, undefined, 'corner').reason).toMatch(/cannot join/);
    // A stacked join runs neither: a wall unit over a base unit is fine.
    const s = buildProjectModel(stackedPair()).pieces;
    expect(evaluate('snap', { ...sideJoin(s[0], s[1]), join: 'stacked' })).toEqual([]);
  });
});

describe('snap-made connections (ADR-207, as built)', () => {
  it('a snapped drop makes side, corner and stacked connections with their kind', () => {
    const side = row('base-door', 'base-door');
    const s = settleConnections(side, [ids(side)[1]], true);
    expect(s.connections!.map((c) => c.kind ?? 'side')).toEqual(['side']);
    const corner = cornerPair();
    const c = settleConnections(corner, [ids(corner)[1]], true);
    expect(c.connections!.map((x) => x.kind)).toEqual(['corner']);
    const stacked = stackedPair();
    const k = settleConnections(stacked, [ids(stacked)[1]], true);
    expect(k.connections!.map((x) => x.kind)).toEqual(['stacked']);
    // Unsnapped: none made.
    expect(settleConnections(stacked, [ids(stacked)[1]], false)).toBe(stacked);
  });

  it('a snap landing a piece’s back on a wall connects it to that wall automatically', () => {
    const p: Project = { ...row('base-door'), room: ROOM };
    const [a] = ids(p);
    const s = settleConnections(p, [a], true);
    expect(wallsOf(s, a)).toEqual([0]);
    // Off the wall: no wall connection made.
    const off = putAt(p, a, 100, 200);
    expect(wallsOf(settleConnections(off, [a], true), a)).toEqual([]);
    // Dragged off the wall: the wall connection goes.
    const moved = putAt(s, a, 100, 200);
    expect(wallsOf(settleConnections(moved, [a], false), a)).toEqual([]);
  });

  it('store: a snapped drag along the back wall connects to it, then the piece slides along the wall', () => {
    st().openProject({ ...row('base-door', 'base-door'), room: ROOM });
    const [a, b] = ids(st().project!);
    st().moveItemBy(b, 300, 0, 1);
    expect(st().project!.connections).toBeUndefined();
    st().moveItemBy(b, -300, 0, 1, { snapped: true });
    const p = st().project!;
    expect(isConnected(p, a, b)).toBe(true);
    expect(wallsOf(p, b)).toEqual([0]);
    // b and a move as one and stay on the wall: a forward drag only slides them.
    const before = st().project!;
    st().moveItemBy(b, 100, 250, 1);
    expect(pos(st().project!, a).z).toBe(pos(before, a).z);
    expect(pos(st().project!, b).x - pos(before, b).x).toBe(100);
  });
});

describe('moved, slid, freed, mirrored, merged (ADR-207, store)', () => {
  beforeEach(() => st().openProject({ ...stackedPair(), room: ROOM }));

  it('moving the base carries its stacked wall unit, which keeps its height', () => {
    const [base, wall] = ids(st().project!);
    st().selectItems([base, wall]);
    expect(st().setConnected(true)).toBe('');
    expect(st().project!.connections![0].kind).toBe('stacked');
    const before = st().project!;
    expect(movingSet(before, [base])).toEqual([base, wall]);
    st().moveItemBy(base, 300, 0, 1);
    const p = st().project!;
    expect(pos(p, base).x - pos(before, base).x).toBe(300);
    expect(pos(p, wall).x - pos(before, wall).x).toBe(300);
    expect(pos(p, wall).y).toBe(pos(before, wall).y);
    expect(codes(p)).not.toContain('connection-broken');
  });

  it('a wall-connected piece slides along its wall; Alt moves it off and disconnects at drop', () => {
    const [base] = ids(st().project!);
    expect(st().setAgainstWall(base, true)).toBe('');
    expect(st().projectPastNames.at(-1)).toBe('Against the wall');
    expect(wallsOf(st().project!, base)).toEqual([0]);
    expect(alongWalls(st().project!, [base], 50, 80)).toEqual({ dx: 50, dz: 0 });
    const before = st().project!;
    st().moveItemBy(base, 200, 300, 1);
    const p = st().project!;
    expect(pos(p, base).x - pos(before, base).x).toBe(200);
    expect(pos(p, base).z).toBe(pos(before, base).z);
    expect(wallsOf(p, base)).toEqual([0]);
    // Alt: moves alone, off the wall, and the wall connection goes at the drop.
    st().moveItemBy(base, 0, 300, 1, { alone: true });
    expect(pos(st().project!, base).z - pos(p, base).z).toBe(300);
    expect(wallsOf(st().project!, base)).toEqual([]);
    // Off the wall the toggle is refused with the reason.
    expect(st().setAgainstWall(base, true)).toBe('The back of Base cabinet is not against a wall.');
    st().undoProject();
    expect(wallsOf(st().project!, base)).toEqual([0]);
    expect(st().setAgainstWall(base, false)).toBe('');
    expect(st().projectPastNames.at(-1)).toBe('Off the wall');
    expect(wallsOf(st().project!, base)).toEqual([]);
  });

  it('Alt frees a stacked wall unit: the base moves alone and the pair disconnects', () => {
    const [base, wall] = ids(st().project!);
    st().selectItems([base, wall]);
    st().setConnected(true);
    const before = st().project!;
    st().moveItemBy(base, 800, 0, 1, { alone: true });
    expect(pos(st().project!, wall)).toEqual(pos(before, wall));
    expect(isConnected(st().project!, base, wall)).toBe(false);
  });

  it('Mirror a run takes the stacked-connected wall unit too', () => {
    const [base, wall] = ids(st().project!);
    const bare = st().project!;
    const alone = mirrorRun(bare, base);
    // Not connected: the hung wall unit is not part of the run and stays.
    expect(pos(alone.project, wall)).toEqual(pos(bare, wall));
    const joined = connect(bare, base, wall, 'stacked');
    // The run is one base unit: mirrored about its own centre the wall unit (same width, same x) stays over it.
    const res = mirrorRun(joined, base);
    expect(res.refused).toBeUndefined();
    expect(res.reasons.some((r) => r.startsWith('Wall cabinet'))).toBe(true);
    // A three-piece run with the wall unit over the left end: mirrored, it lands over the right end.
    let r = row('base-door', 'base-door', 'base-door', 'wall-cabinet');
    const [a, , c, w] = ids(r);
    r = putAt(r, w, 0, 0);
    r = connect(r, a, w, 'stacked');
    const m = mirrorRun(r, a);
    expect(m.refused).toBeUndefined();
    // Reflected about the run's middle: over the right end now, at the same height.
    const wb = bounds(m.project, w),
      end = bounds(r, c);
    expect(bounds(r, w).x).toBe(0);
    expect(wb.x + wb.w).toBe(end.x + end.w);
    expect(wb.y).toBe(bounds(r, w).y);
    // Without the connection the wall unit is left where it was.
    const { connections: _c, ...unjoined } = r;
    void _c;
    expect(bounds(mirrorRun(unjoined, a).project, w)).toEqual(bounds(r, w));
  });

  it('Merge gives the merged pieces’ other connections to the new piece; the one between them goes', () => {
    let p = row('base-door', 'base-door', 'base-door', 'wall-cabinet');
    const [a, b, c, w] = ids(p);
    p = putAt(p, w, 0, 0);
    p = { ...p, room: ROOM };
    p = connect(connect(connect(p, a, b), b, c), a, w, 'stacked');
    p = connectWall(p, a, 0);
    st().openProject(p);
    expect(st().mergeItems(a, b)).toEqual([]);
    const q = st().project!;
    const merged = st().selectedItemId!;
    expect(q.items.map((i) => i.id)).toEqual(expect.arrayContaining([merged, c, w]));
    expect(q.items).toHaveLength(3);
    expect(isConnected(q, merged, c)).toBe(true);
    expect(isConnected(q, merged, w)).toBe(true);
    expect(wallsOf(q, merged)).toEqual([0]);
    expect(validateProject(q)).toEqual([]);
    expect(codes(q)).not.toContain('connection-broken');
    // mergeConnections alone: a connection between two merged pieces goes, the others follow.
    const m = mergeConnections(p, [a, b], a);
    expect(m.connections!.map((x) => [x.kind ?? 'side', ...x.itemIds])).toEqual([
      ['side', a, c],
      ['stacked', a, w],
      ['wall', a, a],
    ]);
  });
});

describe('connection-broken names each kind’s reason (ADR-207, ADR-008)', () => {
  it('side, corner, stacked and wall: a warning with the reason, never an error', () => {
    const side = row('base-door', 'base-door');
    const [a, b] = ids(side);
    const s = putAt(connect(side, a, b), b, 700, 0);
    expect(broken(s)[0].message).toBe(
      'Base cabinet (piece 1) and Base cabinet (piece 2) are connected but no longer joined: Base cabinet and Base cabinet do not stand side by side.',
    );
    const corner = cornerPair();
    const c = putAt(
      connect(corner, ids(corner)[0], ids(corner)[1], 'corner'),
      ids(corner)[1],
      700,
      0,
    );
    expect(broken(c)[0].message).toMatch(/no longer joined: .* do not meet in a corner\.$/);
    const stacked = stackedPair();
    const k = putAt(
      connect(stacked, ids(stacked)[0], ids(stacked)[1], 'stacked'),
      ids(stacked)[1],
      1000,
      0,
    );
    expect(broken(k)[0].message).toMatch(/no longer joined: .* are not one over the other\.$/);
    const wall: Project = { ...row('base-door'), room: ROOM };
    const w = putAt(connectWall(wall, ids(wall)[0], 0), ids(wall)[0], 0, 100);
    expect(broken(w)[0].message).toBe(
      'Base cabinet is connected against wall 1 but no longer joined: The back of Base cabinet is not against wall 1.',
    );
    for (const p of [s, c, k, w]) {
      expect(broken(p)).toHaveLength(1);
      expect(broken(p)[0].severity).toBe('warning');
      expect(errors(p)).toEqual([]);
    }
    const cp = cornerPair();
    const [x, y] = ids(cp);
    expect(connectionDiagnostics(connect(cp, x, y, 'corner'))).toEqual([]);
  });
});

describe('documents (ADR-207, ADR-011)', () => {
  it('project 21 validates kinds and wall connections; project 20 files load unchanged, a kind in 20 is invalid', () => {
    expect(PROJECT_SCHEMA).toBe(21);
    const p: Project = { ...cornerPair(), room: ROOM };
    const [a, b] = ids(p);
    const ok = connectWall(connect(p, a, b, 'corner'), a, 0);
    expect(validateProject(ok)).toEqual([]);
    expect(validateProject(JSON.parse(JSON.stringify(ok)))).toEqual([]);
    // Version 20: untyped pairs still load; a kind does not.
    const v20 = { ...p, schemaVersion: 20 } as unknown as Project;
    expect(validateProject({ ...v20, connections: [{ id: 'c', itemIds: [a, b] }] })).toEqual([]);
    expect(
      validateProject({ ...v20, connections: [{ id: 'c', kind: 'corner', itemIds: [a, b] }] }),
    ).toContain('Connection kinds need project schemaVersion 21');
    const bad = (connections: unknown) => validateProject({ ...p, connections } as Project);
    // A wall connection holds one piece twice plus its wall.
    expect(bad([{ id: 'c', kind: 'wall', itemIds: [a, b], wall: 0 }])).toContain(
      'Invalid connection',
    );
    expect(bad([{ id: 'c', kind: 'wall', itemIds: [a, a] }])).toContain('Invalid connection');
    expect(bad([{ id: 'c', kind: 'wall', itemIds: [a, a], wall: -1 }])).toContain(
      'Invalid connection',
    );
    expect(bad([{ id: 'c', kind: 'side', itemIds: [a, b], wall: 0 }])).toContain(
      'Invalid connection',
    );
    expect(bad([{ id: 'c', kind: 'glued', itemIds: [a, b] }])).toContain('Invalid connection');
    expect(
      bad([
        { id: 'c', kind: 'wall', itemIds: [a, a], wall: 0 },
        { id: 'd', kind: 'wall', itemIds: [a, a], wall: 0 },
      ]),
    ).toContain('Invalid connection');
  });

  it('design 9 validates the steps and the ends; design 8 files load unchanged and refuse them', () => {
    expect(SCHEMA_VERSION).toBe(9);
    const base = t('base-door');
    const v8 = { ...base, schemaVersion: 8 } as Design;
    expect(validateDesign(v8)).toEqual([]);
    const steps = {
      ...base,
      assembly: { order: ['bottom', 'prepare'], names: { bottom: 'Floor' } },
    };
    expect(validateDesign(steps)).toEqual([]);
    expect(validateDesign({ ...steps, schemaVersion: 8 })).toContain(
      'Assembly steps need schemaVersion 9',
    );
    expect(validateDesign({ ...base, assembly: { order: 'x' } })).toContain(
      'Invalid assembly steps',
    );
    expect(validateDesign({ ...base, assembly: { order: ['a', 'a'] } })).toContain(
      'Invalid assembly steps',
    );
    const lounger = loungerDesign();
    const right = mirrorDesign(lounger).design;
    expect(validateDesign(right)).toEqual([]);
    expect(validateDesign({ ...right, schemaVersion: 8 })).toContain(
      'Backrest and side panel ends need schemaVersion 9',
    );
    const p = right.product as { params: FrameParams };
    const wrong = {
      ...right,
      product: {
        ...right.product,
        params: { ...p.params, backrest: { ...p.params.backrest!, end: 'left' } },
      },
    };
    expect(validateDesign(wrong)).toContain('Invalid backrest or side panel end');
  });

  it('template 3 keeps kinds and walls; template 2 refuses a kind; a missing wall is dropped on insert', () => {
    let p: Project = { ...cornerPair(), room: ROOM };
    const [a, b] = ids(p);
    p = connectWall(connect(p, a, b, 'corner'), a, 0);
    const tpl = templateFromProject(p, 'Corner', { includeRoom: true });
    expect(tpl.schemaVersion).toBe(3);
    expect(tpl.connections).toEqual([
      { itemIds: [a, b], kind: 'corner' },
      { itemIds: [a, a], kind: 'wall', wall: 0 },
    ]);
    expect(validateProjectTemplate(tpl)).toEqual([]);
    expect(validateProjectTemplate({ ...tpl, schemaVersion: 2 })).toContain(
      'Connection kinds need template schemaVersion 3',
    );
    // An untyped template 2 still loads.
    const v2 = templateFromProject(
      connect(
        row('base-door', 'base-door'),
        ...(ids(row('base-door', 'base-door')) as [string, string]),
      ),
      'Pair',
    );
    expect(validateProjectTemplate({ ...v2, schemaVersion: 2 })).toEqual([]);
    expect(
      validateProjectTemplate({
        ...tpl,
        connections: [{ itemIds: [a, b], kind: 'wall', wall: 0 }],
      }),
    ).toContain('Invalid template connection');
    // Back as a project: both kept with new ids.
    const back = projectFromTemplate(tpl);
    expect(back.connections!.map((c) => c.kind)).toEqual(['corner', 'wall']);
    expect(validateProject(back)).toEqual([]);
    // Into a project without a room: the wall connection is dropped and counted for the notice.
    const into = newProject('Into');
    expect(droppedWallConnections(into, tpl)).toBe(1);
    const res = insertTemplate(into, tpl);
    expect(res.droppedWalls).toBe(1);
    expect(res.project.connections!.map((c) => c.kind)).toEqual(['corner']);
    // Into a room with that wall: kept.
    const roomed = insertTemplate({ ...newProject('R'), room: ROOM }, tpl);
    expect(roomed.droppedWalls).toBe(0);
    expect(roomed.project.connections).toHaveLength(2);
  });
});

describe('Fit hardware lights its panels (ADR-207, G-352)', () => {
  it('hinges carry the side their plates fix to, runner pairs both sides; Show step lights them', () => {
    const door = buildModel(t('base-door'));
    const hinge = door.hardware.find((h) => h.kind === 'hinge')!;
    const left = door.panels.find((p) => p.label === 'Left side')!;
    expect(hinge.panelIds).toEqual([left.id]);
    const fit = assemblySteps(door).find((s) => s.id === 'fit-hardware')!;
    expect(stepTitle(fit, 'app')).toBe('Fit hardware to the sides');
    expect(stepLitIds(fit)).toContain(left.id);
    const chest = buildModel(t('chest'));
    const sides = chest.panels.filter((p) => p.role === 'side').map((p) => p.id);
    expect(sides).toHaveLength(2);
    for (const r of chest.hardware.filter((h) => h.kind === 'drawer-runner-pair'))
      expect([...(r.panelIds ?? [])].sort()).toEqual([...sides].sort());
    const chestFit = assemblySteps(chest).find((s) => s.id === 'fit-hardware')!;
    for (const id of sides) expect(stepLitIds(chestFit)).toContain(id);
    // A right-hinged door: its plates go on the right side.
    const d = t('base-door');
    const rightHinged = mirrorDesign(d).design;
    const rh = buildModel(rightHinged);
    expect(rh.hardware.find((h) => h.kind === 'hinge')!.panelIds).toEqual([
      rh.panels.find((p) => p.label === 'Right side')!.id,
    ]);
    // Model only: a design never stores hardware.
    expect(JSON.stringify(d)).not.toContain('panelIds');
  });
});

describe('editable steps (ADR-207, G-344)', () => {
  const model = () => buildModel(t('base-door'));
  it('move up and down, rename, unknown ids ignored, unnamed steps keep their generated place', () => {
    const steps = assemblySteps(model());
    const generated = steps.map((s) => s.id);
    expect(moveStep(steps, generated[0], -1)).toBeNull();
    expect(moveStep(steps, generated.at(-1)!, 1)).toBeNull();
    const up = moveStep(steps, generated[2], -1)!;
    const moved = orderSteps(steps, up);
    expect(moved.map((s) => s.id)).toEqual([
      generated[0],
      generated[2],
      generated[1],
      ...generated.slice(3),
    ]);
    expect(moved.map((s) => s.n)).toEqual(steps.map((_, i) => i + 1));
    const down = orderSteps(steps, moveStep(moved, generated[2], 1, up)!);
    expect(down.map((s) => s.id)).toEqual(generated);
    const named = renameStep(moved, generated[2], '  Glue the bottom  ', up);
    const shown = orderSteps(steps, named);
    expect(shown[1].named).toBe('Glue the bottom');
    expect(stepTitle(shown[1], 'app')).toBe('Glue the bottom');
    expect(stepTitle(shown[1], 'print')).toBe('Glue the bottom');
    // An empty name restores the generated title.
    const unnamed = orderSteps(steps, renameStep(shown, generated[2], '', named));
    expect(unnamed[1].named).toBeUndefined();
    expect(stepTitle(unnamed[1], 'app')).toBe(steps[2].title);
    // Unknown ids are ignored; steps the order does not name follow their generated predecessor.
    const [g0, g1, g2, g3, g4, ...rest] = generated;
    const partial = orderSteps(steps, { order: ['nope' as never, g3, g0] });
    // g4 and the rest follow g3, their generated predecessor chain; g1 and g2 follow g0.
    expect(partial.map((s) => s.id)).toEqual([g3, g4, ...rest, g0, g1, g2]);
    expect(orderSteps(steps, { order: ['nope' as never] }).map((s) => s.id)).toEqual(generated);
  });

  it('store: one undo step each, saved in the design (version 9), linked copies share it; Reset deletes it', () => {
    st().openProject(row('base-door'));
    const [a] = ids(st().project!);
    st().addLinkedCopy(a);
    const copy = ids(st().project!).find((x) => x !== a)!;
    const steps = assemblySteps(buildProjectModel(st().project!).pieces[0].model);
    const edit = moveStep(steps, steps[2].id, -1)!;
    const n = st().projectPastNames.length;
    st().setAssembly(a, edit, 'Move step up');
    expect(st().projectPastNames).toHaveLength(n + 1);
    expect(st().projectPastNames.at(-1)).toBe('Move step up');
    expect(item(st().project!, a).design.assembly).toEqual(edit);
    expect(item(st().project!, a).design.schemaVersion).toBe(9);
    expect(item(st().project!, copy).design.assembly).toEqual(edit);
    expect(validateProject(st().project!)).toEqual([]);
    st().setAssembly(a, undefined, 'Reset the steps');
    expect(st().projectPastNames.at(-1)).toBe('Reset the steps');
    expect('assembly' in item(st().project!, a).design).toBe(false);
    expect(item(st().project!, copy).design.assembly).toBeUndefined();
    st().undoProject();
    expect(item(st().project!, a).design.assembly).toEqual(edit);
  });
});

describe('Link identical pieces (ADR-207, G-136)', () => {
  it('sameDesign ignores the ids and the times; any other difference counts', () => {
    const a = t('base-door');
    const b = { ...t('base-door'), createdAt: '2020-01-01T00:00:00.000Z', updatedAt: 'x' };
    expect(a.id).not.toBe(b.id);
    expect(sameDesign(a, b)).toBe(true);
    const wider = {
      ...b,
      product: {
        ...b.product,
        params: { ...(b.product as { params: object }).params, width: 601 },
      },
    } as Design;
    expect(sameDesign(a, wider)).toBe(false);
    expect(sameDesign(a, { ...b, name: 'Other' })).toBe(false);
    // Two copies of one catalog item taken a moment apart are the same piece (their `takenAt` differs).
    const f = catalogFamilies.find((x) => x.id === 'base-doors')!;
    const v = f.variants.find((x) => x.id === 'base-door')!;
    const c1 = insertVariant(f, v)!;
    const c2 = insertVariant(f, v)!;
    c2.catalog!.origin!.takenAt = '2000-01-01T00:00:00.000Z';
    expect(c1.catalog!.origin!.takenAt).not.toBe(c2.catalog!.origin!.takenAt);
    expect(sameDesign(c1, c2)).toBe(true);
    expect(
      sameDesign(c1, {
        ...c2,
        catalog: { ...c2.catalog!, origin: { ...c2.catalog!.origin!, variantId: 'x' } },
      }),
    ).toBe(false);
  });

  it('three identical pieces: Link 3 links all three in one undo step; link groups that join take one id', () => {
    const p = row('base-door', 'base-door', 'base-door', 'wall-cabinet');
    const [a, b, c, w] = ids(p);
    expect(identicalPieces(p, a)).toEqual([a, b, c]);
    expect(identicalPieces(p, w)).toEqual([]);
    st().openProject(p);
    const n = st().projectPastNames.length;
    st().linkIdentical(a);
    expect(st().projectPastNames).toHaveLength(n + 1);
    expect(st().projectPastNames.at(-1)).toBe('Link identical pieces');
    const q = st().project!;
    const link = item(q, a).linkId;
    expect(link).toBeTruthy();
    expect([b, c].map((x) => item(q, x).linkId)).toEqual([link, link]);
    expect(item(q, w).linkId).toBeUndefined();
    expect(identicalPieces(q, a)).toEqual([]);
    st().undoProject();
    expect(st().project!.items.every((i) => !i.linkId)).toBe(true);
    // a and b already linked, c alone: linking from c brings the group in under one id.
    const grouped = patch(patch(p, a, { linkId: 'L1' }), b, { linkId: 'L1' });
    expect(identicalPieces(grouped, c)).toEqual([a, b, c]);
    const all = linkIdentical(grouped, c);
    expect(new Set([a, b, c].map((x) => item(all, x).linkId))).toEqual(new Set(['L1']));
    expect(linkIdentical(all, a)).toBe(all);
  });
});

/** The catalog lounger with its backrest. */
function loungerDesign(): Design {
  const f = catalogFamilies.find((x) => x.variants.some((v) => v.id === 'lounger-reference'))!;
  return insertVariant(
    f,
    f.variants.find((v) => v.id === 'lounger-reference')!,
  )!;
}
function daybedDesign(): Design {
  const f = catalogFamilies.find((x) => x.id === 'daybed')!;
  return insertVariant(
    f,
    f.variants.find((v) => v.id === 'daybed-three-sided')!,
  )!;
}

describe('lounger and daybed ends (ADR-207, G-404)', () => {
  it('a lounger mirrors its backrest to the right end and back', () => {
    const d = loungerDesign();
    const p = (x: Design) => (x.product as { params: FrameParams }).params;
    expect(p(d).backrest!.end).toBeUndefined();
    const once = mirrorDesign(d);
    expect(once.ok).toBe(true);
    expect(p(once.design).backrest!.end).toBe('right');
    const twice = mirrorDesign(once.design);
    expect(twice.ok).toBe(true);
    expect(twice.design).toEqual({ ...d, schemaVersion: SCHEMA_VERSION });
    // Built at that end: the backrest slats are reflected along the width.
    const W = buildModel(d).panels.reduce((m, q) => Math.max(m, q.box.x + q.box.w), 0);
    const slats = (x: Design) =>
      buildModel(x)
        .panels.filter((q) => q.label === 'Backrest slat')
        .map((q) => q.box.x)
        .sort((a, b) => a - b);
    const left = slats(d),
      right = slats(once.design);
    expect(left.length).toBeGreaterThan(0);
    const w = buildModel(d).panels.find((q) => q.label === 'Backrest slat')!.box.w;
    expect(right).toEqual(left.map((x) => W - x - w).sort((a, b) => a - b));
    expect(errors({ ...row(once.design) })).toEqual([]);
  });

  it('a daybed mirrors its side panel to the right end and back', () => {
    const d = daybedDesign();
    const p = (x: Design) => (x.product as { params: FrameParams }).params;
    expect(p(d).bed!.sidePanelHeight).toBeGreaterThan(0);
    expect(p(d).bed!.sidePanelEnd).toBeUndefined();
    const once = mirrorDesign(d);
    expect(once.ok).toBe(true);
    expect(p(once.design).bed!.sidePanelEnd).toBe('right');
    expect(mirrorDesign(once.design).design).toEqual({ ...d, schemaVersion: SCHEMA_VERSION });
    // The side panel stands at the left end, mirrored at the right end.
    const sidePanel = (x: Design) => {
      const m = buildModel(x);
      const W = m.panels.reduce((a, q) => Math.max(a, q.box.x + q.box.w), 0);
      const sp = m.panels.find((q) => q.label === 'Side panel')!.box;
      return sp.x === 0 ? 'left' : sp.x + sp.w === W ? 'right' : 'between';
    };
    expect(sidePanel(d)).toBe('left');
    expect(sidePanel(once.design)).toBe('right');
    expect(errors(row(once.design))).toEqual([]);
  });
});
