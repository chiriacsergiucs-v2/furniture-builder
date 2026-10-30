import { create } from 'zustand';
import { buildModel } from '../core/build';
import {
  projectWithHardwareProduct,
  withHardwareProduct,
  withSellerItem,
  withSellerItemQuantity,
} from '../core/sellers/choices';
import {
  findInProduct,
  productRoots,
  mapProductSpace,
  newId,
  SCHEMA_VERSION,
  templates,
  upgradeDesign,
  validateDesign,
} from '../core/design';
import { duplicateItem, mirrorItem, mirrorRun, setItemRotation, tryTurn } from '../core/arrange';
import { floorDrop, type FloorPoint } from '../core/drag3d';
import {
  applyFinish,
  applyMaterial,
  putPartBoard,
  putRoleBoards,
  withBoard,
  roleName,
  type FinishRole,
  type FinishScope,
  type MaterialRole,
  type MaterialScope,
} from '../core/finish';
import { commonPanelCheck, pruneCommon } from '../core/common';
import { mergeItems } from '../core/merge';
import { describeChange } from '../core/history';
import { insertTemplate } from '../core/insertTemplate';
import type { ProjectTemplate } from '../core/projectTemplate';
import { applyStyle, type Style } from '../core/styles';
import { addLinkedCopy, propagateLinks } from '../core/linked';
import { alignItems, distributeItems, skippedText, type AlignHow } from '../core/align';
import {
  duplicateItems,
  groupItems,
  groupOf,
  mirrorItems,
  moveItems,
  sameIds,
  turnSelection,
  ungroup,
} from '../core/selection';
import { replaceItem, replaceReport, type ReplaceReport } from '../core/replace';
import { catalogFamilies } from '../core/catalog';
import type { CatalogFamily } from '../core/catalog/types';
import { carryEdits, carryText, ownEdits, SIZE_SKIP, syncRef } from '../core/ownEdits';
import {
  followProject,
  setProjectSetting,
  SETTING_LABEL,
  withSettings,
  type SettingKey,
} from '../core/projectSettings';
import { countRows, countSubject, stepCount, type CountKey } from '../core/counts';
import { drill, type Selection } from '../core/selectPath';
import { resizeProduct, type SizeField } from '../core/pieceSize';
import { carryGroups, withGroups } from '../core/groupMove';
import { resizeGroup, type WidthSplit } from '../core/groupSize';
import { resizeBlocked, setSizeLocked, sizeLockBlocked } from '../core/sizeLock';
import { setWallHeight } from '../core/height';
import { moveTo, type MoveToAction } from '../core/moveTo';
import {
  closeOutline,
  DEFAULT_ROOM_HEIGHT,
  keepWallFinishes,
  snapCorner,
  type Pt,
  type Room,
} from '../core/room';
import {
  buildProjectModel,
  makeItem,
  moveBy,
  planRuns,
  pruneGroups,
  pruneRunExtras,
  PROJECT_SCHEMA,
  refreshRunParts,
  requestKey,
  removeProjectItem,
  resolvePlacements,
  roomToPiece,
  keepTemplate,
  linkItemOrigin,
  setLocked,
  tapPosition,
  trySetGap,
  type Project,
  type ProjectItem,
  type ProjectModel,
  type ProjectSettings,
  type RunHandle,
  type RunRequest,
  type RunSettings,
  type RunSink,
} from '../core/project';
import type {
  CabinetParams,
  CatalogMeta,
  CornerParams,
  DeskParams,
  Design,
  FrameParams,
  FurnitureModel,
  HardwareProduct,
  Material,
  Mm,
  PanelParams,
  PanelSetParams,
  SellerItem,
  Space,
} from '../core/types';
import type { LocalTemplate } from '../core/catalog/local';
import { t } from '../core/i18n';

/** A space selection that no longer exists in the design falls back to the whole piece. */
const keepSelection = (d: Design, sel: Selection): Selection =>
  sel && !findInProduct(d.product, sel) ? null : sel;

export type Tab = 'parts' | 'sheets' | 'hardware' | 'shopping' | 'checks';

interface State {
  design: Design;
  model: FurnitureModel;
  /** Selected space id, null for the whole piece, undefined for nothing selected (ADR-083). */
  selectedId: Selection;
  /** Panels highlighted from the parts list. */
  highlight: string[];
  showFronts: boolean;
  /** 3D preview with the panels pushed apart (display only). */
  exploded: boolean;
  tab: Tab;
  /** Phones: the results panel under the views is open (ADR-091). UI state only; a reload starts collapsed. */
  resultsOpen: boolean;
  past: Design[];
  future: Design[];
  dirtyAt: number;
  /** Opened from storage and not edited since: autosave leaves the stored row alone (ADR-019). */
  pristine: boolean;
  /** Open project (ADR-022), or null when editing a single saved piece. */
  project: Project | null;
  projectModel: ProjectModel | null;
  /** Piece of the project being edited in the piece editor. */
  editingItemId: string | null;
  /** Piece selected in the project view: the main one of `selectedItemIds`, shown on the card. */
  selectedItemId: string | null;
  /**
   * Every selected piece (ADR-097), the main one first; one piece = `[selectedItemId]`. Setting `selectedItemId` alone
   * selects just that piece.
   */
  selectedItemIds: string[];
  /** Phones: the plan's Select button is on, so taps add and remove pieces (ADR-097). UI state only. */
  multiSelect: boolean;
  /**
   * Project piece whose design is loaded into `design`/`model` while the project editor stays open (ADR-088): taps
   * drill into it and its spaces are edited from the project panel. Active only while it is the selected piece.
   */
  drillItemId: string | null;
  projectDirtyAt: number;
  /** Project-level history (ADR-051): earlier and undone states of the open project. */
  projectPast: Project[];
  projectFuture: Project[];
  /**
   * Step names (ADR-123): `projectPastNames[i]` names the step that came after `projectPast[i]`;
   * `projectFutureNames[i]` the step that redoing `projectFuture[i]` makes. Same lengths as the snapshots.
   */
  projectPastNames: string[];
  projectFutureNames: string[];
  /** The pieces of a just-inserted project template, placed together by the next tap on the plan (ADR-123). */
  placingIds: string[];
  /**
   * The project as it was opened, until its first change (ADR-123, G-155): kept as a "When opened" version then.
   * Taken (and cleared) by `takeSessionBase`.
   */
  sessionBase: Project | null;
  /**
   * Why the last move on the plan did nothing (ADR-095: a locked piece), shown over the plan until the next change or
   * selection. UI state only.
   */
  notice: string | null;
  /** A piece just added and waiting to be placed by a tap on the plan (ADR-056). */
  placingItemId: string | null;
  /** Corners tapped so far while drawing the room on the plan (ADR-059), or null. */
  drawingRoom: Pt[] | null;
  /** Editing one variant of a local template (ADR-034); the piece open before comes back afterwards. */
  templateEdit: { template: LocalTemplate; variantId: string; returnTo: Design } | null;

