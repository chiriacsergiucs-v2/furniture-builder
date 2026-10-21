/**
 * Independent layout validator (ADR-0018). Shares no code with the placer: it re-derives every rectangle from the
 * sheet, trim, cuts and kerf, and checks containment, kerf, grain, stock count, part instances, placements and
 * exact area conservation. Returns human-readable errors; an empty list means the layout may be shown.
 */
import type { CutTree, NestJob, NestResult, Placement } from './types'

const int = (n: unknown): n is number => typeof n === 'number' && Number.isSafeInteger(n)

interface Box { x: number; y: number; l: number; w: number }
interface Sums { part: number; kerf: number; waste: number; cuts: number; largest: number; leaves: Placement[] }

function checkJob(job: NestJob, errs: string[]) {
  const s = job.sheet
  if (!int(job.kerf) || job.kerf < 0) errs.push(`job kerf ${job.kerf} is not a non-negative integer`)
  if (!int(job.trim) || job.trim < 0) errs.push(`job trim ${job.trim} is not a non-negative integer`)
  if (!int(s.length) || !int(s.width) || s.length <= 0 || s.width <= 0) errs.push(`job sheet ${s.length}×${s.width} is not positive integer mm`)
  else if (int(job.trim) && (s.length <= 2 * job.trim || s.width <= 2 * job.trim)) errs.push(`trim ${job.trim} leaves no usable area`)
  if (s.count !== null && (!int(s.count) || s.count < 0)) errs.push(`job sheet count ${s.count} is invalid`)
  const seen = new Set<string>()
  for (const p of job.parts) {
    if (seen.has(p.key)) errs.push(`duplicate part key ${p.key}`)
    seen.add(p.key)
    if (!int(p.length) || !int(p.width) || p.length <= 0 || p.width <= 0) errs.push(`part ${p.key} size ${p.length}×${p.width} is not positive integer mm`)
    if (!int(p.quantity) || p.quantity < 0) errs.push(`part ${p.key} quantity ${p.quantity} is invalid`)
  }
}

export function validateNest(job: NestJob, result: NestResult): string[] {
  const errs: string[] = []
  checkJob(job, errs)
  if (result.materialId !== job.materialId) errs.push(`materialId ${result.materialId} ≠ job ${job.materialId}`)
  const parts = new Map(job.parts.map(p => [p.key, p]))
  const count = job.sheet.count
  if (count !== null && result.sheets.length > count) errs.push(`${result.sheets.length} sheets used but only ${count} available`)

  let tPart = 0, tSheet = 0, tTrim = 0, tKerf = 0, tWaste = 0, tCuts = 0, tLargest = 0
  const placedCount = new Map<string, number>()

  result.sheets.forEach((sh, si) => {
    const tag = `sheet ${si + 1}`
    if (sh.index !== si) errs.push(`${tag}: index ${sh.index}`)
    if (sh.length !== job.sheet.length || sh.width !== job.sheet.width) errs.push(`${tag}: size ${sh.length}×${sh.width} ≠ stock`)
    const u = sh.usable
    const ux = job.trim, ul = job.sheet.length - 2 * job.trim, uw = job.sheet.width - 2 * job.trim
    if (u.x !== ux || u.y !== ux || u.length !== ul || u.width !== uw) errs.push(`${tag}: usable area does not match trim ${job.trim}`)
    const sums: Sums = { part: 0, kerf: 0, waste: 0, cuts: 0, largest: 0, leaves: [] }
    // Walk from the trimmed area derived from the job, not from the reported `usable`.
    walk(sh.tree, { x: ux, y: ux, l: ul, w: uw }, job, parts, sums, errs, tag, 0)
    if (!sums.leaves.length) errs.push(`${tag}: no parts`)

    // Placements must equal the tree's part leaves exactly.
    const leafMap = new Map(sums.leaves.map(p => [`${p.key}#${p.instance}`, p]))
    if (sh.placements.length !== sums.leaves.length) errs.push(`${tag}: ${sh.placements.length} placements but ${sums.leaves.length} part leaves`)
    for (const p of sh.placements) {
      const id = `${p.key}#${p.instance}`
      const leaf = leafMap.get(id)
      if (!leaf) { errs.push(`${tag}: placement ${id} has no part leaf`); continue }
      if (leaf.x !== p.x || leaf.y !== p.y || leaf.length !== p.length || leaf.width !== p.width || leaf.rotated !== p.rotated) {
        errs.push(`${tag}: placement ${id} at ${p.x},${p.y} ${p.length}×${p.width} ≠ leaf ${leaf.x},${leaf.y} ${leaf.length}×${leaf.width}`)
      }
      if (![p.x, p.y, p.length, p.width].every(int)) errs.push(`${tag}: placement ${id} is not integer mm`)
    }
    for (const leaf of sums.leaves) {
      const id = `${leaf.key}#${leaf.instance}`
      placedCount.set(id, (placedCount.get(id) ?? 0) + 1)
    }

    const area = sh.length * sh.width
    const trim = area - ul * uw
    if (area !== sums.part + trim + sums.kerf + sums.waste) {
      errs.push(`${tag}: area ${area} ≠ parts ${sums.part} + trim ${trim} + kerf ${sums.kerf} + waste ${sums.waste}`)
    }
    tPart += sums.part; tSheet += area; tTrim += trim; tKerf += sums.kerf; tWaste += sums.waste; tCuts += sums.cuts
    tLargest = Math.max(tLargest, sums.largest)
  })

  // Every instance exactly once: placed or unplaced.
  const unplacedCount = new Map<string, number>()
  for (const u of result.unplaced) {
    const id = `${u.key}#${u.instance}`
    const p = parts.get(u.key)
    if (!p || !int(u.instance) || u.instance < 1 || u.instance > p.quantity) errs.push(`unplaced ${id} is not a part instance`)
    if (!u.reason) errs.push(`unplaced ${id} has no reason`)
    unplacedCount.set(id, (unplacedCount.get(id) ?? 0) + 1)
  }
  for (const p of job.parts) {
    const q = int(p.quantity) && p.quantity > 0 ? p.quantity : 0
    for (let k = 1; k <= q; k++) {
      const id = `${p.key}#${k}`
      const n = (placedCount.get(id) ?? 0) + (unplacedCount.get(id) ?? 0)
      if (n !== 1) errs.push(`part instance ${id} appears ${n} times`)
    }
  }
  for (const [id, n] of placedCount) {
    const [key, inst] = [id.slice(0, id.lastIndexOf('#')), Number(id.slice(id.lastIndexOf('#') + 1))]
    const p = parts.get(key)
    if (!p || inst > p.quantity || inst < 1) errs.push(`placed ${id} is not a part instance (×${n})`)
  }

  const st = result.stats
  const expect: [string, number, number][] = [
    ['sheetsUsed', st.sheetsUsed, result.sheets.length], ['partArea', st.partArea, tPart], ['sheetArea', st.sheetArea, tSheet],
    ['trimArea', st.trimArea, tTrim], ['kerfArea', st.kerfArea, tKerf], ['wasteArea', st.wasteArea, tWaste],
    ['cuts', st.cuts, tCuts], ['largestLeftover', st.largestLeftover, tLargest],
  ]
  for (const [name, got, want] of expect) if (got !== want) errs.push(`stats.${name} ${got} ≠ ${want}`)
  const util = tSheet ? tPart / tSheet : 0
  if (Math.abs(st.utilisation - util) > 1e-12) errs.push(`stats.utilisation ${st.utilisation} ≠ ${util}`)
  if (st.sheetArea !== st.partArea + st.trimArea + st.kerfArea + st.wasteArea) errs.push('stats do not conserve area')
  return errs
}

