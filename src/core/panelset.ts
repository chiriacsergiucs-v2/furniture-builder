import type { PartialModel } from './cabinet'
import { box } from './geometry'
import type { Box, LoosePanel, Material, Panel, PanelLie, PanelSetParams } from './types'

/** Box of a placed panel: length, width and thickness along the axes its lie names. */
export function placedBox(lp: LoosePanel, t: number): Box | null {
  if (!lp.place) return null
  const { x, y, z, lie } = lp.place
  const L = lp.length, W = lp.width
  const dims: Record<PanelLie, [number, number, number]> = {
    'flat-x': [L, t, W], 'flat-z': [W, t, L], 'edge-x': [L, W, t], 'edge-z': [t, W, L], 'up-x': [W, L, t], 'up-z': [t, L, W],
  }
  const [w, h, d] = dims[lie]
  return box(x, y, z, w, h, d)
}
const THICKNESS_AXIS: Record<PanelLie, Panel['thicknessAxis']> = { 'flat-x': 'y', 'flat-z': 'y', 'edge-x': 'z', 'edge-z': 'x', 'up-x': 'z', 'up-z': 'x' }
const GRAIN_AXIS: Record<PanelLie, Panel['grainAxis']> = { 'flat-x': 'x', 'flat-z': 'z', 'edge-x': 'x', 'edge-z': 'z', 'up-x': 'y', 'up-z': 'y' }

/**
 * Panel set (ADR-041): parts known by their cut sizes. Parts with a known place (amendment 2026-10-23) are built
 * where they sit; every other part lies flat in one pile beside them, largest at the bottom. Screwed joints between
 * placed parts are scheduled; screw type, length and count are the user's choice (ADR-010).
 */
export function buildPanelSet(p: PanelSetParams, id: string, materials: Map<string, Material>): PartialModel {
  const out: PartialModel = { panels: [], spaces: [], hardware: [], diagnostics: [] }
  if (!p.panels.length) {
    out.diagnostics.push({ severity: 'error', code: 'no-panels', message: 'This panel set has no panels.', nodeId: id })
    return out
  }
  const placed = p.panels.filter(lp => lp.place)
  let pileX = 0
  for (const lp of placed) {
    const m = materials.get(lp.materialId)
    if (!m) { out.diagnostics.push({ severity: 'error', code: 'material-missing', message: `${lp.name} uses a board that does not exist in the design.`, nodeId: id }); continue }
    const b = placedBox(lp, m.thickness)!
    out.panels.push({ id: `${id}/${lp.id}/0`, nodeId: id, role: 'loose', label: lp.name, materialId: m.id, box: b,
      thicknessAxis: THICKNESS_AXIS[lp.place!.lie], grainAxis: GRAIN_AXIS[lp.place!.lie], banded: [] })
    pileX = Math.max(pileX, b.x + b.w)
  }
  // The pile stands clear of the assembly, 100 mm to its right.
  const x0 = placed.length ? pileX + 100 : 0
  // Stable order: larger face first, then as listed.
  const loose = p.panels.filter(lp => !lp.place)
  const order = loose.map((lp, i) => ({ lp, i })).sort((a, b) => b.lp.length * b.lp.width - a.lp.length * a.lp.width || a.i - b.i)
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
        box: box(x0, y, 0, lp.length, m.thickness, lp.width), thicknessAxis: 'y', grainAxis: 'x', banded: [],
      })
      y += m.thickness
    }
  }
  const names = new Map(p.panels.map(lp => [lp.id, lp]))
  for (const j of p.joints ?? []) {
    const a = names.get(j.a), b = names.get(j.b)
    if (!a?.place || !b?.place) {
      out.diagnostics.push({ severity: 'error', code: 'joint-unplaced', message: 'A screwed joint names a panel that is missing or not placed.', nodeId: id })
      continue
    }
    out.hardware.push({ nodeId: id, kind: 'screws', label: `Screws: ${a.name} to ${b.name}`, quantity: 1, note: `${a.name} – ${b.name}` })
  }
  if (loose.length) {
    out.diagnostics.push({
      severity: 'warning', code: 'not-assembled',
      message: placed.length
        ? `${loose.reduce((n, lp) => n + lp.quantity, 0)} parts have no known place and are shown in a pile beside the assembly. Edge banding is not set.`
        : 'Loose panels, shown in one pile: how they go together is not in the design. Edge banding is not set.', nodeId: id,
    })
  }
  if (out.hardware.length) out.diagnostics.push({ severity: 'warning', code: 'screws-choose', message: 'Screwed joints: choose the screw type, length and number for the board (guidance, not listed).', nodeId: id })
  return out
}
