/**
 * Neighbours share one side panel (ADR-170): of two touching cabinets the left one leaves out its right side and the
 * right one's left side serves both; outside sizes and places stay. Fronts meet over the middle of the shared side,
 * and the shared side carries shelf-pin rows on both faces. A link that no longer fits is not built and warned about.
 */
import { t } from './i18n';
import { placeItem, type Project, type SharedSides } from './project';
import type { Design, Diagnostic, Panel, PinRows } from './types';

/** How a member is built while it shares a side. */
export interface SharedBuild {
  left?: boolean;
  right?: boolean;
}

/** The design a member is built from while it shares a side (in memory only, never saved). */
export function sharedDesign(d: Design, s: SharedBuild | undefined): Design {
  const p = d.product;
  if (!s || p.kind !== 'cabinet' || (!s.left && !s.right)) return d;
  return { ...d, product: { ...p, params: { ...p.params, shared: { ...s } } } };
}

export interface SharedPlan {
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
  for (const it of items) {
    const name = it!.design.name;
    if (it!.design.product.kind !== 'cabinet') return fail(t('{name} is not a cabinet.', { name }));
    if (it!.quantity !== 1) return fail(t('{name} is counted more than once.', { name }));
  }
  const r = items[0]!.rotationY;
  if (items.some((i) => i!.rotationY !== r || (i!.angle ?? 0) !== 0))
    return fail(t('The items are not turned the same way.'));
  const params = (i: (typeof items)[number]) =>
    i!.design.product.kind === 'cabinet' ? i!.design.product.params : null;
  const p0 = params(items[0])!;
  const thick = (i: (typeof items)[number]) =>
    i!.design.materials.find((m) => m.id === params(i)!.bodyMaterialId)?.thickness;
  for (const it of items) {
    const p = params(it)!;
    const name = it!.design.name;
    const ph = (q: typeof p) => (q.mount === 'wall' ? 0 : q.plinthHeight);
    if (p.height !== p0.height)
      return fail(t('{name} is not the same height or floor level.', { name }));
    if (p.depth !== p0.depth)
      return fail(t('{name} is not the same depth or not in line.', { name }));
    if (ph(p) !== ph(p0)) return fail(t('{name} has another plinth height.', { name }));
    if (p.back !== p0.back) return fail(t('{name} has another back.', { name }));
    if (thick(it) !== thick(items[0]))
      return fail(t('{name} has sides of another thickness.', { name }));
  }
  const placed = items.map((i) => placeItem(i!));
  const alongX = r === 0 || r === 180;
  const at = (b: { x: number; z: number; w: number; d: number }) =>
    r === 0 ? b.x : r === 180 ? -(b.x + b.w) : r === 90 ? b.z : -(b.z + b.d);
  // The outline without the fronts: the carcass's own box, from its sides.
  const carcass = placed.map((pc) => {
    const sides = pc.panels.filter((q) => q.role === 'side');
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
          a: row[i - 1].pc.item.design.name,
          b: row[i].pc.item.design.name,
        }),
      );
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
    plan.ids.forEach((id, i) => {
      const b = builds.get(id) ?? {};
      builds.set(id, {
        ...b,
        ...(i > 0 ? { left: true } : {}),
        ...(i < plan.ids.length - 1 ? { right: true } : {}),
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

/** A member's left side with the pin rows its left neighbour needs on it (local panels, before placing). */
export function withSharedPins(panels: Panel[], rows: PinRows[] | undefined): Panel[] {
  if (!rows?.length) return panels;
  return panels.map((p) =>
    p.role === 'side' && p.label === 'Left side'
      ? { ...p, pinRows: [...(p.pinRows ?? []), ...rows] }
      : p,
  );
}
