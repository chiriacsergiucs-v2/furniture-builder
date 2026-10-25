import { describe, expect, it } from 'vitest';
import { templates } from '../src/core/design';
import {
  buildProjectModel,
  makeItem,
  newProject,
  PROJECT_SCHEMA,
  PROJECT_SCHEMAS,
  validateProject,
  type Project,
} from '../src/core/project';
import { findFamily } from '../src/core/catalog';
import type { Design } from '../src/core/types';
import {
  closeOutline,
  doorSwing,
  featureBox,
  inside,
  outlineIssues,
  rectInside,
  roomDisplayBoxes,
  roomFrontView,
  setWallLength,
  shapeOutline,
  snapCorner,
  type Room,
  type RoomFeature,
} from '../src/core/room';

const t = (id: string) => templates.find((x) => x.id === id)!.create();
const rect = (w = 3000, d = 3000): Room => ({
  height: 2600,
  outline: shapeOutline('rectangle', { width: w, depth: d, cutWidth: 0, cutDepth: 0, offset: 0 }),
  features: [],
});
const feat = (f: Partial<RoomFeature>): RoomFeature => ({
  id: 'f',
  kind: 'obstacle',
  wall: 0,
  from: 0,
  width: 600,
  sill: 0,
  height: 600,
  depth: 100,
  label: 'Radiator',
  ...f,
});
function proj(ids: string[], room?: Room, x0 = 0): Project {
  let p = newProject('Room');
  for (const id of ids) p = { ...p, items: [...p.items, makeItem(p, t(id))] };
  p = {
    ...p,
    items: p.items.map((it) => ({ ...it, position: { ...it.position, x: it.position.x + x0 } })),
  };
  return room ? { ...p, room } : p;
}
const codes = (p: Project) => buildProjectModel(p).diagnostics.map((d) => d.code);

