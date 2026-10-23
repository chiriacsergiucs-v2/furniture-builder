/**
 * Suggested combinations (ADR-0045). Candidates come from the axes a type declares for a step, are built with
 * buildModel() and kept only without errors; the type default comes first, then the most different ones.
 */
import type { FurnitureModel, Design } from '../types'
import { check, resolve, stepsWriting, typeOf, visibleSteps } from './engine'
import { stepById } from './steps'
import type { Answers, Generator as Family } from './types'

export const SUGGEST_CAP = 64
export const CARDS_FIRST = 6

export interface Suggestion {
  /** Stable within one result: the candidate's axis picks. */
  key: string
  label: string
  answers: Answers
  /** Index of the value picked on each axis. */
  picks: number[]
  design: Design
  model: FurnitureModel
  warnings: number
  isDefault: boolean
}

export const generatorAt = (a: Answers, stepId: string): Family | undefined => typeOf(a)?.generators.find(g => g.at === stepId)

const gcd = (x: number, y: number): number => (y ? gcd(y, x % y) : x)

/**
 * Axis picks to evaluate, lazily: the default first, then every combination when there are few, else `cap` indices
 * visited with a stride coprime with the total so the sample spreads over every axis.
 */
export function* candidatePicks(sizes: number[], first: number[], cap: number): Generator<number[]> {
  const total = sizes.reduce((n, s) => n * s, 1)
  const encode = (p: number[]) => p.reduce((n, v, k) => n * sizes[k] + v, 0)
  const decode = (i: number) => { const p: number[] = []; for (let k = sizes.length - 1; k >= 0; k--) { p[k] = i % sizes[k]; i = Math.floor(i / sizes[k]) } return p }
  const start = encode(first)
  yield first
  let stride = 1
  if (total > cap) { stride = Math.max(1, Math.round(total * 0.618)); while (gcd(stride, total) !== 1) stride++ }
  for (let i = 1, n = 1; i < total && n < cap; i++, n++) yield decode((start + i * stride) % total)
}

/** Product without ids: two candidates that build the same thing are one card. */
const signature = (d: Design) => JSON.stringify(d.product.params, (k, v) => (k === 'id' ? undefined : v))

const distance = (x: number[], y: number[]) => x.reduce((n, v, k) => n + (v === y[k] ? 0 : 1), 0)

/** Default first, then repeatedly the candidate farthest (least Hamming distance) from the chosen ones; ties by order. */
export function rankByVariety<T extends { picks: number[] }>(list: T[]): T[] {
  if (!list.length) return []
  const chosen = [list[0]]
  const rest = list.slice(1)
  const best = rest.map(c => distance(c.picks, list[0].picks))
  while (rest.length) {
    let k = 0
    for (let i = 1; i < rest.length; i++) if (best[i] > best[k]) k = i
    const [c] = rest.splice(k, 1); best.splice(k, 1)
    chosen.push(c)
    rest.forEach((r, i) => { best[i] = Math.min(best[i], distance(r.picks, c.picks)) })
  }
  return chosen
}

const memo = new Map<string, Suggestion[]>()
const MEMO_SIZE = 32

/** Every valid suggestion for a step, ranked. Memoised by (type, step, answers). */
export function suggestions(a: Answers, stepId: string, cap = SUGGEST_CAP): Suggestion[] {
  const gen = generatorAt(a, stepId)
  if (!gen) return []
  const base = resolve(a)
  const key = JSON.stringify([stepId, cap, base])
  const hit = memo.get(key)
  if (hit) return hit

  const sizes = gen.axes.map(ax => ax.values.length)
  const typeDefaults = resolve({ type: a.type })
  const first = gen.axes.map(ax => Math.max(0, ax.values.indexOf(ax.current(typeDefaults))))
  const covered = stepsWriting(base, gen.axes.flatMap(ax => ax.writes))
  const seen = new Set<string>()
  const found: Suggestion[] = []
  let isFirst = true
  for (const p of candidatePicks(sizes, first, cap)) {
    const answers = gen.axes.reduce((acc, ax, k) => ax.apply(acc, ax.values[p[k]]), base)
    const c = check(answers)
    const wasFirst = isFirst; isFirst = false
    if (!c.design || !c.model || c.errors) continue
    const sig = signature(c.design)
    if (seen.has(sig)) continue
    seen.add(sig)
    const r = resolve(answers)
    const label = visibleSteps(answers).filter(s => covered.includes(s.id)).map(s => stepById.get(s.id)?.summary?.(r) ?? '').filter(Boolean).join(' · ')
    found.push({ key: p.join('.'), label, answers, picks: p, design: c.design, model: c.model, warnings: c.warnings, isDefault: wasFirst })
  }
  const ranked = rankByVariety(found)
  memo.set(key, ranked)
  if (memo.size > MEMO_SIZE) memo.delete(memo.keys().next().value as string)
  return ranked
}
