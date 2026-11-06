/**
 * Projects (ADR-022): several pieces placed in a room, cut and bought together.
 * Each item embeds its own copy of a design (library edits never flow in by themselves); positions are whole
 * millimetres and rotations quarter turns about the vertical axis, so every panel stays an axis-aligned box.
 */
import { buildModel } from './build';
import { compatChecks } from './compat';
import { localClearances, type Clearance } from './clearance';
import {
  BODY_CODES,
  envelopeChecks,
  envelopesOf,
  MAX_ZONE_DEPTH,
  SERVICE_SIDES,
  worse,
  type ClearanceZone,
  type Envelope,
  type ItemZones,
} from './envelopes';
import {
  boxInside,
  featureBox,
  isService,
  outlineIssues,
  roomChecks,
  serviceChecks,
  validateRoom,
  type Room,
} from './room';
import { setRooms, type VariableSet } from './setRoom';
import {
  variableDiagnostics,
  type Binding,
  type ProjectVariable,
  isBindTarget,
  MAX_EXPR,
  MAX_VARIABLE_NAME,
  MAX_VARIABLES,
  nameProblem,
} from './variables';
import { bandKey, cutlist, hardwareSummary, type CutRow } from './cutlist';
import { bandFor, bandProblems, bandText, productRefProblems } from './materials';
import { DEFAULT_KERF, newId, sheetOf, upgradeDesign, validateDesign, validPer } from './design';
import {
  cutDimensions,
  enclosing,
  footprintOf,
  inPlaneAxes,
  intersection,
  overlaps,
  penetration,
  sizeOn,
  union,
  yawPoint,
} from './geometry';
import {
  commonBuilds,
  commonDesign,
  commonPanels,
  commonTopRole,
  pruneCommon,
  type CommonBuild,
} from './common';
import { connectionDiagnostics, pruneConnections, type Connection } from './connections';
import { bounds2 } from './outline';
import {
  pruneShared,
  sharedBuilds,
  sharedDesign,
  withSharedPins,
  type SharedBuild,
} from './shared';
import { aabbOf, area2, overlapsBox, panelsOverlap, turnShape } from './shape';
import {
  modelBox,
  modelChecks,
  validateModelItems,
  type ModelItem,
  type ModelPlacement,
} from './model3d';
import { planPictureProblems, type PlanPicture } from './planPicture';
import type { SheetSettings } from './nesting';
import { jobsFromCutlist } from './nesting';
import type { NestJob } from './nesting/types';
import type {
  Axis,
  Box,
  CabinetParams,
  CatalogMeta,
  Design,
  Diagnostic,
  Face,
  FrontStyle,
  FurnitureModel,
  Handle,
  HardwareItem,
  HardwareProduct,
  Material,
  Mm,
  Panel,
  PanelShape,
  PinRows,
  Space,
  Yaw,
} from './types';
import { t, type Key } from './i18n';

export type QuarterTurn = 0 | 90 | 180 | 270;

/**
 * How a piece is placed (ADR-031). The stored `position` is kept in step with it by `resolvePlacements`:
 *  - floor: stands on the floor (height 0), moved freely along the walls;
 *  - wall: hung on the wall, its underside `height` mm above the floor;
 *  - above: sits on another piece (gap 0) or hangs `gap` mm above it, back faces aligned, `offsetX` mm from its
 *    left edge; it follows that piece when it moves.
 * Absent = free: `position` is used as stored (projects saved before placement existed).
 */
export type Placement =
  | { kind: 'floor' }
  | { kind: 'wall'; height: Mm }
  | { kind: 'above'; baseId: string; gap: Mm; offsetX: Mm };

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
  kind: 'worktop' | TrimKind;
  /** Item ids, left to right. */
  from: string[];
  /** Worktop: overhang past the front and past each end, mm. Absent = 20 and 0, as suggested worktops. */
  front?: Mm;
  side?: Mm;
  /** Crown and pelmet: the strip height the user entered (no default). */
  height?: Mm;
  /** Trims: the board, a copy. */
  material?: Material;
}
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
 * construction locks (ADR-211).
 */
export const PROJECT_SCHEMA = 21 as const;
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
  PROJECT_SCHEMA,
];
export type ProjectSchemaVersion =
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
  | typeof PROJECT_SCHEMA;
const RUN_REQUESTS_SINCE = 4;
const MODELS_SINCE = 5;
const LOCKS_SINCE = 6;
const TEMPLATE_SEEN_SINCE = 7;
const GROUPS_SINCE = 8;
const LINKS_SINCE = 9;
const ANGLE_SINCE = 10;
const SIZE_LOCK_SINCE = 11;
const REFS_SINCE = 12;
const RUN_EXTRAS_SINCE = 13;
const WALLS_SINCE = 14;
const FITTED_WALLS_SINCE = 15;
const VARIABLES_SINCE = 16;
const COMMON_SINCE = 17;
const CONNECTIONS_SINCE = 18;
const PARAM_LOCKS_SINCE = 19;
const SHARED_SINCE = 20;
const RUN_PRODUCTS_SINCE = 21;
const CONNECTION_KINDS_SINCE = 21;
const SURFACES_SINCE = 21;
const KITCHEN_SINCE = 21;
const PIECE_LOCKS_SINCE = 21;

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
  /** A picture of the floor plan to trace over (ADR-208, schemaVersion 21). Absent = none. */
  planPicture?: PlanPicture;
  /** Joints where worktops meet at a corner (ADR-205, schemaVersion 21). Absent = none chosen. */
  worktopJoints?: WorktopJoint[];
  /** Hobs over base units: worktop cut-outs (ADR-205, schemaVersion 21). Absent = none. */
  hobs?: RunHob[];
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

/** A copy of a design as a new project item, placed to the right of what is already there. */
export function makeItem(project: Project, design: Design, libraryId?: string): ProjectItem {
  const right = project.items.length
    ? Math.max(...project.items.map((i) => placedBounds(i).x + placedBounds(i).w))
    : 0;
  const d = upgradeDesign(design);
  const wall = isWallHung(d);
  const y = wall
    ? d.product.kind === 'cabinet' || d.product.kind === 'corner'
      ? (d.product.params.mountHeight ?? 1450)
      : 1450
    : 0;
  const placement: Placement = wall ? { kind: 'wall', height: y } : { kind: 'floor' };
  return {
    id: newId(),
    design: structuredClone(d),
    quantity: 1,
    position: { x: right, y, z: 0 },
    rotationY: 0,
    placement,
    ...(libraryId ? { libraryId } : {}),
    // A catalog piece refers to its template (ADR-124); the copy stays as the fallback.
    ...(d.catalog?.origin ? { ref: { overrides: {} } } : {}),
  };
}

/** The piece is built to hang on the wall: a wall cabinet (brackets and rail scheduled) or a hung corner (ADR-177). */
export const isWallHung = (d: Design) =>
  (d.product.kind === 'cabinet' || d.product.kind === 'corner') &&
  d.product.params.mount === 'wall';

// ---------------------------------------------------------------------------
// Placement: floor, wall, on or above another piece (ADR-031)
// ---------------------------------------------------------------------------

/** Pieces an item may sit on or hang above: not itself and nothing that (directly or not) sits on it. */
export function placementBases(project: Project, id: string): ProjectItem[] {
  const byId = new Map(project.items.map((i) => [i.id, i]));
  const restsOn = (it: ProjectItem): boolean => {
    for (let cur: ProjectItem | undefined = it, n = 0; cur && n <= project.items.length; n++) {
      if (cur.id === id) return true;
      cur = cur.placement?.kind === 'above' ? byId.get(cur.placement.baseId) : undefined;
    }
    return false;
  };
  return project.items.filter((i) => i.id !== id && !restsOn(i));
}

/**
 * Bring every stored position in line with its placement. Bases are placed before the pieces on them; a piece whose
 * base is missing or that rests on itself through a chain keeps its stored position (reported by `placementIssues`).
 * Returns the same project when nothing moves.
 */
export function resolvePlacements(project: Project): Project {
  const byId = new Map(project.items.map((i) => [i.id, i]));
  const out = new Map<string, ProjectItem>();
  const busy = new Set<string>();
  const resolve = (it: ProjectItem): ProjectItem => {
    const done = out.get(it.id);
    if (done) return done;
    if (busy.has(it.id)) return it;
    busy.add(it.id);
    const pl = it.placement;
    let position = it.position;
    if (pl?.kind === 'floor') position = { ...position, y: 0 };
    else if (pl?.kind === 'wall') position = { ...position, y: pl.height };
    else if (pl?.kind === 'above') {
      const base = byId.get(pl.baseId);
      if (base && !busy.has(base.id)) {
        const b = placedBounds(resolve(base));
        position = { x: b.x + pl.offsetX, y: b.y + b.h + pl.gap, z: b.z };
      }
    }
    busy.delete(it.id);
    const next =
      position.x === it.position.x && position.y === it.position.y && position.z === it.position.z
        ? it
        : { ...it, position };
    out.set(it.id, next);
    return next;
  };
  const items = project.items.map(resolve);
  // Display-only models follow their placement too (ADR-208); their base is always a piece, never a model.
  const resolved = new Map(items.map((i) => [i.id, i]));
  const models = project.models?.map((m) => {
    const position = modelPosition(m.position, m.placement, (id) => {
      const base = resolved.get(id);
      return base ? placedBounds(base) : undefined;
    });
    return position === m.position ? m : { ...m, position };
  });
  const sameItems = items.every((it, i) => it === project.items[i]);
  const sameModels = !models || models.every((m, i) => m === project.models![i]);
  if (sameItems && sameModels) return project;
  return { ...project, items, ...(models ? { models } : {}) };
}

/**
 * Where a model stands for its placement (ADR-208): on the floor, on the wall at its height, or on a piece (`baseBox`
 * gives that piece's placed box). The same position object when nothing changes; a missing base keeps it.
 */
export function modelPosition(
  position: ModelItem['position'],
  pl: ModelPlacement | undefined,
  baseBox: (id: string) => Box | undefined,
): ModelItem['position'] {
  let next = position;
  if (pl?.kind === 'floor') next = { ...position, y: 0 };
  else if (pl?.kind === 'wall') next = { ...position, y: pl.height };
  else if (pl?.kind === 'above') {
    const b = baseBox(pl.baseId);
    if (b) next = { x: b.x + pl.offsetX, y: b.y + b.h + pl.gap, z: b.z };
  }
  return next.x === position.x && next.y === position.y && next.z === position.z ? position : next;
}

// ---------------------------------------------------------------------------
// Dragging a piece on the plan (ADR-065)
// ---------------------------------------------------------------------------

/** The step a drag or an arrow key moves a piece by (ADR-065); typed values stay exact to 1 mm. */
export const DRAG_STEP: Mm = 10;

/**
 * Where a piece lands after being moved `dxMm` / `dzMm` on the plan: the move is rounded to whole `step`s, so the
 * piece keeps its own millimetres and moves by multiples of the step. No clamping and no snapping (ADR-008): a
 * position outside the room or over another piece is kept and reported by the usual diagnostics.
 */
export function dragPosition(
  item: ProjectItem,
  dxMm: number,
  dzMm: number,
  step: Mm = DRAG_STEP,
): ProjectItem['position'] {
  const snap = (d: number) => (Number.isFinite(d) ? Math.round(d / step) * step : 0) || 0;
  return { ...item.position, x: item.position.x + snap(dxMm), z: item.position.z + snap(dzMm) };
}

/**
 * Where a tap on the plan puts a piece being placed (ADR-056): its left-back corner at the room point, in whole mm,
 * clamped to x ≥ 0 and z ≥ 0; its height is kept. A piece dropped from the piece list starts here too (ADR-094).
 */
export function tapPosition(item: ProjectItem, x: number, z: number): ProjectItem['position'] {
  const mm = (v: number) => (Number.isFinite(v) ? Math.max(0, Math.round(v)) : 0);
  return { ...item.position, x: mm(x), z: mm(z) };
}

/**
 * A piece placed on or above another piece leaves it when dragged (ADR-065): wall-hung pieces become hung on the
 * wall at their current height, anything else stands on the floor. Other placements are returned unchanged.
 */
export function liftOff(item: ProjectItem): Placement | undefined {
  if (item.placement?.kind !== 'above') return item.placement;
  return isWallHung(item.design) ? { kind: 'wall', height: item.position.y } : { kind: 'floor' };
}

// ---------------------------------------------------------------------------
// Locked pieces (ADR-095)
// ---------------------------------------------------------------------------

/** A quarter turn on from `r`: `dir` 1 turns the front from facing you to facing right (ADR-069). */
export const quarterTurn = (r: QuarterTurn, dir: 1 | -1): QuarterTurn =>
  ((((r + dir * 90) % 360) + 360) % 360) as QuarterTurn;

/** A piece's whole turn in degrees, 0–359 (ADR-121): its quarter turn plus its extra angle. */
export const rotationOf = (item: Pick<ProjectItem, 'rotationY' | 'angle'>): number =>
  item.rotationY + (item.angle ?? 0);

/** Whole degrees as a quarter turn and the extra angle the item stores (ADR-121); null outside 0–359. */
export function splitRotation(deg: number): { rotationY: QuarterTurn; angle?: number } | null {
  if (!Number.isInteger(deg) || deg < 0 || deg > 359) return null;
  const rotationY = (Math.floor(deg / 90) * 90) as QuarterTurn,
    angle = deg - rotationY;
  return angle ? { rotationY, angle } : { rotationY };
}

/** The turn after mirroring left–right (ADR-121): the front's sideways part flips, so θ becomes −θ. */
export function mirroredRotation(item: Pick<ProjectItem, 'rotationY' | 'angle'>) {
  return splitRotation((360 - rotationOf(item)) % 360)!;
}

/** The piece's placement is locked: nothing moves or turns it (ADR-095). */
export const isLocked = (item: Pick<ProjectItem, 'locked'> | undefined): boolean => !!item?.locked;

/** The hint shown when a locked piece is dragged, turned or mirrored (ADR-095). */
export const LOCKED_HINT = t('Locked — unlock to move');
/** The hint shown where a turn-locked piece would be turned (ADR-171). */
export const TURN_LOCKED_HINT = t('Turn locked — unlock to turn');
export const isTurnLocked = (item: Pick<ProjectItem, 'turnLocked'> | undefined): boolean =>
  !!item?.turnLocked;

/** Lock or unlock a piece's turn (ADR-171); the flag is absent when unlocked. The same project when nothing changes. */
export function setTurnLocked(project: Project, id: string, on: boolean): Project {
  const it = project.items.find((i) => i.id === id);
  if (!it || isTurnLocked(it) === on) return project;
  const { turnLocked: _l, ...rest } = it;
  void _l;
  const next: ProjectItem = on ? { ...rest, turnLocked: true } : rest;
  return { ...project, items: project.items.map((i) => (i.id === id ? next : i)) };
}

/**
 * Why the pieces `ids` may not turn (ADR-171), or null: one of them, or a piece carried by one of them, has its turn
 * locked. The reason names the piece. A placement lock (ADR-095) is `moveBlocked`'s.
 */
export function turnBlocked(project: Project, ids: readonly string[]): string | null {
  const turning = new Set(ids);
  const own =
    project.items.find((it) => turning.has(it.id) && it.turnLocked) ??
    carriedBy(project, ids, (it) => !!it.turnLocked).find((it) => it.turnLocked);
  if (!own) return null;
  return t('{name} has its turn locked — unlock it to turn it.', {
    name: pieceName(project, own.id),
  });
}

/** What a move helper did: the project after it, or the same project and why nothing moved (ADR-095). */
export interface MoveResult {
  project: Project;
  reason?: string;
}

/** A piece's name, with its number in the project when another piece has the same name. */
export function pieceName(project: Project, id: string): string {
  const i = project.items.findIndex((x) => x.id === id);
  const name = project.items[i]?.design.name ?? '';
  return project.items.some((x) => x.id !== id && x.design.name === name)
    ? t('{name} (piece {n})', { name, n: i + 1 })
    : name;
}

/** The pieces placed directly on each piece (ADR-031), by base id. */
function piecesOn(project: Project): Map<string, ProjectItem[]> {
  const on = new Map<string, ProjectItem[]>();
  for (const it of project.items)
    if (it.placement?.kind === 'above') {
      const list = on.get(it.placement.baseId);
      if (list) list.push(it);
      else on.set(it.placement.baseId, [it]);
    }
  return on;
}

/**
 * Pieces resting on any of `ids`, directly or on each other (ADR-031): they follow them when they move. Each piece once,
 * none of `ids` themselves; `stop` ends the walk early at the first piece it accepts (returned last).
 */
export function carriedBy(
  project: Project,
  ids: string | readonly string[],
  stop?: (it: ProjectItem, base: string) => boolean,
): ProjectItem[] {
  const roots = typeof ids === 'string' ? [ids] : ids;
  const on = piecesOn(project);
  const seen = new Set(roots);
  const out: ProjectItem[] = [];
  const todo = roots.map((id) => ({ id, root: id }));
  for (let next = todo.shift(); next; next = todo.shift())
    for (const c of on.get(next.id) ?? []) {
      if (seen.has(c.id)) continue;
      seen.add(c.id);
      out.push(c);
      if (stop?.(c, next.root)) return out;
      todo.push({ id: c.id, root: next.root });
    }
  return out;
}

/**
 * Why moving or turning the pieces `ids` is refused (ADR-095), or null: one of them is locked, or a locked piece rests
 * on one of them and would follow it. The reason names the locked piece.
 */
export function moveBlocked(project: Project, ids: readonly string[]): string | null {
  const moving = new Set(ids);
  const own = project.items.find((it) => moving.has(it.id) && it.locked);
  if (own)
    return t('{name} is locked — unlock it to move it.', { name: pieceName(project, own.id) });
  let base = '';
  const found = carriedBy(project, ids, (it, root) => {
    base = root;
    return !!it.locked;
  }).at(-1);
  if (!found?.locked) return null;
  const b = pieceName(project, base);
  return t('{name} sits on {base} and is locked — unlock it to move {base}.', {
    name: pieceName(project, found.id),
    base: b,
  });
}

/**
 * Move piece `id` on the plan by a drag or an arrow key (ADR-065): rounded to `step`, lifted off a base. A locked
 * piece, or one carrying a locked piece, stays where it is and the reason comes back (ADR-095). The same project comes
 * back when nothing would move.
 */