describe('room (ADR-058)', () => {
  it('no room: no room diagnostics; a valid room validates', () => {
    expect(codes(proj(['base-door']))).toEqual([]);
    const p = proj(['base-door'], rect());
    expect(codes(p)).toEqual([]);
    expect(validateProject(p)).toEqual([]);
    expect(validateProject({ ...p, room: { ...rect(), outline: [[0, 0]] } })).toContain(
      'Room outline must be at least four whole-mm corners',
    );
  });
  it('a piece past the right wall or taller than the room is an error', () => {
    expect(codes(proj(['base-door'], rect(), 2700))).toContain('outside-room');
    expect(codes(proj(['wardrobe'], { ...rect(), height: 2000 }))).toContain('outside-room');
  });
  it('a radiator on the back wall is hit → error; moved along the wall it is clear', () => {
    expect(codes(proj(['base-door'], { ...rect(), features: [feat({ from: 100 })] }))).toContain(
      'hits-obstacle',
    );
    expect(
      codes(proj(['base-door'], { ...rect(), features: [feat({ from: 1500 })] })),
    ).not.toContain('hits-obstacle');
  });
  it('a tall unit against the back wall under a 900 mm sill covers the window (warning)', () => {
    const p = proj(['wardrobe'], {
      ...rect(),
      features: [
        feat({ kind: 'window', from: 0, width: 1000, sill: 900, height: 1200, label: 'Window' }),
      ],
    });
    const d = buildProjectModel(p).diagnostics.find((x) => x.code === 'covers-window')!;
    expect(d.severity).toBe('warning');
    expect(d.message).toContain('1200 mm higher than its sill');
    expect(d.message).toMatch(/covers the window Window: it stands against its wall/);
  });
  it('a feature running past the end of its wall, or a free-standing obstacle outside, is an error naming it', () => {
    const past = buildProjectModel(
      proj(['base-door'], {
        ...rect(),
        features: [feat({ kind: 'window', from: 2600, width: 1000, sill: 900, label: 'Window 1' })],
      }),
    ).diagnostics.find((x) => x.code === 'room-feature');
    expect(past?.severity).toBe('error');
    expect(past?.message).toContain('Window 1 runs 600 mm past the end of wall 1');
    const out = buildProjectModel(
      proj(['base-door'], {
        ...rect(),
        features: [feat({ wall: null, x: 2800, z: 1000, width: 400, label: 'Pillar' })],
      }),
    ).diagnostics.find((x) => x.code === 'room-feature');
    expect(out?.severity).toBe('error');
    expect(out?.message).toContain('Pillar is outside the room');
    // Exactly to the corner, and a free-standing obstacle inside: no problem.
    expect(
      codes(
        proj(['base-door'], {
          ...rect(),
          features: [
            feat({ kind: 'window', from: 2000, width: 1000, sill: 900, label: 'Window 1' }),
            feat({ wall: null, x: 2000, z: 2000, width: 400, label: 'Pillar' }),
          ],
        }),
      ),
    ).not.toContain('room-feature');
  });
  it('a door swing is a quarter circle from the hinge end, inside its check rectangle', () => {
    const room = rect();
    const door = feat({ kind: 'door', wall: 0, from: 500, width: 800, height: 2000 });
    expect(doorSwing(room, door)).toEqual({
      hinge: [500, 0],
      closed: [1300, 0],
      open: [500, 800],
      radius: 800,
      sweep: 1,
    });
    // Wall 3 runs from (0, 3000) to (0, 0): the leaf opens towards +x.
    const left = doorSwing(room, { ...door, wall: 3, from: 2200 })!;
    expect(left.hinge).toEqual([0, 800]);
    expect(left.closed).toEqual([0, 0]);
    expect(left.open).toEqual([800, 800]);
    const b = featureBox(room, { ...door, wall: 3, from: 2200 })!;
    for (const [x, z] of [left.hinge, left.closed, left.open]) {
      expect(x >= b.x && x <= b.x + b.w && z >= b.z && z <= b.z + b.d).toBe(true);
    }
    expect(doorSwing(room, feat({ kind: 'window' }))).toBeNull();
  });
  it('the front view shows the room height and the features on the back wall only', () => {
    const v = roomFrontView({
      ...rect(4000, 3000),
      features: [
        feat({ id: 'w', kind: 'window', from: 1000, width: 1200, sill: 900, height: 1200 }),
        feat({ id: 'd', kind: 'door', wall: 0, from: 3000, width: 800, sill: 0, height: 2000 }),
        feat({ id: 'o', kind: 'obstacle', wall: 0, from: 0, width: 600, sill: 100, height: 600 }),
        feat({ id: 's', kind: 'door', wall: 1, from: 0, width: 800, height: 2000 }),
      ],
    })!;
    expect([v.x0, v.x1, v.height]).toEqual([0, 4000, 2600]);
    expect(v.features.map((f) => [f.id, f.x, f.w, f.y, f.h])).toEqual([
      ['w', 1000, 1200, 900, 1200],
      ['d', 3000, 800, 0, 2000],
      ['o', 0, 600, 100, 600],
    ]);
    // Alcove: the back wall is the alcove's back (smallest z).
    const alcove: Room = {
      height: 2500,
      outline: shapeOutline('alcove', {
        width: 4000,
        depth: 3000,
        cutWidth: 1000,
        cutDepth: 500,
        offset: 1500,
      }),
      features: [feat({ id: 'a', kind: 'window', wall: 2, from: 100, width: 600, sill: 1000 })],
    };
    expect(roomFrontView(alcove)!.features.map((f) => [f.x, f.w])).toEqual([[1600, 600]]);
  });
  it('a piece in the swing of a door on the left wall is a warning', () => {
    // Wall 3 runs from (0, 3000) to (0, 0); a door 800 wide starting 2700 mm along it reaches z = 300 … 0.
    const room = {
      ...rect(),
      features: [
        feat({ kind: 'door', wall: 3, from: 2200, width: 800, height: 2000, label: 'Door' }),
      ],
    };
    const d = buildProjectModel(proj(['base-door'], room)).diagnostics.find(
      (x) => x.code === 'blocks-door',
    );
    expect(d?.severity).toBe('warning');
    expect(codes(proj(['base-door'], room, 1000))).not.toContain('blocks-door');
  });
  it('drawers facing the back wall cannot open through it', () => {
    const p = proj(['chest'], rect());
    const it0 = p.items[0];
    const turned = {
      ...p,
      items: [{ ...it0, rotationY: 180 as const, position: { x: 500, y: 0, z: 100 } }],
    };
    expect(
      buildProjectModel(turned).diagnostics.some(
        (d) => d.code === 'opening-blocked' && /hits a wall/.test(d.message),
      ),
    ).toBe(true);
  });
});

