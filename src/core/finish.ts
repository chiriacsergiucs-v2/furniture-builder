/**
 * Finish scope (ADR-055): put one board on the fronts or the carcass of this piece, this run or the whole project.
 * A one-time change: every piece stays its own copy (ADR-022) and can be changed again on its own.
 */
import { t } from './i18n';
import { buildModel } from './build';
import { newId, SCHEMA_VERSION } from './design';
import {
  materialKey,
  requestKey,
  runOf,
  type Project,
  type ProjectItem,
  type RunPart,
} from './project';
import { ROLE_PANELS, MATERIAL_ROLES, type MaterialRole, type MaterialScope } from './roles';
import type { Design, EdgeBand, Material, RoleBoardRole } from './types';

export type FinishRole = 'front' | 'body';
/** `selection`: the pieces selected together (ADR-097). */
export type FinishScope = 'piece' | 'run' | 'selection' | 'project';

/** Every board used by a piece in the project, one per board (name + thickness + grain + picture). */
export function projectBoards(project: Project): Material[] {
  const out = new Map<string, Material>();
  for (const it of project.items)
    for (const m of it.design.materials) if (!out.has(materialKey(m))) out.set(materialKey(m), m);
  return [...out.values()].sort(
    (a, b) => a.name.localeCompare(b.name) || a.thickness - b.thickness,
  );
}

/** The board id this role uses on a piece, or null when the piece has no such part (a bed has no fronts). */
export function roleBoard(d: Design, role: FinishRole): string | null {
  const p = d.product;
  if (p.kind === 'cabinet' || p.kind === 'corner' || p.kind === 'desk')
    return role === 'front' ? p.params.frontMaterialId : p.params.bodyMaterialId;
  if (p.kind === 'panel') return role === 'front' ? p.params.materialId : null;
  return null;
}

function withRoleBoard(d: Design, role: FinishRole, id: string): Design {
  const p = d.product;
  if (p.kind === 'cabinet')
    return {
      ...d,
      product: {
        ...p,
        params: { ...p.params, [role === 'front' ? 'frontMaterialId' : 'bodyMaterialId']: id },
      },
    };
  if (p.kind === 'corner')
    return {
      ...d,
      product: {
        ...p,
        params: { ...p.params, [role === 'front' ? 'frontMaterialId' : 'bodyMaterialId']: id },
      },
    };
  if (p.kind === 'desk')
    return {
      ...d,
      product: {
        ...p,
        params: { ...p.params, [role === 'front' ? 'frontMaterialId' : 'bodyMaterialId']: id },
      },
    };
  if (p.kind === 'panel' && role === 'front')
    return { ...d, product: { ...p, params: { ...p.params, materialId: id } } };
  return d;
}

/**
 * The design with `board` on the parts of this role: the design's own board when it already has the same one (name,
 * thickness, grain, picture), else a copy with a new id. Unchanged when the design has no such part.
 */
export function putRoleBoard(d: Design, role: FinishRole, board: Material): Design {
  if (roleBoard(d, role) === null) return d;
  const key = materialKey(board);
  const have = d.materials.find((m) => materialKey(m) === key);
  const mat = have ?? { ...board, id: newId() };
  return withRoleBoard(have ? d : { ...d, materials: [...d.materials, mat] }, role, mat.id);
}

/** The pieces a scope reaches from the selected piece; "run" falls back to the piece when it is not in a run. */
export function finishTargets(
  project: Project,
  id: string,
  scope: FinishScope,
  selection: readonly string[] = [id],
): ProjectItem[] {
  if (scope === 'project') return project.items;
  const ids =
    scope === 'run' ? (runOf(project, id) ?? [id]) : scope === 'selection' ? selection : [id];
  return project.items.filter((i) => ids.includes(i.id));
}

export interface FinishResult {
  project: Project;
  applied: string[];
  skipped: string[];
}

