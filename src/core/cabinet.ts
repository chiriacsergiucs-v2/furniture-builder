import { box, distribute, equalParts } from './geometry'
import type {
  Box, CabinetParams, Diagnostic, Face, HardwareItem, Material, Mm, Panel, PanelRole, Space, SpaceOpening,
} from './types'

/**
 * Where fronts covering a space may extend, with gaps already applied.
 * Fronts overlay the carcass: on outer edges they stop half a gap short of the carcass edge,
 * across an inner divider they meet at the divider's centre line minus half a gap each side.
 */
interface FrontZone { x0: Mm; x1: Mm; y0: Mm; y1: Mm }

interface Ctx {
  opening: Box
  front: FrontZone
  /** An ancestor space already has doors: fronts here would collide, drawers become internal. */
  behindDoors: boolean
}

export interface BuildOptions {
  /** Prefix for panel ids so several cabinets can live in one model (desk pedestals). */
  idPrefix?: string
  /** Translation applied to every generated box. */
  origin?: { x: Mm; y: Mm; z: Mm }
  /** Node id used for carcass panels (the product). */
  productNodeId: string
  /** Remap space node ids; when set, spaces are not exposed for editing. */
  mapNodeId?: (spaceId: string) => string
}

export interface PartialModel { panels: Panel[]; spaces: SpaceOpening[]; hardware: HardwareItem[]; diagnostics: Diagnostic[] }

/** Minimum gap between closed doors and internal drawer boxes (hinge arm clearance). */
export const INTERNAL_DRAWER_SETBACK = 20

const lo = (g: Mm) => Math.floor(g / 2)
const hi = (g: Mm) => g - Math.floor(g / 2)

/** Typical hinge count by door height. Guidance only; the hinge maker's datasheet decides. */
export function hingeCount(doorHeight: Mm): number {
  if (doorHeight <= 900) return 2
  if (doorHeight <= 1600) return 3
  if (doorHeight <= 2000) return 4
  return 5
}

export function hingeBand(doorHeight: Mm): string {
  if (doorHeight <= 900) return 'doors up to 900 mm'
  if (doorHeight <= 1600) return 'doors 901–1600 mm'
  if (doorHeight <= 2000) return 'doors 1601–2000 mm'
  return 'doors over 2000 mm'
}

