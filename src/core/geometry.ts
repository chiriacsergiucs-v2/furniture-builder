import type { Axis, Box, Face, Mm, Panel, SplitSize } from './types';

export const isMm = (n: unknown): n is Mm => typeof n === 'number' && Number.isSafeInteger(n);

export const box = (x: Mm, y: Mm, z: Mm, w: Mm, h: Mm, d: Mm): Box => ({ x, y, z, w, h, d });

const extent = (b: Box, a: Axis): [Mm, Mm] =>
  a === 'x' ? [b.x, b.x + b.w] : a === 'y' ? [b.y, b.y + b.h] : [b.z, b.z + b.d];

export const sizeOn = (b: Box, a: Axis): Mm => (a === 'x' ? b.w : a === 'y' ? b.h : b.d);

/** Length of the open interval intersection on one axis (0 when they only touch). */
const overlap1 = (a: [Mm, Mm], b: [Mm, Mm]) =>
  Math.max(0, Math.min(a[1], b[1]) - Math.max(a[0], b[0]));

/** Strictly positive shared volume. Touching faces are not an overlap. */
export function overlaps(a: Box, b: Box): boolean {
  return (
    overlap1(extent(a, 'x'), extent(b, 'x')) > 0 &&
    overlap1(extent(a, 'y'), extent(b, 'y')) > 0 &&
    overlap1(extent(a, 'z'), extent(b, 'z')) > 0
  );
}

export function contains(outer: Box, inner: Box): boolean {
  return (['x', 'y', 'z'] as const).every((a) => {
    const [o0, o1] = extent(outer, a),
      [i0, i1] = extent(inner, a);
    return i0 >= o0 && i1 <= o1;
  });
}

export function union(boxes: Box[]): Box {
  if (!boxes.length) return box(0, 0, 0, 0, 0, 0);
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
