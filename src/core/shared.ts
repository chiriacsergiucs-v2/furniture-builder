/**
 * Neighbours share one side panel (ADR-190): of two touching cabinets the left one leaves out its right side and the
 * right one's left side serves both; outside sizes and places stay. Fronts meet over the middle of the shared side,
 * and the shared side carries shelf-pin rows on both faces. A link that no longer fits is not built and warned about.
 *
 * ADR-207 extends it: a blind corner unit shares a side at its straight end (the end away from its blind section) as
 * a cabinet does, and a desk shares a gable end with a cabinet: a gable stops under the worktop, so the cabinet's side
 * is always the one kept and the desk leaves its gable out. L-shape and diagonal corners, pedestal ends and two desks
 * are refused with the reason.
 */
import { t, tr } from './i18n';
import { placeItem, type Project, type ProjectItem, type SharedSides } from './project';
import type { Design, Diagnostic, Panel, PinRows } from './types';

/** How a member is built while it shares a side. */
export interface SharedBuild {
  left?: boolean;
  right?: boolean;
  /** A desk (ADR-207): the gables it leaves out, the cabinet's side serving. */
  gable?: { left?: boolean; right?: boolean };
}

/** The design a member is built from while it shares a side (in memory only, never saved). */
export function sharedDesign(d: Design, s: SharedBuild | undefined): Design {
  const p = d.product;
  if (!s) return d;
  if (p.kind === 'desk' && (s.gable?.left || s.gable?.right))
    return { ...d, product: { ...p, params: { ...p.params, omitGable: { ...s.gable } } } };
  if (!s.left && !s.right) return d;
  const sides = { ...(s.left ? { left: true } : {}), ...(s.right ? { right: true } : {}) };
  if (p.kind === 'cabinet')
    return { ...d, product: { ...p, params: { ...p.params, shared: sides } } };
  if (p.kind === 'corner' && p.params.variant === 'blind')
    return { ...d, product: { ...p, params: { ...p.params, shared: sides } } };
  return d;
}

/** What a member is to the shared-side rules (ADR-190, ADR-207). */
interface Member {
  kind: 'cabinet' | 'corner' | 'desk';
  height: number;
  /** The carcass depth (a desk: its gable depth). */
  depth: number;
  /** A desk stands on its gables: plinth 0. */
  plinth: number;
  /** A desk has no back to compare. */
  back?: string;
  bodyMaterialId: string;
  /** A blind corner's blind end. */
  blindAt?: 'left' | 'right';
  /** A desk's pedestal ends. */
  pedestal?: { left: boolean; right: boolean };
}

/** The member, or why the piece cannot share a side. */
function memberOf(it: ProjectItem): Member | string {
  const p = it.design.product;
  const name = tr(it.design.name);
  if (p.kind === 'cabinet') {
    const q = p.params;
    return {
      kind: 'cabinet',
      height: q.height,
      depth: q.depth,
      plinth: q.mount === 'wall' ? 0 : q.plinthHeight,
      back: q.back,
      bodyMaterialId: q.bodyMaterialId,
    };
  }
  if (p.kind === 'corner') {
    const q = p.params;
    if (q.variant !== 'blind')
      return t('{name} is an L-shape or diagonal corner unit; only a blind corner shares a side.', {
        name,
      });
    return {
      kind: 'corner',
      height: q.height,
      depth: q.depth,
      plinth: q.mount === 'wall' ? 0 : q.plinthHeight,
      back: q.back,
      bodyMaterialId: q.bodyMaterialId,
      blindAt: q.side,
    };
  }
  if (p.kind === 'desk') {
    const q = p.params;
    return {
      kind: 'desk',
      height: q.height,
      depth: q.depth - q.frontOverhang,
      plinth: 0,
      bodyMaterialId: q.bodyMaterialId,
      pedestal: {
        left: q.support === 'pedestal-left' || q.support === 'two-pedestals',
        right: q.support === 'pedestal-right' || q.support === 'two-pedestals',
      },
    };
  }
  return t('{name} is not a cabinet, a blind corner unit or a desk.', { name });
}

interface SharedPlan {
  reason: string | null;
  /** Members, left to right in their own frame. */
  ids: string[];
}

/**
 * Can these cabinets share their sides? Cabinets, counted once, turned the same way with no extra angle, the same
 * height, depth, plinth, back and side board thickness, standing in line and touching with no gap. Never throws.
 */
