/**
 * Full-size templates for profiled boards (ADR-0040, user answer: printed full-size on the cut sheet). Each distinct
 * profile becomes an outline on paper at 1:1, cut into A4 tiles that overlap by 10 mm for taping together. Pure: the
 * print sheet only draws what this returns.
 */
import { baseLabel } from './cutlist'
import { inPlaneAxes } from './geometry'
import type { Mm, Panel } from './types'

/** Printable area of an A4 portrait page inside 12 mm margins, less room for the tile's heading. */
export const PAGE = { w: 186, h: 255 }
export const OVERLAP = 10

export interface TemplateTile { col: number; row: number; x0: Mm; y0: Mm }
export interface ProfileTemplate {
  key: string
  label: string
  materialId: string
  quantity: number
  /** Blank size on paper: across and down. */
  w: Mm
  h: Mm
  /** Outline on paper, mm from the blank's top-left corner. */
  points: [Mm, Mm][]
  cols: number
  rows: number
  tiles: TemplateTile[]
}

const tilesFor = (size: Mm, page: Mm) => Math.max(1, Math.ceil((size - OVERLAP) / (page - OVERLAP)))

/** One template per distinct profile (same blank and outline), with how many parts use it. */
export function profileTemplates(panels: Panel[]): ProfileTemplate[] {
  const out = new Map<string, ProfileTemplate>()
  for (const p of panels) {
    if (p.shape?.kind !== 'profile') continue
    const [ua, va] = inPlaneAxes(p.thicknessAxis)
    const size = (a: string) => (a === 'x' ? p.box.w : a === 'y' ? p.box.h : p.box.d)
    const w = size(ua), h = size(va)
    // Paper runs down the page: depth (z) from the back reads downwards as seen from above; height (y) is flipped.
    const points = p.shape.points.map(([u, v]) => [u, va === 'y' ? h - v : v] as [Mm, Mm])
    const key = `${p.materialId}|${w}|${h}|${JSON.stringify(points)}`
    const hit = out.get(key)
    if (hit) { hit.quantity++; continue }
    const cols = tilesFor(w, PAGE.w), rows = tilesFor(h, PAGE.h)
    const tiles: TemplateTile[] = []
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) tiles.push({ col: c, row: r, x0: c * (PAGE.w - OVERLAP), y0: r * (PAGE.h - OVERLAP) })
    out.set(key, { key, label: baseLabel(p.label), materialId: p.materialId, quantity: 1, w, h, points, cols, rows, tiles })
  }
  return [...out.values()]
}
