import { t as tx } from '@furniture-builder/i18n';
import { productRoots } from './design';
import type { Design, Diagnostic, FurnitureModel, Mm, Product, Space, StaggerRule } from './types';

/**
 * Staggered rows (ADR-282): a stacked split whose rows are each divided side by side with spans taken from three
 * widths, the dividers of neighbouring rows not lining up. The rule, its seed and the rows the user keeps are saved;
 * the rows themselves are written into the design by `refreshStagger` (store commit) and checked by
 * `staggerDiagnostics`, independently of the generator (ADR-008).
 */

/** The three starting widths (user answer 2026-11-21: "20, 28, 36 cm"). */
export const DEFAULT_STAGGER_WIDTHS: [Mm, Mm, Mm] = [200, 280, 360];
/** Tries per row before giving up on a stagger, then on a fill. */
const TRIES = 200;

type Split = Extract<Space, { kind: 'split' }>;

/** Small seeded generator (mulberry32): the same seed gives the same layout on every device. */
export function seeded(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let r = Math.imul(a ^ (a >>> 15), 1 | a);
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

export const newSeed = (): number => Math.floor(Math.random() * 2 ** 31);

/** Left faces of the dividers of a row of spans, from the row's left edge. */
export function dividerPositions(spans: readonly Mm[], t: Mm): Mm[] {
  const out: Mm[] = [];
  let x = 0;
  for (let i = 0; i < spans.length - 1; i++) {
    x += spans[i];
    out.push(x);
    x += t;
  }
  return out;
}

/** Two dividers line up when their faces overlap (ADR-282). */
const linesUp = (a: readonly Mm[], b: readonly Mm[], t: Mm) =>
  a.some((x) => b.some((y) => Math.abs(x - y) < t));

/**
 * One random row: spans from the three widths, plus one span that takes the rest; that span stays within the
 * smallest and largest width (user answer 2026-11-21: "One span per row absorbs it"). The spans and the dividers
 * between them fill `inner` exactly. Null when no such row exists.
 */
function tryRow(widths: readonly Mm[], inner: Mm, t: Mm, rand: () => number): Mm[] | null {
  const lo = Math.min(...widths),
    hi = Math.max(...widths);
  const spans: Mm[] = [];
  let room = inner;
  while (room > hi) {
    const fits = widths.filter((w) => room - w - t >= lo);
    if (!fits.length) return null;
    const w = fits[Math.floor(rand() * fits.length)];
    spans.push(w);
    room -= w + t;
  }
  if (room < lo) return null;
  spans.splice(Math.floor(rand() * (spans.length + 1)), 0, room);
  return spans;
}

/**
 * Spans for every row, top to bottom. `kept[i]` is a row the user set by hand: left as it is, but its dividers
 * still count for its neighbours. A row comes back null when the widths cannot fill it, and `lined` when it had to
 * line up with a neighbour.
 */
export function staggerRows(
  rule: Pick<StaggerRule, 'widths' | 'seed'>,
  inner: Mm,
  t: Mm,
  kept: readonly (Mm[] | null)[],
): { spans: Mm[] | null; lined: boolean }[] {
  const rand = seeded(rule.seed);
  const out: { spans: Mm[] | null; lined: boolean }[] = [];
  for (let i = 0; i < kept.length; i++) {
    const own = kept[i];
    if (own) {
      out.push({ spans: own, lined: false });
      continue;
    }
    const above = out[i - 1]?.spans;
    const below = kept[i + 1];
    const avoid = [
      ...(above ? dividerPositions(above, t) : []),
      ...(below ? dividerPositions(below, t) : []),
    ];
    let first: Mm[] | null = null;
    let found: Mm[] | null = null;
    for (let k = 0; k < TRIES && !found; k++) {
      const row = tryRow(rule.widths, inner, t, rand);
      if (!row) continue;
      first ??= row;
      if (!linesUp(dividerPositions(row, t), avoid, t)) found = row;
    }
    out.push({ spans: found ?? first, lined: !found && !!first && avoid.length > 0 });
  }
  return out;
}

/** The fixed mm spans of a side-by-side row, or one span for an undivided row; null when not all fixed. */
export function rowSpans(row: Space, inner: Mm): Mm[] | null {
  if (row.kind !== 'split') return [inner];
  if (row.axis !== 'x' || !row.sizes.every((z) => z.mode === 'mm')) return null;
  return row.sizes.map((z) => z.value);
}

/** Write spans into a row, keeping the row's id and what is in each span; new spans are empty. */
function writeRow(row: Space, spans: Mm[]): Space {
  if (spans.length === 1) {
    if (row.kind !== 'split') return row;
    const { id, front, handle } = row;
    return { id, kind: 'empty', ...(front ? { front } : {}), ...(handle ? { handle } : {}) };
  }
  const old = row.kind === 'split' && row.axis === 'x' ? row.children : [row];
  const children = spans.map((_, j): Space =>
    j < old.length && old[j].id !== row.id ? old[j] : { id: `${row.id}-s${j + 1}`, kind: 'empty' },
  );
  // An undivided row's own contents go to its first span.
  if (row.kind !== 'split' && row.kind !== 'empty') {
    const { front: _f, handle: _h, ...inside } = row;
    void _f;
    void _h;
    children[0] = { ...inside, id: `${row.id}-s1` };
  }
  return {
    id: row.id,
    kind: 'split',
    axis: 'x',
    sizes: spans.map((value) => ({ mode: 'mm', value })),
    children,
    ...(row.front ? { front: row.front } : {}),
    ...(row.handle ? { handle: row.handle } : {}),
  };
}

/** Inside width and divider thickness of a staggered split, read from the built model. */
function measure(model: FurnitureModel, s: Split): { inner: Mm; t: Mm } | null {
  const o = model.spaces.find((x) => x.nodeId === s.id);
  const shelf = model.panels.find((p) => p.nodeId === s.id && p.role === 'divider');
  return o && shelf ? { inner: o.box.w, t: shelf.box.h } : null;
}

const isStagger = (s: Space): s is Split & { stagger: StaggerRule } =>
  s.kind === 'split' && s.axis === 'y' && !!s.stagger;

function apply(s: Space, model: FurnitureModel): Space {
  if (s.kind !== 'split') return s;
  let children = s.children.map((c) => apply(c, model));
  if (isStagger(s)) {
    const m = measure(model, s);
    if (m) {
      const kept = s.stagger.kept ?? [];
      const plan = staggerRows(
        s.stagger,
        m.inner,
        m.t,
        children.map((c, i) => (kept.includes(i) ? rowSpans(c, m.inner) : null)),
      );
      children = children.map((c, i) => {
        const spans = plan[i].spans;
        if (kept.includes(i) || !spans) return c;
        const cur = rowSpans(c, m.inner);
        return cur && cur.join() === spans.join() ? c : writeRow(c, spans);
      });
    }
  }
  return children.every((c, i) => c === s.children[i]) ? s : { ...s, children };
}

export function hasStagger(prod: Product): boolean {
  const walk = (s: Space): boolean => s.kind === 'split' && (!!s.stagger || s.children.some(walk));
  return productRoots(prod).some((r) => walk(r.root));
}

/**
 * Write each staggered split's rows from its rule (ADR-282), for the inside width `model` measured. Rows the user
 * keeps are left alone. Same design back when nothing changes, so a second pass is a no-op.
 */
export function refreshStagger(design: Design, model: FurnitureModel): Design {
  const prod = design.product;
  let next = prod;
  if (prod.kind === 'cabinet') {
    const interior = apply(prod.params.interior, model);
    if (interior !== prod.params.interior) next = { ...prod, params: { ...prod.params, interior } };
  } else if (prod.kind === 'corner') {
    const interior = apply(prod.params.interior, model);
    const wingInterior = apply(prod.params.wingInterior, model);
    if (interior !== prod.params.interior || wingInterior !== prod.params.wingInterior)
      next = { ...prod, params: { ...prod.params, interior, wingInterior } };
  } else if (prod.kind === 'desk') {
    const ped = prod.params.pedestal;
    const left = ped.left && apply(ped.left, model);
    const right = ped.right && apply(ped.right, model);
    if (left !== ped.left || right !== ped.right)
      next = { ...prod, params: { ...prod.params, pedestal: { ...ped, left, right } } };
  }
  return next === prod ? design : { ...design, product: next };
}

/**
 * The checks of a staggered split (ADR-282), from the saved rows and the built model only: a row not kept by hand
 * must hold only the three widths plus one span between the smallest and the largest (error, export blocked), and
 * no divider may line up with one in the row above (warning).
 */
export function staggerDiagnostics(prod: Product, model: FurnitureModel): Diagnostic[] {
  const out: Diagnostic[] = [];
  const visit = (s: Space) => {
    if (s.kind !== 'split') return;
    s.children.forEach(visit);
    if (!isStagger(s)) return;
    const m = measure(model, s);
    if (!m) return;
    const { widths } = s.stagger;
    const lo = Math.min(...widths),
      hi = Math.max(...widths);
    const kept = s.stagger.kept ?? [];
    let prev: Mm[] | null = null;
    s.children.forEach((c, i) => {
      const spans = rowSpans(c, m.inner);
      if (!kept.includes(i)) {
        const sum = spans ? spans.reduce((a, v) => a + v, 0) + (spans.length - 1) * m.t : -1;
        const odd = spans ? spans.filter((v) => !widths.includes(v)) : [];
        const absorber = odd.length === 0 || (odd.length === 1 && odd[0] >= lo && odd[0] <= hi);
        if (!spans || sum !== m.inner || !absorber)
          out.push({
            severity: 'error',
            code: 'stagger-fill',
            message: tx(
              'Row {i} does not follow the widths {a}, {b} and {c} mm: no mix of them fills {w} mm. Change the widths, or keep the row as set by hand.',
              { i: i + 1, a: widths[0], b: widths[1], c: widths[2], w: m.inner },
            ),
            nodeId: s.id,
          });
      }
      if (prev && spans && linesUp(dividerPositions(prev, m.t), dividerPositions(spans, m.t), m.t))
        out.push({
          severity: 'warning',
          code: 'stagger-aligned',
          message: tx('A divider in row {i} lines up with one in the row above.', { i: i + 1 }),
          nodeId: s.id,
        });
      prev = spans;
    });
  };
  for (const r of productRoots(prod)) visit(r.root);
  return out;
}
