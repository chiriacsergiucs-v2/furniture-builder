/**
 * Replace a piece with a compatible catalog alternative (ADR-098). Pure functions over the stored project: the item
 * keeps its id and everything about where and how it stands; only its embedded design changes, to a fresh catalog
 * copy carrying the old piece's boards by part role (as finish scope applies them, ADR-055). Run parts and checks
 * follow in the store's commit (ADR-061); nothing stored changes shape (ADR-011).
 */
import { buildModel } from './build';
import { insertable, insertVariant, startFamilies } from './catalog';
import type { CatalogFamily, CatalogVariant } from './catalog/types';
import { upgradeDesign } from './design';
import { putRoleBoard, roleBoard, type FinishRole } from './finish';
import {
  isWallHung,
  placedBounds,
  type Project,
  type ProjectItem,
  type ProjectModel,
} from './project';
import { sameProblem } from './repairs';
import type { Design, Diagnostic, Mm } from './types';

/** How a piece stands: on the floor, hung on the wall, or on (or above) another piece (ADR-031). */
export type PlaceKind = 'floor' | 'wall' | 'above';

/** The design's own mount: hung on the wall or standing. */
const mountOf = (d: Design): 'floor' | 'wall' => (isWallHung(d) ? 'wall' : 'floor');

/** The item's placement kind; a free piece (saved before placement existed) counts by its design's mount. */
export const placeKind = (item: ProjectItem): PlaceKind =>
  item.placement?.kind ?? mountOf(item.design);

/**
 * A design may take the item's place when it stands the same way: a floor piece by a standing piece, a wall piece by a
 * wall-hung one. A piece on another piece keeps that placement, so any piece may take its place.
 */
export const fitsPlacement = (item: ProjectItem, d: Design): boolean => {
  const k = placeKind(item);
  return k === 'above' || k === mountOf(d);
};

export interface ReplaceOption<F extends CatalogFamily = CatalogFamily> {
  family: F;
  variant: CatalogVariant;
  /** The built size of the alternative, mm (ADR-004). */
  w: Mm;
  h: Mm;
  d: Mm;
  /** Same width as the piece: compatible by default (ADR-098 answer 1); the rest sit behind "Show other widths". */
  sameWidth: boolean;
}

/** The piece's own width (unturned), from its built model (ADR-004). */
export const ownWidth = (d: Design): Mm => buildModel(d).bounds.w;

/** Built size and mount per catalog variant, so the list opens without building every item again. */
const sized = new WeakMap<CatalogVariant, { w: Mm; h: Mm; d: Mm; mount: 'floor' | 'wall' }>();
function sizeOf(family: CatalogFamily, variant: CatalogVariant) {
  const hit = sized.get(variant);
  if (hit) return hit;
  const d = insertVariant(family, variant, '');
  if (!d) return null;
  const b = buildModel(d).bounds;
  const out = { w: b.w, h: b.h, d: b.d, mount: mountOf(d) };
  sized.set(variant, out);
  return out;
}

/**
 * The catalog items that could take the piece's place: insertable, the same placement kind, and not the variant the
 * piece came from. Same width first, then the nearest widths. Widths come from the built models.
 */
export function replaceOptions<F extends CatalogFamily>(
  item: ProjectItem,
  families: F[],
): ReplaceOption<F>[] {
  const width = ownWidth(item.design);
  const kind = placeKind(item);
  const origin = item.design.catalog?.origin;
  const out: ReplaceOption<F>[] = [];
  for (const family of startFamilies(families) as F[])
    for (const variant of family.variants) {
      if (!insertable(variant)) continue;
      if (origin && origin.catalogId === family.id && origin.variantId === variant.id) continue;
      const b = sizeOf(family, variant);
      if (!b || (kind !== 'above' && kind !== b.mount)) continue;
      out.push({ family, variant, w: b.w, h: b.h, d: b.d, sameWidth: b.w === width });
    }
  return out
    .map((o, i) => ({ o, i }))
    .sort(
      (a, b) =>
        Number(b.o.sameWidth) - Number(a.o.sameWidth) ||
        Math.abs(a.o.w - width) - Math.abs(b.o.w - width) ||
        a.i - b.i,
    )
    .map(({ o }) => o);
}

/** A design's content with every id replaced by its order of appearance, so two copies of one item compare equal. */
function content(d: Design): string {
  const ids = new Map<string, string>();
  const collect = (v: unknown): void => {
    if (Array.isArray(v)) v.forEach(collect);
    else if (v && typeof v === 'object')
      for (const [k, x] of Object.entries(v)) {
        if (k === 'id' && typeof x === 'string' && !ids.has(x)) ids.set(x, `#${ids.size}`);
        collect(x);
      }
  };
  const body = { name: d.name, product: d.product, materials: d.materials };
  collect(body);
  return JSON.stringify(body, (_k, v: unknown) =>
    typeof v === 'string' && ids.has(v) ? ids.get(v) : v,
  );
}

/**
 * The piece was changed after it was added: its design was edited (stamped), or it no longer matches a fresh copy of
 * the catalog item it came from (a mirror, a board or a merge changes the copy without stamping it). A piece whose
 * catalog item is not found counts by its stamp only.
 */