export function buildCabinet(p: CabinetParams, materials: Map<string, Material>, opts: BuildOptions): PartialModel {
  const out: PartialModel = { panels: [], spaces: [], hardware: [], diagnostics: [] }
  const prefix = opts.idPrefix ?? ''
  const o = opts.origin ?? { x: 0, y: 0, z: 0 }
  const mapNode = opts.mapNodeId ?? ((id: string) => id)
  const err = (code: string, message: string, nodeId?: string) =>
    out.diagnostics.push({ severity: 'error', code, message, nodeId: nodeId && mapNode(nodeId) })
  const warn = (code: string, message: string, nodeId?: string) =>
    out.diagnostics.push({ severity: 'warning', code, message, nodeId: nodeId && mapNode(nodeId) })

  const body = materials.get(p.bodyMaterialId)
  const front = materials.get(p.frontMaterialId)
  const backM = materials.get(p.backMaterialId)
  const boxM = materials.get(p.drawers.boxMaterialId)
  const bottomM = materials.get(p.drawers.bottomMaterialId)
  if (!body || !front || !backM || !boxM || !bottomM) {
    err('material-missing', 'A material used by this cabinet does not exist in the design.', opts.productNodeId)
    return out
  }

  const add = (nodeId: string, role: PanelRole, label: string, materialId: string, b: Box,
    thicknessAxis: Panel['thicknessAxis'], grainAxis: Panel['grainAxis'], banded: Face[], index?: number) => {
    const node = nodeId === opts.productNodeId ? nodeId : mapNode(nodeId)
    out.panels.push({
      id: `${prefix}${nodeId}/${role}${index === undefined ? '' : `/${index}`}`,
      nodeId: node, role, label, materialId,
      box: { ...b, x: b.x + o.x, y: b.y + o.y, z: b.z + o.z },
      thicknessAxis, grainAxis, banded,
    })
  }
  const hw = (item: HardwareItem) => out.hardware.push({ ...item, nodeId: mapNode(item.nodeId) })

  const { width: W, height: H, depth: D, plinthHeight: ph } = p
  const t = body.thickness, bt = backM.thickness, tf = front.thickness, g = p.frontGap
  const pid = opts.productNodeId

  if (W < 3 * t || H < ph + 3 * t || D < 3 * t + bt) {
    err('carcass-too-small', `Cabinet ${W}×${H}×${D} mm is too small for ${t} mm panels.`, pid)
    return out
  }
  if (ph > 0 && (p.plinthSetback < 0 || p.plinthSetback > D - 2 * t - bt)) {
    err('plinth-setback', 'Plinth setback must be between 0 and the carcass depth.', pid)
  }

  // ---- carcass -------------------------------------------------------------
  const z0 = p.back === 'applied' ? bt : 0
  const Dc = D - z0
  const sideH = p.top === 'over' ? H - t : H
  add(pid, 'side', 'Left side', body.id, box(0, 0, z0, t, sideH, Dc), 'x', 'y', ['+z'], 0)
  add(pid, 'side', 'Right side', body.id, box(W - t, 0, z0, t, sideH, Dc), 'x', 'y', ['+z'], 1)
  if (p.top === 'over') add(pid, 'top', 'Top', body.id, box(0, H - t, z0, W, t, Dc), 'y', 'x', ['+z', '-x', '+x'])
  else add(pid, 'top', 'Top', body.id, box(t, H - t, z0, W - 2 * t, t, Dc), 'y', 'x', ['+z'])
  add(pid, 'bottom', 'Bottom', body.id, box(t, ph, z0, W - 2 * t, t, Dc), 'y', 'x', ['+z'])
  if (ph > 0) {
    add(pid, 'plinth', 'Plinth', body.id, box(t, 0, D - p.plinthSetback - t, W - 2 * t, ph, t), 'z', 'x', ['-y'])
  }
  let openZ = z0
  if (p.back === 'applied') {
    add(pid, 'back', 'Back', backM.id, box(0, ph, 0, W, H - ph, bt), 'z', 'y', [])
  } else if (p.back === 'inset') {
    if (p.backInset < 0 || p.backInset + bt > D - 2 * t) err('back-inset', 'Back inset does not fit in the carcass depth.', pid)
    add(pid, 'back', 'Back', backM.id, box(t, ph + t, p.backInset, W - 2 * t, H - ph - 2 * t, bt), 'z', 'y', [])
    openZ = p.backInset + bt
  }

  const r = lo(g)
  const root: Ctx = {
    opening: box(t, ph + t, openZ, W - 2 * t, H - ph - 2 * t, D - openZ),
    front: { x0: r, x1: W - r, y0: ph + r, y1: H - r },
    behindDoors: false,
  }

  // ---- interior ------------------------------------------------------------
  const visit = (s: Space, c: Ctx, level = 0) => {
    const op = c.opening
    if (!opts.mapNodeId) {
      out.spaces.push({
        nodeId: s.id, kind: s.kind, depth: level, leaf: s.kind !== 'split', hasDoors: !!s.front,
        box: { ...op, x: op.x + o.x, y: op.y + o.y, z: op.z + o.z },
      })
    }
    if (op.w <= 0 || op.h <= 0 || op.d <= 0) {
      err('space-too-small', 'This space has no room left inside it.', s.id)
      return
    }
    const hasDoors = !!s.front && s.front.kind === 'doors'
    if (hasDoors && c.behindDoors) err('doors-behind-doors', 'Doors are placed inside a space that already has doors.', s.id)
    if (hasDoors && s.kind === 'drawers') {
      // Doors over drawers: drawers become internal (no applied fronts).
    }

    // doors
    if (hasDoors && s.front) {
      const f = c.front
      const n = s.front.count
      const totalW = f.x1 - f.x0 - (n - 1) * g
      const widths = equalParts(totalW, n)
      let x = f.x0
      widths.forEach((w, i) => {
        const h = f.y1 - f.y0
        add(s.id, 'door', n === 1 ? 'Door' : i === 0 ? 'Door left' : 'Door right', front.id,
          box(x, f.y0, D, w, h, tf), 'z', 'y', ['-x', '+x', '-y', '+y'], i)
        if (w > 600) warn('door-wide', `Door ${w} mm wide; over ~600 mm consider two doors.`, s.id)
        if (w < 100 || h < 100) err('door-small', `Door ${w}×${h} mm is too small.`, s.id)
        x += w + g
      })
      const dh = f.y1 - f.y0
      hw({ nodeId: s.id, kind: 'hinge', label: 'Hinge, 35 mm cup, soft-close, clip-on', quantity: hingeCount(dh) * n, note: `${hingeCount(dh)} per door, ${hingeBand(dh)} (typical — confirm with the hinge datasheet)` })
    }
    const inner: Ctx = { ...c, behindDoors: c.behindDoors || hasDoors }

    switch (s.kind) {
      case 'empty':
        return
      case 'shelves': {
        const n = s.count
        if (n < 0 || !Number.isInteger(n) || n > 50) { err('shelf-count', 'Shelf count must be a whole number from 0 to 50.', s.id); return }
        if (n === 0) return
        const gapTotal = op.h - n * t
        if (gapTotal < (n + 1) * 20) { err('shelves-crowded', `${n} shelves do not fit in ${op.h} mm.`, s.id); return }
        const gaps = equalParts(gapTotal, n + 1)
        const sd = op.d - p.shelfSetback
        if (sd < 50) { err('shelf-shallow', 'Shelves would be shallower than 50 mm.', s.id); return }
        let y = op.y
        for (let i = 0; i < n; i++) {
          y += gaps[i]
          add(s.id, 'shelf', `Shelf ${i + 1}`, body.id, box(op.x, y, op.z, op.w, t, sd), 'y', 'x', ['+z'], i)
          y += t
        }
        if (op.w > 50 * t) warn('shelf-span', `Shelf span ${op.w} mm is long for ${t} mm board and may sag (rule of thumb ≤ ${50 * t} mm).`, s.id)
        return
      }
      case 'hanging': {
        if (s.railDrop < 0 || s.railDrop >= op.h) { err('rail-drop', 'Rail position is outside the space.', s.id); return }
        hw({ nodeId: s.id, kind: 'clothes-rail', label: 'Clothes rail', quantity: 1, sizeMm: op.w, note: 'cut to opening width' })
        hw({ nodeId: s.id, kind: 'rail-support', label: 'Rail support', quantity: 2 })
        if (op.d < 500) warn('hanging-shallow', `Opening depth ${op.d} mm; hangers usually need about 550 mm.`, s.id)
        if (op.h < 800) warn('hanging-short', `Only ${op.h} mm of height for hanging.`, s.id)
        return
      }
      case 'drawers': {
        const n = s.count
        if (n < 1 || !Number.isInteger(n) || n > 20) { err('drawer-count', 'Drawer count must be a whole number from 1 to 20.', s.id); return }
        if (n * 60 > op.h) { err('drawer-low', `${n} drawers do not fit in ${op.h} mm of height.`, s.id); return }
        const ds = p.drawers
        const internal = inner.behindDoors
        // Internal drawers stay clear of the closed door and hinge arms.
        const setback = internal ? Math.max(p.shelfSetback, INTERNAL_DRAWER_SETBACK) : 0
        const maxRunner = op.d - ds.rearClearance - setback
        const runner = [...ds.runnerLengths].sort((a, b) => a - b).filter(l => l <= maxRunner).pop()
        if (runner === undefined) {
          err('runner-fit', `No runner length fits ${maxRunner} mm of depth (available: ${ds.runnerLengths.join(', ')}).`, s.id)
          return
        }
        const bw = op.w - 2 * ds.sideClearance
        const tb = boxM.thickness, tbot = bottomM.thickness
        if (bw < 2 * tb + 50) { err('drawer-narrow', `Drawer box would be only ${bw} mm wide.`, s.id); return }
        const slots = equalParts(op.h, n)
        // fronts: split the front zone top→bottom
        const fz = c.front
        const frontHeights = equalParts(fz.y1 - fz.y0 - (n - 1) * g, n)
        let slotTop = op.y + op.h
        let frontTop = fz.y1
        const frontZ = D - setback
        for (let i = 0; i < n; i++) {
          const sh = slots[i]
          const slotBottom = slotTop - sh
          const bh = sh - ds.verticalClearance
          if (bh < 60) { err('drawer-low', `Drawer ${i + 1} box would be only ${bh} mm high.`, s.id); return }
          const by = slotBottom + lo(ds.verticalClearance)
          const bz = frontZ - runner
          const bx = op.x + ds.sideClearance
          const k = i + 1
          add(s.id, 'drawer-bottom', `Drawer ${k} bottom`, bottomM.id, box(bx, by, bz, bw, tbot, runner), 'y', 'x', [], i)
          const ph2 = bh - tbot, py = by + tbot
          add(s.id, 'drawer-side', `Drawer ${k} side`, boxM.id, box(bx, py, bz, tb, ph2, runner), 'x', 'z', ['+y'], 2 * i)
          add(s.id, 'drawer-side', `Drawer ${k} side`, boxM.id, box(bx + bw - tb, py, bz, tb, ph2, runner), 'x', 'z', ['+y'], 2 * i + 1)
          add(s.id, 'drawer-back', `Drawer ${k} back`, boxM.id, box(bx + tb, py, bz, bw - 2 * tb, ph2, tb), 'z', 'x', ['+y'], i)
          add(s.id, 'drawer-inner-front', `Drawer ${k} inner front`, boxM.id, box(bx + tb, py, frontZ - tb, bw - 2 * tb, ph2, tb), 'z', 'x', ['+y'], i)
          if (!internal) {
            const fh = frontHeights[i]
            add(s.id, 'drawer-front', `Drawer ${k} front`, front.id,
              box(fz.x0, frontTop - fh, D, fz.x1 - fz.x0, fh, tf), 'z', 'x', ['-x', '+x', '-y', '+y'], i)
            frontTop -= fh + g
          }
          slotTop = slotBottom
        }
        hw({ nodeId: s.id, kind: 'drawer-runner-pair', label: internal ? 'Ball-bearing side runner pair (internal drawers)' : 'Ball-bearing side runner pair', quantity: n, sizeMm: runner, note: `side clearance ${ds.sideClearance} mm per side` })
        if (internal) warn('internal-drawers', 'Drawers behind doors: check hinge and door clearance against the drawer boxes.', s.id)
        return
      }
      case 'split': {
        const k = s.children.length
        if (k < 2 || s.sizes.length !== k) { err('split-shape', 'A split needs at least two parts with one size each.', s.id); return }
        const along = s.axis === 'x' ? op.w : op.h
        const parts = distribute(along - (k - 1) * t, s.sizes)
        if (!parts || parts.some(v => v <= 0)) { err('split-fit', `Fixed sizes do not fit in ${along} mm.`, s.id); return }
        if (s.sizes.every(z => z.mode === 'mm')) {
          const asked = s.sizes.reduce((a, z) => a + z.value, 0), room = along - (k - 1) * t
          if (asked !== room) warn('split-resized', `Fixed sizes add up to ${asked} mm but there is ${room} mm; the last part was adjusted to ${parts[k - 1]} mm. Make one part "Share" to absorb the difference.`, s.id)
        }
        if (s.axis === 'x') {
          let x = op.x
          let prevFrontX = inner.front.x0
          parts.forEach((w, i) => {
            const last = i === k - 1
            const mid = x + w + lo(t)
            const fz: FrontZone = { ...inner.front, x0: prevFrontX, x1: last ? inner.front.x1 : mid - lo(g) }
            visit(s.children[i], { ...inner, opening: { ...op, x, w }, front: fz }, level + 1)
            if (!last) {
              add(s.id, 'divider', `Divider ${i + 1}`, body.id, box(x + w, op.y, op.z, t, op.h, op.d), 'x', 'y', ['+z'], i)
              prevFrontX = mid + hi(g)
            }
            x += w + t
          })
        } else {
          let top = op.y + op.h
          let prevFrontTop = inner.front.y1
          parts.forEach((h, i) => {
            const last = i === k - 1
            const bottom = top - h
            const mid = bottom - t + lo(t)
            const fz: FrontZone = { ...inner.front, y1: prevFrontTop, y0: last ? inner.front.y0 : mid + hi(g) }
            visit(s.children[i], { ...inner, opening: { ...op, y: bottom, h }, front: fz }, level + 1)
            if (!last) {
              add(s.id, 'divider', `Fixed shelf ${i + 1}`, body.id, box(op.x, bottom - t, op.z, op.w, t, op.d), 'y', 'x', ['+z'], i)
              prevFrontTop = mid - lo(g)
            }
            top = bottom - t
          })
        }
        return
      }
    }
  }
  visit(p.interior, root)
  return out
}
