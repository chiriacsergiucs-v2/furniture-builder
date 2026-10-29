/**
 * Project templates (ADR-060): a project saved for reuse. Pieces are kept as copies (ADR-032) with positions
 * relative to the leftmost-back piece (or to the room when the room is included); run parts are kept as a recipe
 * and suggested again when the template is used, so they always fit the pieces.
 */
import { newId, validateDesign } from './design';
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
}

export interface ProjectTemplate {
  kind: 'project-template';
  schemaVersion: 1;
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
  return {
    kind: 'project-template',
    schemaVersion: 1,
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
    })),
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
    };
  });
  const base: Project = {
    // Linked copies and angled pieces need the project version that stores them (ADR-111, ADR-121).
    schemaVersion: items.some((i) => i.linkId || i.angle) ? PROJECT_SCHEMA : 1,
    id: newId(),
    name,
    createdAt: now,
    updatedAt: now,
    items,
    cutting: { kerf: 4 },
    ...(t.room ? { room: structuredClone(t.room) } : {}),
  };
  if (!t.runRecipe) return base;
  const removed = remapKeys(t.runRecipe.removed ?? [], ids);
  const withSettings: Project = {
    ...base,
    runSettings: { ...t.runRecipe.settings },
    ...(removed.length ? { runPartsRemoved: removed } : {}),
  };
  return { ...withSettings, runParts: planRuns(withSettings).parts };
}

const isObj = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === 'object' && !Array.isArray(v);
const isInt = (v: unknown, min = -1e7, max = 1e7) =>
  typeof v === 'number' && Number.isSafeInteger(v) && v >= min && v <= max;

/** Problems of a template read from storage or a file; never throws (ADR-008). Empty = usable. */
export function validateProjectTemplate(t: unknown): string[] {
  if (!isObj(t)) return ['Template must be an object'];
  const errs: string[] = [];
  if (t.kind !== 'project-template' || t.schemaVersion !== 1) errs.push('Not a project template');
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
