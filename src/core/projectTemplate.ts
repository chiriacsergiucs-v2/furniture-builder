/**
 * Project templates (ADR-060): a project saved for reuse. Pieces are kept as copies (ADR-032) with positions
 * relative to the leftmost-back piece (or to the room when the room is included); run parts are kept as a recipe
 * and suggested again when the template is used, so they always fit the pieces. Since schemaVersion 2 (ADR-170) a
 * template also keeps the project's variables, each piece's bindings and the connections between pieces (ADR-166,
 * ADR-168); a template with none of them stays version 1.
 */
import { newId, validateDesign } from './design';
import { applyBindings, type Binding, type ProjectVariable } from './variables';
import {
  planRuns,
  PROJECT_SCHEMA,
  validateProject,
  type Placement,
  type Project,
  type QuarterTurn,
  type RunSettings,
} from './project';
import { validateRoom, type Room } from './room';
import type { Design, Mm } from './types';

export interface TemplateItem {
  /** Id inside the template, so placements can point at their base. */
  ref: string;
  design: Design;
  quantity: number;
  rotationY: QuarterTurn;
  offset: { x: Mm; y: Mm; z: Mm };
  placement?: Placement;
  /** Linked copies (ADR-111): template items with the same `linkId` stay linked in projects made from it. */
  linkId?: string;
  /** Extra whole degrees on top of the quarter turn (ADR-121), 1–89; absent = 0. */
  angle?: number;
  /** The piece's bindings to the template's variables, by name (ADR-166, ADR-170; schemaVersion 2). */
  bindings?: Binding[];
}

/** 1 = ADR-060; 2 = variables, bindings and connections (ADR-170). An older app refuses a version it does not know. */
export const TEMPLATE_SCHEMA = 2 as const;
export type TemplateSchemaVersion = 1 | typeof TEMPLATE_SCHEMA;

export interface ProjectTemplate {
  kind: 'project-template';
  schemaVersion: TemplateSchemaVersion;
  id: string;
  name: string;
  description: string;
  createdAt: string;
  updatedAt: string;
  items: TemplateItem[];
  /**
   * Suggest run parts again with these settings when used (absent = the project had none). `removed` keeps the run
   * parts the user removed, as keys over template refs, so they stay removed in projects made from it.
   */
  runRecipe?: { settings: RunSettings; removed?: string[] };
  room?: Room;
  /** The project's variables (ADR-166), every one (schemaVersion 2). */
  variables?: ProjectVariable[];
  /** Connections between pieces (ADR-168), over template refs (schemaVersion 2). */
  connections?: { itemIds: [string, string] }[];
}

/**
 * A run-part key (`kind|idA,idB`) with its piece ids mapped through `ids`; null when one of them is not mapped (the
 * piece is not there any more).
 */
export function remapRunKey(key: string, ids: ReadonlyMap<string, string>): string | null {
  const bar = key.indexOf('|');
  if (bar < 0) return null;
  const from = key.slice(bar + 1).split(',');
  const mapped = from.map((id) => ids.get(id));
  if (!from.length || mapped.some((id) => id === undefined)) return null;
  return `${key.slice(0, bar)}|${mapped.join(',')}`;
}

const remapKeys = (keys: readonly string[], ids: ReadonlyMap<string, string>) =>
  keys.map((k) => remapRunKey(k, ids)).filter((k): k is string => k !== null);

