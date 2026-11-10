import type { FloorPoint } from '../core/drag3d';
import type { RunRole, FinishRole, FinishScope, MaterialRole, MaterialScope } from '../core/finish';
import type { ProjectTemplate } from '../core/projectTemplate';
import type { Style } from '../core/styles';
import type { AlignHow } from '../core/align';
import type { ReplaceReport } from '../core/replace';
import type { CatalogFamily } from '../core/catalog/types';
import type { SettingKey } from '../core/projectSettings';
import type { CountKey } from '../core/counts';
import type { Selection } from '../core/selectPath';
import type { SizeField } from '../core/pieceSize';
import type { WidthSplit } from '../core/groupSize';
import type { MoveToAction } from '../core/moveTo';
import type { Pt, Room } from '../core/room';
import type {
  Project,
  ProjectItem,
  ProjectModel,
  ProjectSettings,
  RunHandle,
  RunRequest,
  RunSettings,
  RunSink,
  RunHob,
  WorktopJoint,
  WorktopEdge,
  RequestTarget,
  SizeAxis,
} from '../core/project';
import type {
  CabinetParams,
  CatalogMeta,
  CornerParams,
  AssemblyEdit,
  DeskParams,
  Design,
  FrameParams,
  FurnitureModel,
  HardwareProduct,
  EdgeBand,
  Material,
  Mm,
  PanelParams,
  PanelSetParams,
  Product,
  SellerItem,
  Space,
} from '../core/types';
import type { LocalTemplate } from '../core/catalog/local';
import type { VariableSet } from '../core/sets';

export type Tab = 'parts' | 'sheets' | 'hardware' | 'assembly' | 'shopping' | 'checks';

/** How a move was made (ADR-168): `snapped` = the drop snapped; `alone` = Alt held, so connected pieces stay. */
export interface MoveOpts {
  snapped?: boolean;
  alone?: boolean;
}

export interface State {
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
  /** Panel ids lit in the 3D view by an assembly step (ADR-174); null = every part as usual. Viewer-only. */
  litPanelIds: string[] | null;
  setLit: (ids: string[] | null) => void;
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
  templateEdit: {
    template: LocalTemplate;
    variantId: string;
    returnTo: Design;
    /** The open project and its history, reopened when the edit ends (ADR-245). */
    returnProject?: Partial<State>;
  } | null;

