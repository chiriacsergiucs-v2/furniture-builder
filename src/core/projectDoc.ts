/**
 * The project document (ADR-022, G-548 split, ADR-306): its types, schema versions and run settings, and the helpers that
 * only read or prune it. Positions are whole millimetres and rotations quarter turns about the vertical axis.
 */
import { type ItemZones } from './envelopes';
import { type Room } from './room';
import { type VariableSet } from './setRoom';
import type { Placement } from './placement';
import { type Binding, type ProjectVariable } from './variables';
import { DEFAULT_KERF, newId } from './design';
import { type Connection } from './connections';
import { type ModelItem } from './model3d';
import { type PlanPicture } from './planPicture';
import type {
  Box,
  Design,
  Face,
  FrontStyle,
  Handle,
  HardwareProduct,
  Material,
  Mm,
  Panel,
  SellerItem,
} from './types';

export type QuarterTurn = 0 | 90 | 180 | 270;

export type { Placement } from './placement';

/** An outside size a lock can hold (ADR-171). */
export type SizeAxis = 'width' | 'height' | 'depth';
export const SIZE_AXES: readonly SizeAxis[] = ['width', 'height', 'depth'];

export interface ProjectItem {
  id: string;
  /** Embedded copy; edited inside the project only. */
  design: Design;
  /** Identical copies of this piece (cut and bought; one is placed). */
  quantity: number;
  /** Where the rotated piece's lowest corner (min x, y, z) sits in the room. */
  position: { x: Mm; y: Mm; z: Mm };
  /** Quarter turn about the vertical axis; 90 turns the piece's front to face +x. */
  rotationY: QuarterTurn;
  /** The saved design this copy came from, for "Update from library". */
  libraryId?: string;
  placement?: Placement;
  /** Chair, service and installation settings (ADR-073); absent = none. Saved from project schemaVersion 3. */
  zones?: ItemZones;
  /**
   * Placement locked (ADR-095): nothing moves or turns the piece until it is unlocked; its size, boards and
   * construction stay editable. Absent = not locked. Saved from project schemaVersion 6.
   */
  locked?: true;
  /**
   * The template revision the user chose to keep this piece at ("Keep mine", ADR-096): the newer-template notice stays
   * hidden until the template moves past it. Absent = never dismissed. Saved from project schemaVersion 7.
   */
  templateSeen?: number;
  /**
   * Linked copies (ADR-111): items of one project with the same `linkId` share their design; a change to one reaches
   * the others (`src/core/linked.ts`). Absent = not linked. Saved from project schemaVersion 9.
   */
  linkId?: string;
  /**
   * Extra whole degrees (1–89) on top of the quarter turn (ADR-121): the piece is turned `rotationY + angle` degrees in
   * all, about the centre of its quarter-turned outline; `position` stays that outline's lowest corner. Absent = 0.
   * Saved from project schemaVersion 10.
   */
  angle?: number;
  /**
   * Size locked (ADR-122): its width, height and depth do not change until it is unlocked; nothing resizes it for the
   * user either. Separate from `locked` (placement). Absent = not locked. Saved from project schemaVersion 11.
   */
  sizeLocked?: true;
  /**
   * Turn locked (ADR-171): its quarter turn and angle do not change until it is unlocked; it still moves and resizes.
   * Absent = not locked. Saved from project schemaVersion 19.
   */
  turnLocked?: true;
  /**
   * Sizes locked one by one (ADR-171): the listed outside sizes do not change until unlocked; `sizeLocked` stays and
   * means all three. Absent = none. Saved from project schemaVersion 19.
   */
  sizeLocks?: SizeAxis[];
  /**
   * Boards locked (ADR-211): its boards and edge bands do not change until it is unlocked (`src/core/pieceLocks.ts`).
   * Absent = not locked. Saved from project schemaVersion 21.
   */
  boardsLocked?: true;
  /**
   * Construction locked (ADR-211): the choices of its Construction group do not change until it is unlocked. Absent =
   * not locked. Saved from project schemaVersion 21.
   */
  constructionLocked?: true;
  /**
   * Template reference (ADR-124): the piece refers to its catalog origin (`design.catalog.origin`: template, variant,
   * revision) and `overrides` are the settings it changed against it (`src/core/ownEdits.ts`), kept up to date while
   * that revision is the catalog's. `design` stays the full copy, the fallback (G-161). Absent = a plain copy.
   * Saved from project schemaVersion 12.
   */
  ref?: { overrides: Record<string, unknown> };
  /**
   * Bindings (ADR-166): sizes and positions that follow a project variable or a formula, evaluated on every commit
   * (`src/core/variables.ts`). Absent = none. Saved from project schemaVersion 16.
   */
  bindings?: Binding[];
  /**
   * The value set this piece is a duplicate for (ADR-167): `of` is the set-1 piece it copies. Absent = set 1.
   * Saved from project schemaVersion 16.
   */
  set?: { id: string; of: string };
  /**
   * Room pipes and outlets (feature ids) its back is cut around (ADR-205, "Cut the back around it"): the back becomes a
   * profiled part with a notch or a hole the size of the zone. Absent = none. Saved from project schemaVersion 21.
   */
  backCuts?: string[];
  /**
   * The definition list this piece is linked to (ADR-307): its bindings take the list's variable values and it follows
   * the list's settings. `values` are the piece's own overrides of variable values, by variable id. Absent = none.
   * Saved from project schemaVersion 23.
   */
  list?: { id: string; values?: Record<string, string> };
}

