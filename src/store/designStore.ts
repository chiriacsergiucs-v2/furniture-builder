import { turnModelItem } from '../core/model3d';
import { create } from 'zustand';
import { buildModel } from '../core/build';
import {
  projectSellerItemQuantity,
  projectWithHardwareProduct,
  projectWithSellerItem,
  withHardwareProduct,
  withSellerItem,
  withSellerItemQuantity,
} from '../core/sellers/choices';
import {
  findInProduct,
  productRoots,
  mapProductSpace,
  SCHEMA_VERSION,
  templates,
  upgradeDesign,
  validateDesign,
} from '../core/design';
import { duplicateItem, mirrorItem, mirrorRun, setItemRotation, tryTurn } from '../core/arrange';
import { floorDrop } from '../core/drag3d';
import { withBoard } from '../core/finish';
import { pruneCommon } from '../core/common';
import { pruneShared } from '../core/shared';
import {
  alongWalls,
  carryUnits,
  movingSet,
  pruneConnections,
  settleConnections,
} from '../core/connections';
import { mergeItems } from '../core/merge';
import { describeChange } from '../core/history';
import { insertTemplate } from '../core/insertTemplate';
import { addLinkedCopy, linkIdentical, propagateLinks } from '../core/linked';
import { alignItems, distributeItems, skippedText } from '../core/align';
import {
  duplicateItems,
  groupItems,
  groupOf,
  mirrorItems,
  moveItems,
  sameIds,
  turnSelection,
  ungroup,
  renameGroup,
} from '../core/selection';
import { replaceItem, replaceReport } from '../core/replace';
import { catalogFamilies } from '../core/catalog';
import { carryEdits, carryText, ownEdits, SIZE_SKIP, syncRef } from '../core/ownEdits';
import { setProjectSetting, SETTING_LABEL, withSettings } from '../core/projectSettings';
import { countRows, countSubject, stepCount } from '../core/counts';
import { drill, type Selection } from '../core/selectPath';
import { resizeBed, resizeProduct } from '../core/pieceSize';
import { carryGroups, withGroups } from '../core/groupMove';
import { resizeGroup } from '../core/groupSize';
import { resizeBlocked, setAxisLocked, setSizeLocked, sizeLockBlocked } from '../core/sizeLock';
import {
  lockBlocked,
  pieceLocksBlocked,
  setBoardsLocked,
  setConstructionLocked,
} from '../core/pieceLocks';
import { setWallHeight } from '../core/height';
import { moveTo } from '../core/moveTo';
import {
  buildProjectModel,
  makeItem,
  moveBy,
  pruneGroups,
  pruneRunExtras,
  pruneWorktopJoints,
  PROJECT_SCHEMA,
  refreshRunParts,
  removeBlocked,
  removeProjectItem,
  resolvePlacements,
  roomToPiece,
  keepTemplate,
  linkItemOrigin,
  setLocked,
  trySetGap,
  type Project,
  type ProjectItem,
  pruneWorktopEdges,
  remakeAskedParts,
  setTurnLocked,
} from '../core/project';
import type { Design, Product } from '../core/types';
import { t } from '../core/i18n';
import { syncSets } from '../core/sets';
import {
  applyBindings,
  applyDesignBindings,
  applyPieceBindings,
  heldByBinding,
} from '../core/variables';
import type { State, StoreHelpers } from './designState';

import { variableActions } from './designVariables';

import { runActions } from './designRunActions';

import { roomActions } from './designRoomActions';

export * from './designState';

/** A space selection that no longer exists in the design falls back to the whole piece. */
const keepSelection = (d: Design, sel: Selection): Selection =>
  sel && !findInProduct(d.product, sel) ? null : sel;

const HISTORY = 100;