export function moveBy(
  project: Project,
  id: string,
  dxMm: number,
  dzMm: number,
  step: Mm = DRAG_STEP,
): MoveResult {
  const it = project.items.find((i) => i.id === id);
  if (!it) return { project };
  const position = dragPosition(it, dxMm, dzMm, step);
  if (position.x === it.position.x && position.z === it.position.z) return { project };
  const reason = moveBlocked(project, [id]);
  if (reason) return { project, reason };
  const placement = liftOff(it);
  const { placement: _old, ...rest } = it;
  void _old;
  const moved: ProjectItem = { ...rest, position, ...(placement ? { placement } : {}) };
  return { project: { ...project, items: project.items.map((i) => (i.id === id ? moved : i)) } };
}

/** Lock or unlock a piece's placement (ADR-095); the flag is absent when unlocked. */
export function setLocked(project: Project, id: string, on: boolean): Project {
  const it = project.items.find((i) => i.id === id);
  if (!it || isLocked(it) === on) return project;
  const { locked: _l, ...rest } = it;
  void _l;
  const next: ProjectItem = on ? { ...rest, locked: true } : rest;
  return { ...project, items: project.items.map((i) => (i.id === id ? next : i)) };
}

/**
 * Keep a piece as it is although its template has revision `revision` (ADR-096 "Keep mine"): the notice stays hidden
 * until the template moves past it. Nothing about the piece itself changes.
 */
export function keepTemplate(project: Project, id: string, revision: number): Project {
  const it = project.items.find((i) => i.id === id);
  if (!it || !Number.isSafeInteger(revision) || revision < 1 || it.templateSeen === revision)
    return project;
  return {
    ...project,
    items: project.items.map((i) => (i.id === id ? { ...i, templateSeen: revision } : i)),
  };
}

/**
 * Link a piece to the catalog template it was saved as (ADR-107): its design's `catalog.origin` becomes `origin`; the
 * rest of the piece is unchanged. A "Keep mine" mark for an earlier origin no longer applies and goes.
 */
export function linkItemOrigin(
  project: Project,
  id: string,
  origin: NonNullable<CatalogMeta['origin']>,
): Project {
  if (!project.items.some((i) => i.id === id)) return project;
  return {
    ...project,
    items: project.items.map((i) => {
      if (i.id !== id) return i;
      const { templateSeen: _seen, ...rest } = i;
      void _seen;
      return { ...rest, design: { ...i.design, catalog: { ...i.design.catalog, origin } } };
    }),
  };
}

/** Remove a piece; pieces that sat on it stay where they are (their placement becomes free). */
export function removeProjectItem(project: Project, id: string): Project {
  const items = project.items
    .filter((i) => i.id !== id)
    .map((i) => {
      if (i.placement?.kind !== 'above' || i.placement.baseId !== id) return i;
      const { placement: _gone, ...rest } = i;
      void _gone;
      return rest;
    });
  // Run parts asked for over this piece (ADR-075) follow the pieces that are left.
  const runRequests = project.runRequests
    ?.map((r) => ({ ...r, from: r.from.filter((x) => x !== id) }))
    .filter((r) => r.from.length);
  return pruneShared(
    pruneConnections(
      pruneCommon(pruneGroups({ ...project, items, ...(runRequests ? { runRequests } : {}) })),
    ),
  );
}

/** Placement problems: a missing base, a piece resting on itself, a piece in the air that is not built to hang. */
export function placementIssues(project: Project): Diagnostic[] {
  const out: Diagnostic[] = [];
  const byId = new Map(project.items.map((i) => [i.id, i]));
  for (const it of project.items) {
    const pl = it.placement;
    const name = it.design.name;
    if (pl?.kind === 'above') {
      const base = byId.get(pl.baseId);
      if (!base)
        out.push({
          severity: 'warning',
          code: 'placement-base-missing',
          message: t(
            '{name} was placed on a piece that is no longer in the project; it stays where it is.',
            { name },
          ),
          nodeId: it.id,
        });
      else if (!placementBases(project, it.id).some((b) => b.id === base.id))
        out.push({
          severity: 'error',
          code: 'placement-cycle',
          message: t('{name} and {other} are placed on each other.', {
            name,
            other: base.design.name,
          }),
          nodeId: it.id,
        });
    }
    const hangs = pl?.kind === 'wall' ? pl.height > 0 : pl?.kind === 'above' ? pl.gap > 0 : false;
    if (hangs && !isWallHung(it.design))
      out.push({
        severity: 'warning',
        code: 'placement-not-hung',
        message: t(
          '{name} is off the floor with nothing under it; set it to hang on wall brackets (Whole cabinet → Stands on).',
          { name },
        ),
        nodeId: it.id,
      });
    if (pl?.kind === 'floor' && isWallHung(it.design))
      out.push({
        severity: 'warning',
        code: 'placement-wall-on-floor',
        message: t('{name} is built to hang on the wall but is placed on the floor.', { name }),
        nodeId: it.id,
      });
  }
  // A model placed on a piece that is gone keeps its place (ADR-208).
  for (const m of project.models ?? [])
    if (m.placement?.kind === 'above' && !byId.has(m.placement.baseId))
      out.push({
        severity: 'warning',
        code: 'placement-base-missing',
        message: t(
          '{name} was placed on a piece that is no longer in the project; it stays where it is.',
          { name: m.name },
        ),
        nodeId: m.id,
      });
  return out;
}

// ---------------------------------------------------------------------------
// Quarter-turn placement
// ---------------------------------------------------------------------------

const ROT_FACE: Record<QuarterTurn, Record<Face, Face>> = {
  0: { '+x': '+x', '-x': '-x', '+y': '+y', '-y': '-y', '+z': '+z', '-z': '-z' },
  90: { '+z': '+x', '-z': '-x', '+x': '-z', '-x': '+z', '+y': '+y', '-y': '-y' },
  180: { '+x': '-x', '-x': '+x', '+z': '-z', '-z': '+z', '+y': '+y', '-y': '-y' },
  270: { '+z': '-x', '-z': '+x', '+x': '+z', '-x': '-z', '+y': '+y', '-y': '-y' },
};

/** Rotate a box about the origin (no translation): exact in integers. */
export function rotateBox(b: Box, r: QuarterTurn): Box {
  switch (r) {
    case 0:
      return b;
    case 90:
      return { x: b.z, y: b.y, z: -(b.x + b.w), w: b.d, h: b.h, d: b.w };
    case 180:
      return { x: -(b.x + b.w), y: b.y, z: -(b.z + b.d), w: b.w, h: b.h, d: b.d };
    case 270:
      return { x: -(b.z + b.d), y: b.y, z: b.x, w: b.d, h: b.h, d: b.w };
  }
}

const FACING: Record<QuarterTurn, PlacedPiece['facing']> = {
  0: { axis: 'z', sign: 1 },
  90: { axis: 'x', sign: 1 },
  180: { axis: 'z', sign: -1 },
  270: { axis: 'x', sign: -1 },
};

const swap = (a: Panel['thicknessAxis'], r: QuarterTurn) =>
  r % 180 === 0 ? a : a === 'x' ? 'z' : a === 'z' ? 'x' : 'y';

export interface PlacedPiece {
  item: ProjectItem;
  model: FurnitureModel;
  panels: Panel[];
  bounds: Box;
  /** Space its doors, drawers and flaps need to open, in room coordinates (ADR-057). */
  clearances: Clearance[];
  /** The room axis and sign the piece's front faces: its clearances grow that way. */
  facing: { axis: 'x' | 'z'; sign: 1 | -1 };
  /** Chair, installation and service envelopes in room coordinates (ADR-073). */
  envelopes: Envelope[];
  /** Its own tops (bottoms) a common top (bottom) replaces (ADR-165), in room coordinates; absent = none. */
  removed?: Panel[];
  /** The whole piece as one box, turned when the piece is typed at an angle (ADR-121); `bounds` encloses it. */
  outline: Box;
  /** Its floor outline: four corners (x, z) in order, turned with the piece (ADR-121). */
  footprint: [number, number][];
  /** The front edge on the floor, x1 z1 x2 z2 (ADR-121). */
  front: [number, number, number, number];
  /** The pipes and outlets its back is cut around (ADR-205), feature ids; absent = none. */
  backCut?: string[];
}

/** Which corners of `footprintOf` (back-left, back-right, front-right, front-left when unturned) carry the front. */
const FRONT_CORNERS: Record<QuarterTurn, [number, number]> = {
  0: [3, 2],
  90: [1, 2],
  180: [0, 1],
  270: [0, 3],
};

/**
 * A room point (mm) back in the piece's own coordinates, undoing its quarter turn and position as `placeItem` applies
 * them (ADR-083: a tap in the project selects the space under it).
 */
export function roomToPiece(
  item: ProjectItem,
  pt: { x: Mm; y: Mm; z: Mm },
): { x: Mm; y: Mm; z: Mm } {
  const built = buildModel(item.design);
  const r = item.rotationY;
  const rb = union(built.panels.map((p) => rotateBox(aabbOf(p), r)));
  // An angled piece (ADR-121): turn the point back about the piece's centre first.
  const yaw = yawOf(item, rb);
  if (yaw) {
    const [x, z] = yawPoint({ ...yaw, deg: -yaw.deg }, pt.x, pt.z);
    pt = { x, y: pt.y, z };
  }
  const back = rotateBox(
    {
      x: pt.x - item.position.x + rb.x,
      y: pt.y - item.position.y + rb.y,
      z: pt.z - item.position.z + rb.z,
      w: 0,
      h: 0,
      d: 0,
    },
    ((360 - r) % 360) as QuarterTurn,
  );
  return { x: back.x, y: back.y, z: back.z };
}

/** Build one item and move its panels into the room. Panel and node ids are prefixed with the item id. */
/**
 * A box in the piece's own mm (a selected space, ADR-088) placed in the room like the piece's panels: turned and moved
 * the same way as `placeItem` does. `built` is the piece's model (`buildModel(item.design)`).
 */
export function pieceBoxToRoom(item: ProjectItem, built: FurnitureModel, box: Box): Box {
  const r = item.rotationY;
  const rb = union(built.panels.map((p) => rotateBox(aabbOf(p), r)));
  const t = rotateBox(box, r);
  return withYaw(item, rb, {
    ...t,
    x: t.x + item.position.x - rb.x,
    y: t.y + item.position.y - rb.y,
    z: t.z + item.position.z - rb.z,
  });
}

/** The yaw of an angled piece (ADR-121): about the centre of its quarter-turned outline `rb` placed at `position`. */
export function yawOf(item: ProjectItem, rb: Pick<Box, 'w' | 'd'>): Yaw | undefined {
  return item.angle
    ? { deg: item.angle, cx: item.position.x + rb.w / 2, cz: item.position.z + rb.d / 2 }
    : undefined;
}

const withYaw = (item: ProjectItem, rb: Pick<Box, 'w' | 'd'>, b: Box): Box => {
  const yaw = yawOf(item, rb);
  return yaw ? { ...b, yaw } : b;
};

export function placeItem(
  item: ProjectItem,
  opts?: {
    noPlinth?: boolean;
    common?: CommonBuild;
    shared?: SharedBuild;
    sharedPins?: PinRows[];
    /** The room, for backs cut around its pipes and outlets (ADR-205). */
    room?: Room;
  },
): PlacedPiece {
  const c = opts?.common;
  // In a common top or bottom (ADR-165) the piece is built with its top over (bottom under) the sides; sharing a
  // side (ADR-190) it leaves its right side out and its left side carries the neighbour's pin rows.
  const raw = buildModel(
    sharedDesign(c ? commonDesign(item.design, c) : item.design, opts?.shared),
  );
  const pinned = opts?.sharedPins?.length
    ? { ...raw, panels: withSharedPins(raw.panels, opts.sharedPins) }
    : raw;
  // A back cut around a pipe or outlet (ADR-205) is a profiled part, turned with the piece below.
  const cuts = item.backCuts?.length
    ? backCutsOf(
        item,
        pinned.panels,
        opts?.shared?.right ? buildModel(item.design).panels : pinned.panels,
        opts?.room,
      )
    : { shapes: new Map<string, PanelShape>(), features: [] };
  const built = cuts.shapes.size
    ? {
        ...pinned,
        panels: pinned.panels.map((p) =>
          cuts.shapes.has(p.id) ? { ...p, shape: cuts.shapes.get(p.id) } : p,
        ),
      }
    : pinned;
  // A run plinth replaces the piece's own plinth (ADR-054); a common top or bottom replaces its own (ADR-165).
  const leaves = (p: Panel) =>
    (!!opts?.noPlinth && p.role === 'plinth') ||
    (!!c?.top && p.role === commonTopRole(item.design)) ||
    (!!c?.bottom && p.role === 'bottom');
  const model = built.panels.some(leaves)
    ? { ...built, panels: built.panels.filter((p) => !leaves(p)) }
    : built;
  const r = item.rotationY;
  const left = model === built ? [] : built.panels.filter((p) => leaves(p) && p.role !== 'plinth');
  const rotated = [...model.panels, ...left].map((p) => rotateBox(p.box, r));
  // The piece is placed by its full outline, so leaving the plinth out does not move it.
  // Sharing a side (ADR-190) a front reaches over half the neighbour's side; the piece keeps its own outline.
  const own = opts?.shared?.right ? buildModel(item.design).panels : built.panels;
  const rb = union(own.map((p) => rotateBox(aabbOf(p), r)));
  const dx = item.position.x - rb.x,
    dy = item.position.y - rb.y,
    dz = item.position.z - rb.z;
  const all = [...model.panels, ...left].map((p, i): Panel => ({
    ...p,
    id: `${item.id}:${p.id}`,
    nodeId: `${item.id}:${p.nodeId}`,
    box: withYaw(item, rb, {
      ...rotated[i],
      x: rotated[i].x + dx,
      y: rotated[i].y + dy,
      z: rotated[i].z + dz,
    }),
    thicknessAxis: swap(p.thicknessAxis, r),
    grainAxis: swap(p.grainAxis, r),
    banded: p.banded.map((f) => ROT_FACE[r][f]),
    ...(p.pinRows ? { pinRows: p.pinRows.map((x) => ({ ...x, face: ROT_FACE[r][x.face] })) } : {}),
    ...(p.shape
      ? {
          shape: turnShape(
            p.shape,
            p.box,
            rotated[i],
            p.thicknessAxis,
            swap(p.thicknessAxis, r),
            r,
          ),
        }
      : {}),
  }));
  const panels = all.slice(0, model.panels.length);
  const full = { x: rb.x + dx, y: rb.y + dy, z: rb.z + dz, w: rb.w, h: rb.h, d: rb.d };
  const clearances = localClearances(model).map((c) => {
    const rc = rotateBox(c.box, r);
    return {
      ...c,
      panelId: `${item.id}:${c.panelId}`,
      box: withYaw(item, rb, { ...rc, x: rc.x + dx, y: rc.y + dy, z: rc.z + dz }),
    };
  });
  const facing = FACING[r];
  // Tipped up in place from lying on its back: stands on the floor, not hung and not set on another piece (ADR-073).
  const standsUp =
    item.position.y === 0 && item.placement?.kind !== 'above' && !isWallHung(item.design);
  const envelopes = envelopesOf(item.design, item.zones, standsUp, built).map((e) => {
    const rc = rotateBox(e.box, r);
    return { ...e, box: withYaw(item, rb, { ...rc, x: rc.x + dx, y: rc.y + dy, z: rc.z + dz }) };
  });
  // The outline on the floor and the front edge, turned with the piece (ADR-121), for the plan and room checks.
  const outline = withYaw(item, rb, full);
  const corners = footprintOf(outline);
  const [f1, f2] = FRONT_CORNERS[r];
  return {
    item,
    model,
    panels,
    bounds:
      model === built && !opts?.shared?.right ? union(panels.map(aabbOf)) : enclosing(outline),
    clearances,
    facing,
    envelopes,
    outline,
    footprint: corners,
    front: [...corners[f1], ...corners[f2]] as [number, number, number, number],
    ...(left.length ? { removed: all.slice(model.panels.length) } : {}),
    ...(cuts.features.length ? { backCut: cuts.features } : {}),
  };
}

// ---------------------------------------------------------------------------
// Backs cut around a pipe or outlet (ADR-205)
// ---------------------------------------------------------------------------

/**
 * A board's outline with rectangular cut-outs taken away (ADR-205), in whole mm on its face (`w` × `h`): the outline
 * and the holes left, or null when nothing or more than one piece is left (the cut-outs would split it). A cut-out that
 * reaches an edge makes a notch in the outline; one inside the board makes a hole.
 */
export function cutOutline(
  w: Mm,
  h: Mm,
  rects: { u: Mm; v: Mm; w: Mm; h: Mm }[],
): { points: [Mm, Mm][]; holes: [Mm, Mm][][] } | null {
  const xs = [...new Set([0, w, ...rects.flatMap((r) => [r.u, r.u + r.w])])].sort((a, b) => a - b);
  const ys = [...new Set([0, h, ...rects.flatMap((r) => [r.v, r.v + r.h])])].sort((a, b) => a - b);
  const solid = (i: number, j: number) => {
    if (i < 0 || j < 0 || i >= xs.length - 1 || j >= ys.length - 1) return false;
    const cx = (xs[i] + xs[i + 1]) / 2,
      cy = (ys[j] + ys[j + 1]) / 2;
    return !rects.some((r) => cx > r.u && cx < r.u + r.w && cy > r.v && cy < r.v + r.h);
  };
  // The boundary as directed edges, the solid on their left (counter-clockwise outside, clockwise round holes).
  const next = new Map<string, [Mm, Mm][]>();
  const key = (p: [Mm, Mm]) => `${p[0]},${p[1]}`;
  const edge = (a: [Mm, Mm], b: [Mm, Mm]) => {
    const list = next.get(key(a));
    if (list) list.push(b);
    else next.set(key(a), [b]);
  };
  for (let i = 0; i < xs.length - 1; i++)
    for (let j = 0; j < ys.length - 1; j++) {
      if (!solid(i, j)) continue;
      const [x0, x1, y0, y1] = [xs[i], xs[i + 1], ys[j], ys[j + 1]];
      if (!solid(i, j - 1)) edge([x0, y0], [x1, y0]);
      if (!solid(i + 1, j)) edge([x1, y0], [x1, y1]);
      if (!solid(i, j + 1)) edge([x1, y1], [x0, y1]);
      if (!solid(i - 1, j)) edge([x0, y1], [x0, y0]);
    }
  const loops: [Mm, Mm][][] = [];
  for (const [start] of next) {
    while (next.get(start)?.length) {
      const loop: [Mm, Mm][] = [];
      let at = start;
      for (let guard = 0; guard < 10000; guard++) {
        const outs = next.get(at);
        if (!outs?.length) break;
        const to = outs.shift()!;
        loop.push(at.split(',').map(Number) as [Mm, Mm]);
        at = key(to);
        if (at === start) break;
      }
      // Corners only: points in a straight line between their neighbours are left out.
      const pts = loop.filter((p, k) => {
        const a = loop[(k - 1 + loop.length) % loop.length],
          b = loop[(k + 1) % loop.length];
        return (p[0] - a[0]) * (b[1] - p[1]) - (p[1] - a[1]) * (b[0] - p[0]) !== 0;
      });
      if (pts.length >= 3) loops.push(pts);
    }
  }
  const outer = loops.filter((l) => area2(l) > 0);
  if (outer.length !== 1) return null;
  return { points: outer[0], holes: loops.filter((l) => area2(l) < 0) };
}

