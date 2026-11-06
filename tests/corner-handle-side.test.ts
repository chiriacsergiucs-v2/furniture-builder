// Handle side on a turned corner wing (ADR-203, G-365): an L-corner's wing-B door is built as a cabinet front and turned
// a quarter onto the side wall (mirrored for a corner on the right). In room coordinates its handle holes must sit on
// the door edge away from its hinge edge, for both corner sides and both hinges.
import { describe, expect, it } from 'vitest';
import { buildModel } from '../src/core/build';
import { cornerDefaults, wrap } from '../src/core/design';
import type { CornerParams, Design, Handle, Panel } from '../src/core/types';

function lCorner(side: CornerParams['side'], hinge: 'left' | 'right', handle: Handle): Design {
  const p = cornerDefaults('l-shape');
  return wrap('C', {
    kind: 'corner',
    id: 'C',
    params: {
      ...p,
      side,
      wingInterior: {
        ...p.wingInterior,
        front: { kind: 'doors', count: 1, hinge },
        handle,
      },
    },
  });
}

/**
 * The hinge edge of the turned wing-B door in room z. The wing is built with its local x running from the open end
 * (x = 0) to the corner and turned so local x = 0 lands at the wing's far end from the back wall (largest z); a mirror
 * for a right-hand corner flips x only. So a door hinged on its built left keeps its hinge at the open end.
 */
const hingeZ = (door: Panel, hinge: 'left' | 'right') =>
  hinge === 'left' ? door.box.z + door.box.d : door.box.z;

/**
 * A handle hole's room z. Holes are measured from the front's left edge as seen standing in front of it (ADR-024):
 * a front facing +x (corner on the left) has its left at the larger z, a front facing −x (corner on the right) at the
 * smaller z.
 */
const holeZ = (door: Panel, u: number, facesPlusX: boolean) =>
  facesPlusX ? door.box.z + door.box.d - u : door.box.z + u;

describe('the wing-B handle sits away from its hinge (ADR-203, G-365)', () => {
  for (const side of ['left', 'right'] as const)
    for (const hinge of ['left', 'right'] as const)
      for (const handle of [{ kind: 'bar', holeSpacing: 128 }, { kind: 'knob' }] as Handle[])
        it(`corner on the ${side}, hinged ${hinge}, ${handle.kind}`, () => {
          const m = buildModel(lCorner(side, hinge, handle));
          expect(m.diagnostics.filter((d) => d.severity === 'error')).toEqual([]);
          const doors = m.panels.filter((x) => x.role === 'door' && x.id.startsWith('C/b:'));
          expect(doors).toHaveLength(1);
          const door = doors[0];
          // Turned onto the side wall: thin across x, its width along z.
          expect(door.thicknessAxis).toBe('x');
          // Facing into the room: the door is on the open side of the wing's carcass.
          const carcass = m.panels.filter((x) => x.id.startsWith('C/b:') && x.role !== 'door');
          const cx = Math.min(...carcass.map((x) => x.box.x)),
            cX = Math.max(...carcass.map((x) => x.box.x + x.box.w));
          const facesPlusX = side === 'left';
          const doorMid = door.box.x + door.box.w / 2;
          if (facesPlusX) expect(doorMid).toBeGreaterThan((cx + cX) / 2);
          else expect(doorMid).toBeLessThan((cx + cX) / 2);
          expect(door.handleHoles?.at.length).toBeGreaterThan(0);
          const hz = hingeZ(door, hinge);
          const mid = door.box.z + door.box.d / 2;
          for (const [u] of door.handleHoles!.at) {
            const z = holeZ(door, u, facesPlusX);
            expect(z).toBeGreaterThan(door.box.z);
            expect(z).toBeLessThan(door.box.z + door.box.d);
            // On the half of the door away from the hinge edge.
            expect(Math.abs(z - hz)).toBeGreaterThan(Math.abs(mid - hz));
          }
        });

  it('flipping the hinge moves the handle to the other edge', () => {
    for (const side of ['left', 'right'] as const) {
      const doorOf = (hinge: 'left' | 'right') =>
        buildModel(lCorner(side, hinge, { kind: 'knob' })).panels.find(
          (x) => x.role === 'door' && x.id.startsWith('C/b:'),
        )!;
      const l = doorOf('left'),
        r = doorOf('right');
      const z = (d: Panel) => holeZ(d, d.handleHoles!.at[0][0], side === 'left');
      // Hinged at the open end (left) the handle is towards the corner (smaller z), and the other way round.
      expect(z(l)).toBeLessThan(z(r));
    }
  });
});
