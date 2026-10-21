import { cutDimensions } from './geometry'
import type { FurnitureModel, HardwareItem, Material, Mm, Panel } from './types'

/** "Drawer 2 side L" → "Drawer side L" so identical parts share one label. */
export const baseLabel = (label: string) => label.replace(/\s\d+\b/g, '').trim() || label

/** "2 rows × 14 holes ø5, 37 mm from edges, one face" — what the panel shop drills. */
export function drillingText(p: Panel): string {
  if (!p.pinRows?.length) return ''
  return p.pinRows.map(r => `${r.rows.length} rows × ${r.holes.length} holes ø${r.diameter}, ${r.rows[0]} mm from edges`).join('; ') +
    (p.pinRows.length > 1 ? ' (both faces, offset 16 mm)' : ', one face')
}

export interface CutRow {
  materialId: string
  materialName: string
  thickness: Mm
  /** Along the grain (or the longer side for grainless boards). */
  length: Mm
  width: Mm
  quantity: number
  /** Banded edges along the length / along the width (0–2 each). */
  edgesL: number
  edgesW: number
  grain: boolean
  /** Shelf-pin drilling summary, empty when none (ADR-0023). */
  drilling: string
  labels: string[]
  panelIds: string[]
}

/**
 * Group identical parts. Sizes are finished sizes; banded edges are annotated (L/W counts),
 * not subtracted — the panel shop applies its own edge-band allowance.
 */
export function cutlist(model: FurnitureModel, materials: Material[]): CutRow[] {
  const mats = new Map(materials.map(m => [m.id, m]))
  const rows = new Map<string, CutRow>()
  for (const p of model.panels) {
    const m = mats.get(p.materialId)
    if (!m) continue
    const c = cutDimensions(p, m.grain)
    const drilling = drillingText(p)
    const key = [m.id, c.thickness, c.length, c.width, c.edgesL, c.edgesW, drilling].join('|')
    const row = rows.get(key)
    if (row) {
      row.quantity++
      row.panelIds.push(p.id)
      const base = baseLabel(p.label)
      if (!row.labels.includes(base)) row.labels.push(base)
    } else {
      rows.set(key, {
        materialId: m.id, materialName: m.name, thickness: c.thickness, length: c.length, width: c.width,
        quantity: 1, edgesL: c.edgesL, edgesW: c.edgesW, grain: m.grain, drilling,
        labels: [baseLabel(p.label)], panelIds: [p.id],
      })
    }
  }
  return [...rows.values()].sort((a, b) =>
    a.materialName.localeCompare(b.materialName) || b.thickness - a.thickness || b.length - a.length || b.width - a.width)
}

/** Merge identical hardware lines across the design. */
export function hardwareSummary(model: FurnitureModel): HardwareItem[] {
  const out = new Map<string, HardwareItem>()
  for (const h of model.hardware) {
    const key = `${h.kind}|${h.sizeMm ?? ''}|${h.label}|${h.note ?? ''}`
    const cur = out.get(key)
    if (cur) cur.quantity += h.quantity
    else out.set(key, { ...h })
  }
  return [...out.values()]
}

export const areaM2 = (rows: CutRow[], materialId: string) =>
  rows.filter(r => r.materialId === materialId).reduce((s, r) => s + r.length * r.width * r.quantity, 0) / 1e6

export function edgeBandMeters(model: FurnitureModel, materials: Material[]): Map<string, number> {
  const mats = new Map(materials.map(m => [m.id, m]))
  const out = new Map<string, number>()
  for (const p of model.panels) {
    const m = mats.get(p.materialId)
    if (!m) continue
    const c = cutDimensions(p, m.grain)
    const mm = c.edgesL * c.length + c.edgesW * c.width
    if (mm) out.set(m.id, (out.get(m.id) ?? 0) + mm / 1000)
  }
  return out
}

export function cutlistCsv(rows: CutRow[]): string {
  const esc = (v: string | number) => {
    const s = String(v)
    const safe = /^[=+\-@]/.test(s) ? `'${s}` : s
    return /[",\r\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe
  }
  const head = ['Material', 'Thickness_mm', 'Length_mm', 'Width_mm', 'Qty', 'Edge_L', 'Edge_W', 'Grain', 'Parts', 'Drilling']
  const lines = [head, ...rows.map(r => [r.materialName, r.thickness, r.length, r.width, r.quantity, r.edgesL, r.edgesW, r.grain ? 'length' : 'none', r.labels.join(' / '), r.drilling])]
  return lines.map(l => l.map(esc).join(',')).join('\r\n') + '\r\n'
}
