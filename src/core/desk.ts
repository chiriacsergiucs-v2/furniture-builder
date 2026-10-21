import { buildCabinet, type PartialModel } from './cabinet'
import { pedestalRoot } from './design'
import { box } from './geometry'
import type { CabinetParams, DeskParams, Material, Panel } from './types'

/**
 * Desk = worktop + supports. Supports are panel gables or drawer pedestals; a pedestal is a real
 * cabinet built by the same generator (shared children, specialist root).
 */
export function pedestalParams(p: DeskParams, side: 'left' | 'right', deskId: string, height: number, depth: number): CabinetParams {
  return {
    width: p.pedestal.width, height, depth,
    bodyMaterialId: p.bodyMaterialId, frontMaterialId: p.frontMaterialId, backMaterialId: p.drawers.bottomMaterialId,
    top: 'between', back: 'applied', backInset: 0, plinthHeight: 0, plinthSetback: 0,
    frontGap: p.frontGap, shelfSetback: 0, drawers: p.drawers,
    interior: pedestalRoot(p, side, deskId),
  }
}

export function buildDesk(p: DeskParams, deskId: string, materials: Map<string, Material>): PartialModel {
  const out: PartialModel = { panels: [], spaces: [], hardware: [], diagnostics: [] }
  const err = (code: string, message: string) => out.diagnostics.push({ severity: 'error', code, message, nodeId: deskId })
  const warn = (code: string, message: string) => out.diagnostics.push({ severity: 'warning', code, message, nodeId: deskId })
  const top = materials.get(p.topMaterialId), body = materials.get(p.bodyMaterialId)
  if (!top || !body) { err('material-missing', 'A material used by this desk does not exist in the design.'); return out }

  const { width: W, depth: D, height: H } = p
  const tt = top.thickness, t = body.thickness
  const Hu = H - tt, Ds = D - p.frontOverhang
  if (Hu < 300 || Ds < 200 || W < 400) { err('desk-too-small', `Desk ${W}×${D}×${H} mm is too small.`); return out }
  if (p.frontOverhang < 0) err('overhang', 'Front overhang cannot be negative.')

  const panel = (id: string, role: Panel['role'], label: string, materialId: string, b: Panel['box'], ta: Panel['thicknessAxis'], ga: Panel['grainAxis'], banded: Panel['banded']) =>
    out.panels.push({ id: `${deskId}/${id}`, nodeId: deskId, role, label, materialId, box: b, thicknessAxis: ta, grainAxis: ga, banded })

  panel('worktop', 'worktop', 'Worktop', top.id, box(0, Hu, 0, W, tt, D), 'y', 'x', ['-x', '+x', '-z', '+z'])

  const leftPed = p.support === 'pedestal-left' || p.support === 'two-pedestals'
  const rightPed = p.support === 'pedestal-right' || p.support === 'two-pedestals'
  const pw = p.pedestal.width
  const merge = (m: PartialModel) => { out.panels.push(...m.panels); out.spaces.push(...m.spaces); out.hardware.push(...m.hardware); out.diagnostics.push(...m.diagnostics) }

  if (leftPed) merge(buildCabinet(pedestalParams(p, 'left', deskId, Hu, Ds), materials, { idPrefix: `${deskId}/ped-left:`, productNodeId: deskId }))
  else panel('gable-left', 'gable', 'Left gable', body.id, box(0, 0, 0, t, Hu, Ds), 'x', 'y', ['+z'])

  if (rightPed) merge(buildCabinet(pedestalParams(p, 'right', deskId, Hu, Ds), materials, { idPrefix: `${deskId}/ped-right:`, productNodeId: deskId, origin: { x: W - pw, y: 0, z: 0 } }))
  else panel('gable-right', 'gable', 'Right gable', body.id, box(W - t, 0, 0, t, Hu, Ds), 'x', 'y', ['+z'])

  const lx = leftPed ? pw : t, rx = W - (rightPed ? pw : t)
  const knee = rx - lx
  if (knee <= 0) { err('no-knee-space', 'Supports leave no space between them.'); return out }
  if (knee < 450) { err('knee-narrow', `Knee space is only ${knee} mm wide; you cannot sit at it.`); return out }
  if (knee < 600) warn('knee-narrow', `Knee space is ${knee} mm wide; about 600 mm or more is usual.`)
  const fm = materials.get(p.frontMaterialId)
  if ((leftPed || rightPed) && fm && p.frontOverhang < fm.thickness) {
    warn('fronts-proud', `Drawer fronts stick out ${fm.thickness - p.frontOverhang} mm past the worktop edge; set the overhang to at least ${fm.thickness} mm.`)
  }
  if (Hu < 600) warn('desk-low', `Clear height under the worktop is ${Hu} mm.`)

  if (p.modesty.enabled) {
    const mh = p.modesty.height
    if (mh <= 0 || mh > Hu) err('modesty-height', 'Modesty panel height must be between 1 mm and the clear height.')
    else if (p.modesty.setback < 0 || p.modesty.setback + t > Ds) err('modesty-setback', 'Modesty panel setback is outside the desk depth.')
    else panel('modesty', 'modesty', 'Modesty panel', body.id, box(lx, Hu - mh, p.modesty.setback, knee, mh, t), 'z', 'x', ['-y'])
  }
  return out
}
