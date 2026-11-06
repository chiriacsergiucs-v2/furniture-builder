// ADR-173: Fill the room — whole-room mixes over every wall, doors and windows kept free, corner cabinets at the
// inside corners, every offered mix error-free, deterministic; random rooms never throw.
// ADR-177: a wall corner cabinet above each corner cabinet (blind → wall blind, L and diagonal → wall L), the wall
// rows meeting it; a window splits the wall row into rows on both sides that stop at its edges.
import { describe, expect, it } from 'vitest';
import {
  buildProjectModel,
  placedBounds,
  validateProject,
  type ProjectItem,
} from '../src/core/project';
import {
  cornerWalls,
  freeStretches,
  insideCorner,
  checkRoom,
  suggestRoomMixes,
  tallAtRight,
  turnFor,
  wallRowParts,
  type RoomInput,
} from '../src/core/roomfill';
import { shapeOutline, wallBox, wallLength, type Room, type RoomFeature } from '../src/core/room';
import { BASE_HEIGHT, MIXES_FIRST, WALL_HEIGHT } from '../src/core/wallfill';

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
    // Five floor corner cabinets; ADR-177 hangs a wall corner above each of them.
    const corners = m.project.items.filter((i) => i.design.product.kind === 'corner');
    expect(corners.filter((i) => i.placement?.kind !== 'wall')).toHaveLength(5);
    expect(corners.filter((i) => i.placement?.kind === 'wall')).toHaveLength(5);
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
      // ADR-177: windows on the walls (high and low sills) and every corner kind, with and without a wall row.
      if (rnd() < 0.6) {
        const wall = walls[Math.floor(rnd() * walls.length)] ?? 0;
        room.features.push({
          id: 'w',
          kind: 'window',
          label: 'Window',
          wall,
          from: Math.floor(rnd() * Math.max(1, wallLength(room, wall) - 600)),
          width: 600 + Math.floor(rnd() * 900),
          sill: rnd() < 0.8 ? 1000 : 500,
          height: 1200,
          depth: 0,
        });
      }
      const corner = (['blind', 'l-shape', 'diagonal', 'none'] as const)[Math.floor(rnd() * 4)];
      const wallRow = rnd() < 0.85 ? 'always' : 'never';
      const inp = input(room, { walls, corner, wallRow });
      const r = suggestRoomMixes(inp);
      for (const m of r.mixes) {
        expect(validateProject(m.project)).toEqual([]);
        expect(
          buildProjectModel(m.project).diagnostics.filter((d) => d.severity === 'error'),
        ).toEqual([]);
        if (corner === 'none' || wallRow === 'never')
          expect(wallCorners(m.project.items)).toEqual([]);
      }
      // Same input, same mixes.
      if (n % 10 === 0)
        expect(suggestRoomMixes(inp).mixes.map((m) => m.key)).toEqual(r.mixes.map((m) => m.key));
    }
  });
});

/** The wall corner cabinets of a project: corner pieces hung on the wall. */
const wallCorners = (items: ProjectItem[]) =>
  items.filter((i) => i.design.product.kind === 'corner' && i.placement?.kind === 'wall');
/** The wall-row cabinets (not corners, not top boxes): cabinets hung on the wall. */
const wallRow = (items: ProjectItem[]) =>
  items.filter((i) => i.design.product.kind === 'cabinet' && i.placement?.kind === 'wall');
const lRoom = (): Room => ({
  ...rect(),
  outline: shapeOutline('l-shape', {
    width: 4000,
    depth: 3500,
    cutWidth: 1500,
    cutDepth: 1500,
    offset: 0,
  }),
});

