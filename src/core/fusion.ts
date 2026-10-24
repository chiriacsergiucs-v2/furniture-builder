import { hardwareSummary } from './cutlist'
import { profileWorld, rotateAbout, type V3 } from './shape'
import type { Design, FurnitureModel, Panel } from './types'

/**
 * Fusion 360 export (ADR-021): a self-contained Python script for the Fusion API that rebuilds every panel as a
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
/** Our (x, y, z) → Fusion (X, Y, Z) = (x, −z, y). */
const F = (v: V3): V3 => [v[0], -v[2], v[1]]
const vec = (v: V3) => v.map(c => Number(c.toFixed(6))).join(', ')
const py = (s: string) => JSON.stringify(s) // JSON string literals are valid Python string literals

export function exportFusionPython(design: Design, model: FurnitureModel): string {
  const mats = new Map(design.materials.map(m => [m.id, m.name]))
  const groups = fusionGroups(model)
  const rows: string[] = [], profiles: string[] = []
  for (const g of groups) {
    for (const p of g.panels) {
      const b = p.box, name = py(`${p.label} [${mats.get(p.materialId) ?? p.materialId}]`)
      if (p.shape?.kind === 'profile') {
        // Profile (ADR-040): outline on the blank's back face, extruded through the thickness.
        const pts = profileWorld(b, p.thicknessAxis, p.shape.points).map(q => `(${F(q).map(cm).join(', ')})`).join(', ')
        const tn: V3 = [0, 0, 0]; tn[['x', 'y', 'z'].indexOf(p.thicknessAxis)] = 1
        const th = p.thicknessAxis === 'x' ? b.w : p.thicknessAxis === 'y' ? b.h : b.d
        const base = { x: 'yz', y: 'xy', z: 'xz' }[p.thicknessAxis]
        const off = p.thicknessAxis === 'x' ? cm(b.x) : p.thicknessAxis === 'y' ? cm(b.y) : cm(-b.z)
        profiles.push(`    (${py(g.name)}, ${name}, ${py(base)}, ${off}, [${pts}], (${vec(F(tn))}), ${cm(th)}),`)
        continue
      }
      let c: V3 = [b.x + b.w / 2, b.y + b.h / 2, b.z + b.d / 2], ex: V3 = [1, 0, 0], ez: V3 = [0, 0, 1]
      if (p.shape?.kind === 'tilt') {
        // Tilted part (ADR-040): the box's centre and axes turned about its pivot.
        const s = p.shape, pv: V3 = [b.x + s.pivot[0], b.y + s.pivot[1], b.z + s.pivot[2]]
        c = rotateAbout(c, s.axis, s.angleDeg, pv)
        ex = rotateAbout(ex, s.axis, s.angleDeg, [0, 0, 0]); ez = rotateAbout(ez, s.axis, s.angleDeg, [0, 0, 0])
      }
      const fc = F(c), lx = F(ex), wy = F([-ez[0], -ez[1], -ez[2]])
      rows.push(`    (${py(g.name)}, ${name}, ${cm(fc[0])}, ${cm(fc[1])}, ${cm(fc[2])}, ${cm(b.w)}, ${cm(b.d)}, ${cm(b.h)}, (${vec(lx)}), (${vec(wy)})),`)
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

# (component, body name, centre x, centre y, centre z, length, width, height, length direction, width direction) in cm;
# tilted parts (ADR-040) have turned directions.
PANELS = [
${rows.join('\n')}
]

# Profiled boards (ADR-040): (component, body name, base plane, plane offset, outline points, thickness direction,
# thickness) in cm. Each is sketched on an offset plane and extruded.
PROFILES = [
${profiles.join('\n')}
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
        for group, name, cx, cy, cz, sx, sy, sz, ldir, wdir in PANELS:
            comp = components.get(group)
            if comp is None:
                occ = root.occurrences.addNewComponent(adsk.core.Matrix3D.create())
                comp = occ.component
                comp.name = group
                components[group] = comp
            box = adsk.core.OrientedBoundingBox3D.create(
                adsk.core.Point3D.create(cx, cy, cz),
                adsk.core.Vector3D.create(*ldir),
                adsk.core.Vector3D.create(*wdir),
                sx, sy, sz)
            body = comp.bRepBodies.add(tbm.createBox(box))
            body.name = name
        planes = {'xy': root.xYConstructionPlane, 'xz': root.xZConstructionPlane, 'yz': root.yZConstructionPlane}
        for group, name, base, offset, points, tdir, thickness in PROFILES:
            comp = components.get(group)
            if comp is None:
                occ = root.occurrences.addNewComponent(adsk.core.Matrix3D.create())
                comp = occ.component
                comp.name = group
                components[group] = comp
            pin = root.constructionPlanes.createInput()
            pin.setByOffset(planes[base], adsk.core.ValueInput.createByReal(offset))
            plane = root.constructionPlanes.add(pin)
            sketch = comp.sketches.add(plane)
            pts = [sketch.modelToSketchSpace(adsk.core.Point3D.create(*q)) for q in points]
            lines = sketch.sketchCurves.sketchLines
            for i in range(len(pts)):
                lines.addByTwoPoints(pts[i], pts[(i + 1) % len(pts)])
            normal = plane.geometry.normal
            sign = 1 if normal.x * tdir[0] + normal.y * tdir[1] + normal.z * tdir[2] > 0 else -1
            ext = comp.features.extrudeFeatures.addSimple(sketch.profiles.item(0), adsk.core.ValueInput.createByReal(sign * thickness),
                adsk.fusion.FeatureOperations.NewBodyFeatureOperation)
            ext.bodies.item(0).name = name
        ui.messageBox('Created %d panels in %d components.' % (len(PANELS) + len(PROFILES), len(components)))
    except:
        if ui:
            ui.messageBox('Failed:\\n{}'.format(traceback.format_exc()))
`
}
