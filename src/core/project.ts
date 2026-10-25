/**
 * Projects (ADR-022): several pieces placed in a room, cut and bought together.
 * Each item embeds its own copy of a design (library edits never flow in by themselves); positions are whole
 * millimetres and rotations quarter turns about the vertical axis, so every panel stays an axis-aligned box.
 */
import { buildModel } from './build';
import { localClearances, type Clearance } from './clearance';
import { outlineIssues, roomChecks, serviceChecks, validateRoom, type Room } from './room';
import { cutlist, hardwareSummary, type CutRow } from './cutlist';
import { DEFAULT_KERF, newId, sheetOf, upgradeDesign, validateDesign } from './design';
import { overlaps, union } from './geometry';
import { aabbOf, overlapsBox, panelsOverlap, turnShape } from './shape';
import type { SheetSettings } from './nesting';
import { jobsFromCutlist } from './nesting';
import type { NestJob } from './nesting/types';
import type {
  Box,
  CabinetParams,
  Design,
  Diagnostic,
  Face,
  FurnitureModel,
  HardwareItem,
  Material,
  Mm,
  Panel,
} from './types';

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
}

/**
 * A part that belongs to a run of pieces rather than to any one of them (ADR-036): the worktop over a run of base
 * units, a filler in a gap between two of them, a cover panel on an exposed end. Stored with its room position and
 * its own copy of the board, so it survives edits of the pieces; the reason says why it was added.
 */
export interface RunPart {
  id: string;
  kind: 'worktop' | 'filler' | 'cover' | 'plinth';
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

/**
 * Project document versions (ADR-011): new and edited projects are written at `PROJECT_SCHEMA`; every version in
 * `PROJECT_SCHEMAS` still loads unchanged. 2 = room pipes and outlets (ADR-072).
 */
export const PROJECT_SCHEMA = 2;
export const PROJECT_SCHEMAS: readonly number[] = [1, PROJECT_SCHEMA];
export type ProjectSchemaVersion = 1 | typeof PROJECT_SCHEMA;

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
  /** The room: walls, doors, windows, obstacles (ADR-058/0056). Absent = no room checks. */
  room?: Room;
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
    ? d.product.kind === 'cabinet'
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
  };
}

/** The piece is built to hang on the wall (brackets and rail scheduled). */
export const isWallHung = (d: Design) =>
  d.product.kind === 'cabinet' && d.product.params.mount === 'wall';

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
  return items.every((it, i) => it === project.items[i]) ? project : { ...project, items };
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
 * A piece placed on or above another piece leaves it when dragged (ADR-065): wall-hung pieces become hung on the
 * wall at their current height, anything else stands on the floor. Other placements are returned unchanged.
 */
export function liftOff(item: ProjectItem): Placement | undefined {
  if (item.placement?.kind !== 'above') return item.placement;
  return isWallHung(item.design) ? { kind: 'wall', height: item.position.y } : { kind: 'floor' };
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
  return { ...project, items };
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
          message: `${name} was placed on a piece that is no longer in the project; it stays where it is.`,
          nodeId: it.id,
        });
      else if (!placementBases(project, it.id).some((b) => b.id === base.id))
        out.push({
          severity: 'error',
          code: 'placement-cycle',
          message: `${name} and ${base.design.name} are placed on each other.`,
          nodeId: it.id,
        });
    }
    const hangs = pl?.kind === 'wall' ? pl.height > 0 : pl?.kind === 'above' ? pl.gap > 0 : false;
    if (hangs && !isWallHung(it.design))
      out.push({
        severity: 'warning',
        code: 'placement-not-hung',
        message: `${name} is off the floor with nothing under it; set it to hang on wall brackets (Whole cabinet → Stands on).`,
        nodeId: it.id,
      });
    if (pl?.kind === 'floor' && isWallHung(it.design))
      out.push({
        severity: 'warning',
        code: 'placement-wall-on-floor',
        message: `${name} is built to hang on the wall but is placed on the floor.`,
        nodeId: it.id,
      });
  }
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
}

