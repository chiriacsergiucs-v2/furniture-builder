import type { PartialModel } from './cabinet'
import { box, equalParts } from './geometry'
import type { Axis, Box, Face, FrameParams, Material, Mm, Panel, PanelRole } from './types'

/**
 * Frame furniture (ADR-0038): tables, benches, stools, chairs and beds built from legs, rails, stretchers, slats and
 * a top or deck. Fixed topology per kind, no space tree. Every member is an axis-aligned box; solid members are cut
 * from lengths (their section is the two short sides), panels from sheets.
 */

export const LEDGER_HEIGHT = 40
export const MATTRESS_LIP = 50
export const CENTRE_RAIL_HEIGHT = 80
export const CENTRE_RAIL_FROM = 1400
export const BACK_START = 100
const GUARD_RAIL = 100
const RUNG_PITCH = 250
const RUNG_HEIGHT = 30
const LADDER_WIDTH = 400

const axes: Axis[] = ['x', 'y', 'z']
const dim = (b: Box, a: Axis) => (a === 'x' ? b.w : a === 'y' ? b.h : b.d)

export function buildFrame(p: FrameParams, id: string, materials: Map<string, Material>): PartialModel {
  const out: PartialModel = { panels: [], spaces: [], hardware: [], diagnostics: [] }
  const err = (code: string, message: string) => { out.diagnostics.push({ severity: 'error', code, message, nodeId: id }); return out }
  const panelM = materials.get(p.panelMaterialId), solidM = materials.get(p.solidMaterialId)
  if (!panelM || !solidM) return err('material-missing', 'A material used by this frame does not exist in the design.')
  const counters = new Map<string, number>()
  /** A solid member: grain along its longest side, thickness its shortest. */
  const member = (role: PanelRole, label: string, b: Box) => {
    const sorted = [...axes].sort((a, c) => dim(b, c) - dim(b, a))
    push(role, label, solidM.id, b, sorted[2], sorted[0], [])
  }
  const sheet = (role: PanelRole, label: string, b: Box, thicknessAxis: Axis, grainAxis: Axis, banded: Face[]) => push(role, label, panelM.id, b, thicknessAxis, grainAxis, banded)
  function push(role: PanelRole, label: string, materialId: string, b: Box, thicknessAxis: Axis, grainAxis: Axis, banded: Face[]) {
    const i = counters.get(role) ?? 0
    counters.set(role, i + 1)
    out.panels.push({ id: `${id}/${role}/${i}`, nodeId: id, role, label, materialId, box: b, thicknessAxis, grainAxis, banded } satisfies Panel)
  }
  /** `n` members of width `w` spread over [from, from + span) with equal gaps, first and last at the ends. */
  const spread = (from: Mm, span: Mm, w: Mm, n: number): Mm[] => {
    if (n <= 1) return [from + Math.floor((span - w) / 2)]
    const gaps = equalParts(span - n * w, n - 1)
    const at: Mm[] = []
    let x = from
    for (let i = 0; i < n; i++) { at.push(x); x += w + (gaps[i] ?? 0) }
    return at
  }
  const slatCount = (span: Mm) => Math.max(1, Math.floor((span + p.slats.gap) / (p.slats.width + p.slats.gap)))

  if (p.kind === 'bed') return buildBed(p, out, err, member, sheet, spread, slatCount, panelM)

  // ---- tables, benches, stools, chairs ---------------------------------------
  const { width: W, depth: D, height: H, leg, legInset: li, apron, slats } = p
  const lw = leg.w, ld = leg.d, at = apron.thickness, ah = apron.height
  const back = p.kind === 'chair' || p.kind === 'bench' ? p.back ?? null : null
  const seatH = back ? back.seatHeight : H
  const topT = p.top === 'panel' ? panelM.thickness : slats.thickness
  const topY = seatH - topT
  if (W < 2 * (li + lw) + 50 || D < 2 * (li + ld) + 50 || topY < 100) return err('frame-too-small', `${W}×${H}×${D} mm is too small for ${lw}×${ld} mm legs.`)
  if (li < 0) return err('leg-inset', 'Legs cannot be set outside the top.')
  if (ah > 0 && (at > Math.min(lw, ld) || at <= 0)) return err('apron-thickness', `Rails ${at} mm thick must be no thicker than the ${Math.min(lw, ld)} mm legs.`)
  if (ah > 0 && ah >= topY - 50) return err('apron-height', `Rails ${ah} mm high leave no room under the top.`)
  if (p.top === 'slats' && ah <= 0) return err('slats-need-rails', 'A slatted top rests on rails: give the rails under the top a height.')
  if (back && (seatH <= 200 || seatH >= H - 2 * back.railHeight - BACK_START)) return err('back-height', `A back needs the seat (${seatH} mm) well below the top of the back (${H} mm).`)

  const xs = [li, W - li - lw], zs = [li, D - li - ld]
  // Back posts carry on up to the full height; the seat stops in front of them.
  zs.forEach((z, zi) => xs.forEach((x, xi) => {
    const post = back && zi === 0
    member('leg', post ? (xi ? 'Back post right' : 'Back post left') : (xi ? 'Front leg right' : 'Front leg left'), box(x, 0, z, lw, post ? H : topY, ld))
  }))
  const tz0 = back ? li + ld : 0
  const topLabel = p.kind === 'table' ? 'Table top' : 'Seat'
  const topRole: PanelRole = p.kind === 'table' ? 'top' : 'seat'
  if (p.top === 'panel') sheet(topRole, topLabel, box(0, topY, tz0, W, topT, D - tz0), 'y', 'x', ['-x', '+x', '-z', '+z'])
  else {
    // Slats run side to side over the rails; front and back slats sit over the legs, so nothing hangs unsupported.
    const z0 = Math.max(tz0, li), span = D - li - z0
    const n = slatCount(span)
    for (const z of spread(z0, span, slats.width, n)) member('slat', `${topLabel} slat`, box(0, topY, z, W, topT, slats.width))
  }
  const ring = (role: PanelRole, name: string, y: Mm, h: Mm, which: 'box' | 'h') => {
    const innerX = W - 2 * li - 2 * lw, innerZ = D - 2 * li - 2 * ld
    if (which === 'box') {
      member(role, `${name} back`, box(li + lw, y, li, innerX, h, at))
      member(role, `${name} front`, box(li + lw, y, D - li - at, innerX, h, at))
    }
    member(role, `${name} left`, box(li, y, li + ld, at, h, innerZ))
    member(role, `${name} right`, box(W - li - at, y, li + ld, at, h, innerZ))
    if (which === 'h') member(role, `${name} middle`, box(li + at, y, Math.floor((D - at) / 2), W - 2 * li - 2 * at, h, at))
  }
  if (ah > 0) ring('apron', 'Rail', topY - ah, ah, 'box')
  if (p.stretchers !== 'none') {
    const sh = Math.max(30, at)
    if (p.stretcherHeight < 50 || p.stretcherHeight + sh > topY - ah - 20) err('stretcher-height', `Stretchers at ${p.stretcherHeight} mm clash with the rails under the top.`)
    else ring('stretcher', 'Stretcher', p.stretcherHeight, sh, p.stretchers)
  }
  if (p.shelf) {
    const y = p.shelf.height - panelM.thickness
    if (y < 30 || p.shelf.height > topY - ah - 50) err('shelf-height', `A lower shelf at ${p.shelf.height} mm does not fit under the top.`)
    else {
      sheet('shelf', 'Lower shelf', box(li + lw, y, li + ld, W - 2 * li - 2 * lw, panelM.thickness, D - 2 * li - 2 * ld), 'y', 'x', ['-z', '+z'])
      out.diagnostics.push({ severity: 'warning', code: 'shelf-support', message: 'The lower shelf sits between the legs: fix it with cleats or dowels (not listed).', nodeId: id })
    }
  }
  if (back) {
    const bx = li + lw, bw = W - 2 * li - 2 * lw
    const y0 = seatH + BACK_START
    if (back.style === 'panel') {
      const bt = panelM.thickness
      sheet('seat', 'Back panel', box(bx, y0, li + Math.floor((ld - bt) / 2), bw, H - y0, bt), 'z', 'x', ['+y'])
    } else {
      const rz = li + Math.floor((ld - at) / 2)
      member('rail', 'Back rail top', box(bx, H - back.railHeight, rz, bw, back.railHeight, at))
      member('rail', 'Back rail bottom', box(bx, y0, rz, bw, back.railHeight, at))
      const sy = y0 + back.railHeight, sh = H - back.railHeight - sy
      const n = Math.max(1, Math.min(back.count, Math.floor(bw / (slats.width + 20))))
      const sz = li + Math.floor((ld - slats.thickness) / 2)
      for (const x of spread(bx + 20, bw - 40, slats.width, n)) member('slat', 'Back slat', box(x, sy, sz, slats.width, sh, slats.thickness))
    }
  }
  return out
}