function walk(t: CutTree, b: Box, job: NestJob, parts: Map<string, NestJob['parts'][number]>, s: Sums, errs: string[], tag: string, depth: number) {
  if (depth > 10000) { errs.push(`${tag}: tree too deep`); return }
  if (![b.x, b.y, b.l, b.w].every(int) || b.l < 0 || b.w < 0) { errs.push(`${tag}: invalid rectangle ${JSON.stringify(b)}`); return }
  if (t.kind === 'waste') {
    if (t.length !== b.l || t.width !== b.w) errs.push(`${tag}: waste ${t.length}×${t.width} ≠ rectangle ${b.l}×${b.w} at ${b.x},${b.y}`)
    s.waste += b.l * b.w
    s.largest = Math.max(s.largest, b.l * b.w)
    return
  }
  if (t.kind === 'part') {
    const id = `${t.key}#${t.instance}`
    if (t.length !== b.l || t.width !== b.w || b.l <= 0 || b.w <= 0) errs.push(`${tag}: part ${id} ${t.length}×${t.width} ≠ rectangle ${b.l}×${b.w}`)
    const p = parts.get(t.key)
    if (!p) errs.push(`${tag}: part ${id} not in job`)
    else {
      if (t.rotated && job.grain) errs.push(`${tag}: part ${id} rotated on a grained board`)
      const [el, ew] = t.rotated ? [p.width, p.length] : [p.length, p.width]
      if (b.l !== el || b.w !== ew) errs.push(`${tag}: part ${id} occupies ${b.l}×${b.w}, expected ${el}×${ew}${job.grain ? ' with length along the grain' : ''}`)
    }
    s.part += b.l * b.w
    s.leaves.push({ key: t.key, instance: t.instance, x: b.x, y: b.y, length: b.l, width: b.w, rotated: t.rotated })
    return
  }
  s.cuts++
  if (t.kerf !== job.kerf) errs.push(`${tag}: cut kerf ${t.kerf} ≠ job kerf ${job.kerf}`)
  if (!int(t.at)) { errs.push(`${tag}: cut position ${t.at} is not integer`); return }
  const k = job.kerf
  let first: Box, second: Box
  if (t.orientation === 'across-length') {
    first = { x: b.x, y: b.y, l: t.at - b.x, w: b.w }
    second = { x: t.at + k, y: b.y, l: b.x + b.l - t.at - k, w: b.w }
    s.kerf += k * b.w
  } else if (t.orientation === 'along-length') {
    first = { x: b.x, y: b.y, l: b.l, w: t.at - b.y }
    second = { x: b.x, y: t.at + k, l: b.l, w: b.y + b.w - t.at - k }
    s.kerf += k * b.l
  } else { errs.push(`${tag}: unknown cut orientation`); return }
  const fe = t.orientation === 'across-length' ? first.l : first.w
  const se = t.orientation === 'across-length' ? second.l : second.w
  if (fe <= 0 || se < 0 || (k === 0 && se === 0)) { errs.push(`${tag}: cut at ${t.at} (${t.orientation}) falls outside its rectangle`); return }
  walk(t.first, first, job, parts, s, errs, tag, depth + 1)
  walk(t.second, second, job, parts, s, errs, tag, depth + 1)
}
