/**
 * A common top or bottom across items in a row (ADR-165), across gaps and over corner units and desks (ADR-169): one
 * panel replaces the members' own tops (or bottoms). While linked, each member is built with its top over the sides (bottom under the sides), its own setting
 * kept; the common panel takes the leftmost member's top (bottom) board. A link that no longer fits is not built and
 * warned about, and the members get their own panels back.
 */
import { t } from './i18n';
import { bounds2, footprint, isRect, rectOf, sharedLength, unionOutline, type Pt } from './outline';
import { placeItem, type CommonPanel, type Project } from './project';
import type { Design, Diagnostic, Face, Panel } from './types';

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
  if (!c.top && !c.bottom) return d;
  if (p.kind === 'corner')
    return {
      ...d,
      product: {
        ...p,
        params: {
          ...p.params,
          ...(c.top ? { topLayers: c.layers ?? 1 } : {}),
          join: { ...(c.top ? { top: true } : {}), ...(c.bottom ? { bottom: true } : {}) },
        },
      },
    };
  if (p.kind !== 'cabinet') return d;
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

/** The part a common top replaces: a desk's worktop (its pedestals keep their tops), else the top (ADR-169). */
export const commonTopRole = (d: Design): Panel['role'] =>
  d.product.kind === 'desk' ? 'worktop' : 'top';

/**
 * A member's replaced parts by layer: the top layer first (a doubled top, ADR-105, has two), all pieces of a layer
 * together (a blind or L corner has one per carcass).
 */
export function layersOf(removed: readonly Panel[], kind: CommonKind): Panel[][] {
  const ys = [...new Set(removed.map((p) => p.box.y))].sort((a, b) =>
    kind === 'top' ? b - a : a - b,
  );
  return ys.map((y) => removed.filter((p) => p.box.y === y));
}

/** A member's outline at one layer: its pieces joined. */
const outlineOf = (parts: readonly Panel[]): Pt[] | null =>
  parts.length === 1 ? footprint(parts[0]) : unionOutline(parts.map(footprint));

/** A gap a common panel bridges (ADR-169): its rectangle in plan and its width along the row. */
export interface CommonGap {
  rect: Pt[];
  width: number;
  between: [string, string];
}

export interface CommonPlan {
  /** Why the members cannot share one panel, or null. */
  reason: string | null;
  layers: 1 | 2;
  /** Members; the first gives the board. */
  ids: string[];
  gaps: CommonGap[];
}

const JOINS = new Set(['cabinet', 'corner', 'desk']);
const plinthOf = (d: Design): number | null => {
  const p = d.product;
  if (p.kind === 'cabinet') return p.params.mount === 'wall' ? 0 : p.params.plinthHeight;
  if (p.kind === 'corner') return p.params.plinthHeight;
  return null;
};
const backOf = (d: Design): string | null => {
  const p = d.product;
  return p.kind === 'cabinet' || p.kind === 'corner' ? p.params.back : null;
};
const doubled = (d: Design) =>
  (d.product.kind === 'cabinet' || d.product.kind === 'corner') && d.product.params.topLayers === 2;

/**
 * Can these items share one top (bottom)? Cabinets, corner units and desks (a desk has no bottom), each counted once,
 * no extra angle, the same plinth and back; their own tops (bottoms), built as while linked, at the same height and
 * thickness, forming one chain: each touches the next along a full side (a desk's front overhang aside), or stands in
 * line with it, turned the same way and as deep, across a gap the panel bridges (ADR-169). Never throws.
 */