  load: (d: Design, opts?: { fromStorage?: boolean }) => void;
  setKerf: (kerf: number) => void;
  /** ADR-161: a seller product for a hardware line (undefined removes it); in a project view, in every piece. */
  setHardwareProduct: (key: string, hp: HardwareProduct | undefined) => void;
  /** ADR-161: a seller product added to the open piece's shopping list. */
  addSellerItem: (it: SellerItem) => void;
  /** ADR-161: an added item's quantity; 0 removes it. */
  setSellerItemQuantity: (index: number, quantity: number) => void;
  rename: (name: string) => void;
  updateCabinet: (patch: Partial<CabinetParams>) => void;
  updateDesk: (patch: Partial<DeskParams>) => void;
  updateCorner: (patch: Partial<CornerParams>) => void;
  updatePanelSet: (patch: Partial<PanelSetParams>) => void;
  /** A board for one loose part of a panel set, copied into the piece when it is not there yet (ADR-164). */
  setLoosePanelBoard: (panelId: string, board: Material) => void;
  /** A board for one part instead of its group's board; null goes back to the group's board. */
  setPartMaterial: (panelId: string, materialId: string | null) => void;
  updatePanel: (patch: Partial<PanelParams>) => void;
  updateFrame: (patch: Partial<FrameParams>) => void;
  /** Width or depth of the whole open piece, from its selection (ADR-106). */
  resizePiece: (key: SizeField['key'], value: Mm) => void;
  /** Width or depth of a project piece, from its Selected piece card; one project undo step (ADR-106). */
  resizeItem: (id: string, key: SizeField['key'], value: Mm) => void;
  /**
   * The group's width (extent along the wall, shared by `split`), height or depth (every piece) (ADR-148); one project
   * undo step. Returns what to tell the user: why nothing changed, or the pieces that kept their size; '' otherwise.
   */
  resizeGroup: (groupId: string, key: SizeField['key'], value: Mm, split: WidthSplit) => string;
  /** Catalog metadata and guidance settings (ADR-028, ADR-035). */
  updateMeta: (patch: Partial<Pick<Design, 'catalog' | 'settings'>>) => void;
  editTemplateVariant: (template: LocalTemplate, variantId: string) => void;
  /** Leave template mode; returns the template with the edited design put back (the caller saves it), or null. */
  finishTemplateEdit: (keep: boolean) => LocalTemplate | null;
  updateSpace: (id: string, fn: (s: Space) => Space) => void;
  /** One step of a quick count on the selected space or piece (ADR-084); one undo step. */
  stepCount: (key: CountKey, delta: 1 | -1) => void;
  updateMaterial: (id: string, patch: Partial<Material>) => void;
  addMaterial: (m: Material) => void;
  /** Removes a board no part uses; returns why not otherwise (nothing changes). */
  removeMaterial: (id: string) => string | null;
  select: (id: Selection) => void;
  /** Tap on the piece at (x, y) mm, front view or 3D: whole piece first, then one level smaller per tap (ADR-083). */
  tapPiece: (x: number, y: number) => void;
  /**
   * Tap on a project piece (ADR-083, ADR-088): the first tap selects the whole piece; each further tap selects one
   * level smaller under the tap (room mm), and the project editor stays open. With no point (the plan) a further tap
   * selects the piece's interior.
   */
  tapItem: (id: string, at?: { x: number; y: number; z: number }) => void;
  setHighlight: (ids: string[]) => void;
  setShowFronts: (v: boolean) => void;
  setExploded: (v: boolean) => void;
  /** Show a results tab, opening the panel (ADR-091). */
  setTab: (t: Tab) => void;
  /** A tap on a results tab: opens it, switches to it, or closes it when it is the open one (ADR-091). */
  toggleTab: (t: Tab) => void;
  undo: () => void;
  redo: () => void;
  openProject: (p: Project) => void;
  closeProject: () => void;
  updateProject: (fn: (p: Project) => Project) => void;
  addPiece: (d: Design, libraryId?: string) => void;
  /**
   * Add a copy of a design with its left-back corner at a plan point (ADR-094: dropped from the piece list), whole
   * mm; one undo step. The point is where `dropNewPiece` puts it (snapped or as a tap places it).
   */
  addPieceAt: (d: Design, x: number, z: number, libraryId?: string) => void;
  updateItem: (id: string, patch: Partial<ProjectItem>) => void;
  /**
   * Move a piece on the plan by a drag or an arrow key (ADR-065): rounded to the step, lifted off a base, one undo
   * step. Nothing happens (no step) when the piece would not move; a locked piece stays and the reason is returned
   * and shown as the plan's notice (ADR-095).
   */
  moveItemBy: (id: string, dxMm: number, dzMm: number, step?: number) => string | null;
  /**
   * Drop a piece dragged in the 3D view (ADR-093) from room point `from` to `to` on its floor plane: the same drop
   * as a Plan drag (snapping when `snap`), one undo step. A locked piece stays and the reason is returned (ADR-095).
   */
  dropItemAt: (id: string, from: FloorPoint, to: FloorPoint, snap: boolean) => string | null;
  /** The gap tool (ADR-022); returns why nothing moved when it would move a locked piece (ADR-095), or null. */
  setGap: (id: string, gap: number, moveRight: boolean) => string | null;
  /** A one-tap Move to action (ADR-147); one undo step. Returns why nothing moved, or null. */
  moveItemTo: (id: string, action: MoveToAction) => string | null;
  /** Lock or unlock a piece's placement (ADR-095); one undo step. */
  setLocked: (id: string, on: boolean) => void;
  /** Lock or unlock a piece's size (ADR-122); one undo step. */
  setSizeLocked: (id: string, on: boolean) => void;
  /** Hang a wall unit at a new height, e.g. dragged in 3D (ADR-122); one undo step. Returns why not, or null. */
  setItemHeight: (id: string, height: number) => string | null;
  /** "Keep mine" (ADR-096): hide the newer-template notice for this revision; one undo step. */
  keepTemplate: (id: string, revision: number) => void;
  /** Link a piece to the catalog template it was saved as (ADR-107); one undo step. */
  linkTemplate: (id: string, origin: NonNullable<CatalogMeta['origin']>) => void;
  removeItem: (id: string) => void;
  /** Merge two touching cabinets into one (ADR-047); returns why not, or an empty list. */
  mergeItems: (a: string, b: string) => string[];
  /** Duplicate, turn about the centre, mirror a piece or its run (ADR-069); each is one undo step. */
  duplicateItem: (id: string) => void;
  /** Place a linked copy beside the piece (ADR-111); one undo step. */
  addLinkedCopy: (id: string) => void;
  /** "Change all copies" (ADR-111): on, a change to a linked piece reaches its copies; off, the piece leaves them. */
  linkAll: boolean;
  setLinkAll: (v: boolean) => void;
  /** Put a catalog copy in the piece's place, keeping where and how it stands (ADR-098); one undo step. */
  replaceItem: (
    id: string,
    design: Design,
    /**
     * Carry the piece's own edits (ADR-124): `families` the catalog as this device shows it; `keepSize` false on
     * Replace (the new item's size is used), true for a newer revision of the same template.
     */
    opts?: { families?: CatalogFamily[]; keepSize?: boolean },
  ) => ReplaceReport | null;
  /** Set or clear a project-wide setting (ADR-124); returns the names of the pieces that took it. One undo step. */
  setProjectSetting: (key: SettingKey, value: ProjectSettings[SettingKey] | undefined) => string[];
  /** The piece takes the project's value of the setting again (ADR-124). One undo step. */
  followProject: (id: string, key: SettingKey) => void;
  /** Returns why it did not turn (a locked piece, ADR-095), or null. */
  turnItem: (id: string, dir: 1 | -1) => string | null;
  /**
   * Turn a piece to whole degrees 0–359 about its centre (ADR-121); one undo step. Returns why not (a locked piece,
   * a number outside 0–359), or null. Nothing is clamped (ADR-008).
   */
  setRotation: (id: string, deg: number) => string | null;
  /** Returns why nothing changed ("Nothing to mirror in this piece", a locked piece), or null. */
  mirrorItem: (id: string) => string | null;
  /**
   * Returns the pieces of the run that had nothing to mirror (they still move), and why nothing moved when the run
   * holds a locked piece (ADR-095).
   */
  mirrorRun: (id: string) => { reasons: string[]; refused?: string };
  selectItem: (id: string | null) => void;
  /** Shift/Ctrl/Cmd-click, or a tap with Select on (ADR-097): add the piece to the selection or take it out. */
  toggleItem: (id: string) => void;
  /** Select these pieces (the box, a group, Select all); the first is the main one. */
  selectItems: (ids: string[]) => void;
  selectAll: () => void;
  setMultiSelect: (on: boolean) => void;
  /**
   * Move every selected piece by the same offset, rounded to `step` (default 1 mm) (ADR-097); returns why not (a lock),
   * or null. One undo step.
   */
  moveSelectionBy: (dx: number, dz: number, step?: number) => string | null;
  /** Turn the selection a quarter turn about its centre (ADR-097); returns why not, or null. One undo step. */
  turnSelectionBy: (dir: 1 | -1) => string | null;
  /**
   * Mirror the selected pieces left–right about the selection's centre (ADR-121); one undo step. Returns what to tell
   * the user: why nothing moved (a lock), the pieces with nothing to mirror, or ''.
   */
  mirrorSelection: () => string;
  /** Remove every selected piece (one undo step). */
  deleteSelection: () => void;
  /** Copy the selection as a block to its right; the copies become the selection. One undo step. */
  duplicateSelection: () => void;
  /**
   * Align the selection to its first piece (ADR-099); one undo step. Returns what to tell the user: the pieces a lock
   * kept in place, or ''.
   */
  alignSelection: (how: AlignHow) => string;
  /** Equal gaps along the wall between three or more selected pieces (ADR-099); one undo step. Says the gaps. */
  distributeSelection: () => string;
  /** Keep the selection as a group (ADR-097); returns its id, or null with fewer than two pieces. */
  groupSelection: () => string | null;
  ungroup: (groupId: string) => void;
  editItem: (id: string) => void;
  backToProject: () => void;
  undoProject: () => void;
  redoProject: () => void;
  /** Jump `steps` back (negative) or forward (positive) in the project history (ADR-123 Edit history). */
  jumpProject: (steps: number) => void;
  /**
   * Run `fn` as one named project step (ADR-123): every change made inside it undoes together. Nested calls fold into
   * the outermost.
   */
  transact: (name: string, fn: () => void) => void;
  /** Add a project template's pieces (ADR-123), selected and waiting for a tap on the plan; one undo step. */
  insertTemplate: (t: ProjectTemplate) => string[];
  /** Put a restored version's content in place of the open project (ADR-123); one undo step. */
  restoreProjectTo: (p: Project) => void;
  /** The opened project, once, if it changed since opening (ADR-123, G-155); null otherwise. */
  takeSessionBase: () => Project | null;
  /** Put a style on the pieces a finish scope reaches (ADR-123); one undo step. */
  applyStyle: (
    id: string,
    style: Style,
    scope: FinishScope,
  ) => { applied: string[]; skipped: string[] };
  /** Run parts (ADR-036, ADR-054, ADR-061): propose again (forgets removals, turns automatic refresh on), remove one, settings. */
  suggestRunParts: () => void;
  removeRunPart: (id: string) => void;
  setRunSettings: (patch: Partial<RunSettings>) => void;
  /**
   * Ask for a worktop over chosen pieces, a worktop's overhangs, or a trim (ADR-075); replaces the request with the
   * same key. Its part is made at once, in the same undo step, and then follows the pieces.
   */
  setRunRequest: (r: RunRequest) => void;
  /** Drop a request that could not be made (ADR-075). */
  removeRunRequest: (key: string) => void;
  /** Handles for a run (ADR-125): add or replace the one with the same id, or remove it. One undo step each. */
  setRunHandle: (rh: RunHandle) => void;
  removeRunHandle: (id: string) => void;
  /** A sink over a base unit (ADR-125): add or replace the one with the same id, or remove it. */
  setSink: (sk: RunSink) => void;
  removeSink: (id: string) => void;
  /** Put one board on the fronts or carcass of the selected piece, its run or the whole project (ADR-055). */
  applyFinish: (
    id: string,
    role: FinishRole,
    board: Material,
    scope: FinishScope,
  ) => { applied: string[]; skipped: string[] };
  /**
   * One Material control (ADR-163): `board` on `roles` of the selected item, its group or the whole project (a
   * project), or of the open piece (`id` null); scope Part puts it on one generated part. One undo step.
   */
  applyMaterial: (
    id: string | null,
    roles: readonly MaterialRole[],
    board: Material,
    scope: MaterialScope,
    panelId?: string,
  ) => { applied: string[]; skipped: string[] };
  /**
   * A common top or bottom (ADR-165) over the selected items: on links them (replacing a common panel of the same
   * kind any of them is in), off removes the one they are in. Returns why it was refused, or ''. One undo step.
   */
  setCommon: (kind: 'top' | 'bottom', on: boolean) => string;
  /** Forget a part's own board (ADR-151) on a project item (`id`) or the open piece (null). */
  clearPartBoard: (id: string | null, panelId: string) => void;
  /** Put the piece being placed with its left-back corner at a plan point (whole mm, x and z ≥ 0), or stop placing (ADR-056). */
  placeAt: (x: number, z: number) => void;
  stopPlacing: () => void;
  /** The room (ADR-058/059); undefined removes it. */
  setRoom: (room: Room | undefined) => void;
  startDrawRoom: () => void;
  addRoomCorner: (x: number, z: number) => void;
  /** Close the drawn outline into the room (keeps height and features); false when fewer than three corners. */
  finishDrawRoom: () => boolean;
  cancelDrawRoom: () => void;
}

