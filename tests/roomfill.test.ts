// ADR-173: Fill the room — whole-room mixes over every wall, doors and windows kept free, corner cabinets at the
// inside corners, every offered mix error-free, deterministic; random rooms never throw.
import { describe, expect, it } from 'vitest';
import { buildProjectModel, placedBounds, validateProject } from '../src/core/project';
import {
  cornerWalls,
  freeStretches,
  insideCorner,
  suggestRoomMixes,
  turnFor,
  type RoomInput,
} from '../src/core/roomfill';
import { shapeOutline, wallBox, wallLength, type Room, type RoomFeature } from '../src/core/room';
import { MIXES_FIRST } from '../src/core/wallfill';

const rect = (features: RoomFeature[] = []): Room => ({
  height: 2500,
  outline: shapeOutline('rectangle', {
    width: 3600,
    depth: 3000,
    cutWidth: 0,
    cutDepth: 0,
    offset: 0,
  }),
  features,
});
const door: RoomFeature = {
  id: 'd',
  kind: 'door',
  label: 'Door',
  wall: 1,
  from: 1200,
  width: 900,
  sill: 0,
  height: 2050,
  depth: 0,
};
const window_: RoomFeature = {
  id: 'w',
  kind: 'window',
  label: 'Window',
  wall: 0,
  from: 1200,
  width: 1200,
  sill: 1000,
  height: 1200,
  depth: 0,
};
const input = (room: Room, over: Partial<RoomInput> = {}): RoomInput => ({
  room,
  depth: 560,
  minWidth: 400,
  maxWidth: 1200,
  ...over,
});
/** Where a placed piece lies along wall `i`, as [from, to] from the wall's start corner. */
function along(
  room: Room,
  i: number,
  b: { x: number; z: number; w: number; d: number },
): [number, number] {
  const len = wallLength(room, i);
  // Project the box onto the wall: the wall box of the whole wall, intersected.
  const wb = wallBox(room, i, 0, len, 1, 0, 1);
  const horizontal = wb.w > wb.d;
  const [a0, a1] = horizontal ? [b.x, b.x + b.w] : [b.z, b.z + b.d];
  const [w0, w1] = horizontal ? [wb.x, wb.x + wb.w] : [wb.z, wb.z + wb.d];
  const forward = horizontal
    ? room.outline[(i + 1) % room.outline.length][0] > room.outline[i][0]
    : room.outline[(i + 1) % room.outline.length][1] > room.outline[i][1];
  return forward ? [a0 - w0, a1 - w0] : [w1 - a1, w1 - a0];
}

describe('free stretches and corners (ADR-173)', () => {
  it('a door keeps its opening free; a high window keeps the wall row off; a low window blocks the stretch', () => {
    const inp = input(rect([door, window_]));
    expect(freeStretches(inp, 1, { start: 0, end: 0 }, 400).map((s) => [s.from, s.to])).toEqual([
      [0, 1200],
      [2100, 3000],
    ]);
    const w0 = freeStretches(inp, 0, { start: 0, end: 0 }, 400);
    expect(w0.map((s) => [s.from, s.to])).toEqual([[0, 3600]]);
    expect(w0[0].noWallRow).toEqual([[1200, 2400]]);
    const low = input(rect([{ ...window_, sill: 400 }]));
    expect(freeStretches(low, 0, { start: 0, end: 0 }, 400).map((s) => [s.from, s.to])).toEqual([
      [0, 1200],
      [2400, 3600],
    ]);
    // Reservations shorten the ends; a stretch under the minimum is dropped.
    expect(freeStretches(inp, 1, { start: 600, end: 300 }, 400).map((s) => [s.from, s.to])).toEqual(
      [
        [600, 1200],
        [2100, 2700],
      ],
    );
    expect(freeStretches(inp, 1, { start: 900, end: 0 }, 400).map((s) => [s.from, s.to])).toEqual([
      [2100, 3000],
    ]);
  });
  it('every corner of a rectangle is an inside corner; an L room has one outside corner', () => {
    const r = rect();
    expect([0, 1, 2, 3].map((i) => insideCorner(r, i))).toEqual([true, true, true, true]);
    const l: Room = {
      ...r,
      outline: shapeOutline('l-shape', {
        width: 4000,
        depth: 3500,
        cutWidth: 1500,
        cutDepth: 1500,
        offset: 0,
      }),
    };
    expect(l.outline.map((_, i) => insideCorner(l, i)).filter((x) => !x)).toHaveLength(1);
    expect(
      cornerWalls(
        input(l),
        l.outline.map((_, i) => i),
      ),
    ).toHaveLength(5);
    expect(cornerWalls(input(r), [0, 1])).toEqual([0]);
    expect(cornerWalls(input(r), [0, 2])).toEqual([]);
    expect([turnFor([0, 1]), turnFor([1, 0]), turnFor([0, -1]), turnFor([-1, 0])]).toEqual([
      0, 90, 180, 270,
    ]);
  });
});

