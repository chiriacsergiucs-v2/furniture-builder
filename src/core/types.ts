/**
 * Core domain types. Pure data: no React, no storage, no three.js.
 *
 * Coordinate system (millimetres, integers):
 *   x → width, left to right
 *   y → height, floor (0) upwards
 *   z → depth, back (0) towards the viewer/front
 */

/** Integer millimetres. Enforced at runtime by `assertMm` / design validation. */
export type Mm = number

export type Axis = 'x' | 'y' | 'z'

/** Axis-aligned box: minimum corner + size. Every panel is one of these. */
export interface Box { x: Mm; y: Mm; z: Mm; w: Mm; h: Mm; d: Mm }

export interface Material {
  id: string
  name: string
  thickness: Mm
  /** Decor/grain direction matters: cutlist length follows the panel's grain axis. */
  grain: boolean
  /** Display colour for the 3D view (CSS hex). */
  color: string
  /** Stock sheet bought for this board (ADR-0019). Absent in version-1 files; defaults fill it in. */
  sheet?: StockSheet
}

/** A full factory sheet. Length runs along the grain, matching cut-list length (ADR-0009). */
export interface StockSheet {
  length: Mm
  width: Mm
  /** Unusable margin trimmed off each edge before cutting parts. */
  trim: Mm
  /** Sheets available; null = buy as many as needed. */
  count: number | null
}

export type PanelRole =
  | 'side' | 'top' | 'bottom' | 'back' | 'plinth' | 'divider' | 'shelf'
  | 'door' | 'drawer-front' | 'drawer-side' | 'drawer-back' | 'drawer-inner-front' | 'drawer-bottom'
  | 'worktop' | 'gable' | 'modesty'

/** A face direction, used to name banded edges of a panel in world terms. */
export type Face = '-x' | '+x' | '-y' | '+y' | '-z' | '+z'

/**
 * One physical sheet part. `box` is the finished size and position.
 * The 3D view and the cutlist are both projections of this record.
 */
export interface Panel {
  /** Stable across resizes: `${nodeId}/${role}[/${index}]`. */
  id: string
  /** Design node that generated this panel; used for selection. */
  nodeId: string
  role: PanelRole
  label: string
  materialId: string
  box: Box
  thicknessAxis: Axis
  /** In-plane axis the decor grain runs along (ignored when the material has no grain). */
  grainAxis: Axis
  /** Edges that receive edge banding, named by the outward face they sit on. */
  banded: Face[]
  /** 32 mm-system shelf-pin hole rows (annotation for the panel shop, ADR-0023). */
  pinRows?: PinRows[]
  /** Handle holes on a front, measured from the front's left and bottom edges (ADR-0024). */
  handleHoles?: { at: [Mm, Mm][]; diameter: Mm }
}

/** Hole rows on one face of a panel. Positions are measured on the panel itself, in mm. */
export interface PinRows {
  face: Face
  /** Row positions across the panel depth, measured from the panel's rear edge. */
  rows: Mm[]
  /** Hole centres along the panel height, measured from the panel's bottom edge. */
  holes: Mm[]
  diameter: Mm
}

export type HardwareKind = 'drawer-runner-pair' | 'hinge' | 'clothes-rail' | 'rail-support' | 'shelf-pin' | 'handle' | 'push-latch'

export interface HardwareItem {
  nodeId: string
  kind: HardwareKind
  label: string
  quantity: number
  /** Nominal size in mm where meaningful (runner length, rail length). */
  sizeMm?: Mm
  note?: string
}

export type Severity = 'error' | 'warning'

export interface Diagnostic {
  severity: Severity
  code: string
  message: string
  nodeId?: string
  panelIds?: string[]
}

/** The clear interior of an editable space, for selection and labelling. */
export interface SpaceOpening {
  nodeId: string
  kind: SpaceKind
  box: Box
  /** Depth in the space tree (root = 0). */
  depth: number
  leaf: boolean
  hasDoors: boolean
}

/** Output of building a design: the single normalised model. */
export interface FurnitureModel {
  panels: Panel[]
  spaces: SpaceOpening[]
  hardware: HardwareItem[]
  diagnostics: Diagnostic[]
  /** Overall bounding box including fronts. */
  bounds: Box
}

// ---------------------------------------------------------------------------
// Design document (what the user edits and what gets saved)
// ---------------------------------------------------------------------------

/** Size of one part of a split: fixed millimetres or a share of the remainder. */
export type SplitSize = { mode: 'mm'; value: Mm } | { mode: 'fr'; value: number }

