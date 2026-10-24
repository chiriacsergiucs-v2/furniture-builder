/**
 * Suggestion axes (ADR-045): each is one dimension of a family of combinations. Types list the axes (and the values)
 * they want on each step; the engine builds the combinations. A new family is a new list of these.
 */
import { compartmentCount, compartmentsOf, contentUses, listOf, str } from './steps'
import type { Answers, Axis, AxisValue, Compartment } from './types'

/** An axis that sets one answer to one of its values. */
export const answerAxis = (key: string, values: AxisValue[], also: string[] = []): Axis => ({
  id: key, values, writes: [key, ...also],
  apply: (a, v) => ({ ...a, [key]: v }),
  current: a => (a[key] as AxisValue) ?? values[0],
})

const setCompartments = (a: Answers, fn: (c: Compartment, i: number, n: number) => Compartment): Answers => {
  const cs = compartmentsOf(a)
  return { ...a, compartments: cs.map((c, i) => fn(c, i, cs.length)) }
}

/** Vertical dividers; resizes the per-compartment lists and returns to equal widths. */
export const dividersAxis = (values: number[]): Axis => ({
  id: 'dividers', values, writes: ['dividers', 'spacing', 'widths', 'compartments', 'frontsPer'],
  apply: (a, v) => {
    const b: Answers = { ...a, dividers: v, spacing: 'equal', widths: [] }
    return { ...b, compartments: compartmentsOf(a, compartmentCount(b)), frontsPer: listOf<string>(a, 'frontsPer', 'none', compartmentCount(b)) }
  },
  current: a => compartmentCount(a) - 1,
})

/**
 * What the compartments hold, as a pattern: every compartment the same kind, or `<kind>-left` (that kind in the left
 * compartment, shelves elsewhere: `drawers-left`, `hanging-left`). Counts stay as they are; the shelves and drawers
 * axes set them.
 */
export const mixAxis = (values: string[]): Axis => ({
  id: 'mix', values, writes: ['compartments'],
  apply: (a, v) => {
    const left = String(v).endsWith('-left') ? String(v).slice(0, -5) : null
    return setCompartments(a, (c, i) => ({ ...c, kind: left ? (i === 0 ? left : 'shelves') : String(v) }))
  },
  current: a => {
    const cs = compartmentsOf(a)
    if (cs.length > 1 && cs[0].kind !== 'shelves' && cs.slice(1).every(c => c.kind === 'shelves')) return `${cs[0].kind}-left`
    return cs[0].kind
  },
})

/** Shelves in every compartment that has shelves. */
export const shelvesAxis = (values: number[]): Axis => ({
  id: 'shelves', values, writes: ['compartments'],
  apply: (a, v) => setCompartments(a, c => (contentUses(c.kind).includes('shelves') ? { ...c, shelves: Number(v) } : c)),
  current: a => compartmentsOf(a).find(c => contentUses(c.kind).includes('shelves'))?.shelves ?? values[0],
})

/** Drawers in every compartment that has drawers. */
export const drawersAxis = (values: number[]): Axis => ({
  id: 'drawers', values, writes: ['compartments'],
  apply: (a, v) => setCompartments(a, c => (contentUses(c.kind).includes('drawers') ? { ...c, drawers: Number(v) } : c)),
  current: a => compartmentsOf(a).find(c => contentUses(c.kind).includes('drawers'))?.drawers ?? values[0],
})

/** Doors. `per` puts one door on each compartment without drawers (drawers keep their own fronts). */
export const frontsAxis = (values: string[]): Axis => ({
  id: 'fronts', values, writes: ['fronts', 'frontsPer'],
  apply: (a, v) => ({ ...a, fronts: v, frontsPer: v === 'per' ? compartmentsOf(a).map(c => (contentUses(c.kind).includes('drawers') ? 'none' : 'single')) : listOf<string>(a, 'frontsPer', 'none') }),
  current: a => str(a, 'fronts', 'none'),
})