export function sharedSideCheck(project: Project, itemIds: readonly string[]): SharedPlan {
  const items = itemIds.map((id) => project.items.find((i) => i.id === id));
  const fail = (reason: string): SharedPlan => ({ reason, ids: [...itemIds] });
  if (items.length < 2) return fail(t('Select two or more items standing side by side.'));
  if (items.some((i) => !i)) return fail(t('An item of these shared sides was removed.'));
  const members = new Map<string, Member>();
  for (const it of items) {
    const name = tr(it!.design.name);
    const m = memberOf(it!);
    if (typeof m === 'string') return fail(m);
    members.set(it!.id, m);
    if (it!.quantity !== 1) return fail(t('{name} is counted more than once.', { name }));
  }
  const r = items[0]!.rotationY;
  if (items.some((i) => i!.rotationY !== r || (i!.angle ?? 0) !== 0))
    return fail(t('The items are not turned the same way.'));
  const m0 = members.get(items[0]!.id)!;
  const backOf = items.map((i) => members.get(i!.id)!).find((m) => m.back !== undefined)?.back;
  const thick = (it: ProjectItem) =>
    it.design.materials.find((m) => m.id === members.get(it.id)!.bodyMaterialId)?.thickness;
  for (const it of items) {
    const p = members.get(it!.id)!;
    const name = tr(it!.design.name);
    if (p.height !== m0.height)
      return fail(t('{name} is not the same height or floor level.', { name }));
    if (p.depth !== m0.depth)
      return fail(t('{name} is not the same depth or not in line.', { name }));
    if (p.plinth !== m0.plinth) return fail(t('{name} has another plinth height.', { name }));
    if (p.back !== undefined && p.back !== backOf)
      return fail(t('{name} has another back.', { name }));
    if (thick(it!) !== thick(items[0]!))
      return fail(t('{name} has sides of another thickness.', { name }));
  }
  const placed = items.map((i) => placeItem(i!));
  const alongX = r === 0 || r === 180;
  const at = (b: { x: number; z: number; w: number; d: number }) =>
    r === 0 ? b.x : r === 180 ? -(b.x + b.w) : r === 90 ? b.z : -(b.z + b.d);
  // The outline without the fronts: the carcass's own box, from its sides (a desk's gables and pedestal sides).
  const carcass = placed.map((pc) => {
    const sides = pc.panels.filter((q) => q.role === 'side' || q.role === 'gable');
    const xs = sides.flatMap((q) => [q.box.x, q.box.x + q.box.w]),
      zs = sides.flatMap((q) => [q.box.z, q.box.z + q.box.d]);
    return {
      pc,
      b: {
        x: Math.min(...xs),
        z: Math.min(...zs),
        w: Math.max(...xs) - Math.min(...xs),
        d: Math.max(...zs) - Math.min(...zs),
      },
    };
  });
  const row = [...carcass].sort((a, b) => at(a.b) - at(b.b));
  for (let i = 1; i < row.length; i++) {
    const a = row[i - 1].b,
      b = row[i].b;
    const inLine = alongX ? a.z === b.z && a.d === b.d : a.x === b.x && a.w === b.w;
    const touching = alongX
      ? a.x + a.w === b.x || b.x + b.w === a.x
      : a.z + a.d === b.z || b.z + b.d === a.z;
    if (!inLine || !touching)
      return fail(
        t('{a} and {b} do not touch.', {
          a: tr(row[i - 1].pc.item.design.name),
          b: tr(row[i].pc.item.design.name),
        }),
      );
    // ADR-207: the ends that meet. A blind corner only at its straight end; a desk only at a gable end; two desks
    // never (a gable cannot carry the other desk's worktop).
    const left = row[i - 1].pc.item,
      right = row[i].pc.item;
    const ml = members.get(left.id)!,
      mr = members.get(right.id)!;
    if (ml.kind === 'desk' && mr.kind === 'desk')
      return fail(
        t('{a} and {b} are both desks; a desk shares a side only with a cabinet.', {
          a: tr(left.design.name),
          b: tr(right.design.name),
        }),
      );
    const ends: [ProjectItem, Member, 'left' | 'right'][] = [
      [left, ml, 'right'],
      [right, mr, 'left'],
    ];
    for (const [it, m, end] of ends) {
      const name = tr(it.design.name);
      if (m.kind === 'corner' && m.blindAt === end)
        return fail(
          t('{name} meets its neighbour at its blind end; only its straight end shares a side.', {
            name,
          }),
        );
      if (m.kind === 'desk' && m.pedestal?.[end])
        return fail(
          t('{name} has a pedestal at that end; only a gable end shares a side.', { name }),
        );
    }
  }
  return { reason: null, ids: row.map((x) => x.pc.item.id) };
}

