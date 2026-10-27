/**
 * A piece's own edits against its catalog template (ADR-124): the settings it changed, as paths into
 * `product.params`, and carrying them onto another design (Replace, ADR-098; a newer template revision, ADR-096).
 *
 * Ids never count as edits: space and product ids are dropped when comparing, and a board reference is compared as
 * the board itself (name, thickness, grain, picture, banding), so two copies of one template compare equal. A path
 * that the other design does not have, or that would make it invalid, is not carried; the caller lists it.
 */
import { buildModel } from './build';
import { insertable, insertVariant } from './catalog';
import type { CatalogFamily } from './catalog/types';
import { newId, upgradeDesign, validateDesign } from './design';
import { materialKey, type ProjectItem } from './project';
import type { Design, Material } from './types';

/** Path ("interior.children.1.handle") → the piece's value; `UNSET` where it removed a setting. */
export type Overrides = Record<string, unknown>;
export const UNSET = { $unset: true } as const;

const isObj = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === 'object' && !Array.isArray(v);
const isUnset = (v: unknown) => isObj(v) && v.$unset === true;
const isBoardKey = (k: string) => /materialId$/i.test(k);
/** Keys that are references, not settings: dropped when comparing (boards are compared as boards). */
const isRefKey = (k: string) => k === 'id' || (/Id$/.test(k) && !isBoardKey(k));
const isBoard = (v: unknown): v is Omit<Material, 'id'> =>
  isObj(v) && 'thickness' in v && 'name' in v && 'grain' in v;
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

/** A board without its id, so copies of one board compare equal. */
function board(d: Design, id: unknown): Omit<Material, 'id'> | undefined {
  const m = d.materials.find((x) => x.id === id);
  if (!m) return undefined;
  const { id: _id, ...rest } = m;
  void _id;
  return rest;
}

/** The value with every board reference replaced by the board itself. */
function withBoards(d: Design, v: unknown): unknown {
  if (Array.isArray(v)) return v.map((x) => withBoards(d, x));
  if (!isObj(v)) return v;
  const out: Record<string, unknown> = {};
  for (const [k, x] of Object.entries(v))
    out[k] = isBoardKey(k) ? (board(d, x) ?? x) : withBoards(d, x);
  return out;
}

/** For comparing: references (ids) dropped. */
function withoutRefs(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(withoutRefs);
  if (!isObj(v) || isBoard(v)) return v;
  const out: Record<string, unknown> = {};
  for (const [k, x] of Object.entries(v)) if (!isRefKey(k)) out[k] = withoutRefs(x);
  return out;
}

/** `a`, `b`: the compared forms; `raw`: the piece's value at the same place (ids kept), which is what is stored. */
function diff(a: unknown, b: unknown, raw: unknown, path: string[], out: Overrides) {
  if (Array.isArray(a) && Array.isArray(b) && Array.isArray(raw) && a.length === b.length) {
    a.forEach((x, i) => diff(x, b[i], raw[i], [...path, String(i)], out));
    return;
  }
  // A board is one setting, not its fields.
  if (isObj(a) && isObj(b) && isObj(raw) && !isBoard(a) && !isBoard(b)) {
    for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) {
      if (!(k in b)) out[[...path, k].join('.')] = UNSET;
      else if (!(k in a)) out[[...path, k].join('.')] = raw[k];
      else diff(a[k], b[k], raw[k], [...path, k], out);
    }
    return;
  }
  if (!same(a, b)) out[path.join('.')] = raw;
}

/** The settings `piece` changed against `template` (both of the same product kind); empty otherwise. */
export function settingsDiff(template: Design, piece: Design): Overrides {
  if (template.product.kind !== piece.product.kind) return {};
  const out: Overrides = {};
  const raw = withBoards(piece, piece.product.params);
  diff(withoutRefs(withBoards(template, template.product.params)), withoutRefs(raw), raw, [], out);
  return out;
}

/**
 * A fresh copy of the template a design was taken from, when the catalog has that variant at that revision (or at
 * any revision with `anyRevision`); null otherwise.
 */