describe('wall corner cabinets (ADR-177)', () => {
  it('an L room with a blind corner gets a wall blind corner above each corner cabinet; L and diagonal get a wall L corner; none gets none', () => {
    const l = lRoom();
    const blind = suggestRoomMixes(input(l, { corner: 'blind' }));
    expect(blind.mixes.length).toBeGreaterThan(0);
    for (const m of blind.mixes) {
      expect(m.model.diagnostics.filter((d) => d.severity === 'error')).toEqual([]);
      const wc = wallCorners(m.project.items);
      expect(wc).toHaveLength(m.corners);
      for (const it of wc) {
        expect(it.design.name).toBe('Wall blind corner');
        const p = it.design.product;
        expect(p.kind === 'corner' && p.params.variant).toBe('blind');
        // At the wall row's height and mount: its top at the wall height, as deep as the wall cabinets.
        expect(p.kind === 'corner' && p.params.height).toBe(WALL_HEIGHT);
        expect(p.kind === 'corner' && p.params.depth).toBe(320);
        expect(it.position.y).toBe(l.height - WALL_HEIGHT);
      }
    }
    for (const corner of ['l-shape', 'diagonal'] as const) {
      const r = suggestRoomMixes(input(l, { corner }));
      expect(r.mixes.length).toBeGreaterThan(0);
      for (const m of r.mixes) {
        expect(m.model.diagnostics.filter((d) => d.severity === 'error')).toEqual([]);
        const wc = wallCorners(m.project.items);
        expect(wc).toHaveLength(m.corners);
        for (const it of wc) {
          expect(it.design.name).toBe('Wall L corner');
          const p = it.design.product;
          expect(p.kind === 'corner' && p.params.variant).toBe('l-shape');
          // The catalog's 600 × 600 wall L at the wall cabinets' 320 depth.
          expect(p.kind === 'corner' && [p.params.width, p.params.wingWidth]).toEqual([600, 600]);
        }
      }
    }
    const none = suggestRoomMixes(input(l, { corner: 'none' }));
    expect(none.mixes.length).toBeGreaterThan(0);
    for (const m of none.mixes) expect(wallCorners(m.project.items)).toEqual([]);
    const never = suggestRoomMixes(input(l, { corner: 'blind', wallRow: 'never' }));
    for (const m of never.mixes) expect(wallCorners(m.project.items)).toEqual([]);
  });
  it('the wall corners come out hung (mount wall) with no placement-not-hung warning, for every corner kind', () => {
    for (const corner of ['blind', 'l-shape', 'diagonal'] as const) {
      const r = suggestRoomMixes(input(lRoom(), { corner }));
      expect(r.mixes.length, corner).toBeGreaterThan(0);
      for (const m of r.mixes) {
        const wc = wallCorners(m.project.items);
        expect(wc.length, corner).toBeGreaterThan(0);
        for (const it of wc) {
          const p = it.design.product;
          expect(p.kind === 'corner' && p.params.mount, corner).toBe('wall');
          expect(p.kind === 'corner' && p.params.mountHeight).toBe(it.position.y);
        }
        const all = [...m.model.diagnostics, ...m.warnings].map((d) => d.code);
        expect(all, corner).not.toContain('placement-not-hung');
      }
    }
  });
  it('the wall rows start where the wall corner ends on each wall', () => {
    for (const corner of ['blind', 'l-shape'] as const) {
      const inp = input(rect(), { walls: [0, 1], corner, tallCount: 0 });
      const r = suggestRoomMixes(inp);
      expect(r.mixes.length).toBeGreaterThan(0);
      for (const m of r.mixes) {
        const [wc] = wallCorners(m.project.items);
        expect(wc).toBeTruthy();
        const cb = placedBounds(wc);
        const row = wallRow(m.project.items);
        const on0 = row
          .filter((i) => i.rotationY === 0)
          .map((i) => along(inp.room, 0, placedBounds(i)));
        const on1 = row
          .filter((i) => i.rotationY !== 0)
          .map((i) => along(inp.room, 1, placedBounds(i)));
        // Wall 0 ends in the corner: its row ends at the wall corner's near edge; wall 1's row starts at its far edge.
        expect(Math.max(...on0.map(([, b]) => b))).toBe(along(inp.room, 0, cb)[0]);
        expect(Math.min(...on1.map(([a]) => a))).toBe(along(inp.room, 1, cb)[1]);
      }
    }
  });
});

