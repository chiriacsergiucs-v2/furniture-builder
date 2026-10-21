import { buildCabinet, type PartialModel } from './cabinet'
import { box } from './geometry'
import type { Box, CabinetParams, CornerParams, Face, Material, Panel, SpaceOpening } from './types'

/**
 * Corner cabinets (ADR-0025), built from two carcasses by the cabinet generator — no shelf, drawer or front code of
 * their own.
 *
 * Blind corner: a narrow blind section (empty carcass + fixed blind panel in front) joined to a normal cabinet.
 * L-shape: wing A along the back wall and wing B along the side wall, open to each other at the corner (B has no
 * side there), one door on each wing; A's door starts clear of B's door so the two leaves can fold together.
 * Both are drawn for the corner on the left and mirrored for `side: 'right'`.
 */

const lo = (n: number) => Math.floor(n / 2)

function carcass(p: CornerParams, width: number, interior: CabinetParams['interior']): CabinetParams {
  return {
    width, height: p.height, depth: p.depth,
    bodyMaterialId: p.bodyMaterialId, frontMaterialId: p.frontMaterialId, backMaterialId: p.backMaterialId,
    top: p.top, back: p.back, backInset: p.backInset, plinthHeight: p.plinthHeight, plinthSetback: p.plinthSetback,
    frontGap: p.frontGap, shelfSetback: p.shelfSetback, drawers: p.drawers, interior,
  }
}

const FACE_ROT: Record<Face, Face> = { '+z': '+x', '-z': '-x', '+x': '-z', '-x': '+z', '+y': '+y', '-y': '-y' }
const FACE_MIRROR: Record<Face, Face> = { '+x': '-x', '-x': '+x', '+y': '+y', '-y': '-y', '+z': '+z', '-z': '-z' }
const swapXZ = (a: Panel['thicknessAxis']) => (a === 'x' ? 'z' : a === 'z' ? 'x' : 'y')

/** Quarter turn for wing B: local depth → world x, local width → world z running from `zEnd` back towards the corner. */
function rotateBox(b: Box, zEnd: number): Box {
  return { x: b.z, y: b.y, z: zEnd - (b.x + b.w), w: b.d, h: b.h, d: b.w }
}
const rotatePanel = (p: Panel, zEnd: number): Panel => ({
  ...p, box: rotateBox(p.box, zEnd), thicknessAxis: swapXZ(p.thicknessAxis), grainAxis: swapXZ(p.grainAxis),
  banded: p.banded.map(f => FACE_ROT[f]),
  ...(p.pinRows ? { pinRows: p.pinRows.map(r => ({ ...r, face: FACE_ROT[r.face] })) } : {}),
})

const mirrorBox = (b: Box, W: number): Box => ({ ...b, x: W - (b.x + b.w) })
const swapLR = (label: string) => label.replace(/\bLeft\b|\bRight\b/g, m => (m === 'Left' ? 'Right' : 'Left'))
function mirror(m: PartialModel, W: number): PartialModel {
  return {
    ...m,
    panels: m.panels.map(p => ({
      ...p, label: swapLR(p.label), box: mirrorBox(p.box, W), banded: p.banded.map(f => FACE_MIRROR[f]),
      ...(p.pinRows ? { pinRows: p.pinRows.map(r => ({ ...r, face: FACE_MIRROR[r.face] })) } : {}),
      // Mirroring flips which edge is the front's left, for fronts facing ±z (width along x) and ±x (width along z).
      ...(p.handleHoles ? { handleHoles: { ...p.handleHoles, at: p.handleHoles.at.map(([u, v]) => [(p.thicknessAxis === 'z' ? p.box.w : p.box.d) - u, v] as [number, number]) } } : {}),
    })),
    spaces: m.spaces.map(s => ({ ...s, box: mirrorBox(s.box, W) })),
  }
}

const merge = (into: PartialModel, from: PartialModel) => {
  into.panels.push(...from.panels); into.spaces.push(...from.spaces); into.hardware.push(...from.hardware); into.diagnostics.push(...from.diagnostics)
}

