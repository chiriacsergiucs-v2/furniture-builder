/**
 * Core domain types. Pure data: no React, no storage, no three.js.
 *
 * Coordinate system (millimetres, integers):
 *   x → width, left to right
 *   y → height, floor (0) upwards
 *   z → depth, back (0) towards the viewer/front
 */

/** Integer millimetres. Enforced at runtime by `assertMm` / design validation. */
export type Mm = number;

export type Axis = 'x' | 'y' | 'z';

/** Axis-aligned box: minimum corner + size. Every panel is one of these. */
export interface Box {
  x: Mm;
  y: Mm;
  z: Mm;
  w: Mm;
  h: Mm;
  d: Mm;
}

export interface Material {
  id: string;
  name: string;
  thickness: Mm;
  /** Decor/grain direction matters: cutlist length follows the panel's grain axis. */
  grain: boolean;
  /** Display colour for the 3D view (CSS hex). */
  color: string;
  /** Stock sheet bought for this board (ADR-019). Absent in version-1 files; defaults fill it in. */
  sheet?: StockSheet;
  /** 'solid': timber bought in lengths, listed by length instead of nested on sheets (ADR-038). Absent = sheet. */
  stock?: 'sheet' | 'solid';
  /** Solid stock: lengths you can buy, ascending (default 2400, 3000). */
  lengths?: Mm[];
  /** A picture from the user's device shown on the board's faces instead of the plain colour (ADR-048). */
  image?: MaterialImage;
  /** Labels (ADR-049): shown next to the name only; never used to fill in specs. */
  maker?: MaterialMaker;
  kind?: MaterialKind;
  /** Taken from a decor list the user imported (ADR-049): the list's code and file name, for tracing. */
  decor?: { code: string; list: string };
  /** How the board's surface looks in the 3D view and renders (ADR-067); display only. Absent = matte. */
  finish?: BoardFinish;
  /** The edge band on this board's banded edges, as the user names it from the supplier's datasheet (ADR-077). */
  band?: EdgeBand;
  /** A different band for doors and drawer fronts made of this board (ADR-077); absent = they use `band`. */
  frontBand?: EdgeBand;
}

export type EdgeBandKind = 'abs' | 'pvc' | 'pp' | 'melamine' | 'veneer' | 'other';

/**
 * ADR-077. An edge band spec, entered by the user (no standard fixes these values, ADR-010). Whole numbers:
 * `thickness` in tenths of a millimetre (0.4 mm = 4), `width` in mm.
 */
export interface EdgeBand {
  kind: EdgeBandKind;
  thickness: number;
  width: Mm;
  /** The supplier's decor or article code. */
  code?: string;
  /** Extra length per banded edge for trimming on the edgebander, counted in the metres to buy. Absent = 0. */
  allowance?: Mm;
}

export type BoardFinish = 'matte' | 'satin' | 'gloss';
export type MaterialMaker = 'egger' | 'kastamonu' | 'fundermax' | 'kronospan' | 'other';
export type MaterialKind = 'pal' | 'mdf' | 'worktop' | 'other';

/**
 * ADR-048. The picture itself lives in this device's `images` table under `id`; the design keeps only the reference.
 * One copy of the picture covers `tileLength` × `tileWidth` mm of board and repeats; its width runs along the part's
 * grain axis, or across it when `turn` is set.
 */
export interface MaterialImage {
  id: string;
  /** File name as picked, for display. */
  name: string;
  tileLength: Mm;
  tileWidth: Mm;
  turn?: boolean;
}

/** A full factory sheet. Length runs along the grain, matching cut-list length (ADR-009). */
export interface StockSheet {
  length: Mm;
  width: Mm;
  /** Unusable margin trimmed off each edge before cutting parts. */
  trim: Mm;
  /** Sheets available; null = buy as many as needed. */
  count: number | null;
}

