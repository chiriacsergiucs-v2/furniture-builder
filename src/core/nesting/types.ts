/**
 * Sheet nesting types (ADR-018). Independent of `Material`: a job is built from the cut list (ADR-009) plus
 * per-material stock settings (ADR-019). Every value is an integer number of millimetres (ADR-003).
 *
 * Sheet coordinates: origin at a sheet corner, **x along the sheet length** (the grain direction for grained
 * boards), **y along the sheet width**. Trim margins lie outside `usable`.
 */

export interface NestPart {
  /** Stable identity, e.g. the first panel id of a cut-list row. */
  key: string
  label: string
  /** Along the grain for grained boards (cut-list length). */
  length: number
  width: number
  quantity: number
}

export interface NestJob {
  materialId: string
  materialName: string
  thickness: number
  /** Grained boards never rotate parts: part length stays along sheet length. */
  grain: boolean
  /** `count: null` = unlimited sheets. */
  sheet: { length: number; width: number; count: number | null }
  /** Unusable margin on each of the four edges. */
  trim: number
  /** Width of the material stripe destroyed by every cut. */
  kerf: number
  parts: NestPart[]
}

export interface NestOptions {
  seed?: number
  maxMs?: number
  maxAttempts?: number
}

/** Axis-aligned rectangle on a sheet: `length` along x, `width` along y. */
export interface Rect {
  x: number
  y: number
  length: number
  width: number
}

/**
 * `across-length`: the cut line runs across the sheet length, at constant x = `at`.
 * `along-length`: the cut line runs along the sheet length, at constant y = `at`.
 */
export type CutOrientation = 'along-length' | 'across-length'

/**
 * Guillotine cut tree. Leaves carry their own size; node positions are implied by the cuts:
 * a cut at `at` (absolute sheet coordinate) splits its rectangle into `first` = [start, at),
 * a kerf stripe [at, at + kerf) and `second` = [at + kerf, end). `second` may have zero extent when the
 * residual equals the kerf exactly.
 */
export type CutTree =
  | { kind: 'part'; key: string; instance: number; length: number; width: number; rotated: boolean }
  | { kind: 'waste'; length: number; width: number }
  | { kind: 'cut'; orientation: CutOrientation; at: number; kerf: number; first: CutTree; second: CutTree }

export interface Placement {
  key: string
  /** 1..quantity of the part. */
  instance: number
  x: number
  y: number
  /** Extent along x (sheet length). */
  length: number
  /** Extent along y (sheet width). */
  width: number
  /** True when the part's length lies along the sheet width. Always false for grained jobs. */
  rotated: boolean
}

export interface SheetLayout {
  index: number
  length: number
  width: number
  usable: Rect
  /** Tree covering exactly `usable`. */
  tree: CutTree
  placements: Placement[]
}

export type UnplacedReason = 'too-large' | 'no-sheet-left' | 'invalid-job'

export interface Unplaced {
  key: string
  instance: number
  reason: UnplacedReason
}

export interface NestStats {
  sheetsUsed: number
  partArea: number
  sheetArea: number
  trimArea: number
  kerfArea: number
  wasteArea: number
  /** Area of the largest single waste rectangle (mm²). */
  largestLeftover: number
  /** partArea / sheetArea, 0 when no sheet is used. */
  utilisation: number
  cuts: number
}

export interface NestResult {
  materialId: string
  sheets: SheetLayout[]
  unplaced: Unplaced[]
  stats: NestStats
  search: { attempts: number; elapsedMs: number; seed: number }
  /** Set from `validateNest`; a layout with errors is never shown or exported. */
  valid: boolean
  errors: string[]
}
