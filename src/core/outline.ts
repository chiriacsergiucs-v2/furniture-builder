/**
 * Plan outlines of panels lying flat (ADR-169): polygons in room x and z, whole millimetres. Used to join the tops
 * (or bottoms) of items that touch into one part. Exact integer arithmetic; never throws.
 */
import type { Box, Panel } from './types';

export type Pt = [number, number];

const key = (p: Pt) => `${p[0]},${p[1]}`;
const area2 = (poly: Pt[]) =>
  poly.reduce((s, p, i) => {
    const q = poly[(i + 1) % poly.length];
    return s + (p[0] * q[1] - q[0] * p[1]);
  }, 0);
/** The same polygon, counter-clockwise in (x, z). */
export const ccw = (poly: Pt[]): Pt[] => (area2(poly) < 0 ? [...poly].reverse() : poly);

/** A flat panel's outline in plan: its profile when shaped (thickness along y), else its box. */
export function footprint(p: Panel): Pt[] {
  const b = p.box;
  if (p.shape?.kind === 'profile' && p.thicknessAxis === 'y')
    return ccw(p.shape.points.map(([u, v]) => [b.x + u, b.z + v] as Pt));
  return rectOf(b);
}
export const rectOf = (b: Pick<Box, 'x' | 'z' | 'w' | 'd'>): Pt[] =>
  ccw([
    [b.x, b.z],
    [b.x + b.w, b.z],
    [b.x + b.w, b.z + b.d],
    [b.x, b.z + b.d],
  ]);

const cross = (o: Pt, a: Pt, b: Pt) =>
  (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
/** `p` lies strictly inside segment a–b. */
const inside = (a: Pt, b: Pt, p: Pt) =>
  cross(a, b, p) === 0 &&
  Math.min(a[0], b[0]) <= p[0] &&
  p[0] <= Math.max(a[0], b[0]) &&
  Math.min(a[1], b[1]) <= p[1] &&
  p[1] <= Math.max(a[1], b[1]) &&
  key(p) !== key(a) &&
  key(p) !== key(b);

/** Directed edges of `poly`, split at every vertex of `others` (and its own) that lies on them. */
function splitBy(poly: Pt[], others: Pt[]): [Pt, Pt][] {
  const out: [Pt, Pt][] = [];
  const verts = [...poly, ...others];
  poly.forEach((a, i) => {
    const b = poly[(i + 1) % poly.length];
    const d = (p: Pt) => Math.abs(p[0] - a[0]) + Math.abs(p[1] - a[1]);
    const on = verts.filter((p) => inside(a, b, p)).sort((p, q) => d(p) - d(q));
    const pts = [a, ...on.filter((p, j) => j === 0 || key(p) !== key(on[j - 1])), b];
    for (let j = 0; j + 1 < pts.length; j++) out.push([pts[j], pts[j + 1]]);
  });
  return out;
}
const ekey = (a: Pt, b: Pt) => `${key(a)}>${key(b)}`;

/** Length shared by two outlines along a common edge (they touch, not overlap); 0 when they do not touch. */
export function sharedLength(a: Pt[], b: Pt[]): number {
  const A = ccw(a),
    B = ccw(b);
  const fromA = new Set(splitBy(A, B).map(([p, q]) => ekey(p, q)));
  let len = 0;
  for (const [p, q] of splitBy(B, A))
    if (fromA.has(ekey(q, p))) len += Math.hypot(q[0] - p[0], q[1] - p[1]);
  return Math.round(len);
}

/**
 * The outline of polygons that touch along edges (never overlap) as one polygon, counter-clockwise, without points
 * in the middle of a straight edge; null when they do not make one piece without holes.
 */
export function unionOutline(polys: Pt[][]): Pt[] | null {
  const ps = polys.map(ccw);
  const all = ps.flatMap((p, i) => splitBy(p, ps.filter((_, j) => j !== i).flat()));
  const keys = new Set(all.map(([a, b]) => ekey(a, b)));
  // An edge shared by two polygons runs both ways and is inside; the rest is the outline.
  const outer = all.filter(([a, b]) => !keys.has(ekey(b, a)));
  const from = new Map<string, [Pt, Pt]>();
  for (const e of outer) {
    if (from.has(key(e[0]))) return null;
    from.set(key(e[0]), e);
  }
  if (!from.size) return null;
  const start = outer[0];
  const loop: Pt[] = [start[0]];
  let cur = start;
  for (let n = 0; n < from.size; n++) {
    const next = from.get(key(cur[1]));
    if (!next) return null;
    if (next === start) break;
    loop.push(next[0]);
    cur = next;
  }
  if (loop.length !== from.size) return null;
  // Drop points in the middle of a straight run.
  const clean = loop.filter((p, i) => {
    const a = loop[(i - 1 + loop.length) % loop.length],
      b = loop[(i + 1) % loop.length];
    return cross(a, p, b) !== 0;
  });
  return clean.length >= 3 ? ccw(clean) : null;
}

/** The enclosing rectangle of an outline in plan. */
export function bounds2(poly: Pt[]): { x: number; z: number; w: number; d: number } {
  const xs = poly.map((p) => p[0]),
    zs = poly.map((p) => p[1]);
  const x = Math.min(...xs),
    z = Math.min(...zs);
  return { x, z, w: Math.max(...xs) - x, d: Math.max(...zs) - z };
}

/** True when the outline is its enclosing rectangle. */
export const isRect = (poly: Pt[]) => {
  const b = bounds2(poly);
  return poly.length === 4 && Math.abs(area2(poly)) === 2 * b.w * b.d;
};
