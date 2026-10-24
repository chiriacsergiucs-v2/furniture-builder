/**
 * Exploded view (ADR-014): panels pushed apart so each one can be seen on its own. Only positions change, never
 * sizes; the result is for the 3D preview and never feeds parts, sheets or checks.
 *
 * Every panel's centre moves away from its piece's centre by `amount` times their distance, and each piece's centre
 * moves away from the room's centre the same way. Scaling distances (not sizes) keeps panels that did not overlap
 * apart, and opens a gap between panels that touched.
 */
import { translate, union } from './geometry';
import type { Box, Panel } from './types';

/** Default spread: centres move half their distance again. */
export const EXPLODE = 0.5;

/** Twice the centre, so integer boxes give integer centres. */
const centre2 = (b: Box) => [2 * b.x + b.w, 2 * b.y + b.h, 2 * b.z + b.d];
const away = (from: number[], about: number[], k: number) =>
  from.map((v, i) => Math.round(((v - about[i]) * k) / 2));

/**
 * Explode one or more pieces (one group of panels per piece). The lowest panel stays at the original floor height,
 * so nothing drops below the floor.
 */
export function explode(pieces: Panel[][], amount = EXPLODE): Panel[] {
  const all = pieces.flat();
  if (!all.length || amount <= 0) return all;
  const room = union(all.map((p) => p.box));
  const rc = centre2(room);
  const out = pieces.flatMap((group) => {
    if (!group.length) return [];
    const gc = centre2(union(group.map((p) => p.box)));
    const [gx, gy, gz] = away(gc, rc, amount);
    return group.map((p) => {
      const [px, py, pz] = away(centre2(p.box), gc, amount);
      return { ...p, box: translate(p.box, px + gx, py + gy, pz + gz) };
    });
  });
  const lift = room.y - union(out.map((p) => p.box)).y;
  return lift ? out.map((p) => ({ ...p, box: translate(p.box, 0, lift, 0) })) : out;
}
