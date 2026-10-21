/**
 * Seeded property test written during an independent review of the geometry core.
 * For each random cabinet/desk that builds without error diagnostics it asserts: valid document, no throw,
 * integer mm, no overlaps, everything inside the envelope, no floating panels, fronts in the front plane,
 * exact gaps between fronts and half-gap outer reveals, drawer parts inside their slot, longest fitting runner.
 * FUZZ_N=50000 npx vitest run tests/fuzz.test.ts for a deep run.
 */
import { it, expect } from 'vitest'
import { buildModel } from '../src/core/build'
import { INTERNAL_DRAWER_SETBACK } from '../src/core/cabinet'
import { validateDesign, defaultDrawers } from '../src/core/design'
import { overlaps, contains } from '../src/core/geometry'
import type { Design, Space, Material, Box, CabinetParams, DeskParams } from '../src/core/types'

let seed = Number(process.env.SEED ?? 12345)
const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff }
const ri = (a: number, b: number) => a + Math.floor(rnd() * (b - a + 1))
const pick = <T>(xs: T[]): T => xs[ri(0, xs.length - 1)]
let idc = 0
const nid = () => `s${idc++}`

function genSpace(depth: number, doorsAbove: boolean): Space {
  const doors = !doorsAbove && rnd() < 0.3 ? { kind: 'doors' as const, count: pick([1, 2] as const) } : null
  const below = doorsAbove || !!doors
  const k = depth < 3 && rnd() < 0.45 ? 'split' : pick(['empty', 'shelves', 'hanging', 'drawers'] as const)
  const id = nid()
  switch (k) {
    case 'empty': return { id, kind: 'empty', front: doors }
    case 'shelves': return { id, kind: 'shelves', count: ri(0, 4), front: doors, ...(rnd() < 0.35 ? { adjustable: true } : {}) }
    case 'hanging': return { id, kind: 'hanging', railDrop: ri(20, 80), front: doors }
    case 'drawers': {
      const count = ri(1, 5)
      const heights = rnd() < 0.35 ? Array.from({ length: count }, () => rnd() < 0.3 ? { mode: 'mm' as const, value: ri(90, 250) } : { mode: 'fr' as const, value: ri(1, 3) }) : undefined
      return { id, kind: 'drawers', count, front: doors, ...(heights ? { heights } : {}) }
    }
    default: {
      const n = ri(2, 4)
      const children = Array.from({ length: n }, () => genSpace(depth + 1, below))
      return { id, kind: 'split', axis: pick(['x', 'y'] as const), sizes: children.map(() => rnd() < 0.25 ? { mode: 'mm' as const, value: ri(80, 400) } : { mode: 'fr' as const, value: ri(1, 3) }), children, front: doors }
    }
  }
}

function mats(): Material[] {
  return [
    { id: 'body', name: 'Body', thickness: pick([16, 18, 19, 25, 12]), grain: rnd() < 0.5, color: '#fff' },
    { id: 'front', name: 'Front', thickness: pick([16, 18, 19, 22]), grain: rnd() < 0.5, color: '#fff' },
    { id: 'back', name: 'Back', thickness: pick([3, 4, 5, 8]), grain: false, color: '#fff' },
    { id: 'box', name: 'Box', thickness: pick([12, 15, 16]), grain: false, color: '#fff' },
    { id: 'bot', name: 'Bot', thickness: pick([3, 5, 8]), grain: false, color: '#fff' },
    { id: 'top', name: 'Top', thickness: pick([18, 25, 38]), grain: true, color: '#fff' },
  ]
}
const drawers = () => ({ ...defaultDrawers(), sideClearance: ri(10, 14), verticalClearance: ri(20, 40), rearClearance: ri(0, 20), boxMaterialId: 'box', bottomMaterialId: 'bot' })

