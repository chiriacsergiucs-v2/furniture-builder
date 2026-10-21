/**
 * Sheet nesting (ADR-0018): unit tests plus a seeded fuzz that checks every layout against the independent
 * validator and that mutated layouts are rejected. FUZZ_N=5000 npx vitest run tests/nesting.test.ts for a deep run.
 */
import { describe, it, expect } from 'vitest'
import type { CutRow } from '../src/core/cutlist'
import { jobsFromCutlist, nest, validateNest } from '../src/core/nesting'
import type { CutTree, NestJob, NestPart, NestResult } from '../src/core/nesting'

const KERF = 4, TRIM = 10
const PAL = { length: 2800, width: 2070 }
const MDF = { length: 2440, width: 1220 }

const job = (parts: NestPart[], over: Partial<NestJob> = {}): NestJob => ({
  materialId: 'pal18', materialName: 'PAL 18', thickness: 18, grain: false,
  sheet: { ...PAL, count: null }, trim: TRIM, kerf: KERF, parts, ...over,
})
const part = (key: string, length: number, width: number, quantity = 1): NestPart => ({ key, label: key, length, width, quantity })
const clone = <T>(x: T): T => JSON.parse(JSON.stringify(x)) as T

describe('nest', () => {
  it('fits parts exactly with kerf between them (usable 2780 = 1388 + 4 + 1388)', () => {
    const r = nest(job([part('a', 1388, 2050, 2)]))
    expect(r.valid).toBe(true)
    expect(r.unplaced).toEqual([])
    expect(r.stats.sheetsUsed).toBe(1)
    expect(r.stats.wasteArea).toBe(0)
    expect(r.stats.kerfArea).toBe(KERF * 2050)
    expect(r.sheets[0].placements.map(p => [p.x, p.y])).toEqual([[10, 10], [1402, 10]])
  })

  it('accepts a residual exactly equal to the kerf', () => {
    const r = nest(job([part('a', 2776, 2050)]))
    expect(r.valid).toBe(true)
    expect(r.unplaced).toEqual([])
    expect(r.stats.kerfArea).toBe(KERF * 2050)
  })

  it('rejects a sub-kerf sliver instead of absorbing it', () => {
    const r = nest(job([part('a', 2778, 2050)]))
    expect(r.valid).toBe(true)
    expect(r.unplaced).toEqual([{ key: 'a', instance: 1, reason: 'too-large' }])
    // 1389 + 4 + 1388 = 2781 > 2780: the second part needs another sheet.
    const r2 = nest(job([part('a', 1389, 2050), part('b', 1388, 2050)]))
    expect(r2.valid).toBe(true)
    expect(r2.stats.sheetsUsed).toBe(2)
  })

  it('never rotates parts on grained boards', () => {
    const parts = [part('side', 720, 560, 4), part('shelf', 1600, 300, 6), part('tall', 600, 2400)]
    const r = nest(job(parts, { grain: true }))
    expect(r.valid).toBe(true)
    for (const s of r.sheets) for (const p of s.placements) expect(p.rotated).toBe(false)
    // 2400 across a 2050 usable width cannot be cut on a grained board.
    expect(r.unplaced).toEqual([{ key: 'tall', instance: 1, reason: 'too-large' }])
  })

  it('rotates on plain boards when it helps', () => {
    const r = nest(job([part('tall', 600, 2400)], { grain: false }))
    expect(r.valid).toBe(true)
    expect(r.unplaced).toEqual([])
    expect(r.sheets[0].placements[0]).toMatchObject({ rotated: true, length: 2400, width: 600 })
    // Six 1200×400 on MDF (usable 2420×1200): unrotated only 4 fit; rotated, 6×400 + 5×4 = 2420 exactly.
    const m = nest(job([part('p', 1200, 400, 6)], { sheet: { ...MDF, count: null } }))
    expect(m.valid).toBe(true)
    expect(m.stats.sheetsUsed).toBe(1)
    expect(m.sheets[0].placements.every(p => p.rotated)).toBe(true)
    expect(nest(job([part('p', 1200, 400, 6)], { grain: true, sheet: { ...MDF, count: null } })).stats.sheetsUsed).toBe(2)
  })

  it('respects the sheet count and reports unplaced parts with a reason', () => {
    const r = nest(job([part('big', 2000, 1500, 3)], { sheet: { ...PAL, count: 2 } }))
    expect(r.valid).toBe(true)
    expect(r.stats.sheetsUsed).toBe(2)
    expect(r.unplaced).toEqual([{ key: 'big', instance: 3, reason: 'no-sheet-left' }])
    const none = nest(job([part('a', 100, 100)], { sheet: { ...PAL, count: 0 } }))
    expect(none.valid).toBe(true)
    expect(none.unplaced[0].reason).toBe('no-sheet-left')
  })

  it('is deterministic for the same seed', () => {
    const parts = Array.from({ length: 12 }, (_, i) => part(`p${i}`, 200 + i * 97 % 900, 150 + i * 61 % 500, 1 + i % 3))
    const a = nest(job(parts), { seed: 7, maxMs: 1e9 })
    const b = nest(job(parts), { seed: 7, maxMs: 1e9 })
    expect(b.sheets).toEqual(a.sheets)
    expect(b.unplaced).toEqual(a.unplaced)
    expect(b.stats).toEqual(a.stats)
    expect(b.search.attempts).toBe(a.search.attempts)
  })

  it('conserves area exactly on every sheet', () => {
    const r = nest(job([part('a', 700, 560, 7), part('b', 1200, 380, 5), part('c', 450, 450, 9)]))
    expect(r.valid).toBe(true)
    const s = r.stats
    expect(s.sheetArea).toBe(s.sheetsUsed * PAL.length * PAL.width)
    expect(s.sheetArea).toBe(s.partArea + s.trimArea + s.kerfArea + s.wasteArea)
    expect(s.partArea).toBe(700 * 560 * 7 + 1200 * 380 * 5 + 450 * 450 * 9)
    expect(s.trimArea).toBe(s.sheetsUsed * (PAL.length * PAL.width - 2780 * 2050))
  })

  it('marks invalid jobs as invalid without throwing', () => {
    const r = nest(job([part('a', 100.5, 100)]))
    expect(r.valid).toBe(false)
    expect(r.errors.length).toBeGreaterThan(0)
    expect(r.unplaced[0].reason).toBe('invalid-job')
  })

  it('builds one job per material from cut-list rows', () => {
    const row = (materialId: string, panelIds: string[], labels: string[], length: number, width: number): CutRow => ({
      materialId, materialName: materialId.toUpperCase(), thickness: 18, length, width, quantity: panelIds.length,
      edgesL: 0, edgesW: 0, grain: materialId === 'pal', drilling: '', labels, panelIds,
    })
    const rows = [row('pal', ['s1', 's2'], ['Side L', 'Side R'], 720, 560), row('mdf', ['f1'], ['Front'], 700, 400), row('pal', ['t'], ['Top'], 800, 560), row('hdf', ['b'], ['Back'], 700, 700)]
    const settings = new Map([
      ['pal', { sheet: { ...PAL, count: null }, trim: TRIM, kerf: KERF }],
      ['mdf', { sheet: { ...MDF, count: 2 }, trim: TRIM, kerf: KERF }],
    ])
    const jobs = jobsFromCutlist(rows, settings)
    expect(jobs.map(j => j.materialId)).toEqual(['pal', 'mdf'])
    expect(jobs[0].grain).toBe(true)
    expect(jobs[0].parts).toEqual([
      { key: 's1', label: 'Side L, Side R', length: 720, width: 560, quantity: 2 },
      { key: 't', label: 'Top', length: 800, width: 560, quantity: 1 },
    ])
    expect(jobs.every(j => nest(j).valid)).toBe(true)
  })
})

