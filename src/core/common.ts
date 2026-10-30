/**
 * A common top or bottom across touching items in a row (ADR-165): one panel replaces the members' own tops (or
 * bottoms). While linked, each member is built with its top over the sides (bottom under the sides), its own setting
 * kept; the common panel takes the leftmost member's top (bottom) board. A link that no longer fits is not built and
 * warned about, and the members get their own panels back.
 */
import { t } from './i18n';
import { union } from './geometry';
import { placeItem, type CommonPanel, type PlacedPiece, type Project } from './project';
import type { Box, Design, Diagnostic, Face, Panel } from './types';

export type CommonKind = CommonPanel['kind'];

/** How a member is built while it is in a common top and/or bottom. */
export interface CommonBuild {
  top?: boolean;
  bottom?: boolean;
  /** Layers of the common top: 2 when every member has a doubled top (ADR-105), else 1. */
  layers?: 1 | 2;
}

/** The design a member is built from while linked: top over the sides, bottom under them, a full panel top. */
export function commonDesign(d: Design, c: CommonBuild): Design {
  const p = d.product;
  if (p.kind !== 'cabinet' || (!c.top && !c.bottom)) return d;
  return {
    ...d,
    product: {
      ...p,
      params: {
        ...p.params,
        ...(c.top
          ? { top: 'over' as const, topKind: 'panel' as const, topLayers: c.layers ?? 1 }
          : {}),
        ...(c.bottom ? { bottom: 'under' as const } : {}),
      },
    },
  };
}

/** The members of a common panel, left to right along their row (their own width axis). */
function ordered(pieces: PlacedPiece[]): PlacedPiece[] {
  const r = pieces[0].item.rotationY;
  const along = (pc: PlacedPiece) =>
    r === 0
      ? pc.bounds.x
      : r === 180
        ? -(pc.bounds.x + pc.bounds.w)
        : r === 90
          ? pc.bounds.z
          : -(pc.bounds.z + pc.bounds.d);
  return [...pieces].sort((a, b) => along(a) - along(b));
}

const sameRange = (a: Box, b: Box, axis: 'x' | 'z') =>
  axis === 'x' ? a.x === b.x && a.w === b.w : a.z === b.z && a.d === b.d;

export interface CommonPlan {
  /** Why the members cannot share one panel, or null. */
  reason: string | null;
  layers: 1 | 2;
  /** Members, left to right. */
  ids: string[];
}

/**
 * Can these items share one top (bottom)? Every one a cabinet, the same quarter turn and no extra angle, the same
 * height, depth, plinth and floor level, standing side by side with no gap. Never throws.
 */
export function commonPanelCheck(
  project: Project,
  itemIds: readonly string[],
  kind: CommonKind,
): CommonPlan {
  const items = itemIds.map((id) => project.items.find((i) => i.id === id));
  const fail = (reason: string): CommonPlan => ({ reason, layers: 1, ids: [...itemIds] });
  if (items.length < 2) return fail(t('Select two or more items standing side by side.'));
  if (items.some((i) => !i)) return fail(t('An item of this common panel was removed.'));
  for (const it of items) {
    if (it!.design.product.kind !== 'cabinet')
      return fail(t('{name} is not a cabinet.', { name: it!.design.name }));
    if (it!.quantity !== 1)
      return fail(t('{name} is counted more than once.', { name: it!.design.name }));
  }
  const r = items[0]!.rotationY;
  if (items.some((i) => i!.rotationY !== r || (i!.angle ?? 0) !== 0))
    return fail(t('The items are not turned the same way.'));
  const placed = items.map((i) => placeItem(i!));
  const along: 'x' | 'z' = r === 0 || r === 180 ? 'x' : 'z';
  const across: 'x' | 'z' = along === 'x' ? 'z' : 'x';
  const b0 = placed[0].bounds;
  for (const pc of placed) {
    const b = pc.bounds;
    if (b.y !== b0.y || b.h !== b0.h)
      return fail(
        t('{name} is not the same height or floor level.', { name: pc.item.design.name }),
      );
    if (!sameRange(b, b0, across))
      return fail(t('{name} is not the same depth or not in line.', { name: pc.item.design.name }));
    const p = pc.item.design.product;
    const p0 = placed[0].item.design.product;
    if (p.kind === 'cabinet' && p0.kind === 'cabinet') {
      const ph = (q: typeof p.params) => (q.mount === 'wall' ? 0 : q.plinthHeight);
      if (ph(p.params) !== ph(p0.params))
        return fail(t('{name} has another plinth height.', { name: pc.item.design.name }));
      if (p.params.back !== p0.params.back)
        return fail(t('{name} has another back.', { name: pc.item.design.name }));
    }
  }
  const row = ordered(placed);
  for (let i = 1; i < row.length; i++) {
    const a = row[i - 1].bounds,
      b = row[i].bounds;
    const touching =
      along === 'x'
        ? a.x + a.w === b.x || b.x + b.w === a.x
        : a.z + a.d === b.z || b.z + b.d === a.z;
    if (!touching)
      return fail(
        t('{a} and {b} do not touch.', {
          a: row[i - 1].item.design.name,
          b: row[i].item.design.name,
        }),
      );
  }
  const doubled = (d: Design) => d.product.kind === 'cabinet' && d.product.params.topLayers === 2;
  const layers = kind === 'top' && row.every((pc) => doubled(pc.item.design)) ? 2 : 1;
  return { reason: null, layers, ids: row.map((pc) => pc.item.id) };
}

