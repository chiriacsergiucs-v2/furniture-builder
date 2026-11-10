/**
 * The assistant's action catalog (ADR-240): every design-changing action of the editor store, described for the
 * model, with its arguments in call order. A plan may only call these; `tests/assistant-catalog.test.ts` fails when a
 * store action is neither here nor in `EXCLUDED`, so a new editor action cannot be forgotten.
 *
 * Descriptions are for the model only (never shown in the app), so they are not translated.
 */
import { templates } from '../core/design';
import { MOVE_TO_ACTIONS } from '../core/moveTo';
import { MATERIAL_ROLES } from '../core/roles';
import type { CountKey } from '../core/counts';
import type { ActionSpec, ArgSpec } from '../core/assistant';
import { sizeFields } from '../core/pieceSize';
import { nameProblem } from '../core/variables';
import type { Space } from '../core/types';
import { useDesign } from './designStore';

/**
 * The same limits the editor's fields apply, for calls from the assistant (ADR-246): a value outside them is refused
 * with the reason instead of being written and left to diagnostics. Thrown, so the plan's preview lists it.
 */
const within = (what: string, v: unknown, min: number, max: number): number => {
  const n = Number(v);
  if (!Number.isInteger(n) || n < min || n > max)
    throw new Error(`${what} must be a whole number from ${min} to ${max}.`);
  return n;
};
const checkName = (
  name: unknown,
  others: readonly { id?: string; name: string; expr: string }[],
  id?: string,
) => {
  const why = nameProblem(
    String(name ?? ''),
    others.filter((v) => v.id !== id) as unknown as Parameters<typeof nameProblem>[1],
  );
  if (why) throw new Error(why);
};

type Store = ReturnType<typeof useDesign.getState>;

interface Entry {
  description: string;
  args: ArgSpec[];
  /** How the call runs; by default the store action of the same name with the arguments in order. */
  run?: (s: Store, args: Record<string, unknown>) => unknown;
}

const int = (name: string, description?: string, optional = false): ArgSpec => ({
  name,
  type: 'integer',
  description,
  optional,
});
const str = (name: string, description?: string, extra: Partial<ArgSpec> = {}): ArgSpec => ({
  name,
  type: 'string',
  description,
  ...extra,
});
const one = (name: string, values: readonly string[], description?: string): ArgSpec => ({
  name,
  type: 'string',
  enum: values,
  description,
});
const bool = (name: string, description?: string, optional = false): ArgSpec => ({
  name,
  type: 'boolean',
  description,
  optional,
});
const obj = (name: string, description?: string, optional = false): ArgSpec => ({
  name,
  type: 'object',
  description,
  optional,
});
const list = (name: string, description?: string): ArgSpec => ({
  name,
  type: 'array',
  description,
});
const id = (what = 'project piece') => str('id', `Id of the ${what}.`);
const dir = one('dir', ['1', '-1'], '1 turns clockwise, -1 anticlockwise.');
const SIZE = ['width', 'height', 'depth'] as const;
const TEMPLATE_IDS = templates.map((t) => t.id);
const CountKeys: CountKey[] = ['vdiv', 'hdiv', 'shelves', 'drawers', 'doors', 'sliding'];
const MoveTos: readonly string[] = MOVE_TO_ACTIONS;
const MaterialRoles: readonly string[] = MATERIAL_ROLES;