/** Keep only items still in the project; a list left with fewer than two goes. Same object when unchanged. */
export function pruneShared(project: Project): Project {
  if (!project.sharedSides) return project;
  const ids = new Set(project.items.map((i) => i.id));
  const was = project.sharedSides;
  const next: SharedSides[] = was
    .map((c) => ({ ...c, itemIds: c.itemIds.filter((x) => ids.has(x)) }))
    .filter((c) => c.itemIds.length >= 2);
  const same =
    next.length === was.length && next.every((c, i) => c.itemIds.length === was[i].itemIds.length);
  if (same) return project;
  const { sharedSides: _gone, ...rest } = project;
  void _gone;
  return next.length ? { ...rest, sharedSides: next } : rest;
}

/**
 * How each item is built (by id), the pin rows each right-hand member's left side gets from its left neighbour
 * (local to that side, face `-x`), and the warnings for links that are not built.
 */
export function sharedBuilds(project: Project): {
  builds: Map<string, SharedBuild>;
  pins: Map<string, PinRows[]>;
  diagnostics: Diagnostic[];
} {
  const builds = new Map<string, SharedBuild>();
  const pins = new Map<string, PinRows[]>();
  const diagnostics: Diagnostic[] = [];
  for (const s of project.sharedSides ?? []) {
    const plan = sharedSideCheck(project, s.itemIds);
    if (plan.reason) {
      diagnostics.push({
        severity: 'warning',
        code: 'shared-side-broken',
        message: t('The shared sides are not built: {reason} The items keep both their sides.', {
          reason: plan.reason,
        }),
        nodeId: `shared:${s.id}`,
        itemIds: [...s.itemIds],
      });
      continue;
    }
    const kindOf = (id: string) => project.items.find((x) => x.id === id)?.design.product.kind;
    plan.ids.forEach((id, i) => {
      const b = builds.get(id) ?? {};
      const leftDesk = i > 0 && kindOf(plan.ids[i - 1]) === 'desk';
      const rightDesk = i < plan.ids.length - 1 && kindOf(plan.ids[i + 1]) === 'desk';
      // Beside a desk the cabinet keeps its side and the desk leaves its gable out (ADR-207).
      if (kindOf(id) === 'desk') {
        builds.set(id, {
          ...b,
          gable: {
            ...b.gable,
            ...(i > 0 ? { left: true } : {}),
            ...(i < plan.ids.length - 1 ? { right: true } : {}),
          },
        });
        return;
      }
      builds.set(id, {
        ...b,
        ...(i > 0 && !leftDesk ? { left: true } : {}),
        ...(i < plan.ids.length - 1 && !rightDesk ? { right: true } : {}),
      });
    });
  }
  // The rows each left member needs on its right neighbour's left side.
  for (const s of project.sharedSides ?? []) {
    const plan = sharedSideCheck(project, s.itemIds);
    if (plan.reason) continue;
    for (let i = 0; i + 1 < plan.ids.length; i++) {
      const left = project.items.find((x) => x.id === plan.ids[i])!;
      const rows = placeItem(left, { shared: builds.get(left.id) }).model.sharedPins;
      if (rows?.length) pins.set(plan.ids[i + 1], [...(pins.get(plan.ids[i + 1]) ?? []), ...rows]);
    }
  }
  return { builds, pins, diagnostics };
}

/**
 * A member's left side with the pin rows its left neighbour needs on it (local panels, before placing): its leftmost
 * side (a cabinet's left side, a mirrored blind corner's straight-end side, ADR-207).
 */
export function withSharedPins(panels: Panel[], rows: PinRows[] | undefined): Panel[] {
  if (!rows?.length) return panels;
  const sides = panels.filter((p) => p.role === 'side');
  if (!sides.length) return panels;
  const x0 = Math.min(...sides.map((p) => p.box.x));
  const target = sides.find((p) => p.box.x === x0)!;
  return panels.map((p) => (p === target ? { ...p, pinRows: [...(p.pinRows ?? []), ...rows] } : p));
}
