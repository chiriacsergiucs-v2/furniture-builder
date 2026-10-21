import { hardwareSummary } from './cutlist'
import type { Design, FurnitureModel, Panel } from './types'

/**
 * Fusion 360 export (ADR-0021): a self-contained Python script for the Fusion API that rebuilds every panel as a
 * named solid box, grouped per piece — carcass, doors, each drawer (box + front). Generated from the model only.
 * Axes: our x → Fusion X, our height y → Fusion Z, our depth z (back→front) → Fusion −Y, so the front faces −Y.
 * Millimetres are converted to Fusion's centimetres here and nowhere else. NOT verified inside Fusion.
 */

export interface FusionGroup { name: string; panels: Panel[] }

/** Carcass, doors, then one group per drawer in model order. */
export function fusionGroups(model: FurnitureModel): FusionGroup[] {
  const carcass: Panel[] = [], doors: Panel[] = []
  const drawers = new Map<string, Panel[]>()
  for (const p of model.panels) {
    if (p.role === 'door') doors.push(p)
    else if (p.role.startsWith('drawer')) {
      const n = /^Drawer (\d+)/.exec(p.label)?.[1] ?? '?'
      const key = `${p.nodeId}#${n}`
      drawers.set(key, [...(drawers.get(key) ?? []), p])
    } else carcass.push(p)
  }
  const groups: FusionGroup[] = [{ name: 'Carcass', panels: carcass }]
  if (doors.length) groups.push({ name: 'Doors', panels: doors })
  let i = 0
  for (const panels of drawers.values()) groups.push({ name: `Drawer ${++i}`, panels })
  return groups.filter(g => g.panels.length)
}

const cm = (mm: number) => Number((mm / 10).toFixed(4))
const py = (s: string) => JSON.stringify(s) // JSON string literals are valid Python string literals

export function exportFusionPython(design: Design, model: FurnitureModel): string {
  const mats = new Map(design.materials.map(m => [m.id, m.name]))
  const groups = fusionGroups(model)
  const rows: string[] = []
  for (const g of groups) {
    for (const p of g.panels) {
      const b = p.box
      const cx = cm(b.x + b.w / 2), cy = cm(-(b.z + b.d / 2)), cz = cm(b.y + b.h / 2)
      rows.push(`    (${py(g.name)}, ${py(`${p.label} [${mats.get(p.materialId) ?? p.materialId}]`)}, ${cx}, ${cy}, ${cz}, ${cm(b.w)}, ${cm(b.d)}, ${cm(b.h)}),`)
    }
  }
  const hw = hardwareSummary(model).map(h => `#   ${h.quantity} × ${h.label}${h.sizeMm ? ` ${h.sizeMm} mm` : ''}`)
  return `# -*- coding: utf-8 -*-
# Furniture Builder → Autodesk Fusion 360 script (direct modelling, one solid body per panel).
# Design: ${design.name.replace(/[\r\n]/g, ' ')}
# Generated ${new Date().toISOString()} from the app's model. NOT verified inside Fusion — check before relying on it.
# Units: centimetres (Fusion's internal unit). Axes: X = width, Z = height, -Y = front.
# Run: Fusion → Utilities → Scripts and Add-Ins → + (create) → paste this file → Run, in a new empty design.
#
# Hardware (not modelled):
${hw.length ? hw.join('\n') : '#   none'}

import adsk.core, adsk.fusion, traceback

# (component, body name, centre x, centre y, centre z, size x, size y, size z) in cm
PANELS = [
${rows.join('\n')}
]

def run(context):
    ui = None
    try:
        app = adsk.core.Application.get()
        ui = app.userInterface
        design = adsk.fusion.Design.cast(app.activeProduct)
        if not design:
            ui.messageBox('Open a Fusion design first.')
            return
        design.designType = adsk.fusion.DesignTypes.DirectDesignType
        root = design.rootComponent
        tbm = adsk.fusion.TemporaryBRepManager.get()
        components = {}
        for group, name, cx, cy, cz, sx, sy, sz in PANELS:
            comp = components.get(group)
            if comp is None:
                occ = root.occurrences.addNewComponent(adsk.core.Matrix3D.create())
                comp = occ.component
                comp.name = group
                components[group] = comp
            box = adsk.core.OrientedBoundingBox3D.create(
                adsk.core.Point3D.create(cx, cy, cz),
                adsk.core.Vector3D.create(1, 0, 0),
                adsk.core.Vector3D.create(0, 1, 0),
                sx, sy, sz)
            body = comp.bRepBodies.add(tbm.createBox(box))
            body.name = name
        ui.messageBox('Created %d panels in %d components.' % (len(PANELS), len(components)))
    except:
        if ui:
            ui.messageBox('Failed:\\n{}'.format(traceback.format_exc()))
`
}