describe('wall rows beside a window (ADR-177)', () => {
  it('a wall with a centred window gets wall cabinets on both sides, none over it, the nearest at each window edge', () => {
    // Wall 0 is 3600 long; the window runs 1200..2400.
    for (const tallCount of [0, undefined]) {
      const inp = input(rect([window_]), { walls: [0], tallCount });
      const r = suggestRoomMixes(inp);
      expect(r.mixes.length).toBeGreaterThan(0);
      for (const m of r.mixes) {
        expect(m.model.diagnostics.filter((d) => d.severity === 'error')).toEqual([]);
        const spans = wallRow(m.project.items).map((i) => along(inp.room, 0, placedBounds(i)));
        for (const [a, b] of spans) expect(b <= 1200 || a >= 2400).toBe(true);
        const left = spans.filter(([, b]) => b <= 1200),
          right = spans.filter(([a]) => a >= 2400);
        if (tallCount === 0) {
          expect(left.length).toBeGreaterThan(0);
          expect(right.length).toBeGreaterThan(0);
        }
        // The nearest wall cabinet on each side is within one cabinet step of the window edge.
        if (left.length) expect(1200 - Math.max(...left.map(([, b]) => b))).toBeLessThan(400);
        if (right.length) expect(Math.min(...right.map(([a]) => a)) - 2400).toBeLessThan(400);
        if (tallCount === 0) {
          expect(Math.max(...left.map(([, b]) => b))).toBe(1200);
          expect(Math.min(...right.map(([a]) => a))).toBe(2400);
        }
      }
    }
  });
  it('wallRowParts: each part between stops is its own row; a tall cut by a stop gets no top box; a reach fills up to a wall corner', () => {
    const wi = { width: 2400, depth: 560, height: 2500, minWidth: 400, maxWidth: 1200 };
    const slots = [
      { kind: 'door' as const, width: 800 },
      { kind: 'tall' as const, width: 600 },
      { kind: 'shelves' as const, width: 1000 },
    ];
    const cut = wallRowParts(slots, { from: 0, to: 2400 }, 0, 2400, [[1000, 1400]], wi);
    expect(cut.map((w) => [w.from, w.width])).toEqual([
      [0, 800],
      [1400, 500],
      [1900, 500],
    ]);
    expect(cut.some((w) => w.variant === 'top-box')).toBe(false);
    // Without the stop the tall keeps its top box (when there is room for one) and nothing hangs over it.
    const whole = wallRowParts(slots, { from: 0, to: 2400 }, 0, 2400, [], wi);
    for (const w of whole.filter((x) => x.variant !== 'top-box'))
      expect(w.from + w.width <= 800 || w.from >= 1400).toBe(true);
    for (const w of whole.filter((x) => x.variant === 'top-box')) expect(w.over).toBe(1);
    // A reach before the stretch (to a wall corner) joins the first run.
    const reach = wallRowParts(
      [{ kind: 'shelves', width: 900 }],
      { from: 300, to: 1200 },
      0,
      1200,
      [],
      wi,
    );
    expect(reach.map((w) => [w.from, w.width])).toEqual([
      [0, 600],
      [600, 600],
    ]);
    // A part too narrow for a wall cabinet stays empty.
    expect(
      wallRowParts(
        [{ kind: 'shelves', width: 600 }],
        { from: 0, to: 600 },
        0,
        600,
        [[300, 600]],
        wi,
      ),
    ).toEqual([]);
  });
});