export type PanelRole =
  | 'side'
  | 'top'
  | 'bottom'
  | 'back'
  | 'plinth'
  | 'divider'
  | 'shelf'
  | 'door'
  | 'drawer-front'
  | 'drawer-side'
  | 'drawer-back'
  | 'drawer-inner-front'
  | 'drawer-bottom'
  | 'worktop'
  | 'gable'
  | 'modesty'
  | 'blind-panel'
  /** Panel set parts (ADR-041). */
  | 'loose'
  /** Top rails instead of a full top (ADR-036); frame parts (ADR-038). */
  | 'rail'
  | 'leg'
  | 'apron'
  | 'stretcher'
  | 'slat'
  | 'ledger'
  | 'seat'
  | 'headboard'
  | 'footboard'
  | 'stile'
  | 'rung'
  /** Run parts in a project (ADR-036). */
  | 'filler'
  | 'cover-panel'
  /** Crown, pelmet and ceiling filler along a run (ADR-075). */
  | 'trim';

/** A face direction, used to name banded edges of a panel in world terms. */
export type Face = '-x' | '+x' | '-y' | '+y' | '-z' | '+z';

/**
 * One physical sheet part. `box` is the finished size and position.
 * The 3D view and the cutlist are both projections of this record.
 */
export interface Panel {
  /** Stable across resizes: `${nodeId}/${role}[/${index}]`. */
  id: string;
  /** Design node that generated this panel; used for selection. */
  nodeId: string;
  role: PanelRole;
  label: string;
  materialId: string;
  box: Box;
  thicknessAxis: Axis;
  /** In-plane axis the decor grain runs along (ignored when the material has no grain). */
  grainAxis: Axis;
  /** Edges that receive edge banding, named by the outward face they sit on. */
  banded: Face[];
  /** 32 mm-system shelf-pin hole rows (annotation for the panel shop, ADR-023). */
  pinRows?: PinRows[];
  /** Handle holes on a front, measured from the front's left and bottom edges (ADR-024). */
  handleHoles?: { at: [Mm, Mm][]; diameter: Mm };
  /** Shaped part (ADR-040): `box` stays the whole-mm cut blank; absent = a plain box. */
  shape?: PanelShape;
}

/**
 * ADR-040. `tilt`: the blank turned by whole degrees (right-hand rule) about an axis through `pivot`, measured from
 * the blank's minimum corner; placement only, the cut size is the blank. `profile`: a board cut to a polygon on its
 * face, whole-mm points [u, v] from the blank's minimum corner along its two in-plane axes (x, y, z order).
 */
export type PanelShape =
  | { kind: 'tilt'; axis: Axis; angleDeg: number; pivot: [Mm, Mm, Mm] }
  | { kind: 'profile'; points: [Mm, Mm][] };

/** Hole rows on one face of a panel. Positions are measured on the panel itself, in mm. */
export interface PinRows {
  face: Face;
  /** Row positions across the panel depth, measured from the panel's rear edge. */
  rows: Mm[];
  /** Hole centres along the panel height, measured from the panel's bottom edge. */
  holes: Mm[];
  diameter: Mm;
}

export type HardwareKind =
  | 'drawer-runner-pair'
  | 'hinge'
  | 'clothes-rail'
  | 'rail-support'
  | 'shelf-pin'
  | 'handle'
  | 'push-latch'
  | 'wall-bracket'
  | 'wall-rail'
  | 'corner-hinge'
  /** ADR-035 anti-tip fixing, ADR-036 appliance and front fixing, ADR-037 sliding track and flap stay, ADR-038/039 purchased items. */
  | 'wall-fixing'
  | 'appliance'
  | 'front-fixing'
  | 'sliding-track'
  | 'flap-stay'
  | 'purchased'
  /** ADR-041 amendment: a screwed joint between two placed panels; screw type, length and count are the user's choice. */
  | 'screws';

export interface HardwareItem {
  nodeId: string;
  kind: HardwareKind;
  label: string;
  quantity: number;
  /** Nominal size in mm where meaningful (runner length, rail length). */
  sizeMm?: Mm;
  note?: string;
}

export type Severity = 'error' | 'warning';

export interface Diagnostic {
  severity: Severity;
  code: string;
  message: string;
  nodeId?: string;
  panelIds?: string[];
  /** Project pieces involved (ADR-071): the problem piece is listed last. */
  itemIds?: string[];
  /** Where the problem is, room mm (ADR-071): the overlap, the blocked zone or the piece outside the room. */
  box?: Box;
  /** How much, mm (ADR-071): the overlap, the missing opening space or the distance outside the room. */
  amount?: Mm;
}

