import { create } from 'zustand';
import { buildModel } from '../core/build';
import {
  findInProduct,
  productRoots,
  mapProductSpace,
  templates,
  upgradeDesign,
  validateDesign,
} from '../core/design';
import { duplicateItem, mirrorItem, mirrorRun, tryTurn } from '../core/arrange';
import { floorDrop, type FloorPoint } from '../core/drag3d';
import { applyFinish, type FinishRole, type FinishScope } from '../core/finish';
import { mergeItems } from '../core/merge';
import { alignItems, distributeItems, skippedText, type AlignHow } from '../core/align';
import {
  duplicateItems,
  groupItems,
  groupOf,
  moveItems,
  sameIds,
  turnSelection,
  ungroup,
} from '../core/selection';
import { replaceItem, replaceReport, type ReplaceReport } from '../core/replace';
import { countRows, countSubject, stepCount, type CountKey } from '../core/counts';
import { drill, type Selection } from '../core/selectPath';
import { resizeProduct, type SizeField } from '../core/pieceSize';
import { closeOutline, DEFAULT_ROOM_HEIGHT, snapCorner, type Pt, type Room } from '../core/room';
import {
  buildProjectModel,
  makeItem,
  moveBy,
  planRuns,
  pruneGroups,
  PROJECT_SCHEMA,
  refreshRunParts,
  requestKey,
  removeProjectItem,
  resolvePlacements,
  roomToPiece,
  keepTemplate,
  setLocked,
  tapPosition,
  trySetGap,
  type Project,
  type ProjectItem,
  type ProjectModel,
  type RunRequest,
  type RunSettings,
} from '../core/project';
import type {
  CabinetParams,
  CornerParams,
  DeskParams,
  Design,
  FrameParams,
  FurnitureModel,
  Material,
  Mm,
  PanelParams,
  PanelSetParams,
  Space,
} from '../core/types';
import type { LocalTemplate } from '../core/catalog/local';

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
  rename: (name: string) => void;
  updateCabinet: (patch: Partial<CabinetParams>) => void;
  updateDesk: (patch: Partial<DeskParams>) => void;
  updateCorner: (patch: Partial<CornerParams>) => void;
  updatePanelSet: (patch: Partial<PanelSetParams>) => void;
  updatePanel: (patch: Partial<PanelParams>) => void;
  updateFrame: (patch: Partial<FrameParams>) => void;
  /** Width or depth of the whole open piece, from its selection (ADR-106). */
  resizePiece: (key: SizeField['key'], value: Mm) => void;
  /** Width or depth of a project piece, from its Selected piece card; one project undo step (ADR-106). */
  resizeItem: (id: string, key: SizeField['key'], value: Mm) => void;
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
  /** Lock or unlock a piece's placement (ADR-095); one undo step. */
  setLocked: (id: string, on: boolean) => void;
  /** "Keep mine" (ADR-096): hide the newer-template notice for this revision; one undo step. */
  keepTemplate: (id: string, revision: number) => void;
  removeItem: (id: string) => void;
  /** Merge two touching cabinets into one (ADR-047); returns why not, or an empty list. */
  mergeItems: (a: string, b: string) => string[];
  /** Duplicate, turn about the centre, mirror a piece or its run (ADR-069); each is one undo step. */
  duplicateItem: (id: string) => void;
  /** Put a catalog copy in the piece's place, keeping where and how it stands (ADR-098); one undo step. */
  replaceItem: (id: string, design: Design) => ReplaceReport | null;
  /** Returns why it did not turn (a locked piece, ADR-095), or null. */
  turnItem: (id: string, dir: 1 | -1) => string | null;
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
  /** Put one board on the fronts or carcass of the selected piece, its run or the whole project (ADR-055). */
  applyFinish: (
    id: string,
    role: FinishRole,
    board: Material,
    scope: FinishScope,
  ) => { applied: string[]; skipped: string[] };
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
  const commitProject = (next: Project) => {
    // Pieces on or above others follow them (ADR-031); run parts follow the pieces in the same step (ADR-061).
    // A piece no longer in the project leaves its group (ADR-097).
    const stamped = {
      ...refreshRunParts(resolvePlacements(pruneGroups(next))),
      schemaVersion: PROJECT_SCHEMA, // an edited project is saved in the current shape (ADR-011, ADR-073)
      updatedAt: new Date().toISOString(),
    };
    const prev = get().project;
    set({
      project: stamped,
      projectModel: buildProjectModel(stamped),
      projectDirtyAt: Date.now(),
      notice: null,
      ...(prev
        ? { projectPast: [...get().projectPast, prev].slice(-HISTORY), projectFuture: [] }
        : {}),
    });
    keepSelected(stamped);
    syncDrill();
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
  const restoreProject = (p: Project, projectPast: Project[], projectFuture: Project[]) => {
    const sel = get().selectedItemId;
    set({
      project: p,
      projectModel: buildProjectModel(p),
      projectPast,
      projectFuture,
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
      const item = makeItem(p, d, libraryId);
      commitProject({ ...p, items: [...p.items, item] });
      set({ selectedItemId: item.id, placingItemId: item.id });
    },
    addPieceAt: (d, x, z, libraryId) => {
      const p = get().project;
      if (!p) return;
      const made = makeItem(p, d, libraryId);
      // Not clamped here: `dropNewPiece` already placed it as a tap does, and a snap may put it against a wall of
      // a drawn room at x or z below 0.
      const position = { ...made.position, x: Math.round(x) || 0, z: Math.round(z) || 0 };
      const item: ProjectItem = { ...made, position };
      commitProject({ ...p, items: [...p.items, item] });
      set({ selectedItemId: item.id, placingItemId: null });
    },
    updateItem: (id, patch) => {
      const p = get().project;
      if (p)
        commitProject({ ...p, items: p.items.map((i) => (i.id === id ? { ...i, ...patch } : i)) });
    },
    moveItemBy: (id, dxMm, dzMm, step) => {
      const p = get().project;
      if (!p) return null;
      const res = moveBy(p, id, dxMm, dzMm, step);
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
      const res = trySetGap(p, id, gap, moveRight);
      if (res.project !== p) commitProject(res.project);
      return res.reason ?? null;
    },
    setLocked: (id, on) => {
      const p = get().project;
      if (!p) return;
      const next = setLocked(p, id, on);
      if (next !== p) commitProject(next);
    },
    keepTemplate: (id, revision) => {
      const p = get().project;
      if (!p) return;
      const next = keepTemplate(p, id, revision);
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
      if (!p) return ['No project is open.'];
      const res = mergeItems(p, a, b);
      if (res.mergedId) {
        commitProject(res.project);
        set({ selectedItemId: res.mergedId });
      }
      return res.issues;
    },
    replaceItem: (id, design) => {
      const { project: p, projectModel: pm } = get();
      if (!p || !pm || !p.items.some((i) => i.id === id)) return null;
      commitProject(replaceItem(p, id, design));
      const { project: next, projectModel: nm } = get();
      return replaceReport(p, pm, next!, nm!, id);
    },
    duplicateItem: (id) => {
      const p = get().project;
      const res = p && duplicateItem(p, id);
      if (!res) return;
      commitProject(res.project);
      set({ selectedItemId: res.id });
    },
    turnItem: (id, dir) => {
      const p = get().project;
      if (!p) return null;
      const res = tryTurn(p, id, dir);
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
      const res = mirrorItem(p, id);
      if (res.reason) return res.reason;
      if (res.project !== p) commitProject(res.project);
      return null;
    },
    mirrorRun: (id) => {
      const p = get().project;
      if (!p) return { reasons: [] };
      const res = mirrorRun(p, id);
      if (res.project !== p) commitProject(res.project);
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
      const res = moveItems(p, get().selectedItemIds, dx, dz, step);
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
      const res = turnSelection(p, get().selectedItemIds, dir);
      if (res.reason) {
        set({ notice: res.reason });
        return res.reason;
      }
      if (res.project !== p) commitProject(res.project);
      return null;
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
      const res = alignItems(p, get().selectedItemIds, how);
      if (res.project !== p && res.project.items.some((it, i) => it !== p.items[i]))
        commitProject(res.project);
      return skippedText(res);
    },
    distributeSelection: () => {
      const p = get().project;
      if (!p) return '';
      const res = distributeItems(p, get().selectedItemIds);
      if (res.project.items.some((it, i) => it !== p.items[i])) commitProject(res.project);
      // The gaps as they now are, also when a locked piece kept its place.
      const gaps = res.gaps ? `Gaps now ${res.gaps.join(' · ')} mm.` : '';
      return [gaps, skippedText(res)].filter(Boolean).join(' ');
    },
    groupSelection: () => {
      const p = get().project;
      if (!p) return null;
      const res = groupItems(p, get().selectedItemIds);
      if (res.groupId) commitProject(res.project);
      return res.groupId;
    },
    ungroup: (groupId) => {
      const p = get().project;
      if (!p) return;
      const next = ungroup(p, groupId);
      if (next !== p) commitProject(next);
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
      const p = refreshRunParts(resolvePlacements(raw));
      // Edits made in the piece editor become one project undo step.
      const before = projectBeforeEdit;
      projectBeforeEdit = null;
      const history =
        before && before !== p
          ? { projectPast: [...get().projectPast, before].slice(-HISTORY), projectFuture: [] }
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
      const prev = projectPast[projectPast.length - 1];
      if (!project || !prev || editingItemId) return;
      restoreProject(prev, projectPast.slice(0, -1), [project, ...projectFuture]);
    },
    redoProject: () => {
      const { project, projectPast, projectFuture, editingItemId } = get();
      const next = projectFuture[0];
      if (!project || !next || editingItemId) return;
      restoreProject(next, [...projectPast, project], projectFuture.slice(1));
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
    setRunSettings: (patch) => {
      const p = get().project;
      if (!p) return;
      commitProject({ ...p, runSettings: { scribe: 0, auto: false, ...p.runSettings, ...patch } });
    },
    applyFinish: (id, role, board, scope) => {
      const p = get().project;
      if (!p) return { applied: [], skipped: [] };
      const r = applyFinish(p, id, role, board, scope, get().selectedItemIds);
      if (r.applied.length) commitProject(r.project);
      return { applied: r.applied, skipped: r.skipped };
    },
    placeAt: (x, z) => {
      const { project: p, placingItemId: id } = get();
      const it = p?.items.find((i) => i.id === id);
      set({ placingItemId: null });
      if (!p || !it) return;
      const position = tapPosition(it, x, z);
      commitProject({ ...p, items: p.items.map((i) => (i.id === it.id ? { ...i, position } : i)) });
    },
    stopPlacing: () => set({ placingItemId: null }),
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
        },
      });
      return true;
    },
    cancelDrawRoom: () => set({ drawingRoom: null }),
    setKerf: (kerf) => {
      const d = get().design;
      commit({ ...d, cutting: { ...d.cutting, kerf } });
    },
    rename: (name) => commit({ ...get().design, name }),
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
        return 'This board is still used by parts of the piece. Choose another board for them first.';
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
