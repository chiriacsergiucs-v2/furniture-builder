import { describe, expect, it } from 'vitest';
import { templates } from '../src/core/design';
import {
  buildProjectModel,
  makeItem,
  newProject,
  validateProject,
  type Project,
} from '../src/core/project';
import {
  closeOutline,
  inside,
  outlineIssues,
  rectInside,
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