/** The clear interior of an editable space, for selection and labelling. */
export interface SpaceOpening {
  nodeId: string;
  kind: SpaceKind;
  box: Box;
  /** Depth in the space tree (root = 0). */
  depth: number;
  /** Spaces of an L-corner's side wing are not drawn in the front view (selected from the inspector instead). */
  view?: 'front' | 'side';
  leaf: boolean;
  hasDoors: boolean;
}

/** Output of building a design: the single normalised model. */
export interface FurnitureModel {
  panels: Panel[];
  spaces: SpaceOpening[];
  hardware: HardwareItem[];
  diagnostics: Diagnostic[];
  /** Overall bounding box including fronts. */
  bounds: Box;
}

// ---------------------------------------------------------------------------
// Design document (what the user edits and what gets saved)
// ---------------------------------------------------------------------------

/** Size of one part of a split: fixed millimetres or a share of the remainder. */
export type SplitSize = { mode: 'mm'; value: Mm } | { mode: 'fr'; value: number };

export interface DoorsFront {
  kind: 'doors';
  count: 1 | 2;
  /** Hinge side of a single door (default left, so it opens from the right). */
  hinge?: 'left' | 'right';
}

/** Sliding doors in two planes in front of the carcass (ADR-037). The track system is the user's choice. */
export interface SlidingFront {
  kind: 'sliding';
  count: 2 | 3 | 4;
  /** How far neighbouring doors overlap (default 30). */
  overlap?: Mm;
  /** Depth the track needs in front of the carcass (default 80). */
  track?: Mm;
}

/** One front hinged at its top (lift-up) or bottom (drop-down) edge (ADR-037). */
export interface FlapFront {
  kind: 'flap';
  count: 1;
  direction: 'up' | 'down';
  /** The lift system or stay the user picked from its datasheet; a warning stays until it is named. */
  fitting?: string;
}

export type Front = DoorsFront | SlidingFront | FlapFront;

/** Handle on every front of a space (ADR-024). Push-to-open has no holes; it schedules a push latch. */
export interface Handle {
  kind: 'bar' | 'knob' | 'push';
  /** Hole centres of a bar handle (default 128). */
  holeSpacing?: Mm;
  position?: 'top' | 'centre' | 'bottom';
}

export type FrontStyle = 'overlay' | 'half' | 'inset';

interface SpaceBase {
  id: string;
  /** Optional doors covering this whole space. Doors over drawers make them internal drawers. */
  front?: Front | null;
  /** Handle on this space's doors, or on its drawer fronts. */
  handle?: Handle | null;
}

/** A niche for a built-in appliance; its size comes from the appliance's installation drawing, never a default (ADR-036). */
export interface ApplianceNiche {
  kind: 'oven' | 'microwave' | 'fridge' | 'dishwasher' | 'hob' | 'other';
  w: Mm;
  h: Mm;
  d: Mm;
}

export interface EmptySpace extends SpaceBase {
  kind: 'empty';
  appliance?: ApplianceNiche;
}
export interface ShelvesSpace extends SpaceBase {
  kind: 'shelves';
  count: number;
  /** Loose shelves on pins: shortened by the shelf clearance; the neighbouring panels get pin rows (ADR-023). */
  adjustable?: boolean;
}
export interface HangingSpace extends SpaceBase {
  kind: 'hanging';
  /** Rail distance below the top of the space. */ railDrop: Mm;
}
export interface DrawersSpace extends SpaceBase {
  kind: 'drawers';
  count: number;
  /**
   * Sink drawer (ADR-040): the top drawer box is cut around the trap, a `width` × `depth` notch at the middle of its
   * back. Its bottom is a profiled board; its back runs around the notch. The front stays whole.
   */
  uCut?: { width: Mm; depth: Mm } | null;
  /** Sink false front (ADR-054): the top drawer is a fixed front only — no box, no runners; fixing user-specified. */
  fixedTop?: boolean;
  /**
   * Optional heights, top→bottom, one per drawer (ADR-023). They size the drawer fronts (or the opening, for
   * internal drawers); fixed mm or shares of the rest, like splits. Absent = equal.
   */
  heights?: SplitSize[];
}
export interface SplitSpace extends SpaceBase {
  kind: 'split';
  /** 'x' = vertical dividers, children left→right. 'y' = horizontal dividers, children top→bottom. */
  axis: 'x' | 'y';
  sizes: SplitSize[];
  children: Space[];
}