export function commonPanelCheck(
  project: Project,
  itemIds: readonly string[],
  kind: CommonKind,
): CommonPlan {
  const items = itemIds.map((id) => project.items.find((i) => i.id === id));
  const fail = (reason: string): CommonPlan => ({ reason, layers: 1, ids: [...itemIds], gaps: [] });
  if (items.length < 2) return fail(t('Select two or more items standing side by side.'));
  if (items.some((i) => !i)) return fail(t('An item of this common panel was removed.'));
  for (const it of items) {
    const name = it!.design.name;
    if (!JOINS.has(it!.design.product.kind))
      return fail(t('{name} is not a cabinet, corner unit or desk.', { name }));
    if (kind === 'bottom' && it!.design.product.kind === 'desk')
      return fail(t('{name} has no bottom.', { name }));
    if (it!.quantity !== 1) return fail(t('{name} is counted more than once.', { name }));
    if ((it!.angle ?? 0) !== 0) return fail(t('The items are not turned the same way.'));
  }
  const p0 = plinthOf(items[0]!.design),
    b0 = backOf(items[0]!.design);
  for (const it of items) {
    const name = it!.design.name;
    const ph = plinthOf(it!.design),
      bk = backOf(it!.design);
    if (ph !== null && p0 !== null && ph !== p0)
      return fail(t('{name} has another plinth height.', { name }));
    if (bk !== null && b0 !== null && bk !== b0)
      return fail(t('{name} has another back.', { name }));
  }
  // The members' own tops (bottoms) as built while linked, in plan.
  const own = items.map((it) => {
    const pc = placeItem(it!, { common: kind === 'top' ? { top: true } : { bottom: true } });
    const layer = layersOf(pc.removed ?? [], kind)[0] ?? [];
    return { it: it!, pc, panel: layer[0], parts: layer };
  });
  for (const m of own)
    if (!m.panel)
      return fail(
        t('{name} has no {part}.', {
          name: m.it.design.name,
          part: kind === 'top' ? t('top@@role') : t('bottom@@role'),
        }),
      );
  const y0 = own[0].panel!.box.y,
    h0 = own[0].panel!.box.h;
  for (const m of own) {
    if (m.panel!.box.y !== y0)
      return fail(t('{name} is not the same height or floor level.', { name: m.it.design.name }));
    if (m.panel!.box.h !== h0)
      return fail(
        t('The {part} of {name} is another thickness.', {
          name: m.it.design.name,
          part: kind === 'top' ? t('top@@role') : t('bottom@@role'),
        }),
      );
  }
  const outlines = own.map((m) => outlineOf(m.parts));
  const broken = outlines.findIndex((o) => !o);
  if (broken >= 0) return fail(t('These items do not make one top without holes.'));
  const fp = outlines as Pt[][];
  const desk = own.map((m) => m.it.design.product.kind === 'desk');
  const rect = fp.map(isRect);
  // Links: touching along a full side (a desk's own side may run on past it), or in line across a gap.
  const n = own.length;
  const linked: boolean[][] = own.map(() => own.map(() => false));
  const gaps: CommonGap[] = [];
  for (let i = 0; i < n; i++)
    for (let j = i + 1; j < n; j++) {
      const len = sharedLength(fp[i], fp[j]);
      if (len > 0) {
        const fullSide = (k: number, other: number) => {
          if (desk[k]) return true;
          const b = bounds2(fp[k]),
            o = bounds2(fp[other]);
          // The side of a straight member that meets the other: its depth across the row.
          const meetsX = b.x + b.w === o.x || o.x + o.w === b.x;
          const side = meetsX ? b.d : b.w;
          return !rect[k] || len >= side;
        };
        if (!fullSide(i, j) || !fullSide(j, i))
          return fail(
            t('{name} is not the same depth or not in line.', {
              name: (rect[i] && !desk[i] ? own[i] : own[j]).it.design.name,
            }),
          );
        linked[i][j] = linked[j][i] = true;
        continue;
      }
      // In line across a gap: both plain, turned the same way, the same depth range, nothing in between.
      if (!rect[i] || !rect[j] || own[i].it.rotationY !== own[j].it.rotationY) continue;
      const a = bounds2(fp[i]),
        b = bounds2(fp[j]);
      const r = own[i].it.rotationY;
      const alongX = r === 0 || r === 180;
      const same = alongX ? a.z === b.z && a.d === b.d : a.x === b.x && a.w === b.w;
      if (!same) continue;
      const [lo, hi] = alongX
        ? a.x < b.x
          ? [a.x + a.w, b.x]
          : [b.x + b.w, a.x]
        : a.z < b.z
          ? [a.z + a.d, b.z]
          : [b.z + b.d, a.z];
      if (hi <= lo) continue;
      const between = own.some((_, k) => {
        if (k === i || k === j) return false;
        const c = bounds2(fp[k]);
        return alongX ? c.x < hi && c.x + c.w > lo : c.z < hi && c.z + c.d > lo;
      });
      if (between) continue;
      linked[i][j] = linked[j][i] = true;
      gaps.push({
        rect: alongX
          ? rectOf({ x: lo, z: a.z, w: hi - lo, d: a.d })
          : rectOf({ x: a.x, z: lo, w: a.w, d: hi - lo }),
        width: hi - lo,
        between: [own[i].it.id, own[j].it.id],
      });
    }
  // One chain: every member reached from the first.
  const seen = new Set([0]);
  const queue = [0];
  while (queue.length) {
    const k = queue.shift()!;
    for (let j = 0; j < n; j++)
      if (linked[k][j] && !seen.has(j)) {
        seen.add(j);
        queue.push(j);
      }
  }
  const away = own.findIndex((_, k) => !seen.has(k));
  if (away >= 0)
    return fail(
      t('{name} does not touch the others and is not in line with them.', {
        name: own[away].it.design.name,
      }),
    );
  if (!unionOutline([...fp, ...gaps.map((g) => g.rect)]))
    return fail(t('These items do not make one top without holes.'));
  // The board comes from the member furthest to the left (then to the back).
  const order = own
    .map((m, k) => ({ id: m.it.id, b: bounds2(fp[k]) }))
    .sort((a, b) => a.b.x - b.b.x || a.b.z - b.b.z)
    .map((x) => x.id);
  const layers = kind === 'top' && own.every((m) => doubled(m.it.design)) ? 2 : 1;
  return { reason: null, layers, ids: order, gaps };
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
    // A bridged gap is guidance only: nothing is said about loads (ADR-010).
    for (const g of plan.gaps)
      diagnostics.push({
        severity: 'warning',
        code: 'common-gap',
        message: t('The common {kind} spans a {n} mm gap with nothing under it.', {
          kind: c.kind === 'top' ? t('top@@role') : t('bottom@@role'),
          n: g.width,
        }),
        nodeId: `common:${c.id}`,
        itemIds: [...g.between],
      });
    if (c.kind === 'top' && plan.layers === 1) {
      const anyDoubled = c.itemIds.some((id) => {
        const d = project.items.find((i) => i.id === id)?.design;
        return !!d && doubled(d);
      });
      if (anyDoubled)
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
 * item id) and the gaps they bridge: one part per layer, a plain box for a straight row, else one shaped part (its
 * outline as a profile on its enclosing blank, ADR-040), on the first member's board (as a merged material key).
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
      const parts = plan.ids.flatMap((id) =>
        (layersOf(removed.get(id) ?? [], c.kind)[layer] ?? []).map((p) => ({ id, p })),
      );
      if (new Set(parts.map((x) => x.id)).size !== plan.ids.length) continue;
      const outline = unionOutline([
        ...parts.map((x) => footprint(x.p)),
        ...plan.gaps.map((g) => g.rect),
      ]);
      if (!outline) continue;
      const b = bounds2(outline);
      const first = parts[0];
      const banded = [...new Set(parts.flatMap((x) => x.p.banded))] as Face[];
      out.push({
        id: `common:${c.id}${layer ? `/${layer}` : ''}`,
        nodeId: `common:${c.id}`,
        role: c.kind,
        label: c.kind === 'top' ? 'Common top' : 'Common bottom',
        materialId: keyOf(first.id, first.p.materialId),
        box: { x: b.x, y: first.p.box.y, z: b.z, w: b.w, h: first.p.box.h, d: b.d },
        thicknessAxis: 'y',
        grainAxis: first.p.grainAxis,
        banded,
        ...(isRect(outline)
          ? {}
          : {
              shape: {
                kind: 'profile' as const,
                points: outline.map(([x, z]) => [x - b.x, z - b.z] as [number, number]),
              },
            }),
      });
    }
  }
  return out;
}