/**
 * The backs of a piece cut around the pipes and outlets the user asked for (`backCuts`, ADR-205), by panel id in the
 * piece's own coordinates: a profile with a cut-out exactly the size of the zone typed in the room (no clearance
 * added), a notch where the zone reaches an edge of the back, otherwise a hole. `panels` are the piece's built parts and
 * `own` the parts its outline is placed by (as `placeItem`). A piece typed at an angle is not cut (the repair says why);
 * neither is a back already shaped, nor one the cut-outs would split. `features`: the pipes and outlets cut round.
 */
export function backCutsOf(
  item: ProjectItem,
  panels: Panel[],
  own: Panel[],
  room: Room | undefined,
): { shapes: Map<string, PanelShape>; features: string[] } {
  const shapes = new Map<string, PanelShape>();
  const features: string[] = [];
  if (!item.backCuts?.length || !room || item.angle || !own.length) return { shapes, features };
  const r = item.rotationY;
  const rb = union(own.map((p) => rotateBox(aabbOf(p), r)));
  const [dx, dy, dz] = [item.position.x - rb.x, item.position.y - rb.y, item.position.z - rb.z];
  const undo = ((360 - r) % 360) as QuarterTurn;
  const rects = new Map<string, { u: Mm; v: Mm; w: Mm; h: Mm }[]>();
  const by = new Map<string, string[]>();
  const lo = (b: Box, a: Axis) => (a === 'x' ? b.x : a === 'y' ? b.y : b.z);
  for (const fid of item.backCuts) {
    const f = room.features.find((x) => x.id === fid && isService(x.kind));
    const zone = f ? featureBox(room, f) : null;
    if (!zone) continue;
    const local = rotateBox({ ...zone, x: zone.x - dx, y: zone.y - dy, z: zone.z - dz }, undo);
    for (const p of panels) {
      if (p.role !== 'back' || p.shape || !overlaps(p.box, local)) continue;
      const [ua, va] = inPlaneAxes(p.thicknessAxis);
      const W = sizeOn(p.box, ua),
        H = sizeOn(p.box, va);
      const u0 = Math.max(0, lo(local, ua) - lo(p.box, ua)),
        u1 = Math.min(W, lo(local, ua) + sizeOn(local, ua) - lo(p.box, ua));
      const v0 = Math.max(0, lo(local, va) - lo(p.box, va)),
        v1 = Math.min(H, lo(local, va) + sizeOn(local, va) - lo(p.box, va));
      if (u1 <= u0 || v1 <= v0) continue;
      rects.set(p.id, [...(rects.get(p.id) ?? []), { u: u0, v: v0, w: u1 - u0, h: v1 - v0 }]);
      by.set(p.id, [...(by.get(p.id) ?? []), fid]);
    }
  }
  for (const p of panels) {
    const list = rects.get(p.id);
    if (!list) continue;
    const [ua, va] = inPlaneAxes(p.thicknessAxis);
    const cut = cutOutline(sizeOn(p.box, ua), sizeOn(p.box, va), list);
    if (!cut) continue;
    shapes.set(p.id, {
      kind: 'profile',
      points: cut.points,
      ...(cut.holes.length ? { holes: cut.holes } : {}),
      cutouts: list,
    });
    for (const fid of by.get(p.id)!) if (!features.includes(fid)) features.push(fid);
  }
  return { shapes, features };
}

export const placedBounds = (item: ProjectItem): Box => placeItem(item).bounds;

/**
 * The piece as one box before its extra angle (ADR-121): `position` is its lowest corner and it shares its centre with
 * `placedBounds`. The same box as `placedBounds` for a piece at a quarter turn.
 */
export function placedOutline(item: ProjectItem): Box {
  const { yaw: _yaw, ...flat } = placeItem(item).outline;
  void _yaw;
  return flat;
}

// ---------------------------------------------------------------------------
// The whole room
// ---------------------------------------------------------------------------

/** Materials of all pieces merged by name + thickness + grain (grained and plain boards never share a sheet). */
/** Boards with the same name, thickness and grain are one board; a picture (ADR-048) makes a different decor. */
export const materialKey = (m: Pick<Material, 'name' | 'thickness' | 'grain' | 'image'>) =>
  `mat:${m.name}|${m.thickness}|${m.grain ? 'grain' : 'plain'}${m.image ? `|img:${m.image.id}` : ''}`;

export interface ProjectModel {
  pieces: PlacedPiece[];
  /** All panels in room coordinates, material ids replaced by merged material keys. */
  model: FurnitureModel;
  /** The same panels grouped by piece, in item order (the exploded view spreads each piece on its own). */
  piecePanels: Panel[][];
  materials: Material[];
  diagnostics: Diagnostic[];
  /** Clearances that hit something (ADR-057), for the plan outline of the selected piece. */
  blocked: { itemId: string; box: Box }[];
  /** Display-only 3D models with the box each takes in the room (ADR-076). */
  models: { item: ModelItem; box: Box }[];
  /** Everything drawn: the panels and the model boxes (`model.bounds` stays the panels only, for parts and prints). */
  extent: Box;
  /** Every body, opening, chair and service zone with its worst problem, for the plan's Clearances overlay (ADR-073). */
  zones: ClearanceZone[];
}

/**
 * ADR-077: a run part is cut from a board of the pieces; it takes the band named on that board now, since its
 * stored copy of the board may predate the band. Boards no piece uses keep the copy's band.
 */
function runMaterial(project: Project, m: Material): Material {
  const k = materialKey(m);
  for (const it of project.items)
    for (const pm of it.design.materials)
      if (materialKey(pm) === k) return { ...m, band: pm.band, frontBand: pm.frontBand };
  return m;
}

export function buildProjectModel(input: Project): ProjectModel {
  // Run handles reach the pieces' fronts when built (ADR-125).
  const project = applyRunHandles(resolvePlacements(input));
  const covered = plinthCovered(project);
  // Common tops and bottoms (ADR-165) and shared sides (ADR-190): how each member is built, and the links that no
  // longer fit.
  const common = commonBuilds(project);
  const shared = sharedBuilds(project);
  const pieces = project.items.map((i) =>
    placeItem(i, {
      noPlinth: covered.has(i.id),
      common: common.builds.get(i.id),
      shared: shared.builds.get(i.id),
      sharedPins: shared.pins.get(i.id),
      room: project.room,
    }),
  );
  const materials = new Map<string, Material>();
  const panels: Panel[] = [];
  const piecePanels: Panel[][] = [];
  const hardware: HardwareItem[] = [];
  // Variables and bindings with problems (ADR-166, ADR-008), checked apart from the generators; common tops and
  // bottoms that are not built (ADR-165); connections that no longer hold (ADR-168).
  const diagnostics: Diagnostic[] = [
    ...placementIssues(project),
    ...variableDiagnostics(project),
    ...common.diagnostics,
    ...shared.diagnostics,
    ...connectionDiagnostics(project, pieces),
  ];
  for (const pc of pieces) {
    const mats = new Map(pc.item.design.materials.map((m) => [m.id, m]));
    for (const m of pc.item.design.materials) {
      const k = materialKey(m),
        seen = materials.get(k);
      if (!seen) {
        materials.set(k, { ...m, id: k, sheet: sheetOf(m) });
        continue;
      }
      const a = seen.sheet!,
        b = sheetOf(m);
      if (
        a.length !== b.length ||
        a.width !== b.width ||
        a.trim !== b.trim ||
        a.count !== b.count
      ) {
        diagnostics.push({
          severity: 'warning',
          code: 'material-sheet-conflict',
          message: t(
            "{board} has different sheet settings in {name}; the first piece's sheet ({l} × {w}) is used for the whole project.",
            { board: m.name, name: pc.item.design.name, l: a.length, w: a.width },
          ),
          nodeId: pc.item.id,
        });
      }
    }
    const own = pc.panels.map((p) => {
      const m = mats.get(p.materialId);
      return { ...p, materialId: m ? materialKey(m) : p.materialId };
    });
    piecePanels.push(own);
    panels.push(...own);
    for (const h of pc.model.hardware)
      hardware.push({
        ...h,
        nodeId: `${pc.item.id}:${h.nodeId}`,
        quantity: h.quantity * pc.item.quantity,
      });
    const errs = pc.model.diagnostics.filter((d) => d.severity === 'error').length;
    if (errs)
      diagnostics.push({
        severity: 'error',
        code: 'piece-errors',
        message: t('{name} has {n|# problem|# problems}; open it to fix.', {
          name: pc.item.design.name,
          n: errs,
        }),
        nodeId: pc.item.id,
      });
  }
  // One panel per common top or bottom, on the leftmost member's board (ADR-165).
  const byItem = new Map(pieces.map((pc) => [pc.item.id, pc]));
  for (const cp of commonPanels(
    project,
    common.plans,
    new Map(pieces.filter((pc) => pc.removed).map((pc) => [pc.item.id, pc.removed!])),
    (itemId, materialId) => {
      const m = byItem.get(itemId)?.item.design.materials.find((x) => x.id === materialId);
      return m ? materialKey(m) : materialId;
    },
  )) {
    panels.push(cp);
    piecePanels.push([cp]);
  }
  // Pieces may touch but not occupy the same space (bounding boxes first, then panels).
  const overlapping = new Set<string>();
  for (let a = 0; a < pieces.length; a++)
    for (let b = a + 1; b < pieces.length; b++) {
      if (!overlaps(pieces[a].bounds, pieces[b].bounds)) continue;
      const hit = pieces[a].panels.find((p) => pieces[b].panels.some((q) => panelsOverlap(p, q)));
      if (hit) overlapping.add(pieces[a].item.id).add(pieces[b].item.id);
      if (hit) {
        // Where and how much (ADR-071): the shared part of their outlines, and its thinnest side (the shortest way out).
        // Pieces at an angle are measured on their turned outlines (ADR-205: separating-axis penetration, rounded up).
        const box = intersection(pieces[a].bounds, pieces[b].bounds);
        const amount =
          pieces[a].outline.yaw || pieces[b].outline.yaw
            ? Math.max(1, penetration(pieces[a].outline, pieces[b].outline))
            : Math.min(box.w, box.h, box.d);
        diagnostics.push({
          severity: 'error',
          code: 'pieces-overlap',
          message: t('{a} and {b} overlap by {amount} mm in the room.', {
            a: pieces[a].item.design.name,
            b: pieces[b].item.design.name,
            amount,
          }),
          nodeId: pieces[b].item.id,
          itemIds: [pieces[a].item.id, pieces[b].item.id],
          box,
          amount,
        });
      }
    }
  // Compatibility rules over pieces that touch side by side (ADR-100): warnings, never blocking.
  diagnostics.push(...compatChecks(pieces, project.runParts ?? []));
  for (const pc of pieces)
    if (pc.bounds.y < 0)
      diagnostics.push({
        severity: 'error',
        code: 'below-floor',
        message: t('{name} goes below the floor.', { name: pc.item.design.name }),
        nodeId: pc.item.id,
      });
  // Run parts (ADR-036): their own panels, checked against every piece like pieces are against each other.
  const placedById = new Map(pieces.map((pc) => [pc.item.id, pc]));
  // Worktops meeting at a corner, with the joint the user chose (ADR-205).
  const joints = worktopJointCuts(project);
  for (const rp of project.runParts ?? []) {
    // Made for pieces that are gone, or a run plinth no longer as long as its pieces (refresh off, ADR-061).
    const src = (rp.from ?? []).map((id) => placedById.get(id));
    const stale =
      src.some((pc) => !pc) ||
      (rp.kind === 'plinth' &&
        src.length > 0 &&
        (Math.min(...src.map((pc) => pc!.bounds.x)) !== rp.box.x ||
          Math.max(...src.map((pc) => pc!.bounds.x + pc!.bounds.w)) !== rp.box.x + rp.box.w));
    if (stale)
      diagnostics.push({
        severity: 'error',
        code: 'run-part-stale',
        message: t(
          '{part} was made for pieces that changed or were removed; suggest the run parts again.',
          { part: rp.label },
        ),
        nodeId: `run:${rp.id}`,
      });
    const k = materialKey(rp.material);
    if (!materials.has(k)) materials.set(k, { ...rp.material, id: k, sheet: sheetOf(rp.material) });
    const panel = runPanel(rp, k, joints.get(rp.id));
    // ADR-077: a band narrower than the run part's board is an error, as on a piece's own parts.
    const band = panel.banded.length
      ? bandFor(runMaterial(project, rp.material), panel.role)
      : undefined;
    const th = cutDimensions(panel, rp.material.grain).thickness;
    if (band && band.width < th)
      diagnostics.push({
        severity: 'error',
        code: 'band-narrow',
        message: t('Edge band {band} on {board} ({part}) is narrower than the {t} mm board.', {
          band: bandText(band),
          board: rp.material.name,
          part: rp.label,
          t: th,
        }),
        nodeId: `run:${rp.id}`,
      });
    panels.push(panel);
    piecePanels.push([panel]);
    const hit = pieces.find(
      (pc) => overlaps(pc.bounds, panel.box) && pc.panels.some((q) => overlapsBox(q, panel.box)),
    );
    if (hit)
      diagnostics.push({
        severity: 'error',
        code: 'run-part-overlap',
        message: t('{part} overlaps {name}; suggest the run parts again after moving pieces.', {
          part: rp.label,
          name: hit.item.design.name,
        }),
        nodeId: `run:${rp.id}`,
      });
  }
  diagnostics.push(
    ...cutoutChecks(project, placedById, 'sink'),
    ...cutoutChecks(project, placedById, 'hob'),
    ...worktopJointChecks(project),
  );
  // Run parts the user asked for that could not be made (ADR-075): an error, never left out silently (ADR-008).
  const made = new Set((project.runParts ?? []).map((rp) => rp.key));
  const missing = (project.runRequests ?? []).filter((r) => !made.has(requestKey(r)));
  if (missing.length) {
    const { unmade } = planRuns(project);
    for (const r of missing) {
      diagnostics.push({
        severity: 'error',
        code: 'run-request',
        message:
          unmade[requestKey(r)] ??
          t('{part} is not made yet; suggest the run parts again.', {
            part: requestName(r, project),
          }),
        nodeId: `request:${requestKey(r)}`,
      });
    }
  }
  // Display-only 3D models (ADR-076): their boxes are checked like pieces, never cut.
  const models = (project.models ?? []).map((item) => ({ item, box: modelBox(item) }));
  const checked = pieces.map((pc) => ({
    id: pc.item.id,
    name: pc.item.design.name,
    bounds: pc.bounds,
    outline: pc.outline,
    hitsPanels: (b: Box) => pc.panels.some((q) => overlapsBox(q, b)),
    // A back cut around this pipe or outlet (ADR-205) no longer covers it.
    covers: (b: Box, featureId?: string) =>
      pc.panels.find(
        (q) =>
          COVER_ROLES.has(q.role) &&
          !(q.role === 'back' && !!featureId && !!pc.backCut?.includes(featureId)) &&
          overlapsBox(q, b),
      )?.role ?? null,
    clearances: pc.clearances,
  }));
  // Run parts (worktop, plinth, fillers, covers) are checked against models too.
  const runChecked = panels
    .filter((p) => p.id.startsWith('run:'))
    .map((p) => ({
      id: p.id,
      name: p.label,
      bounds: aabbOf(p),
      hitsPanels: (b: Box) => overlapsBox(p, b),
    }));
  diagnostics.push(...modelChecks(project.models ?? [], [...checked, ...runChecked]));
  const asPieces = models.map((m) => ({
    id: m.item.id,
    name: m.item.name,
    bounds: m.box,
    hitsPanels: (b: Box) => overlaps(m.box, b),
    clearances: [],
  }));
  // The room (ADR-058): walls, obstacles, door swings and windows; obstacles also block openings (ADR-057). A value
  // set's pieces are checked against the room at the set's origin (ADR-167).
  const setOf = new Map(project.items.map((i) => [i.id, i.set?.id ?? '']));
  const rooms = project.room
    ? [
        { id: '', room: project.room },
        ...setRooms(project).map((sr) => ({ id: sr.set.id, room: sr.room })),
      ]
    : [];
  const rcs = rooms.map(({ id, room }) =>
    roomChecks(room, [
      ...checked.filter((c) => (setOf.get(c.id) ?? '') === id),
      ...(id === '' ? asPieces : []),
    ]),
  );
  const rc = rcs.length
    ? {
        diagnostics: rcs.flatMap((r) => r.diagnostics),
        clearanceIssues: rcs.flatMap((r) => r.clearanceIssues),
        obstacles: rcs.flatMap((r) => r.obstacles),
      }
    : null;
  if (rc) diagnostics.push(...rc.diagnostics, ...rc.clearanceIssues);
  // Run worktops and plinths over a pipe or outlet (ADR-072).
  if (project.room && !outlineIssues(project.room.outline).length)
    for (const rp of project.runParts ?? [])
      if (COVER_ROLES.has(rp.kind))
        diagnostics.push(
          ...serviceChecks(project.room, {
            id: `run:${rp.id}`,
            name: rp.label,
            bounds: rp.box,
            covers: (b: Box) => (overlaps(rp.box, b) ? rp.kind : null),
          }),
        );
  const obstacles = [
    ...(rc?.obstacles ?? []),
    ...models.map((m) => ({ label: m.item.name, box: m.box })),
  ];
  // A shaped common top can be concave (an L, ADR-189); doors are checked against its convex pieces instead: the
  // members' own former tops and the gaps it bridges.
  const commonPieces: Panel[] = [
    ...pieces.flatMap((pc) => pc.removed ?? []),
    ...[...common.plans.entries()].flatMap(([id, plan]) =>
      plan.gaps.map((g, i) => {
        const top = panels.find((q) => q.id === `common:${id}`);
        const b = bounds2(g.rect);
        return {
          ...top!,
          id: `common:${id}/gap/${i}`,
          shape: undefined,
          box: { x: b.x, y: top!.box.y, z: b.z, w: b.w, h: top!.box.h, d: b.d },
        };
      }),
    ),
  ];
  const blocked = openingChecks(
    pieces,
    [...panels.filter((q) => !q.id.startsWith('common:')), ...commonPieces],
    diagnostics,
    obstacles,
  );
  const zones = clearanceZones(
    project,
    pieces,
    panels,
    diagnostics,
    blocked,
    overlapping,
    obstacles,
  );
  const model: FurnitureModel = {
    panels,
    spaces: [],
    hardware,
    diagnostics,
    bounds: union(panels.map(aabbOf)),
  };
  return {
    pieces,
    model,
    piecePanels,
    materials: [...materials.values()],
    diagnostics,
    blocked,
    models,
    extent: union([...panels.map(aabbOf), ...models.map((m) => m.box)]),
    zones,
  };
}