/** Build one item and move its panels into the room. Panel and node ids are prefixed with the item id. */
export function placeItem(item: ProjectItem, opts?: { noPlinth?: boolean }): PlacedPiece {
  const built = buildModel(item.design);
  // A run plinth replaces the piece's own plinth (ADR-054).
  const model = opts?.noPlinth
    ? { ...built, panels: built.panels.filter((p) => p.role !== 'plinth') }
    : built;
  const r = item.rotationY;
  const rotated = model.panels.map((p) => rotateBox(p.box, r));
  // The piece is placed by its full outline, so leaving the plinth out does not move it.
  const rb = union(built.panels.map((p) => rotateBox(aabbOf(p), r)));
  const dx = item.position.x - rb.x,
    dy = item.position.y - rb.y,
    dz = item.position.z - rb.z;
  const panels = model.panels.map((p, i): Panel => ({
    ...p,
    id: `${item.id}:${p.id}`,
    nodeId: `${item.id}:${p.nodeId}`,
    box: { ...rotated[i], x: rotated[i].x + dx, y: rotated[i].y + dy, z: rotated[i].z + dz },
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
  const full = { x: rb.x + dx, y: rb.y + dy, z: rb.z + dz, w: rb.w, h: rb.h, d: rb.d };
  const clearances = localClearances(model).map((c) => {
    const rc = rotateBox(c.box, r);
    return {
      ...c,
      panelId: `${item.id}:${c.panelId}`,
      box: { ...rc, x: rc.x + dx, y: rc.y + dy, z: rc.z + dz },
    };
  });
  const facing = FACING[r];
  return {
    item,
    model,
    panels,
    bounds: model === built ? union(panels.map(aabbOf)) : full,
    clearances,
    facing,
  };
}

export const placedBounds = (item: ProjectItem): Box => placeItem(item).bounds;

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
}

export function buildProjectModel(input: Project): ProjectModel {
  const project = resolvePlacements(input);
  const covered = plinthCovered(project);
  const pieces = project.items.map((i) => placeItem(i, { noPlinth: covered.has(i.id) }));
  const materials = new Map<string, Material>();
  const panels: Panel[] = [];
  const piecePanels: Panel[][] = [];
  const hardware: HardwareItem[] = [];
  const diagnostics: Diagnostic[] = placementIssues(project);
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
          message: `${m.name} has different sheet settings in ${pc.item.design.name}; the first piece's sheet (${a.length} × ${a.width}) is used for the whole project.`,
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
        message: `${pc.item.design.name} has ${errs} ${errs === 1 ? 'problem' : 'problems'}; open it to fix.`,
        nodeId: pc.item.id,
      });
  }
  // Pieces may touch but not occupy the same space (bounding boxes first, then panels).
  for (let a = 0; a < pieces.length; a++)
    for (let b = a + 1; b < pieces.length; b++) {
      if (!overlaps(pieces[a].bounds, pieces[b].bounds)) continue;
      const hit = pieces[a].panels.find((p) => pieces[b].panels.some((q) => panelsOverlap(p, q)));
      if (hit)
        diagnostics.push({
          severity: 'error',
          code: 'pieces-overlap',
          message: `${pieces[a].item.design.name} and ${pieces[b].item.design.name} overlap in the room.`,
          nodeId: pieces[b].item.id,
        });
    }
  for (const pc of pieces)
    if (pc.bounds.y < 0)
      diagnostics.push({
        severity: 'error',
        code: 'below-floor',
        message: `${pc.item.design.name} goes below the floor.`,
        nodeId: pc.item.id,
      });
  // Run parts (ADR-036): their own panels, checked against every piece like pieces are against each other.
  const placedById = new Map(pieces.map((pc) => [pc.item.id, pc]));
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
        message: `${rp.label} was made for pieces that changed or were removed; suggest the run parts again.`,
        nodeId: `run:${rp.id}`,
      });
    const k = materialKey(rp.material);
    if (!materials.has(k)) materials.set(k, { ...rp.material, id: k, sheet: sheetOf(rp.material) });
    const panel = runPanel(rp, k);
    panels.push(panel);
    piecePanels.push([panel]);
    const hit = pieces.find(
      (pc) => overlaps(pc.bounds, rp.box) && pc.panels.some((q) => overlapsBox(q, rp.box)),
    );
    if (hit)
      diagnostics.push({
        severity: 'error',
        code: 'run-part-overlap',
        message: `${rp.label} overlaps ${hit.item.design.name}; suggest the run parts again after moving pieces.`,
        nodeId: `run:${rp.id}`,
      });
  }
  // The room (ADR-058): walls, obstacles, door swings and windows; obstacles also block openings (ADR-057).
  const rc = project.room
    ? roomChecks(
        project.room,
        pieces.map((pc) => ({
          id: pc.item.id,
          name: pc.item.design.name,
          bounds: pc.bounds,
          hitsPanels: (b: Box) => pc.panels.some((q) => overlapsBox(q, b)),
          covers: (b: Box) =>
            pc.panels.find((q) => COVER_ROLES.has(q.role) && overlapsBox(q, b))?.role ?? null,
          clearances: pc.clearances,
        })),
      )
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
  const blocked = openingChecks(pieces, panels, diagnostics, rc?.obstacles ?? []);
  const model: FurnitureModel = {
    panels,
    spaces: [],
    hardware,
    diagnostics,
    bounds: union(panels.map(aabbOf)),
  };
  return { pieces, model, piecePanels, materials: [...materials.values()], diagnostics, blocked };
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
            name: q.id.startsWith('run:')
              ? q.label
              : (pieces.find((o) => q.id.startsWith(`${o.item.id}:`))?.item.design.name ?? q.label),
          })),
        ...obstacles
          .filter((o) => overlaps(o.box, c.box))
          .map((o) => ({ box: o.box, name: o.label })),
      ];
      if (!hits.length) continue;
      const near = hits.reduce((a, b) =>
        freeBefore(c, pc.facing, b.box) < freeBefore(c, pc.facing, a.box) ? b : a,
      );
      blocked.push({ itemId: pc.item.id, box: c.box });
      diagnostics.push({
        severity: 'warning',
        code: 'opening-blocked',
        message: `${c.label} of ${pc.item.design.name} cannot open fully: it hits ${near.name} (needs ${c.need} mm, ${freeBefore(c, pc.facing, near.box)} mm free).`,
        nodeId: pc.item.id,
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
        message: `${clash.label} of ${pieces[a].item.design.name} and ${other.label} of ${pieces[b].item.design.name} open into the same space.`,
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
 * on its right in the same run move by the same amount, so the rest of the run keeps its spacing.
 */
export function setGapLeft(project: Project, id: string, gap: Mm, moveRight = true): Project {
  const nb = leftNeighbour(project, id);
  const me = project.items.find((i) => i.id === id);
  if (!nb || !me || !Number.isSafeInteger(gap) || gap < 0) return project;
  const dx = gap - nb.gap;
  if (!dx) return project;
  const mine = placedBounds(me);
  const moves = (it: ProjectItem) => {
    if (it.id === id) return true;
    if (it.placement?.kind === 'above') return false;
    if (!moveRight) return false;
    const b = placedBounds(it);
    return b.x >= mine.x + mine.w && sameRun(b, mine);
  };
  return resolvePlacements({
    ...project,
    items: project.items.map((it) =>
      moves(it) ? { ...it, position: { ...it.position, x: it.position.x + dx } } : it,
    ),
  });
}

/** Pieces whose own plinth is replaced by a run plinth (ADR-054). */
export function plinthCovered(project: Project): Set<string> {
  return new Set(
    (project.runParts ?? []).filter((r) => r.kind === 'plinth').flatMap((r) => r.from ?? []),
  );
}

const runPanel = (rp: RunPart, materialId: string): Panel => ({
  id: `run:${rp.id}`,
  nodeId: `run:${rp.id}`,
  role:
    rp.kind === 'worktop'
      ? 'worktop'
      : rp.kind === 'filler'
        ? 'filler'
        : rp.kind === 'plinth'
          ? 'plinth'
          : 'cover-panel',
  label: rp.label,
  materialId,
  box: rp.box,
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

/** Runs of base units: floor cabinets/corners facing the room, side by side with gaps up to 150 mm, left → right. */
function groupRuns(placed: PlacedPiece[]): PlacedPiece[][] {
  const base = placed
    .filter((pc) => {
      const k = pc.item.design.product.kind;
      return (
        (k === 'cabinet' || k === 'corner') &&
        pc.item.rotationY === 0 &&
        pc.bounds.y === 0 &&
        pc.bounds.h <= RUN_MAX_HEIGHT &&
        !isWallHung(pc.item.design)
      );
    })
    .sort((a, b) => a.bounds.x - b.bounds.x);
  const runs: PlacedPiece[][] = [];
  for (const pc of base) {
    const run = runs.find((r) => {
      const last = r[r.length - 1];
      const gap = pc.bounds.x - (last.bounds.x + last.bounds.w);
      return (
        gap >= 0 &&
        gap <= FILLER_MAX_GAP &&
        spans(last.bounds.z, last.bounds.z + last.bounds.d, pc.bounds.z, pc.bounds.z + pc.bounds.d)
      );
    });
    if (run) run.push(pc);
    else runs.push([pc]);
  }
  return runs;
}

/** The ids of the run a piece belongs to (the same runs the run parts use), or null. */
export function runOf(project: Project, id: string): string[] | null {
  const ids = groupRuns(resolvePlacements(project).items.map((i) => placeItem(i)))
    .map((r) => r.map((pc) => pc.item.id))
    .find((r) => r.includes(id));
  return ids ?? null;
}

/**
 * Propose run parts for the floor runs in a project (ADR-036). A run is a row of base units side by side (gaps up to
 * 150 mm). Each run gets one worktop on top (depth of the deepest unit + 20 mm overhang), a filler in every gap, a
 * cover panel on each exposed end and (ADR-054) one plinth along the run when every piece's sides stand on its bottom
 * and the plinths match; that plinth replaces the pieces' own. Parts that would overlap another piece are left out;
 * parts the user removed (`runPartsRemoved`) are not proposed again. `notes` say why a run got no plinth.
 */
export function planRuns(project: Project): { parts: RunPart[]; notes: string[] } {
  const resolved = resolvePlacements(project);
  const placed = resolved.items.map((i) => placeItem(i));
  const removed = new Set(project.runPartsRemoved ?? []);
  const scribe = project.runSettings?.scribe ?? 0;
  const notes: string[] = [];
  const runs = groupRuns(placed);
  const out: RunPart[] = [];
  /** Free of every piece (a run plinth ignores the plinths it replaces) and of the parts proposed so far. */
  const free = (b: Box, skipPlinthOf: Set<string> = new Set()) =>
    !placed.some(
      (pc) =>
        overlaps(pc.bounds, b) &&
        pc.panels.some(
          (q) => !(q.role === 'plinth' && skipPlinthOf.has(pc.item.id)) && overlapsBox(q, b),
        ),
    ) && !out.some((o) => overlaps(o.box, b));
  const push = (rp: RunPart) => {
    if (!removed.has(rp.key!)) out.push(rp);
  };
  const frontOf = (pc: PlacedPiece) => {
    const p = pc.item.design.product;
    const id = p.kind === 'cabinet' || p.kind === 'corner' ? p.params.frontMaterialId : '';
    return pc.item.design.materials.find((m) => m.id === id) ?? pc.item.design.materials[0];
  };
  runs.forEach((run) => {
    const ids = run.map((pc) => pc.item.id);
    const first = run[0].bounds,
      last = run[run.length - 1].bounds;
    const x0 = first.x,
      x1 = last.x + last.w;
    const z0 = Math.min(...run.map((pc) => pc.bounds.z));
    const zf = Math.max(...run.map((pc) => pc.bounds.z + pc.bounds.d));
    const top = Math.max(...run.map((pc) => pc.bounds.y + pc.bounds.h));
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
      if (ok.length < n) why = 'a corner unit in the run keeps its own plinth';
      else if (ok.some((c) => c.p.plinthHeight <= 0))
        why = `no plinth on ${names((c) => c.p.plinthHeight <= 0)}`;
      else if (ok.some((c) => c.p.bottom !== 'under'))
        why = `the sides of ${names((c) => c.p.bottom !== 'under')} reach the floor; set Bottom → under the sides`;
      else if (new Set(ok.map((c) => c.p.plinthHeight)).size > 1)
        why = `plinth heights differ (${ok.map((c) => `${c.pc.item.design.name} ${c.p.plinthHeight} mm`).join(', ')})`;
      else if (new Set(ok.map((c) => c.p.plinthSetback)).size > 1)
        why = `plinth setbacks differ (${each((c) => `${c.p.plinthSetback} mm`)})`;
      else if (new Set(ok.map(plinthLine)).size > 1)
        why = `plinth fronts are not in line (${each((c) => `${plinthLine(c)} mm from the back`)})`;
      else if (new Set(ok.map(bodyKey)).size > 1)
        why = `body boards differ (${each((c) => {
          const m = bodyOf(c);
          return m
            ? `${m.name} ${m.thickness} mm${m.grain ? ' grained' : ''}${m.image ? ' with a picture' : ''}`
            : 'no board';
        })})`;
      if (why)
        notes.push(
          `No run plinth for ${run.map((pc) => pc.item.design.name).join(' + ')}: ${why}.`,
        );
      else {
        const c0 = ok[0],
          t = bodyT(c0);
        const m = c0.pc.item.design.materials.find((x) => x.id === c0.p.bodyMaterialId)!;
        const bx: Box = {
          x: x0,
          y: 0,
          z: plinthLine(c0) - t,
          w: x1 - x0,
          h: c0.p.plinthHeight,
          d: t,
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
            `No run plinth for ${run.map((pc) => pc.item.design.name).join(' + ')}: it would overlap a filler or another piece.`,
          );
      }
    }
    const covers = out.filter((o) => o.kind === 'cover' && o.from!.some((id) => ids.includes(id)));
    const wx0 = Math.min(x0, ...covers.map((c) => c.box.x)),
      wx1 = Math.max(x1, ...covers.map((c) => c.box.x + c.box.w));
    const wt = worktopMaterial();
    const wb: Box = {
      x: wx0,
      y: top,
      z: z0,
      w: wx1 - wx0,
      h: wt.thickness,
      d: zf - z0 + WORKTOP_OVERHANG,
    };
    const key = `worktop|${ids.join(',')}`;
    if (free(wb))
      push({
        id: key,
        key,
        from: ids,
        kind: 'worktop',
        label: 'Worktop',
        reason: `run of ${n} ${n === 1 ? 'piece' : 'pieces'}, ${wb.w} mm long; joints and cut-outs are not drawn`,
        box: wb,
        material: wt,
        thicknessAxis: 'y',
        grainAxis: 'x',
        banded: ['+z'],
      });
  });
  return { parts: out, notes };
}

export const suggestRunParts = (project: Project): RunPart[] => planRuns(project).parts;

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
    const same = JSON.stringify(was.box) === JSON.stringify(r.box) && was.scribe === r.scribe;
    if (same) {
      const { changed: _c, ...keep } = was;
      void _c;
      return keep;
    }
    const along =
      r.kind === 'worktop' || r.kind === 'plinth' ? 'w' : r.kind === 'filler' ? 'w' : 'h';
    return { ...r, material: was.material, changed: `${was.box[along]} → ${r.box[along]} mm` };
  });
  const before = JSON.stringify(project.runParts ?? []),
    after = JSON.stringify(next);
  if (before === after && removed.length === (project.runPartsRemoved ?? []).length) return project;
  return { ...project, runParts: next, runPartsRemoved: removed };
}

