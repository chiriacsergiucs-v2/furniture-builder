/**
 * Project templates (ADR-060): a project saved for reuse. Pieces are kept as copies (ADR-032) with positions
 * relative to the leftmost-back piece (or to the room when the room is included); run parts are kept as a recipe
 * and suggested again when the template is used, so they always fit the pieces. Since schemaVersion 2 (ADR-170) a
 * template also keeps the project's variables, each piece's bindings and the connections between pieces (ADR-166,
 * ADR-168); a template with none of them stays version 1. Since schemaVersion 3 (ADR-204) it keeps the run handles
 * and sinks (ADR-125) over template refs, the project's display-only 3D models (ADR-208: offset and placement over
 * refs) and (ADR-205) each piece's clearance zones (ADR-073); a template without them stays version 1 or 2.
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
  type RunHandle,
  type RunSettings,
  type RunSink,
} from './project';
import { validateRoom, type Room } from './room';
import type { Connection, ConnectionKind } from './connections';
import {
  FRONT_TURN,
  validModelPlacement,
  type ModelFront,
  type ModelPlacement,
  type ModelSize,
  type ModelItem,
  type ModelTurn,
} from './model3d';
import type { ItemZones } from './envelopes';
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
  /** Its chair, service and installation settings (ADR-073, ADR-205; schemaVersion 3). */
  zones?: ItemZones;
}

/**
 * 1 = ADR-060; 2 = variables, bindings and connections (ADR-170); 3 = run handles and sinks (ADR-204), connection
 * kinds and wall connections (ADR-207), 3D models (ADR-208) and item clearance zones (ADR-205). An older app refuses
 * a version it does not know.
 */
export const TEMPLATE_SCHEMA = 3 as const;
export type TemplateSchemaVersion = 1 | 2 | typeof TEMPLATE_SCHEMA;
/** The version that first stores variables, bindings and connections (ADR-170). */
const VARS_SINCE = 2;
/** The version that first stores run handles and sinks (ADR-204), connection kinds and wall connections (ADR-207). */
const RUN_EXTRAS_SINCE = 3;

/** A display-only 3D model kept in a template (ADR-208): a project's model item with an offset; `ref` is its id. */
export interface TemplateModel {
  ref: string;
  modelId: string;
  name: string;
  size: ModelSize;
  offset: { x: Mm; y: Mm; z: Mm };
  rotationY: ModelTurn;
  front?: ModelFront;
  /** On a piece: `baseId` is that piece's template ref. */
  placement?: ModelPlacement;
}

/** A run handle kept in a template (ADR-204): `from` and `own` are template refs; a new id is given on use. */
export type TemplateRunHandle = Omit<RunHandle, 'id'>;
/** A sink kept in a template (ADR-204): `baseId` is a template ref; a new id is given on use. */
export type TemplateSink = Omit<RunSink, 'id'>;

/** A connection in a template, over template refs (ADR-168); its kind and wall since version 3 (ADR-207). */
export interface TemplateConnection {
  /** A wall connection holds its one piece twice, as in a project. */
  itemIds: [string, string];
  kind?: ConnectionKind;
  wall?: number;
}

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
  /** Connections between pieces (ADR-168), over template refs (schemaVersion 2; kinds and walls 3, ADR-207). */
  connections?: TemplateConnection[];
  /** Run handles (ADR-125), over template refs (schemaVersion 3, ADR-204). */
  runHandles?: TemplateRunHandle[];
  /** Sinks over base units (ADR-125), over template refs (schemaVersion 3, ADR-204). */
  sinks?: TemplateSink[];
  /** The project's display-only 3D models (schemaVersion 3, ADR-208). Template files embed their files. */
  models?: TemplateModel[];
}

/**
 * Run handles and sinks with their piece ids mapped through `ids` (ADR-204): ids not mapped (pieces not there any
 * more) are dropped, a handle left with no piece and a sink over a gone base go. `fresh` gives each a new id.
 */