// ---------------------------------------------------------------------------
// Chair, installation and service clearances; the Clearances overlay (ADR-073)
// ---------------------------------------------------------------------------

/**
 * Check the chair, installation and service envelopes (adding their diagnostics), then list every zone for the
 * plan overlay with its worst problem: bodies (overlap, room, installation), door swings, drawer travel, flaps
 * (ADR-057 checks), chair and service zones.
 */
function clearanceZones(
  project: Project,
  pieces: PlacedPiece[],
  allPanels: Panel[],
  diagnostics: Diagnostic[],
  blocked: { itemId: string; box: Box }[],
  overlapping: Set<string>,
  obstacles: { label: string; box: Box }[],
): ClearanceZone[] {
  const byId = new Map(project.items.map((i) => [i.id, i]));
  const carried = (id: string) =>
    new Set(
      project.items
        .filter((i) => {
          for (let cur = i, n = 0; n <= project.items.length; n++) {
            if (cur.placement?.kind !== 'above') return false;
            if (cur.placement.baseId === id) return true;
            const next = byId.get(cur.placement.baseId);
            if (!next) return false;
            cur = next;
          }
          return false;
        })
        .map((i) => i.id),
    );
  const ec = envelopeChecks(
    pieces.map((pc) => ({
      id: pc.item.id,
      name: pc.item.design.name,
      bounds: pc.bounds,
      panels: pc.panels,
      envelopes: pc.envelopes,
      zones: pc.item.zones,
      carried: pc.envelopes.some((e) => e.kind === 'installation')
        ? carried(pc.item.id)
        : new Set<string>(),
    })),
    allPanels.filter((p) => p.id.startsWith('run:')),
    obstacles,
    project.room,
  );
  diagnostics.push(...ec.diagnostics);
  const blockedBoxes = new Set(blocked.map((b) => b.box));
  const room = project.room;
  const out: ClearanceZone[] = [];
  for (const pc of pieces) {
    const id = pc.item.id;
    let body: ClearanceZone['severity'] = overlapping.has(id) ? 'error' : 'none';
    for (const d of diagnostics)
      if (d.nodeId === id && BODY_CODES.has(d.code)) body = worse(body, d.severity);
    out.push({
      itemId: id,
      kind: 'body',
      label: pc.item.design.name,
      box: pc.outline,
      severity: body,
    });
    for (const c of pc.clearances) {
      const role = pc.panels.find((p) => p.id === c.panelId)?.role;
      const bad =
        blockedBoxes.has(c.box) ||
        (!!room && !boxInside(room.outline, c.box)) ||
        pieces.some((o) => o !== pc && o.clearances.some((y) => overlaps(c.box, y.box)));
      out.push({
        itemId: id,
        kind: /flap/i.test(c.label) ? 'flap' : role === 'door' ? 'door' : 'drawer',
        label: c.label,
        box: c.box,
        severity: bad ? 'warning' : 'none',
      });
    }
    for (const e of pc.envelopes)
      out.push({
        itemId: id,
        kind: e.kind,
        label: e.label,
        box: e.box,
        severity: ec.severity.get(e) ?? 'none',
        // ADR-205: where it lies before it is tipped up, and the arc its top sweeps, for the plan.
        ...(e.kind === 'installation' ? { tipUp: tipUpOf(pc) } : {}),
      });
  }
  return out;
}

/**
 * Where a piece lies on its back before it is tipped up (ADR-205): the floor strip in front of it, as deep as it is
 * high, and a quarter arc of that radius from its front corner, as a door swing is drawn; turned with the piece.
 */
function tipUpOf(pc: PlacedPiece): NonNullable<ClearanceZone['tipUp']> {
  const o = pc.outline,
    r = o.h;
  const { axis, sign } = pc.facing;
  const strip: Box =
    axis === 'z'
      ? { x: o.x, y: 0, z: sign > 0 ? o.z + o.d : o.z - r, w: o.w, h: 0, d: r }
      : { x: sign > 0 ? o.x + o.w : o.x - r, y: 0, z: o.z, w: r, h: 0, d: o.d };
  // The hinge: the front edge's corner on the piece's left as seen from the front (a door swing's start).
  const hinge: [number, number] =
    axis === 'z'
      ? sign > 0
        ? [o.x, o.z + o.d]
        : [o.x + o.w, o.z]
      : sign > 0
        ? [o.x + o.w, o.z + o.d]
        : [o.x, o.z];
  const n: [number, number] = axis === 'z' ? [0, sign] : [sign, 0];
  const along: [number, number] = axis === 'z' ? [sign, 0] : [0, -sign];
  const turn = (p: [number, number]): [number, number] => (o.yaw ? yawPoint(o.yaw, p[0], p[1]) : p);
  const from = turn([hinge[0] + n[0] * r, hinge[1] + n[1] * r]);
  const to = turn([hinge[0] + along[0] * r, hinge[1] + along[1] * r]);
  const h = turn(hinge);
  const cross = (from[0] - h[0]) * (to[1] - h[1]) - (from[1] - h[1]) * (to[0] - h[0]);
  return {
    strip: o.yaw ? { ...strip, yaw: o.yaw } : strip,
    hinge: h,
    from,
    to,
    radius: r,
    sweep: cross > 0 ? 1 : 0,
  };
}

/** Parts that cover a pipe or outlet behind them (ADR-072). */
const COVER_ROLES: ReadonlySet<string> = new Set(['back', 'plinth', 'worktop']);

// ---------------------------------------------------------------------------
// Opening clearance (ADR-057)
// ---------------------------------------------------------------------------

/** Free room in front of a clearance's front before `hit` (mm), along the piece's facing. */
function freeBefore(c: Clearance, f: PlacedPiece['facing'], hit: Box): Mm {
  const k = f.axis,
    w = k === 'x' ? 'w' : 'd';
  return Math.max(0, f.sign > 0 ? hit[k] - c.box[k] : c.box[k] + c.box[w] - (hit[k] + hit[w]));
}

/**
 * Warn when the space a front needs to open is taken by another piece, a run part or a wall feature (`obstacles`),
 * and when two pieces' openings swing into the same space. Warnings only: export stays allowed (ADR-008, ADR-010).
 */
function openingChecks(
  pieces: PlacedPiece[],
  allPanels: Panel[],
  diagnostics: Diagnostic[],
  obstacles: { label: string; box: Box }[] = [],
): { itemId: string; box: Box }[] {
  const blocked: { itemId: string; box: Box }[] = [];
  for (const pc of pieces) {
    const own = `${pc.item.id}:`;
    for (const c of pc.clearances) {
      const hits = [
        ...allPanels
          .filter((q) => !q.id.startsWith(own) && overlapsBox(q, c.box))
          .map((q) => ({
            box: aabbOf(q),
            exact: q.shape ? aabbOf(q) : q.box,
            itemId: q.id.startsWith('run:')
              ? undefined
              : pieces.find((o) => q.id.startsWith(`${o.item.id}:`))?.item.id,
            name: q.id.startsWith('run:')
              ? q.label
              : (pieces.find((o) => q.id.startsWith(`${o.item.id}:`))?.item.design.name ?? q.label),
          })),
        ...obstacles
          .filter((o) => overlaps(o.box, c.box))
          .map((o) => ({ box: o.box, exact: o.box, itemId: undefined, name: o.label })),
      ];
      if (!hits.length) continue;
      const near = hits.reduce((a, b) =>
        freeBefore(c, pc.facing, b.box) < freeBefore(c, pc.facing, a.box) ? b : a,
      );
      blocked.push({ itemId: pc.item.id, box: c.box });
      // At an angle (ADR-205) the space missing is how far the two turned boxes go into each other.
      const turned = !!c.box.yaw || !!near.exact.yaw;
      const free = turned
        ? Math.max(0, c.need - Math.max(1, penetration(c.box, near.exact)))
        : freeBefore(c, pc.facing, near.box);
      diagnostics.push({
        severity: 'warning',
        code: 'opening-blocked',
        message: t(
          '{front} of {name} cannot open fully: it hits {other} (needs {need} mm, {free} mm free).',
          { front: c.label, name: pc.item.design.name, other: near.name, need: c.need, free },
        ),
        nodeId: pc.item.id,
        // ADR-071: the front, the piece in the way (when it is one), the blocked zone and the space missing.
        panelIds: [c.panelId],
        itemIds: near.itemId ? [near.itemId, pc.item.id] : [pc.item.id],
        box: intersection(c.box, near.box),
        amount: c.need - free,
      });
    }
  }
  for (let a = 0; a < pieces.length; a++)
    for (let b = a + 1; b < pieces.length; b++) {
      const clash = pieces[a].clearances.find((x) =>
        pieces[b].clearances.some((y) => overlaps(x.box, y.box)),
      );
      if (!clash) continue;
      const other = pieces[b].clearances.find((y) => overlaps(clash.box, y.box))!;
      diagnostics.push({
        severity: 'warning',
        code: 'openings-clash',
        message: t('{front} of {a} and {other} of {b} open into the same space.', {
          front: clash.label,
          a: pieces[a].item.design.name,
          other: other.label,
          b: pieces[b].item.design.name,
        }),
        nodeId: pieces[b].item.id,
      });
    }
  return blocked;
}

// ---------------------------------------------------------------------------
// Gaps between pieces in a run
// ---------------------------------------------------------------------------

/** Open-interval overlap: pieces that only touch are not in each other's way. */
const spans = (a0: Mm, a1: Mm, b0: Mm, b1: Mm) => Math.min(a1, b1) > Math.max(a0, b0);

/** Pieces at the same height and depth as `b`: a run along the wall (wall cabinets form their own run). */
const sameRun = (a: Box, b: Box) =>
  spans(a.y, a.y + a.h, b.y, b.y + b.h) && spans(a.z, a.z + a.d, b.z, b.z + b.d);

/** The nearest piece on the left of `id` in the same run, and the free space between them (null if none). */
export function leftNeighbour(project: Project, id: string): { item: ProjectItem; gap: Mm } | null {
  const pieces = project.items.map((i) => placeItem(i));
  const me = pieces.find((p) => p.item.id === id);
  if (!me) return null;
  let best: PlacedPiece | null = null;
  for (const pc of pieces) {
    if (pc === me || !sameRun(pc.bounds, me.bounds)) continue;
    const right = pc.bounds.x + pc.bounds.w;
    if (right > me.bounds.x) continue;
    if (!best || right > best.bounds.x + best.bounds.w) best = pc;
  }
  return best ? { item: best.item, gap: me.bounds.x - (best.bounds.x + best.bounds.w) } : null;
}

/**
 * Leave `gap` mm between piece `id` and its left neighbour by moving it along the wall. With `moveRight`, the pieces
 * on its right in the same run move by the same amount, so the rest of the run keeps its spacing. Refused, with the
 * reason, when it would move a locked piece (ADR-095).
 */
export function trySetGap(project: Project, id: string, gap: Mm, moveRight = true): MoveResult {
  const nb = leftNeighbour(project, id);
  const me = project.items.find((i) => i.id === id);
  if (!nb || !me || !Number.isSafeInteger(gap) || gap < 0) return { project };
  const dx = gap - nb.gap;
  if (!dx) return { project };
  const mine = placedBounds(me);
  const moves = (it: ProjectItem) => {
    if (it.id === id) return true;
    if (it.placement?.kind === 'above') return false;
    if (!moveRight) return false;
    const b = placedBounds(it);
    return b.x >= mine.x + mine.w && sameRun(b, mine);
  };
  const ids = new Set(project.items.filter(moves).map((i) => i.id));
  const reason = moveBlocked(project, [...ids]);
  if (reason) return { project, reason };
  return {
    project: resolvePlacements({
      ...project,
      items: project.items.map((it) =>
        ids.has(it.id) ? { ...it, position: { ...it.position, x: it.position.x + dx } } : it,
      ),
    }),
  };
}

/** `trySetGap` without the reason: the same project when nothing moves. */
export const setGapLeft = (project: Project, id: string, gap: Mm, moveRight = true): Project =>
  trySetGap(project, id, gap, moveRight).project;

/** Pieces whose own plinth is replaced by a run plinth (ADR-054). */
export function plinthCovered(project: Project): Set<string> {
  return new Set(
    (project.runParts ?? []).filter((r) => r.kind === 'plinth').flatMap((r) => r.from ?? []),
  );
}

const runPanel = (
  rp: RunPart,
  materialId: string,
  cut?: { box: Box; shape?: PanelShape },
): Panel => ({
  ...(cut?.shape ? { shape: cut.shape } : {}),
  id: `run:${rp.id}`,
  nodeId: `run:${rp.id}`,
  role:
    rp.kind === 'worktop'
      ? 'worktop'
      : rp.kind === 'filler'
        ? 'filler'
        : rp.kind === 'plinth'
          ? 'plinth'
          : rp.kind === 'cover'
            ? 'cover-panel'
            : 'trim',
  label: rp.label,
  materialId,
  box: cut?.box ?? rp.box,
  thicknessAxis: rp.thicknessAxis,
  grainAxis: rp.grainAxis,
  banded: rp.banded,
});

/** Base units for runs: floor pieces facing the room (no turn) whose carcass is a cabinet or corner up to worktop height. */
const RUN_MAX_HEIGHT = 950;
const FILLER_MAX_GAP = 150;
export const WORKTOP_OVERHANG = 20;
export const worktopMaterial = (): Material => ({
  id: 'worktop38',
  name: 'Worktop 38',
  thickness: 38,
  grain: true,
  color: '#b89b74',
  sheet: { length: 4100, width: 600, trim: 10, count: null },
});

/** A base unit for a run (ADR-036): a floor cabinet or corner up to worktop height, not at an angle. */
const isRunBase = (pc: PlacedPiece) => {
  const k = pc.item.design.product.kind;
  return (
    (k === 'cabinet' || k === 'corner') &&
    !pc.item.angle &&
    pc.bounds.y === 0 &&
    pc.bounds.h <= RUN_MAX_HEIGHT &&
    !isWallHung(pc.item.design)
  );
};

/** The quarter turns runs are found at: facing the room along the back wall, and along the side walls (ADR-205). */
const RUN_TURNS = [0, 90, 270] as const;

/**
 * Runs of base units with gaps up to 150 mm (ADR-036): floor cabinets/corners facing the room side by side along x,
 * left → right, then (ADR-205) those turned a quarter (`rotationY` 90 or 270) along a side wall, side by side along z.
 * Every piece of a run has the same turn.
 */
function groupRuns(placed: PlacedPiece[]): PlacedPiece[][] {
  const runs: PlacedPiece[][] = [];
  for (const r of RUN_TURNS) {
    const alongX = r === 0;
    const lo = (b: Box) => (alongX ? b.x : b.z),
      size = (b: Box) => (alongX ? b.w : b.d);
    const across = (b: Box): [Mm, Mm] => (alongX ? [b.z, b.z + b.d] : [b.x, b.x + b.w]);
    const base = placed
      .filter((pc) => isRunBase(pc) && pc.item.rotationY === r)
      .sort((a, b) => lo(a.bounds) - lo(b.bounds));
    const mine: PlacedPiece[][] = [];
    for (const pc of base) {
      const run = mine.find((rn) => {
        const last = rn[rn.length - 1];
        const gap = lo(pc.bounds) - (lo(last.bounds) + size(last.bounds));
        return (
          gap >= 0 && gap <= FILLER_MAX_GAP && spans(...across(last.bounds), ...across(pc.bounds))
        );
      });
      if (run) run.push(pc);
      else mine.push([pc]);
    }
    runs.push(...mine);
  }
  return runs;
}

/**
 * A run's own frame (ADR-205): runs along a side wall are planned as if they stood along the back wall, run along x
 * and front towards +z, then turned back. `toLocal` and `toRoom` are exact in integers.
 */
interface RunFrame {
  toLocal: (b: Box) => Box;
  toRoom: (b: Box) => Box;
  axis: (a: Axis) => Axis;
  face: (f: Face) => Face;
}
const SAME_FRAME: RunFrame = {
  toLocal: (b) => b,
  toRoom: (b) => b,
  axis: (a) => a,
  face: (f) => f,
};
const swapXZ = (a: Axis): Axis => (a === 'x' ? 'z' : a === 'z' ? 'x' : 'y');
function runFrame(r: QuarterTurn): RunFrame {
  if (r === 90)
    return {
      toLocal: (b) => ({ x: b.z, y: b.y, z: b.x, w: b.d, h: b.h, d: b.w }),
      toRoom: (b) => ({ x: b.z, y: b.y, z: b.x, w: b.d, h: b.h, d: b.w }),
      axis: swapXZ,
      face: (f) => `${f[0]}${swapXZ(f[1] as Axis)}` as Face,
    };
  if (r === 270)
    return {
      toLocal: (b) => ({ x: b.z, y: b.y, z: -(b.x + b.w), w: b.d, h: b.h, d: b.w }),
      toRoom: (b) => ({ x: -(b.z + b.d), y: b.y, z: b.x, w: b.d, h: b.h, d: b.w }),
      axis: swapXZ,
      // Local +z (the front) is room -x; local x is room z.
      face: (f) =>
        f[1] === 'z'
          ? (`${f[0] === '+' ? '-' : '+'}x` as Face)
          : f[1] === 'x'
            ? (`${f[0]}z` as Face)
            : f,
    };
  return SAME_FRAME;
}

/** The ids of the run a piece belongs to (the same runs the run parts use), or null. */
export function runOf(project: Project, id: string): string[] | null {
  const ids = groupRuns(resolvePlacements(project).items.map((i) => placeItem(i)))
    .map((r) => r.map((pc) => pc.item.id))
    .find((r) => r.includes(id));
  return ids ?? null;
}

/** A design with one handle on every front that takes one (doors, drawer fronts; not drawers inside doors). */
function withHandle(d: Design, h: Handle): Design {
  const fix = (sp: Space, inside: boolean): Space => {
    const children =
      sp.kind === 'split' ? sp.children.map((c) => fix(c, inside || !!sp.front)) : undefined;
    const next = children ? ({ ...sp, children } as Space) : sp;
    return !inside && (next.front || next.kind === 'drawers') ? { ...next, handle: h } : next;
  };
  const p = d.product;
  if (p.kind === 'cabinet')
    return {
      ...d,
      product: { ...p, params: { ...p.params, interior: fix(p.params.interior, false) } },
    };
  if (p.kind === 'corner')
    return {
      ...d,
      product: {
        ...p,
        params: {
          ...p.params,
          interior: fix(p.params.interior, false),
          wingInterior: fix(p.params.wingInterior, false),
        },
      },
    };
  return d;
}