describe('suggestRoomMixes (ADR-173)', () => {
  it('a rectangle with a door and a window: 4 mixes, nothing over the door, bases under the window, no wall cabinet at it', () => {
    const inp = input(rect([door, window_]), { walls: [0, 1] });
    const r = suggestRoomMixes(inp);
    expect(r.problems).toEqual([]);
    expect(r.mixes).toHaveLength(MIXES_FIRST);
    for (const m of r.mixes) {
      expect(validateProject(m.project)).toEqual([]);
      expect(m.model.diagnostics.filter((d) => d.severity === 'error')).toEqual([]);
      expect(m.project.room).toBeTruthy();
      for (const it of m.project.items) {
        const b = placedBounds(it);
        const wall = it.rotationY === 0 ? 0 : 1;
        const [a0, a1] = along(inp.room, wall, b);
        if (wall === 1) expect(a1 <= 1200 || a0 >= 2100).toBe(true); // the door opening stays free
        if (wall === 0 && it.placement?.kind === 'wall')
          expect(a1 <= 1200 || a0 >= 2400).toBe(true);
      }
      // Base units run under the window.
      const under = m.project.items.filter((it) => {
        const [a0, a1] = along(inp.room, 0, placedBounds(it));
        return it.rotationY === 0 && it.placement?.kind === 'floor' && a1 > 1200 && a0 < 2400;
      });
      expect(under.length).toBeGreaterThan(0);
    }
  });
  it('an L room gets a corner cabinet at each inside corner, both runs start after it; the same input gives the same mixes', () => {
    const l: Room = {
      ...rect(),
      outline: shapeOutline('l-shape', {
        width: 4000,
        depth: 3500,
        cutWidth: 1500,
        cutDepth: 1500,
        offset: 0,
      }),
    };
    const inp = input(l);
    const r = suggestRoomMixes(inp);
    expect(r.problems).toEqual([]);
    expect(r.mixes.length).toBeGreaterThan(0);
    const m = r.mixes[0];
    expect(m.corners).toBe(5);
    expect(m.project.items.filter((i) => i.design.product.kind === 'corner')).toHaveLength(5);
    expect(m.model.diagnostics.filter((d) => d.severity === 'error')).toEqual([]);
    const again = suggestRoomMixes(inp);
    expect(again.mixes.map((x) => x.key)).toEqual(r.mixes.map((x) => x.key));
    expect(again.mixes.map((x) => x.summary)).toEqual(r.mixes.map((x) => x.summary));
    const none = suggestRoomMixes(input(l, { corner: 'none' }));
    expect(none.mixes[0].corners).toBe(0);
    expect(none.mixes[0].model.diagnostics.filter((d) => d.severity === 'error')).toEqual([]);
  });
  it('problems, not throws: no walls, a bad wall index, a width range that fits nothing', () => {
    expect(suggestRoomMixes(input(rect(), { walls: [] })).problems.map((p) => p.code)).toContain(
      'room-input',
    );
    expect(suggestRoomMixes(input(rect(), { walls: [9] })).problems.map((p) => p.code)).toContain(
      'room-input',
    );
    const r = suggestRoomMixes(input(rect(), { walls: [0], minWidth: 5000, maxWidth: 6000 }));
    expect(r.mixes).toEqual([]);
    expect(r.problems.length).toBeGreaterThan(0);
  });
  it('seeded random rooms never throw and never offer a mix with an error', () => {
    let seed = 5;
    const rnd = () => {
      seed = (seed * 1664525 + 1013904223) % 4294967296;
      return seed / 4294967296;
    };
    const N = Math.ceil(Number(process.env.FUZZ_N ?? 3000) / 150);
    for (let n = 0; n < N; n++) {
      const shape = (['rectangle', 'l-shape', 'u-shape', 'alcove'] as const)[Math.floor(rnd() * 4)];
      const width = 2500 + Math.floor(rnd() * 3000),
        depth = 2500 + Math.floor(rnd() * 2000);
      const room: Room = {
        height: 2400 + Math.floor(rnd() * 400),
        outline: shapeOutline(shape, {
          width,
          depth,
          cutWidth: 800 + Math.floor(rnd() * 1000),
          cutDepth: 800 + Math.floor(rnd() * 1000),
          offset: Math.floor(rnd() * 500),
        }),
        features: [],
      };
      const walls = room.outline.map((_, i) => i).filter(() => rnd() < 0.7);
      if (rnd() < 0.5)
        room.features.push({
          id: 'd',
          kind: 'door',
          label: 'Door',
          wall: walls[0] ?? 0,
          from: Math.floor(rnd() * 1000),
          width: 800,
          sill: 0,
          height: 2050,
          depth: 0,
        });
      const corner = (['blind', 'l-shape', 'none'] as const)[Math.floor(rnd() * 3)];
      const r = suggestRoomMixes(input(room, { walls, corner }));
      for (const m of r.mixes) {
        expect(validateProject(m.project)).toEqual([]);
        expect(
          buildProjectModel(m.project).diagnostics.filter((d) => d.severity === 'error'),
        ).toEqual([]);
      }
    }
  });
});