export function remapRunExtras(
  handles: readonly TemplateRunHandle[] | undefined,
  sinks: readonly TemplateSink[] | undefined,
  ids: ReadonlyMap<string, string>,
): { runHandles: RunHandle[]; sinks: RunSink[] } {
  const map = (xs: readonly string[]) =>
    xs.map((x) => ids.get(x)).filter((x): x is string => x !== undefined);
  const runHandles = (handles ?? [])
    .map((rh) => ({
      id: newId(),
      from: map(rh.from),
      handle: { ...rh.handle },
      ...(rh.height !== undefined ? { height: rh.height } : {}),
      ...(rh.own ? { own: map(rh.own) } : {}),
    }))
    .filter((rh) => rh.from.length);
  const out = (sinks ?? [])
    .filter((sk) => ids.has(sk.baseId))
    .map((sk) => ({ id: newId(), baseId: ids.get(sk.baseId)!, w: sk.w, d: sk.d }));
  return { runHandles, sinks: out };
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
    ?.filter((c) => c.itemIds.every((x) => refs.has(x)))
    .map((c): TemplateConnection => ({
      itemIds: [c.itemIds[0], c.itemIds[1]],
      ...(c.kind ? { kind: c.kind } : {}),
      ...(c.wall !== undefined ? { wall: c.wall } : {}),
    }));
  const bound = p.items.some((i) => i.bindings?.length);
  const zoned = p.items.some((i) => i.zones);
  // Run handles and sinks over template refs (ADR-204): pieces no longer there are dropped.
  const extras = remapRunExtras(p.runHandles, p.sinks, refs);
  const runHandles: TemplateRunHandle[] = extras.runHandles.map(({ id: _i, ...rh }) => {
    void _i;
    return rh;
  });
  const sinks: TemplateSink[] = extras.sinks.map(({ id: _i, ...sk }) => {
    void _i;
    return sk;
  });
  const models: TemplateModel[] = (p.models ?? []).map((m) => ({
    ref: m.id,
    modelId: m.modelId,
    name: m.name,
    size: { ...m.size },
    offset: { x: m.position.x - ox, y: m.position.y, z: m.position.z - oz },
    rotationY: m.rotationY,
    ...(m.front ? { front: m.front } : {}),
    ...(m.placement ? { placement: structuredClone(m.placement) } : {}),
  }));
  return {
    kind: 'project-template',
    // Run handles, sinks, connection kinds, 3D models or item zones need version 3 (ADR-204, ADR-207, ADR-208,
    // ADR-205); variables, bindings or connections version 2 (ADR-170); without them an older app can still read it.
    schemaVersion:
      runHandles.length ||
      sinks.length ||
      connections?.some((c) => c.kind) ||
      models.length ||
      zoned
        ? TEMPLATE_SCHEMA
        : variables || connections?.length || bound
          ? VARS_SINCE
          : 1,
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
      ...(i.zones ? { zones: structuredClone(i.zones) } : {}),
    })),
    ...(variables ? { variables } : {}),
    ...(connections?.length ? { connections } : {}),
    ...(runHandles.length ? { runHandles } : {}),
    ...(sinks.length ? { sinks } : {}),
    ...(models.length ? { models } : {}),
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
      ...(i.zones ? { zones: structuredClone(i.zones) } : {}),
    };
  });
  const connections = templateConnections(t.connections, ids, t.room).connections;
  const extras = remapRunExtras(t.runHandles, t.sinks, ids);
  const models = templateModels(t.models, ids);
  const extended =
    items.some((i) => i.linkId || i.angle || i.bindings || i.zones) ||
    t.variables?.length ||
    connections.length ||
    extras.runHandles.length ||
    extras.sinks.length ||
    models.length;
  const base: Project = {
    // Linked copies, angled pieces, bindings, connections, run handles and sinks need the project version that stores
    // them (ADR-111, ADR-121, ADR-166, ADR-168, ADR-125).
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
    ...(extras.runHandles.length ? { runHandles: extras.runHandles } : {}),
    ...(extras.sinks.length ? { sinks: extras.sinks } : {}),
    ...(models.length ? { models } : {}),
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

/**
 * A template's connections over the new piece ids (ADR-168, ADR-207); a wall connection to a wall `room` lacks is
 * dropped and counted, for the notice.
 */
export function templateConnections(
  list: readonly TemplateConnection[] | undefined,
  ids: ReadonlyMap<string, string>,
  room: Room | undefined,
): { connections: Connection[]; droppedWalls: number } {
  let droppedWalls = 0;
  const connections: Connection[] = [];
  for (const c of list ?? []) {
    if (!c.itemIds.every((x) => ids.has(x))) continue;
    if (c.kind === 'wall' && (!room || c.wall === undefined || c.wall >= room.outline.length)) {
      droppedWalls++;
      continue;
    }
    connections.push({
      id: newId(),
      ...(c.kind ? { kind: c.kind } : {}),
      itemIds: [ids.get(c.itemIds[0])!, ids.get(c.itemIds[1])!],
      ...(c.wall !== undefined ? { wall: c.wall } : {}),
    });
  }
  return { connections, droppedWalls };
}

/**
 * A template's 3D models as project model items (ADR-208): new ids, at their offsets moved by `dx`, `dz`; one on a
 * piece follows that piece's new id.
 */
export function templateModels(
  list: readonly TemplateModel[] | undefined,
  ids: ReadonlyMap<string, string>,
  dx = 0,
  dz = 0,
): ModelItem[] {
  return (list ?? []).map((m) => ({
    id: newId(),
    modelId: m.modelId,
    name: m.name,
    size: { ...m.size },
    position: { x: m.offset.x + dx, y: m.offset.y, z: m.offset.z + dz },
    rotationY: m.rotationY,
    ...(m.front ? { front: m.front } : {}),
    ...(m.placement
      ? {
          placement:
            m.placement.kind === 'above'
              ? { ...m.placement, baseId: ids.get(m.placement.baseId) ?? m.placement.baseId }
              : { ...m.placement },
        }
      : {}),
  }));
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
    (t.schemaVersion !== 1 && t.schemaVersion !== VARS_SINCE && t.schemaVersion !== TEMPLATE_SCHEMA)
  )
    errs.push('Not a project template');
  const v2 = typeof t.schemaVersion === 'number' && t.schemaVersion >= VARS_SINCE;
  const v3 = typeof t.schemaVersion === 'number' && t.schemaVersion >= RUN_EXTRAS_SINCE;
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
      errs.push(`${name}: bindings need template schemaVersion ${VARS_SINCE}`);
    // Zones need version 3 (ADR-205); their values are checked on the project the template makes.
    if (it.zones !== undefined && (!v3 || !isObj(it.zones)))
      errs.push(`${name}: clearance zones need template schemaVersion ${RUN_EXTRAS_SINCE}`);
  }
  if (t.variables !== undefined && (!v2 || !Array.isArray(t.variables)))
    errs.push(`Variables need template schemaVersion ${VARS_SINCE}`);
  if (t.connections !== undefined) {
    const pairs = new Set<string>();
    if (!v2 || !Array.isArray(t.connections))
      errs.push(`Connections need template schemaVersion ${VARS_SINCE}`);
    else
      for (const c of t.connections) {
        const kind = isObj(c) ? c.kind : undefined;
        // Kinds and wall connections need version 3 (ADR-207).
        if ((kind !== undefined || (isObj(c) && c.wall !== undefined)) && !v3) {
          errs.push(`Connection kinds need template schemaVersion ${TEMPLATE_SCHEMA}`);
          continue;
        }
        const wall = kind === 'wall';
        const ids = isObj(c) && Array.isArray(c.itemIds) ? (c.itemIds as unknown[]) : null;
        const key =
          ids &&
          ids.length === 2 &&
          ids.every((x) => typeof x === 'string' && refs.has(x)) &&
          (!wall || ids[0] === ids[1])
            ? wall
              ? `wall:${ids[0] as string}:${String(c.wall)}`
              : [...(ids as string[])].sort().join('|')
            : '';
        if (
          !key ||
          (kind !== undefined && !['side', 'corner', 'stacked', 'wall'].includes(kind as string)) ||
          (wall ? !isInt(c.wall, 0, 999) : c.wall !== undefined) ||
          (!wall && ids![0] === ids![1]) ||
          pairs.has(key)
        ) {
          errs.push('Invalid template connection');
          continue;
        }
        pairs.add(key);
      }
  }
  // Run handles and sinks (ADR-204): version 3, every ref a template item; their shape is checked on the project.
  const allRefs = (v: unknown) =>
    Array.isArray(v) && v.every((x) => typeof x === 'string' && refs.has(x));
  if (t.runHandles !== undefined) {
    if (!v3 || !Array.isArray(t.runHandles))
      errs.push(`Run handles need template schemaVersion ${RUN_EXTRAS_SINCE}`);
    else
      for (const rh of t.runHandles)
        if (
          !isObj(rh) ||
          !allRefs(rh.from) ||
          !(rh.from as string[]).length ||
          (rh.own !== undefined && !allRefs(rh.own)) ||
          !isObj(rh.handle)
        )
          errs.push('Invalid template run handle');
  }
  if (t.sinks !== undefined) {
    if (!v3 || !Array.isArray(t.sinks))
      errs.push(`Sinks need template schemaVersion ${RUN_EXTRAS_SINCE}`);
    else
      for (const sk of t.sinks)
        if (!isObj(sk) || typeof sk.baseId !== 'string' || !refs.has(sk.baseId))
          errs.push('Invalid template sink');
  }
  if (t.models !== undefined) {
    if (!v3 || !Array.isArray(t.models))
      errs.push(`3D models need template schemaVersion ${TEMPLATE_SCHEMA}`);
    else {
      const seen = new Set<string>();
      for (const m of t.models) {
        const size = isObj(m) ? m.size : null;
        const o = isObj(m) ? m.offset : null;
        const pl = isObj(m) ? m.placement : undefined;
        if (
          !isObj(m) ||
          typeof m.ref !== 'string' ||
          !m.ref ||
          seen.has(m.ref) ||
          refs.has(m.ref) ||
          typeof m.modelId !== 'string' ||
          !m.modelId ||
          typeof m.name !== 'string' ||
          m.name.length > 200 ||
          !isObj(size) ||
          !['w', 'h', 'd'].every((k) => isInt(size[k], 1)) ||
          !isObj(o) ||
          !isInt(o.x) ||
          !isInt(o.y, 0) ||
          !isInt(o.z) ||
          ![0, 90, 180, 270].includes(m.rotationY as number) ||
          (m.front !== undefined && !((m.front as string) in FRONT_TURN)) ||
          (pl !== undefined &&
            (!validModelPlacement(pl) ||
              (isObj(pl) && pl.kind === 'above' && !refs.has(pl.baseId as string))))
        ) {
          errs.push('Invalid template 3D model');
          continue;
        }
        seen.add(m.ref);
      }
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