/** The pieces a run handle reaches now (ADR-125): the run holding any of its pieces, less those keeping their own. */
export function runHandleMembers(project: Project, rh: RunHandle): string[] {
  const runs = groupRuns(resolvePlacements(project).items.map((i) => placeItem(i)));
  const run = runs.find((r) => r.some((pc) => rh.from.includes(pc.item.id)));
  return run ? run.map((pc) => pc.item.id) : [];
}

/**
 * The run handle that reaches piece `itemId` (ADR-203, G-211), or undefined: the first run handle whose run holds the
 * piece and that the piece does not keep its own handles against, as `applyRunHandles` applies them.
 */
export function runHandleFor(project: Project, itemId: string): RunHandle | undefined {
  return project.runHandles?.find(
    (rh) => !rh.own?.includes(itemId) && runHandleMembers(project, rh).includes(itemId),
  );
}

/**
 * The project as built with its run handles (ADR-125): each piece of a handled run gets the run's handle on every
 * front, its line converted to the piece's own height. Pieces in `own` keep theirs; the first run handle wins.
 * The same project when there are none. Never saved: the pieces' designs keep their own handles.
 */
export function applyRunHandles(project: Project): Project {
  if (!project.runHandles?.length) return project;
  const placed = resolvePlacements(project).items.map((i) => placeItem(i));
  const runs = groupRuns(placed);
  const handles = new Map<string, Handle>();
  for (const rh of project.runHandles) {
    const run = runs.find((r) => r.some((pc) => rh.from.includes(pc.item.id)));
    for (const pc of run ?? []) {
      if (rh.own?.includes(pc.item.id) || handles.has(pc.item.id)) continue;
      // Room height to the piece's own: the outline's lowest point (model bounds.y) sits at bounds.y in the room.
      const lineY =
        rh.height === undefined ? undefined : rh.height - pc.bounds.y + pc.model.bounds.y;
      handles.set(pc.item.id, {
        ...rh.handle,
        position: 'top',
        ...(lineY !== undefined ? { lineY } : {}),
      });
    }
  }
  if (!handles.size) return project;
  return {
    ...project,
    items: project.items.map((i) =>
      handles.has(i.id) ? { ...i, design: withHandle(i.design, handles.get(i.id)!) } : i,
    ),
  };
}

/**
 * Run handles, sinks and hobs keep only pieces still in the project (ADR-125, ADR-205). The same project when nothing
 * changes.
 */
export function pruneRunExtras(project: Project): Project {
  if (!project.runHandles && !project.sinks && !project.hobs) return project;
  const ids = new Set(project.items.map((i) => i.id));
  const handles = project.runHandles
    ?.map((rh) => ({
      ...rh,
      from: rh.from.filter((x) => ids.has(x)),
      ...(rh.own ? { own: rh.own.filter((x) => ids.has(x)) } : {}),
    }))
    .filter((rh) => rh.from.length);
  const sinks = project.sinks?.filter((sk) => ids.has(sk.baseId));
  const hobs = project.hobs?.filter((hb) => ids.has(hb.baseId));
  const same =
    JSON.stringify(handles) === JSON.stringify(project.runHandles) &&
    (sinks?.length ?? 0) === (project.sinks?.length ?? 0) &&
    (hobs?.length ?? 0) === (project.hobs?.length ?? 0);
  return same
    ? project
    : { ...project, runHandles: handles, sinks, ...(project.hobs ? { hobs } : {}) };
}

/** The run worktop over a base unit, if any (ADR-125). */
export const worktopOver = (project: Project, baseId: string): RunPart | undefined =>
  (project.runParts ?? []).find((rp) => rp.kind === 'worktop' && rp.from?.includes(baseId));

/** Sinks for the shopping list (ADR-125): the base each is over and its cut-out. */
export function sinkList(project: Project): { over: string; w: Mm; d: Mm }[] {
  return (project.sinks ?? []).map((sk) => ({
    over: project.items.find((i) => i.id === sk.baseId)?.design.name ?? t('a removed piece'),
    w: sk.w,
    d: sk.d,
  }));
}

/** The wording of each cut-out's diagnostics (ADR-125 sinks, ADR-205 hobs). */
const CUTOUT_TEXT = {
  sink: {
    none: 'The sink over {name} has no worktop to be cut out of; add the run worktop.',
    deep: 'Sink cut-out {w} × {d} mm is as deep as the worktop over {name} ({depth} mm) or deeper.',
    wide: 'Sink cut-out {w} mm is wider than {name} under it ({width} mm).',
  },
  hob: {
    none: 'The hob over {name} has no worktop to be cut out of; add the run worktop.',
    deep: 'Hob cut-out {w} × {d} mm is as deep as the worktop over {name} ({depth} mm) or deeper.',
    wide: 'Hob cut-out {w} mm is wider than {name} under it ({width} mm).',
  },
} as const satisfies Record<'sink' | 'hob', Record<'none' | 'deep' | 'wide', Key>>;

/**
 * Diagnostics of the sinks or hobs (ADR-125, ADR-205): no worktop to cut, a cut-out wider than its base or through
 * the worktop.
 */
function cutoutChecks(
  project: Project,
  placedById: Map<string, PlacedPiece>,
  kind: 'sink' | 'hob',
): Diagnostic[] {
  const out: Diagnostic[] = [];
  const text = CUTOUT_TEXT[kind];
  for (const sk of (kind === 'sink' ? project.sinks : project.hobs) ?? []) {
    const base = placedById.get(sk.baseId);
    if (!base) continue;
    const name = base.item.design.name;
    const top = worktopOver(project, sk.baseId);
    const nodeId = `${kind}:${sk.id}`;
    // Across its run: the worktop's depth along z on the back wall, along x on a side wall (ADR-205).
    const side = top?.grainAxis === 'z';
    const depth = top ? (side ? top.box.w : top.box.d) : 0;
    const width = side ? base.bounds.d : base.bounds.w;
    if (!top)
      out.push({
        severity: 'warning',
        code: `${kind}-no-worktop`,
        message: t(text.none, { name }),
        nodeId,
      });
    else if (sk.d >= depth)
      out.push({
        severity: 'error',
        code: `${kind}-cutout-deep`,
        message: t(text.deep, { w: sk.w, d: sk.d, name, depth }),
        nodeId,
      });
    if (sk.w > width)
      out.push({
        severity: 'warning',
        code: `${kind}-cutout-wide`,
        message: t(text.wide, { w: sk.w, name, width }),
        nodeId,
      });
  }
  return out;
}

/** A sink or hob cut-out on the plan (ADR-205): dashed on its worktop, labelled with its size. */
export interface CutoutOutline {
  id: string;
  kind: 'sink' | 'hob';
  /** Room mm. */
  box: Box;
  /** The cut-out as typed: along the run × across it. */
  w: Mm;
  d: Mm;
}

/**
 * Where each sink and hob cut-out is drawn (ADR-205). A cut-out has no stored position (G-407): it is centred on its
 * base along the run and on the worktop's depth, whole mm (a half mm rounds down). Cut-outs without a worktop are not
 * drawn (their diagnostic says why).
 */
export function cutoutOutlines(project: Project, pieces: PlacedPiece[]): CutoutOutline[] {
  const byId = new Map(pieces.map((pc) => [pc.item.id, pc]));
  const out: CutoutOutline[] = [];
  for (const [kind, list] of [
    ['sink', project.sinks],
    ['hob', project.hobs],
  ] as const)
    for (const c of list ?? []) {
      const base = byId.get(c.baseId)?.bounds;
      const part = worktopOver(project, c.baseId);
      if (!base || !part) continue;
      const top = part.box;
      const box: Box =
        part.grainAxis === 'z'
          ? {
              x: top.x + Math.floor((top.w - c.d) / 2),
              y: top.y,
              z: base.z + Math.floor((base.d - c.w) / 2),
              w: c.d,
              h: top.h,
              d: c.w,
            }
          : {
              x: base.x + Math.floor((base.w - c.w) / 2),
              y: top.y,
              z: top.z + Math.floor((top.d - c.d) / 2),
              w: c.w,
              h: top.h,
              d: c.d,
            };
      out.push({ id: `${kind}:${c.id}`, kind, box, w: c.w, d: c.d });
    }
  return out;
}

// ---------------------------------------------------------------------------
// Worktop corners (ADR-205)
// ---------------------------------------------------------------------------

/** Two worktops at right angles that overlap or meet in plan: `a` along the back wall (x), `b` along a side wall (z). */
export interface WorktopCorner {
  a: RunPart;
  b: RunPart;
  /** The joint the user chose; absent = none yet (the corner is an error until one is chosen). */
  joint?: WorktopJoint;
}

export const runPartKey = (rp: RunPart) => rp.key ?? rp.id;

/** A side worktop faces +x (its back edge is its smaller x): its banded front edge says so. */
const facesPlusX = (b: RunPart) => !b.banded.includes('-x');

/**
 * The worktop corners of a project (ADR-205): a worktop along x and one along z that overlap or touch in plan at the
 * same height, the side one reaching out in front of the back one, the back one reaching away from the side one.
 */
export function worktopCorners(project: Project): WorktopCorner[] {
  const tops = (project.runParts ?? []).filter((rp) => rp.kind === 'worktop');
  const out: WorktopCorner[] = [];
  for (const a of tops) {
    if (a.grainAxis !== 'x') continue;
    for (const b of tops) {
      if (b.grainAxis !== 'z') continue;
      const A = a.box,
        B = b.box;
      const meets =
        A.x <= B.x + B.w &&
        B.x <= A.x + A.w &&
        A.z <= B.z + B.d &&
        B.z <= A.z + A.d &&
        A.y < B.y + B.h &&
        B.y < A.y + A.h;
      if (!meets || B.z + B.d <= A.z + A.d) continue;
      if (facesPlusX(b) ? A.x + A.w <= B.x + B.w : A.x >= B.x) continue;
      const ka = runPartKey(a),
        kb = runPartKey(b);
      const joint = (project.worktopJoints ?? []).find(
        (j) => (j.a === ka && j.b === kb) || (j.a === kb && j.b === ka),
      );
      out.push({ a, b, ...(joint ? { joint } : {}) });
    }
  }
  return out;
}

/** Whether the corner's worktop `a` (else `b`) runs through its butt joint; undefined when not chosen. */
function aRunsThrough(c: WorktopCorner): boolean | undefined {
  const j = c.joint;
  if (j?.kind !== 'butt' || !j.through) return undefined;
  return (j.through === 'a' ? j.a : j.b) === runPartKey(c.a);
}

/** "Base 600 + Base 800": the pieces a run part was made from. */
export const runPartNames = (project: Project, rp: RunPart) =>
  (rp.from ?? [])
    .map((id) => project.items.find((i) => i.id === id)?.design.name ?? t('a removed piece'))
    .join(' + ');

/** The corner's lines in plan: the side worktop's back and front edge (x), the back worktop's back and front edge (z). */
function cornerLines(c: WorktopCorner) {
  const A = c.a.box,
    B = c.b.box;
  const plus = facesPlusX(c.b);
  return {
    plus,
    xb: plus ? B.x : B.x + B.w,
    xf: plus ? B.x + B.w : B.x,
    zb: A.z,
    zf: A.z + A.d,
  };
}

/**
 * Each worktop of a corner as cut (ADR-205), by run-part id: its blank, mitred also the profile cut along the line from
 * the inner corner (where the front edges meet) to the outer corner, and its cut-list notes. Mitred, both reach the
 * outer corner; butt, the worktop that runs through reaches it and the other stops at its front edge. Corners without
 * a joint leave their worktops as they are. Whole mm; the stored run parts never change.
 */
export function worktopJointCuts(
  project: Project,
): Map<string, { box: Box; shape?: PanelShape; notes: string[] }> {
  /** Along the worktop: where its near (l) and far (r) ends are, at its back (b) and at its front (f) edge. */
  type Ends = { lb: Mm; lf: Mm; rb: Mm; rf: Mm };
  const ends = new Map<string, Ends>();
  const notes = new Map<string, string[]>();
  const endsOf = (rp: RunPart) => {
    let e = ends.get(rp.id);
    if (!e) {
      const b = rp.box;
      e =
        rp.grainAxis === 'z'
          ? { lb: b.z, lf: b.z, rb: b.z + b.d, rf: b.z + b.d }
          : { lb: b.x, lf: b.x, rb: b.x + b.w, rf: b.x + b.w };
      ends.set(rp.id, e);
    }
    return e;
  };
  const note = (rp: RunPart, n: string) => notes.set(rp.id, [...(notes.get(rp.id) ?? []), n]);
  for (const c of worktopCorners(project)) {
    const j = c.joint;
    const through = aRunsThrough(c);
    if (!j || (j.kind === 'butt' && through === undefined)) continue;
    const { plus, xb, xf, zb, zf } = cornerLines(c);
    const ea = endsOf(c.a),
      eb = endsOf(c.b);
    // The end of `a` at the corner: its left end when the side worktop faces +x, else its right end.
    const setA = (back: Mm, front: Mm) => {
      if (plus) [ea.lb, ea.lf] = [back, front];
      else [ea.rb, ea.rf] = [back, front];
    };
    if (j.kind === 'mitre') {
      setA(xb, xf);
      [eb.lb, eb.lf] = [zb, zf];
      note(c.a, 'mitre joint');
      note(c.b, 'mitre joint');
      continue;
    }
    if (through) {
      setA(xb, xb);
      [eb.lb, eb.lf] = [zf, zf];
    } else {
      setA(xf, xf);
      [eb.lb, eb.lf] = [zb, zb];
    }
    note(c.a, `butt joint against ${runPartNames(project, c.b)}`);
    note(c.b, `butt joint against ${runPartNames(project, c.a)}`);
  }
  const out = new Map<string, { box: Box; shape?: PanelShape; notes: string[] }>();
  for (const rp of project.runParts ?? []) {
    const e = ends.get(rp.id);
    if (!e) continue;
    const b = rp.box;
    const lo = Math.min(e.lb, e.lf),
      hi = Math.max(e.rb, e.rf);
    const side = rp.grainAxis === 'z';
    const box: Box = side ? { ...b, z: lo, d: hi - lo } : { ...b, x: lo, w: hi - lo };
    // On the worktop's face, [u, v] = [x, z] from the blank's corner (ADR-040).
    const plus = facesPlusX(rp);
    const ub = plus ? 0 : b.w,
      uf = plus ? b.w : 0;
    const points: [Mm, Mm][] = side
      ? [
          [ub, e.lb - lo],
          [uf, e.lf - lo],
          [uf, e.rf - lo],
          [ub, e.rb - lo],
        ]
      : [
          [e.lb - lo, 0],
          [e.rb - lo, 0],
          [e.rf - lo, b.d],
          [e.lf - lo, b.d],
        ];
    const shaped = e.lb !== e.lf || e.rb !== e.rf;
    out.set(rp.id, {
      box,
      ...(shaped ? { shape: { kind: 'profile', points } } : {}),
      notes: notes.get(rp.id) ?? [],
    });
  }
  return out;
}

/** The joint line of each chosen corner on the plan (ADR-205): x1 z1 x2 z2, room mm. */
export function worktopJointLines(
  project: Project,
): { id: string; kind: WorktopJoint['kind']; line: [Mm, Mm, Mm, Mm] }[] {
  const out: { id: string; kind: WorktopJoint['kind']; line: [Mm, Mm, Mm, Mm] }[] = [];
  for (const c of worktopCorners(project)) {
    const through = aRunsThrough(c);
    if (!c.joint || (c.joint.kind === 'butt' && through === undefined)) continue;
    const { xb, xf, zb, zf } = cornerLines(c);
    const line: [Mm, Mm, Mm, Mm] =
      c.joint.kind === 'mitre' ? [xf, zf, xb, zb] : through ? [xb, zf, xf, zf] : [xf, zb, xf, zf];
    out.push({ id: c.joint.id, kind: c.joint.kind, line });
  }
  return out;
}

/** A corner without a chosen joint is an error (ADR-205, ADR-008): the app picks no default joint. */
function worktopJointChecks(project: Project): Diagnostic[] {
  const out: Diagnostic[] = [];
  for (const c of worktopCorners(project)) {
    const names = { a: runPartNames(project, c.a), b: runPartNames(project, c.b) };
    const nodeId = `corner:${runPartKey(c.a)}|${runPartKey(c.b)}`;
    if (!c.joint)
      out.push({
        severity: 'error',
        code: 'worktop-corner-joint',
        message: t(
          'The worktops over {a} and {b} overlap at the corner: choose a mitred or butt joint.',
          names,
        ),
        nodeId,
      });
    else if (c.joint.kind === 'butt' && aRunsThrough(c) === undefined)
      out.push({
        severity: 'error',
        code: 'worktop-corner-joint',
        message: t(
          'The worktops over {a} and {b} meet in a butt joint: choose the one that runs through.',
          names,
        ),
        nodeId,
      });
  }
  return out;
}

/**
 * Joints follow their worktops (ADR-205, ADR-061): a joint whose two worktops no longer meet at a corner goes. The same
 * project when nothing changes; every commit applies it.
 */
export function pruneWorktopJoints(project: Project): Project {
  if (!project.worktopJoints) return project;
  const live = new Set(worktopCorners(project).flatMap((c) => (c.joint ? [c.joint.id] : [])));
  const kept = project.worktopJoints.filter((j) => live.has(j.id));
  if (kept.length === project.worktopJoints.length) return project;
  return { ...project, worktopJoints: kept.length ? kept : undefined };
}

/**
 * Propose run parts for the floor runs in a project (ADR-036). A run is a row of base units side by side (gaps up to
 * 150 mm). Each run gets one worktop on top (depth of the deepest unit + 20 mm overhang), a filler in every gap, a
 * cover panel on each exposed end and (ADR-054) one plinth along the run when every piece's sides stand on its bottom
 * and the plinths match; that plinth replaces the pieces' own. Parts that would overlap another piece are left out;
 * parts the user removed (`runPartsRemoved`) are not proposed again. `notes` say why a run got no plinth.
 */