/**
 * A definition list (ADR-307): other values for the project's variables (by variable id; absent or empty = the
 * project's) and for the project settings (absent key = the project's), for the pieces linked to it.
 */
export interface DefinitionList {
  id: string;
  name: string;
  values: Record<string, string>;
  settings?: ProjectSettings;
}

/**
 * Project-wide settings (ADR-124): choices every piece follows while its own value equals the project's
 * (`src/core/projectSettings.ts`). Each is optional; absent = not set. Saved from project schemaVersion 12.
 */
export interface ProjectSettings {
  body?: Material;
  front?: Material;
  back?: Material;
  handle?: Handle | null;
  frontStyle?: FrontStyle;
  plinthHeight?: Mm;
}

/** Cabinets standing side by side that share their sides, left to right (ADR-190, schemaVersion 20). */
export interface SharedSides {
  id: string;
  itemIds: string[];
}

/** One top or bottom panel shared by items standing side by side (ADR-165, schemaVersion 17). */
export interface CommonPanel {
  id: string;
  kind: 'top' | 'bottom';
  itemIds: string[];
}

/**
 * A part that belongs to a run of pieces rather than to any one of them (ADR-036): the worktop over a run of base
 * units, a filler in a gap between two of them, a cover panel on an exposed end. Stored with its room position and
 * its own copy of the board, so it survives edits of the pieces; the reason says why it was added.
 */
export interface RunPart {
  id: string;
  kind: 'worktop' | 'filler' | 'cover' | 'plinth' | TrimKind;
  /** What it is made from (ADR-061): kind + source piece ids + end; stable across refreshes. Absent in older files. */
  key?: string;
  /** Ids of the pieces it was derived from (ADR-061); a run plinth replaces these pieces' own plinths (ADR-054). */
  from?: string[];
  /** Extra width cut for scribing to the wall or a neighbour (ADR-054); the installed size is `box`. */
  scribe?: Mm;
  /** Shown once after an automatic refresh changed this part ("2400 → 3000 mm long"). */
  changed?: string;
  label: string;
  reason: string;
  box: Box;
  material: Material;
  thicknessAxis: Panel['thicknessAxis'];
  grainAxis: Panel['grainAxis'];
  banded: Face[];
}

/** Trims along a run of wall or tall units (ADR-075). */
export type TrimKind = 'crown' | 'pelmet' | 'ceiling-filler';
export const TRIM_KINDS: TrimKind[] = ['crown', 'pelmet', 'ceiling-filler'];

/**
 * A run part the user asked for (ADR-075): a worktop over chosen adjacent base units (with its overhangs), or a
 * trim over chosen adjacent wall or tall units. Its part is planned with the other run parts, so it follows the
 * pieces (ADR-061). The key is `kind|from ids`, the same form as the suggested parts.
 */
export interface RunRequest {
  /** `filler`: a filler a repair added beside a door's piece (ADR-209), `from` = [door's piece, neighbour]. */
  kind: 'worktop' | TrimKind | 'filler';
  /** Item ids, left to right (a filler: the door's piece, then its neighbour). */
  from: string[];
  /** Worktop: overhang past the front and past each end, mm. Absent = 20 and 0, as suggested worktops. */
  front?: Mm;
  side?: Mm;
  /** Crown and pelmet: the strip height the user entered (no default). */
  height?: Mm;
  /** Trims: the board, a copy. */
  material?: Material;
  /**
   * Crown and pelmet (ADR-209): the moulding's cross-section the user typed or tapped, whole-mm points [across, up]; the
   * strip takes its bounding width and height. Absent = a plain strip of `height`.
   */
  profile?: [Mm, Mm][];
  /** Fields that follow project variables (ADR-209, ADR-166): targets `front`, `side` and `height`. */
  bindings?: Binding[];
  /** A repair filler's width, mm (ADR-209). */
  width?: Mm;
}

