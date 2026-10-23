/**
 * Shaped parts (ADR-0040). A shaped panel is still described by its cut blank, the axis-aligned `box` in whole
 * millimetres that the cut list, nesting and integer checks use. `shape` only says how the blank is placed (tilt) or
 * cut (profile). Floating point appears here only, for drawing and the oriented overlap test; never in sizes.
 */
import { box, inPlaneAxes, overlaps } from './geometry'
import type { Axis, Box, Panel, PanelShape } from './types'

export type V3 = [number, number, number]
const AXES: Axis[] = ['x', 'y', 'z']
const idx = (a: Axis) => AXES.indexOf(a)
const unit = (a: Axis): V3 => [a === 'x' ? 1 : 0, a === 'y' ? 1 : 0, a === 'z' ? 1 : 0]
const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]]
const add = (a: V3, b: V3): V3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]]
const scale = (a: V3, k: number): V3 => [a[0] * k, a[1] * k, a[2] * k]
const dot = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
const cross = (a: V3, b: V3): V3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]

/** Whole degrees 1–89 (ADR-0040 amendment: lounger backrests reach 80° from flat at the 100° position). */
export const MAX_TILT = 89
const min3 = (b: Box): V3 => [b.x, b.y, b.z]
const size = (b: Box, a: Axis) => (a === 'x' ? b.w : a === 'y' ? b.h : b.d)

/** Right-hand rotation of point `p` about the axis through `pivot`. */
export function rotateAbout(p: V3, axis: Axis, deg: number, pivot: V3): V3 {
  const r = (deg * Math.PI) / 180, c = Math.cos(r), s = Math.sin(r)
  const [x, y, z] = sub(p, pivot)
  const q: V3 = axis === 'x' ? [x, y * c - z * s, y * s + z * c] : axis === 'y' ? [z * s + x * c, y, z * c - x * s] : [x * c - y * s, x * s + y * c, z]
  return add(q, pivot)
}

/** The profile polygon in world terms, on the blank's back face (lowest thickness coordinate). */
export function profileWorld(b: Box, t: Axis, points: [number, number][]): V3[] {
  const [ua, va] = inPlaneAxes(t)
  const o = min3(b)
  return points.map(([u, v]) => add(add(o, scale(unit(ua), u)), scale(unit(va), v)))
}

/** Convex hull (monotone chain) of 2D points, counter-clockwise. */
export function hull2(pts: [number, number][]): [number, number][] {
  const p = [...pts].sort((a, b) => a[0] - b[0] || a[1] - b[1])
  if (p.length < 3) return p
  const turn = (o: number[], a: number[], b: number[]) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0])
  const lower: [number, number][] = [], upper: [number, number][] = []
  for (const q of p) { while (lower.length >= 2 && turn(lower[lower.length - 2], lower[lower.length - 1], q) <= 0) lower.pop(); lower.push(q) }
  for (const q of [...p].reverse()) { while (upper.length >= 2 && turn(upper[upper.length - 2], upper[upper.length - 1], q) <= 0) upper.pop(); upper.push(q) }
  return [...lower.slice(0, -1), ...upper.slice(0, -1)]
}

/** A convex solid for drawing bounds and the separating-axis test. */
export interface Solid { vertices: V3[]; normals: V3[]; edges: V3[] }

/** The convex solid a panel occupies: its blank, tilted when tilted, or the convex hull of its profile, extruded. */
export function solidOf(p: Panel): Solid {
  const b = p.box, s = p.shape
  if (s?.kind === 'profile') {
    const hull = hull2(s.points)
    const back = profileWorld(b, p.thicknessAxis, hull)
    const tv = scale(unit(p.thicknessAxis), size(b, p.thicknessAxis))
    const vertices = [...back, ...back.map(v => add(v, tv))]
    const edges: V3[] = back.map((v, i) => sub(back[(i + 1) % back.length], v))
    const tn = unit(p.thicknessAxis)
    return { vertices, normals: [tn, ...edges.map(e => cross(e, tn))], edges: [...edges, tn] }
  }
  const o = min3(b)
  const corners: V3[] = []
  for (const dx of [0, b.w]) for (const dy of [0, b.h]) for (const dz of [0, b.d]) corners.push([o[0] + dx, o[1] + dy, o[2] + dz])
  if (s?.kind !== 'tilt') return { vertices: corners, normals: AXES.map(unit), edges: AXES.map(unit) }
  const pivot = add(o, s.pivot as V3)
  const axes = AXES.map(a => rotateAbout(unit(a), s.axis, s.angleDeg, [0, 0, 0]))
  return { vertices: corners.map(v => rotateAbout(v, s.axis, s.angleDeg, pivot)), normals: axes, edges: axes }
}

/** Whole-mm box around everything a panel occupies (the blank itself for plain panels). */
export function aabbOf(p: Panel): Box {
  if (!p.shape) return p.box
  const v = solidOf(p).vertices
  const lo = [0, 1, 2].map(i => Math.floor(Math.min(...v.map(q => q[i])) + 1e-6))
  const hi = [0, 1, 2].map(i => Math.ceil(Math.max(...v.map(q => q[i])) - 1e-6))
  return box(lo[0], lo[1], lo[2], hi[0] - lo[0], hi[1] - lo[1], hi[2] - lo[2])
}

/**
 * Separating-axis test on two convex solids. Projections are rounded to 1/1000 mm, so faces that touch (or meet
 * within floating-point noise) never count as an overlap; a shared volume must be at least 0.001 mm deep.
 */