export function planRuns(
  project: Project,
  /**
   * `sides`: plan the runs along the side walls too (ADR-205: the user asked, Suggest). Without it a side-wall run gets
   * parts only when it already has some or the user asked for one of its worktops, so existing run parts never change.
   */
  opts: { sides?: boolean } = {},
): {
  parts: RunPart[];
  notes: string[];
  /** Why a run part the user asked for was not made, by request key (ADR-075). */
  unmade: Record<string, string>;
} {
  const resolved = resolvePlacements(project);
  const placed = resolved.items.map((i) => placeItem(i));
  const removed = new Set(project.runPartsRemoved ?? []);
  const scribe = project.runSettings?.scribe ?? 0;
  const notes: string[] = [];
  const requests = project.runRequests ?? [];
  const had = new Set([
    ...(project.runParts ?? []).flatMap((rp) => rp.from ?? []),
    ...requests.flatMap((r) => r.from),
  ]);
  const runs = groupRuns(placed).filter(
    (run) => run[0].item.rotationY === 0 || !!opts.sides || run.some((pc) => had.has(pc.item.id)),
  );
  const unmade: Record<string, string> = {};
  const fail = (r: RunRequest, why: string) => {
    const note = t('{part}: {why}.', { part: requestName(r, project), why });
    unmade[requestKey(r)] = note;
    notes.push(note);
  };
  const out: RunPart[] = [];
  /**
   * Free of every piece (a run plinth ignores the plinths it replaces) and of the parts proposed so far. A worktop may
   * meet a worktop at right angles to it (`grain`): that corner is a joint the user chooses (ADR-205).
   */
  const freeRoom = (b: Box, skipPlinthOf: Set<string> = new Set(), grain?: Axis) =>
    !placed.some(
      (pc) =>
        overlaps(pc.bounds, b) &&
        pc.panels.some(
          (q) => !(q.role === 'plinth' && skipPlinthOf.has(pc.item.id)) && overlapsBox(q, b),
        ),
    ) && !out.some((o) => overlaps(o.box, b) && !crosses(o, grain));
  const crosses = (o: RunPart, grain?: Axis) =>
    !!grain && o.kind === 'worktop' && o.grainAxis !== grain;
  const pushRoom = (rp: RunPart) => {
    if (!removed.has(rp.key!)) out.push(rp);
  };
  const frontOf = (pc: PlacedPiece) => {
    const p = pc.item.design.product;
    const id = p.kind === 'cabinet' || p.kind === 'corner' ? p.params.frontMaterialId : '';
    return pc.item.design.materials.find((m) => m.id === id) ?? pc.item.design.materials[0];
  };
  runs.forEach((roomRun) => {
    // A side-wall run is planned in its own frame and its parts turned back into the room (ADR-205).
    const fr = runFrame(roomRun[0].item.rotationY);
    const run = roomRun.map((pc) => ({ ...pc, bounds: fr.toLocal(pc.bounds) }));
    const toRoom = (rp: RunPart): RunPart => ({
      ...rp,
      box: fr.toRoom(rp.box),
      thicknessAxis: fr.axis(rp.thicknessAxis),
      grainAxis: fr.axis(rp.grainAxis),
      banded: rp.banded.map(fr.face),
    });
    const free = (b: Box, skipPlinthOf?: Set<string>, grain?: Axis) =>
      freeRoom(fr.toRoom(b), skipPlinthOf, grain && fr.axis(grain));
    const push = (rp: RunPart) => pushRoom(toRoom(rp));
    const ids = run.map((pc) => pc.item.id);
    const first = run[0].bounds,
      last = run[run.length - 1].bounds;
    const x0 = first.x,
      x1 = last.x + last.w;
    const n = run.length;
    for (let i = 1; i < n; i++) {
      const a = run[i - 1],
        b = run[i];
      const gap = b.bounds.x - (a.bounds.x + a.bounds.w);
      if (gap <= 0) continue;
      const m = frontOf(a);
      const h = Math.min(a.bounds.h, b.bounds.h);
      const fz = Math.min(a.bounds.z + a.bounds.d, b.bounds.z + b.bounds.d) - m.thickness;
      const bx: Box = { x: a.bounds.x + a.bounds.w, y: 0, z: fz, w: gap, h, d: m.thickness };
      const key = `filler|${a.item.id},${b.item.id}`;
      if (free(bx))
        push({
          id: key,
          key,
          from: [a.item.id, b.item.id],
          kind: 'filler',
          label: 'Filler',
          reason: `gap ${gap} mm${scribe ? ` + ${scribe} mm scribe` : ''} between ${a.item.design.name} and ${b.item.design.name}`,
          box: bx,
          ...(scribe ? { scribe } : {}),
          material: { ...m },
          thicknessAxis: 'z',
          grainAxis: 'y',
          banded: ['-x', '+x', '-y', '+y'],
        });
    }
    for (const [end, pc] of [
      ['left', run[0]],
      ['right', run[n - 1]],
    ] as const) {
      const m = frontOf(pc);
      const b = pc.bounds;
      const bx: Box = {
        x: end === 'left' ? b.x - m.thickness : b.x + b.w,
        y: 0,
        z: b.z,
        w: m.thickness,
        h: b.h,
        d: b.d,
      };
      const key = `cover-${end}|${pc.item.id}`;
      if (bx.x >= 0 && free(bx))
        push({
          id: key,
          key,
          from: [pc.item.id],
          kind: 'cover',
          label: `Cover panel ${end}`,
          reason: `exposed ${end} end of ${pc.item.design.name}`,
          box: bx,
          material: { ...m },
          thicknessAxis: 'x',
          grainAxis: 'y',
          banded: ['+z', '+y'],
        });
    }
    // Run plinth (ADR-054): only where the pieces' plinths can be one board — sides standing on the bottom, same
    // plinth height and setback, same front line. Otherwise each piece keeps its own and a note says why.
    const cabs = run.map((pc) =>
      pc.item.design.product.kind === 'cabinet' ? { pc, p: pc.item.design.product.params } : null,
    );
    const names = (f: (c: { pc: PlacedPiece; p: CabinetParams }) => boolean) =>
      cabs
        .filter((c): c is { pc: PlacedPiece; p: CabinetParams } => !!c && f(c))
        .map((c) => c.pc.item.design.name)
        .join(', ');
    if (n > 1) {
      const ok = cabs.filter((c): c is { pc: PlacedPiece; p: CabinetParams } => !!c);
      const plinthLine = (c: { pc: PlacedPiece; p: CabinetParams }) =>
        c.pc.bounds.z + c.p.depth - c.p.plinthSetback;
      const bodyOf = (c: { pc: PlacedPiece; p: CabinetParams }) =>
        c.pc.item.design.materials.find((m) => m.id === c.p.bodyMaterialId);
      const bodyT = (c: { pc: PlacedPiece; p: CabinetParams }) => bodyOf(c)?.thickness ?? 0;
      const bodyKey = (c: { pc: PlacedPiece; p: CabinetParams }) => {
        const m = bodyOf(c);
        return m ? materialKey(m) : '';
      };
      const each = (f: (c: { pc: PlacedPiece; p: CabinetParams }) => string) =>
        ok.map((c) => `${c.pc.item.design.name} ${f(c)}`).join(', ');
      let why = '';
      if (ok.length < n) why = t('a corner unit in the run keeps its own plinth');
      else if (ok.some((c) => c.p.plinthHeight <= 0))
        why = t('no plinth on {names}', { names: names((c) => c.p.plinthHeight <= 0) });
      else if (ok.some((c) => c.p.bottom !== 'under'))
        why = t('the sides of {names} reach the floor; set Bottom → under the sides', {
          names: names((c) => c.p.bottom !== 'under'),
        });
      else if (new Set(ok.map((c) => c.p.plinthHeight)).size > 1)
        why = t('plinth heights differ ({list})', {
          list: ok
            .map((c) => t('{name} {mm} mm', { name: c.pc.item.design.name, mm: c.p.plinthHeight }))
            .join(', '),
        });
      else if (new Set(ok.map((c) => c.p.plinthSetback)).size > 1)
        why = t('plinth setbacks differ ({list})', {
          list: each((c) => t('{mm} mm', { mm: c.p.plinthSetback })),
        });
      else if (new Set(ok.map(plinthLine)).size > 1)
        why = t('plinth fronts are not in line ({list})', {
          list: each((c) => t('{mm} mm from the back', { mm: plinthLine(c) })),
        });
      else if (new Set(ok.map(bodyKey)).size > 1)
        why = t('body boards differ ({list})', {
          list: each((c) => {
            const m = bodyOf(c);
            return m
              ? t('{name} {mm} mm', { name: m.name, mm: m.thickness }) +
                  (m.grain ? t(' grained') : '') +
                  (m.image ? t(' with a picture') : '')
              : t('no board');
          }),
        });
      if (why)
        notes.push(
          t('No run plinth for {names}: {why}.', {
            names: run.map((pc) => pc.item.design.name).join(' + '),
            why,
          }),
        );
      else {
        const c0 = ok[0],
          bt = bodyT(c0);
        const m = c0.pc.item.design.materials.find((x) => x.id === c0.p.bodyMaterialId)!;
        const bx: Box = {
          x: x0,
          y: 0,
          z: plinthLine(c0) - bt,
          w: x1 - x0,
          h: c0.p.plinthHeight,
          d: bt,
        };
        const key = `plinth|${ids.join(',')}`;
        if (free(bx, new Set(ids)))
          push({
            id: key,
            key,
            from: ids,
            kind: 'plinth',
            label: 'Plinth',
            reason: `run of ${n} ${n === 1 ? 'piece' : 'pieces'}, ${bx.w} mm long; replaces their own plinths`,
            box: bx,
            material: { ...m },
            thicknessAxis: 'z',
            grainAxis: 'x',
            banded: ['-y'],
          });
        else
          notes.push(
            t('No run plinth for {names}: it would overlap a filler or another piece.', {
              names: run.map((pc) => pc.item.design.name).join(' + '),
            }),
          );
      }
    }
    // Worktops the user asked for over part of this run, or with their own overhangs (ADR-075), replace the
    // suggested worktop over the whole run.
    const asked = requests.filter(
      (r) => r.kind === 'worktop' && r.from.some((id) => ids.includes(id)),
    );
    const worktop = (pcs: PlacedPiece[], key: string, front = WORKTOP_OVERHANG, side = 0) => {
      const own = pcs.map((pc) => pc.item.id);
      const covers = out
        .filter((o) => o.kind === 'cover' && o.from!.some((id) => own.includes(id)))
        .map((o) => ({ ...o, box: fr.toLocal(o.box) }));
      const l = pcs[0].bounds,
        r = pcs[pcs.length - 1].bounds;
      const wx0 = Math.min(l.x, ...covers.map((c) => c.box.x)) - side,
        wx1 = Math.max(r.x + r.w, ...covers.map((c) => c.box.x + c.box.w)) + side;
      const wz0 = Math.min(...pcs.map((pc) => pc.bounds.z));
      const wt = worktopMaterial();
      const wb: Box = {
        x: wx0,
        y: Math.max(...pcs.map((pc) => pc.bounds.y + pc.bounds.h)),
        z: wz0,
        w: wx1 - wx0,
        h: wt.thickness,
        d: Math.max(...pcs.map((pc) => pc.bounds.z + pc.bounds.d)) - wz0 + front,
      };
      const m = pcs.length;
      const part: RunPart = {
        id: key,
        key,
        from: own,
        kind: 'worktop',
        label: 'Worktop',
        reason: `${m === n ? 'run of' : 'over'} ${m} ${m === 1 ? 'piece' : 'pieces'}, ${wb.w} mm long${
          front !== WORKTOP_OVERHANG || side ? `, overhang ${front} mm front, ${side} mm sides` : ''
        }`,
        box: wb,
        material: wt,
        thicknessAxis: 'y',
        grainAxis: 'x',
        banded: ['+z'],
      };
      return part;
    };
    if (asked.length) {
      for (const r of asked) {
        const idx = r.from.map((id) => ids.indexOf(id)).sort((a, b) => a - b);
        if (idx[0] < 0 || idx.some((v, i) => v !== idx[0] + i)) continue;
        const wb = worktop(
          idx.map((i) => run[i]),
          requestKey(r),
          r.front,
          r.side,
        );
        const room = toRoom(wb);
        if (out.some((o) => overlaps(o.box, room.box) && !crosses(o, room.grainAxis)))
          fail(r, t('it would overlap another worktop or run part'));
        else out.push(room);
      }
      const bare = run.filter((pc) => !asked.some((r) => r.from.includes(pc.item.id)));
      if (bare.length)
        notes.push(
          t(
            'No worktop over {names}: worktops were chosen for other pieces of this run (Add worktop over… adds one).',
            { names: bare.map((pc) => pc.item.design.name).join(' + ') },
          ),
        );
      return;
    }
    const key = `worktop|${ids.join(',')}`;
    const wb = worktop(run, key);
    if (free(wb.box, undefined, wb.grainAxis)) push(wb);
  });
  // Trims the user asked for along wall or tall units (ADR-075).
  const byId = new Map(placed.map((pc) => [pc.item.id, pc]));
  // Crowns first, so a ceiling filler on the same units goes above them whatever order they were asked in.
  const order: Record<RunRequest['kind'], number> = {
    worktop: 0,
    crown: 1,
    pelmet: 2,
    'ceiling-filler': 3,
  };
  for (const r of [...requests].sort((a, b) => order[a.kind] - order[b.kind])) {
    const key = requestKey(r);
    if (r.kind === 'worktop') {
      if (out.some((o) => o.key === key) || unmade[key]) continue;
      const why =
        !r.from.length || r.from.some((id) => !byId.has(id))
          ? t('a piece it was made for is no longer in the project')
          : !runs.some((run) => r.from.every((id) => run.some((pc) => pc.item.id === id)))
            ? t('the pieces are not side by side in one run of base units')
            : t('the pieces are not next to each other');
      fail(r, why);
      continue;
    }
    const part = planTrim(r, byId, project.room, out);
    if (typeof part === 'string') fail(r, part);
    else if (out.some((o) => overlaps(o.box, part.box)))
      fail(r, t('it would overlap another run part'));
    else out.push(part);
  }
  return { parts: out, notes, unmade };
}

export const suggestRunParts = (project: Project): RunPart[] => planRuns(project).parts;

const TRIM_LABEL: Record<RunRequest['kind'], string> = {
  worktop: 'Worktop',
  crown: 'Crown',
  pelmet: 'Pelmet',
  'ceiling-filler': 'Ceiling filler',
};

const REQUEST_NAME = {
  worktop: 'Worktop over {names}',
  crown: 'Crown over {names}',
  pelmet: 'Pelmet over {names}',
  'ceiling-filler': 'Ceiling filler over {names}',
} as const satisfies Record<RunRequest['kind'], Key>;

/** "Crown over Wall unit + Wall unit 2", for notes and diagnostics. */
export function requestName(r: RunRequest, project: Project): string {
  const names = r.from.map(
    (id) => project.items.find((i) => i.id === id)?.design.name ?? t('a removed piece'),
  );
  return t(REQUEST_NAME[r.kind], { names: names.join(' + ') });
}

/** Wall units, and tall units standing on the floor, facing the room: the pieces a trim runs along (ADR-075). */
export const takesTrim = (pc: PlacedPiece) =>
  pc.item.rotationY === 0 &&
  !pc.item.angle &&
  (pc.item.design.product.kind === 'cabinet' || pc.item.design.product.kind === 'corner') &&
  (isWallHung(pc.item.design) || (pc.bounds.y === 0 && pc.bounds.h > RUN_MAX_HEIGHT));

/** Pieces to choose from (ADR-075): runs of base units for a worktop, wall and tall units for trims; left → right. */
export function requestCandidates(project: Project): { runs: string[][]; trims: string[][] } {
  const placed = resolvePlacements(project).items.map((i) => placeItem(i));
  // Trim rows: wall or tall units side by side, the same rule `planTrim` checks.
  const trims: PlacedPiece[][] = [];
  for (const pc of placed.filter(takesTrim).sort((a, b) => a.bounds.x - b.bounds.x)) {
    const row = trims.find((r) => sideBySide(r[r.length - 1].bounds, pc.bounds));
    if (row) row.push(pc);
    else trims.push([pc]);
  }
  return {
    runs: groupRuns(placed).map((r) => r.map((pc) => pc.item.id)),
    trims: trims.map((r) => r.map((pc) => pc.item.id)),
  };
}

/** `b` starts 0–150 mm right of `a` and they share some depth. */
const sideBySide = (a: Box, b: Box) => {
  const gap = b.x - (a.x + a.w);
  return gap >= 0 && gap <= FILLER_MAX_GAP && spans(a.z, a.z + a.d, b.z, b.z + b.d);
};

/**
 * A crown (on top, along the front), a pelmet (under the bottom, along the front) or a ceiling filler (from the
 * top, or a crown on it, up to the room height) over adjacent wall or tall units (ADR-075); flush with their
 * fronts. Returns why it cannot be made instead; nothing is clamped (ADR-008).
 */
function planTrim(
  r: RunRequest,
  byId: Map<string, PlacedPiece>,
  room: Room | undefined,
  out: RunPart[],
): RunPart | string {
  const found = r.from.map((id) => byId.get(id));
  if (!found.length || found.some((pc) => !pc))
    return t('a piece it was made for is no longer in the project');
  const pcs = (found as PlacedPiece[]).slice().sort((a, b) => a.bounds.x - b.bounds.x);
  const odd = pcs.find((pc) => !takesTrim(pc));
  if (odd)
    return t('{name} is not a wall or tall unit facing the room', { name: odd.item.design.name });
  for (let i = 1; i < pcs.length; i++)
    if (!sideBySide(pcs[i - 1].bounds, pcs[i].bounds)) return t('the pieces are not side by side');
  const m = r.material;
  if (!m) return t('choose its board');
  const x0 = pcs[0].bounds.x,
    x1 = Math.max(...pcs.map((pc) => pc.bounds.x + pc.bounds.w));
  const top = Math.max(...pcs.map((pc) => pc.bounds.y + pc.bounds.h));
  const bottom = Math.min(...pcs.map((pc) => pc.bounds.y));
  const zf = Math.max(...pcs.map((pc) => pc.bounds.z + pc.bounds.d));
  let y: Mm, h: Mm, reason: string;
  if (r.kind === 'ceiling-filler') {
    if (!room) return t('set the room and its height first (Room)');
    const crown = out.filter((o) => o.kind === 'crown' && o.box.x < x1 && o.box.x + o.box.w > x0);
    y = Math.max(top, ...crown.map((c) => c.box.y + c.box.h));
    h = room.height - y;
    if (h <= 0) return t('the run already reaches the {h} mm ceiling', { h: room.height });
    reason = `from ${y} mm up to the ${room.height} mm ceiling`;
  } else {
    if (!r.height) return t('enter its height');
    h = r.height;
    y = r.kind === 'crown' ? top : bottom - h;
    if (y < 0) return t('it would go {mm} mm below the floor', { mm: -y });
    reason = r.kind === 'crown' ? `on top, ${h} mm high` : `under the units, ${h} mm high`;
  }
  const key = requestKey(r);
  return {
    id: key,
    key,
    from: pcs.map((pc) => pc.item.id),
    kind: r.kind,
    label: TRIM_LABEL[r.kind],
    reason: `${reason}, ${x1 - x0} mm along ${pcs.length} ${pcs.length === 1 ? 'piece' : 'pieces'}`,
    box: { x: x0, y, z: zf - m.thickness, w: x1 - x0, h, d: m.thickness },
    material: { ...m },
    thicknessAxis: 'z',
    grainAxis: 'x',
    banded: r.kind === 'crown' ? ['+y'] : r.kind === 'pelmet' ? ['-y'] : [],
  };
}