  load: (d: Design, opts?: { fromStorage?: boolean }) => void;
  setKerf: (kerf: number) => void;
  /** ADR-161: a seller product for a hardware line (undefined removes it); in a project view, in every piece. */
  setHardwareProduct: (key: string, hp: HardwareProduct | undefined) => void;
  /** ADR-161: a seller product added to the open piece's shopping list; in a project view, the project's (ADR-210). */
  addSellerItem: (it: SellerItem) => void;
  /** ADR-161: an added item's quantity; 0 removes it. */
  setSellerItemQuantity: (index: number, quantity: number) => void;
  /** ADR-210: a project's own seller item's quantity, by seller and product id; 0 removes it. One undo step. */
  setProjectSellerItemQuantity: (seller: string, id: string, quantity: number) => void;
  /** ADR-206: a seller product for a run part of the open project, by run part key (undefined removes it). */
  setRunProduct: (key: string, hp: HardwareProduct | undefined) => void;
  rename: (name: string) => void;
  /** Change the open piece's parameters when it is a `kind` (ADR-231); any other piece is left as it is. */
  updateParams: <K extends Product['kind']>(
    kind: K,
    patch: Partial<Extract<Product, { kind: K }>['params']>,
  ) => void;
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
  /**
   * Replace the open piece's design as one edit (ADR-203, G-359: Update piece from the wizard on a project piece), so
   * it stays in the project's own copy; size locks and a locked piece on it refuse it (the reason comes back).
   */
  replaceDesign: (d: Design) => string | null;
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
  /** Returns why the change was refused (a lock), or null (ADR-244). */
  updateProject: (fn: (p: Project) => Project) => string | null;
  addPiece: (d: Design, libraryId?: string) => void;
  /**
   * Add a copy of a design with its left-back corner at a plan point (ADR-094: dropped from the piece list), whole
   * mm; one undo step. The point is where `dropNewPiece` puts it (snapped or as a tap places it).
   */
  /** `snapped`: the drop snapped against a neighbour, so a valid touching pair is connected (ADR-168). */
  addPieceAt: (d: Design, x: number, z: number, libraryId?: string, snapped?: boolean) => void;
  updateItem: (id: string, patch: Partial<ProjectItem>) => void;
  /**
   * Move a piece on the plan by a drag or an arrow key (ADR-065): rounded to the step, lifted off a base, one undo
   * step. Nothing happens (no step) when the piece would not move; a locked piece stays and the reason is returned
   * and shown as the plan's notice (ADR-095).
   */
  /**
   * Connected pieces move along (ADR-168) unless `alone` (Alt held); a snapped drop connects valid touching pairs
   * and a drop that parts connected pieces disconnects them.
   */
  moveItemBy: (
    id: string,
    dxMm: number,
    dzMm: number,
    step?: number,
    opts?: MoveOpts,
  ) => string | null;
  /**
   * Drop a piece dragged in the 3D view (ADR-093) from room point `from` to `to` on its floor plane: the same drop
   * as a Plan drag (snapping when `snap`), one undo step. A locked piece stays and the reason is returned (ADR-095).
   */
  dropItemAt: (
    id: string,
    from: FloorPoint,
    to: FloorPoint,
    snap: boolean,
    alone?: boolean,
  ) => string | null;
  /** The gap tool (ADR-022); returns why nothing moved when it would move a locked piece (ADR-095), or null. */
  setGap: (id: string, gap: number, moveRight: boolean) => string | null;
  /**
   * A one-tap Move to action (ADR-147) on one piece, or on several selected pieces moved as one block (ADR-182); one
   * undo step. Returns why nothing moved, or null.
   */
  moveItemTo: (id: string | readonly string[], action: MoveToAction) => string | null;
  /** Lock or unlock a piece's placement (ADR-095); one undo step. */
  setLocked: (id: string, on: boolean) => void;
  /** Lock or unlock a piece's size (ADR-122); one undo step. */
  setSizeLocked: (id: string, on: boolean) => void;
  /** Lock or unlock the piece's turn, or one of its outside sizes (ADR-171). One undo step each. */
  setTurnLocked: (id: string, on: boolean) => void;
  setAxisLocked: (id: string, axis: SizeAxis, on: boolean) => void;
  /** Lock or unlock a piece's boards, or its construction (ADR-211). One undo step each. */
  setBoardsLocked: (id: string, on: boolean) => void;
  setConstructionLocked: (id: string, on: boolean) => void;
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
  /** Link every piece identical to this one (ADR-207, "Link {n} identical pieces"); one undo step. */
  linkIdentical: (id: string) => void;
  /**
   * The user's assembly steps (ADR-207) of a project piece (`itemId`) or the open piece (null): their order and names,
   * or undefined to reset them to the generated steps. One undo step named `name`; linked copies share it (ADR-111).
   */
  setAssembly: (itemId: string | null, edit: AssemblyEdit | undefined, name: string) => void;
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
  /** Project variables (ADR-166); each is one undo step. Deleting unbinds the pieces that used it. */
  addVariable: (name: string, expr: string) => string;
  updateVariable: (id: string, patch: { name?: string; expr?: string }) => void;
  deleteVariable: (id: string) => void;
  /** Bind (or with null unbind) a piece's size, division or position to a variable or formula (ADR-166). */
  bindTarget: (itemId: string, target: string, expr: string | null) => void;
  /** The open piece's own variables (ADR-210); each is one undo step. Deleting unbinds the sizes that used it. */
  addDesignVariable: (name: string, expr: string) => string;
  updateDesignVariable: (id: string, patch: { name?: string; expr?: string }) => void;
  deleteDesignVariable: (id: string) => void;
  /** Bind (or with null unbind) the open piece's size or division to its own variable or formula (ADR-210). */
  bindDesignTarget: (target: string, expr: string | null) => void;
  /** Value sets (ADR-167); each is one undo step. Removing a set removes its pieces. */
  addVariableSet: () => string;
  updateVariableSet: (
    id: string,
    patch: Partial<Pick<VariableSet, 'name' | 'values' | 'origin'>>,
  ) => void;
  removeVariableSet: (id: string) => void;
  /** Returns why it did not turn (a locked piece, ADR-095), or null. */
  turnItem: (id: string, dir: 1 | -1) => string | null;
  /** Turn a display-only 3D model a quarter about its centre (ADR-203, G-105); one undo step. */
  turnModel: (id: string, dir: 1 | -1) => void;
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
  moveSelectionBy: (dx: number, dz: number, step?: number, opts?: MoveOpts) => string | null;
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
  /** A hob over a base unit (ADR-205), like a sink. */
  setHob: (hb: RunHob) => void;
  removeHob: (id: string) => void;
  /** The joint the user chose at a worktop corner (ADR-205); replaces the corner's earlier one. */
  setWorktopJoint: (j: WorktopJoint) => void;
  /** A worktop's front edge (ADR-209): square, rounded or bevelled and its size; replaces the worktop's earlier one. */
  setWorktopEdge: (e: WorktopEdge) => void;
  /** Bind (or with null unbind) a run request's overhang or height to a variable or formula (ADR-209). */
  bindRequest: (r: RunRequest, target: RequestTarget, expr: string | null) => void;
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
    roles: readonly (MaterialRole | RunRole)[],
    board: Material,
    scope: MaterialScope,
    panelId?: string,
    /** An edge band for those parts (ADR-188); undefined keeps the board's band. */
    band?: EdgeBand,
  ) => { applied: string[]; skipped: string[] };
  /**
   * A common top or bottom (ADR-165) over the selected items: on links them (replacing a common panel of the same
   * kind any of them is in), off removes the one they are in. Returns why it was refused, or ''. One undo step.
   */
  setCommon: (kind: 'top' | 'bottom', on: boolean) => string;
  /** Shared sides (ADR-190) for the selected cabinets: on links them, off removes the link they are in. Returns why it was refused, or ''. */
  setShared: (on: boolean) => string;
  /** Add a room mix's pieces to the open project (ADR-173): one undo step, the pieces selected. Their ids. */
  fillRoom: (mix: Project) => string[];
  /**
   * Connect or disconnect the two selected pieces (ADR-168) with the kind the check finds (side, corner, stacked,
   * ADR-207); the reason when it cannot be done, else ''.
   */
  setConnected: (on: boolean) => string;
  /**
   * Against the wall (ADR-207): connect the piece against the wall its back lies on, or remove its wall connections.
   * The reason when it cannot be done, else ''. One undo step.
   */
  setAgainstWall: (id: string, on: boolean) => string;
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
  /**
   * Move a 3D model dragged on the plan (`dx`, `dz` plan mm) or in Move mode (ADR-208): the same drop either way,
   * snapping with `snap`, lifted off a piece; one undo step. Nothing happens when it would not move.
   */
  dropModel: (id: string, dx: number, dz: number, snap: boolean) => void;
  /** Setting a plan picture's scale (ADR-208): the picture points tapped so far, or null when not setting it. */
  scalingPlan: Pt[] | null;
  startScalePlan: () => void;
  /** A tap on the plan while setting the scale, as a picture pixel; the second tap sets the picture's two points. */
  addScalePoint: (p: Pt) => void;
  cancelScalePlan: () => void;
}