describe('floor plan outline (ADR-059)', () => {
  it('L, U and alcove shapes are closed and square; a piece in the L cut-out is outside', () => {
    for (const shape of ['rectangle', 'l-shape', 'u-shape', 'alcove'] as const)
      expect(
        outlineIssues(
          shapeOutline(shape, {
            width: 4000,
            depth: 3000,
            cutWidth: 1000,
            cutDepth: 1200,
            offset: 1500,
          }),
        ),
      ).toEqual([]);
    const L = shapeOutline('l-shape', {
      width: 4000,
      depth: 3000,
      cutWidth: 1000,
      cutDepth: 1200,
      offset: 0,
    });
    expect(L).toHaveLength(6);
    expect(rectInside(L, 3200, 2000, 3800, 2500)).toBe(false);
    expect(rectInside(L, 100, 100, 700, 700)).toBe(true);
    const room: Room = { height: 2600, outline: L, features: [] };
    const p = proj(['base-door'], room);
    const moved = { ...p, items: [{ ...p.items[0], position: { x: 3300, y: 0, z: 2200 } }] };
    expect(codes(moved)).toContain('outside-room');
  });
  it('editing a wall length stretches the room and keeps it closed; a crossing outline is a room error', () => {
    const r = setWallLength(
      {
        height: 2600,
        outline: shapeOutline('l-shape', {
          width: 4000,
          depth: 3000,
          cutWidth: 1000,
          cutDepth: 1200,
          offset: 0,
        }),
        features: [],
      },
      0,
      4500,
    );
    expect(outlineIssues(r.outline)).toEqual([]);
    expect(r.outline[1]).toEqual([4500, 0]);
    const bad: Room = {
      height: 2600,
      outline: [
        [0, 0],
        [2000, 0],
        [2000, 1000],
        [-500, 1000],
        [-500, 500],
        [1000, 500],
        [1000, 2000],
        [0, 2000],
      ],
      features: [],
    };
    expect(outlineIssues(bad.outline).join()).toMatch(/cross/);
    expect(codes({ ...proj(['base-door']), room: bad })).toEqual(['room-outline']);
  });
  it('drawing snaps each wall to x or z in 10 mm steps and closes square', () => {
    expect(snapCorner(undefined, 12, 7)).toEqual([10, 10]);
    expect(snapCorner([0, 0], 3004, 120)).toEqual([3000, 0]);
    expect(snapCorner([3000, 0], 3100, 2496)).toEqual([3000, 2500]);
    const closed = closeOutline([
      [0, 0],
      [3000, 0],
      [3000, 2500],
      [500, 2500],
    ]);
    expect(outlineIssues(closed)).toEqual([]);
    expect(inside(closed, 100, 100)).toBe(true);
  });
});

describe('drawing the room on the plan (ADR-059)', () => {
  it('taps become square corners; closing makes the room in one undo step', async () => {
    const { useDesign } = await import('../src/store/designStore');
    const st = () => useDesign.getState();
    st().openProject(newProject('Draw'));
    st().addPiece(t('base-door'));
    st().stopPlacing();
    st().startDrawRoom();
    for (const [x, z] of [
      [-3, -4],
      [3996, 80],
      [4010, 3004],
      [1, 2990],
    ])
      st().addRoomCorner(x, z);
    const before = st().project;
    expect(st().finishDrawRoom()).toBe(true);
    expect(st().project!.room!.outline).toEqual([
      [0, 0],
      [4000, 0],
      [4000, 3000],
      [0, 3000],
    ]);
    expect(st().drawingRoom).toBeNull();
    expect(buildProjectModel(st().project!).diagnostics).toEqual([]);
    st().undoProject();
    expect(st().project).toBe(before);
  });
});

describe('closing a drawn room near the first corner', () => {
  it("a corner within 50 mm of the first corner's line lands on it", () => {
    expect(snapCorner([4200, 3000], 12, 3003, 10, [0, 0])).toEqual([0, 3000]);
    expect(snapCorner([4200, 3000], 70, 3003, 10, [0, 0])).toEqual([70, 3000]);
  });
});