function genCabinet(): Design {
  idc = 0
  const params: CabinetParams = {
    width: ri(300, 2400), height: ri(300, 2400), depth: ri(250, 700),
    bodyMaterialId: 'body', frontMaterialId: 'front', backMaterialId: 'back',
    top: pick(['over', 'between'] as const), back: pick(['none', 'applied', 'inset'] as const), backInset: ri(0, 30),
    plinthHeight: pick([0, 0, ri(40, 120)]), plinthSetback: ri(0, 60), frontGap: ri(0, 6), shelfSetback: ri(0, 30), shelfClearance: ri(0, 2), pinRowSetback: pick([37, 37, ri(25, 60)]),
    drawers: drawers(), interior: genSpace(0, false),
  }
  return { schemaVersion: 1, id: 'd', name: 'f', createdAt: '', updatedAt: '', materials: mats(), product: { kind: 'cabinet', id: 'P', params } }
}
function genDesk(): Design {
  const params: DeskParams = {
    width: ri(800, 2400), depth: ri(450, 900), height: ri(650, 900), topMaterialId: 'top', bodyMaterialId: 'body',
    frontOverhang: ri(0, 60), support: pick(['gables', 'pedestal-left', 'pedestal-right', 'two-pedestals'] as const),
    pedestal: { width: ri(300, 600), drawerCount: ri(1, 5) }, modesty: { enabled: rnd() < 0.6, height: ri(100, 500), setback: ri(0, 200) },
    drawers: drawers(), frontMaterialId: 'front', frontGap: ri(0, 6),
  }
  return { schemaVersion: 1, id: 'd', name: 'f', createdAt: '', updatedAt: '', materials: mats(), product: { kind: 'desk', id: 'K', params } }
}

const FRONT = new Set(['door', 'drawer-front'])
const touches = (a: Box, b: Box) => {
  // share a face region (closed intervals intersect on all axes, positive on at least two)
  const iv = (a0: number, a1: number, b0: number, b1: number) => Math.min(a1, b1) - Math.max(a0, b0)
  const ox = iv(a.x, a.x + a.w, b.x, b.x + b.w), oy = iv(a.y, a.y + a.h, b.y, b.y + b.h), oz = iv(a.z, a.z + a.d, b.z, b.z + b.d)
  return ox >= 0 && oy >= 0 && oz >= 0 && [ox, oy, oz].filter(v => v > 0).length >= 2
}

