/**
 * Merging two pieces of a project into one (ADR-047): two cabinets standing side by side, touching, become one wider
 * cabinet. One carcass replaces the two: the two sides that met become a single divider centred on the old joint, and
 * each piece's interior (with its own fronts) becomes one part of a left→right split. Everything else must already be
 * the same; otherwise the merge is refused with the reasons, never guessed.
 */
import { fr, mm, newId, SCHEMA_VERSION } from './design';
import {
  placeItem,
  type Placement,
  type Project,
  type ProjectItem,
  type QuarterTurn,
} from './project';
import type { Box, CabinetParams, Design, Material, Mm } from './types';

export interface MergeCandidate {
  /** The touching piece. */
  item: ProjectItem;
  /** Whether it is on the selected piece's own left or right (as seen from the selected piece's front). */
  side: 'left' | 'right';
  /** Why the two cannot be merged; empty = they can. */
  issues: string[];
}

/** Width axis in the room for a quarter turn, and whether the piece's own left→right runs towards + on it. */
const widthAxis = (r: QuarterTurn): { axis: 'x' | 'z'; forward: boolean } =>
  r === 0
    ? { axis: 'x', forward: true }
    : r === 90
      ? { axis: 'z', forward: false }
      : r === 180
        ? { axis: 'x', forward: false }
        : { axis: 'z', forward: true };
const lo = (b: Box, a: 'x' | 'z') => (a === 'x' ? b.x : b.z);
const len = (b: Box, a: 'x' | 'z') => (a === 'x' ? b.w : b.d);
const other = (a: 'x' | 'z'): 'x' | 'z' => (a === 'x' ? 'z' : 'x');
/** The plane of the back in the room: backs face −z at 0°, −x at 90°, +z at 180°, +x at 270°. */
const backPlane = (b: Box, r: QuarterTurn): Mm =>
  r === 0 ? b.z : r === 90 ? b.x : r === 180 ? b.z + b.d : b.x + b.w;

/** Cabinet settings that must match (everything but the width and the interior). */
function paramDiffs(a: CabinetParams, b: CabinetParams): (keyof CabinetParams)[] {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)] as (keyof CabinetParams)[]);
  keys.delete('width');
  keys.delete('interior');
  return [...keys].filter((k) => JSON.stringify(a[k]) !== JSON.stringify(b[k]));
}

const LABEL: Partial<Record<keyof CabinetParams, string>> = {
  height: 'height',
  depth: 'depth',
  mount: 'stands on / hangs',
  mountHeight: 'hanging height',
  bodyMaterialId: 'body board',
  frontMaterialId: 'front board',
  backMaterialId: 'back board',
  top: 'top joint',
  topKind: 'top kind',
  bottom: 'bottom joint',
  back: 'back',
  backInset: 'back inset',
  plinthHeight: 'plinth height',
  plinthSetback: 'plinth setback',
  frontGap: 'front gap',
  frontStyle: 'front style',
  shelfSetback: 'shelf setback',
  drawers: 'drawer settings',
  railDepth: 'rail depth',
  shelfClearance: 'shelf clearance',
  pinRowSetback: 'pin row setback',
};

/** Materials with the same id but a different board in the two pieces. */
function materialConflicts(a: Design, b: Design): string[] {
  const byId = new Map(a.materials.map((m) => [m.id, m]));
  return b.materials
    .filter((m) => byId.has(m.id) && JSON.stringify(byId.get(m.id)) !== JSON.stringify(m))
    .map((m) => m.name);
}

function samePlacement(a?: Placement, b?: Placement): boolean {
  if (!a || !b) return !a && !b;
  if (a.kind !== b.kind) return false;
  if (a.kind === 'wall' && b.kind === 'wall') return a.height === b.height;
  if (a.kind === 'above' && b.kind === 'above') return a.baseId === b.baseId && a.gap === b.gap;
  return true;
}

/** Why `l` (on the left) and `r` (on its right, touching) cannot be merged. Empty = they can. */
function issuesOf(l: ProjectItem, r: ProjectItem, lb: Box, rb: Box): string[] {
  const out: string[] = [];
  const pl = l.design.product,
    pr = r.design.product;
  if (pl.kind !== 'cabinet' || pr.kind !== 'cabinet') {
    out.push('Only two cabinets can be merged (not corners, desks, frames, panels or panel sets).');
    return out;
  }
  if (l.rotationY !== r.rotationY) out.push('They are turned differently.');
  if (l.quantity !== r.quantity)
    out.push(`The numbers of copies differ (${l.quantity} and ${r.quantity}).`);
  if (!samePlacement(l.placement, r.placement))
    out.push('They are placed differently (floor, wall or on another piece).');
  const diffs = paramDiffs(pl.params, pr.params);
  if (diffs.length)
    out.push(`Different ${diffs.map((k) => LABEL[k] ?? k).join(', ')}; make them the same first.`);
  const a = widthAxis(l.rotationY).axis;
  if (len(lb, a) !== pl.params.width || len(rb, a) !== pr.params.width)
    out.push('Something sticks out at the sides (the outside width is not the cabinet width).');
  if (lb.y !== rb.y || backPlane(lb, l.rotationY) !== backPlane(rb, r.rotationY))
    out.push('Their bottoms or backs do not line up.');
  const mats = materialConflicts(l.design, r.design);
  if (mats.length)
    out.push(`Boards with the same name but different settings: ${mats.join(', ')}.`);
  if (
    l.design.settings &&
    JSON.stringify(l.design.settings) !== JSON.stringify(r.design.settings ?? l.design.settings)
  )
    out.push('Their check settings differ.');
  return out;
}