export function applyFinish(
  project: Project,
  id: string,
  role: FinishRole,
  board: Material,
  scope: FinishScope,
  selection?: readonly string[],
): FinishResult {
  const targets = new Set(finishTargets(project, id, scope, selection).map((i) => i.id));
  const applied: string[] = [],
    skipped: string[] = [];
  const items = project.items.map((it) => {
    if (!targets.has(it.id)) return it;
    if (roleBoard(it.design, role) === null) {
      skipped.push(
        role === 'front'
          ? t('{name} has no fronts', { name: it.design.name })
          : t('{name} has no carcass', { name: it.design.name }),
      );
      return it;
    }
    applied.push(it.design.name);
    return { ...it, design: putRoleBoard(it.design, role, board) };
  });
  // Fillers and covers next to changed fronts take the new board; the worktop keeps its own.
  const runParts =
    role === 'front' && project.runParts
      ? project.runParts.map((rp) =>
          (rp.kind === 'filler' || rp.kind === 'cover') && rp.from?.some((x) => targets.has(x))
            ? { ...rp, material: { ...board, id: rp.material.id } }
            : rp,
        )
      : project.runParts;
  return { project: { ...project, items, ...(runParts ? { runParts } : {}) }, applied, skipped };
}

// ---------------------------------------------------------------------------
// One Material control (ADR-163): any combination of part roles, or one part, on a part, item, group or project.
// ---------------------------------------------------------------------------

export { MATERIAL_ROLES, ROLE_PANELS, type MaterialRole, type MaterialScope } from './roles';

/** The material roles an item has parts for, from its built model. */
export function itemRoles(d: Design): MaterialRole[] {
  const roles = new Set(buildModel(d).panels.map((p) => p.role));
  return MATERIAL_ROLES.filter((r) => ROLE_PANELS[r].some((x) => roles.has(x)));
}

/** The role in a sentence ("{name} has no fronts"). */
export function roleName(r: MaterialRole): string {
  switch (r) {
    case 'front':
      return t('fronts');
    case 'body':
      return t('carcass');
    case 'top':
      return t('top@@role');
    case 'bottom':
      return t('bottom@@role');
    case 'side':
      return t('sides');
    case 'shelf':
      return t('shelves@@role');
    case 'divider':
      return t('dividers');
    case 'back':
      return t('back@@role');
    case 'drawer-box':
      return t('drawer boxes');
    case 'drawer-bottom':
      return t('drawer bottoms');
    case 'worktop':
      return t('worktop');
  }
}

/** The design with `board` among its materials (reused by `materialKey`, else copied with a new id), and its id. */
export function withBoard(d: Design, board: Material): { design: Design; id: string } {
  const key = materialKey(board);
  const have = d.materials.find((m) => materialKey(m) === key);
  if (have) return { design: d, id: have.id };
  const mat = { ...board, id: newId() };
  return { design: { ...d, materials: [...d.materials, mat] }, id: mat.id };
}

const withParams = (d: Design, patch: Record<string, unknown>): Design =>
  ({ ...d, product: { ...d.product, params: { ...d.product.params, ...patch } } }) as Design;

/** The design with the board `id` on one role, or null when the item has no such part. */
function writeRole(
  d: Design,
  role: MaterialRole,
  id: string,
  has: Set<MaterialRole>,
): Design | null {
  const p = d.product;
  if (!has.has(role)) return null;
  const rm = { ...d.roleMaterials };
  const setRole = (r: RoleBoardRole) => {
    rm[r] = id;
    return { ...d, roleMaterials: rm };
  };
  switch (role) {
    case 'front':
      if (p.kind === 'panel') return withParams(d, { materialId: id });
      if (p.kind === 'cabinet' || p.kind === 'corner' || p.kind === 'desk')
        return withParams(d, { frontMaterialId: id });
      return null;
    case 'body':
      if (p.kind === 'frame') return withParams(d, { solidMaterialId: id });
      if (p.kind === 'panels')
        return withParams(d, { panels: p.params.panels.map((lp) => ({ ...lp, materialId: id })) });
      if (p.kind === 'cabinet' || p.kind === 'corner' || p.kind === 'desk') {
        delete rm.side;
        delete rm.top;
        delete rm.bottom;
        return {
          ...withParams(d, { bodyMaterialId: id }),
          roleMaterials: Object.keys(rm).length ? rm : undefined,
        };
      }
      return null;
    case 'top':
      if (p.kind === 'frame') return withParams(d, { panelMaterialId: id });
      return setRole('top');
    case 'bottom':
    case 'side':
    case 'shelf':
    case 'divider':
      return setRole(role);
    case 'back':
      return p.kind === 'cabinet' || p.kind === 'corner'
        ? withParams(d, { backMaterialId: id })
        : null;
    case 'drawer-box':
    case 'drawer-bottom':
      if (p.kind === 'cabinet' || p.kind === 'corner' || p.kind === 'desk')
        return withParams(d, {
          drawers: {
            ...p.params.drawers,
            [role === 'drawer-box' ? 'boxMaterialId' : 'bottomMaterialId']: id,
          },
        });
      return null;
    case 'worktop':
      return p.kind === 'desk' ? withParams(d, { topMaterialId: id }) : null;
  }
}