/** Parts for the whole project: each piece's cut list × its quantity, merged across pieces, then the run parts. */
export function projectCutlist(project: Project): CutRow[] {
  const rows = new Map<string, CutRow>();
  const extra = (project.runParts ?? []).map((rp) => ({ rp, key: materialKey(rp.material) }));
  if (extra.length) {
    const mats = [...new Map(extra.map((e) => [e.key, { ...e.rp.material, id: e.key }])).values()];
    // Fillers are cut wider by their scribe allowance (ADR-054); the model keeps the installed size.
    const cutPanel = (rp: RunPart, key: string) => {
      const p = runPanel(rp, key);
      return rp.scribe ? { ...p, box: { ...p.box, w: p.box.w + rp.scribe } } : p;
    };
    const model: FurnitureModel = {
      panels: extra.map((e) => cutPanel(e.rp, e.key)),
      spaces: [],
      hardware: [],
      diagnostics: [],
      bounds: { x: 0, y: 0, z: 0, w: 0, h: 0, d: 0 },
    };
    for (const r of cutlist(model, mats))
      rows.set(['run', r.materialId, r.length, r.width, r.edgesL, r.edgesW].join('|'), {
        ...r,
        labels: r.labels.map((l) => `Run: ${l}`),
      });
  }
  const covered = plinthCovered(project);
  for (const item of project.items) {
    const built = buildModel(item.design);
    const model = covered.has(item.id)
      ? { ...built, panels: built.panels.filter((p) => p.role !== 'plinth') }
      : built;
    for (const r of cutlist(model, item.design.materials)) {
      const mat = item.design.materials.find((m) => m.id === r.materialId)!;
      const id = materialKey(mat);
      const key = [id, r.length, r.width, r.edgesL, r.edgesW, r.drilling].join('|');
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

export function projectHardware(project: Project): HardwareItem[] {
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

export function validateProject(p: unknown): string[] {
  if (!isObj(p)) return ['Project must be an object'];
  const errs: string[] = [];
  if (!PROJECT_SCHEMAS.includes(p.schemaVersion as number))
    errs.push('Unsupported project schemaVersion');
  if (typeof p.id !== 'string' || !p.id || typeof p.name !== 'string' || !p.name)
    errs.push('Missing project id or name');
  if (
    p.cutting !== undefined &&
    !(isObj(p.cutting) && isInt(p.cutting.kerf, 0) && (p.cutting.kerf as number) <= 20)
  )
    errs.push('Invalid cutting settings');
  if (!Array.isArray(p.items)) return [...errs, 'Items missing'];
  const ids = new Set<string>();
  for (const it of p.items) {
    if (!isObj(it) || typeof it.id !== 'string' || !it.id) {
      errs.push('Invalid item');
      continue;
    }
    if (ids.has(it.id)) errs.push(`Duplicate item ${it.id}`);
    ids.add(it.id);
    if (!isInt(it.quantity, 1) || (it.quantity as number) > 99)
      errs.push('Item quantity must be 1 to 99');
    if (
      !isObj(it.position) ||
      !isInt(it.position.x) ||
      !isInt(it.position.y, 0) ||
      !isInt(it.position.z)
    )
      errs.push('Item position must be whole mm (height ≥ 0)');
    if (![0, 90, 180, 270].includes(it.rotationY as number))
      errs.push('Item rotation must be a quarter turn');
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
      errs.push('Invalid item placement');
    const de = validateDesign(it.design);
    if (de.length) errs.push(`Item ${String(it.id)}: ${de[0]}`);
  }
  if (p.runParts !== undefined) {
    if (!Array.isArray(p.runParts)) errs.push('Invalid run parts');
    else
      for (const rp of p.runParts) {
        const b = isObj(rp) ? rp.box : null;
        const m = isObj(rp) ? rp.material : null;
        if (
          !isObj(rp) ||
          typeof rp.id !== 'string' ||
          !['worktop', 'filler', 'cover', 'plinth'].includes(rp.kind as string) ||
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
          !['x', 'y', 'z'].includes(rp.thicknessAxis as string) ||
          !['x', 'y', 'z'].includes(rp.grainAxis as string) ||
          !Array.isArray(rp.banded)
        )
          errs.push('Invalid run part');
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
    errs.push('Invalid run settings');
  if (p.room !== undefined) errs.push(...validateRoom(p.room));
  if (
    p.runPartsRemoved !== undefined &&
    !(Array.isArray(p.runPartsRemoved) && p.runPartsRemoved.every((k) => typeof k === 'string'))
  )
    errs.push('Invalid removed run parts');
  return errs;
}
