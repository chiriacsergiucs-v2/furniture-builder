// ADR-232 (N237): the room auto-size, the seating defaults and the plan's front edge live in core. The expected
// numbers are the ones the components computed before the move (RoomSection in Project.tsx, the seating toggles in
// Editors.tsx, the plan front-line ternary in Project.tsx and Models3D.tsx); they must not change.
import { describe, expect, it } from 'vitest';
import { suggestRoomSize } from '../src/core/room';
import { seatingDefaults } from '../src/core/frame';
import { frontEdge } from '../src/core/geometry';

const piece = (x: number, z: number, w: number, d: number) => ({ bounds: { x, z, w, d } });

describe('suggestRoomSize (ADR-232)', () => {
  it('an empty room is 3000 × 3000 with 1000 mm cuts and offset', () => {
    expect(suggestRoomSize([])).toEqual({
      width: 3000,
      depth: 3000,
      cutWidth: 1000,
      cutDepth: 1000,
      offset: 1000,
    });
  });

  it('one small piece keeps the 3000 mm floor', () => {
    expect(suggestRoomSize([piece(0, 0, 600, 560)])).toEqual({
      width: 3000,
      depth: 3000,
      cutWidth: 1000,
      cutDepth: 1000,
      offset: 1000,
    });
  });

  it('a wide piece rounds its right edge up to 100 mm', () => {
    expect(suggestRoomSize([piece(2900, 0, 601, 560)]).width).toBe(3600);
    expect(suggestRoomSize([piece(0, 0, 3000, 560), piece(3000, 0, 400, 560)]).width).toBe(3400);
  });

  it('a deep piece adds 1000 mm in front and rounds up to 100 mm', () => {
    expect(suggestRoomSize([piece(0, 1500, 600, 601)]).depth).toBe(3200);
    expect(suggestRoomSize([piece(0, 0, 600, 2000)]).depth).toBe(3000);
    expect(suggestRoomSize([piece(0, 0, 600, 2001)]).depth).toBe(3100);
  });
});

describe('seatingDefaults (ADR-232)', () => {
  it('a new reclining back: positions 100, 120, 150 at the first, a 380 mm footrest at 0, 45, 90°', () => {
    expect(seatingDefaults(1200).recline).toEqual({
      positions: [100, 120, 150],
      at: 0,
      footrest: { length: 380, angles: [0, 45, 90] },
    });
  });

  it('a footrest added to a recline: 380 mm, angles spread from 0 to 90° over its positions', () => {
    expect(seatingDefaults(1200, undefined, [100, 120, 150]).footrest).toEqual({
      length: 380,
      angles: [0, 45, 90],
    });
    expect(seatingDefaults(1200, undefined, [100, 130]).footrest.angles).toEqual([0, 90]);
    expect(seatingDefaults(1200, undefined, [110]).footrest.angles).toEqual([0]);
    expect(seatingDefaults(1200, undefined, [100, 110, 120, 150]).footrest.angles).toEqual([
      0, 30, 60, 90,
    ]);
  });

  it('arm rests: 220 mm above the seat, a 450 mm seat when there is none', () => {
    expect(seatingDefaults(1200, 450).arms).toEqual({ height: 670 });
    expect(seatingDefaults(1200, 420).arms).toEqual({ height: 640 });
    expect(seatingDefaults(1200).arms).toEqual({ height: 670 });
  });

  it('a lifting backrest: a third of the width, at most 650 mm, positions 100, 120, 150 at the last', () => {
    // Below the cap: width / 3, floored.
    expect(seatingDefaults(1000).backrest).toEqual({
      length: 333,
      positions: [100, 120, 150],
      at: 2,
    });
    // At the boundary: 1950 / 3 = 650.
    expect(seatingDefaults(1950).backrest.length).toBe(650);
    // Above it: capped at 650.
    expect(seatingDefaults(2400).backrest.length).toBe(650);
  });

  it('every call returns fresh arrays (no shared state between pieces)', () => {
    const a = seatingDefaults(1200),
      b = seatingDefaults(1200);
    expect(a.recline.positions).not.toBe(b.recline.positions);
    expect(a.backrest.positions).not.toBe(b.backrest.positions);
  });
});

describe('frontEdge (ADR-232)', () => {
  const b = { x: 100, z: 200, w: 600, d: 400 };
  it('0°: the edge away from the back wall', () => {
    expect(frontEdge(b, 0)).toEqual([100, 600, 700, 600]);
  });
  it('90°: the right edge', () => {
    expect(frontEdge(b, 90)).toEqual([700, 200, 700, 600]);
  });
  it('180°: the back edge', () => {
    expect(frontEdge(b, 180)).toEqual([100, 200, 700, 200]);
  });
  it('270°: the left edge', () => {
    expect(frontEdge(b, 270)).toEqual([100, 200, 100, 600]);
  });
});