/** Every action the assistant may call. Keys are the names the model uses. */
export const CATALOG: Record<string, Entry> = {
  // ---- The open piece (single piece, or the project piece selected with selectItem) -------------------------------
  rename: { description: 'Rename the open piece.', args: [str('name')] },
  setKerf: {
    description: 'Saw cut width in mm for the open piece or project.',
    args: [int('kerf')],
    // In the project view the project's own saw cut is set, as its field does (ADR-246).
    run: (s, a) => {
      const kerf = within('Saw cut', a.kerf, 0, 20);
      if (s.project && !s.editingItemId && !s.drillItemId)
        return s.updateProject((p) => ({ ...p, cutting: { ...p.cutting, kerf } }));
      return s.setKerf(kerf);
    },
  },
  updateParams: {
    description:
      "Change the open piece's product parameters (product.params in the document) when its kind matches; patch holds only the fields to change, values in whole mm.",
    args: [
      str('kind', 'The product kind, e.g. cabinet, desk, corner, panelSet, panel, frame.'),
      obj('patch'),
    ],
  },
  updateCabinet: {
    description: "Change a cabinet's params (patch of product.params).",
    args: [obj('patch')],
  },
  updateDesk: {
    description: "Change a desk's params (patch of product.params).",
    args: [obj('patch')],
  },
  updateCorner: {
    description: "Change a corner unit's params (patch of product.params).",
    args: [obj('patch')],
  },
  updatePanelSet: { description: "Change a panel set's params.", args: [obj('patch')] },
  updatePanel: { description: "Change a loose panel's params.", args: [obj('patch')] },
  updateFrame: { description: "Change a frame's params.", args: [obj('patch')] },
  setLoosePanelBoard: {
    description: 'Board for one loose part of a panel set (board = a material object).',
    args: [str('panelId'), obj('board')],
  },
  setPartMaterial: {
    description:
      "One part's board by material id instead of its group's; null goes back to the group's board.",
    args: [str('panelId'), str('materialId', undefined, { nullable: true })],
  },
  clearPartBoard: {
    description: "Undo a part's own board (id = project piece id, or null for the open piece).",
    args: [str('id', undefined, { nullable: true }), str('panelId')],
  },
  resizePiece: {
    description: 'Width, height or depth of the whole open piece, whole mm.',
    args: [one('key', SIZE), int('value')],
    // A size outside the field's range is written and shown as an error diagnostic in the preview (ADR-240); only a
    // size the piece does not have is refused (ADR-246).
    run: (s, a) => {
      const f = sizeFields(s.design.product).find((x) => x.key === a.key);
      if (!f) throw new Error(`This piece has no ${String(a.key)} to set.`);
      return s.resizePiece(f.key, Number(a.value));
    },
  },
  updateMeta: {
    description: 'Catalog metadata and guidance settings of the open piece.',
    args: [obj('patch')],
  },
  updateSpace: {
    description:
      'Change one space of the open piece (a node of product.root by id): patch replaces the given fields of the space, e.g. its contents, division or doors, using the shapes seen in the document.',
    args: [str('id', 'Space id.'), obj('patch')],
    run: (s, a) =>
      s.updateSpace(a.id as string, (sp: Space) => ({ ...sp, ...(a.patch as object) }) as Space),
  },
  select: {
    description:
      'Select a space of the open piece by id (null = the whole piece) before stepCount; selection is restored after the plan.',
    args: [str('id', undefined, { nullable: true })],
  },
  stepCount: {
    description: 'One step of a quick count on the selected space or piece: +1 or -1.',
    args: [one('key', CountKeys), one('delta', ['1', '-1'])],
    run: (s, a) => s.stepCount(a.key as never, Number(a.delta) as 1 | -1),
  },
  updateMaterial: {
    description: 'Change a board of the open piece or project by id.',
    args: [str('id'), obj('patch')],
  },
  addMaterial: {
    description: 'Add a board (a material object with a new id).',
    args: [obj('board')],
  },
  removeMaterial: { description: 'Remove a board no part uses.', args: [str('id')] },
  setHardwareProduct: {
    description: 'Seller product for a hardware line (hp object), or null to remove it.',
    args: [str('key'), obj('hp', undefined, true)],
    run: (s, a) => s.setHardwareProduct(a.key as string, (a.hp ?? undefined) as never),
  },
  addSellerItem: { description: 'Add a seller item to the shopping list.', args: [obj('item')] },
  setSellerItemQuantity: {
    description: "An added item's quantity by index; 0 removes it.",
    args: [int('index'), int('quantity')],
  },
  setProjectSellerItemQuantity: {
    description: "A project seller item's quantity; 0 removes it.",
    args: [str('seller'), str('itemId'), int('quantity')],
  },
  setRunProduct: {
    description: 'Seller product for a run part by key, or null to remove it.',
    args: [str('key'), obj('hp', undefined, true)],
    run: (s, a) => s.setRunProduct(a.key as string, (a.hp ?? undefined) as never),
  },
  addDesignVariable: {
    description: 'Add a variable to the open piece.',
    args: [str('name'), str('expr')],
    run: (s, a) => {
      checkName(a.name, s.design.variables ?? []);
      return s.addDesignVariable(String(a.name), String(a.expr));
    },
  },
  updateDesignVariable: {
    description: "Change one of the open piece's variables.",
    args: [str('id'), obj('patch')],
    run: (s, a) => {
      const patch = a.patch as { name?: string; expr?: string };
      if (patch.name !== undefined) checkName(patch.name, s.design.variables ?? [], String(a.id));
      return s.updateDesignVariable(String(a.id), patch);
    },
  },
  deleteDesignVariable: {
    description: "Delete one of the open piece's variables.",
    args: [str('id')],
  },
  bindDesignTarget: {
    description: "Bind the open piece's size or division to a formula; null unbinds.",
    args: [str('target'), str('expr', undefined, { nullable: true })],
  },
  setAssembly: {
    description: 'Edit an assembly step (itemId null = the open piece).',
    args: [str('itemId', undefined, { nullable: true }), obj('edit', undefined, true), str('name')],
    run: (s, a) =>
      s.setAssembly(a.itemId as string | null, (a.edit ?? undefined) as never, a.name as string),
  },

  // ---- Project pieces ------------------------------------------------------------------------------------------------
  selectItem: {
    description:
      'Select a project piece (null = none); its design is then the open piece for the piece actions above. Selection is restored after the plan.',
    args: [str('id', undefined, { nullable: true })],
  },
  selectItems: {
    description: 'Select several project pieces; the first is the main one.',
    args: [list('ids')],
  },
  toggleItem: { description: 'Add a piece to the selection or take it out.', args: [id()] },
  selectAll: { description: 'Select every project piece.', args: [] },
  addTemplatePiece: {
    description:
      'Add a new piece made from a built-in template, its left-back corner at x, z mm on the plan (x from the left wall, z from the back wall).',
    args: [one('template', TEMPLATE_IDS), int('x'), int('z')],
    run: (s, a) => {
      const tpl = templates.find((t) => t.id === a.template);
      if (tpl) s.addPieceAt(tpl.create(), a.x as number, a.z as number);
    },
  },
  removeItem: { description: 'Remove a piece from the open project.', args: [id()] },
  duplicateItem: { description: 'Duplicate a piece.', args: [id()] },
  addLinkedCopy: { description: 'Place a linked copy beside the piece.', args: [id()] },
  linkIdentical: { description: 'Link every piece identical to this one.', args: [id()] },
  mergeItems: { description: 'Merge two touching pieces into one.', args: [str('a'), str('b')] },
  updateItem: {
    description: 'Change fields of a project item (position, label…).',
    args: [id(), obj('patch')],
  },
  resizeItem: {
    description: 'Width, height or depth of a project piece, whole mm.',
    args: [id(), one('key', SIZE), int('value')],
  },
  resizeGroup: {
    description:
      'Size of a group of pieces; split shares a width change proportionally or equally.',
    args: [str('groupId'), one('key', SIZE), int('value'), one('split', ['proportional', 'equal'])],
  },
  setItemHeight: {
    description: 'Height above the floor of a piece, mm.',
    args: [id(), int('height')],
  },
  moveItemBy: {
    description: 'Move a piece on the plan by dx, dz mm.',
    args: [id(), int('dx'), int('dz')],
  },
  moveItemTo: { description: 'One-tap move of a piece.', args: [id(), one('action', MoveTos)] },
  setGap: {
    description: 'Gap in mm to the neighbour; moveRight moves this piece to the right.',
    args: [id(), int('gap'), bool('moveRight')],
  },
  turnItem: {
    description: 'Turn a piece 90°.',
    args: [id(), dir],
    run: (s, a) => s.turnItem(a.id as string, Number(a.dir) as 1 | -1),
  },
  turnModel: {
    description: 'Turn a 3D model 90°.',
    args: [id('3D model'), dir],
    run: (s, a) => s.turnModel(a.id as string, Number(a.dir) as 1 | -1),
  },
  setRotation: { description: 'Rotation of a piece in degrees.', args: [id(), int('deg')] },
  mirrorItem: { description: 'Mirror a piece.', args: [id()] },
  mirrorRun: { description: 'Mirror the run a piece is in.', args: [id()] },
  setLocked: { description: "Lock or unlock a piece's placement.", args: [id(), bool('on')] },
  setSizeLocked: { description: "Lock or unlock a piece's size.", args: [id(), bool('on')] },
  setTurnLocked: { description: "Lock or unlock a piece's turn.", args: [id(), bool('on')] },
  setAxisLocked: {
    description: 'Lock or unlock one size axis.',
    args: [id(), one('axis', SIZE), bool('on')],
  },
  setBoardsLocked: { description: "Lock or unlock a piece's boards.", args: [id(), bool('on')] },
  setConstructionLocked: {
    description: "Lock or unlock a piece's construction.",
    args: [id(), bool('on')],
  },
  keepTemplate: {
    description: 'Keep a piece on its template revision.',
    args: [id(), int('revision')],
  },
  setAgainstWall: {
    description: 'Push a piece against the wall or not.',
    args: [id(), bool('on')],
  },
  setLinkAll: { description: 'Edits to a linked piece reach all its copies.', args: [bool('on')] },

  // ---- The selection -------------------------------------------------------------------------------------------------
  moveSelectionBy: {
    description: 'Move the selected pieces by dx, dz mm.',
    args: [int('dx'), int('dz')],
  },
  turnSelectionBy: {
    description: 'Turn the selected pieces 90°.',
    args: [dir],
    run: (s, a) => s.turnSelectionBy(Number(a.dir) as 1 | -1),
  },
  mirrorSelection: { description: 'Mirror the selected pieces.', args: [] },
  deleteSelection: { description: 'Remove the selected pieces.', args: [] },
  duplicateSelection: { description: 'Duplicate the selected pieces.', args: [] },
  alignSelection: {
    description: 'Align the selected pieces.',
    args: [one('how', ['left', 'centre', 'right', 'back', 'front', 'top', 'bottom'])],
  },
  distributeSelection: { description: 'Space the selected pieces evenly.', args: [] },
  groupSelection: { description: 'Group the selected pieces.', args: [] },
  ungroup: { description: 'Ungroup a group.', args: [str('groupId')] },
  renameGroup: { description: 'Rename a group (ADR-252).', args: [str('groupId'), str('name')] },
  setCommon: {
    description: 'Common top or bottom across the selected pieces.',
    args: [one('kind', ['top', 'bottom']), bool('on')],
  },
  setShared: { description: 'Shared sides between the selected pieces.', args: [bool('on')] },
  setConnected: { description: 'Connect the selected pieces.', args: [bool('on')] },

  // ---- Materials and styles ------------------------------------------------------------------------------------------
  applyMaterial: {
    description:
      'Put a board on parts: id = project piece (null = open piece), roles = part kinds, board = a material object, scope = part, item, group or project; panelId for scope part; band = edge band object.',
    args: [
      str('id', undefined, { nullable: true }),
      { name: 'roles', type: 'array', description: `Any of ${MaterialRoles.join(', ')}.` },
      obj('board'),
      one('scope', ['part', 'item', 'group', 'project']),
      str('panelId', undefined, { optional: true }),
      obj('band', undefined, true),
    ],
  },
  applyFinish: {
    description:
      'Put a board on the fronts or the body of a piece, its run, the selection or the project.',
    args: [
      id(),
      one('role', ['front', 'body']),
      obj('board'),
      one('scope', ['piece', 'run', 'selection', 'project']),
    ],
  },
  applyStyle: {
    description:
      'Apply a style (a style object) to a piece, its run, the selection or the project.',
    args: [id(), obj('style'), one('scope', ['piece', 'run', 'selection', 'project'])],
  },

  // ---- Project settings, variables, runs and the room ---------------------------------------------------------------
  setProjectSetting: {
    description: 'A project-wide setting (key of project.settings); value null clears it.',
    args: [str('key'), { name: 'value', type: 'any', optional: true }],
    run: (s, a) => s.setProjectSetting(a.key as never, (a.value ?? undefined) as never),
  },
  followProject: {
    description: 'A piece follows the project setting again.',
    args: [id(), str('key')],
  },
  addVariable: {
    description: 'Add a project variable.',
    args: [str('name'), str('expr')],
    run: (s, a) => {
      checkName(a.name, s.project?.variables ?? []);
      return s.addVariable(String(a.name), String(a.expr));
    },
  },
  updateVariable: {
    description: 'Change a project variable.',
    args: [str('id'), obj('patch')],
    run: (s, a) => {
      const patch = a.patch as { name?: string; expr?: string };
      if (patch.name !== undefined) checkName(patch.name, s.project?.variables ?? [], String(a.id));
      return s.updateVariable(String(a.id), patch);
    },
  },
  deleteVariable: { description: 'Delete a project variable.', args: [str('id')] },
  bindTarget: {
    description: "Bind a piece's size, division or position to a formula; null unbinds.",
    args: [str('itemId'), str('target'), str('expr', undefined, { nullable: true })],
  },
  addVariableSet: { description: 'Add a value set.', args: [] },
  updateVariableSet: { description: 'Change a value set.', args: [str('id'), obj('patch')] },
  removeVariableSet: { description: 'Remove a value set and its pieces.', args: [str('id')] },
  suggestRunParts: {
    description: 'Propose the run parts again (worktop, plinth, fillers).',
    args: [],
  },
  removeRunPart: { description: 'Remove one run part.', args: [str('id')] },
  setRunSettings: { description: 'Run settings (patch).', args: [obj('patch')] },
  setRunRequest: { description: 'Add or change a run request.', args: [obj('request')] },
  removeRunRequest: { description: 'Remove a run request.', args: [str('key')] },
  setRunHandle: { description: 'Add or change a run handle.', args: [obj('handle')] },
  removeRunHandle: { description: 'Remove a run handle.', args: [str('id')] },
  setSink: { description: 'Add or change a sink cut-out.', args: [obj('sink')] },
  removeSink: { description: 'Remove a sink.', args: [str('id')] },
  setHob: { description: 'Add or change a hob cut-out.', args: [obj('hob')] },
  removeHob: { description: 'Remove a hob.', args: [str('id')] },
  setWorktopJoint: { description: 'A worktop corner joint.', args: [obj('joint')] },
  setWorktopEdge: { description: 'A worktop edge.', args: [obj('edge')] },
  bindRequest: {
    description: 'Bind a run request field to a formula; null unbinds.',
    args: [obj('request'), obj('target'), str('expr', undefined, { nullable: true })],
  },
  setRoom: {
    description: 'The room outline and walls (a room object), or null to remove it.',
    args: [obj('room', undefined, true)],
    run: (s, a) => s.setRoom((a.room ?? undefined) as never),
  },
};