export function templateOf(
  d: Design,
  families: readonly Pick<CatalogFamily, 'id' | 'name' | 'catalogVersion' | 'variants'>[],
  anyRevision = false,
): Design | null {
  const o = d.catalog?.origin;
  const family = o && families.find((f) => f.id === o.catalogId);
  if (!o || !family || (!anyRevision && family.catalogVersion !== o.revision)) return null;
  const variant = family.variants.find((v) => v.id === o.variantId);
  if (!variant || !insertable(variant)) return null;
  return insertVariant(family, variant, d.createdAt);
}

/**
 * The piece's own edits: against its template while the catalog has that revision, else the overrides it stored
 * while it had (ADR-124 `ref`); none for a piece of the user's own design.
 */
export function ownEdits(
  item: Pick<ProjectItem, 'design' | 'ref'>,
  families: readonly CatalogFamily[],
): Overrides {
  const t = templateOf(item.design, families);
  if (t) return settingsDiff(t, upgradeDesign(item.design));
  return item.ref?.overrides ?? {};
}

/** "interior.children.2.handle" → "interior space 3 handle". */
export function editLabel(path: string): string {
  return path
    .split('.')
    .map((s) => (/^\d+$/.test(s) ? String(Number(s) + 1) : s === 'children' ? 'space' : s))
    .map((s) => s.replace(/(m|M)aterialId$/, 'Board').replace(/^Board$/, 'board'))
    .map((s) => s.replace(/([a-z])([A-Z])/g, '$1 $2').toLowerCase())
    .join(' ');
}

/** The value as it goes into `d`: each board becomes a reference to `d`'s own copy of it (added when missing). */
function placeBoards(d: Design, v: unknown, key = ''): { d: Design; v: unknown } {
  if (isBoardKey(key) && isBoard(v)) {
    const have = d.materials.find(
      (m) =>
        materialKey(m) === materialKey(v) && same(m.band, v.band) && same(m.frontBand, v.frontBand),
    );
    if (have) return { d, v: have.id };
    const mat = { ...v, id: newId() } as Material;
    return { d: { ...d, materials: [...d.materials, mat] }, v: mat.id };
  }
  let cur = d;
  if (Array.isArray(v)) {
    const arr: unknown[] = [];
    for (const x of v) {
      const p = placeBoards(cur, x);
      cur = p.d;
      arr.push(p.v);
    }
    return { d: cur, v: arr };
  }
  if (!isObj(v)) return { d, v };
  const obj: Record<string, unknown> = {};
  for (const [k, x] of Object.entries(v)) {
    const p = placeBoards(cur, x, k);
    cur = p.d;
    obj[k] = p.v;
  }
  return { d: cur, v: obj };
}

/** `d` with `value` at `path` of its params, or null when the path does not exist there. */
function setPath(d: Design, path: string, value: unknown): Design | null {
  const keys = path.split('.');
  const params = structuredClone(d.product.params) as unknown;
  let at: unknown = params;
  for (const k of keys.slice(0, -1)) {
    if (Array.isArray(at) && /^\d+$/.test(k) && Number(k) < at.length) at = at[Number(k)];
    else if (isObj(at) && k in at) at = at[k];
    else return null;
  }
  const last = keys[keys.length - 1];
  let next = d;
  if (Array.isArray(at)) {
    if (!/^\d+$/.test(last) || Number(last) >= at.length || isUnset(value)) return null;
    const p = placeBoards(next, structuredClone(value));
    next = p.d;
    at[Number(last)] = p.v;
  } else if (isObj(at)) {
    if (isUnset(value)) {
      if (!(last in at)) return null;
      delete at[last];
    } else {
      // A setting the new design has, or an optional one beside settings it has (a handle on a space).
      const was = at[last];
      // A board goes in as the board itself, where the design holds its id.
      const board = isBoardKey(last) && isBoard(value);
      if (
        !board &&
        was !== undefined &&
        was !== null &&
        value !== null &&
        typeof was !== typeof value
      )
        return null;
      const p = placeBoards(next, structuredClone(value), last);
      next = p.d;
      at[last] = p.v;
    }
  } else return null;
  return { ...next, product: { ...next.product, params } as Design['product'] };
}