/** The fields of a run request that can follow a variable (ADR-209). */
export const REQUEST_TARGETS = ['front', 'side', 'height'] as const;
export type RequestTarget = (typeof REQUEST_TARGETS)[number];
/** The whole-mm range of a request field: the same limits as its field and the document check. */
export const REQUEST_RANGE: Record<RequestTarget, { min: Mm; max: Mm }> = {
  front: { min: 0, max: 1000 },
  side: { min: 0, max: 1000 },
  height: { min: 1, max: 3000 },
};
export const requestKey = (r: Pick<RunRequest, 'kind' | 'from'>) => `${r.kind}|${r.from.join(',')}`;

/** Bar handle hole centres offered (ADR-024), mm: the handle list run handles choose from (ADR-010, ADR-125). */
export const BAR_SPACINGS: readonly Mm[] = [96, 128, 160, 192, 224, 256, 320];

/**
 * One handle on every door and drawer front of a run of base units, on one line (ADR-125). Applied when the model is
 * built (`applyRunHandles`), never written into the pieces' designs, so removing it gives each piece its own handles
 * back. The run is found again from `from` on every build: a piece added to the run gets the handle too.
 */
export interface RunHandle {
  id: string;
  /** The run's pieces when it was made; any one of them still in a run finds that run. */
  from: string[];
  handle: Pick<Handle, 'kind' | 'holeSpacing'>;
  /** Height of the handle line above the floor, whole mm; absent = near the top of each front. */
  height?: Mm;
  /** Pieces that keep their own handles (overrides, ADR-061). */
  own?: string[];
}

/** A sink over a base unit (ADR-125): a cut-out in the run worktop, its size the user's (ADR-010). */
export interface RunSink {
  id: string;
  baseId: string;
  /** Cut-out width and depth, mm. */
  w: Mm;
  d: Mm;
  /**
   * Where the cut-out is (ADR-209): `x` from the base's left edge to the cut-out, `z` from the worktop's front edge,
   * whole mm. Absent = centred on that axis (ADR-205).
   */
  x?: Mm;
  z?: Mm;
}

/** A hob over a base unit (ADR-205): a cut-out in the run worktop, its size the user's (ADR-010); same shape as a sink. */
export type RunHob = RunSink;

/**
 * The joint where two worktops meet at a corner (ADR-205): `a` and `b` are the two worktops' run-part keys. There is no
 * default: until the user picks one the corner is an error. A mitre cuts both along the diagonal; a butt joint lets the
 * worktop `through` names (`a` or `b`) run to the outer corner and stops the other at its front edge.
 */
export interface WorktopJoint {
  id: string;
  a: string;
  b: string;
  kind: 'mitre' | 'butt';
  through?: 'a' | 'b';
}

/** A worktop's front edge (ADR-209): square, rounded or bevelled by the size the user typed (no default, ADR-010). */
export type WorktopEdgeKind = 'square' | 'rounded' | 'bevel';
export interface WorktopEdge {
  /** The worktop's run-part key (`runPartKey`), as worktop joints are keyed. */
  key: string;
  kind: WorktopEdgeKind;
  /** Radius (rounded) or bevel size, whole mm; absent = not typed yet (a warning; drawn square). */
  size?: Mm;
}

/**
 * Project document versions (ADR-011): new and edited projects are written at `PROJECT_SCHEMA`; every version in
 * `PROJECT_SCHEMAS` still loads unchanged. 2 = room pipes and outlets (ADR-072); 3 = clearance zones on items
 * (ADR-073); 4 = run requests and trim run parts (ADR-075); 5 = display-only 3D models (ADR-076); 6 = locked pieces
 * (ADR-095); 7 = a kept template revision on items (ADR-096); 8 = groups of pieces
 * (ADR-097); 9 = linked copies (ADR-111); 10 = pieces typed at an angle (ADR-121); 11 = size-locked pieces
 * (ADR-122); 12 = template references and project-wide settings (ADR-124); 13 = run handles and sinks (ADR-125);
 * 14 = wall backgrounds (ADR-145); 15 = fitted and straightened wall pictures (ADR-146); 16 = variables, bindings
 * and value sets (ADR-166, ADR-167); 17 = common tops and bottoms (ADR-165); 18 = connections between pieces
 * (ADR-168); 19 = turn and per-size locks (ADR-171); 20 = shared sides (ADR-190); 21 = seller products on run parts
 * (ADR-206), connection kinds and wall connections (ADR-207), the floor background, the plan picture and model
 * placements (ADR-208), worktop corner joints, hobs and backs cut around pipes and outlets (ADR-205), board and
 * construction locks (ADR-211), the project's own seller items (ADR-210), moulding profiles, request bindings and
 * repair fillers on run requests, cut-out positions and worktop edges (ADR-209); 22 = the outlet distances the user
 * sets on the room (ADR-299); 23 = definition lists and the pieces' links to them (ADR-307).
 */