// ADR-193: the tall cabinet tried at both ends of each stretch on auto; the room's sizes checked.
describe('ADR-193: tall side and room sizes', () => {
  const sizes = { width: 3600, depth: 3000, cutWidth: 1500, cutDepth: 1500, offset: 0 };
  // The wizard's default room (Fill the room's start values).
  const typed: Room = {
    height: 2500,
    outline: shapeOutline('rectangle', sizes),
    features: [],
    shape: { kind: 'rectangle', sizes },
  };
  const wizard = (over: Partial<RoomInput> = {}): RoomInput => ({
    room: typed,
    walls: [0, 1, 2, 3],
    depth: 560,
    minWidth: 400,
    maxWidth: 1200,
    baseHeight: BASE_HEIGHT,
    wallRow: 'always',
    wallHeight: WALL_HEIGHT,
    corner: 'blind',
    atLeast: {},
    ...over,
  });
  it('the default room (3600 × 3000, 4 walls): the first card has at most 4 warnings', () => {
    const r = suggestRoomMixes(wizard());
    expect(r.problems).toEqual([]);
    expect(r.mixes.length).toBe(MIXES_FIRST);
    expect(r.mixes[0].warnings.length).toBeLessThanOrEqual(4);
    // The clear side is the right end here: the tall cabinet no longer stands against the corner's door.
    expect(r.mixes[0].key).toMatch(/\|right/);
    expect(r.mixes[0].warnings.map((w) => w.message).join('\n')).not.toMatch(
      /cannot open fully: it hits Tall cabinet/,
    );
  });
  it('tallPosition left is still obeyed: no tall moved to the right end', () => {
    const r = suggestRoomMixes(wizard({ tallPosition: 'left' }));
    expect(r.mixes.length).toBeGreaterThan(0);
    for (const m of r.mixes) expect(m.key).not.toMatch(/\|right/);
  });
  // The fastest of 5 warm runs is its own cost; a busy test machine slows single runs (retried, never loosened).
  it('the 4-wall default stays under 100 ms', { retry: 2 }, () => {
    suggestRoomMixes(wizard());
    const runs = [0, 1, 2, 3, 4].map(() => {
      const t0 = performance.now();
      suggestRoomMixes(wizard());
      return performance.now() - t0;
    });
    expect(Math.min(...runs)).toBeLessThan(100);
  });
  it('tallAtRight: the one tall cabinet moves to the right end, a new signature; none without a single tall', () => {
    const c = {
      slots: [
        { kind: 'tall' as const, width: 600 },
        { kind: 'drawers' as const, width: 500 },
        { kind: 'door' as const, width: 400 },
      ],
      score: [0],
      signature: 's',
    };
    expect(tallAtRight(c)).toEqual({
      ...c,
      slots: [c.slots[1], c.slots[2], c.slots[0]],
      signature: 's|right',
    });
    expect(tallAtRight({ ...c, slots: [c.slots[1], c.slots[0]] })).toBeNull();
    expect(tallAtRight({ ...c, slots: [c.slots[0], c.slots[1], c.slots[0]] })).toBeNull();
    expect(tallAtRight({ ...c, slots: [c.slots[1]] })).toBeNull();
  });
  it('a wrong room size is named by checkRoom, never a "NaN mm" wall or a mix', () => {
    for (const width of [Number('abc'), 0, -100]) {
      const s = { ...sizes, width };
      const room: Room = {
        ...typed,
        outline: shapeOutline('rectangle', s),
        shape: { kind: 'rectangle', sizes: s },
      };
      const r = suggestRoomMixes(wizard({ room }));
      expect(r.mixes).toEqual([]);
      expect(r.problems.map((p) => p.message)).toEqual([
        'Width must be a whole number of mm above 0.',
      ]);
      expect(checkRoom(wizard({ room }))[0]).toMatchObject({ code: 'room-size', field: 'width' });
    }
    // A room height of 0 is named once, as the room's height.
    const low = suggestRoomMixes(wizard({ room: { ...typed, height: 0 } }));
    expect(low.problems.map((p) => p.message)).toEqual([
      'Room height must be a whole number of mm above 0.',
    ]);
  });
});