export function templateFromProject(
  p: Project,
  name: string,
  opts: { description?: string; includeRoom?: boolean } = {},
): ProjectTemplate {
  const withRoom = !!opts.includeRoom && !!p.room;
  const ox = withRoom || !p.items.length ? 0 : Math.min(...p.items.map((i) => i.position.x));
  const oz = withRoom || !p.items.length ? 0 : Math.min(...p.items.map((i) => i.position.z));
  const now = new Date().toISOString();
  // Template refs are the project's item ids; removed keys of pieces no longer there are dropped.
  const refs = new Map(p.items.map((i) => [i.id, i.id]));
  const removed = remapKeys(p.runPartsRemoved ?? [], refs);
  const variables = p.variables?.length ? structuredClone(p.variables) : undefined;
  const connections = p.connections
    ?.filter((c) => refs.has(c.itemIds[0]) && refs.has(c.itemIds[1]))
    .map((c) => ({ itemIds: [c.itemIds[0], c.itemIds[1]] as [string, string] }));
  const bound = p.items.some((i) => i.bindings?.length);
  return {
    kind: 'project-template',
    // Variables, bindings or connections need version 2 (ADR-170); without them an older app can still read it.
    schemaVersion: variables || connections?.length || bound ? TEMPLATE_SCHEMA : 1,
    id: newId(),
    name,
    description: opts.description ?? '',
    createdAt: now,
    updatedAt: now,
    items: p.items.map((i) => ({
      ref: i.id,
      design: structuredClone(i.design),
      quantity: i.quantity,
      rotationY: i.rotationY,
      offset: { x: i.position.x - ox, y: i.position.y, z: i.position.z - oz },
      ...(i.placement ? { placement: structuredClone(i.placement) } : {}),
      ...(i.linkId ? { linkId: i.linkId } : {}),
      ...(i.angle ? { angle: i.angle } : {}),
      ...(i.bindings?.length ? { bindings: structuredClone(i.bindings) } : {}),
    })),
    ...(variables ? { variables } : {}),
    ...(connections?.length ? { connections } : {}),
    ...(p.runParts?.length || p.runSettings
      ? {
          runRecipe: {
            settings: { scribe: p.runSettings?.scribe ?? 0, auto: p.runSettings?.auto ?? true },
            ...(removed.length ? { removed } : {}),
          },
        }
      : {}),
    ...(withRoom ? { room: structuredClone(p.room!) } : {}),
  };
}

/** A new project from a template: fresh ids (placements follow), run parts suggested from the recipe. */
export function projectFromTemplate(t: ProjectTemplate, name = t.name): Project {
  const now = new Date().toISOString();
  const ids = new Map(t.items.map((i) => [i.ref, newId()]));
  const items = t.items.map((i) => {
    const pl =
      i.placement?.kind === 'above'
        ? { ...i.placement, baseId: ids.get(i.placement.baseId) ?? i.placement.baseId }
        : i.placement;
    return {
      id: ids.get(i.ref)!,
      design: { ...structuredClone(i.design), id: newId() },
      quantity: i.quantity,
      position: { ...i.offset },
      rotationY: i.rotationY,
      ...(pl ? { placement: pl } : {}),
      ...(i.linkId ? { linkId: i.linkId } : {}),
      ...(i.angle ? { angle: i.angle } : {}),
      ...(i.bindings?.length ? { bindings: structuredClone(i.bindings) } : {}),
    };
  });
  const connections = (t.connections ?? [])
    .filter((c) => ids.has(c.itemIds[0]) && ids.has(c.itemIds[1]))
    .map((c) => ({
      id: newId(),
      itemIds: [ids.get(c.itemIds[0])!, ids.get(c.itemIds[1])!] as [string, string],
    }));
  const extended =
    items.some((i) => i.linkId || i.angle || i.bindings) ||
    t.variables?.length ||
    connections.length;
  const base: Project = {
    // Linked copies, angled pieces, bindings and connections need the project version that stores them (ADR-111,
    // ADR-121, ADR-166, ADR-168).
    schemaVersion: extended ? PROJECT_SCHEMA : 1,
    id: newId(),
    name,
    createdAt: now,
    updatedAt: now,
    items,
    cutting: { kerf: 4 },
    ...(t.room ? { room: structuredClone(t.room) } : {}),
    ...(t.variables?.length ? { variables: structuredClone(t.variables) } : {}),
    ...(connections.length ? { connections } : {}),
  };
  if (!t.runRecipe) return t.variables?.length ? applyBindings(base) : base;
  const removed = remapKeys(t.runRecipe.removed ?? [], ids);
  const withSettings: Project = {
    ...base,
    runSettings: { ...t.runRecipe.settings },
    ...(removed.length ? { runPartsRemoved: removed } : {}),
  };
  const planned = { ...withSettings, runParts: planRuns(withSettings).parts };
  // Bound sizes take their variables' values at once (ADR-166).
  return t.variables?.length ? applyBindings(planned) : planned;
}

const isObj = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === 'object' && !Array.isArray(v);
const isInt = (v: unknown, min = -1e7, max = 1e7) =>
  typeof v === 'number' && Number.isSafeInteger(v) && v >= min && v <= max;