/**
 * Keep run parts in step with the pieces (ADR-061): with `runSettings.auto`, propose them again; parts with the
 * same key and box keep their stored copy, changed ones say what changed. Removed keys whose pieces are gone are
 * forgotten. Returns the same project when nothing changes.
 */
export function refreshRunParts(project: Project): Project {
  if (!project.runSettings?.auto) return project;
  const old = new Map((project.runParts ?? []).map((r) => [r.key ?? r.id, r]));
  const ids = new Set(project.items.map((i) => i.id));
  const removed = (project.runPartsRemoved ?? []).filter((k) =>
    k
      .split('|')[1]
      ?.split(',')
      .every((id) => ids.has(id)),
  );
  const next = planRuns({ ...project, runPartsRemoved: removed }).parts.map((r) => {
    const was = old.get(r.key!);
    if (!was) return r;
    // A trim's board is the one in its request (ADR-075); other parts keep their stored copy.
    const own = TRIM_KINDS.includes(r.kind as TrimKind);
    const same =
      JSON.stringify(was.box) === JSON.stringify(r.box) &&
      was.scribe === r.scribe &&
      (!own || JSON.stringify(was.material) === JSON.stringify(r.material));
    if (same) {
      const { changed: _c, ...keep } = was;
      void _c;
      return keep;
    }
    const along =
      (['w', 'h', 'd'] as const).find((k) => was.box[k] !== r.box[k]) ??
      (r.kind === 'cover' ? 'h' : 'w');
    return {
      ...r,
      material: own ? r.material : was.material,
      changed: `${was.box[along]} → ${r.box[along]} mm`,
    };
  });
  const before = JSON.stringify(project.runParts ?? []),
    after = JSON.stringify(next);
  if (before === after && removed.length === (project.runPartsRemoved ?? []).length) return project;
  return { ...project, runParts: next, runPartsRemoved: removed };
}

/**
 * The sink and hob cut-outs to make in a worktop (ADR-125, ADR-205): notes for its cut-list row, in the notes column
 * (printed in the print language, `drillingRo`).
 */
function cutoutNotes(project: Project, rp: RunPart): string[] {
  if (rp.kind !== 'worktop') return [];
  const on = (list: RunSink[] | undefined) =>
    (list ?? []).filter((sk) => rp.from?.includes(sk.baseId));
  return [
    ...on(project.sinks).map((sk) => `sink cut-out ${sk.w} × ${sk.d} mm`),
    ...on(project.hobs).map((hb) => `hob cut-out ${hb.w} × ${hb.d} mm`),
  ];
}

/** Parts for the whole project: each piece's cut list × its quantity, merged across pieces, then the run parts. */
export function projectCutlist(input: Project): CutRow[] {
  const project = applyRunHandles(input);
  const rows = new Map<string, CutRow>();
  const extra = (project.runParts ?? []).map((rp) => ({ rp, key: materialKey(rp.material) }));
  // Worktops at a corner are cut to their joint (ADR-205).
  const joints = worktopJointCuts(project);
  if (extra.length) {
    const mats = [
      ...new Map(
        extra.map((e) => [e.key, { ...runMaterial(project, e.rp.material), id: e.key }]),
      ).values(),
    ];
    // Fillers are cut wider by their scribe allowance (ADR-054); the model keeps the installed size.
    const cutPanel = (rp: RunPart, key: string) => {
      const p = runPanel(rp, key, joints.get(rp.id));
      return rp.scribe ? { ...p, box: { ...p.box, w: p.box.w + rp.scribe } } : p;
    };
    // One part at a time, so the sink and hob cut-outs and the corner joints (ADR-205) go in the row's notes column and
    // parts with different notes never share a row.
    for (const e of extra) {
      const model: FurnitureModel = {
        panels: [cutPanel(e.rp, e.key)],
        spaces: [],
        hardware: [],
        diagnostics: [],
        bounds: { x: 0, y: 0, z: 0, w: 0, h: 0, d: 0 },
      };
      for (const r of cutlist(model, mats)) {
        const drilling = [
          r.drilling,
          ...cutoutNotes(project, e.rp),
          ...(joints.get(e.rp.id)?.notes ?? []),
        ]
          .filter(Boolean)
          .join('; ');
        const key = [
          'run',
          r.materialId,
          r.length,
          r.width,
          r.edgesL,
          r.edgesW,
          bandKey(r.band),
          drilling,
        ].join('|');
        const labels = r.labels.map((l) => `Run: ${l}`);
        const cur = rows.get(key);
        if (cur) {
          cur.quantity += r.quantity;
          cur.panelIds.push(...r.panelIds);
          for (const l of labels) if (!cur.labels.includes(l)) cur.labels.push(l);
        } else rows.set(key, { ...r, drilling, labels });
      }
    }
  }
  const covered = plinthCovered(project);
  // Common tops and bottoms (ADR-165): members leave their own out, and each common panel is one row of its own.
  const common = commonBuilds(project);
  const shared = sharedBuilds(project);
  if (common.plans.size) {
    const pm = buildProjectModel(input);
    const model: FurnitureModel = {
      panels: pm.model.panels.filter((p) => p.id.startsWith('common:')),
      spaces: [],
      hardware: [],
      diagnostics: [],
      bounds: { x: 0, y: 0, z: 0, w: 0, h: 0, d: 0 },
    };
    for (const r of cutlist(model, pm.materials))
      rows.set(
        ['common', r.materialId, r.length, r.width, r.edgesL, r.edgesW, bandKey(r.band)].join('|'),
        r,
      );
  }
  for (const item of project.items) {
    const c = common.builds.get(item.id);
    const raw = buildModel(
      sharedDesign(c ? commonDesign(item.design, c) : item.design, shared.builds.get(item.id)),
    );
    const pins = shared.pins.get(item.id);
    const pinned = pins ? { ...raw, panels: withSharedPins(raw.panels, pins) } : raw;
    // A back cut around a pipe or outlet (ADR-205): its own row, noted with the cut-out.
    const cuts = item.backCuts?.length
      ? backCutsOf(
          item,
          pinned.panels,
          shared.builds.get(item.id)?.right ? buildModel(item.design).panels : pinned.panels,
          project.room,
        )
      : { shapes: new Map<string, PanelShape>(), features: [] };
    const built = cuts.shapes.size
      ? {
          ...pinned,
          panels: pinned.panels.map((p) =>
            cuts.shapes.has(p.id) ? { ...p, shape: cuts.shapes.get(p.id) } : p,
          ),
        }
      : pinned;
    const leaves = (p: Panel) =>
      (covered.has(item.id) && p.role === 'plinth') ||
      (!!c?.top && p.role === commonTopRole(item.design)) ||
      (!!c?.bottom && p.role === 'bottom');
    const model = built.panels.some(leaves)
      ? { ...built, panels: built.panels.filter((p) => !leaves(p)) }
      : built;
    for (const r of cutlist(model, item.design.materials)) {
      const mat = item.design.materials.find((m) => m.id === r.materialId)!;
      const id = materialKey(mat);
      const key = [
        id,
        r.length,
        r.width,
        r.edgesL,
        r.edgesW,
        r.drilling,
        bandKey(r.band),
        !!r.bandFront,
      ].join('|');
      const labels = r.labels.map((l) => `${item.design.name}: ${l}`);
      const panelIds = r.panelIds.map((p) => `${item.id}:${p}`);
      const cur = rows.get(key);
      if (cur) {
        cur.quantity += r.quantity * item.quantity;
        cur.panelIds.push(...panelIds);
        for (const l of labels) if (!cur.labels.includes(l)) cur.labels.push(l);
      } else
        rows.set(key, {
          ...r,
          materialId: id,
          quantity: r.quantity * item.quantity,
          labels,
          panelIds,
        });
    }
  }
  return [...rows.values()].sort(
    (a, b) =>
      a.materialName.localeCompare(b.materialName) ||
      b.thickness - a.thickness ||
      b.length - a.length ||
      b.width - a.width,
  );
}

export function projectHardware(input: Project): HardwareItem[] {
  const project = applyRunHandles(input);
  return hardwareSummary({
    panels: [],
    spaces: [],
    diagnostics: [],
    bounds: { x: 0, y: 0, z: 0, w: 0, h: 0, d: 0 },
    hardware: project.items.flatMap((i) =>
      buildModel(i.design).hardware.map((h) => ({ ...h, quantity: h.quantity * i.quantity })),
    ),
  });
}

export function projectNestingJobs(
  project: Project,
  rows = projectCutlist(project),
  materials = buildProjectModel(project).materials,
): NestJob[] {
  const kerf = project.cutting?.kerf ?? DEFAULT_KERF;
  const settings = new Map<string, SheetSettings>();
  for (const m of materials) {
    const s = sheetOf(m);
    settings.set(m.id, {
      sheet: { length: s.length, width: s.width, count: s.count },
      trim: s.trim,
      kerf,
    });
  }
  return jobsFromCutlist(rows, settings);
}

// ---------------------------------------------------------------------------
// Validation (storage, import)
// ---------------------------------------------------------------------------

const isObj = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === 'object' && !Array.isArray(v);
const isInt = (v: unknown, min = -1e7) =>
  typeof v === 'number' && Number.isSafeInteger(v) && v >= min && v <= 1e7;

/** Item clearance settings (ADR-073): whole-mm depths from 1 mm, a known side, a yes/no flag. */
function validZones(z: unknown): boolean {
  if (!isObj(z)) return false;
  const depth = (v: unknown) => isInt(v, 1) && (v as number) <= MAX_ZONE_DEPTH;
  const s = z.service;
  return (
    (z.chairDepth === undefined || depth(z.chairDepth)) &&
    (z.lyingDown === undefined || typeof z.lyingDown === 'boolean') &&
    (s === undefined ||
      (isObj(s) &&
        SERVICE_SIDES.includes(s.side as never) &&
        (s.depth === undefined || depth(s.depth))))
  );
}

const validBoard = (m: unknown) =>
  isObj(m) &&
  typeof m.id === 'string' &&
  typeof m.name === 'string' &&
  isInt(m.thickness, 1) &&
  typeof m.grain === 'boolean' &&
  (m.band === undefined || bandProblems(m.band).length === 0) &&
  (m.frontBand === undefined || bandProblems(m.frontBand).length === 0);

/** Project-wide settings (ADR-124): each one optional, each one checked. */
function validateSettings(s: unknown): string[] {
  if (!isObj(s)) return [t('Invalid project settings')];
  const errs: string[] = [];
  for (const k of ['body', 'front', 'back'] as const)
    if (s[k] !== undefined && !validBoard(s[k])) errs.push(t('Invalid project {k} board', { k }));
  const h = s.handle;
  if (
    h !== undefined &&
    h !== null &&
    !(
      isObj(h) &&
      ['bar', 'knob', 'push'].includes(h.kind as string) &&
      (h.holeSpacing === undefined || isInt(h.holeSpacing, 1)) &&
      (h.position === undefined || ['top', 'centre', 'bottom'].includes(h.position as string))
    )
  )
    errs.push(t('Invalid project handle'));
  if (s.frontStyle !== undefined && !['overlay', 'half', 'inset'].includes(s.frontStyle as string))
    errs.push(t('Invalid project front overlay'));
  if (
    s.plinthHeight !== undefined &&
    !(isInt(s.plinthHeight, 0) && (s.plinthHeight as number) <= 500)
  )
    errs.push(t('Project plinth height must be 0 to 500 mm'));
  return errs;
}

/** Variables and value sets (ADR-166, ADR-167). */
function validateVariables(p: Record<string, unknown>): string[] {
  const errs: string[] = [];
  const vars: ProjectVariable[] = [];
  if (p.variables !== undefined) {
    if (!Array.isArray(p.variables) || p.variables.length > MAX_VARIABLES)
      return [t('Invalid variables')];
    if ((p.schemaVersion as number) < VARIABLES_SINCE)
      errs.push(t('Variables need project schemaVersion {v}', { v: VARIABLES_SINCE }));
    for (const v of p.variables) {
      if (
        !isObj(v) ||
        typeof v.id !== 'string' ||
        !v.id ||
        typeof v.name !== 'string' ||
        v.name.length > MAX_VARIABLE_NAME ||
        typeof v.expr !== 'string' ||
        v.expr.length > MAX_EXPR ||
        nameProblem(v.name, vars, false) !== null ||
        vars.some((x) => x.id === v.id)
      ) {
        errs.push(t('Invalid variable'));
        continue;
      }
      vars.push({ id: v.id, name: v.name, expr: v.expr });
    }
  }
  if (p.variableSets !== undefined) {
    if (!Array.isArray(p.variableSets) || p.variableSets.length > MAX_VARIABLES)
      return [...errs, t('Invalid value sets')];
    if ((p.schemaVersion as number) < VARIABLES_SINCE)
      errs.push(t('Value sets need project schemaVersion {v}', { v: VARIABLES_SINCE }));
    const ids = new Set<string>();
    for (const s of p.variableSets) {
      if (
        !isObj(s) ||
        typeof s.id !== 'string' ||
        !s.id ||
        ids.has(s.id) ||
        typeof s.name !== 'string' ||
        !s.name ||
        s.name.length > MAX_VARIABLE_NAME ||
        !isObj(s.values) ||
        !Object.values(s.values).every((x) => typeof x === 'string' && x.length <= MAX_EXPR) ||
        !isObj(s.origin) ||
        !isInt(s.origin.x) ||
        !isInt(s.origin.z)
      ) {
        errs.push(t('Invalid value set'));
        continue;
      }
      ids.add(s.id);
    }
    if (Array.isArray(p.items))
      for (const it of p.items)
        if (isObj(it) && isObj(it.set) && typeof it.set.id === 'string' && !ids.has(it.set.id))
          errs.push(t('Item {id}: unknown value set', { id: String(it.id) }));
  }
  return errs;
}

