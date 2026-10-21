import { box, distribute, equalParts } from './geometry'
import type {
  Box, CabinetParams, Diagnostic, Face, Handle, HardwareItem, Material, Mm, Panel, PanelRole, PinRows, Space, SpaceOpening,
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
  /** Leave out one side panel; top, bottom, plinth, inset back and the opening run to that edge (L-corners). */
  omitSide?: 'left' | 'right'
  /** Shorten the front zone at either end (corner doors that must clear each other). */
  frontTrim?: { left?: Mm; right?: Mm }
}

export interface PartialModel { panels: Panel[]; spaces: SpaceOpening[]; hardware: HardwareItem[]; diagnostics: Diagnostic[] }

/** 32 mm system (ADR-0023). */
export const PIN_PITCH = 32
export const PIN_DIAMETER = 5
export const DEFAULT_SHELF_CLEARANCE = 1
export const DEFAULT_PIN_ROW_SETBACK = 37

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
  /** Attach handle holes to the front that was just added (positions from the front's left/bottom edges). */
  const placeHandle = (h: Handle | null | undefined, kind: 'door' | 'drawer', w: Mm, hgt: Mm, openEdge: 'left' | 'right' | null, nodeId: string) => {
    if (!h || h.kind === 'push') return
    const panel = out.panels[out.panels.length - 1]
    const pos = h.position ?? (kind === 'drawer' ? 'top' : 'centre')
    const inset = kind === 'drawer' ? 40 : 100
    const vc = pos === 'top' ? hgt - Math.min(inset, lo(hgt)) : pos === 'bottom' ? Math.min(inset, lo(hgt)) : lo(hgt)
    const uc = kind === 'drawer' ? lo(w) : openEdge === 'left' ? Math.min(40, lo(w)) : w - Math.min(40, lo(w))
    if (h.kind === 'knob') { panel.handleHoles = { at: [[uc, vc]], diameter: 5 }; return }
    const S = h.holeSpacing ?? 128
    const along = kind === 'drawer' ? w : hgt
    if (S + 40 > along) { out.diagnostics.push({ severity: 'warning', code: 'handle-fit', message: `${S} mm handle does not fit on ${panel.label.toLowerCase()} (${along} mm).`, nodeId: mapNode(nodeId) }); return }
    const centre = kind === 'drawer' ? uc : vc
    let a = centre - lo(S), b = centre + hi(S)
    // keep the holes on the front at top/bottom positions
    if (kind === 'door' && b > hgt - 20) { b = hgt - 20; a = b - S }
    if (kind === 'door' && a < 20) { a = 20; b = a + S }
    panel.handleHoles = { at: kind === 'drawer' ? [[a, vc], [b, vc]] : [[uc, a], [uc, b]], diameter: 5 }
  }
  const hw = (item: HardwareItem) => out.hardware.push({ ...item, nodeId: mapNode(item.nodeId) })

  const { width: W, height: H, depth: D } = p
  const wall = p.mount === 'wall'
  const ph = wall ? 0 : p.plinthHeight
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
  // Inner span between the sides; an omitted side lets everything run to that edge.
  const L = opts.omitSide === 'left' ? 0 : t, R = opts.omitSide === 'right' ? 0 : t
  const span = W - L - R
  if (opts.omitSide !== 'left') add(pid, 'side', 'Left side', body.id, box(0, 0, z0, t, sideH, Dc), 'x', 'y', ['+z'], 0)
  if (opts.omitSide !== 'right') add(pid, 'side', 'Right side', body.id, box(W - t, 0, z0, t, sideH, Dc), 'x', 'y', ['+z'], 1)
  if (p.top === 'over') add(pid, 'top', 'Top', body.id, box(0, H - t, z0, W, t, Dc), 'y', 'x', ['+z', '-x', '+x'])
  else add(pid, 'top', 'Top', body.id, box(L, H - t, z0, span, t, Dc), 'y', 'x', ['+z'])
  add(pid, 'bottom', 'Bottom', body.id, box(L, ph, z0, span, t, Dc), 'y', 'x', ['+z'])
  if (ph > 0) {
    add(pid, 'plinth', 'Plinth', body.id, box(L, 0, D - p.plinthSetback - t, span, ph, t), 'z', 'x', ['-y'])
  }
  let openZ = z0
  if (p.back === 'applied') {
    add(pid, 'back', 'Back', backM.id, box(0, ph, 0, W, H - ph, bt), 'z', 'y', [])
  } else if (p.back === 'inset') {
    if (p.backInset < 0 || p.backInset + bt > D - 2 * t) err('back-inset', 'Back inset does not fit in the carcass depth.', pid)
    add(pid, 'back', 'Back', backM.id, box(L, ph + t, p.backInset, span, H - ph - 2 * t, bt), 'z', 'y', [])
    openZ = p.backInset + bt
  }
  if (wall) {
    hw({ nodeId: pid, kind: 'wall-bracket', label: 'Adjustable hanging bracket', quantity: 2, note: 'one in each top back corner (confirm with the bracket datasheet and the wall type)' })
    hw({ nodeId: pid, kind: 'wall-rail', label: 'Wall rail for hanging brackets', quantity: 1, sizeMm: W, note: 'cut to cabinet width' })
    if (p.back !== 'inset' || p.backInset < 15) warn('wall-back', 'Hanging brackets usually need the back set in about 15–20 mm; check the bracket datasheet.', pid)
  }

  const adjustable: { spaceId: string; op: Box; shelfDepth: Mm }[] = []
  const style = p.frontStyle ?? 'overlay'
  const inset = style === 'inset'
  const r = lo(g)
  // Overlay covers the outer panels; half overlay stops half a gap short of their centre lines (as at dividers).
  const baseFront: FrontZone = style === 'half'
    ? { x0: lo(t) + hi(g), x1: W - t + lo(t) - lo(g), y0: ph + lo(t) + hi(g), y1: H - t + lo(t) - lo(g) }
    : { x0: r, x1: W - r, y0: ph + r, y1: H - r }
  const rootFront: FrontZone = { ...baseFront, x0: baseFront.x0 + (opts.frontTrim?.left ?? 0), x1: baseFront.x1 - (opts.frontTrim?.right ?? 0) }
  const root: Ctx = {
    opening: box(L, ph + t, openZ, span, H - ph - 2 * t, D - openZ),
    front: rootFront,
    behindDoors: false,
  }
  /** Inset fronts sit inside their own opening with the full gap all round, flush with the carcass front. */
  const zoneOf = (c: Ctx): FrontZone => inset
    ? { x0: c.opening.x + g, x1: c.opening.x + c.opening.w - g, y0: c.opening.y + g, y1: c.opening.y + c.opening.h - g }
    : c.front
  const frontZ = inset ? D - tf : D
  const handleHw = (nodeId: string, h: Handle | null | undefined, fronts: number) => {
    if (!h || fronts <= 0) return
    if (h.kind === 'push') hw({ nodeId, kind: 'push-latch', label: 'Push latch (push-to-open)', quantity: fronts, note: 'use hinges without self-closing spring for doors (check the latch datasheet)' })
    else hw({ nodeId, kind: 'handle', label: h.kind === 'bar' ? `Bar handle, ${h.holeSpacing ?? 128} mm centres` : 'Knob', quantity: fronts })
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
      const f = zoneOf(c)
      const n = s.front.count
      const totalW = f.x1 - f.x0 - (n - 1) * g
      const widths = equalParts(totalW, n)
      let x = f.x0
      widths.forEach((w, i) => {
        const h = f.y1 - f.y0
        // The handle goes on the opening edge: right edge of a left-hinged door, the meeting edges of a pair.
        const openEdge: 'left' | 'right' = n === 2 ? (i === 0 ? 'right' : 'left') : (s.front!.hinge === 'right' ? 'left' : 'right')
        add(s.id, 'door', n === 1 ? 'Door' : i === 0 ? 'Door left' : 'Door right', front.id,
          box(x, f.y0, frontZ, w, h, tf), 'z', 'y', ['-x', '+x', '-y', '+y'], i)
        placeHandle(s.handle, 'door', w, h, openEdge, s.id)
        if (w > 600) warn('door-wide', `Door ${w} mm wide; over ~600 mm consider two doors.`, s.id)
        if (w < 100 || h < 100) err('door-small', `Door ${w}×${h} mm is too small.`, s.id)
        x += w + g
      })
      const dh = f.y1 - f.y0
      hw({ nodeId: s.id, kind: 'hinge', label: 'Hinge, 35 mm cup, soft-close, clip-on', quantity: hingeCount(dh) * n, note: `${hingeCount(dh)} per door, ${hingeBand(dh)} (typical — confirm with the hinge datasheet)` })
      handleHw(s.id, s.handle, n)
    }
    // Behind inset doors everything moves back by the door thickness.
    const innerOpening = hasDoors && inset ? { ...op, d: op.d - tf } : op
    if (innerOpening.d <= 0) { err('space-too-small', 'No depth left behind the inset doors.', s.id); return }
    const inner: Ctx = { ...c, opening: innerOpening, behindDoors: c.behindDoors || hasDoors }

    const ip = inner.opening
    switch (s.kind) {
      case 'empty':
        return
      case 'shelves': {
        const n = s.count
        if (n < 0 || !Number.isInteger(n) || n > 50) { err('shelf-count', 'Shelf count must be a whole number from 0 to 50.', s.id); return }
        if (n === 0) return
        const gapTotal = ip.h - n * t
        if (gapTotal < (n + 1) * 20) { err('shelves-crowded', `${n} shelves do not fit in ${ip.h} mm.`, s.id); return }
        const gaps = equalParts(gapTotal, n + 1)
        const sd = ip.d - p.shelfSetback
        if (sd < 50) { err('shelf-shallow', 'Shelves would be shallower than 50 mm.', s.id); return }
        const clear = s.adjustable ? (p.shelfClearance ?? DEFAULT_SHELF_CLEARANCE) : 0
        if (s.adjustable && ip.w - 2 * clear < 50) { err('shelf-narrow', 'Adjustable shelves would be narrower than 50 mm.', s.id); return }
        let y = ip.y
        for (let i = 0; i < n; i++) {
          y += gaps[i]
          add(s.id, 'shelf', s.adjustable ? `Adjustable shelf ${i + 1}` : `Shelf ${i + 1}`, body.id,
            box(ip.x + clear, y, ip.z, ip.w - 2 * clear, t, sd), 'y', 'x', ['+z'], i)
          y += t
        }
        if (s.adjustable) {
          adjustable.push({ spaceId: s.id, op: ip, shelfDepth: sd })
          hw({ nodeId: s.id, kind: 'shelf-pin', label: 'Shelf pin, 5 mm', quantity: 4 * n, note: '4 per adjustable shelf (typical)' })
        }
        if (ip.w > 50 * t) warn('shelf-span', `Shelf span ${ip.w} mm is long for ${t} mm board and may sag (rule of thumb ≤ ${50 * t} mm).`, s.id)
        return
      }
      case 'hanging': {
        if (s.railDrop < 0 || s.railDrop >= ip.h) { err('rail-drop', 'Rail position is outside the space.', s.id); return }
        hw({ nodeId: s.id, kind: 'clothes-rail', label: 'Clothes rail', quantity: 1, sizeMm: ip.w, note: 'cut to opening width' })
        hw({ nodeId: s.id, kind: 'rail-support', label: 'Rail support', quantity: 2 })
        if (ip.d < 500) warn('hanging-shallow', `Opening depth ${ip.d} mm; hangers usually need about 550 mm.`, s.id)
        if (ip.h < 800) warn('hanging-short', `Only ${ip.h} mm of height for hanging.`, s.id)
        return
      }
      case 'drawers': {
        const n = s.count
        if (n < 1 || !Number.isInteger(n) || n > 20) { err('drawer-count', 'Drawer count must be a whole number from 1 to 20.', s.id); return }
        if (n * 60 > ip.h) { err('drawer-low', `${n} drawers do not fit in ${ip.h} mm of height.`, s.id); return }
        const ds = p.drawers
        const internal = inner.behindDoors
        // Internal drawers stay clear of the closed door and hinge arms; inset fronts sit in front of the box.
        const setback = internal ? Math.max(p.shelfSetback, INTERNAL_DRAWER_SETBACK) : inset ? tf : 0
        const maxRunner = ip.d - ds.rearClearance - setback
        const runner = [...ds.runnerLengths].sort((a, b) => a - b).filter(l => l <= maxRunner).pop()
        if (runner === undefined) {
          err('runner-fit', `No runner length fits ${maxRunner} mm of depth (available: ${ds.runnerLengths.join(', ')}).`, s.id)
          return
        }
        const bw = ip.w - 2 * ds.sideClearance
        const tb = boxM.thickness, tbot = bottomM.thickness
        if (bw < 2 * tb + 50) { err('drawer-narrow', `Drawer box would be only ${bw} mm wide.`, s.id); return }
        // fronts: split the front zone top→bottom
        const fz = zoneOf(c)
        const custom = s.heights && s.heights.length === n ? s.heights : undefined
        if (s.heights && !custom) { err('drawer-heights', `Give one height per drawer (${n}).`, s.id); return }
        const frontRoom = fz.y1 - fz.y0 - (n - 1) * g
        const frontHeights = custom && !internal ? distribute(frontRoom, custom) : equalParts(frontRoom, n)
        if (!frontHeights || frontHeights.some(v => v <= 0)) { err('drawer-heights', `Drawer heights do not fit in ${frontRoom} mm of front.`, s.id); return }
        let slots: Mm[]
        if (!custom) slots = equalParts(ip.h, n)
        else if (internal) {
          const sl = distribute(ip.h, custom)
          if (!sl || sl.some(v => v <= 0)) { err('drawer-heights', `Drawer heights do not fit in ${ip.h} mm.`, s.id); return }
          slots = sl
        } else {
          // Each drawer box sits behind its own front: slot boundaries follow the middle of the gaps between fronts.
          slots = []
          let top = ip.y + ip.h, ft = fz.y1
          for (let i = 0; i < n; i++) {
            const fb = ft - frontHeights[i]
            const bottom = i === n - 1 ? ip.y : Math.min(top, Math.max(ip.y, fb - lo(g)))
            slots.push(top - bottom)
            top = bottom; ft = fb - g
          }
        }
        if (custom && custom.every(z => z.mode === 'mm')) {
          const room = internal ? ip.h : frontRoom
          const asked = custom.reduce((a, z) => a + z.value, 0)
          if (asked !== room) warn('drawer-heights-resized', `Drawer heights add up to ${asked} mm but there is ${room} mm; the bottom drawer was adjusted. Make one drawer "Share" to absorb the difference.`, s.id)
        }
        let slotTop = ip.y + ip.h
        let frontTop = fz.y1
        const boxFront = ip.z + ip.d - setback
        for (let i = 0; i < n; i++) {
          const sh = slots[i]
          const slotBottom = slotTop - sh
          const bh = sh - ds.verticalClearance
          if (bh < 60) { err('drawer-low', `Drawer ${i + 1} box would be only ${bh} mm high.`, s.id); return }
          const by = slotBottom + lo(ds.verticalClearance)
          const bz = boxFront - runner
          const bx = ip.x + ds.sideClearance
          const k = i + 1
          add(s.id, 'drawer-bottom', `Drawer ${k} bottom`, bottomM.id, box(bx, by, bz, bw, tbot, runner), 'y', 'x', [], i)
          const ph2 = bh - tbot, py = by + tbot
          add(s.id, 'drawer-side', `Drawer ${k} side`, boxM.id, box(bx, py, bz, tb, ph2, runner), 'x', 'z', ['+y'], 2 * i)
          add(s.id, 'drawer-side', `Drawer ${k} side`, boxM.id, box(bx + bw - tb, py, bz, tb, ph2, runner), 'x', 'z', ['+y'], 2 * i + 1)
          add(s.id, 'drawer-back', `Drawer ${k} back`, boxM.id, box(bx + tb, py, bz, bw - 2 * tb, ph2, tb), 'z', 'x', ['+y'], i)
          add(s.id, 'drawer-inner-front', `Drawer ${k} inner front`, boxM.id, box(bx + tb, py, boxFront - tb, bw - 2 * tb, ph2, tb), 'z', 'x', ['+y'], i)
          if (!internal) {
            const fh = frontHeights[i]
            add(s.id, 'drawer-front', `Drawer ${k} front`, front.id,
              box(fz.x0, frontTop - fh, frontZ, fz.x1 - fz.x0, fh, tf), 'z', 'x', ['-x', '+x', '-y', '+y'], i)
            placeHandle(s.handle, 'drawer', fz.x1 - fz.x0, fh, null, s.id)
            frontTop -= fh + g
          }
          slotTop = slotBottom
        }
        hw({ nodeId: s.id, kind: 'drawer-runner-pair', label: internal ? 'Ball-bearing side runner pair (internal drawers)' : 'Ball-bearing side runner pair', quantity: n, sizeMm: runner, note: `side clearance ${ds.sideClearance} mm per side` })
        if (!internal) handleHw(s.id, s.handle, n)
        if (internal) warn('internal-drawers', 'Drawers behind doors: check hinge and door clearance against the drawer boxes.', s.id)
        return
      }
      case 'split': {
        const k = s.children.length
        if (k < 2 || s.sizes.length !== k) { err('split-shape', 'A split needs at least two parts with one size each.', s.id); return }
        const along = s.axis === 'x' ? ip.w : ip.h
        const parts = distribute(along - (k - 1) * t, s.sizes)
        if (!parts || parts.some(v => v <= 0)) { err('split-fit', `Fixed sizes do not fit in ${along} mm.`, s.id); return }
        if (s.sizes.every(z => z.mode === 'mm')) {
          const asked = s.sizes.reduce((a, z) => a + z.value, 0), room = along - (k - 1) * t
          if (asked !== room) warn('split-resized', `Fixed sizes add up to ${asked} mm but there is ${room} mm; the last part was adjusted to ${parts[k - 1]} mm. Make one part "Share" to absorb the difference.`, s.id)
        }
        if (s.axis === 'x') {
          let x = ip.x
          let prevFrontX = inner.front.x0
          parts.forEach((w, i) => {
            const last = i === k - 1
            const mid = x + w + lo(t)
            const fz: FrontZone = { ...inner.front, x0: prevFrontX, x1: last ? inner.front.x1 : mid - lo(g) }
            visit(s.children[i], { ...inner, opening: { ...ip, x, w }, front: fz }, level + 1)
            if (!last) {
              add(s.id, 'divider', `Divider ${i + 1}`, body.id, box(x + w, ip.y, ip.z, t, ip.h, ip.d), 'x', 'y', ['+z'], i)
              prevFrontX = mid + hi(g)
            }
            x += w + t
          })
        } else {
          let top = ip.y + ip.h
          let prevFrontTop = inner.front.y1
          parts.forEach((h, i) => {
            const last = i === k - 1
            const bottom = top - h
            const mid = bottom - t + lo(t)
            const fz: FrontZone = { ...inner.front, y1: prevFrontTop, y0: last ? inner.front.y0 : mid + hi(g) }
            visit(s.children[i], { ...inner, opening: { ...ip, y: bottom, h }, front: fz }, level + 1)
            if (!last) {
              add(s.id, 'divider', `Fixed shelf ${i + 1}`, body.id, box(ip.x, bottom - t, ip.z, ip.w, t, ip.d), 'y', 'x', ['+z'], i)
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
  addPinRows(out.panels, adjustable.map(a => ({ ...a, op: { ...a.op, x: a.op.x + o.x, y: a.op.y + o.y, z: a.op.z + o.z } })),
    p.pinRowSetback ?? DEFAULT_PIN_ROW_SETBACK, out.diagnostics)
  return out
}

const SUPPORTS = new Set<PanelRole>(['side', 'divider', 'gable'])

/**
 * Give the vertical panels either side of each adjustable-shelf space a pair of 32 mm hole rows (ADR-0023).
 * Holes sit on one grid per panel measured from its bottom edge: the +x face on multiples of 32, the −x face offset
 * by 16, so holes from the two faces of a divider never meet. Rows are set back from the front and rear of the
 * shelves themselves (not the panel), so both rows always carry the shelf.
 */
function addPinRows(panels: Panel[], spaces: { spaceId: string; op: Box; shelfDepth: Mm }[], setback: Mm, diags: Diagnostic[]) {
  for (const { spaceId, op, shelfDepth } of spaces) {
    const sides: [Face, (p: Panel) => boolean][] = [
      ['+x', p => p.box.x + p.box.w === op.x],
      ['-x', p => p.box.x === op.x + op.w],
    ]
    for (const [face, touches] of sides) {
      const panel = panels.find(p => SUPPORTS.has(p.role) && p.thicknessAxis === 'x' && touches(p) &&
        p.box.y <= op.y && p.box.y + p.box.h >= op.y + op.h && p.box.z <= op.z && p.box.z + p.box.d >= op.z + op.d)
      if (!panel) { diags.push({ severity: 'warning', code: 'pin-rows-no-panel', message: 'No side panel found for shelf pins on one side of an adjustable space.', nodeId: spaceId }); continue }
      if (shelfDepth < 2 * setback + PIN_PITCH) { diags.push({ severity: 'warning', code: 'pin-rows-shallow', message: `Shelves ${shelfDepth} mm deep are too shallow for two pin rows ${setback} mm from their edges.`, nodeId: spaceId }); continue }
      const offset = face === '+x' ? 0 : PIN_PITCH / 2
      const lowest = op.y - panel.box.y + 2 * PIN_PITCH, highest = op.y + op.h - panel.box.y - 2 * PIN_PITCH
      const holes: Mm[] = []
      for (let h = Math.ceil((lowest - offset) / PIN_PITCH) * PIN_PITCH + offset; h <= highest; h += PIN_PITCH) holes.push(h)
      if (!holes.length) continue
      const rear = op.z - panel.box.z + setback, front = op.z + shelfDepth - panel.box.z - setback
      const rows: PinRows = { face, rows: [rear, front], holes, diameter: PIN_DIAMETER }
      panel.pinRows = [...(panel.pinRows ?? []), rows]
    }
  }
}