function check(d: Design): string[] {
  const probs: string[] = []
  const v = validateDesign(d)
  if (v.length) probs.push('validate: ' + v.join(';'))
  let m
  try { m = buildModel(d) } catch (e) { return [...probs, 'THROW ' + (e as Error).message] }
  const errs = m.diagnostics.filter(x => x.severity === 'error')
  if (errs.length) return probs // only check invariants for designs reported clean
  const P = m.panels
  for (const p of P) for (const k of ['x', 'y', 'z', 'w', 'h', 'd'] as const) if (!Number.isSafeInteger(p.box[k])) probs.push(`nonint ${p.id}`)
  for (let i = 0; i < P.length; i++) for (let j = i + 1; j < P.length; j++) if (overlaps(P[i].box, P[j].box)) probs.push(`overlap ${P[i].id} ${P[j].id}`)
  const tf = d.materials.find(m => m.id === 'front')!.thickness
  const fronts = P.filter(p => FRONT.has(p.role))
  let W: number, H: number, Dd: number, ph: number, g: number, envD: number
  if (d.product.kind === 'cabinet') { const c = d.product.params; W = c.width; H = c.height; Dd = c.depth; ph = c.plinthHeight; g = c.frontGap; envD = Dd }
  else { const c = d.product.params; W = c.width; H = c.height; Dd = c.depth - c.frontOverhang; ph = 0; g = c.frontGap; envD = c.depth }
  const env: Box = { x: 0, y: 0, z: 0, w: W, h: H, d: envD }
  for (const p of P) if (!FRONT.has(p.role) && !contains(env, p.box)) probs.push(`outside ${p.id}`)
  for (const f of fronts) {
    if (f.box.z !== Dd || f.box.d !== tf) probs.push(`front-z ${f.id} z=${f.box.z} expected ${Dd}`)
    if (d.product.kind === 'desk' && f.box.z + f.box.d > envD && !m.diagnostics.some(x => x.code === 'fronts-proud')) probs.push(`front-protrudes-past-worktop ${f.id} by ${f.box.z + f.box.d - envD}`)
  }
  // floating: every non-front panel must touch another panel (drawer parts each other; shelves the carcass)
  // Adjustable shelves rest on pins (ADR-0023): they are supported only if both neighbouring panels carry pin rows.
  const onPins = (p: (typeof P)[number]) => p.label.startsWith('Adjustable shelf') &&
    P.filter(q => q.pinRows?.length && (q.box.x + q.box.w <= p.box.x || q.box.x >= p.box.x + p.box.w)).length >= 2
  for (const p of P) if (!FRONT.has(p.role) && !onPins(p) && !P.some(q => q !== p && touches(p.box, q.box))) probs.push(`floating ${p.id}`)
  // front gaps (cabinet only for outer reveal)
  const r = Math.floor(g / 2)
  if (d.product.kind === 'cabinet') {
    for (const f of fronts) {
      const b = f.box
      if (b.x < r || b.x + b.w > W - r || b.y < ph + r || b.y + b.h > H - r) probs.push(`reveal<half ${f.id}`)
    }
  }
  const t = d.materials.find(m => m.id === 'body')!.thickness
  for (let i = 0; i < fronts.length; i++) for (let j = 0; j < fronts.length; j++) {
    if (i === j) continue
    const a = fronts[i].box, b = fronts[j].box
    const yo = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y)
    const xo = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x)
    if (yo > 0 && b.x >= a.x + a.w) { const gap = b.x - a.x - a.w; if (gap !== g && gap <= g + t + 20) probs.push(`xgap ${gap}!=${g} ${fronts[i].id}|${fronts[j].id}`) }
    if (xo > 0 && b.y >= a.y + a.h) { const gap = b.y - a.y - a.h; if (gap !== g && gap <= g + t + 20) probs.push(`ygap ${gap}!=${g} ${fronts[i].id}|${fronts[j].id}`) }
  }
  for (const p of P) if (p.role.startsWith('drawer-') && p.role !== 'drawer-front' || p.role === 'shelf') {
    const sp = m.spaces.find(s => s.nodeId === p.nodeId)
    if (sp && !contains(sp.box, p.box)) probs.push(`notInSpace ${p.id}`)
  }
  if (d.product.kind === 'cabinet') for (const h of m.hardware) if (h.kind === 'drawer-runner-pair') {
    const sp = m.spaces.find(s => s.nodeId === h.nodeId)!
    const c = d.product.params
    const setback = h.label.includes('internal') ? Math.max(c.shelfSetback, INTERNAL_DRAWER_SETBACK) : 0
    const best = Math.max(...c.drawers.runnerLengths.filter(l => l <= sp.box.d - c.drawers.rearClearance - setback))
    if (best !== h.sizeMm) probs.push(`runnerChoice ${h.sizeMm} vs ${best}`)
  }
  // runners
  for (const h of m.hardware) if (h.kind === 'drawer-runner-pair' && !d.product.params.drawers.runnerLengths.includes(h.sizeMm!)) probs.push('runner not in list')
  // cutlist edge counts 0..2
  return probs
}

it('random designs keep every geometric invariant (seeded fuzz)', () => {
  const N = Number(process.env.FUZZ_N ?? 3000)
  const found: Record<string, { n: number; ex: Design; probs: string[] }> = {}
  let clean = 0
  for (let i = 0; i < N; i++) {
    const d = i % 4 === 3 ? genDesk() : genCabinet()
    const probs = check(d)
    const m = (() => { try { return buildModel(d) } catch { return null } })()
    if (m && !m.diagnostics.some(x => x.severity === 'error')) clean++
    for (const p of probs) {
      const key = p.split(' ')[0]
      if (!found[key]) found[key] = { n: 0, ex: d, probs }
      found[key].n++
    }
  }
  // At least a third of random designs must be buildable, or the generator is not exercising geometry.
  expect(clean).toBeGreaterThan(N / 3)
  expect(Object.fromEntries(Object.entries(found).map(([k, v]) => [k, { n: v.n, probs: v.probs.slice(0, 3) }]))).toEqual({})
})
