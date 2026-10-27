import type { Axis, Box, Face, Mm, Panel, SplitSize, Yaw } from './types';

export const isMm = (n: unknown): n is Mm => typeof n === 'number' && Number.isSafeInteger(n);

export const box = (x: Mm, y: Mm, z: Mm, w: Mm, h: Mm, d: Mm): Box => ({ x, y, z, w, h, d });

const extent = (b: Box, a: Axis): [Mm, Mm] =>
  a === 'x' ? [b.x, b.x + b.w] : a === 'y' ? [b.y, b.y + b.h] : [b.z, b.z + b.d];

export const sizeOn = (b: Box, a: Axis): Mm => (a === 'x' ? b.w : a === 'y' ? b.h : b.d);

/** Length of the open interval intersection on one axis (0 when they only touch). */
const overlap1 = (a: [Mm, Mm], b: [Mm, Mm]) =>
  Math.max(0, Math.min(a[1], b[1]) - Math.max(a[0], b[0]));

/** A floor point turned about a yaw's vertical line (ADR-121), the way a quarter turn turns it: 90 takes +z to +x. */
export function yawPoint(y: Yaw, x: number, z: number): [number, number] {
  const a = (y.deg * Math.PI) / 180,
    c = Math.cos(a),
    s = Math.sin(a);
  const dx = x - y.cx,
    dz = z - y.cz;
  return [y.cx + dx * c + dz * s, y.cz - dx * s + dz * c];
}

/** The floor outline of a box (ADR-121): its four corners in order, turned when it carries a yaw. */
export function footprintOf(b: Box): [number, number][] {
  const pts: [number, number][] = [
    [b.x, b.z],
    [b.x + b.w, b.z],
    [b.x + b.w, b.z + b.d],
    [b.x, b.z + b.d],
  ];
  const y = b.yaw;
  return y ? pts.map(([x, z]) => yawPoint(y, x, z)) : pts;
}

/** Whole-mm axis-aligned box around a box (the box itself without a yaw), never smaller than what it encloses. */
export function enclosing(b: Box): Box {
  if (!b.yaw) return b;
  const pts = footprintOf(b);
  const xs = pts.map((p) => p[0]),
    zs = pts.map((p) => p[1]);
  const x0 = Math.floor(Math.min(...xs) + 1e-6),
    z0 = Math.floor(Math.min(...zs) + 1e-6);
  const x1 = Math.ceil(Math.max(...xs) - 1e-6),
    z1 = Math.ceil(Math.max(...zs) - 1e-6);
  return box(x0, b.y, z0, x1 - x0, b.h, z1 - z0);
}

/** Separating-axis test of two convex floor outlines, projections rounded to 1/1000 mm (touching is no overlap). */
export function outlinesOverlap(a: [number, number][], b: [number, number][]): boolean {
  for (const poly of [a, b])
    for (let i = 0; i < poly.length; i++) {
      const [x0, z0] = poly[i],
        [x1, z1] = poly[(i + 1) % poly.length];
      const nx = z0 - z1,
        nz = x1 - x0;
      const len = Math.hypot(nx, nz);
      if (len < 1e-9) continue;
      const pa = a.map(([x, z]) => Math.round(((x * nx + z * nz) / len) * 1000)),
        pb = b.map(([x, z]) => Math.round(((x * nx + z * nz) / len) * 1000));
      if (Math.max(...pa) <= Math.min(...pb) || Math.max(...pb) <= Math.min(...pa)) return false;
    }
  return true;
}

/** Strictly positive shared volume. Touching faces are not an overlap. Turned boxes (ADR-121) are tested exactly. */
export function overlaps(a: Box, b: Box): boolean {
  if (overlap1(extent(a, 'y'), extent(b, 'y')) <= 0) return false;
  if (a.yaw || b.yaw) {
    const ea = enclosing(a),
      eb = enclosing(b);
    if (overlap1(extent(ea, 'x'), extent(eb, 'x')) <= 0) return false;
    if (overlap1(extent(ea, 'z'), extent(eb, 'z')) <= 0) return false;
    return outlinesOverlap(footprintOf(a), footprintOf(b));
  }
  return (
    overlap1(extent(a, 'x'), extent(b, 'x')) > 0 && overlap1(extent(a, 'z'), extent(b, 'z')) > 0
  );
}

export function contains(outer0: Box, inner: Box): boolean {
  const outer = enclosing(outer0);
  if (inner.yaw)
    return (
      inner.y >= outer.y &&
      inner.y + inner.h <= outer.y + outer.h &&
      footprintOf(inner).every(
        ([x, z]) =>
          x >= outer.x - 1e-6 &&
          x <= outer.x + outer.w + 1e-6 &&
          z >= outer.z - 1e-6 &&
          z <= outer.z + outer.d + 1e-6,
      )
    );
  return (['x', 'y', 'z'] as const).every((a) => {
    const [o0, o1] = extent(outer, a),
      [i0, i1] = extent(inner, a);
    return i0 >= o0 && i1 <= o1;
  });
}