/** Validation problems weigh more than built errors; a design that cannot be built counts as worst. */
function errorCount(d: Design): number {
  const v = validateDesign(d).length;
  if (v) return 1e6 + v;
  try {
    return buildModel(d).diagnostics.filter((x) => x.severity === 'error').length;
  } catch {
    return Number.POSITIVE_INFINITY;
  }
}

export interface CarryResult {
  design: Design;
  /** Labels of the settings carried. */
  kept: string[];
  /** Labels of the settings not carried, with why. */
  notKept: string[];
}

/** Outer size: the new item's own on Replace (the list was chosen by size, ADR-098). */
export const SIZE_SKIP: Record<string, string> = {
  width: "the new item's size is used",
  height: "the new item's size is used",
  depth: "the new item's size is used",
};

/**
 * `target` with the edits applied one by one: a path it does not have, or one that would add an error, is not
 * kept. `skip` paths are listed as not kept with their reason. `checked: false` applies every edit the design has a
 * place for, errors or not: rebuilding a piece from its own template (`resolveItem`) must give the piece as it is.
 */
export function carryEdits(
  target: Design,
  edits: Overrides,
  skip: Record<string, string> = {},
  checked = true,
): CarryResult {
  let d = target;
  let errors = checked ? errorCount(d) : 0;
  const kept: string[] = [],
    notKept: string[] = [];
  for (const [path, value] of Object.entries(edits).sort(([a], [b]) => a.localeCompare(b))) {
    if (skip[path]) {
      notKept.push(`${editLabel(path)} — ${skip[path]}`);
      continue;
    }
    const next = setPath(d, path, value);
    if (!next) {
      notKept.push(`${editLabel(path)} — the new piece has no such setting`);
      continue;
    }
    const e = checked ? errorCount(next) : 0;
    if (e > errors) {
      notKept.push(`${editLabel(path)} — it does not fit the new piece`);
      continue;
    }
    d = next;
    errors = e;
    kept.push(editLabel(path));
  }
  // Boards no part uses any more go (a carried board replaced the template's own).
  const used = JSON.stringify(d.product);
  const materials = d.materials.filter((m) => used.includes(m.id));
  if (materials.length !== d.materials.length) d = { ...d, materials };
  return { design: d, kept, notKept };
}

/** "Kept: handle kind. Not kept: width — …." — the result's line; empty when there were no edits. */
export function carryText(r: Pick<CarryResult, 'kept' | 'notKept'>): string {
  const out: string[] = [];
  if (r.kept.length) out.push(`Kept: ${r.kept.join(', ')}.`);
  if (r.notKept.length) out.push(`Not kept: ${r.notKept.join('; ')}.`);
  return out.join(' ');
}

/**
 * The piece's design rebuilt from its template and stored overrides (ADR-124 `ref`), or its kept copy when the
 * template is not in the catalog at that revision (the fallback, G-161).
 */
export function resolveItem(
  item: Pick<ProjectItem, 'design' | 'ref'>,
  families: readonly CatalogFamily[],
): Design {
  const t = item.ref && templateOf(item.design, families);
  if (!t || !item.ref) return item.design;
  const r = carryEdits(t, item.ref.overrides, {}, false);
  return {
    ...r.design,
    id: item.design.id,
    name: item.design.name,
    createdAt: item.design.createdAt,
    updatedAt: item.design.updatedAt,
    catalog: item.design.catalog,
  };
}

/** Overrides per design object: a commit that did not touch a piece does not compare it again. */
const synced = new WeakMap<Design, Overrides>();

/** Overrides kept up to date while the template's revision is the catalog's; the same item when nothing changed. */
export function syncRef(item: ProjectItem, families: readonly CatalogFamily[]): ProjectItem {
  if (!item.ref) return item;
  let overrides = synced.get(item.design);
  if (!overrides) {
    const t = templateOf(item.design, families);
    if (!t) return item;
    overrides = settingsDiff(t, upgradeDesign(item.design));
    synced.set(item.design, overrides);
  }
  return same(overrides, item.ref.overrides) ? item : { ...item, ref: { overrides } };
}