export function designEdited(d: Design, families: CatalogFamily[] = []): boolean {
  if (d.updatedAt !== d.createdAt) return true;
  const o = d.catalog?.origin;
  const family = o && families.find((f) => f.id === o.catalogId);
  const variant = family && family.variants.find((v) => v.id === o.variantId);
  if (!family || !variant) return false;
  const fresh = insertVariant(family, variant, d.createdAt);
  return !!fresh && content(upgradeDesign(d)) !== content(fresh);
}

const ROLES: FinishRole[] = ['front', 'body'];

/**
 * The project with the item's design replaced by `design` (a catalog copy with its own origin). The item keeps its
 * id, position, turn, quantity, placement, zones and every other field it carries (lock, group); its fronts and
 * carcass keep the old piece's boards where both designs have that part. The link to a saved piece is dropped: the
 * new design did not come from it. Returns the same project when the item does not exist.
 */
export function replaceItem(project: Project, itemId: string, design: Design): Project {
  const it = project.items.find((i) => i.id === itemId);
  if (!it) return project;
  let d = structuredClone(upgradeDesign(design));
  const defaults = ROLES.map((r) => roleBoard(d, r));
  for (const role of ROLES) {
    const id = roleBoard(it.design, role);
    const board = id ? it.design.materials.find((m) => m.id === id) : undefined;
    if (board) d = putRoleBoard(d, role, board);
  }
  // The new copy's own front and carcass boards go when no part uses them any more.
  const used = JSON.stringify(d.product);
  const unused = new Set(defaults.filter((id): id is string => !!id && !used.includes(id)));
  if (unused.size) d = { ...d, materials: d.materials.filter((m) => !unused.has(m.id)) };
  const { libraryId: _lib, ...keep } = it;
  void _lib;
  const next: ProjectItem = { ...keep, design: d };
  return {
    ...project,
    items: project.items.map((i) =>
      i.id === itemId ? { ...next, position: anchored(it, next) } : i,
    ),
  };
}

/**
 * Where the new piece stands so that its back and its left side stay where the old piece's were (the left-back
 * corner, ADR-098): `position` is the turned piece's lowest corner, so a piece turned to face the back wall or the
 * left grows from its other end. Its height from the floor (or the wall height) stays.
 */
function anchored(old: ProjectItem, next: ProjectItem): ProjectItem['position'] {
  const a = placedBounds(old),
    b = placedBounds(next);
  const r = old.rotationY;
  // Back face and left side per turn: 0 back -z left -x; 90 back -x left +z; 180 back +z left +x; 270 back +x left -z.
  const maxX = r === 180 || r === 270,
    maxZ = r === 90 || r === 180;
  return {
    x: next.position.x + (maxX ? a.x + a.w - (b.x + b.w) : a.x - b.x),
    y: next.position.y,
    z: next.position.z + (maxZ ? a.z + a.d - (b.z + b.d) : a.z - b.z),
  };
}

export interface ReplaceReport {
  /** "Replaced. Base unit 600 → 800 mm wide. Worktop 2400 → 2600 mm. 1 problem: …" */
  text: string;
  /** Problems the replacement brought, errors first. */
  problems: Diagnostic[];
}

/** What a replacement changed: the piece's width, the run parts, and the new problems (ADR-098). */
export function replaceReport(
  before: Project,
  beforeModel: ProjectModel,
  after: Project,
  afterModel: ProjectModel,
  itemId: string,
): ReplaceReport {
  const lines: string[] = [];
  const was = before.items.find((i) => i.id === itemId);
  const now = after.items.find((i) => i.id === itemId);
  if (was && now) {
    const w0 = ownWidth(was.design),
      w1 = ownWidth(now.design);
    if (w0 !== w1) lines.push(`${now.design.name} ${w0} → ${w1} mm wide`);
  }
  const keyOf = (r: { key?: string; id: string }) => r.key ?? r.id;
  const old = new Map((before.runParts ?? []).map((r) => [keyOf(r), r]));
  const kept = new Set((after.runParts ?? []).map(keyOf));
  for (const r of after.runParts ?? []) {
    if (!old.has(keyOf(r))) lines.push(`${r.label} added`);
    else if (r.changed && JSON.stringify(old.get(keyOf(r))!.box) !== JSON.stringify(r.box))
      lines.push(`${r.label} ${r.changed}`);
  }
  for (const [k, r] of old) if (!kept.has(k)) lines.push(`${r.label} removed`);
  const problems = afterModel.diagnostics
    .filter((d) => !beforeModel.diagnostics.some((b) => sameProblem(b, d)))
    .sort((a, b) => Number(b.severity === 'error') - Number(a.severity === 'error'));
  if (problems.length)
    lines.push(
      `${problems.length} problem${problems.length === 1 ? '' : 's'}: ${problems[0].message}`,
    );
  return {
    text: ['Replaced.', ...lines.map((l) => (/[.!?]$/.test(l) ? l : `${l}.`))].join(' '),
    problems,
  };
}