export type Space = EmptySpace | ShelvesSpace | HangingSpace | DrawersSpace | SplitSpace;
export type SpaceKind = Space['kind'];

export interface DrawerSettings {
  /** Runner clearance per side between drawer box and opening (side-mount runners). */
  sideClearance: Mm;
  /** Opening height minus drawer box height. */
  verticalClearance: Mm;
  /** Space left behind the runner. */
  rearClearance: Mm;
  /** Available runner lengths, ascending. */
  runnerLengths: Mm[];
  boxMaterialId: string;
  bottomMaterialId: string;
}

export interface CabinetParams {
  width: Mm;
  height: Mm;
  depth: Mm;
  /** Wall cabinets hang on brackets: no plinth, hanging hardware scheduled (ADR-025). Absent = floor. */
  mount?: 'floor' | 'wall';
  /** Height of the cabinet's underside above the floor when wall-mounted (position only). */
  mountHeight?: Mm;
  bodyMaterialId: string;
  frontMaterialId: string;
  backMaterialId: string;
  top: 'over' | 'between';
  /** 'rails': two rails between the sides instead of a full top, e.g. under a worktop or over a sink (ADR-036). */
  topKind?: 'panel' | 'rails';
  /** Depth of each top rail (default 100). */
  railDepth?: Mm;
  /** 'under': the bottom runs the full width and the sides stand on it. 'none': no bottom (over-hood units). Absent = between the sides. */
  bottom?: 'between' | 'under' | 'none';
  back: 'none' | 'applied' | 'inset';
  /** Distance of an inset back from the rear edge of the carcass. */
  backInset: Mm;
  plinthHeight: Mm;
  plinthSetback: Mm;
  /** Gap between adjacent fronts; outer reveal is half of it (overlay) or the full gap (inset). */
  frontGap: Mm;
  /** How fronts meet the carcass (ADR-024). Absent = overlay. */
  frontStyle?: FrontStyle;
  shelfSetback: Mm;
  /** Adjustable shelves are this much shorter on each side (default 1). */
  shelfClearance?: Mm;
  /** Pin-row distance from the front and rear edges (default 37). */
  pinRowSetback?: Mm;
  drawers: DrawerSettings;
  interior: Space;
}

export type DeskSupport = 'gables' | 'pedestal-left' | 'pedestal-right' | 'two-pedestals';

export interface DeskParams {
  width: Mm;
  depth: Mm;
  height: Mm;
  topMaterialId: string;
  bodyMaterialId: string;
  frontOverhang: Mm;
  support: DeskSupport;
  /**
   * Drawer units. `left` / `right` hold each unit's own space tree (ADR-026). When absent (older designs) a
   * unit is `drawerCount` equal drawers, derived in memory with a stable id.
   */
  pedestal: { width: Mm; drawerCount: number; left?: Space; right?: Space };
  modesty: { enabled: boolean; height: Mm; setback: Mm };
  drawers: DrawerSettings;
  frontMaterialId: string;
  frontGap: Mm;
}

/** Corner cabinets (ADR-025): built from two carcasses by the cabinet generator. */
export interface CornerParams {
  /** `diagonal` (ADR-040): a five-sided unit, `width` along both walls, `depth` deep at each return, door(s) at 45°. */
  variant: 'blind' | 'l-shape' | 'diagonal';
  /** Which end the corner is at. */
  side: 'left' | 'right';
  /** Blind: overall width. L-shape: length of the wing along the back wall. */
  width: Mm;
  /** L-shape: length of the wing along the side wall, including the corner. */
  wingWidth: Mm;
  /** Blind: width of the blind section covered by the neighbouring cabinet. */
  blindWidth: Mm;
  height: Mm;
  depth: Mm;
  bodyMaterialId: string;
  frontMaterialId: string;
  backMaterialId: string;
  top: 'over' | 'between';
  back: 'none' | 'applied' | 'inset';
  backInset: Mm;
  plinthHeight: Mm;
  plinthSetback: Mm;
  frontGap: Mm;
  shelfSetback: Mm;
  drawers: DrawerSettings;
  /** Blind: the usable section. L-shape: the back-wall wing. */
  interior: Space;
  /** L-shape: the side-wall wing. */
  wingInterior: Space;
}