/** "Change all copies" survives a reload on this device (ADR-245); on unless the user turned it off. */
const LINK_ALL_KEY = 'fb:link-all-off';
const readLinkAll = (): boolean => {
  try {
    return localStorage.getItem(LINK_ALL_KEY) !== '1';
  } catch {
    return true;
  }
};
const writeLinkAll = (on: boolean) => {
  try {
    if (on) localStorage.removeItem(LINK_ALL_KEY);
    else localStorage.setItem(LINK_ALL_KEY, '1');
  } catch {
    // A browser that keeps nothing: the choice lasts for this visit only.
  }
};

export const useDesign = create<State>((rawSet, get) => {
  // Setting the main selected piece alone selects just that piece (ADR-097).
  const withIds = (p: Partial<State>): Partial<State> =>
    'selectedItemId' in p && !('selectedItemIds' in p)
      ? { ...p, selectedItemIds: p.selectedItemId ? [p.selectedItemId] : [] }
      : p;
  const set = (partial: Partial<State> | ((s: State) => Partial<State>)) =>
    typeof partial === 'function' ? rawSet((s) => withIds(partial(s))) : rawSet(withIds(partial));
  /** Every edit goes through here: history, timestamp, rebuild. */
  /** Returns why the edit was refused (a lock, ADR-122/211), or null (ADR-244: callers report it truthfully). */
  const commit = (next: Design): string | null => {
    const { design, past } = get();
    if (next === design) return null;
    // A project piece whose size is locked keeps its size (ADR-122): the edit is refused and the reason shown.
    const open = get().editingItemId ?? get().drillItemId;
    const p0 = get().project;
    // Boards and construction locks (ADR-211) refuse their changes the same way.
    const locked =
      p0 && open ? (resizeBlocked(p0, open, next) ?? lockBlocked(p0, open, next)) : null;
    if (locked) {
      set({ notice: locked });
      return locked;
    }
    // The piece's own bindings take its own variables' values (ADR-210); inside a project, a project binding on the
    // same target wins, so it is left to the project's commit.
    const openItem = p0 && open ? p0.items.find((i) => i.id === open) : undefined;
    const bound = applyDesignBindings(next, openItem?.bindings?.map((b) => b.target) ?? []);
    // A copy of a brand's product stops being that brand's product once edited; its origin stays (ADR-028).
    const debranded =
      bound.catalog?.brand && bound.catalog.origin
        ? { ...bound, catalog: { ...bound.catalog, brand: undefined } }
        : bound;
    const stamped = { ...debranded, updatedAt: new Date().toISOString() };
    // Edited from the project editor (ADR-088): each change is one project undo step (ADR-051), and the piece keeps
    // no history of its own (ADR-231).
    const drilling = !!(p0 && !get().editingItemId && get().drillItemId);
    const partial: Partial<State> = {
      design: stamped,
      model: buildModel(stamped),
      past: drilling ? past : [...past, design].slice(-HISTORY),
      future: [],
      dirtyAt: Date.now(),
      pristine: false,
    };
    const sel = get().selectedId;
    if (sel && !findInProduct(stamped.product, sel)) partial.selectedId = null;
    // Editing a project piece: the change lives in the project's embedded copy, never the library (ADR-022).
    const { project, editingItemId, drillItemId } = get();
    if (project && drilling)
      return commitProject(
        {
          ...project,
          items: project.items.map((i) => (i.id === drillItemId ? { ...i, design: stamped } : i)),
        },
        undefined,
        { also: partial },
      );
    // One `set` per edit (ADR-231).
    set(
      project && editingItemId
        ? {
            ...partial,
            project: {
              ...project,
              updatedAt: stamped.updatedAt,
              items: project.items.map((i) =>
                i.id === editingItemId ? { ...i, design: stamped } : i,
              ),
            },
            projectDirtyAt: Date.now(),
          }
        : partial,
    );
    return null;
  };
  /**
   * Group and project scopes leave a piece whose `keys` lock is on as it was and name it (ADR-244), instead of the
   * whole change being refused by one locked piece.
   */
  const leaveLocked = (
    base: Project,
    next: Project,
    keys: readonly ('boardsLocked' | 'constructionLocked')[],
  ): { project: Project; kept: string[] } => {
    const kept: string[] = [];
    const items = next.items.map((it) => {
      const was = base.items.find((b) => b.id === it.id);
      if (!was || was.design === it.design || !keys.some((k) => was[k])) return it;
      kept.push(was.design.name);
      return { ...it, design: was.design };
    });
    return kept.length ? { project: { ...next, items }, kept } : { project: next, kept };
  };
  /** Commit an apply-to-many result (ADR-244): locked pieces kept, and a refusal reported, never a false "applied". */
  const commitApplied = (
    base: Project,
    r: { project: Project; applied: string[]; skipped: string[] },
    name: string,
    keys: readonly ('boardsLocked' | 'constructionLocked')[],
  ): { applied: string[]; skipped: string[] } => {
    if (!r.applied.length) return { applied: [], skipped: r.skipped };
    const { project, kept } = leaveLocked(base, r.project, keys);
    // Names can repeat (two "Base cabinet"s): one applied name goes per piece kept as it was.
    const applied = [...r.applied];
    for (const k of kept) {
      const n = applied.indexOf(k);
      if (n >= 0) applied.splice(n, 1);
    }
    const skipped = [...r.skipped, ...kept.map((name) => t('{name}: locked', { name }))];
    if (!applied.length || project.items.every((it, n) => it === base.items[n]))
      return { applied: [], skipped };
    const why = commitProject(project, name);
    return why ? { applied: [], skipped: [...skipped, why] } : { applied, skipped };
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
  const drillView = (st: State): Partial<State> => {
    const { project, drillItemId, design, selectedId } = st;
    if (!drillItemId) return {};
    const item = project?.items.find((i) => i.id === drillItemId);
    if (!item) return { drillItemId: null, selectedId: undefined };
    if (item.design === design) return {};
    const d = upgradeDesign(item.design);
    const keep = typeof selectedId !== 'string' || findInProduct(d.product, selectedId);
    return { design: d, model: buildModel(d), selectedId: keep ? selectedId : null };
  };
  /** `partial` with the loaded piece and the selection following the project in it, as one `set` (ADR-231). */
  const settle = (partial: Partial<State>, p?: Project): Partial<State> => {
    const kept = p ? { ...partial, ...keepSelected(p, { ...get(), ...partial }) } : partial;
    return { ...kept, ...drillView({ ...get(), ...kept }) };
  };
  /** Inside `transact`: the depth, and the project and history as they were when it started. */
  let txDepth = 0;
  /** Commit a project change as one named step; returns why it was refused (a size-locked piece, ADR-122), or null. */
  const commitProject = (
    next: Project,
    name?: string,
    opts?: { amend?: boolean; base?: Project | null; also?: Partial<State> },
  ): string | null => {
    // What the change is checked against and undoes to: the current project, or the project as it was when the
    // piece editor opened (ADR-226).
    const base = opts && 'base' in opts ? (opts.base ?? null) : get().project;
    // Pieces on or above others follow them (ADR-031); run parts follow the pieces in the same step (ADR-061).
    // A piece no longer in the project leaves its group (ADR-097).
    // A change to a linked copy reaches the others, or unlinks it (ADR-111).
    let linked = propagateLinks(base, next, get().linkAll);
    // Template references keep their overrides up to date while the template's revision is the catalog's (ADR-124).
    const items = linked.items.map((i) => syncRef(i, catalogFamilies));
    if (items.some((i, n) => i !== linked.items[n])) linked = { ...linked, items };
    // Nothing resizes a size-locked piece (ADR-122), also through a linked copy, a project-wide setting or Replace:
    // the whole change is refused.
    const locked = sizeLockBlocked(base, linked) ?? pieceLocksBlocked(base, linked);
    if (locked) {
      // Refused: the project stays as it was before the change (ADR-226: also after a piece-editor session).
      const cur = get().project;
      set(
        settle({
          ...opts?.also,
          notice: locked,
          ...(base && cur !== base ? { project: base, projectModel: buildProjectModel(base) } : {}),
        }),
      );
      return locked;
    }
    // Bindings take their variables' values and value sets keep their duplicates (ADR-166, ADR-167); a bound field
    // the change tried to move is held and the reason shown.
    // Sets first, so a fresh duplicate takes its set's values in the same step.
    // A piece's own bindings first (ADR-210), so a project binding on the same target wins. With automatic refresh
    // off, the parts of run requests a binding changed are made again (ADR-209).
    const synced = applyPieceBindings(syncSets(linked));
    const bound = remakeAskedParts(synced, applyBindings(synced));
    const held = heldByBinding(base, linked, bound);
    // Worktop corner joints and edges follow their worktops (ADR-205, ADR-209).
    const stamped = {
      ...pruneWorktopEdges(
        pruneWorktopJoints(
          refreshRunParts(
            resolvePlacements(
              pruneRunExtras(pruneShared(pruneConnections(pruneCommon(pruneGroups(bound))))),
            ),
          ),
        ),
      ),
      schemaVersion: PROJECT_SCHEMA, // an edited project is saved in the current shape (ADR-011, ADR-073)
      updatedAt: new Date().toISOString(),
    };
    const prev = base;
    // Amending (a template placed by the tap after its insert): the change joins the step before it (ADR-123).
    const amend = !!opts?.amend && get().projectPast.length > 0;
    const partial: Partial<State> = {
      ...opts?.also,
      project: stamped,
      projectModel: buildProjectModel(stamped),
      projectDirtyAt: Date.now(),
      notice: held,
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
    };
    // One `set` per commit (ADR-231): the selection and the loaded piece follow in the same step.
    set(settle(partial, stamped));
    return null;
  };
  /** The selection keeps the pieces still in the project; the main one falls to the next selected (ADR-097). */
  const keepSelected = (p: Project, st: State): Partial<State> => {
    const { selectedItemIds, selectedItemId } = st;
    if (selectedItemIds.length < 2) return {};
    const have = new Set([...p.items, ...(p.models ?? [])].map((i) => i.id));
    const ids = selectedItemIds.filter((x) => have.has(x));
    if (ids.length === selectedItemIds.length) return {};
    return {
      selectedItemIds: ids,
      selectedItemId: ids.includes(selectedItemId ?? '') ? selectedItemId : (ids[0] ?? null),
    };
  };
  /** Commit `f(project)` when it changed the project; a no-op otherwise (ADR-231). */
  const projectAction = (f: (p: Project) => Project, name?: string) => {
    const p = get().project;
    if (!p) return;
    const next = f(p);
    if (next !== p) commitProject(next, name);
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
    const partial: Partial<State> = {
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
    };
    set(settle(partial));
  };
  const h: StoreHelpers = {
    set,
    get,
    commit,
    leaveLocked,
    commitApplied,
    syncItem,
    loadDrill,
    drillView,
    settle,
    commitProject,
    keepSelected,
    projectAction,
    restoreProject,
  };
  const initial = templates[0].create();
  return {
    design: initial,
    model: buildModel(initial),
    selectedId: undefined,
    highlight: [],
    showFronts: true,
    linkAll: readLinkAll(),
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
    scalingPlan: null,
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
      // A piece-editor session of another project never undoes into this one (ADR-245).
      projectBeforeEdit = null;
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
        scalingPlan: null,
        notice: null,
      });
    },
    updateProject: (fn) => {
      const p = get().project;
      return p ? commitProject(fn(p)) : null;
    },
    addPiece: (d, libraryId) => {
      const p = get().project;
      if (!p) return;
      // A new piece follows the project settings (ADR-124).
      const item = makeItem(p, withSettings(d, p.settings), libraryId);
      commitProject({ ...p, items: [...p.items, item] });
      set({ selectedItemId: item.id, placingItemId: item.id });
    },
    addPieceAt: (d, x, z, libraryId, snapped) => {
      const p = get().project;
      if (!p) return;
      const made = makeItem(p, withSettings(d, p.settings), libraryId);
      // Not clamped here: `dropNewPiece` already placed it as a tap does, and a snap may put it against a wall of
      // a drawn room at x or z below 0.
      const position = { ...made.position, x: Math.round(x) || 0, z: Math.round(z) || 0 };
      const item: ProjectItem = { ...made, position };
      // A snapped drop against a valid neighbour connects them (ADR-168), in the same step.
      commitProject(settleConnections({ ...p, items: [...p.items, item] }, [item.id], !!snapped));
      set({ selectedItemId: item.id, placingItemId: null });
    },
    updateItem: (id, patch) => {
      const p = get().project;
      if (!p) return null;
      const next = { ...p, items: p.items.map((i) => (i.id === id ? { ...i, ...patch } : i)) };
      // A grouped piece moved from its fields takes its group along (ADR-148).
      const res = 'position' in patch || 'placement' in patch ? carryGroups(p, next, [id]) : null;
      if (res?.reason) {
        set({ notice: res.reason });
        return res.reason;
      }
      commitProject(res?.project ?? next);
      return null;
    },
    moveItemBy: (id, dxMm, dzMm, step, opts) => {
      const p = get().project;
      if (!p) return null;
      // A grouped piece moves with its whole group (ADR-148) and a connected one with its neighbours (ADR-168),
      // unless Alt was held (`alone`). A piece against a wall slides along it (ADR-207).
      const unit = movingSet(p, [id], !opts?.alone);
      const { dx, dz } = opts?.alone ? { dx: dxMm, dz: dzMm } : alongWalls(p, unit, dxMm, dzMm);
      const res = unit.length > 1 ? moveItems(p, unit, dx, dz, step) : moveBy(p, id, dx, dz, step);
      if (res.reason) {
        set({ notice: res.reason });
        return res.reason;
      }
      if (res.project !== p) commitProject(settleConnections(res.project, unit, !!opts?.snapped));
      return null;
    },
    dropItemAt: (id, from, to, snap, alone) => {
      const p = get().project;
      const it = p?.items.find((i) => i.id === id);
      const pieces = get().projectModel?.pieces;
      if (!p || !it || !pieces) return null;
      const t = floorDrop(p, pieces, id, from, to, snap);
      return t
        ? get().moveItemBy(id, t.position.x - it.position.x, t.position.z - it.position.z, 1, {
            snapped: !!t.snap,
            alone,
          })
        : null;
    },
    setGap: (id, gap, moveRight) => {
      const p = get().project;
      if (!p) return null;
      const set1 = trySetGap(p, id, gap, moveRight);
      const res = set1.reason ? set1 : carryGroups(p, set1.project, [id]);
      // Every refusal reaches the notice too, however the action was asked for (ADR-244).
      if (res.reason) set({ notice: res.reason });
      else if (res.project !== p) commitProject(settleConnections(res.project, [id], false));
      return res.reason ?? null;
    },
    moveItemTo: (id, action) => {
      const p = get().project;
      if (!p) return null;
      const ids = typeof id === 'string' ? [id] : [...id];
      const one = moveTo(p, ids, action);
      // Its group and connected pieces come along (ADR-148, ADR-168); landing against a neighbour connects.
      const res = one.reason ? one : carryUnits(p, one.project, ids);
      if (res.reason) {
        set({ notice: res.reason });
        return res.reason;
      }
      if (res.project !== p) commitProject(settleConnections(res.project, movingSet(p, ids), true));
      return null;
    },
    setLocked: (id, on) => projectAction((p) => setLocked(p, id, on)),
    setSizeLocked: (id, on) => projectAction((p) => setSizeLocked(p, id, on)),
    setTurnLocked: (id, on) => projectAction((p) => setTurnLocked(p, id, on)),
    setAxisLocked: (id, axis, on) => projectAction((p) => setAxisLocked(p, id, axis, on)),
    setBoardsLocked: (id, on) => projectAction((p) => setBoardsLocked(p, id, on)),
    setConstructionLocked: (id, on) => projectAction((p) => setConstructionLocked(p, id, on)),
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
    keepTemplate: (id, revision) => projectAction((p) => keepTemplate(p, id, revision)),
    linkTemplate: (id, origin) => projectAction((p) => linkItemOrigin(p, id, origin)),
    removeItem: (id) => {
      const p = get().project;
      if (!p) return;
      // A placement-locked piece is not removed (ADR-243); the user unlocks it first.
      const why = removeBlocked(p, [id]);
      if (why) return set({ notice: why });
      commitProject(removeProjectItem(p, id));
      set({ selectedItemId: null });
    },
    mergeItems: (a, b) => {
      const p = get().project;
      if (!p) return [t('No project is open.')];
      const res = mergeItems(p, a, b);
      if (!res.mergedId) {
        // A refused merge says why (ADR-244).
        set({ notice: res.issues.join(' ') });
        return res.issues;
      }
      const why = commitProject(res.project);
      if (why) return [why];
      set({ selectedItemId: res.mergedId });
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
    ...variableActions(h),
    duplicateItem: (id) => {
      const p = get().project;
      const res = p && duplicateItem(p, id);
      if (!res) return;
      commitProject(res.project);
      set({ selectedItemId: res.id });
    },
    linkIdentical: (id) => projectAction((p) => linkIdentical(p, id), t('Link identical pieces')),
    setAssembly: (itemId, edit, name) => {
      // The user's steps live in the design (ADR-207, design schemaVersion 9).
      const apply = (d: Design): Design => {
        const { assembly: _was, ...rest } = d;
        void _was;
        return edit
          ? { ...rest, schemaVersion: SCHEMA_VERSION, assembly: edit }
          : { ...rest, schemaVersion: d.schemaVersion };
      };
      const p = get().project;
      if (itemId && p && get().editingItemId !== itemId) {
        const it = p.items.find((i) => i.id === itemId);
        if (!it) return;
        commitProject(
          {
            ...p,
            items: p.items.map((i) => (i.id === itemId ? { ...i, design: apply(i.design) } : i)),
          },
          name,
        );
        return;
      }
      commit(apply(get().design));
    },
    addLinkedCopy: (id) => {
      const p = get().project;
      const res = p && addLinkedCopy(p, id);
      if (!res) return;
      commitProject(res.project);
      set({ selectedItemId: res.id });
    },
    setLinkAll: (v) => {
      writeLinkAll(v);
      set({ linkAll: v });
    },
    turnModel: (id, dir) => {
      const p = get().project;
      if (!p?.models?.some((m) => m.id === id)) return;
      commitProject({
        ...p,
        models: p.models.map((m) => {
          if (m.id !== id) return m;
          const turned = turnModelItem(m, dir);
          // A model on a piece keeps its new place along it (ADR-208): its offset follows the turn.
          return m.placement?.kind === 'above'
            ? {
                ...turned,
                placement: {
                  ...m.placement,
                  offsetX: m.placement.offsetX + turned.position.x - m.position.x,
                },
              }
            : turned;
        }),
      });
    },
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
        if (all.refused) {
          set({ notice: all.refused });
          return all.refused;
        }
        if (all.project !== p) commitProject(all.project);
        return all.reasons.length
          ? t('Moved without mirroring: {reasons}', { reasons: all.reasons.join('; ') })
          : null;
      }
      const res = mirrorItem(p, id);
      // A refused mirror says why wherever it was asked from (ADR-244).
      if (res.reason) {
        set({ notice: res.reason });
        return res.reason;
      }
      if (res.project !== p) commitProject(res.project);
      return null;
    },
    mirrorRun: (id) => {
      const p = get().project;
      if (!p) return { reasons: [] };
      const res = mirrorRun(p, id);
      if (res.refused) set({ notice: res.refused });
      if (res.project !== p) commitProject(res.project, t('Mirror the run'));
      return { reasons: res.reasons, ...(res.refused ? { refused: res.refused } : {}) };
    },
    selectItem: (id) => {
      const { project, selectedItemId, drillItemId, selectedItemIds } = get();
      if (id && id === selectedItemId && id === drillItemId && selectedItemIds.length === 1) return;
      set({ selectedItemId: id, notice: null });
      const item = id ? project?.items.find((i) => i.id === id) : undefined;
      // A value set's duplicate is edited through its original (ADR-167): nothing inside it is loaded.
      if (item && !item.set && !get().editingItemId) loadDrill(item, null);
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
    // Every piece and placed 3D model (ADR-246); `selectItems` takes both.
    selectAll: () => {
      const p = get().project;
      get().selectItems([...(p?.items ?? []), ...(p?.models ?? [])].map((i) => i.id));
    },
    setMultiSelect: (on) => set({ multiSelect: on }),
    moveSelectionBy: (dx, dz, step, opts) => {
      const p = get().project;
      if (!p) return null;
      const unit = movingSet(p, get().selectedItemIds, !opts?.alone);
      // Pieces against a wall slide along it (ADR-207), unless Alt was held.
      const along = opts?.alone ? { dx, dz } : alongWalls(p, unit, dx, dz);
      const res = moveItems(p, unit, along.dx, along.dz, step);
      if (res.reason) {
        set({ notice: res.reason });
        return res.reason;
      }
      if (res.project !== p) commitProject(settleConnections(res.project, unit, !!opts?.snapped));
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
      const why = removeBlocked(p, ids);
      if (why) return set({ notice: why });
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
      if (carried.reason) {
        set({ notice: carried.reason });
        return carried.reason;
      }
      const moved =
        carried.project !== p && carried.project.items.some((it, i) => it !== p.items[i]);
      if (moved) commitProject(carried.project, t('Align'));
      // Nothing moved and nothing skipped: said, so the tap is not a dead button (ADR-251).
      return skippedText(res) || (moved || ids.length < 2 ? '' : t('Already in line.'));
    },
    distributeSelection: () => {
      const p = get().project;
      if (!p) return '';
      const ids = get().selectedItemIds;
      const res = distributeItems(p, ids);
      const carried = carryGroups(p, res.project, ids);
      if (carried.reason) {
        set({ notice: carried.reason });
        return carried.reason;
      }
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
    ungroup: (groupId) => projectAction((p) => ungroup(p, groupId), t('Ungroup')),
    renameGroup: (groupId, name) =>
      projectAction((p) => renameGroup(p, groupId, name), t('Rename the group')),
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
      const before = projectBeforeEdit;
      projectBeforeEdit = null;
      const edited = raw.items.find((i) => i.id === get().editingItemId);
      const leave: Partial<State> = {
        editingItemId: null,
        drillItemId: null,
        selectedId: undefined,
        highlight: [],
      };
      if (!before || before === raw) return set(leave);
      // Edits made in the piece editor become one project undo step, through the project's own commit (ADR-226):
      // linked copies, size locks, bindings, value sets and run parts follow as for any project edit.
      commitProject(raw, edited ? t('Edit {what}', { what: edited.design.name }) : undefined, {
        base: before,
        also: leave,
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
    ...runActions(h),
    ...roomActions(h),
    setKerf: (kerf) => {
      const d = get().design;
      commit({ ...d, cutting: { ...d.cutting, kerf } });
    },
    setHardwareProduct: (key, hp) => {
      const { project, editingItemId } = get();
      if (project && !editingItemId) commitProject(projectWithHardwareProduct(project, key, hp));
      else commit(withHardwareProduct(get().design, key, hp));
    },
    addSellerItem: (it) => {
      const { project, editingItemId } = get();
      // In the project view the item goes on the project's own list (ADR-210).
      if (project && !editingItemId)
        commitProject(projectWithSellerItem(project, it), t('Add seller product'));
      else commit(withSellerItem(get().design, it));
    },
    setProjectSellerItemQuantity: (seller, id, quantity) =>
      projectAction((p) => projectSellerItemQuantity(p, seller, id, quantity)),
    setRunProduct: (key, hp) => {
      const p = get().project;
      if (!p) return;
      const next = { ...p.runProducts };
      if (hp) next[key] = hp;
      else delete next[key];
      commitProject({ ...p, runProducts: Object.keys(next).length ? next : undefined });
    },
    setSellerItemQuantity: (index, quantity) =>
      commit(withSellerItemQuantity(get().design, index, quantity)),
    rename: (name) => commit({ ...get().design, name }),
    setPartMaterial: (panelId, materialId) => {
      const d = get().design;
      const next = { ...d.partMaterials };
      if (materialId) next[panelId] = materialId;
      else delete next[panelId];
      // Clearing a part also clears its own band (ADR-188).
      const bands = { ...d.partBands };
      if (!materialId) delete bands[panelId];
      commit({
        ...d,
        schemaVersion: SCHEMA_VERSION,
        partMaterials: Object.keys(next).length ? next : undefined,
        partBands: Object.keys(bands).length ? bands : undefined,
      });
    },
    updateParams: (kind, patch) => {
      const d = get().design;
      if (d.product.kind !== kind) return;
      // A corner's mount is a schemaVersion 7 field (ADR-177).
      const mounted = kind === 'corner' && ('mount' in patch || 'mountHeight' in patch);
      commit({
        ...d,
        schemaVersion: mounted ? SCHEMA_VERSION : d.schemaVersion,
        product: { ...d.product, params: { ...d.product.params, ...patch } } as Product,
      });
    },
    updateCabinet: (patch) => get().updateParams('cabinet', patch),
    updateDesk: (patch) => get().updateParams('desk', patch),
    updateCorner: (patch) => get().updateParams('corner', patch),
    updatePanelSet: (patch) => get().updateParams('panels', patch),
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
    updatePanel: (patch) => get().updateParams('panel', patch),
    updateFrame: (patch) => get().updateParams('frame', patch),
    resizePiece: (key, value) => {
      const d = get().design;
      // A bed's size is its mattress (ADR-211); `resizeBed` leaves other pieces alone.
      const product = resizeBed(resizeProduct(d.product, key, value), key, value);
      if (product !== d.product) commit({ ...d, product });
    },
    resizeItem: (id, key, value) => {
      const it = get().project?.items.find((i) => i.id === id);
      if (!it) return;
      const product = resizeBed(resizeProduct(it.design.product, key, value), key, value);
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
    replaceDesign: (d) => {
      const before = get().design;
      commit(d);
      return get().design === before && d !== before ? get().notice : null;
    },
    updateMeta: (patch) => commit({ ...get().design, ...patch }),
    editTemplateVariant: (template, variantId) => {
      const v = template.family.variants.find((x) => x.id === variantId);
      if (!v?.design) return;
      const d = upgradeDesign(structuredClone(v.design));
      const returnTo = get().templateEdit?.returnTo ?? get().design;
      const st = get();
      // The open project comes back, with its undo history, when the template edit ends (ADR-245).
      const returnProject =
        st.templateEdit?.returnProject ??
        (st.project
          ? {
              project: st.project,
              projectModel: st.projectModel,
              projectPast: st.projectPast,
              projectFuture: st.projectFuture,
              projectPastNames: st.projectPastNames,
              projectFutureNames: st.projectFutureNames,
              sessionBase: st.sessionBase,
              editingItemId: st.editingItemId,
            }
          : undefined);
      set({
        templateEdit: {
          template,
          variantId,
          returnTo,
          ...(returnProject ? { returnProject } : {}),
        },
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
        ...te.returnProject,
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
    litPanelIds: null,
    setLit: (ids) => set({ litPanelIds: ids }),
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