describe('pipes and outlets (ADR-072)', () => {
  const kitchen = (fam: string, v: string) =>
    findFamily(fam)!.variants.find((x) => x.id === v)!.create!();
  const withDesigns = (designs: Design[], room: Room): Project => {
    let p = newProject('Services');
    for (const d of designs) p = { ...p, items: [...p.items, makeItem(p, d)] };
    return { ...p, room };
  };
  const pipe = feat({
    id: 'p',
    kind: 'pipe',
    from: 200,
    width: 100,
    sill: 300,
    height: 100,
    depth: 0,
    label: 'Pipe 1',
  });
  const outlet = feat({
    id: 'o',
    kind: 'outlet',
    from: 200,
    width: 80,
    sill: 1200,
    height: 80,
    depth: 0,
    label: 'Outlet 1',
  });

  it('new projects are at the current version; version 1 and 2 files validate and round-trip', () => {
    expect(newProject().schemaVersion).toBe(PROJECT_SCHEMA);
    expect(PROJECT_SCHEMAS).toContain(2); // pipes and outlets arrived in version 2 (ADR-072)
    const p = proj(['base-door'], { ...rect(), features: [pipe, outlet] });
    expect(validateProject(p)).toEqual([]);
    const back = JSON.parse(JSON.stringify(p)) as Project;
    expect(back.room!.features.map((f) => f.kind)).toEqual(['pipe', 'outlet']);
    expect(validateProject(back)).toEqual([]);
    // A version-1 project (as saved before) still loads unchanged.
    const v1 = { ...proj(['base-door'], rect()), schemaVersion: 1 as const };
    expect(validateProject(v1)).toEqual([]);
    expect(buildProjectModel(v1).diagnostics).toEqual([]);
    expect(validateProject({ ...p, schemaVersion: 99 })).toContain(
      'Unsupported project schemaVersion',
    );
    expect(
      validateProject({ ...p, room: { ...rect(), features: [{ ...pipe, kind: 'tap' }] } }),
    ).toContain('Invalid room feature');
  });

  it('a base unit with a back over a pipe warns; a sink base (no back) does not', () => {
    const base = withDesigns([t('base-door')], { ...rect(), features: [pipe] });
    const d = buildProjectModel(base).diagnostics.filter((x) => x.code === 'covers-service');
    expect(d).toHaveLength(1);
    expect(d[0].severity).toBe('warning');
    expect(d[0].message).toMatch(/^Pipe behind .+ \(Pipe 1\): cut the back or move the piece\.$/);
    const sink = withDesigns([kitchen('sink-base', 'sink-2-doors')], {
      ...rect(),
      features: [pipe],
    });
    expect(codes(sink)).toEqual([]);
    // Moved along the wall, clear of the piece: no warning.
    expect(
      codes(withDesigns([t('base-door')], { ...rect(), features: [{ ...pipe, from: 2000 }] })),
    ).toEqual([]);
  });

  it('an outlet hidden behind a tall unit warns; above a base unit it does not', () => {
    const tall = withDesigns([kitchen('tall-cabinet', 'tall-pantry')], {
      ...rect(),
      features: [outlet],
    });
    const d = buildProjectModel(tall).diagnostics;
    expect(d.map((x) => x.code)).toEqual(['outlet-hidden']);
    expect(d[0].severity).toBe('warning');
    expect(d[0].message).toMatch(/^Outlet 1 is hidden behind .+: move the outlet or the piece\.$/);
    expect(
      codes(withDesigns([kitchen('sink-base', 'sink-2-doors')], { ...rect(), features: [outlet] })),
    ).toEqual([]);
    // Low behind a base unit's back: the back covers it (not "hidden", a base unit is no tall unit).
    const low = buildProjectModel(
      withDesigns([t('base-door')], { ...rect(), features: [{ ...outlet, sill: 300 }] }),
    ).diagnostics;
    expect(low.map((x) => x.code)).toEqual(['covers-service']);
    expect(low[0].message).toMatch(
      /^Outlet behind .+ \(Outlet 1\): cut the back or move the piece\.$/,
    );
  });

  it('pipes and outlets are no openings in the 3D walls and show in the front view', () => {
    const r = { ...rect(), features: [pipe, outlet] };
    expect(roomDisplayBoxes(r).walls).toEqual(roomDisplayBoxes(rect()).walls);
    expect(roomFrontView(r)!.features.map((f) => [f.kind, f.y, f.h])).toEqual([
      ['pipe', 300, 100],
      ['outlet', 1200, 80],
    ]);
    expect(featureBox(r, pipe)).toEqual({ x: 200, y: 300, z: 0, w: 100, h: 100, d: 50 });
  });
});
