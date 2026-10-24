/**
 * New-piece wizard (ADR-044): answers, steps and construction types are plain data. The engine and the UI read
 * these shapes only; nothing in them knows a particular type.
 */
import type { Design } from '../types'

/** What one compartment holds. `shelves` / `drawers` are used by the kinds that have them. */
export interface Compartment { kind: string; shelves: number; drawers: number }

export type AnswerValue = string | number | Compartment[] | string[] | number[]
export type Answers = Record<string, AnswerValue | undefined>

export interface Option { value: string; label: string; help?: string }

export type FieldKind =
  /** Free text (name). */
  | 'text'
  /** Whole number; `unit: 'mm'` for sizes. */
  | 'int'
  /** One of `options`. */
  | 'choice'
  /** One `Compartment` per compartment; `options` are the content kinds. */
  | 'compartments'
  /** One choice per compartment from `options`. */
  | 'perCompartment'
  /** One whole-mm size per compartment; 0 = share the rest. */
  | 'perCompartmentMm'

export interface FieldDef {
  /** Answer key. */
  id: string
  label: string
  kind: FieldKind
  unit?: 'mm'
  min?: number
  max?: number
  /** Used when the type's defaults do not give one. */
  default?: AnswerValue
  help?: string
  options?: Option[]
  /** List fields: how many entries (compartments). */
  count?: (a: Answers) => number
  visible?: (a: Answers) => boolean
}

export interface StepDef {
  id: string
  title: string
  help?: string
  fields: FieldDef[]
  visible?: (a: Answers) => boolean
  /** Writes this step's answers into model input. */
  apply?: (a: Answers, d: Design) => Design
  /** Short text for cards and Review ('' = nothing to say). */
  summary?: (a: Answers) => string
}

export type AxisValue = string | number

/** One dimension of a suggestion family (ADR-045). */
export interface Axis {
  id: string
  values: AxisValue[]
  /** Answer keys this axis sets; they must belong to the generator's step or a later one. */
  writes: string[]
  apply: (a: Answers, v: AxisValue) => Answers
  /** The value the answers already hold (used to find the type's default candidate). */
  current: (a: Answers) => AxisValue
}

export interface Generator { id: string; /** Step the cards appear on; they cover it and the steps after it. */ at: string; axes: Axis[] }

export interface ConstructionType {
  id: string
  label: string
  description: string
  /** Step ids in order, after Basics and Type; Review is always last. */
  steps: string[]
  defaults: Answers
  /** Per field: allowed option values (subset of the field's options). */
  options?: Record<string, string[]>
  /** Fields of shared steps this type does not ask (for example a bed takes its width and depth from the mattress). */
  hide?: string[]
  /** Per field: different label text. */
  labels?: Record<string, string>
  /** Per field: tighter min/max. */
  limits?: Record<string, { min?: number; max?: number }>
  /** Starting design on an existing product root; steps then write their answers into it. */
  seed: (a: Answers) => Design
  generators: Generator[]
}
