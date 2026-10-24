/**
 * Opening clearance (ADR-0054): the space a door, drawer or flap needs in front of its piece to open, as
 * axis-aligned boxes in the piece's own coordinates (front towards +z). Derived from the built model, never stored.
 * A hinged door needs a box as deep as it is wide (the envelope of its swing); a drawer the depth of its box (full
 * travel); a flap its own height, upwards or downwards. Sliding doors move in their own plane and need none.
 */
import type { Box, FurnitureModel, Mm } from './types'

export interface Clearance {
  /** Panel id of the front that opens. */
  panelId: string
  label: string
  box: Box
  /** How far in front of the front it reaches, mm. */
  need: Mm
}

export function localClearances(model: FurnitureModel): Clearance[] {
  const out: Clearance[] = []
  for (const p of model.panels) {
    const b = p.box
    const front = b.z + b.d
    if (p.role === 'door') {
      if (/^Sliding door/.test(p.label)) continue
      if (/flap/i.test(p.label)) {
        const up = /^Lift-up/.test(p.label)
        out.push({ panelId: p.id, label: p.label, need: b.h, box: { x: b.x, y: up ? b.y : b.y - b.h, z: front, w: b.w, h: 2 * b.h, d: b.h } })
      } else out.push({ panelId: p.id, label: p.label, need: b.w, box: { x: b.x, y: b.y, z: front, w: b.w, h: b.h, d: b.w } })
    } else if (p.role === 'drawer-front' && !/^Fixed front/.test(p.label)) {
      const travel = Math.max(0, ...model.panels.filter(q => q.role === 'drawer-side' && q.nodeId === p.nodeId).map(q => q.box.d))
      if (travel > 0) out.push({ panelId: p.id, label: p.label, need: travel, box: { x: b.x, y: b.y, z: front, w: b.w, h: b.h, d: travel } })
    }
  }
  return out
}