/** The design with `band` on these roles (ADR-168); Carcass clears the side, top and bottom entries it covers. */
function writeBands(d: Design, roles: readonly MaterialRole[], band: EdgeBand): Design {
  const rb = { ...d.roleBands };
  for (const r of roles) {
    if (r === 'body') for (const x of ['side', 'top', 'bottom']) delete rb[x];
    rb[r] = band;
  }
  return { ...d, roleBands: rb };
}

/**
 * `board` (and `band`, when one is chosen, ADR-168) on every role of `roles` the design has parts for; the roles it
 * has none for are returned as skipped.
 */
export function putRoleBoards(
  d: Design,
  roles: readonly MaterialRole[],
  board: Material,
  band?: EdgeBand,
): { design: Design; applied: MaterialRole[]; skipped: MaterialRole[] } {
  const has = new Set(itemRoles(d));
  const applied: MaterialRole[] = [],
    skipped: MaterialRole[] = [];
  let design = d;
  let id: string | null = null;
  for (const role of roles) {
    if (!has.has(role)) {
      skipped.push(role);
      continue;
    }
    if (id === null) ({ design, id } = withBoard(design, board));
    const next = writeRole(design, role, id, has);
    if (next) {
      design = next;
      applied.push(role);
    } else skipped.push(role);
  }
  if (applied.length && band) design = writeBands(design, applied, band);
  return {
    design: applied.length ? { ...design, schemaVersion: SCHEMA_VERSION } : d,
    applied,
    skipped,
  };
}

/** `board` (and `band`, when one is chosen) on one generated part (ADR-151, ADR-168). */
export function putPartBoard(d: Design, panelId: string, board: Material, band?: EdgeBand): Design {
  const { design, id } = withBoard(d, board);
  return {
    ...design,
    schemaVersion: SCHEMA_VERSION,
    partMaterials: { ...design.partMaterials, [panelId]: id },
    ...(band ? { partBands: { ...design.partBands, [panelId]: band } } : {}),
  };
}

/** Run parts the Material dialog reaches (ADR-168): the worktop, fillers and covers, the run plinth, trims. */
export type RunRole = 'run-worktop' | 'run-filler' | 'run-plinth' | 'run-trim';
export const RUN_ROLES: RunRole[] = ['run-worktop', 'run-filler', 'run-plinth', 'run-trim'];
export const runRoleOf = (rp: RunPart): RunRole =>
  rp.kind === 'worktop'
    ? 'run-worktop'
    : rp.kind === 'filler' || rp.kind === 'cover'
      ? 'run-filler'
      : rp.kind === 'plinth'
        ? 'run-plinth'
        : 'run-trim';
const isRunRole = (r: string): r is RunRole => (RUN_ROLES as string[]).includes(r);

/** The run parts made from any of these items (a run part reached by one of its items, ADR-168). */
export const runPartsOf = (project: Project, ids: ReadonlySet<string>): RunPart[] =>
  (project.runParts ?? []).filter((rp) => rp.from?.some((x) => ids.has(x)));

/**
 * The project with `board` (and `band`) on these run parts: a copy keeping each part's id; a trim's request board too,
 * so a refresh keeps it (ADR-075, ADR-061).
 */