export function validateProject(p: unknown): string[] {
  if (!isObj(p)) return [t('Project must be an object')];
  const errs: string[] = [];
  if (!PROJECT_SCHEMAS.includes(p.schemaVersion as number))
    errs.push(t('Unsupported project schemaVersion'));
  if (typeof p.id !== 'string' || !p.id || typeof p.name !== 'string' || !p.name)
    errs.push(t('Missing project id or name'));
  if (
    p.cutting !== undefined &&
    !(isObj(p.cutting) && isInt(p.cutting.kerf, 0) && (p.cutting.kerf as number) <= 20)
  )
    errs.push(t('Invalid cutting settings'));
  if (!Array.isArray(p.items)) return [...errs, t('Items missing')];
  const ids = new Set<string>();
  for (const it of p.items) {
    if (!isObj(it) || typeof it.id !== 'string' || !it.id) {
      errs.push(t('Invalid item'));
      continue;
    }
    if (ids.has(it.id)) errs.push(t('Duplicate item {id}', { id: it.id }));
    ids.add(it.id);
    if (!isInt(it.quantity, 1) || (it.quantity as number) > 99)
      errs.push(t('Item quantity must be 1 to 99'));
    if (
      !isObj(it.position) ||
      !isInt(it.position.x) ||
      !isInt(it.position.y, 0) ||
      !isInt(it.position.z)
    )
      errs.push(t('Item position must be whole mm (height ≥ 0)'));
    if (![0, 90, 180, 270].includes(it.rotationY as number))
      errs.push(t('Item rotation must be a quarter turn'));
    if (it.angle !== undefined) {
      if (!isInt(it.angle, 1) || (it.angle as number) > 89)
        errs.push(t('Item angle must be whole degrees from 1 to 89'));
      else if ((p.schemaVersion as number) < ANGLE_SINCE)
        errs.push(t('Pieces at an angle need project schemaVersion {v}', { v: ANGLE_SINCE }));
    }
    const pl = it.placement;
    if (
      pl !== undefined &&
      !(
        isObj(pl) &&
        (pl.kind === 'floor' ||
          (pl.kind === 'wall' && isInt(pl.height, 0)) ||
          (pl.kind === 'above' &&
            typeof pl.baseId === 'string' &&
            !!pl.baseId &&
            pl.baseId !== it.id &&
            isInt(pl.gap, 0) &&
            isInt(pl.offsetX)))
      )
    )
      errs.push(t('Invalid item placement'));
    if (it.zones !== undefined && !validZones(it.zones))
      errs.push(t('Invalid item clearance zones'));
    if (it.locked !== undefined) {
      if (it.locked !== true) errs.push(t('Invalid item lock'));
      else if ((p.schemaVersion as number) < LOCKS_SINCE)
        errs.push(t('Locked pieces need project schemaVersion {v}', { v: LOCKS_SINCE }));
    }
    if (it.templateSeen !== undefined) {
      if (!isInt(it.templateSeen, 1)) errs.push(t('Invalid kept template revision'));
      else if ((p.schemaVersion as number) < TEMPLATE_SEEN_SINCE)
        errs.push(
          t('Kept template revisions need project schemaVersion {v}', { v: TEMPLATE_SEEN_SINCE }),
        );
    }
    if (it.linkId !== undefined) {
      if (typeof it.linkId !== 'string' || !it.linkId || it.linkId.length > 100)
        errs.push(t('Invalid item link'));
      else if ((p.schemaVersion as number) < LINKS_SINCE)
        errs.push(t('Linked copies need project schemaVersion {v}', { v: LINKS_SINCE }));
    }
    if (it.turnLocked !== undefined) {
      if (it.turnLocked !== true) errs.push(t('Invalid item turn lock'));
      else if ((p.schemaVersion as number) < PARAM_LOCKS_SINCE)
        errs.push(
          t('Turn and size locks need project schemaVersion {v}', { v: PARAM_LOCKS_SINCE }),
        );
    }
    for (const [key, bad] of [
      ['boardsLocked', t('Invalid item boards lock')],
      ['constructionLocked', t('Invalid item construction lock')],
    ] as const) {
      if (it[key] === undefined) continue;
      if (it[key] !== true) errs.push(bad);
      else if ((p.schemaVersion as number) < PIECE_LOCKS_SINCE)
        errs.push(
          t('Board and construction locks need project schemaVersion {v}', {
            v: PIECE_LOCKS_SINCE,
          }),
        );
    }
    if (it.sizeLocks !== undefined) {
      if (
        !Array.isArray(it.sizeLocks) ||
        !it.sizeLocks.length ||
        !it.sizeLocks.every((a) => (SIZE_AXES as readonly unknown[]).includes(a)) ||
        new Set(it.sizeLocks).size !== it.sizeLocks.length
      )
        errs.push(t('Invalid item size locks'));
      else if ((p.schemaVersion as number) < PARAM_LOCKS_SINCE)
        errs.push(
          t('Turn and size locks need project schemaVersion {v}', { v: PARAM_LOCKS_SINCE }),
        );
    }
    if (it.sizeLocked !== undefined) {
      if (it.sizeLocked !== true) errs.push(t('Invalid item size lock'));
      else if ((p.schemaVersion as number) < SIZE_LOCK_SINCE)
        errs.push(t('Size-locked pieces need project schemaVersion {v}', { v: SIZE_LOCK_SINCE }));
    }
    if (it.ref !== undefined) {
      if (!isObj(it.ref) || !isObj(it.ref.overrides)) errs.push(t('Invalid template reference'));
      else if ((p.schemaVersion as number) < REFS_SINCE)
        errs.push(t('Template references need project schemaVersion {v}', { v: REFS_SINCE }));
    }
    if (it.bindings !== undefined) {
      if (
        !Array.isArray(it.bindings) ||
        !it.bindings.every(
          (b) =>
            isObj(b) &&
            isBindTarget(b.target) &&
            typeof b.expr === 'string' &&
            b.expr.length <= MAX_EXPR,
        ) ||
        new Set(it.bindings.map((b) => (isObj(b) ? b.target : ''))).size !== it.bindings.length
      )
        errs.push(t('Invalid item bindings'));
      else if ((p.schemaVersion as number) < VARIABLES_SINCE)
        errs.push(t('Bindings need project schemaVersion {v}', { v: VARIABLES_SINCE }));
    }
    if (it.set !== undefined) {
      if (!isObj(it.set) || typeof it.set.id !== 'string' || typeof it.set.of !== 'string')
        errs.push(t('Invalid item value set'));
      else if ((p.schemaVersion as number) < VARIABLES_SINCE)
        errs.push(t('Value sets need project schemaVersion {v}', { v: VARIABLES_SINCE }));
    }
    if (it.backCuts !== undefined) {
      if (
        !Array.isArray(it.backCuts) ||
        !it.backCuts.length ||
        !it.backCuts.every((x) => typeof x === 'string' && !!x) ||
        new Set(it.backCuts).size !== it.backCuts.length
      )
        errs.push(t('Invalid back cut-outs'));
      else if ((p.schemaVersion as number) < KITCHEN_SINCE)
        errs.push(t('Backs cut around pipes need project schemaVersion {v}', { v: KITCHEN_SINCE }));
    }
    const de = validateDesign(it.design);
    if (de.length) errs.push(t('Item {id}: {problem}', { id: String(it.id), problem: de[0] }));
  }
  errs.push(...validateVariables(p));
  if (p.runParts !== undefined) {
    if (!Array.isArray(p.runParts)) errs.push(t('Invalid run parts'));
    else
      for (const rp of p.runParts) {
        const b = isObj(rp) ? rp.box : null;
        const m = isObj(rp) ? rp.material : null;
        if (
          !isObj(rp) ||
          typeof rp.id !== 'string' ||
          !['worktop', 'filler', 'cover', 'plinth', ...TRIM_KINDS].includes(rp.kind as string) ||
          typeof rp.label !== 'string' ||
          typeof rp.reason !== 'string' ||
          (rp.key !== undefined && typeof rp.key !== 'string') ||
          (rp.from !== undefined &&
            !(Array.isArray(rp.from) && rp.from.every((x) => typeof x === 'string'))) ||
          (rp.scribe !== undefined && !isInt(rp.scribe, 0)) ||
          (rp.changed !== undefined && typeof rp.changed !== 'string') ||
          !isObj(b) ||
          !['x', 'y', 'z'].every((k) => isInt(b[k])) ||
          !['w', 'h', 'd'].every((k) => isInt(b[k], 1)) ||
          !isObj(m) ||
          typeof m.name !== 'string' ||
          !isInt(m.thickness, 1) ||
          typeof m.grain !== 'boolean' ||
          (m.band !== undefined && bandProblems(m.band).length > 0) ||
          (m.frontBand !== undefined && bandProblems(m.frontBand).length > 0) ||
          !['x', 'y', 'z'].includes(rp.thicknessAxis as string) ||
          !['x', 'y', 'z'].includes(rp.grainAxis as string) ||
          !Array.isArray(rp.banded)
        )
          errs.push(t('Invalid run part'));
      }
  }
  if (
    p.runSettings !== undefined &&
    !(
      isObj(p.runSettings) &&
      isInt(p.runSettings.scribe, 0) &&
      (p.runSettings.scribe as number) <= 200 &&
      typeof p.runSettings.auto === 'boolean'
    )
  )
    errs.push(t('Invalid run settings'));
  if (p.runRequests !== undefined) {
    if (!Array.isArray(p.runRequests)) errs.push(t('Invalid run requests'));
    else
      for (const r of p.runRequests) {
        const m = isObj(r) ? r.material : undefined;
        if (
          !isObj(r) ||
          !['worktop', ...TRIM_KINDS].includes(r.kind as string) ||
          !Array.isArray(r.from) ||
          !r.from.length ||
          !r.from.every((x) => typeof x === 'string') ||
          (r.front !== undefined && !(isInt(r.front, 0) && (r.front as number) <= 1000)) ||
          (r.side !== undefined && !(isInt(r.side, 0) && (r.side as number) <= 1000)) ||
          (r.height !== undefined && !(isInt(r.height, 1) && (r.height as number) <= 3000)) ||
          (m !== undefined &&
            !(
              isObj(m) &&
              typeof m.name === 'string' &&
              isInt(m.thickness, 1) &&
              typeof m.grain === 'boolean'
            ))
        )
          errs.push(t('Invalid run request'));
      }
  }
  // Run requests and trim run parts came with version 2 (ADR-075).
  if (
    (p.schemaVersion as number) < RUN_REQUESTS_SINCE &&
    (p.runRequests !== undefined ||
      (Array.isArray(p.runParts) &&
        p.runParts.some((rp) => isObj(rp) && TRIM_KINDS.includes(rp.kind as TrimKind))))
  )
    errs.push(
      t('Trims and chosen worktops need project schemaVersion {v}', { v: RUN_REQUESTS_SINCE }),
    );
  if (p.room !== undefined) {
    errs.push(...validateRoom(p.room));
    if (isObj(p.room) && p.room.walls !== undefined && (p.schemaVersion as number) < WALLS_SINCE)
      errs.push(t('Wall backgrounds need project schemaVersion {v}', { v: WALLS_SINCE }));
    if (
      isObj(p.room) &&
      Array.isArray(p.room.walls) &&
      p.room.walls.some(
        (f) =>
          isObj(f) &&
          isObj(f.image) &&
          (f.image.fit !== undefined || f.image.straighten !== undefined),
      ) &&
      (p.schemaVersion as number) < FITTED_WALLS_SINCE
    )
      errs.push(
        t('Fitted wall pictures need project schemaVersion {v}', { v: FITTED_WALLS_SINCE }),
      );
  }
  if (
    p.runPartsRemoved !== undefined &&
    !(Array.isArray(p.runPartsRemoved) && p.runPartsRemoved.every((k) => typeof k === 'string'))
  )
    errs.push(t('Invalid removed run parts'));
  if (p.groups !== undefined) {
    if ((p.schemaVersion as number) < GROUPS_SINCE)
      errs.push(t('Groups need project schemaVersion {v}', { v: GROUPS_SINCE }));
    const grouped = new Set<string>();
    const groupIds = new Set<string>();
    if (!Array.isArray(p.groups)) errs.push(t('Invalid groups'));
    else
      for (const g of p.groups) {
        if (
          !isObj(g) ||
          typeof g.id !== 'string' ||
          !g.id ||
          groupIds.has(g.id) ||
          typeof g.name !== 'string' ||
          !g.name.trim() ||
          g.name.length > 200 ||
          !Array.isArray(g.itemIds) ||
          g.itemIds.length < 2 ||
          !g.itemIds.every((x) => typeof x === 'string' && ids.has(x) && !grouped.has(x))
        ) {
          errs.push(t('Invalid group'));
          continue;
        }
        groupIds.add(g.id);
        for (const x of g.itemIds) grouped.add(x as string);
      }
  }
  if (p.common !== undefined) {
    if ((p.schemaVersion as number) < COMMON_SINCE)
      errs.push(t('Common tops and bottoms need project schemaVersion {v}', { v: COMMON_SINCE }));
    const seen = new Set<string>();
    const inKind = { top: new Set<string>(), bottom: new Set<string>() };
    if (!Array.isArray(p.common)) errs.push(t('Invalid common tops and bottoms'));
    else
      for (const c of p.common) {
        if (
          !isObj(c) ||
          typeof c.id !== 'string' ||
          !c.id ||
          seen.has(c.id) ||
          (c.kind !== 'top' && c.kind !== 'bottom') ||
          !Array.isArray(c.itemIds) ||
          c.itemIds.length < 2 ||
          !c.itemIds.every(
            (x) =>
              typeof x === 'string' && ids.has(x) && !inKind[c.kind as 'top' | 'bottom'].has(x),
          )
        ) {
          errs.push(t('Invalid common top or bottom'));
          continue;
        }
        seen.add(c.id);
        for (const x of c.itemIds) inKind[c.kind as 'top' | 'bottom'].add(x as string);
      }
  }
  if (p.sharedSides !== undefined) {
    if ((p.schemaVersion as number) < SHARED_SINCE)
      errs.push(t('Shared sides need project schemaVersion {v}', { v: SHARED_SINCE }));
    const seen = new Set<string>();
    const sharing = new Set<string>();
    if (!Array.isArray(p.sharedSides)) errs.push(t('Invalid shared sides'));
    else
      for (const c of p.sharedSides) {
        if (
          !isObj(c) ||
          typeof c.id !== 'string' ||
          !c.id ||
          seen.has(c.id) ||
          !Array.isArray(c.itemIds) ||
          c.itemIds.length < 2 ||
          !c.itemIds.every((x) => typeof x === 'string' && ids.has(x) && !sharing.has(x))
        ) {
          errs.push(t('Invalid shared sides'));
          continue;
        }
        seen.add(c.id);
        for (const x of c.itemIds) sharing.add(x as string);
      }
  }
  if (p.connections !== undefined) {
    if ((p.schemaVersion as number) < CONNECTIONS_SINCE)
      errs.push(t('Connections need project schemaVersion {v}', { v: CONNECTIONS_SINCE }));
    const seen = new Set<string>();
    const pairs = new Set<string>();
    if (!Array.isArray(p.connections)) errs.push(t('Invalid connections'));
    else
      for (const c of p.connections) {
        // A kind (ADR-207) needs version 21; a wall connection holds one piece and the index of its wall.
        const kind = isObj(c) ? c.kind : undefined;
        if (kind !== undefined && (p.schemaVersion as number) < CONNECTION_KINDS_SINCE) {
          errs.push(
            t('Connection kinds need project schemaVersion {v}', { v: CONNECTION_KINDS_SINCE }),
          );
          continue;
        }
        const wall = kind === 'wall';
        const pair = isObj(c) && Array.isArray(c.itemIds) ? (c.itemIds as unknown[]) : null;
        // A wall connection holds its one piece twice (ADR-207).
        const key =
          pair &&
          pair.length === 2 &&
          pair.every((x) => typeof x === 'string') &&
          (!wall || pair[0] === pair[1])
            ? wall
              ? `wall:${pair[0] as string}:${String(c.wall)}`
              : [...(pair as string[])].sort().join('|')
            : '';
        if (
          !isObj(c) ||
          typeof c.id !== 'string' ||
          !c.id ||
          seen.has(c.id) ||
          (kind !== undefined && !['side', 'corner', 'stacked', 'wall'].includes(kind as string)) ||
          (wall ? !isInt(c.wall, 0) || (c.wall as number) > 999 : c.wall !== undefined) ||
          !key ||
          (!wall && pair![0] === pair![1]) ||
          !pair!.every((x) => ids.has(x as string)) ||
          pairs.has(key)
        ) {
          errs.push(t('Invalid connection'));
          continue;
        }
        seen.add(c.id);
        pairs.add(key);
      }
  }
  if (p.settings !== undefined) {
    if ((p.schemaVersion as number) < REFS_SINCE)
      errs.push(t('Project settings need project schemaVersion {v}', { v: REFS_SINCE }));
    errs.push(...validateSettings(p.settings));
  }
  if (p.runHandles !== undefined || p.sinks !== undefined) {
    if ((p.schemaVersion as number) < RUN_EXTRAS_SINCE)
      errs.push(t('Run handles and sinks need project schemaVersion {v}', { v: RUN_EXTRAS_SINCE }));
    const strs = (v: unknown) => Array.isArray(v) && v.every((x) => typeof x === 'string');
    if (p.runHandles !== undefined) {
      if (!Array.isArray(p.runHandles)) errs.push(t('Invalid run handles'));
      else
        for (const rh of p.runHandles) {
          const h = isObj(rh) ? rh.handle : null;
          if (
            !isObj(rh) ||
            typeof rh.id !== 'string' ||
            !rh.id ||
            !strs(rh.from) ||
            !(rh.from as string[]).length ||
            (rh.own !== undefined && !strs(rh.own)) ||
            (rh.height !== undefined && !(isInt(rh.height, 1) && (rh.height as number) <= 3000)) ||
            !isObj(h) ||
            !['bar', 'knob', 'push'].includes(h.kind as string) ||
            (h.holeSpacing !== undefined && !BAR_SPACINGS.includes(h.holeSpacing as number))
          )
            errs.push(t('Invalid run handle'));
        }
    }
    if (p.sinks !== undefined) {
      if (!Array.isArray(p.sinks)) errs.push(t('Invalid sinks'));
      else
        for (const sk of p.sinks)
          if (
            !isObj(sk) ||
            typeof sk.id !== 'string' ||
            !sk.id ||
            typeof sk.baseId !== 'string' ||
            !ids.has(sk.baseId) ||
            !isInt(sk.w, 1) ||
            (sk.w as number) > 3000 ||
            !isInt(sk.d, 1) ||
            (sk.d as number) > 3000
          )
            errs.push(t('Invalid sink'));
    }
  }
  if (p.runProducts !== undefined) {
    if ((p.schemaVersion as number) < RUN_PRODUCTS_SINCE)
      errs.push(t('Run part products need project schemaVersion {v}', { v: RUN_PRODUCTS_SINCE }));
    if (!isObj(p.runProducts) || Object.keys(p.runProducts).length > 500)
      errs.push(t('Invalid run part products'));
    else
      for (const [k, v] of Object.entries(p.runProducts))
        if (
          !k ||
          k.length > 300 ||
          productRefProblems(v).length > 0 ||
          !validPer((v as { per?: unknown }).per)
        )
          errs.push(t('Invalid run part product for {k}', { k }));
  }
  // Hobs and worktop corner joints (ADR-205).
  if (p.hobs !== undefined) {
    if ((p.schemaVersion as number) < KITCHEN_SINCE)
      errs.push(t('Hobs need project schemaVersion {v}', { v: KITCHEN_SINCE }));
    if (!Array.isArray(p.hobs)) errs.push(t('Invalid hobs'));
    else
      for (const hb of p.hobs)
        if (
          !isObj(hb) ||
          typeof hb.id !== 'string' ||
          !hb.id ||
          typeof hb.baseId !== 'string' ||
          !ids.has(hb.baseId) ||
          !isInt(hb.w, 1) ||
          (hb.w as number) > 3000 ||
          !isInt(hb.d, 1) ||
          (hb.d as number) > 3000
        )
          errs.push(t('Invalid hob'));
  }
  if (p.worktopJoints !== undefined) {
    if ((p.schemaVersion as number) < KITCHEN_SINCE)
      errs.push(t('Worktop joints need project schemaVersion {v}', { v: KITCHEN_SINCE }));
    if (!Array.isArray(p.worktopJoints)) errs.push(t('Invalid worktop joints'));
    else {
      const seen = new Set<string>();
      for (const j of p.worktopJoints) {
        if (
          !isObj(j) ||
          typeof j.id !== 'string' ||
          !j.id ||
          seen.has(j.id) ||
          typeof j.a !== 'string' ||
          !j.a ||
          typeof j.b !== 'string' ||
          !j.b ||
          j.a === j.b ||
          (j.kind !== 'mitre' && j.kind !== 'butt') ||
          (j.through !== undefined && j.through !== 'a' && j.through !== 'b')
        ) {
          errs.push(t('Invalid worktop joint'));
          continue;
        }
        seen.add(j.id);
      }
    }
  }
  if (p.models !== undefined) {
    if ((p.schemaVersion as number) < MODELS_SINCE)
      errs.push(t('3D models need project schemaVersion {v}', { v: MODELS_SINCE }));
    errs.push(...validateModelItems(p.models, ids));
    if (Array.isArray(p.models)) {
      const pieces = new Set(
        p.items.flatMap((it) => (isObj(it) && typeof it.id === 'string' ? [it.id] : [])),
      );
      for (const m of p.models) {
        const pl = isObj(m) ? m.placement : undefined;
        if (pl === undefined) continue;
        if ((p.schemaVersion as number) < SURFACES_SINCE)
          errs.push(t('Placed 3D models need project schemaVersion {v}', { v: SURFACES_SINCE }));
        // A model stands on a piece, never on another model (ADR-208).
        if (isObj(pl) && pl.kind === 'above' && !pieces.has(pl.baseId as string))
          errs.push(t('Invalid 3D model placement'));
      }
    }
  }
  if (p.planPicture !== undefined) {
    if ((p.schemaVersion as number) < SURFACES_SINCE)
      errs.push(t('Plan pictures need project schemaVersion {v}', { v: SURFACES_SINCE }));
    errs.push(...planPictureProblems(p.planPicture));
  }
  if (isObj(p.room) && p.room.floor !== undefined && (p.schemaVersion as number) < SURFACES_SINCE)
    errs.push(t('Floor backgrounds need project schemaVersion {v}', { v: SURFACES_SINCE }));
  return errs;
}
