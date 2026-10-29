/**
 * The size of a group as a whole (ADR-146). Width is the group's extent along the wall: the pieces stand in columns
 * (two pieces cover the same span along the wall or none of it) and the change is shared by the columns that can
 * change, Proportionally to their widths or Equally; leftover whole mm go one each to the leftmost columns (ADR-003).
 * Columns to the right shift by the growth on their left, so gaps stay and touching pieces stay touching. Height and
 * depth are set on every piece; placements stay. A piece that cannot change — size-locked (ADR-122), without that size
 * (`sizeFields`), or for width turned off the wall's direction — keeps its size and is named. Problems refuse the
 * change with the reason, never a clamp (ADR-008). Pure.
 */
import { resizeProduct, sizeFields, type SizeField } from './pieceSize';
import {
  pieceName,
  placedBounds,
  resolvePlacements,
  type Project,
  type ProjectItem,
} from './project';
import { isSizeLocked } from './sizeLock';
import type { Design, Mm } from './types';

export type WidthSplit = 'proportional' | 'equal';

/** One size of the group: its current value and whether its pieces differ (height and depth). */
export interface GroupSizeField {
  key: SizeField['key'];
  label: string;
  value: Mm;
  /** Height and depth: the pieces do not all have the same value; `value` is the largest. */
  differs: boolean;
}

export interface GroupResizeResult {
  project: Project;
  /** Why nothing changed. */
  reason?: string;
  /** The pieces that kept their size, by name. */
  kept: string[];
}

const LABEL: Record<SizeField['key'], string> = {
  width: 'Width',
  height: 'Height',
  depth: 'Depth',
};

const field = (it: ProjectItem, key: SizeField['key']) =>
  sizeFields(it.design.product).find((f) => f.key === key);

/** The piece keeps this size: it is size-locked, has no such size, or (width) is turned off the wall's direction. */
function fixed(it: ProjectItem, key: SizeField['key']): boolean {
  if (isSizeLocked(it) || !field(it, key)) return true;
  return key === 'width' && (it.rotationY === 90 || it.rotationY === 270 || !!it.angle);
}

/** The design with one outside size changed; a brand's product is no longer that brand's (ADR-028), as in ADR-106. */
export function resizedDesign(design: Design, key: SizeField['key'], value: Mm): Design {
  const product = resizeProduct(design.product, key, value);
  if (product === design.product) return design;
  const catalog =
    design.catalog?.brand && design.catalog.origin
      ? { ...design.catalog, brand: undefined }
      : design.catalog;
  return { ...design, catalog, product, updatedAt: new Date().toISOString() };
}

const members = (project: Project, ids: readonly string[]) =>
  project.items.filter((i) => ids.includes(i.id));

/** The group's Width (extent along the wall), Height and Depth (largest piece; whether pieces differ). */
export function groupSizeFields(project: Project, ids: readonly string[]): GroupSizeField[] {
  const placed = members(resolvePlacements(project), ids);
  if (!placed.length) return [];
  const boxes = placed.map(placedBounds);
  const left = Math.min(...boxes.map((b) => b.x));
  const right = Math.max(...boxes.map((b) => b.x + b.w));
  const out: GroupSizeField[] = [
    { key: 'width', label: 'Width', value: right - left, differs: false },
  ];
  for (const key of ['height', 'depth'] as const) {
    const values = placed.flatMap((it) => field(it, key)?.value ?? []);
    if (values.length)
      out.push({
        key,
        label: LABEL[key],
        value: Math.max(...values),
        differs: values.some((v) => v !== values[0]),
      });
  }
  return out;
}

/** `total` mm shared by `weights`: whole mm, leftover one each to the first ones (signed like `total`). */
function share(total: number, weights: number[]): number[] {
  const sum = weights.reduce((a, b) => a + b, 0);
  const parts = weights.map((w) => (sum ? Math.trunc((total * w) / sum) : 0));
  const sign = Math.sign(total);
  let rest = total - parts.reduce((a, b) => a + b, 0);
  for (let i = 0; rest !== 0 && i < parts.length; i++, rest -= sign) parts[i] += sign;
  return parts;
}

const outside = (project: Project, it: ProjectItem, key: SizeField['key'], v: number) => {
  const f = field(it, key)!;
  return v < f.min || v > f.max
    ? `${pieceName(project, it.id)} would be ${v} mm ${f.label.toLowerCase()}; it takes ${f.min}–${f.max} mm.`
    : null;
};

