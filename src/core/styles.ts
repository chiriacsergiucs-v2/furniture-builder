/**
 * Style suggestions (ADR-123, research "style/material recommendations"): a front board, a carcass board and a handle
 * kind, applied together through finish scope (ADR-055). Offline and rule-based (no remote AI, ADR-002). Built-in
 * styles use only the shipped board list (`defaultMaterials`) and the ADR-024 handle kinds; the user's own styles
 * are the combinations counted on the pieces of their saved projects. Taste, not physical facts: shown as
 * suggestions. Pure.
 */
import { defaultMaterials, mapProductSpace, productRoots } from './design';
import { applyFinish, finishTargets, roleBoard, type FinishScope } from './finish';
import { materialKey, type Project } from './project';
import type { Design, Handle, Material, Product, Space } from './types';

export type HandleKind = Handle['kind'];

export interface Style {
  id: string;
  name: string;
  front: Material;
  body: Material;
  /** The handle kind put on fronts that already have a handle; null leaves handles as they are. */
  handle: HandleKind | null;
  source: 'built-in' | 'yours';
  /** Yours: on how many pieces of your saved projects the combination is used. */
  uses?: number;
}

export const HANDLE_NAMES: Record<HandleKind, string> = {
  bar: 'bar handles',
  knob: 'knobs',
  push: 'push-to-open',
};

/** Built-in styles: combinations of the shipped boards and handle kinds only (ADR-010: nothing invented). */
export function builtInStyles(): Style[] {
  const m = new Map(defaultMaterials().map((x) => [x.id, x]));
  const s = (
    id: string,
    name: string,
    front: string,
    body: string,
    handle: HandleKind | null,
  ): Style => ({ id, name, front: m.get(front)!, body: m.get(body)!, handle, source: 'built-in' });
  return [
    s('white', 'All white', 'pal18', 'pal18', 'bar'),
    s('oak-fronts', 'Oak fronts, white carcass', 'pal18oak', 'pal18', 'bar'),
    s('all-oak', 'All oak', 'pal18oak', 'pal18oak', 'knob'),
    s('painted', 'Painted fronts, handle-free', 'mdf18', 'pal18', 'push'),
    s('white-free', 'White, handle-free', 'pal18', 'pal18', 'push'),
  ];
}

/** Every space of a product (all roots, all levels). */
function spacesOf(prod: Product): Space[] {
  const out: Space[] = [];
  const walk = (s: Space) => {
    out.push(s);
    if (s.kind === 'split') s.children.forEach(walk);
  };
  for (const r of productRoots(prod)) walk(r.root);
  return out;
}

/** The handle kind most fronts of the design use, or null when none has a handle. */
export function handleKindOf(d: Design): HandleKind | null {
  const count = new Map<HandleKind, number>();
  const add = (h: Handle | null | undefined) => {
    if (h) count.set(h.kind, (count.get(h.kind) ?? 0) + 1);
  };
  for (const s of spacesOf(d.product)) add(s.handle);
  if (d.product.kind === 'panel') add(d.product.params.handle);
  let best: HandleKind | null = null;
  for (const [k, n] of count) if (best === null || n > count.get(best)!) best = k;
  return best;
}

/** The design with `kind` on every handle it has; fronts without a handle keep none. */
export function withHandleKind(d: Design, kind: HandleKind): Design {
  let product = d.product;
  for (const s of spacesOf(product))
    if (s.handle && s.handle.kind !== kind)
      product = mapProductSpace(product, s.id, (x) => ({ ...x, handle: { ...x.handle!, kind } }));
  if (product.kind === 'panel' && product.params.handle && product.params.handle.kind !== kind)
    product = { ...product, params: { ...product.params, handle: { ...product.params.handle, kind } } };
  return product === d.product ? d : { ...d, product };
}

/**
 * The user's own styles: front board + carcass board + handle kind as used on the pieces of `projects`, most used
 * first, at most `max`, leaving out ones equal to a built-in style.
 */
export function yourStyles(projects: readonly Project[], max = 5): Style[] {
  const seen = new Map<string, Style>();
  const builtIn = new Set(builtInStyles().map(styleKey));
  for (const p of projects)
    for (const it of p.items) {
      const d = it.design;
      const f = roleBoard(d, 'front'),
        b = roleBoard(d, 'body');
      const front = d.materials.find((x) => x.id === f);
      const body = d.materials.find((x) => x.id === b);
      if (!front || !body) continue;
      const draft: Style = {
        id: '',
        name: '',
        front,
        body,
        handle: handleKindOf(d),
        source: 'yours',
      };
      const key = styleKey(draft);
      if (builtIn.has(key)) continue;
      const had = seen.get(key);
      if (had) had.uses = (had.uses ?? 0) + it.quantity;
      else
        seen.set(key, {
          ...draft,
          id: `yours:${key}`,
          name: `${front.name} fronts, ${body.name} carcass${draft.handle ? `, ${HANDLE_NAMES[draft.handle]}` : ''}`,
          uses: it.quantity,
        });
    }
  return [...seen.values()]
    .sort((a, b) => (b.uses ?? 0) - (a.uses ?? 0) || a.name.localeCompare(b.name))
    .slice(0, max);
}

const styleKey = (s: Pick<Style, 'front' | 'body' | 'handle'>) =>
  `${materialKey(s.front)}|${materialKey(s.body)}|${s.handle ?? '-'}`;

export interface StyleResult {
  project: Project;
  /** Names of the pieces the style changed. */
  applied: string[];
  skipped: string[];
}

/** Put `style` on the pieces `scope` reaches from piece `id` (ADR-055 finish scope): fronts, carcass, handles. */
export function applyStyle(
  project: Project,
  id: string,
  style: Style,
  scope: FinishScope,
  selection?: readonly string[],
): StyleResult {
  const fronts = applyFinish(project, id, 'front', style.front, scope, selection);
  const bodies = applyFinish(fronts.project, id, 'body', style.body, scope, selection);
  let next = bodies.project;
  if (style.handle) {
    const targets = new Set(finishTargets(next, id, scope, selection).map((i) => i.id));
    const kind = style.handle;
    next = {
      ...next,
      items: next.items.map((it) => {
        if (!targets.has(it.id)) return it;
        const design = withHandleKind(it.design, kind);
        return design === it.design ? it : { ...it, design };
      }),
    };
  }
  const changed = new Set(next.items.filter((it, i) => it !== project.items[i]).map((i) => i.id));
  const targets = finishTargets(project, id, scope, selection);
  return {
    project: changed.size ? next : project,
    applied: targets.filter((i) => changed.has(i.id)).map((i) => i.design.name),
    skipped: targets
      .filter((i) => !changed.has(i.id))
      .map((i) => `${i.design.name} has no fronts or carcass`),
  };
}