/** A front with no carcass: integrated appliance door, cover panel or filler (ADR-036). */
export interface PanelParams {
  purpose: 'dishwasher' | 'fridge' | 'cover' | 'filler';
  width: Mm;
  height: Mm;
  materialId: string;
  handle?: Handle | null;
}

export type FrameKind = 'table' | 'bench' | 'stool' | 'chair' | 'bed';

/**
 * Legs, rails, stretchers, slats and a top or deck (ADR-038). Only vertical and horizontal members; every part is
 * still an axis-aligned box. Solid members use `solidMaterialId`, panels (top, seat, headboard) `panelMaterialId`.
 */
export interface FrameParams {
  kind: FrameKind;
  /** Outside size. Bed: derived from the mattress (width/depth ignored), height = headboard height. */
  width: Mm;
  depth: Mm;
  height: Mm;
  panelMaterialId: string;
  solidMaterialId: string;
  /** Table, bench, stool, chair. */
  top: 'panel' | 'slats';
  /** Leg section across x and z. */
  leg: { w: Mm; d: Mm };
  /** Legs set in from the outside edges of the top. */
  legInset: Mm;
  /** Rails under the top between the legs (height of the rail). 0 = none. */
  apron: { height: Mm; thickness: Mm };
  stretchers: 'none' | 'box' | 'h';
  stretcherHeight: Mm;
  /** Lower shelf (coffee and end tables), its top height above the floor. */
  shelf?: { height: Mm } | null;
  /** Slatted top, seat or bed deck. */
  slats: { width: Mm; thickness: Mm; gap: Mm };
  /**
   * Chair and bench: seat height; the back posts carry on up to `height`. Absent = no back. `angleDeg`: rake of the
   * back from vertical, whole degrees (ADR-040; absent = 0, upright). Above the seat the back leans as one piece.
   */
  back?: {
    seatHeight: Mm;
    style: 'slats' | 'panel';
    count: number;
    railHeight: Mm;
    angleDeg?: number;
  } | null;
  /**
   * Reclining back (ADR-040): seat-to-back angles of the bought mechanism's positions (default 100°, 120°, 150°) and the
   * one shown; it sets the back's rake (angle − 90°). An optional footrest hangs from the seat's front edge, swung
   * forward by `angles[at]` degrees (0 = hanging, 90 = level). The mechanism is bought and sets the real positions.
   */
  recline?: {
    positions: number[];
    at: number;
    footrest?: { length: Mm; angles: number[] } | null;
  } | null;
  /**
   * Lounger backrest (ADR-040): the first `length` mm of a slatted seat lift on a hinge, on a bought prop. Positions
   * are seat-to-back angles (default 100°, 120°, 150°); 180° would be flat.
   */
  backrest?: { length: Mm; positions: number[]; at: number } | null;
  /** Arm posts on the seat at the front corners and arm rests back to the back posts; armrest top above the floor. */
  arms?: { height: Mm } | null;
  /** Chair only: `bought` = seat and back boards on a bought base (gas lift, mechanism, five-star base); no legs. */
  base?: 'legs' | 'bought';
  /** Bed only. */
  bed?: {
    mattress: { w: Mm; l: Mm };
    clearance: Mm;
    /** Top of the slats above the floor. */
    deckHeight: Mm;
    railHeight: Mm;
    headboardHeight: Mm;
    /** 0 = no footboard (low foot rail only). */
    footboardHeight: Mm;
    /** Back panel along the left side (daybed). 0 = none. */
    sidePanelHeight: Mm;
    /** Second bed above (bunk) with this clear gap between decks. 0 = single. */
    tierGap: Mm;
    guardHeight: Mm;
  } | null;
}

