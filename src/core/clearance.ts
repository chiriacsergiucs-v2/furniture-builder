/**
 * Opening clearance (ADR-057): the space a door, drawer or flap needs in front of its piece to open, as
 * axis-aligned boxes in the piece's own coordinates (front towards +z). Derived from the built model, never stored.
 * A hinged door needs a box as deep as it is wide (the envelope of its swing); a drawer the depth of its box (full
 * travel); a flap its own height, upwards or downwards. Sliding doors move in their own plane and need none.
 * G-011: a hinged door's box also carries its swing, the quarter circle about its hinge edge (`arc`); the check counts
 * only what reaches into that circle. The handle schedule (ADR-024) holds no handle depth, so no handle projection is
 * added to the radius: none is invented (ADR-010). A shaped door (the diagonal corner door, tilted) keeps the box.
 */
import type { Box, FurnitureModel, Mm } from './types';

export interface Clearance {
  /** Panel id of the front that opens. */
  panelId: string;
  label: string;
  box: Box;
  /** How far in front of the front it reaches, mm. */
  need: Mm;
  /**
   * A hinged door's swing (G-011): the quarter circle about `pivot` (plan x, z: the hinge edge on the front face, a
   * corner of `box`) with squared radius `r2`, inside `box`. Absent = the whole box is needed.
   */
  arc?: { pivot: [Mm, Mm]; r2: number };
}

/**
 * The hinge side of door panel `p` (left or right as seen from the front), from the model: a pair hinges on its outer
 * edges; a single door on the side its hinge plates go on (the hinge schedule's panels, ADR-207). Null when the model
 * does not say (the plates' panel is in another piece, or the door is shaped or faces another way).
 */
export function hingeSide(
  model: FurnitureModel,
  p: FurnitureModel['panels'][number],
): 'left' | 'right' | null {
  if (p.role !== 'door' || p.shape || p.thicknessAxis !== 'z') return null;
  if (p.label === 'Door left') return 'left';
  if (p.label === 'Door right') return 'right';
  if (p.label !== 'Door') return null;
  const plates = model.hardware.find((h) => h.kind === 'hinge' && h.nodeId === p.nodeId)?.panelIds;
  const at = (plates ?? [])
    .map((id) => model.panels.find((q) => q.id === id)?.box)
    .filter((b): b is Box => !!b);
  if (!at.length) return null;
  // Twice the centres, so the comparison stays in whole millimetres.
  const left = at.every((b) => 2 * b.x + b.w < 2 * p.box.x + p.box.w);
  const right = at.every((b) => 2 * b.x + b.w > 2 * p.box.x + p.box.w);
  return left ? 'left' : right ? 'right' : null;
}

/**
 * Whether box `hit` reaches into clearance `c` (G-011): for a door swing, whether the part of `hit` inside the box comes
 * nearer the hinge than the door's width (squared distances, exact for whole millimetres); touching is not reaching.
 * Callers have already found that the boxes overlap; a turned box (ADR-121) keeps the box test.
 */
export function reachesArc(c: Clearance, hit: Box): boolean {
  if (!c.arc || c.box.yaw || hit.yaw) return true;
  const b = c.box;
  const x0 = Math.max(hit.x, b.x),
    x1 = Math.min(hit.x + hit.w, b.x + b.w),
    z0 = Math.max(hit.z, b.z),
    z1 = Math.min(hit.z + hit.d, b.z + b.d);
  const [px, pz] = c.arc.pivot;
  const dx = px < x0 ? x0 - px : px > x1 ? px - x1 : 0;
  const dz = pz < z0 ? z0 - pz : pz > z1 ? pz - z1 : 0;
  return dx * dx + dz * dz < c.arc.r2;
}

export function localClearances(model: FurnitureModel): Clearance[] {
  const out: Clearance[] = [];
  for (const p of model.panels) {
    const b = p.box;
    const front = b.z + b.d;
    // The role says door or drawer front; only the label tells a sliding door, a flap, a lift-up flap or a fixed front
    // apart, so these four tests stay on the English label until a panel kind field exists (ADR-225, G-492).
    if (p.role === 'door') {
      if (/^Sliding door/.test(p.label)) continue; // G-492
      // G-492: a flap and a lift-up flap are told apart by label only.
      if (/flap/i.test(p.label)) {
        const up = /^Lift-up/.test(p.label); // G-492
        out.push({
          panelId: p.id,
          label: p.label,
          need: b.h,
          box: { x: b.x, y: up ? b.y : b.y - b.h, z: front, w: b.w, h: 2 * b.h, d: b.h },
        });
      } else {
        const hinge = hingeSide(model, p);
        out.push({
          panelId: p.id,
          label: p.label,
          need: b.w,
          box: { x: b.x, y: b.y, z: front, w: b.w, h: b.h, d: b.w },
          ...(hinge
            ? { arc: { pivot: [hinge === 'left' ? b.x : b.x + b.w, front], r2: b.w * b.w } }
            : {}),
        });
      }
    } else if (p.role === 'drawer-front' && !/^Fixed front/.test(p.label)) {
      // G-492: a fixed front has no travel; only its label says so.
      const travel = Math.max(
        0,
        ...model.panels
          .filter((q) => q.role === 'drawer-side' && q.nodeId === p.nodeId)
          .map((q) => q.box.d),
      );
      if (travel > 0)
        out.push({
          panelId: p.id,
          label: p.label,
          need: travel,
          box: { x: b.x, y: b.y, z: front, w: b.w, h: b.h, d: travel },
        });
    }
  }
  return out;
}