/** Whole-mm box around all of them (turned boxes, ADR-121, by their enclosing box). */
export function union(input: Box[]): Box {
  if (!input.length) return box(0, 0, 0, 0, 0, 0);
  const boxes = input.map(enclosing);
  let x0 = Infinity,
    y0 = Infinity,
    z0 = Infinity,
    x1 = -Infinity,
    y1 = -Infinity,
    z1 = -Infinity;
  for (const b of boxes) {
    x0 = Math.min(x0, b.x);
    y0 = Math.min(y0, b.y);
    z0 = Math.min(z0, b.z);
    x1 = Math.max(x1, b.x + b.w);
    y1 = Math.max(y1, b.y + b.h);
    z1 = Math.max(z1, b.z + b.d);
  }
  return box(x0, y0, z0, x1 - x0, y1 - y0, z1 - z0);
}

export const translate = (b: Box, dx: Mm, dy: Mm, dz: Mm): Box => ({
  ...b,
  x: b.x + dx,
  y: b.y + dy,
  z: b.z + dz,
  // A turned box keeps turning about the same point of itself (ADR-121).
  ...(b.yaw ? { yaw: { ...b.yaw, cx: b.yaw.cx + dx, cz: b.yaw.cz + dz } } : {}),
});

/**
 * Split `total` integer millimetres into parts. Fixed parts take their value; the remainder is shared by
 * fractional weights. Integer rounding remainder goes to the last fractional part, so sum === total exactly.
 * Returns null when fixed parts exceed the total.
 */
export function distribute(total: Mm, sizes: SplitSize[]): Mm[] | null {
  const fixed = sizes.reduce((s, p) => s + (p.mode === 'mm' ? p.value : 0), 0);
  const rest = total - fixed;
  if (rest < 0) return null;
  const weights = sizes.map((p) => (p.mode === 'fr' ? Math.max(0, p.value) : 0));
  const wsum = weights.reduce((a, b) => a + b, 0);
  if (wsum === 0 && rest !== 0) {
    // No flexible part: the leftover goes to the last part so the parts still fill the space.
    const out = sizes.map((p) => (p.mode === 'mm' ? p.value : 0));
    out[out.length - 1] += rest;
    return out;
  }
  const out = sizes.map((p, i) =>
    p.mode === 'mm' ? p.value : Math.floor((rest * weights[i]) / wsum),
  );
  const assigned = out.reduce((a, b) => a + b, 0);
  let lastFr = -1;
  sizes.forEach((p, i) => {
    if (p.mode === 'fr' && weights[i] > 0) lastFr = i;
  });
  if (lastFr >= 0) out[lastFr] += total - assigned;
  return out;
}

/** Equal integer split; the rounding remainder goes to the first parts (top drawers stay equal-ish). */
export function equalParts(total: Mm, n: number): Mm[] {
  const base = Math.floor(total / n),
    rem = total - base * n;
  return Array.from({ length: n }, (_, i) => base + (i < rem ? 1 : 0));
}

/** The two axes that lie in the panel's plane. */
export const inPlaneAxes = (t: Axis): [Axis, Axis] =>
  t === 'x' ? ['y', 'z'] : t === 'y' ? ['x', 'z'] : ['x', 'y'];

export const faceAxis = (f: Face): Axis => f[1] as Axis;

/**
 * Cut-list dimensions of a panel. Length follows the grain when the material has grain,
 * otherwise it is the longer side. Edge counts are how many edges along length/width are banded
 * (the notation panel shops use: "L2 W1").
 */
export function cutDimensions(p: Panel, materialHasGrain: boolean) {
  const [a, b] = inPlaneAxes(p.thicknessAxis);
  let lengthAxis: Axis;
  if (materialHasGrain && (p.grainAxis === a || p.grainAxis === b)) lengthAxis = p.grainAxis;
  else lengthAxis = sizeOn(p.box, a) >= sizeOn(p.box, b) ? a : b;
  const widthAxis = lengthAxis === a ? b : a;
  let edgesL = 0,
    edgesW = 0;
  for (const f of p.banded) {
    const fa = faceAxis(f);
    if (fa === p.thicknessAxis) continue;
    // An edge on a face perpendicular to the width axis runs along the length axis.
    if (fa === widthAxis) edgesL++;
    else edgesW++;
  }
  return {
    length: sizeOn(p.box, lengthAxis),
    width: sizeOn(p.box, widthAxis),
    thickness: sizeOn(p.box, p.thicknessAxis),
    edgesL,
    edgesW,
  };
}

/** The shared part of two boxes (sizes 0 on an axis where they only touch or miss). */
export function intersection(a0: Box, b0: Box): Box {
  // Turned boxes (ADR-121) by their enclosing boxes: an outer measure of the shared part.
  const a = enclosing(a0),
    b = enclosing(b0);
  const ax = (k: Axis) => {
    const [a0, a1] = extent(a, k),
      [b0, b1] = extent(b, k);
    const lo = Math.max(a0, b0);
    return [lo, Math.max(0, Math.min(a1, b1) - lo)] as const;
  };
  const [x, w] = ax('x'),
    [y, h] = ax('y'),
    [z, d] = ax('z');
  return { x, y, z, w, h, d };
}