export function putRunBoard(
  project: Project,
  parts: readonly RunPart[],
  board: Material,
  band?: EdgeBand,
): Project {
  if (!parts.length) return project;
  const ids = new Set(parts.map((p) => p.id));
  const copy = (id: string): Material => ({ ...board, id, ...(band ? { band } : {}) });
  const keys = new Set(parts.filter((p) => runRoleOf(p) === 'run-trim').map((p) => p.key));
  return {
    ...project,
    runParts: (project.runParts ?? []).map((rp) =>
      ids.has(rp.id) ? { ...rp, material: copy(rp.material.id) } : rp,
    ),
    ...(project.runRequests && keys.size
      ? {
          runRequests: project.runRequests.map((r) =>
            keys.has(requestKey(r)) ? { ...r, material: copy(r.material?.id ?? 'trim') } : r,
          ),
        }
      : {}),
  };
}

/** The items a scope reaches: Group = the selection when 2+ are selected, else the run (`null` when not in one). */
export function materialTargets(
  project: Project,
  id: string,
  scope: MaterialScope,
  selection: readonly string[] = [id],
): ProjectItem[] | null {
  if (scope === 'project') return project.items;
  if (scope === 'group') {
    const ids = selection.length > 1 ? selection : runOf(project, id);
    if (!ids || ids.length < 2) return null;
    return project.items.filter((i) => ids.includes(i.id));
  }
  return project.items.filter((i) => i.id === id);
}

export interface MaterialResult {
  project: Project;
  applied: string[];
  skipped: string[];
}

/**
 * `board` on `roles` of every item the scope reaches. Fillers and covers next to changed fronts follow (ADR-055);
 * scope Project also records carcass, front and back boards as project settings (ADR-124) for pieces added later.
 */
export function applyMaterial(
  project: Project,
  id: string,
  allRoles: readonly (MaterialRole | RunRole)[],
  board: Material,
  scope: Exclude<MaterialScope, 'part'>,
  selection?: readonly string[],
  band?: EdgeBand,
): MaterialResult {
  const targetItems = materialTargets(project, id, scope, selection);
  if (!targetItems) return { project, applied: [], skipped: [t('not in a run')] };
  const targets = new Set(targetItems.map((i) => i.id));
  const roles = allRoles.filter((r): r is MaterialRole => !isRunRole(r));
  const runRoles = allRoles.filter(isRunRole);
  const applied: string[] = [],
    skipped: string[] = [];
  // Run parts made from a reached item (ADR-168).
  const runs = runPartsOf(project, targets).filter((rp) => runRoles.includes(runRoleOf(rp)));
  for (const rp of runs) applied.push(rp.label);
  for (const r of runRoles)
    if (!runs.some((rp) => runRoleOf(rp) === r))
      skipped.push(t('no {parts}', { parts: runRoleName(r) }));
  const items = project.items.map((it) => {
    if (!targets.has(it.id) || !roles.length) return it;
    const r = putRoleBoards(it.design, roles, board, band);
    if (!r.applied.length) {
      skipped.push(
        t('{name} has no {parts}', {
          name: it.design.name,
          parts: r.skipped.map(roleName).join(', '),
        }),
      );
      return it;
    }
    applied.push(it.design.name);
    return { ...it, design: r.design };
  });
  const runParts =
    roles.includes('front') && project.runParts
      ? project.runParts.map((rp) =>
          (rp.kind === 'filler' || rp.kind === 'cover') && rp.from?.some((x) => targets.has(x))
            ? { ...rp, material: { ...board, id: rp.material.id } }
            : rp,
        )
      : project.runParts;
  const settings =
    scope === 'project'
      ? {
          ...project.settings,
          ...(roles.includes('body') ? { body: board } : {}),
          ...(roles.includes('front') ? { front: board } : {}),
          ...(roles.includes('back') ? { back: board } : {}),
        }
      : project.settings;
  return {
    project: putRunBoard(
      {
        ...project,
        items,
        ...(runParts ? { runParts } : {}),
        ...(settings && Object.keys(settings).length ? { settings } : {}),
      },
      runs,
      board,
      band,
    ),
    applied,
    skipped,
  };
}

/** A run role in a sentence ("no run worktop"). */
export function runRoleName(r: RunRole): string {
  switch (r) {
    case 'run-worktop':
      return t('run worktop');
    case 'run-filler':
      return t('fillers and covers');
    case 'run-plinth':
      return t('run plinth');
    case 'run-trim':
      return t('trims');
  }
}
