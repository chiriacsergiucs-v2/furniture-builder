/** The products a design builds (G-548, ADR-306): cabinets and their spaces, desks, corners, panels, frames, panel sets. */
import type { Mm } from './kernelTypes';

/** Size of one part of a split: fixed millimetres or a share of the remainder. */
export type SplitSize = { mode: 'mm'; value: Mm } | { mode: 'fr'; value: number };

export interface DoorsFront {
  kind: 'doors';
  count: 1 | 2;
  /** Hinge side of a single door (default left, so it opens from the right). */
  hinge?: 'left' | 'right';
}

/** Sliding doors in two planes in front of the carcass (ADR-037). The track system is the user's choice. */
interface SlidingFront {
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
  /**
   * Height of the handle centre line in the piece's own coordinates, mm (ADR-125). Set only by a run handle when the
   * project model is built (`applyRunHandles`), never saved; a front the line does not cross uses `position`.
   */
  lineY?: Mm;
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

interface EmptySpace extends SpaceBase {
  kind: 'empty';
  appliance?: ApplianceNiche;
}
interface ShelvesSpace extends SpaceBase {
  kind: 'shelves';
  count: number;
  /** Loose shelves on pins: shortened by the shelf clearance; the neighbouring panels get pin rows (ADR-023). */
  adjustable?: boolean;
}
interface HangingSpace extends SpaceBase {
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
interface SplitSpace extends SpaceBase {
  kind: 'split';
  /** 'x' = vertical dividers, children left→right. 'y' = horizontal dividers, children top→bottom. */
  axis: 'x' | 'y';
  sizes: SplitSize[];
  children: Space[];
  /**
   * The rounding remainder goes to the first flexible part instead of the last (ADR-205, schemaVersion 9): set on
   * mirrored copies so the remainder stays on the same physical part. Absent = the last.
   */
  remainderFirst?: true;
  /**
   * Staggered rows (ADR-282, schemaVersion 10), stacked splits only: each row is divided side by side with spans of
   * the rule's three widths, one span taking the rest; the rows are written from the rule, not generated in memory.
   */
  stagger?: StaggerRule;
}

/** The rule of a staggered split (ADR-282). */
export interface StaggerRule {
  /** Three clear span widths, mm. */
  widths: [Mm, Mm, Mm];
  /** The seed of the last Randomize: the same seed gives the same rows. */
  seed: number;
  /** Rows (top = 0) the user keeps as set by hand: the rule leaves them as they are. Absent = none. */
  kept?: number[];
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
  /** `false`: the drawer front closes the box, no inner front; drawers behind doors keep theirs (ADR-192). Absent = true. */
  innerFront?: boolean;
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
  /**
   * Set only while the cabinet shares a side with a neighbour (ADR-190), never saved. `right`: its right side is left
   * out (the neighbour's left side serves); `left`: its left side is shared. Fronts meet over the shared side's middle.
   */
  shared?: { left?: boolean; right?: boolean };
  /** Depth of each top rail (default 100). */
  railDepth?: Mm;
  /** 2: two body panels glued as the top, the second under the first; outer height unchanged (ADR-105). Absent = 1. */
  topLayers?: 1 | 2;
  /** 'under': the bottom runs the full width and the sides stand on it. 'none': no bottom (over-hood units). Absent = between the sides. */
  bottom?: 'between' | 'under' | 'none';
  back: 'none' | 'applied' | 'inset';
  /**
   * Open both sides (ADR-292, schemaVersion 11), only with `back: 'none'`: the rear edges of the sides, top, bottom,
   * dividers and shelves are banded too, and a tall piece gets a floor or ceiling fixing instead of a wall fixing.
   */
  twoFaced?: true;
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
  /**
   * Set only while the desk shares a side with a cabinet (ADR-207), never saved: the gable at that end is left out and
   * the cabinet's side serves (a gable stops under the worktop, so the cabinet's side is always the shared one).
   */
  omitGable?: { left?: boolean; right?: boolean };
}

/** Corner cabinets (ADR-025): built from two carcasses by the cabinet generator. */
export interface CornerParams {
  /** `diagonal` (ADR-040): a five-sided unit, `width` along both walls, `depth` deep at each return, door(s) at 45°. */
  variant: 'blind' | 'l-shape' | 'diagonal';
  /** Which end the corner is at. */
  side: 'left' | 'right';
  /**
   * Set only while a blind corner shares a side at its straight end (ADR-207, as ADR-190), never saved: `right` its
   * right side is left out (the neighbour's serves), `left` its left side is shared. Fronts meet over its middle.
   */
  shared?: { left?: boolean; right?: boolean };
  /** Blind: overall width. L-shape: length of the wing along the back wall. */
  width: Mm;
  /** L-shape: length of the wing along the side wall, including the corner. */
  wingWidth: Mm;
  /** Blind: width of the blind section covered by the neighbouring cabinet. */
  blindWidth: Mm;
  height: Mm;
  depth: Mm;
  /**
   * 'wall': hung on the wall (ADR-177, schemaVersion 7): no plinth, and one hardware line asking the user to choose
   * the hanging brackets (none are scheduled automatically). Absent = floor.
   */
  mount?: 'floor' | 'wall';
  /** Height of the unit's underside above the floor when wall-mounted (position only). */
  mountHeight?: Mm;
  bodyMaterialId: string;
  frontMaterialId: string;
  backMaterialId: string;
  top: 'over' | 'between';
  /** 2: a doubled top, as on a cabinet (ADR-105). Absent = 1. */
  topLayers?: 1 | 2;
  /**
   * Set only while the unit is in a common top or bottom (ADR-189), never saved: its top over (bottom under) the
   * sides or returns, so the common panel covers them.
   */
  join?: { top?: boolean; bottom?: boolean };
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
   * are seat-to-back angles (default 100°, 120°, 150°); 180° would be flat. `end` (ADR-207, design schemaVersion 9):
   * the end it lifts at; absent = left.
   */
  backrest?: { length: Mm; positions: number[]; at: number; end?: 'right' } | null;
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
    /** Back panel along one side (daybed), the left unless `sidePanelEnd` says right. 0 = none. */
    sidePanelHeight: Mm;
    /** The side the daybed's side panel is on (ADR-207, design schemaVersion 9); absent = left. */
    sidePanelEnd?: 'right';
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
interface PanelPlace {
  x: Mm;
  y: Mm;
  z: Mm;
  lie: PanelLie;
}

/** Two placed panels screwed together (ADR-041 amendment); listed in the hardware schedule, screws chosen by the user. */
interface PanelJoint {
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