/**
 * Store actions the assistant may not call, with why (ADR-240). Open, replace or delete saved data, history, screen
 * and view state, gestures that have a catalog equivalent, and internals.
 */
export const EXCLUDED: Record<string, string> = {
  load: 'opens a saved design',
  openProject: 'opens a saved project',
  replaceDesign: 'replaces the whole document',
  updateProject: 'replaces the whole project (a function argument)',
  restoreProjectTo: 'restores a saved version',
  takeSessionBase: 'internal (versions)',
  transact: 'internal (undo grouping)',
  editTemplateVariant: 'catalog template writes',
  finishTemplateEdit: 'catalog template writes',
  insertTemplate: 'catalog template input',
  replaceItem: 'takes a whole design from the catalog',
  linkTemplate: 'catalog template link',
  addPiece: 'takes a whole design; addTemplatePiece instead',
  addPieceAt: 'takes a whole design; addTemplatePiece instead',
  fillRoom: 'takes a whole project mix',
  undo: 'history',
  redo: 'history',
  undoProject: 'history',
  redoProject: 'history',
  jumpProject: 'history',
  setLit: 'view only',
  setHighlight: 'view only',
  setShowFronts: 'view only',
  setExploded: 'view only',
  setTab: 'view only',
  toggleTab: 'view only',
  setMultiSelect: 'view only',
  editItem: 'changes the screen',
  backToProject: 'changes the screen',
  tapPiece: 'a tap gesture; select instead',
  tapItem: 'a tap gesture; selectItem instead',
  dropItemAt: 'a 3D drag gesture; moveItemBy instead',
  dropModel: 'a 3D drag gesture; moveItemBy instead',
  placeAt: 'a tap gesture; addTemplatePiece instead',
  stopPlacing: 'a gesture state',
  startDrawRoom: 'a drawing gesture; setRoom instead',
  addRoomCorner: 'a drawing gesture; setRoom instead',
  finishDrawRoom: 'a drawing gesture; setRoom instead',
  cancelDrawRoom: 'a drawing gesture',
  startScalePlan: 'a picture gesture',
  addScalePoint: 'a picture gesture',
  cancelScalePlan: 'a picture gesture',
};

/** The catalog as the model sees it. */
export const actionSpecs = (): ActionSpec[] =>
  Object.entries(CATALOG).map(([name, e]) => ({ name, description: e.description, args: e.args }));