type Err = (code: string, message: string) => PartialModel
type Member = (role: PanelRole, label: string, b: Box) => void
type Sheet = (role: PanelRole, label: string, b: Box, ta: Axis, ga: Axis, banded: Face[]) => void
type Spread = (from: Mm, span: Mm, w: Mm, n: number) => Mm[]

/** Beds: head and foot boards carry side rails; slats on ledgers; a centre rail on legs for wide beds; bunk tiers. */
function buildBed(p: FrameParams, out: PartialModel, err: Err, member: Member, sheet: Sheet, spread: Spread, slatCount: (span: Mm) => number, panelM: Material): PartialModel {
  const b = p.bed
  if (!b) return err('bed-missing', 'Bed settings are missing.')
  const pt = panelM.thickness, rt = p.apron.thickness, st = p.slats.thickness, sw = p.slats.width
  const { w: mw, l: ml } = b.mattress
  const c = b.clearance
  if (mw < 300 || ml < 600 || c < 0) return err('mattress-size', `A ${mw}×${ml} mm mattress is not a size this bed can take.`)
  const leftT = b.sidePanelHeight > 0 ? pt : rt
  const W = mw + 2 * c + leftT + rt, IL = ml + 2 * c, L = IL + 2 * pt
  const deck = b.deckHeight
  const railTop = deck + MATTRESS_LIP
  if (b.railHeight < MATTRESS_LIP + st + LEDGER_HEIGHT) return err('rail-height', `Side rails need at least ${MATTRESS_LIP + st + LEDGER_HEIGHT} mm of height to carry ledgers and slats.`)
  if (railTop - b.railHeight < 50) return err('deck-low', `Deck at ${deck} mm leaves no room under the side rails.`)
  const decks = b.tierGap > 0 ? [deck, deck + b.tierGap] : [deck]
  const top = decks[decks.length - 1]
  const tall = b.tierGap > 0 ? top + b.guardHeight : 0
  const headH = Math.max(b.headboardHeight, railTop, tall)
  const footH = Math.max(b.footboardHeight, railTop, tall)
  sheet('headboard', 'Headboard', box(0, 0, 0, W, headH, pt), 'z', 'x', ['-x', '+x', '+y'])
  sheet('footboard', 'Footboard', box(0, 0, L - pt, W, footH, pt), 'z', 'x', ['-x', '+x', '+y'])
  if (b.sidePanelHeight > 0) {
    if (b.sidePanelHeight < railTop) return err('side-panel', `The side panel must reach at least the top of the rails (${railTop} mm).`)
    sheet('gable', 'Side panel', box(0, 0, pt, pt, b.sidePanelHeight, IL), 'x', 'z', ['+y'])
  }
  decks.forEach((d, tier) => {
    const tag = decks.length > 1 ? (tier ? ' (top bunk)' : ' (bottom bunk)') : ''
    const rTop = d + MATTRESS_LIP
    if (!(b.sidePanelHeight > 0 && tier === 0)) member('rail', `Side rail left${tag}`, box(0, rTop - b.railHeight, pt, leftT, b.railHeight, IL))
    member('rail', `Side rail right${tag}`, box(W - rt, rTop - b.railHeight, pt, rt, b.railHeight, IL))
    const ly = d - st - LEDGER_HEIGHT
    member('ledger', `Slat ledger left${tag}`, box(leftT, ly, pt, rt, LEDGER_HEIGHT, IL))
    member('ledger', `Slat ledger right${tag}`, box(W - 2 * rt, ly, pt, rt, LEDGER_HEIGHT, IL))
    for (const z of spread(pt, IL, sw, slatCount(IL))) member('slat', `Slat${tag}`, box(leftT, d - st, z, W - leftT - rt, st, sw))
    if (mw >= CENTRE_RAIL_FROM) {
      const cx = Math.floor((W - rt) / 2)
      member('rail', `Centre rail${tag}`, box(cx, d - st - CENTRE_RAIL_HEIGHT, pt, rt, CENTRE_RAIL_HEIGHT, IL))
      if (tier === 0) {
        const lh = d - st - CENTRE_RAIL_HEIGHT
        for (const z of spread(pt, IL, p.leg.d, 4).slice(1, 3)) member('leg', 'Centre leg', box(cx + Math.floor((rt - p.leg.w) / 2), 0, z, p.leg.w, lh, p.leg.d))
      }
    }
    if (tier > 0) {
      const gy = d + b.guardHeight - GUARD_RAIL
      if (gy < rTop + 20) { out.diagnostics.push({ severity: 'warning', code: 'guard-low', message: `Guard rails ${b.guardHeight} mm above the top deck are too low to add over the side rails.`, nodeId: out.panels[0]?.nodeId }); return }
      member('rail', 'Guard rail left', box(0, gy, pt, leftT, GUARD_RAIL, IL))
      member('rail', 'Guard rail right', box(W - rt, gy, pt, rt, GUARD_RAIL, IL))
    }
  })
  if (b.tierGap > 0) {
    // Ladder on the outside of the footboard, at its right end.
    const lw = p.leg.w, ld = p.leg.d
    const x0 = W - LADDER_WIDTH
    member('stile', 'Ladder stile left', box(x0, 0, L, lw, tall, ld))
    member('stile', 'Ladder stile right', box(W - lw, 0, L, lw, tall, ld))
    for (let y = RUNG_PITCH; y + RUNG_HEIGHT <= top; y += RUNG_PITCH) member('rung', 'Ladder rung', box(x0 + lw, y, L, LADDER_WIDTH - 2 * lw, RUNG_HEIGHT, ld))
  }
  return out
}