export const PROJECT_SCHEMA = 23 as const;
export const PROJECT_SCHEMAS: readonly number[] = [
  1,
  2,
  3,
  4,
  5,
  6,
  7,
  8,
  9,
  10,
  11,
  12,
  13,
  14,
  15,
  16,
  17,
  18,
  19,
  20,
  21,
  22,
  PROJECT_SCHEMA,
];
type ProjectSchemaVersion =
  | 1
  | 2
  | 3
  | 4
  | 5
  | 6
  | 7
  | 8
  | 9
  | 10
  | 11
  | 12
  | 13
  | 14
  | 15
  | 16
  | 17
  | 18
  | 19
  | 20
  | 21
  | 22
  | typeof PROJECT_SCHEMA;
export const RUN_REQUESTS_SINCE = 4;
export const MODELS_SINCE = 5;
export const LOCKS_SINCE = 6;
export const TEMPLATE_SEEN_SINCE = 7;
export const GROUPS_SINCE = 8;
export const LINKS_SINCE = 9;
export const ANGLE_SINCE = 10;
export const SIZE_LOCK_SINCE = 11;
export const REFS_SINCE = 12;
export const RUN_EXTRAS_SINCE = 13;
export const WALLS_SINCE = 14;
export const FITTED_WALLS_SINCE = 15;
export const VARIABLES_SINCE = 16;
export const COMMON_SINCE = 17;
export const CONNECTIONS_SINCE = 18;
export const PARAM_LOCKS_SINCE = 19;
export const SHARED_SINCE = 20;
export const RUN_PRODUCTS_SINCE = 21;
export const CONNECTION_KINDS_SINCE = 21;
export const SURFACES_SINCE = 21;
export const KITCHEN_SINCE = 21;
export const PIECE_LOCKS_SINCE = 21;
export const SELLER_ITEMS_SINCE = 21;
export const FOLLOW_UPS_SINCE = 21;
export const OWNED_SINCE = 21;
export const OUTLET_DISTANCES_SINCE = 22;
export const LISTS_SINCE = 23;

