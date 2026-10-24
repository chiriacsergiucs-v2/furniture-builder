import { buildCabinet, slidingTrackDepth } from './cabinet'
import { buildCorner } from './corner'
import { buildDesk } from './desk'
import { buildPanelSet } from './panelset'
import { buildFrame } from './frame'
import { buildPanel } from './panel'
import { runRules } from './rules'
import { box, contains, cutDimensions, isMm, union } from './geometry'
import { aabbOf, panelsOverlap, shapeProblems } from './shape'
import type { Design, Diagnostic, FurnitureModel, Material, Panel } from './types'

const FRONT_ROLES = new Set<Panel['role']>(['door', 'drawer-front', 'blind-panel'])

/**
 * Build the single normalised model for a design. Every consumer (3D, cutlist, hardware, checks)
 * reads this; nothing re-derives geometry elsewhere.
 */
export function buildModel(design: Design): FurnitureModel {
  const materials = new Map<string, Material>(design.materials.map(m => [m.id, m]))
  const prod = design.product
  const partial = prod.kind === 'cabinet' ? buildCabinet(prod.params, materials, { productNodeId: prod.id })
    : prod.kind === 'corner' ? buildCorner(prod.params, prod.id, materials)
    : prod.kind === 'panel' ? buildPanel(prod.params, prod.id, materials)
    : prod.kind === 'frame' ? buildFrame(prod.params, prod.id, materials)
    : prod.kind === 'panels' ? buildPanelSet(prod.params, prod.id, materials)
    : buildDesk(prod.params, prod.id, materials)
  const diagnostics: Diagnostic[] = [...partial.diagnostics]
  const panels = partial.panels

  // Integer millimetres and positive size, always.
  for (const p of panels) {
    const b = p.box
    if (![b.x, b.y, b.z, b.w, b.h, b.d].every(isMm)) {
      diagnostics.push({ severity: 'error', code: 'non-integer', message: `${p.label} has a non-integer dimension.`, nodeId: p.nodeId, panelIds: [p.id] })
    }
    const m = materials.get(p.materialId)
    const c = cutDimensions(p, m?.grain ?? false)
    if (c.length <= 0 || c.width <= 0) {
      diagnostics.push({ severity: 'error', code: 'zero-size', message: `${p.label} has no size (${c.length}×${c.width} mm).`, nodeId: p.nodeId, panelIds: [p.id] })
    } else if (c.width < 30) {
      diagnostics.push({ severity: 'warning', code: 'narrow-part', message: `${p.label} is only ${c.width} mm wide.`, nodeId: p.nodeId, panelIds: [p.id] })
    }
    // Shaped parts (ADR-0040): whole degrees, profiles inside their blank.
    for (const message of shapeProblems(p)) diagnostics.push({ severity: 'error', code: 'shape', message, nodeId: p.nodeId, panelIds: [p.id] })
    // Solid timber is cut from lengths of several sections; sheet parts must match their board (ADR-0038).
    if (m && m.stock !== 'solid' && c.thickness !== m.thickness) {
      diagnostics.push({ severity: 'error', code: 'thickness', message: `${p.label} thickness ${c.thickness} mm does not match ${m.name}.`, nodeId: p.nodeId, panelIds: [p.id] })
    }
  }

  // No two parts may occupy the same space.
  for (let i = 0; i < panels.length; i++) {
    for (let j = i + 1; j < panels.length; j++) {
      if (panelsOverlap(panels[i], panels[j])) {
        diagnostics.push({
          severity: 'error', code: 'overlap',
          message: `${panels[i].label} and ${panels[j].label} occupy the same space.`,
          nodeId: panels[j].nodeId, panelIds: [panels[i].id, panels[j].id],
        })
      }
    }
  }

  // Carcass parts stay inside the declared envelope; fronts may sit in front of it.
  if (prod.kind === 'cabinet') {
    const { width: W, height: H, depth: D } = prod.params
    const env = box(0, 0, 0, W, H, D)
    const front = materials.get(prod.params.frontMaterialId)
    // Sliding doors run on a track in front of the carcass (ADR-0037).
    const frontEnv = box(0, 0, 0, W, H, D + Math.max(front?.thickness ?? 0, slidingTrackDepth(prod.params.interior)))
    for (const p of panels) {
      if (!contains(FRONT_ROLES.has(p.role) ? frontEnv : env, aabbOf(p))) {
        diagnostics.push({ severity: 'error', code: 'outside', message: `${p.label} sticks out of the ${W}×${H}×${D} mm cabinet.`, nodeId: p.nodeId, panelIds: [p.id] })
      }
    }
  }

  // A board labelled kitchen worktop on other parts: guidance only, the user may mean it (ADR-0049).
  for (const m of design.materials) {
    if (m.kind !== 'worktop') continue
    const others = panels.filter(p => p.materialId === m.id && p.role !== 'worktop')
    if (others.length) {
      diagnostics.push({ severity: 'warning', code: 'worktop-board', nodeId: others[0].nodeId, panelIds: others.map(p => p.id),
        message: `${m.name} is labelled kitchen worktop but is used for ${others.length === 1 ? others[0].label : `${others.length} parts that are not worktops`} (guidance).` })
    }
  }

  const model: FurnitureModel = { panels, spaces: partial.spaces, hardware: partial.hardware, diagnostics, bounds: union(panels.map(aabbOf)) }
  // Construction guidance (ADR-0035): labelled warnings and reminders, after the independent checks above.
  const ruled = runRules(design, model, materials)
  model.diagnostics.push(...ruled.diagnostics)
  model.hardware.push(...ruled.hardware)
  return model
}

export const hasErrors = (m: FurnitureModel) => m.diagnostics.some(d => d.severity === 'error')