/**
 * Set the group's `key` size to `value`: width as the group's extent along the wall, height and depth on every piece.
 * One project; the same project with the reason when refused or nothing changes.
 */
export function resizeGroup(
  project: Project,
  ids: readonly string[],
  key: SizeField['key'],
  value: Mm,
  split: WidthSplit = 'proportional',
): GroupResizeResult {
  const items = members(project, ids);
  const none = (reason?: string, kept: string[] = []): GroupResizeResult => ({
    project,
    ...(reason ? { reason } : {}),
    kept,
  });
  if (items.length < 2) return none();
  if (!Number.isInteger(value) || value <= 0)
    return none(`The group's ${LABEL[key].toLowerCase()} must be a whole number of mm above 0.`);
  const kept = items.filter((it) => fixed(it, key)).map((it) => pieceName(project, it.id));
  if (key !== 'width') {
    const change = items.filter((it) => !fixed(it, key));
    if (!change.length)
      return none(`No piece in the group can change its ${LABEL[key].toLowerCase()}.`, kept);
    for (const it of change) {
      const why = outside(project, it, key, value);
      if (why) return none(why, kept);
    }
    const next = project.items.map((it) =>
      change.includes(it) ? { ...it, design: resizedDesign(it.design, key, value) } : it,
    );
    return next.every((it, i) => it === project.items[i])
      ? none(undefined, kept)
      : { project: { ...project, items: next }, kept };
  }
  // Width: the pieces in columns, left to right.
  const placed = resolvePlacements(project);
  const box = new Map(members(placed, ids).map((it) => [it.id, placedBounds(it)]));
  const cols: { x: number; w: number; ids: string[] }[] = [];
  for (const it of [...items].sort((a, b) => box.get(a.id)!.x - box.get(b.id)!.x)) {
    const b = box.get(it.id)!;
    const col = cols.find((c) => c.x === b.x && c.w === b.w);
    if (col) col.ids.push(it.id);
    else cols.push({ x: b.x, w: b.w, ids: [it.id] });
  }
  for (let i = 1; i < cols.length; i++)
    if (cols[i].x < cols[i - 1].x + cols[i - 1].w)
      return none(
        'Width needs the pieces side by side in columns: each piece covers the same span along the wall as the pieces over or under it, or none of it.',
      );
  const extent = cols[cols.length - 1].x + cols[cols.length - 1].w - cols[0].x;
  const delta = value - extent;
  if (!delta) return none(undefined, kept);
  const byId = new Map(items.map((it) => [it.id, it]));
  const free = cols.filter((c) => c.ids.every((id) => !fixed(byId.get(id)!, 'width')));
  if (!free.length) return none('No piece in the group can change its width.', kept);
  const parts = share(
    delta,
    free.map((c) => (split === 'equal' ? 1 : c.w)),
  );
  const grow = new Map(free.map((c, i) => [c, parts[i]]));
  const change = new Map<string, { grow: number; shift: number }>();
  let shift = 0;
  for (const c of cols) {
    const g = grow.get(c) ?? 0;
    for (const id of c.ids) change.set(id, { grow: g, shift });
    shift += g;
  }
  // Pieces kept because their whole column is kept are named; so are the ones that fixed a column.
  const keptW = cols
    .filter((c) => !grow.has(c))
    .flatMap((c) => c.ids.map((id) => pieceName(project, id)));
  for (const [id, c] of change) {
    const it = byId.get(id)!;
    if (c.grow) {
      const why = outside(project, it, 'width', field(it, 'width')!.value + c.grow);
      if (why) return none(why, keptW);
    }
    if (
      c.shift &&
      it.locked &&
      !(it.placement?.kind === 'above' && change.has(it.placement.baseId))
    )
      return none(`${pieceName(project, id)} is locked — unlock it to resize its group.`, keptW);
  }
  const next = project.items.map((it): ProjectItem => {
    const c = change.get(it.id);
    if (!c) return it;
    const design = c.grow
      ? resizedDesign(it.design, 'width', field(it, 'width')!.value + c.grow)
      : it.design;
    const pl = it.placement;
    // Resting on a piece: it slides along it by what its base does not shift for it.
    if (pl?.kind === 'above') {
      const offsetX = pl.offsetX + c.shift - (change.get(pl.baseId)?.shift ?? 0);
      return { ...it, design, placement: { ...pl, offsetX } };
    }
    return { ...it, design, position: { ...it.position, x: it.position.x + c.shift } };
  });
  return { project: { ...project, items: next }, kept: keptW };
}