export interface Project {
  schemaVersion: ProjectSchemaVersion;
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  items: ProjectItem[];
  cutting?: { kerf: Mm };
  /** Run parts (ADR-036). Absent = none, as in projects saved before. */
  runParts?: RunPart[];
  /** Run-part settings (ADR-054, ADR-061). Absent = scribe 0, no automatic refresh. */
  runSettings?: RunSettings;
  /** Keys of run parts the user removed; an automatic refresh never brings them back (ADR-061). */
  runPartsRemoved?: string[];
  /** Run parts the user asked for: part-run worktops, overhangs and trims (ADR-075). Absent = none. */
  runRequests?: RunRequest[];
  /** The room: walls, doors, windows, obstacles (ADR-058/0056). Absent = no room checks. */
  room?: Room;
  /** Display-only 3D models (ADR-076, schemaVersion 5): never cut, priced, bought or nested. Absent = none. */
  models?: ModelItem[];
  /**
   * Named groups of pieces (ADR-097, schemaVersion 8): selected together, never merged, not connections. A piece is in
   * at most one group; a group holds two pieces or more, always pieces of this project (`pruneGroups`). Absent = none.
   */
  groups?: { id: string; name: string; itemIds: string[] }[];
  /** Project-wide settings (ADR-124, schemaVersion 12). Absent = none set. */
  settings?: ProjectSettings;
  /** Handles for a run of base units (ADR-125, schemaVersion 13). Absent = none. */
  runHandles?: RunHandle[];
  /** Sinks over base units: worktop cut-outs (ADR-125, schemaVersion 13). Absent = none. */
  sinks?: RunSink[];
  /** Project variables (ADR-166, schemaVersion 16): named numbers or formulas pieces are bound to. Absent = none. */
  variables?: ProjectVariable[];
  /** Value sets (ADR-167, schemaVersion 16): more sets of values for the variables, each with its duplicates. */
  variableSets?: VariableSet[];
  /** Common tops and bottoms across items (ADR-165, schemaVersion 17). Absent = none. */
  common?: CommonPanel[];
  /** Neighbours sharing one side panel (ADR-190, schemaVersion 20). Absent = none. */
  sharedSides?: SharedSides[];
  /**
   * Connections between pieces (ADR-168, schemaVersion 18): they move together and are re-checked. Their kind (side,
   * corner, stacked) and wall connections (one piece against a wall) since schemaVersion 21 (ADR-207).
   */
  connections?: Connection[];
  /**
   * Seller products linked to run parts (ADR-206, schemaVersion 21), by run part key (`key`, else `id`): priced by the
   * product when its unit fits (piece or m), else by the board. Absent = none.
   */
  runProducts?: Record<string, HardwareProduct>;
  /**
   * Parts the user already owns (ADR-271, schemaVersion 21): cut-list row key (`ownedKey`) → how many, over all pieces.
   * They leave the project's cut list and sheet layouts only. Absent = none.
   */
  ownedParts?: Record<string, number>;
  /** A picture of the floor plan to trace over (ADR-208, schemaVersion 21). Absent = none. */
  planPicture?: PlanPicture;
  /** Joints where worktops meet at a corner (ADR-205, schemaVersion 21). Absent = none chosen. */
  worktopJoints?: WorktopJoint[];
  /** Hobs over base units: worktop cut-outs (ADR-205, schemaVersion 21). Absent = none. */
  hobs?: RunHob[];
  /**
   * Seller products added to the project's own shopping list (ADR-210, schemaVersion 21; ADR-161 `SellerItem`),
   * listed once after the pieces' items. Absent = none.
   */
  sellerItems?: SellerItem[];
  /** Worktop front edges (ADR-209, schemaVersion 21), one per worktop by run-part key. Absent = square. */
  worktopEdges?: WorktopEdge[];
  /** Definition lists pieces link to (ADR-307, schemaVersion 23). Absent = none. */
  definitionLists?: DefinitionList[];
}

/**
 * Everything in a project that can hold a picture (ADR-048, ADR-145): the pieces' materials, the run parts' and the
 * wall backgrounds. For files that carry their pictures and for the unused-picture cleanup.
 */
export const pictureHolders = (p: Project): { materials: { image?: { id: string } }[] }[] => [
  ...p.items.map((i) => i.design),
  { materials: (p.runParts ?? []).map((r) => r.material) },
  { materials: p.room?.walls ?? [] },
  // The floor background and the plan picture (ADR-208).
  { materials: p.room?.floor ? [p.room.floor] : [] },
  { materials: p.planPicture ? [{ image: { id: p.planPicture.id } }] : [] },
];

/**
 * Groups keep only pieces still in the project, and a group left with fewer than two goes (ADR-097: a deleted piece
 * leaves its group). The same project when nothing changes; every commit applies it.
 */
export function pruneGroups(project: Project): Project {
  if (!project.groups) return project;
  const ids = new Set(project.items.map((i) => i.id));
  const was = project.groups;
  // A group keeps two pieces or more: one left alone is no group (ADR-097).
  const groups = was
    .map((g) => ({ ...g, itemIds: g.itemIds.filter((x) => ids.has(x)) }))
    .filter((g) => g.itemIds.length >= 2);
  const same =
    groups.length === was.length &&
    groups.every((g, i) => g.itemIds.length === was[i].itemIds.length);
  return same ? project : { ...project, groups };
}

export interface RunSettings {
  /** Scribe allowance added to the cut width of fillers, mm (ADR-054). */
  scribe: Mm;
  /** Suggest run parts again after every change of the pieces (ADR-061). */
  auto: boolean;
}

export function newProject(name = 'New project'): Project {
  const now = new Date().toISOString();
  return {
    schemaVersion: PROJECT_SCHEMA,
    id: newId(),
    name,
    createdAt: now,
    updatedAt: now,
    items: [],
    cutting: { kerf: DEFAULT_KERF },
  };
}

/** The piece is built to hang on the wall: a wall cabinet (brackets and rail scheduled) or a hung corner (ADR-177). */
export const isWallHung = (d: Design) =>
  (d.product.kind === 'cabinet' || d.product.kind === 'corner') &&
  d.product.params.mount === 'wall';