export function solidsOverlap(a: Solid, b: Solid): boolean {
  const axes: V3[] = [...a.normals, ...b.normals]
  for (const e of a.edges) for (const f of b.edges) { const c = cross(e, f); if (dot(c, c) > 1e-9) axes.push(c) }
  for (const ax of axes) {
    const len = Math.sqrt(dot(ax, ax))
    if (len < 1e-9) continue
    const n = scale(ax, 1 / len)
    const pa = a.vertices.map(v => Math.round(dot(v, n) * 1000)), pb = b.vertices.map(v => Math.round(dot(v, n) * 1000))
    if (Math.max(...pa) <= Math.min(...pb) || Math.max(...pb) <= Math.min(...pa)) return false
  }
  return true
}

/** Overlap of two panels: the exact integer test for plain boxes, the separating-axis test when either is shaped. */
export function panelsOverlap(a: Panel, b: Panel): boolean {
  if (!a.shape && !b.shape) return overlaps(a.box, b.box)
  if (!overlaps(aabbOf(a), aabbOf(b))) return false
  return solidsOverlap(solidOf(a), solidOf(b))
}

/** Does a panel occupy any of an axis-aligned box (a run part, a filler)? */
export function overlapsBox(p: Panel, b: Box): boolean {
  if (!overlaps(aabbOf(p), b)) return false
  return !p.shape || solidsOverlap(solidOf(p), solidOf({ ...p, box: b, shape: undefined }))
}

/** Problems with a panel's shape (ADR-0008: reported, never thrown). */
export function shapeProblems(p: Panel): string[] {
  const s = p.shape
  if (!s) return []
  if (s.kind === 'tilt') {
    const out: string[] = []
    if (!Number.isInteger(s.angleDeg) || s.angleDeg === 0 || Math.abs(s.angleDeg) > MAX_TILT) out.push(`${p.label}: tilt must be a whole number of degrees from 1 to ${MAX_TILT}.`)
    if (!s.pivot.every(Number.isInteger)) out.push(`${p.label}: tilt pivot must be whole millimetres.`)
    return out
  }
  const [ua, va] = inPlaneAxes(p.thicknessAxis)
  const W = size(p.box, ua), H = size(p.box, va)
  if (s.points.length < 3) return [`${p.label}: a profile needs at least 3 points.`]
  if (!s.points.every(([u, v]) => Number.isInteger(u) && Number.isInteger(v) && u >= 0 && v >= 0 && u <= W && v <= H)) return [`${p.label}: the profile must stay inside its ${W} × ${H} mm blank, in whole millimetres.`]
  if (Math.abs(area2(s.points)) === 0) return [`${p.label}: the profile has no area.`]
  return []
}

/** Twice the signed area of a polygon. */
export const area2 = (pts: [number, number][]) => pts.reduce((a, [x, y], i) => { const [x2, y2] = pts[(i + 1) % pts.length]; return a + x * y2 - x2 * y }, 0)

/** Cut-list note for a shaped panel (ADR-0040): profiles are cut to the printed template; tilt is placement only. */
export function shapeNote(p: Panel): string {
  if (p.shape?.kind === 'profile') return `cut to template (${p.shape.points.length} points)`
  return ''
}

// ---------------------------------------------------------------------------
// Quarter turns about the vertical axis (projects place pieces turned by 0/90/180/270°).
// ---------------------------------------------------------------------------

type Q = 0 | 90 | 180 | 270
/** A point turned like `rotateBox` in `project.ts`. */
export function turnPoint([x, y, z]: V3, r: Q): V3 {
  switch (r) {
    case 0: return [x, y, z]
    case 90: return [z, y, -x]
    case 180: return [-x, y, -z]
    case 270: return [-z, y, x]
  }
}

/** The shape of a panel turned with its piece: `from` is the blank before, `to` the turned blank. */
export function turnShape(s: PanelShape, from: Box, to: Box, t: Axis, tTo: Axis, r: Q): PanelShape {
  if (r === 0) return s
  if (s.kind === 'tilt') {
    const a = turnPoint(unit(s.axis), r)
    const i = a.findIndex(c => c !== 0)
    const pivot = sub(turnPoint(add(min3(from), s.pivot as V3), r), min3(to)).map(v => Math.round(v)) as [number, number, number]
    return { kind: 'tilt', axis: AXES[i], angleDeg: a[i] < 0 ? -s.angleDeg : s.angleDeg, pivot }
  }
  const world = profileWorld(from, t, s.points).map(v => turnPoint(v, r))
  // The turned blank's back face may now be its front face: measure in-plane coordinates only.
  const [ua, va] = inPlaneAxes(tTo)
  const o = min3(to)
  return { kind: 'profile', points: world.map(v => [Math.round(v[idx(ua)] - o[idx(ua)]), Math.round(v[idx(va)] - o[idx(va)])] as [number, number]) }
}

/**
 * Outline of a panel in the front view (x across, y up), for drawing (ADR-0040). A plain box is its rectangle; a
 * profile facing the front is its polygon; anything else is the convex hull of its solid seen from the front.
 */
export function frontOutline(p: Panel): [number, number][] {
  const b = p.box
  if (!p.shape) return [[b.x, b.y], [b.x + b.w, b.y], [b.x + b.w, b.y + b.h], [b.x, b.y + b.h]]
  if (p.shape.kind === 'profile' && p.thicknessAxis === 'z') return p.shape.points.map(([u, v]) => [b.x + u, b.y + v])
  return hull2(solidOf(p).vertices.map(v => [Math.round(v[0] * 10) / 10, Math.round(v[1] * 10) / 10] as [number, number]))
}