export interface DoorsFront {
  kind: 'doors'
  count: 1 | 2
  /** Hinge side of a single door (default left, so it opens from the right). */
  hinge?: 'left' | 'right'
}

/** Handle on every front of a space (ADR-0024). Push-to-open has no holes; it schedules a push latch. */
export interface Handle {
  kind: 'bar' | 'knob' | 'push'
  /** Hole centres of a bar handle (default 128). */
  holeSpacing?: Mm
  position?: 'top' | 'centre' | 'bottom'
}

export type FrontStyle = 'overlay' | 'half' | 'inset'

interface SpaceBase {
  id: string
  /** Optional doors covering this whole space. Doors over drawers make them internal drawers. */
  front?: DoorsFront | null
  /** Handle on this space's doors, or on its drawer fronts. */
  handle?: Handle | null
}

export interface EmptySpace extends SpaceBase { kind: 'empty' }
export interface ShelvesSpace extends SpaceBase {
  kind: 'shelves'
  count: number
  /** Loose shelves on pins: shortened by the shelf clearance; the neighbouring panels get pin rows (ADR-0023). */
  adjustable?: boolean
}
export interface HangingSpace extends SpaceBase { kind: 'hanging'; /** Rail distance below the top of the space. */ railDrop: Mm }
export interface DrawersSpace extends SpaceBase {
  kind: 'drawers'
  count: number
  /**
   * Optional heights, top→bottom, one per drawer (ADR-0023). They size the drawer fronts (or the opening, for
   * internal drawers); fixed mm or shares of the rest, like splits. Absent = equal.
   */
  heights?: SplitSize[]
}
export interface SplitSpace extends SpaceBase {
  kind: 'split'
  /** 'x' = vertical dividers, children left→right. 'y' = horizontal dividers, children top→bottom. */
  axis: 'x' | 'y'
  sizes: SplitSize[]
  children: Space[]
}

export type Space = EmptySpace | ShelvesSpace | HangingSpace | DrawersSpace | SplitSpace
export type SpaceKind = Space['kind']

export interface DrawerSettings {
  /** Runner clearance per side between drawer box and opening (side-mount runners). */
  sideClearance: Mm
  /** Opening height minus drawer box height. */
  verticalClearance: Mm
  /** Space left behind the runner. */
  rearClearance: Mm
  /** Available runner lengths, ascending. */
  runnerLengths: Mm[]
  boxMaterialId: string
  bottomMaterialId: string
}

export interface CabinetParams {
  width: Mm
  height: Mm
  depth: Mm
  bodyMaterialId: string
  frontMaterialId: string
  backMaterialId: string
  top: 'over' | 'between'
  back: 'none' | 'applied' | 'inset'
  /** Distance of an inset back from the rear edge of the carcass. */
  backInset: Mm
  plinthHeight: Mm
  plinthSetback: Mm
  /** Gap between adjacent fronts; outer reveal is half of it (overlay) or the full gap (inset). */
  frontGap: Mm
  /** How fronts meet the carcass (ADR-0024). Absent = overlay. */
  frontStyle?: FrontStyle
  shelfSetback: Mm
  /** Adjustable shelves are this much shorter on each side (default 1). */
  shelfClearance?: Mm
  /** Pin-row distance from the front and rear edges (default 37). */
  pinRowSetback?: Mm
  drawers: DrawerSettings
  interior: Space
}

export type DeskSupport = 'gables' | 'pedestal-left' | 'pedestal-right' | 'two-pedestals'

export interface DeskParams {
  width: Mm
  depth: Mm
  height: Mm
  topMaterialId: string
  bodyMaterialId: string
  frontOverhang: Mm
  support: DeskSupport
  /**
   * Drawer units. `left` / `right` hold each unit's own space tree (ADR-0026). When absent (older designs) a
   * unit is `drawerCount` equal drawers, derived in memory with a stable id.
   */
  pedestal: { width: Mm; drawerCount: number; left?: Space; right?: Space }
  modesty: { enabled: boolean; height: Mm; setback: Mm }
  drawers: DrawerSettings
  frontMaterialId: string
  frontGap: Mm
}

export type Product =
  | { kind: 'cabinet'; id: string; params: CabinetParams }
  | { kind: 'desk'; id: string; params: DeskParams }

export interface Design {
  /** 2 adds stock sheets and cutting settings (ADR-0019); version-1 files are upgraded in memory on load. */
  schemaVersion: 1 | 2
  id: string
  name: string
  createdAt: string
  updatedAt: string
  materials: Material[]
  product: Product
  /** Saw settings for sheet layouts. */
  cutting?: { kerf: Mm }
}