/** Pieces that touch the selected one along its width (no gap), with whether each can be merged with it. */
export function mergeCandidates(project: Project, id: string): MergeCandidate[] {
  const me = project.items.find((i) => i.id === id);
  if (!me) return [];
  const { axis, forward } = widthAxis(me.rotationY);
  const mb = placeItem(me).bounds;
  const out: MergeCandidate[] = [];
  for (const it of project.items) {
    if (it.id === id) continue;
    const b = placeItem(it).bounds;
    // Same run: overlapping in height and in the other floor axis.
    const o = other(axis);
    if (!(
      Math.min(mb.y + mb.h, b.y + b.h) > Math.max(mb.y, b.y) &&
      Math.min(lo(mb, o) + len(mb, o), lo(b, o) + len(b, o)) > Math.max(lo(mb, o), lo(b, o))
    ))
      continue;
    const after = lo(b, axis) === lo(mb, axis) + len(mb, axis);
    const before = lo(b, axis) + len(b, axis) === lo(mb, axis);
    if (!after && !before) continue;
    const side: 'left' | 'right' = after === forward ? 'right' : 'left';
    const [l, r, lb, rb] = side === 'right' ? [me, it, mb, b] : [it, me, b, mb];
    out.push({ item: it, side, issues: issuesOf(l, r, lb, rb) });
  }
  return out;
}

/**
 * Merge two touching cabinets into one. Returns the same project (and the reasons) when they cannot be merged.
 * The merged piece takes the place of the left one in the list; pieces resting on either now rest on it.
 */
export function mergeItems(
  project: Project,
  aId: string,
  bId: string,
): { project: Project; mergedId: string | null; issues: string[] } {
  const c = mergeCandidates(project, aId).find((x) => x.item.id === bId);
  if (!c) return { project, mergedId: null, issues: ['The two pieces do not touch side by side.'] };
  if (c.issues.length) return { project, mergedId: null, issues: c.issues };
  const a = project.items.find((i) => i.id === aId)!;
  const [l, r] = c.side === 'right' ? [a, c.item] : [c.item, a];
  if (l.design.product.kind !== 'cabinet' || r.design.product.kind !== 'cabinet')
    return { project, mergedId: null, issues: ['Only two cabinets can be merged.'] };
  const lp = l.design.product.params,
    rp = r.design.product.params;
  const t = l.design.materials.find((m) => m.id === lp.bodyMaterialId)?.thickness ?? 18;
  const width = lp.width + rp.width;
  // The left part ends where the divider starts, the divider centred on the old joint; the right part takes the rest.
  const leftPart = lp.width - t - Math.floor(t / 2);
  const known = new Set(l.design.materials.map((m) => m.id));
  const materials: Material[] = [
    ...l.design.materials,
    ...r.design.materials.filter((m) => !known.has(m.id)),
  ].map((m) => structuredClone(m));
  const now = new Date().toISOString();
  const params: CabinetParams = {
    ...structuredClone(lp),
    width,
    interior: {
      id: newId(),
      kind: 'split',
      axis: 'x',
      sizes: [mm(leftPart), fr()],
      front: null,
      children: [structuredClone(lp.interior), structuredClone(rp.interior)],
    },
  };
  const design: Design = {
    schemaVersion: SCHEMA_VERSION,
    id: newId(),
    name: `${l.design.name} + ${r.design.name}`,
    createdAt: now,
    updatedAt: now,
    materials,
    product: { kind: 'cabinet', id: newId(), params },
    ...(l.design.cutting ? { cutting: { ...l.design.cutting } } : {}),
    ...(l.design.settings ? { settings: structuredClone(l.design.settings) } : {}),
  };
  const lb = placeItem(l).bounds,
    rb = placeItem(r).bounds;
  const position = { x: Math.min(lb.x, rb.x), y: Math.min(lb.y, rb.y), z: Math.min(lb.z, rb.z) };
  let placement = l.placement;
  if (l.placement?.kind === 'above' && r.placement?.kind === 'above')
    placement = { ...l.placement, offsetX: Math.min(l.placement.offsetX, r.placement.offsetX) };
  const merged: ProjectItem = {
    id: newId(),
    design,
    quantity: l.quantity,
    position,
    rotationY: l.rotationY,
    ...(placement ? { placement } : {}),
    // A lock on either piece stays on the merged one (ADR-095): merging never frees a locked piece.
    ...(l.locked || r.locked ? { locked: true as const } : {}),
  };
  const items = project.items.flatMap((i) => {
    if (i.id === r.id) return [];
    if (i.id === l.id) return [merged];
    // A piece on either now rests on the merged one, at the same place in the room.
    if (
      i.placement?.kind === 'above' &&
      (i.placement.baseId === l.id || i.placement.baseId === r.id)
    ) {
      const was = i.placement.baseId === l.id ? lb : rb;
      return [
        {
          ...i,
          placement: {
            ...i.placement,
            baseId: merged.id,
            offsetX: i.placement.offsetX + was.x - position.x,
          },
        },
      ];
    }
    return [i];
  });
  return { project: { ...project, items }, mergedId: merged.id, issues: [] };
}