// ---------- seeded fuzz ----------
let seed = Number(process.env.SEED ?? 20261021)
const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff }
const ri = (a: number, b: number) => a + Math.floor(rnd() * (b - a + 1))

function randomJob(n: number): NestJob {
  const stock = rnd() < 0.4 ? PAL : rnd() < 0.6 ? MDF : { length: ri(300, 3000), width: ri(200, 2100) }
  const trim = rnd() < 0.7 ? TRIM : ri(0, 20)
  const kerf = rnd() < 0.7 ? KERF : ri(0, 8)
  const ul = stock.length - 2 * trim, uw = stock.width - 2 * trim
  const parts = Array.from({ length: ri(1, 14) }, (_, i) => {
    const small = rnd() < 0.6
    const l = small ? ri(30, Math.max(30, Math.floor(ul / 2))) : ri(30, ul + 20)
    const w = small ? ri(30, Math.max(30, Math.floor(uw / 2))) : ri(30, uw + 20)
    return part(`j${n}p${i}`, l, w, ri(rnd() < 0.05 ? 0 : 1, 6))
  })
  return {
    materialId: `m${n}`, materialName: 'Fuzz', thickness: 18, grain: rnd() < 0.5,
    sheet: { ...stock, count: rnd() < 0.5 ? null : ri(1, 4) }, trim, kerf, parts,
  }
}

const allInts = (t: CutTree): boolean =>
  t.kind === 'cut' ? Number.isSafeInteger(t.at) && allInts(t.first) && allInts(t.second) : Number.isSafeInteger(t.length) && Number.isSafeInteger(t.width)

it('fuzz: every layout passes the independent validator; mutations are caught', () => {
  const N = Number(process.env.FUZZ_N ?? 500)
  let placed = 0, mutated = 0
  for (let n = 0; n < N; n++) {
    const j = randomJob(n)
    const r: NestResult = nest(j, { seed: n, maxAttempts: 8, maxMs: 1e9 })
    const ctx = `job ${n}: ${JSON.stringify(j)}`
    expect(r.errors, ctx).toEqual([])
    expect(r.valid, ctx).toBe(true)
    expect(validateNest(j, r), ctx).toEqual([])
    for (const s of r.sheets) {
      expect(allInts(s.tree), ctx).toBe(true)
      for (const p of s.placements) {
        expect([p.x, p.y, p.length, p.width].every(Number.isSafeInteger), ctx).toBe(true)
        if (j.grain) expect(p.rotated, ctx).toBe(false)
        placed++
      }
    }
    const withParts = r.sheets.filter(s => s.placements.length)
    if (!withParts.length) continue
    const s = ri(0, withParts.length - 1), si = withParts[s].index
    const k = ri(0, withParts[s].placements.length - 1)
    const shifted = clone(r)
    const p = shifted.sheets[si].placements[k]
    if (rnd() < 0.5) p.x += rnd() < 0.5 ? 1 : -1
    else p.y += rnd() < 0.5 ? 1 : -1
    expect(validateNest(j, shifted).length, `${ctx} shift`).toBeGreaterThan(0)
    const dropped = clone(r)
    dropped.sheets[si].placements.splice(k, 1)
    expect(validateNest(j, dropped).length, `${ctx} drop`).toBeGreaterThan(0)
    mutated += 2
  }
  expect(placed).toBeGreaterThan(N)
  expect(mutated).toBeGreaterThan(N)
}, 600_000)