/** One part of a panel set (ADR-041): finished cut size only, no place in an assembly. Thickness comes from the board. */
export interface LoosePanel {
  id: string;
  name: string;
  /** Along the grain when the board has one. */
  length: Mm;
  width: Mm;
  materialId: string;
  quantity: number;
  /**
   * Where the part sits when its place is known (ADR-041 amendment, 2026-10-23): back-left-bottom corner and how it
   * lies. Placed parts have quantity 1; unplaced parts stay in the pile beside the assembly.
   */
  place?: PanelPlace;
}

/**
 * How a placed panel lies. `flat-*`: thickness up (y), length along x or z. `edge-*`: standing on its long edge,
 * width up, length along x or z. `up-*`: standing on its end, length up, width along x or z.
 */
export type PanelLie = 'flat-x' | 'flat-z' | 'edge-x' | 'edge-z' | 'up-x' | 'up-z';
export interface PanelPlace {
  x: Mm;
  y: Mm;
  z: Mm;
  lie: PanelLie;
}

/** Two placed panels screwed together (ADR-041 amendment); listed in the hardware schedule, screws chosen by the user. */
export interface PanelJoint {
  a: string;
  b: string;
  kind: 'screwed';
}

/**
 * Parts known only by their cut sizes (ADR-041), such as a bed whose panels are measured but whose assembly is not.
 * Built lying flat in one pile, largest at the bottom: never an invented assembly.
 */
export interface PanelSetParams {
  panels: LoosePanel[];
  /** Shown with the piece: what the parts are for and what is still unknown. */
  note?: string;
  /** Screwed joints between placed panels (ADR-041 amendment). */
  joints?: PanelJoint[];
}

export type Product =
  | { kind: 'cabinet'; id: string; params: CabinetParams }
  | { kind: 'desk'; id: string; params: DeskParams }
  | { kind: 'corner'; id: string; params: CornerParams }
  | { kind: 'panel'; id: string; params: PanelParams }
  | { kind: 'frame'; id: string; params: FrameParams }
  | { kind: 'panels'; id: string; params: PanelSetParams };

/** Where a piece came from (ADR-028); kept on every copy, never used for geometry. */
export interface CatalogMeta {
  category?: string;
  brand?: string;
  productName?: string;
  articleNumber?: string;
  /** Hardware the user still has to choose from a maker's datasheet (ADR-033 `hardware:user`); a warning stays until cleared. */
  hardwareToChoose?: string;
  origin?: {
    catalogId: string;
    variantId?: string;
    revision: number;
    brand?: string;
    productName: string;
    sourceUrl?: string;
    takenAt: string;
  };
}

/** Guidance thresholds (ADR-035). Absent = typical defaults; all are warnings, never errors. */
export interface RuleSettings {
  /** Longest shelf span for 18 mm particleboard or MDF before a sag warning; scaled by thickness. */
  shelfSpan?: Mm;
  /** Widest single hinged door before a warning. */
  doorMaxWidth?: Mm;
  /** Least inside depth for a hanging rail. */
  hangerDepth?: Mm;
  /** Room height, for the tilt-up check. Absent = not checked. */
  roomHeight?: Mm;
}

export interface Design {
  /**
   * 2 adds stock sheets and cutting settings (ADR-019); 3 adds edge band specs on boards (ADR-077). Older files are
   * upgraded in memory on load.
   */
  schemaVersion: 1 | 2 | 3;
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  materials: Material[];
  product: Product;
  /** Saw settings for sheet layouts. */
  cutting?: { kerf: Mm };
  /** Catalog metadata and origin link (ADR-028). */
  catalog?: CatalogMeta;
  /** Guidance thresholds (ADR-035). */
  settings?: { rules?: RuleSettings };
  /** Answers of the New-piece wizard that made this piece, so it can be reopened there (ADR-046). Never geometry. */
  wizard?: { answers: WizardAnswers };
}

/** Wizard answers as stored: text, numbers, or a list of those or of compartments (`src/core/wizard/types.ts`). */
export type WizardAnswers = Record<
  string,
  string | number | (string | number | { kind: string; shelves: number; drawers: number })[]
>;
