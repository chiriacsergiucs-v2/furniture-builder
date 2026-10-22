import type { PartialModel } from './cabinet'
import { box } from './geometry'
import type { Material, PanelSetParams } from './types'

/**
 * Panel set (ADR-0032): every part lies flat in one pile, largest at the bottom, back-left corners aligned. The pile
 * shows sizes and boards honestly; how the parts go together is not modelled, and a warning says so.
 */
export function buildPanelSet(p: PanelSetParams, id: string, materials: Map<string, Material>): PartialModel {
  const out: PartialModel = { panels: [], spaces: [], hardware: [], diagnostics: [] }
  if (!p.panels.length) {
    out.diagnostics.push({ severity: 'error', code: 'no-panels', message: 'This panel set has no panels.', nodeId: id })
    return out
  }
  // Stable order: larger face first, then as listed.
  const order = p.panels.map((lp, i) => ({ lp, i })).sort((a, b) => b.lp.length * b.lp.width - a.lp.length * a.lp.width || a.i - b.i)
  let y = 0
  for (const { lp } of order) {
    const m = materials.get(lp.materialId)
    if (!m) {
      out.diagnostics.push({ severity: 'error', code: 'material-missing', message: `${lp.name} uses a board that does not exist in the design.`, nodeId: id })
      continue
    }
    for (let k = 0; k < lp.quantity; k++) {
      out.panels.push({
        id: `${id}/${lp.id}/${k}`, nodeId: id, role: 'loose', label: lp.name, materialId: m.id,
        box: box(0, y, 0, lp.length, m.thickness, lp.width), thicknessAxis: 'y', grainAxis: 'x', banded: [],
      })
      y += m.thickness
    }
  }
  out.diagnostics.push({
    severity: 'warning', code: 'not-assembled',
    message: 'Loose panels, shown in one pile: how they go together is not in the design. Edge banding is not set.', nodeId: id,
  })
  return out
}
