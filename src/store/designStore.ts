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
import { duplicateItem, mirrorItem, mirrorRun, turnAboutCentre } from '../core/arrange';
import { applyFinish, type FinishRole, type FinishScope } from '../core/finish';
import { mergeItems } from '../core/merge';
import { countRows, countSubject, stepCount, type CountKey } from '../core/counts';
import { drill, type Selection } from '../core/selectPath';
import { closeOutline, DEFAULT_ROOM_HEIGHT, snapCorner, type Pt, type Room } from '../core/room';
import {
  buildProjectModel,
  dragPosition,
  liftOff,
  makeItem,
  planRuns,
  PROJECT_SCHEMA,
  refreshRunParts,
  requestKey,
  removeProjectItem,
  resolvePlacements,
  roomToPiece,
  setGapLeft,
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
  /** Piece selected in the project view. */
  selectedItemId: string | null;
  /**
   * Project piece whose design is loaded into `design`/`model` while the project editor stays open (ADR-088): taps
   * drill into it and its spaces are edited from the project panel. Active only while it is the selected piece.
   */
  drillItemId: string | null;
  projectDirtyAt: number;
  /** Project-level history (ADR-051): earlier and undone states of the open project. */
  projectPast: Project[];
  projectFuture: Project[];
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
  setTab: (t: Tab) => void;
  undo: () => void;
  redo: () => void;
  openProject: (p: Project) => void;
  closeProject: () => void;
  updateProject: (fn: (p: Project) => Project) => void;
  addPiece: (d: Design, libraryId?: string) => void;
  updateItem: (id: string, patch: Partial<ProjectItem>) => void;
  /**
   * Move a piece on the plan by a drag or an arrow key (ADR-065): rounded to the step, lifted off a base, one undo
   * step. Nothing happens (no step) when the piece would not move.
   */
  moveItemBy: (id: string, dxMm: number, dzMm: number, step?: number) => void;
  setGap: (id: string, gap: number, moveRight: boolean) => void;
  removeItem: (id: string) => void;
  /** Merge two touching cabinets into one (ADR-047); returns why not, or an empty list. */
  mergeItems: (a: string, b: string) => string[];
  /** Duplicate, turn about the centre, mirror a piece or its run (ADR-069); each is one undo step. */
  duplicateItem: (id: string) => void;
  turnItem: (id: string, dir: 1 | -1) => void;
  /** Returns why nothing changed ("Nothing to mirror in this piece"), or null. */
  mirrorItem: (id: string) => string | null;
  /** Returns the pieces of the run that had nothing to mirror (they still move). */
  mirrorRun: (id: string) => string[];
  selectItem: (id: string | null) => void;
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

export const useDesign = create<State>((set, get) => {
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
    const stamped = {
      ...refreshRunParts(resolvePlacements(next)),
      schemaVersion: PROJECT_SCHEMA, // an edited project is saved in the current shape (ADR-011, ADR-073)
      updatedAt: new Date().toISOString(),
    };
    const prev = get().project;
    set({
      project: stamped,
      projectModel: buildProjectModel(stamped),
      projectDirtyAt: Date.now(),
      ...(prev
        ? { projectPast: [...get().projectPast, prev].slice(-HISTORY), projectFuture: [] }
        : {}),
    });
    syncDrill();
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
      selectedItemId:
        sel && [...p.items, ...(p.models ?? [])].some((i) => i.id === sel) ? sel : null,
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
    past: [],
    future: [],
    dirtyAt: 0,
    pristine: false,
    project: null,
    projectModel: null,
    editingItemId: null,
    selectedItemId: null,
    drillItemId: null,
    projectDirtyAt: 0,
    projectPast: [],
    projectFuture: [],
    placingItemId: null,
    drawingRoom: null,
    templateEdit: null,

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
      });
    },
    closeProject: () =>
      set({
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
    updateItem: (id, patch) => {
      const p = get().project;
      if (p)
        commitProject({ ...p, items: p.items.map((i) => (i.id === id ? { ...i, ...patch } : i)) });
    },
    moveItemBy: (id, dxMm, dzMm, step) => {
      const p = get().project;
      const it = p?.items.find((i) => i.id === id);
      if (!p || !it) return;
      const position = dragPosition(it, dxMm, dzMm, step);
      if (position.x === it.position.x && position.z === it.position.z) return;
      const placement = liftOff(it);
      const { placement: _old, ...rest } = it;
      void _old;
      const moved: ProjectItem = { ...rest, position, ...(placement ? { placement } : {}) };
      commitProject({ ...p, items: p.items.map((i) => (i.id === id ? moved : i)) });
    },
    setGap: (id, gap, moveRight) => {
      const p = get().project;
      if (p) {
        const next = setGapLeft(p, id, gap, moveRight);
        if (next !== p) commitProject(next);
      }
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
    duplicateItem: (id) => {
      const p = get().project;
      const res = p && duplicateItem(p, id);
      if (!res) return;
      commitProject(res.project);
      set({ selectedItemId: res.id });
    },
    turnItem: (id, dir) => {
      const p = get().project;
      if (!p) return;
      const next = turnAboutCentre(p, id, dir);
      if (next !== p) commitProject(next);
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
      if (!p) return [];
      const res = mirrorRun(p, id);
      if (res.project !== p) commitProject(res.project);
      return res.reasons;
    },
    selectItem: (id) => {
      const { project, selectedItemId, drillItemId } = get();
      if (id && id === selectedItemId && id === drillItemId) return;
      set({ selectedItemId: id });
      const item = id ? project?.items.find((i) => i.id === id) : undefined;
      if (item && !get().editingItemId) loadDrill(item, null);
      else set({ drillItemId: null });
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
      const r = applyFinish(p, id, role, board, scope);
      if (r.applied.length) commitProject(r.project);
      return { applied: r.applied, skipped: r.skipped };
    },
    placeAt: (x, z) => {
      const { project: p, placingItemId: id } = get();
      const it = p?.items.find((i) => i.id === id);
      set({ placingItemId: null });
      if (!p || !it) return;
      const position = {
        ...it.position,
        x: Math.max(0, Math.round(x)),
        z: Math.max(0, Math.round(z)),
      };
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
    setTab: (t) => set({ tab: t }),
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