export function buildCorner(p: CornerParams, id: string, materials: Map<string, Material>): PartialModel {
  const out: PartialModel = { panels: [], spaces: [], hardware: [], diagnostics: [] }
  const err = (code: string, message: string) => out.diagnostics.push({ severity: 'error', code, message, nodeId: id })
  const warn = (code: string, message: string) => out.diagnostics.push({ severity: 'warning', code, message, nodeId: id })
  const body = materials.get(p.bodyMaterialId), front = materials.get(p.frontMaterialId)
  if (!body || !front) { err('material-missing', 'A material used by this corner cabinet does not exist in the design.'); return out }
  const t = body.thickness, tf = front.thickness, g = p.frontGap, D = p.depth
  const r = lo(g)

  if (p.variant === 'blind') {
    const usable = p.width - p.blindWidth
    if (p.blindWidth < 3 * t || usable < 3 * t) { err('corner-size', `Blind section ${p.blindWidth} mm and usable section ${usable} mm must each be at least ${3 * t} mm.`); return out }
    if (p.blindWidth < D + 50) warn('blind-clearance', `Blind section is ${p.blindWidth} mm; about the neighbouring cabinet's depth + 50 mm (${D + 50} mm) keeps its door and handle clear of this door.`)
    // Drawn with the blind section on the left, mirrored for the right.
    const blind = buildCabinet(carcass(p, p.blindWidth, { id: `${id}:blind`, kind: 'empty' }), materials, { idPrefix: `${id}/blind:`, productNodeId: id, mapNodeId: () => id })
    const main = buildCabinet(carcass(p, usable, p.interior), materials, { idPrefix: `${id}/main:`, productNodeId: id, origin: { x: p.blindWidth, y: 0, z: 0 } })
    const local: PartialModel = { panels: [], spaces: [], hardware: [], diagnostics: [] }
    merge(local, blind); merge(local, main)
    // Fixed blind panel in front of the blind section, one gap from the usable section's door.
    const ph = p.plinthHeight
    local.panels.push({
      id: `${id}/blind-panel`, nodeId: id, role: 'blind-panel', label: 'Blind panel', materialId: front.id,
      box: box(r, ph + r, D, p.blindWidth - r - (g - r) , p.height - ph - 2 * r, tf), thicknessAxis: 'z', grainAxis: 'y', banded: ['-x', '+x', '-y', '+y'],
    })
    merge(out, p.side === 'left' ? local : mirror(local, p.width))
    return out
  }

  // L-shape, corner on the left: wing A along the back wall, wing B along the left wall.
  const wb = p.wingWidth - D
  if (p.width < D + 3 * t + 100 || wb < 3 * t + 100) { err('corner-size', `Each wing must reach at least ${3 * t + 100} mm past the corner.`); return out }
  const doorStart = D + tf + g // A's door begins clear of B's door leaf
  const a = buildCabinet(carcass(p, p.width, p.interior), materials, { idPrefix: `${id}/a:`, productNodeId: id, frontTrim: { left: doorStart - r } })
  const bLocal = buildCabinet(carcass(p, wb, p.wingInterior), materials, { idPrefix: `${id}/b:`, productNodeId: id, omitSide: 'right' })
  // Wing B's plinth runs on past the corner edge until it butts against the front face of wing A's plinth (no notch).
  if (p.plinthHeight > 0) for (const x of bLocal.panels) if (x.role === 'plinth') x.box = { ...x.box, w: x.box.w + p.plinthSetback }
  const b: PartialModel = {
    panels: bLocal.panels.map(x => rotatePanel(x, p.wingWidth)),
    spaces: bLocal.spaces.map((s): SpaceOpening => ({ ...s, box: rotateBox(s.box, p.wingWidth), view: 'side' })),
    hardware: bLocal.hardware, diagnostics: bLocal.diagnostics,
  }
  const local: PartialModel = { panels: [], spaces: [], hardware: [], diagnostics: [] }
  merge(local, a); merge(local, b)
  const doorsA = a.panels.some(x => x.role === 'door'), doorsB = bLocal.panels.some(x => x.role === 'door')
  if (doorsA && doorsB) {
    local.hardware.push({ nodeId: id, kind: 'corner-hinge', label: 'Corner fold hinge set (joins the two door leaves)', quantity: 1, note: 'confirm the set, and which carcass hinges it replaces, with the hinge datasheet' })
  }
  merge(out, p.side === 'left' ? local : mirror(local, p.width))
  return out
}