/** Keep only items still in the project; a common panel left with fewer than two goes. Same object when unchanged. */
export function pruneCommon(project: Project): Project {
  if (!project.common) return project;
  const ids = new Set(project.items.map((i) => i.id));
  const was = project.common;
  const common = was
    .map((c) => ({ ...c, itemIds: c.itemIds.filter((x) => ids.has(x)) }))
    .filter((c) => c.itemIds.length >= 2);
  const same =
    common.length === was.length &&
    common.every((c, i) => c.itemIds.length === was[i].itemIds.length);
  if (same) return project;
  const { common: _gone, ...rest } = project;
  void _gone;
  return common.length ? { ...rest, common } : rest;
}

/** How each item is built (by id), and the warnings for links that are not built. */
export function commonBuilds(project: Project): {
  builds: Map<string, CommonBuild>;
  plans: Map<string, CommonPlan>;
  diagnostics: Diagnostic[];
} {
  const builds = new Map<string, CommonBuild>();
  const plans = new Map<string, CommonPlan>();
  const diagnostics: Diagnostic[] = [];
  for (const c of project.common ?? []) {
    const plan = commonPanelCheck(project, c.itemIds, c.kind);
    if (plan.reason) {
      diagnostics.push({
        severity: 'warning',
        code: 'common-panel-broken',
        message: t('The common {kind} is not built: {reason} The items keep their own.', {
          kind: c.kind === 'top' ? t('top@@role') : t('bottom@@role'),
          reason: plan.reason,
        }),
        nodeId: `common:${c.id}`,
        itemIds: [...c.itemIds],
      });
      continue;
    }
    plans.set(c.id, plan);
    if (c.kind === 'top' && plan.layers === 1) {
      const doubled = c.itemIds.some((id) => {
        const p = project.items.find((i) => i.id === id)?.design.product;
        return p?.kind === 'cabinet' && p.params.topLayers === 2;
      });
      if (doubled)
        diagnostics.push({
          severity: 'warning',
          code: 'common-top-layers',
          message: t(
            'Some items under the common top have a doubled top and some do not; the common top is single.',
          ),
          nodeId: `common:${c.id}`,
          itemIds: [...c.itemIds],
        });
    }
    for (const id of plan.ids) {
      const b = builds.get(id) ?? {};
      builds.set(
        id,
        c.kind === 'top' ? { ...b, top: true, layers: plan.layers } : { ...b, bottom: true },
      );
    }
  }
  return { builds, plans, diagnostics };
}

/**
 * The common panels in room coordinates, from the members' own tops (bottoms) as built while linked (`removed`, by
 * item id): one panel per layer spanning the row, on the leftmost member's board (as a merged material key).
 */
export function commonPanels(
  project: Project,
  plans: Map<string, CommonPlan>,
  removed: Map<string, Panel[]>,
  keyOf: (itemId: string, materialId: string) => string,
): Panel[] {
  const out: Panel[] = [];
  for (const c of project.common ?? []) {
    const plan = plans.get(c.id);
    if (!plan) continue;
    for (let layer = 0; layer < plan.layers; layer++) {
      const parts = plan.ids
        .map((id) => ({ id, p: (removed.get(id) ?? []).filter((q) => q.role === c.kind)[layer] }))
        .filter((x): x is { id: string; p: Panel } => !!x.p);
      if (parts.length !== plan.ids.length) continue;
      const first = parts[0];
      const banded = [...new Set(parts.flatMap((x) => x.p.banded))] as Face[];
      out.push({
        id: `common:${c.id}${layer ? `/${layer}` : ''}`,
        nodeId: `common:${c.id}`,
        role: c.kind,
        label: c.kind === 'top' ? 'Common top' : 'Common bottom',
        materialId: keyOf(first.id, first.p.materialId),
        box: union(parts.map((x) => x.p.box)),
        thicknessAxis: first.p.thicknessAxis,
        grainAxis: first.p.grainAxis,
        banded,
      });
    }
  }
  return out;
}