const HISTORY = 100;

export const useDesign = create<State>((rawSet, get) => {
  // Setting the main selected piece alone selects just that piece (ADR-097).
  const withIds = (p: Partial<State>): Partial<State> =>
    'selectedItemId' in p && !('selectedItemIds' in p)
      ? { ...p, selectedItemIds: p.selectedItemId ? [p.selectedItemId] : [] }
      : p;
  const set = (partial: Partial<State> | ((s: State) => Partial<State>)) =>
    typeof partial === 'function' ? rawSet((s) => withIds(partial(s))) : rawSet(withIds(partial));
  /** Every edit goes through here: history, timestamp, rebuild. */
  const commit = (next: Design) => {
    const { design, past } = get();
    if (next === design) return;
    // A project piece whose size is locked keeps its size (ADR-122): the edit is refused and the reason shown.
    const open = get().editingItemId ?? get().drillItemId;
    const p0 = get().project;
    const locked = p0 && open ? resizeBlocked(p0, open, next) : null;
    if (locked) {
      set({ notice: locked });
      return;
    }
    // A copy of a brand's product stops being that brand's product once edited; its origin stays (ADR-028).
    const debranded =
      next.catalog?.brand && next.catalog.origin
        ? { ...next, catalog: { ...next.catalog, brand: undefined } }
        : next;
    const stamped = { ...debranded, updatedAt: new Date().toISOString() };
    set({
      design: stamped,
      model: buildModel(stamped),
      past: [...past, design].slice(-HISTORY),
      future: [],
      dirtyAt: Date.now(),
      pristine: false,
    });
    const sel = get().selectedId;
    if (sel && !findInProduct(stamped.product, sel)) set({ selectedId: null });
    // Editing a project piece: the change lives in the project's embedded copy, never the library (ADR-022).
    const { project, editingItemId, drillItemId } = get();
    // Edited from the project editor (ADR-088): each change is one project undo step (ADR-051).
    if (project && !editingItemId && drillItemId)
      return commitProject({
        ...project,
        items: project.items.map((i) => (i.id === drillItemId ? { ...i, design: stamped } : i)),
      });
    if (project && editingItemId) {
      set({
        project: {
          ...project,
          updatedAt: stamped.updatedAt,
          items: project.items.map((i) => (i.id === editingItemId ? { ...i, design: stamped } : i)),
        },
        projectDirtyAt: Date.now(),
      });
    }
  };
  /** Keep the project's embedded copy in step with the piece editor (undo/redo included). */
  const syncItem = () => {
    const { project, editingItemId, design } = get();
    if (project && editingItemId)
      set({
        project: {
          ...project,
          items: project.items.map((i) => (i.id === editingItemId ? { ...i, design } : i)),
        },
        projectDirtyAt: Date.now(),
      });
  };
  /** The project as it was when its piece editor opened; one undo step if the piece changed (ADR-051). */
  let projectBeforeEdit: Project | null = null;
  /** Load a project piece for edits from the project editor (ADR-088), with `sel` selected inside it. */
  const loadDrill = (item: ProjectItem, sel: Selection) => {
    const d = upgradeDesign(item.design);
    set({
      drillItemId: item.id,
      design: d,
      model: buildModel(d),
      selectedId: sel,
      highlight: [],
      past: [],
      future: [],
    });
  };
  /** After the project changed (undo, a move, a removal): the loaded piece follows its project copy or is dropped. */
  const syncDrill = () => {
    const { project, drillItemId, design, selectedId } = get();
    if (!drillItemId) return;
    const item = project?.items.find((i) => i.id === drillItemId);
    if (!item) return set({ drillItemId: null, selectedId: undefined });
    if (item.design === design) return;
    const d = upgradeDesign(item.design);
    const keep = typeof selectedId !== 'string' || findInProduct(d.product, selectedId);
    set({ design: d, model: buildModel(d), selectedId: keep ? selectedId : null });
  };
  /** Inside `transact`: the depth, and the project and history as they were when it started. */
  let txDepth = 0;
  /** Commit a project change as one named step; returns why it was refused (a size-locked piece, ADR-122), or null. */
  const commitProject = (
    next: Project,
    name?: string,
    opts?: { amend?: boolean },
  ): string | null => {
    // Pieces on or above others follow them (ADR-031); run parts follow the pieces in the same step (ADR-061).
    // A piece no longer in the project leaves its group (ADR-097).
    // A change to a linked copy reaches the others, or unlinks it (ADR-111).
    let linked = propagateLinks(get().project, next, get().linkAll);
    // Template references keep their overrides up to date while the template's revision is the catalog's (ADR-124).
    const items = linked.items.map((i) => syncRef(i, catalogFamilies));
    if (items.some((i, n) => i !== linked.items[n])) linked = { ...linked, items };
    // Nothing resizes a size-locked piece (ADR-122), also through a linked copy, a project-wide setting or Replace:
    // the whole change is refused.
    const locked = sizeLockBlocked(get().project, linked);
    if (locked) {
      set({ notice: locked });
      syncDrill();
      return locked;
    }
    const stamped = {
      ...refreshRunParts(resolvePlacements(pruneRunExtras(pruneCommon(pruneGroups(linked))))),
      schemaVersion: PROJECT_SCHEMA, // an edited project is saved in the current shape (ADR-011, ADR-073)
      updatedAt: new Date().toISOString(),
    };
    const prev = get().project;
    // Amending (a template placed by the tap after its insert): the change joins the step before it (ADR-123).
    const amend = !!opts?.amend && get().projectPast.length > 0;
    set({
      project: stamped,
      projectModel: buildProjectModel(stamped),
      projectDirtyAt: Date.now(),
      notice: null,
      ...(prev && !amend
        ? {
            projectPast: [...get().projectPast, prev].slice(-HISTORY),
            projectPastNames: [...get().projectPastNames, name ?? describeChange(prev, next)].slice(
              -HISTORY,
            ),
            projectFuture: [],
            projectFutureNames: [],
          }
        : amend
          ? { projectFuture: [], projectFutureNames: [] }
          : {}),
    });
    keepSelected(stamped);
    syncDrill();
    return null;
  };
  /** The selection keeps the pieces still in the project; the main one falls to the next selected (ADR-097). */
  const keepSelected = (p: Project) => {
    const { selectedItemIds, selectedItemId } = get();
    if (selectedItemIds.length < 2) return;
    const have = new Set([...p.items, ...(p.models ?? [])].map((i) => i.id));
    const ids = selectedItemIds.filter((x) => have.has(x));
    if (ids.length === selectedItemIds.length) return;
    set({
      selectedItemIds: ids,
      selectedItemId: ids.includes(selectedItemId ?? '') ? selectedItemId : (ids[0] ?? null),
    });
  };
  /** Show an earlier or later state of the project; the selection survives if the piece still exists. */
  const restoreProject = (
    p: Project,
    projectPast: Project[],
    projectFuture: Project[],
    projectPastNames: string[],
    projectFutureNames: string[],
  ) => {
    const sel = get().selectedItemId;
    set({
      project: p,
      projectModel: buildProjectModel(p),
      projectPast,
      projectFuture,
      projectPastNames,
      projectFutureNames,
      placingIds: [],
      projectDirtyAt: Date.now(),
      placingItemId: null,
      notice: null,
      // The selected pieces that still exist stay selected (ADR-097), the main one first.
      ...(() => {
        const have = new Set([...p.items, ...(p.models ?? [])].map((i) => i.id));
        const ids = get().selectedItemIds.filter((x) => have.has(x));
        const main = sel && have.has(sel) ? sel : (ids[0] ?? null);
        return { selectedItemId: main, selectedItemIds: ids };
      })(),
    });
    syncDrill();
  };
  const initial = templates[0].create();
  return {
    design: initial,
    model: buildModel(initial),
    selectedId: undefined,
    highlight: [],
    showFronts: true,
    linkAll: true,
    exploded: false,
    tab: 'parts',
    resultsOpen: false,
    past: [],
    future: [],
    dirtyAt: 0,
    pristine: false,
    project: null,
    projectModel: null,
    editingItemId: null,
    selectedItemId: null,
    selectedItemIds: [],
    multiSelect: false,
    drillItemId: null,
    projectDirtyAt: 0,
    projectPast: [],
    projectFuture: [],
    projectPastNames: [],
    projectFutureNames: [],
    placingIds: [],
    sessionBase: null,
    placingItemId: null,
    drawingRoom: null,
    templateEdit: null,
    notice: null,

    load: (raw, opts) => {
      const d = upgradeDesign(raw);
      set({
        design: d,
        model: buildModel(d),
        selectedId: undefined,
        highlight: [],
        past: [],
        future: [],
        dirtyAt: 0,
        pristine: !!opts?.fromStorage,
        project: null,
        projectModel: null,
        editingItemId: null,
        selectedItemId: null,
        drillItemId: null,
        projectPast: [],
        projectFuture: [],
        projectPastNames: [],
        projectFutureNames: [],
        placingIds: [],
        sessionBase: null,
      });
    },
    tapPiece: (x, y) => set({ selectedId: drill(get().model, x, y, get().selectedId) }),
    tapItem: (id, at) => {
      const { project, selectedItemId, drillItemId, selectedId } = get();
      const item = project?.items.find((i) => i.id === id);
      if (!item) return get().selectItem(id);
      // A grouped piece: the first tap selects the whole group, the next one the piece (ADR-097, user answer).
      const group = project && groupOf(project, id);
      const ids = get().selectedItemIds;
      if (group && !sameIds(ids, group.itemIds) && !(ids.length === 1 && ids[0] === id))
        return get().selectItems([id, ...group.itemIds.filter((x) => x !== id)]);
      // The first tap: the whole piece (ADR-083), loaded for edits without leaving the project (ADR-088).
      if (selectedItemId !== id || drillItemId !== id) return get().selectItem(id);
      if (!at) {
        // The plan has no height: a further tap selects the piece's interior (G-066).
        const roots = productRoots(get().design.product);
        return set({ selectedId: roots.length === 1 ? roots[0].root.id : null });
      }
      const p = roomToPiece(item, at);
      const next = drill(get().model, p.x, p.y, selectedId === undefined ? null : selectedId);
      set({ selectedId: next === undefined ? null : next });
    },
    openProject: (raw) => {
      const p = resolvePlacements(raw);
      set({
        project: p,
        projectModel: buildProjectModel(p),
        editingItemId: null,
        selectedItemId: null,
        drillItemId: null,
        highlight: [],
        projectDirtyAt: 0,
        projectPast: [],
        projectFuture: [],
        projectPastNames: [],
        projectFutureNames: [],
        placingIds: [],
        sessionBase: p,
        placingItemId: null,
        drawingRoom: null,
        notice: null,
      });
    },
    closeProject: () =>
      set({
        notice: null,
        project: null,
        projectModel: null,
        editingItemId: null,
        selectedItemId: null,
        drillItemId: null,
        projectPast: [],
        projectFuture: [],
        projectPastNames: [],
        projectFutureNames: [],
        placingIds: [],
        sessionBase: null,
        placingItemId: null,
        drawingRoom: null,
      }),
    updateProject: (fn) => {
      const p = get().project;
      if (p) commitProject(fn(p));
    },
    addPiece: (d, libraryId) => {
      const p = get().project;
      if (!p) return;
      // A new piece follows the project settings (ADR-124).
      const item = makeItem(p, withSettings(d, p.settings), libraryId);
      commitProject({ ...p, items: [...p.items, item] });
      set({ selectedItemId: item.id, placingItemId: item.id });
    },
    addPieceAt: (d, x, z, libraryId) => {
      const p = get().project;
      if (!p) return;
      const made = makeItem(p, withSettings(d, p.settings), libraryId);
      // Not clamped here: `dropNewPiece` already placed it as a tap does, and a snap may put it against a wall of
      // a drawn room at x or z below 0.
      const position = { ...made.position, x: Math.round(x) || 0, z: Math.round(z) || 0 };
      const item: ProjectItem = { ...made, position };
      commitProject({ ...p, items: [...p.items, item] });
      set({ selectedItemId: item.id, placingItemId: null });
    },
    updateItem: (id, patch) => {
      const p = get().project;
      if (!p) return;
      const next = { ...p, items: p.items.map((i) => (i.id === id ? { ...i, ...patch } : i)) };
      // A grouped piece moved from its fields takes its group along (ADR-148).
      const res = 'position' in patch || 'placement' in patch ? carryGroups(p, next, [id]) : null;
      if (res?.reason) return set({ notice: res.reason });
      commitProject(res?.project ?? next);
    },
    moveItemBy: (id, dxMm, dzMm, step) => {
      const p = get().project;
      if (!p) return null;
      // A grouped piece moves with its whole group (ADR-148).
      const group = withGroups(p, [id]);
      const res =
        group.length > 1 ? moveItems(p, group, dxMm, dzMm, step) : moveBy(p, id, dxMm, dzMm, step);
      if (res.reason) {
        set({ notice: res.reason });
        return res.reason;
      }
      if (res.project !== p) commitProject(res.project);
      return null;
    },
    dropItemAt: (id, from, to, snap) => {
      const p = get().project;
      const it = p?.items.find((i) => i.id === id);
      const pieces = get().projectModel?.pieces;
      if (!p || !it || !pieces) return null;
      const t = floorDrop(p, pieces, id, from, to, snap);
      return t
        ? get().moveItemBy(id, t.position.x - it.position.x, t.position.z - it.position.z, 1)
        : null;
    },
    setGap: (id, gap, moveRight) => {
      const p = get().project;
      if (!p) return null;
      const set1 = trySetGap(p, id, gap, moveRight);
      const res = set1.reason ? set1 : carryGroups(p, set1.project, [id]);
      if (res.project !== p) commitProject(res.project);
      return res.reason ?? null;
    },
    moveItemTo: (id, action) => {
      const p = get().project;
      if (!p) return null;
      const res = moveTo(p, id, action);
      if (res.reason) {
        set({ notice: res.reason });
        return res.reason;
      }
      if (res.project !== p) commitProject(res.project);
      return null;
    },
    setLocked: (id, on) => {
      const p = get().project;
      if (!p) return;
      const next = setLocked(p, id, on);
      if (next !== p) commitProject(next);
    },
    setSizeLocked: (id, on) => {
      const p = get().project;
      if (!p) return;
      const next = setSizeLocked(p, id, on);
      if (next !== p) commitProject(next);
    },
    setItemHeight: (id, height) => {
      const p = get().project;
      if (!p) return null;
      const one = setWallHeight(p, id, height);
      const res = one.reason ? one : carryGroups(p, one.project, [id]);
      if (res.reason) {
        set({ notice: res.reason });
        return res.reason;
      }
      return res.project !== p ? commitProject(res.project) : null;
    },
    keepTemplate: (id, revision) => {
      const p = get().project;
      if (!p) return;
      const next = keepTemplate(p, id, revision);
      if (next !== p) commitProject(next);
    },
    linkTemplate: (id, origin) => {
      const p = get().project;
      if (!p) return;
      const next = linkItemOrigin(p, id, origin);
      if (next !== p) commitProject(next);
    },
    removeItem: (id) => {
      const p = get().project;
      if (p) {
        commitProject(removeProjectItem(p, id));
        set({ selectedItemId: null });
      }
    },
    mergeItems: (a, b) => {
      const p = get().project;
      if (!p) return [t('No project is open.')];
      const res = mergeItems(p, a, b);
      if (res.mergedId) {
        commitProject(res.project);
        set({ selectedItemId: res.mergedId });
      }
      return res.issues;
    },
    replaceItem: (id, design, opts) => {
      const { project: p, projectModel: pm } = get();
      const item = p?.items.find((i) => i.id === id);
      if (!p || !pm || !item) return null;
      // The piece's own edits go onto the new design where it has them (ADR-124, G-160).
      const edits = ownEdits(item, opts?.families ?? catalogFamilies);
      const carry = carryEdits(design, edits, opts?.keepSize ? {} : SIZE_SKIP);
      if (
        commitProject(
          replaceItem(p, id, carry.design),
          t('Replace {name}', { name: item.design.name }),
        )
      )
        return null;
      const { project: next, projectModel: nm } = get();
      const report = replaceReport(p, pm, next!, nm!, id);
      const extra = carryText(carry);
      return extra ? { ...report, text: `${report.text} ${extra}` } : report;
    },
    setProjectSetting: (key, value) => {
      const p = get().project;
      if (!p) return [];
      const res = setProjectSetting(p, key, value);
      // Refused when it would resize a size-locked piece (ADR-122): nothing is applied; the notice says why.
      if (
        commitProject(
          res.project,
          t('Set {setting}', { setting: SETTING_LABEL[key].toLowerCase() }),
        )
      )
        return [];
      return res.applied;
    },
    followProject: (id, key) => {
      const p = get().project;
      if (!p) return;
      const next = followProject(p, id, key);
      if (next !== p)
        commitProject(
          next,
          t('Follow project {setting}', { setting: SETTING_LABEL[key].toLowerCase() }),
        );
    },
    duplicateItem: (id) => {
      const p = get().project;
      const res = p && duplicateItem(p, id);
      if (!res) return;
      commitProject(res.project);
      set({ selectedItemId: res.id });
    },
    addLinkedCopy: (id) => {
      const p = get().project;
      const res = p && addLinkedCopy(p, id);
      if (!res) return;
      commitProject(res.project);
      set({ selectedItemId: res.id });
    },
    setLinkAll: (v) => set({ linkAll: v }),
    turnItem: (id, dir) => {
      const p = get().project;
      if (!p) return null;
      // A grouped piece turns with its whole group, about the group's centre (ADR-148).
      const group = withGroups(p, [id]);
      const res = group.length > 1 ? turnSelection(p, group, dir) : tryTurn(p, id, dir);
      if (res.reason) {
        set({ notice: res.reason });
        return res.reason;
      }
      if (res.project !== p) commitProject(res.project);
      return null;
    },
    setRotation: (id, deg) => {
      const p = get().project;
      if (!p) return null;
      const one = setItemRotation(p, id, deg);
      const res = one.reason ? one : carryGroups(p, one.project, [id]);
      if (res.reason) {
        set({ notice: res.reason });
        return res.reason;
      }
      if (res.project !== p) commitProject(res.project);
      return null;
    },
    mirrorItem: (id) => {
      const p = get().project;
      if (!p) return null;
      // A grouped piece mirrors with its whole group (ADR-148).
      const group = withGroups(p, [id]);
      if (group.length > 1) {
        const all = mirrorItems(p, group);
        if (all.refused) return all.refused;
        if (all.project !== p) commitProject(all.project);
        return all.reasons.length
          ? t('Moved without mirroring: {reasons}', { reasons: all.reasons.join('; ') })
          : null;
      }
      const res = mirrorItem(p, id);
      if (res.reason) return res.reason;
      if (res.project !== p) commitProject(res.project);
      return null;
    },
    mirrorRun: (id) => {
      const p = get().project;
      if (!p) return { reasons: [] };
      const res = mirrorRun(p, id);
      if (res.project !== p) commitProject(res.project, t('Mirror the run'));
      return { reasons: res.reasons, ...(res.refused ? { refused: res.refused } : {}) };
    },
    selectItem: (id) => {
      const { project, selectedItemId, drillItemId, selectedItemIds } = get();
      if (id && id === selectedItemId && id === drillItemId && selectedItemIds.length === 1) return;
      set({ selectedItemId: id, notice: null });
      const item = id ? project?.items.find((i) => i.id === id) : undefined;
      if (item && !get().editingItemId) loadDrill(item, null);
      else set({ drillItemId: null });
    },
    toggleItem: (id) => {
      const { selectedItemIds: ids } = get();
      if (!ids.includes(id)) {
        if (!ids.length) return get().selectItem(id);
        return get().selectItems([...ids, id]);
      }
      const rest = ids.filter((x) => x !== id);
      if (rest.length <= 1) return get().selectItem(rest[0] ?? null);
      get().selectItems(rest);
    },
    selectItems: (ids) => {
      const p = get().project;
      const have = new Set([...(p?.items ?? []), ...(p?.models ?? [])].map((i) => i.id));
      const keep = [...new Set(ids)].filter((x) => have.has(x));
      if (keep.length <= 1) return get().selectItem(keep[0] ?? null);
      // Several pieces: none is loaded for space edits (that is one piece's, ADR-088).
      set({ selectedItemIds: keep, selectedItemId: keep[0], drillItemId: null, notice: null });
    },
    selectAll: () => get().selectItems((get().project?.items ?? []).map((i) => i.id)),
    setMultiSelect: (on) => set({ multiSelect: on }),
    moveSelectionBy: (dx, dz, step) => {
      const p = get().project;
      if (!p) return null;
      const res = moveItems(p, withGroups(p, get().selectedItemIds), dx, dz, step);
      if (res.reason) {
        set({ notice: res.reason });
        return res.reason;
      }
      if (res.project !== p) commitProject(res.project);
      return null;
    },
    turnSelectionBy: (dir) => {
      const p = get().project;
      if (!p) return null;
      const res = turnSelection(p, withGroups(p, get().selectedItemIds), dir);
      if (res.reason) {
        set({ notice: res.reason });
        return res.reason;
      }
      if (res.project !== p) commitProject(res.project);
      return null;
    },
    mirrorSelection: () => {
      const p = get().project;
      if (!p) return '';
      const res = mirrorItems(p, withGroups(p, get().selectedItemIds));
      if (res.refused) {
        set({ notice: res.refused });
        return res.refused;
      }
      if (res.project !== p) commitProject(res.project);
      return res.reasons.length
        ? t('Moved without mirroring: {reasons}', { reasons: res.reasons.join('; ') })
        : '';
    },
    deleteSelection: () => {
      const p = get().project;
      const ids = get().selectedItemIds;
      if (!p || !ids.length) return;
      let next = p;
      for (const id of ids) next = removeProjectItem(next, id);
      const models = next.models?.filter((m) => !ids.includes(m.id));
      commitProject(models && models.length !== next.models?.length ? { ...next, models } : next);
      set({ selectedItemId: null });
    },
    duplicateSelection: () => {
      const p = get().project;
      if (!p) return;
      const res = duplicateItems(p, get().selectedItemIds);
      if (!res.ids.length) return;
      commitProject(res.project);
      get().selectItems(res.ids);
    },
    alignSelection: (how) => {
      const p = get().project;
      if (!p) return '';
      const ids = get().selectedItemIds;
      const res = alignItems(p, ids, how);
      // Grouped pieces take their groups along (ADR-148).
      const carried = carryGroups(p, res.project, ids);
      if (carried.reason) return carried.reason;
      if (carried.project !== p && carried.project.items.some((it, i) => it !== p.items[i]))
        commitProject(carried.project, t('Align'));
      return skippedText(res);
    },
    distributeSelection: () => {
      const p = get().project;
      if (!p) return '';
      const ids = get().selectedItemIds;
      const res = distributeItems(p, ids);
      const carried = carryGroups(p, res.project, ids);
      if (carried.reason) return carried.reason;
      if (carried.project.items.some((it, i) => it !== p.items[i]))
        commitProject(carried.project, t('Distribute'));
      // The gaps as they now are, also when a locked piece kept its place.
      const gaps = res.gaps ? t('Gaps now {gaps} mm.', { gaps: res.gaps.join(' · ') }) : '';
      return [gaps, skippedText(res)].filter(Boolean).join(' ');
    },
    groupSelection: () => {
      const p = get().project;
      if (!p) return null;
      const res = groupItems(p, get().selectedItemIds);
      if (res.groupId)
        commitProject(
          res.project,
          t('Group {n|# piece|# pieces}', { n: get().selectedItemIds.length }),
        );
      return res.groupId;
    },
    ungroup: (groupId) => {
      const p = get().project;
      if (!p) return;
      const next = ungroup(p, groupId);
      if (next !== p) commitProject(next, t('Ungroup'));
    },
    editItem: (id) => {
      const item = get().project?.items.find((i) => i.id === id);
      if (!item) return;
      const d = upgradeDesign(item.design);
      projectBeforeEdit = get().project;
      set({
        editingItemId: id,
        drillItemId: null,
        design: d,
        model: buildModel(d),
        selectedId: undefined,
        highlight: [],
        past: [],
        future: [],
        dirtyAt: 0,
        pristine: true,
      });
    },
    backToProject: () => {
      const raw = get().project;
      if (!raw) return;
      // A resized piece moves whatever sits on it; run parts follow it (ADR-061).
      // Edits made in the piece editor reach its linked copies, or unlink it (ADR-111).
      const before = projectBeforeEdit;
      const p = refreshRunParts(resolvePlacements(propagateLinks(before, raw, get().linkAll)));
      // Edits made in the piece editor become one project undo step.
      projectBeforeEdit = null;
      const edited = p.items.find((i) => i.id === get().editingItemId);
      const history =
        before && before !== p
          ? {
              projectPast: [...get().projectPast, before].slice(-HISTORY),
              projectPastNames: [
                ...get().projectPastNames,
                edited ? t('Edit {what}', { what: edited.design.name }) : describeChange(before, p),
              ].slice(-HISTORY),
              projectFuture: [],
              projectFutureNames: [],
            }
          : {};
      set({
        editingItemId: null,
        drillItemId: null,
        project: p,
        projectModel: buildProjectModel(p),
        selectedId: undefined,
        highlight: [],
        ...history,
        ...(p !== raw ? { projectDirtyAt: Date.now() } : {}),
      });
    },
    undoProject: () => {
      const { project, projectPast, projectFuture, editingItemId } = get();
      const { projectPastNames: pn, projectFutureNames: fn } = get();
      const prev = projectPast[projectPast.length - 1];
      if (!project || !prev || editingItemId) return;
      const name = pn[pn.length - 1] ?? t('Change the project');
      restoreProject(prev, projectPast.slice(0, -1), [project, ...projectFuture], pn.slice(0, -1), [
        name,
        ...fn,
      ]);
    },
    redoProject: () => {
      const { project, projectPast, projectFuture, editingItemId } = get();
      const { projectPastNames: pn, projectFutureNames: fn } = get();
      const next = projectFuture[0];
      if (!project || !next || editingItemId) return;
      restoreProject(
        next,
        [...projectPast, project],
        projectFuture.slice(1),
        [...pn, fn[0] ?? t('Change the project')],
        fn.slice(1),
      );
    },
    jumpProject: (steps) => {
      const n = Math.trunc(Math.abs(steps));
      for (let i = 0; i < n; i++) {
        const before = get().project;
        if (steps < 0) get().undoProject();
        else get().redoProject();
        if (get().project === before) break;
      }
    },
    transact: (name, fn) => {
      const start = get().project;
      const past = get().projectPast,
        names = get().projectPastNames;
      txDepth++;
      try {
        fn();
      } finally {
        txDepth--;
      }
      if (txDepth || !start || get().project === start) return;
      // Every step made inside becomes one: the history as it was, plus the state before (ADR-123, G-157).
      set({
        projectPast: [...past, start].slice(-HISTORY),
        projectPastNames: [...names, name].slice(-HISTORY),
        projectFuture: [],
        projectFutureNames: [],
      });
    },
    insertTemplate: (tpl) => {
      const p = get().project;
      if (!p) return [];
      const res = insertTemplate(p, tpl);
      if (!res.ids.length) return [];
      commitProject(res.project, t('Insert {name}', { name: tpl.name }));
      set({ placingIds: res.ids, placingItemId: res.ids[0] });
      get().selectItems(res.ids);
      return res.ids;
    },
    restoreProjectTo: (next) => {
      const p = get().project;
      if (!p) return;
      commitProject({ ...next, id: p.id }, t('Restore a version'));
    },
    takeSessionBase: () => {
      const { sessionBase, project } = get();
      if (!sessionBase || !project || project === sessionBase) return null;
      set({ sessionBase: null });
      return sessionBase;
    },
    applyStyle: (id, style, scope) => {
      const p = get().project;
      if (!p) return { applied: [], skipped: [] };
      const r = applyStyle(p, id, style, scope, get().selectedItemIds);
      if (r.applied.length) commitProject(r.project, t('Apply style {name}', { name: style.name }));
      return { applied: r.applied, skipped: r.skipped };
    },
    suggestRunParts: () => {
      const p = get().project;
      if (!p) return;
      // Automatic refresh is on by default the first time; after that the user's choice is kept (ADR-061).
      const settings = { scribe: p.runSettings?.scribe ?? 0, auto: p.runSettings?.auto ?? true };
      const base = { ...p, runSettings: settings, runPartsRemoved: [] };
      commitProject({ ...base, runParts: planRuns(base).parts });
    },
    removeRunPart: (id) => {
      const p = get().project;
      const rp = p?.runParts?.find((r) => r.id === id);
      if (!p || !rp) return;
      // A part the user asked for (ADR-075) goes with its request; its key stays removed like any other.
      const asked = p.runRequests?.filter((r) => requestKey(r) !== rp.key);
      commitProject({
        ...p,
        runParts: (p.runParts ?? []).filter((r) => r.id !== id),
        runPartsRemoved: [...(p.runPartsRemoved ?? []), rp.key ?? rp.id],
        ...(asked ? { runRequests: asked } : {}),
      });
    },
    setRunRequest: (r) => {
      const p = get().project;
      if (!p) return;
      const key = requestKey(r);
      const settings = p.runSettings ?? { scribe: 0, auto: true };
      const next: Project = {
        ...p,
        schemaVersion: PROJECT_SCHEMA,
        runRequests: [...(p.runRequests ?? []).filter((x) => requestKey(x) !== key), r],
        runPartsRemoved: (p.runPartsRemoved ?? []).filter((k) => k !== key),
      };
      if (settings.auto) {
        commitProject({ ...next, runSettings: settings });
        return;
      }
      // Refresh off: only the asked-for parts are made now (and the worktops they replace go); the rest stay.
      const keys = new Set(next.runRequests!.map(requestKey));
      const wt = new Set(next.runRequests!.flatMap((x) => (x.kind === 'worktop' ? x.from : [])));
      const keep = (p.runParts ?? []).filter(
        (x) =>
          !keys.has(x.key ?? '') && !(x.kind === 'worktop' && x.from?.some((id) => wt.has(id))),
      );
      const made = planRuns(next).parts.filter((x) => keys.has(x.key ?? ''));
      commitProject({ ...next, runSettings: settings, runParts: [...keep, ...made] });
    },
    removeRunRequest: (key) => {
      const p = get().project;
      if (!p?.runRequests) return;
      commitProject({ ...p, runRequests: p.runRequests.filter((r) => requestKey(r) !== key) });
    },
    setRunHandle: (rh) => {
      const p = get().project;
      if (!p) return;
      const rest = (p.runHandles ?? []).filter((x) => x.id !== rh.id);
      commitProject({ ...p, runHandles: [...rest, rh] });
    },
    removeRunHandle: (id) => {
      const p = get().project;
      if (!p?.runHandles) return;
      const rest = p.runHandles.filter((x) => x.id !== id);
      commitProject({ ...p, runHandles: rest.length ? rest : undefined });
    },
    setSink: (sk) => {
      const p = get().project;
      if (!p) return;
      commitProject({ ...p, sinks: [...(p.sinks ?? []).filter((x) => x.id !== sk.id), sk] });
    },
    removeSink: (id) => {
      const p = get().project;
      if (!p?.sinks) return;
      const rest = p.sinks.filter((x) => x.id !== id);
      commitProject({ ...p, sinks: rest.length ? rest : undefined });
    },
    setRunSettings: (patch) => {
      const p = get().project;
      if (!p) return;
      commitProject({ ...p, runSettings: { scribe: 0, auto: false, ...p.runSettings, ...patch } });
    },
    applyMaterial: (id, roles, board, scope, panelId) => {
      const p = get().project;
      if (!id || !p || get().editingItemId === id) {
        // The open piece: one part, or every role it has parts for.
        const d = get().design;
        if (scope === 'part') {
          if (!panelId) return { applied: [], skipped: [] };
          commit(putPartBoard(d, panelId, board));
          return { applied: [panelId], skipped: [] };
        }
        const r = putRoleBoards(d, roles, board);
        if (r.applied.length) commit(r.design);
        return {
          applied: r.applied.length ? [d.name] : [],
          skipped: r.skipped.map(roleName),
        };
      }
      if (scope === 'part') {
        const it = p.items.find((i) => i.id === id);
        if (!it || !panelId) return { applied: [], skipped: [] };
        // Project part ids are `${item.id}:${panel.id}`; the piece stores the panel's own id.
        const own = panelId.startsWith(`${id}:`) ? panelId.slice(id.length + 1) : panelId;
        commitProject(
          {
            ...p,
            items: p.items.map((i) =>
              i.id === id ? { ...i, design: putPartBoard(i.design, own, board) } : i,
            ),
          },
          t('Apply material'),
        );
        return { applied: [own], skipped: [] };
      }
      const r = applyMaterial(p, id, roles, board, scope, get().selectedItemIds);
      if (r.applied.length) commitProject(r.project, t('Apply material'));
      return { applied: r.applied, skipped: r.skipped };
    },
    setCommon: (kind, on) => {
      const p = get().project;
      const ids = get().selectedItemIds.filter((id) => p?.items.some((i) => i.id === id));
      if (!p || ids.length < 2) return t('Select two or more items standing side by side.');
      const others = (p.common ?? []).filter(
        (c) => c.kind !== kind || !c.itemIds.some((x) => ids.includes(x)),
      );
      let common = others;
      if (on) {
        const plan = commonPanelCheck(p, ids, kind);
        if (plan.reason) return plan.reason;
        common = [...others, { id: newId(), kind, itemIds: plan.ids }];
      }
      const { common: _was, ...rest } = p;
      void _was;
      commitProject(
        common.length ? { ...rest, common } : rest,
        kind === 'top' ? t('Common top') : t('Common bottom'),
      );
      return '';
    },
    clearPartBoard: (id, panelId) => {
      const p = get().project;
      if (!id || !p || get().editingItemId === id) return get().setPartMaterial(panelId, null);
      const drop = (d: Design): Design => {
        const next = { ...d.partMaterials };
        delete next[panelId];
        return { ...d, partMaterials: Object.keys(next).length ? next : undefined };
      };
      commitProject(
        { ...p, items: p.items.map((i) => (i.id === id ? { ...i, design: drop(i.design) } : i)) },
        t('Clear part board'),
      );
    },
    applyFinish: (id, role, board, scope) => {
      const p = get().project;
      if (!p) return { applied: [], skipped: [] };
      const r = applyFinish(p, id, role, board, scope, get().selectedItemIds);
      if (r.applied.length) commitProject(r.project, t('Apply finish'));
      return { applied: r.applied, skipped: r.skipped };
    },
    placeAt: (x, z) => {
      const { project: p, placingItemId: id, placingIds } = get();
      const it = p?.items.find((i) => i.id === id);
      set({ placingItemId: null, placingIds: [] });
      if (!p || !it) return;
      const position = tapPosition(it, x, z);
      // A just-inserted template moves as a block, in the same undo step as its insert (ADR-123).
      if (placingIds.length) {
        const left = Math.min(
          ...p.items.filter((i) => placingIds.includes(i.id)).map((i) => i.position.x),
        );
        const back = Math.min(
          ...p.items.filter((i) => placingIds.includes(i.id)).map((i) => i.position.z),
        );
        const res = moveItems(p, placingIds, position.x - left, position.z - back);
        if (!res.reason && res.project !== p)
          commitProject(res.project, undefined, { amend: true });
        return;
      }
      commitProject({ ...p, items: p.items.map((i) => (i.id === it.id ? { ...i, position } : i)) });
    },
    stopPlacing: () => set({ placingItemId: null, placingIds: [] }),
    setRoom: (room) => {
      const p = get().project;
      if (!p) return;
      // A room may now hold pipes and outlets (ADR-072): it is saved at the current project version.
      if (room) commitProject({ ...p, room, schemaVersion: PROJECT_SCHEMA });
      else {
        const { room: _r, ...rest } = p;
        void _r;
        commitProject(rest);
      }
    },
    startDrawRoom: () => set({ drawingRoom: [], placingItemId: null }),
    addRoomCorner: (x, z) => {
      const pts = get().drawingRoom;
      if (pts)
        set({
          drawingRoom: [
            ...pts,
            snapCorner(pts[pts.length - 1], x, z, 10, pts.length >= 2 ? pts[0] : undefined),
          ],
        });
    },
    finishDrawRoom: () => {
      const { drawingRoom: pts, project: p } = get();
      if (!p || !pts || pts.length < 3) return false;
      set({ drawingRoom: null });
      commitProject({
        ...p,
        room: {
          height: p.room?.height ?? DEFAULT_ROOM_HEIGHT,
          features: p.room?.features ?? [],
          outline: closeOutline(pts),
          // Wall backgrounds stay on the walls the new outline still has (ADR-145).
          ...keepWallFinishes(p.room?.walls, closeOutline(pts)),
        },
      });
      return true;
    },
    cancelDrawRoom: () => set({ drawingRoom: null }),
    setKerf: (kerf) => {
      const d = get().design;
      commit({ ...d, cutting: { ...d.cutting, kerf } });
    },
    setHardwareProduct: (key, hp) => {
      const { project, editingItemId } = get();
      if (project && !editingItemId) commitProject(projectWithHardwareProduct(project, key, hp));
      else commit(withHardwareProduct(get().design, key, hp));
    },
    addSellerItem: (it) => commit(withSellerItem(get().design, it)),
    setSellerItemQuantity: (index, quantity) =>
      commit(withSellerItemQuantity(get().design, index, quantity)),
    rename: (name) => commit({ ...get().design, name }),
    setPartMaterial: (panelId, materialId) => {
      const d = get().design;
      const next = { ...d.partMaterials };
      if (materialId) next[panelId] = materialId;
      else delete next[panelId];
      commit({
        ...d,
        schemaVersion: SCHEMA_VERSION,
        partMaterials: Object.keys(next).length ? next : undefined,
      });
    },
    updateCabinet: (patch) => {
      const d = get().design;
      if (d.product.kind !== 'cabinet') return;
      commit({ ...d, product: { ...d.product, params: { ...d.product.params, ...patch } } });
    },
    updateDesk: (patch) => {
      const d = get().design;
      if (d.product.kind !== 'desk') return;
      commit({ ...d, product: { ...d.product, params: { ...d.product.params, ...patch } } });
    },
    updateCorner: (patch) => {
      const d = get().design;
      if (d.product.kind !== 'corner') return;
      commit({ ...d, product: { ...d.product, params: { ...d.product.params, ...patch } } });
    },
    updatePanelSet: (patch) => {
      const d = get().design;
      if (d.product.kind !== 'panels') return;
      commit({ ...d, product: { ...d.product, params: { ...d.product.params, ...patch } } });
    },
    setLoosePanelBoard: (panelId, board) => {
      const d0 = get().design;
      if (d0.product.kind !== 'panels') return;
      const { design: d, id } = withBoard(d0, board);
      if (d.product.kind !== 'panels') return;
      const panels = d.product.params.panels.map((lp) =>
        lp.id === panelId ? { ...lp, materialId: id } : lp,
      );
      commit({ ...d, product: { ...d.product, params: { ...d.product.params, panels } } });
    },
    updatePanel: (patch) => {
      const d = get().design;
      if (d.product.kind !== 'panel') return;
      commit({ ...d, product: { ...d.product, params: { ...d.product.params, ...patch } } });
    },
    updateFrame: (patch) => {
      const d = get().design;
      if (d.product.kind !== 'frame') return;
      commit({ ...d, product: { ...d.product, params: { ...d.product.params, ...patch } } });
    },
    resizePiece: (key, value) => {
      const d = get().design;
      const product = resizeProduct(d.product, key, value);
      if (product !== d.product) commit({ ...d, product });
    },
    resizeItem: (id, key, value) => {
      const it = get().project?.items.find((i) => i.id === id);
      if (!it) return;
      const product = resizeProduct(it.design.product, key, value);
      if (product === it.design.product) return;
      // Resized, a brand's product is no longer that brand's product; its origin stays (ADR-028), as in `commit`.
      const catalog =
        it.design.catalog?.brand && it.design.catalog.origin
          ? { ...it.design.catalog, brand: undefined }
          : it.design.catalog;
      get().updateItem(id, {
        design: { ...it.design, catalog, product, updatedAt: new Date().toISOString() },
      });
    },
    resizeGroup: (groupId, key, value, split) => {
      const p = get().project;
      const g = p?.groups?.find((x) => x.id === groupId);
      if (!p || !g) return '';
      const res = resizeGroup(p, g.itemIds, key, value, split);
      if (res.reason) return res.reason;
      if (res.project !== p) commitProject(res.project, t('Resize {name}', { name: g.name }));
      return res.kept.length ? `Kept: ${res.kept.join(', ')}.` : '';
    },
    updateMeta: (patch) => commit({ ...get().design, ...patch }),
    editTemplateVariant: (template, variantId) => {
      const v = template.family.variants.find((x) => x.id === variantId);
      if (!v?.design) return;
      const d = upgradeDesign(structuredClone(v.design));
      const returnTo = get().templateEdit?.returnTo ?? get().design;
      set({
        templateEdit: { template, variantId, returnTo },
        design: d,
        model: buildModel(d),
        selectedId: undefined,
        highlight: [],
        past: [],
        future: [],
        dirtyAt: 0,
        pristine: true,
        project: null,
        projectModel: null,
        editingItemId: null,
        selectedItemId: null,
        drillItemId: null,
      });
    },
    finishTemplateEdit: (keep) => {
      const te = get().templateEdit;
      if (!te) return null;
      const design = get().design;
      const back = te.returnTo;
      set({
        templateEdit: null,
        design: back,
        model: buildModel(back),
        selectedId: undefined,
        highlight: [],
        past: [],
        future: [],
        dirtyAt: 0,
        pristine: true,
      });
      if (!keep) return null;
      const now = new Date().toISOString();
      return {
        ...te.template,
        revision: te.template.revision + 1,
        updatedAt: now,
        family: {
          ...te.template.family,
          variants: te.template.family.variants.map((v) =>
            v.id === te.variantId ? { ...v, design } : v,
          ),
        },
      };
    },
    updateSpace: (id, fn) => {
      const d = get().design;
      const product = mapProductSpace(d.product, id, fn);
      if (product !== d.product) commit({ ...d, product });
    },
    stepCount: (key, delta) => {
      const { design, selectedId } = get();
      const id = countSubject(design.product, selectedId);
      if (!id) return;
      const row = countRows(design.product, id).find((r) => r.key === key);
      if (!row) return;
      get().updateSpace(row.target, (s) => stepCount(s, key, delta));
      // The whole piece stays selected; a removed bay hands the selection to the space that held it.
      if (selectedId === null) set({ selectedId: null });
      else if (!findInProduct(get().design.product, id)) set({ selectedId: row.target });
    },
    updateMaterial: (id, patch) => {
      const d = get().design;
      commit({ ...d, materials: d.materials.map((m) => (m.id === id ? { ...m, ...patch } : m)) });
    },
    addMaterial: (m) => {
      const d = get().design;
      commit({ ...d, materials: [...d.materials, m] });
    },
    removeMaterial: (id) => {
      const d = get().design;
      const next = { ...d, materials: d.materials.filter((m) => m.id !== id) };
      if (next.materials.length === d.materials.length) return null;
      if (validateDesign(next).length)
        return t(
          'This board is still used by parts of the piece. Choose another board for them first.',
        );
      commit(next);
      return null;
    },
    select: (id) => set({ selectedId: id }),
    setHighlight: (ids) => set({ highlight: ids }),
    setShowFronts: (v) => set({ showFronts: v }),
    setExploded: (v) => set({ exploded: v }),
    setTab: (t) => set({ tab: t, resultsOpen: true }),
    toggleTab: (t) =>
      set((s) =>
        s.resultsOpen && s.tab === t ? { resultsOpen: false } : { tab: t, resultsOpen: true },
      ),
    undo: () => {
      const { past, design, future } = get();
      const prev = past[past.length - 1];
      if (!prev) return;
      set({
        design: prev,
        model: buildModel(prev),
        past: past.slice(0, -1),
        future: [design, ...future],
        selectedId: keepSelection(prev, get().selectedId),
        dirtyAt: Date.now(),
        pristine: false,
      });
      syncItem();
    },
    redo: () => {
      const { past, design, future } = get();
      const next = future[0];
      if (!next) return;
      set({
        design: next,
        model: buildModel(next),
        past: [...past, design],
        future: future.slice(1),
        selectedId: keepSelection(next, get().selectedId),
        dirtyAt: Date.now(),
        pristine: false,
      });
      syncItem();
    },
  };
});