/** Problems of a template read from storage or a file; never throws (ADR-008). Empty = usable. */
export function validateProjectTemplate(t: unknown): string[] {
  if (!isObj(t)) return ['Template must be an object'];
  const errs: string[] = [];
  if (
    t.kind !== 'project-template' ||
    (t.schemaVersion !== 1 && t.schemaVersion !== TEMPLATE_SCHEMA)
  )
    errs.push('Not a project template');
  const v2 = t.schemaVersion === TEMPLATE_SCHEMA;
  if (typeof t.id !== 'string' || !t.id || typeof t.name !== 'string' || !t.name)
    errs.push('Missing template id or name');
  if (typeof t.description !== 'string') errs.push('Missing description');
  if (!Array.isArray(t.items)) return [...errs, 'Items missing'];
  const refs = new Set(
    t.items.flatMap((it) => (isObj(it) && typeof it.ref === 'string' ? [it.ref] : [])),
  );
  const seen = new Set<string>();
  for (const it of t.items) {
    if (!isObj(it) || typeof it.ref !== 'string' || !it.ref) {
      errs.push('Invalid template item');
      continue;
    }
    const name = `Item ${it.ref}`;
    if (seen.has(it.ref)) errs.push(`${name}: duplicate ref`);
    seen.add(it.ref);
    const de = validateDesign(it.design);
    if (de.length) errs.push(`${name}: ${de[0]}`);
    if (!isInt(it.quantity, 1, 99)) errs.push(`${name}: quantity must be 1 to 99`);
    if (![0, 90, 180, 270].includes(it.rotationY as number))
      errs.push(`${name}: rotation must be a quarter turn`);
    if (
      it.angle !== undefined &&
      !(Number.isInteger(it.angle) && (it.angle as number) >= 1 && (it.angle as number) <= 89)
    )
      errs.push(`${name}: angle must be whole degrees from 1 to 89`);
    const o = it.offset;
    if (!isObj(o) || !isInt(o.x) || !isInt(o.y, 0) || !isInt(o.z))
      errs.push(`${name}: offset must be whole mm (height ≥ 0)`);
    const pl = it.placement;
    if (
      pl !== undefined &&
      !(
        isObj(pl) &&
        (pl.kind === 'floor' ||
          (pl.kind === 'wall' && isInt(pl.height, 0)) ||
          (pl.kind === 'above' &&
            typeof pl.baseId === 'string' &&
            refs.has(pl.baseId) &&
            pl.baseId !== it.ref &&
            isInt(pl.gap, 0) &&
            isInt(pl.offsetX)))
      )
    )
      errs.push(`${name}: invalid placement`);
    if (
      it.linkId !== undefined &&
      (typeof it.linkId !== 'string' || !it.linkId || it.linkId.length > 100)
    )
      errs.push(`${name}: invalid link`);
    // Bindings need version 2; their shape and targets are checked on the project the template makes.
    if (it.bindings !== undefined && (!v2 || !Array.isArray(it.bindings)))
      errs.push(`${name}: bindings need template schemaVersion ${TEMPLATE_SCHEMA}`);
  }
  if (t.variables !== undefined && (!v2 || !Array.isArray(t.variables)))
    errs.push(`Variables need template schemaVersion ${TEMPLATE_SCHEMA}`);
  if (t.connections !== undefined) {
    const pairs = new Set<string>();
    if (!v2 || !Array.isArray(t.connections))
      errs.push(`Connections need template schemaVersion ${TEMPLATE_SCHEMA}`);
    else
      for (const c of t.connections) {
        const ids = isObj(c) && Array.isArray(c.itemIds) ? (c.itemIds as unknown[]) : null;
        const key =
          ids && ids.length === 2 && ids.every((x) => typeof x === 'string' && refs.has(x))
            ? [...(ids as string[])].sort().join('|')
            : '';
        if (!key || ids![0] === ids![1] || pairs.has(key)) {
          errs.push('Invalid template connection');
          continue;
        }
        pairs.add(key);
      }
  }
  const rr = t.runRecipe;
  if (rr !== undefined) {
    const s = isObj(rr) ? rr.settings : null;
    if (
      !isObj(rr) ||
      !isObj(s) ||
      !isInt(s.scribe, 0, 200) ||
      typeof s.auto !== 'boolean' ||
      (rr.removed !== undefined &&
        !(Array.isArray(rr.removed) && rr.removed.every((k) => typeof k === 'string')))
    )
      errs.push('Invalid run-part recipe');
  }
  if (t.room !== undefined) errs.push(...validateRoom(t.room));
  if (!errs.length) {
    // The project it makes must be valid too; a failure there is a problem, never a crash.
    try {
      errs.push(...validateProject(projectFromTemplate(t as unknown as ProjectTemplate)));
    } catch (e) {
      errs.push(`The template cannot be used: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
  return errs;
}
