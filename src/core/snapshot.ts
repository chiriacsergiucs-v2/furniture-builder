/**
 * A still 3D picture of a built model as SVG (ADR-042): an orthographic view from the front right and above, every
 * panel drawn as its three visible faces in the board's colour. Pure and deterministic, so the catalog pictures are
 * made once before the app runs (`npm run catalog:snapshots`) and shipped as files; nothing renders in the browser.
 */
import { inPlaneAxes } from './geometry';
import { aabbOf, area2, profileWorld, rotateAbout, type V3 } from './shape';
import type { Box, FurnitureModel, Material, Panel } from './types';

/** View from the front right, above: azimuth 30°, elevation 25°. */
const AZ = Math.PI / 6,
  EL = (25 * Math.PI) / 180;
const R = [Math.cos(AZ), 0, -Math.sin(AZ)] as const;
const U = [-Math.sin(AZ) * Math.sin(EL), Math.cos(EL), -Math.cos(AZ) * Math.sin(EL)] as const;
/** Towards the viewer. */
const V = [Math.sin(AZ) * Math.cos(EL), Math.sin(EL), Math.cos(AZ) * Math.cos(EL)] as const;

type P = [number, number, number];
const sx = (p: P) => p[0] * R[0] + p[2] * R[2];
const sy = (p: P) => -(p[0] * U[0] + p[1] * U[1] + p[2] * U[2]);

/** The three faces seen from this view (+x, +y, +z), each as four corners. */
function faces(b: Box): { shade: number; pts: P[] }[] {
  const x0 = b.x,
    x1 = b.x + b.w,
    y0 = b.y,
    y1 = b.y + b.h,
    z0 = b.z,
    z1 = b.z + b.d;
  return [
    {
      shade: 0.74,
      pts: [
        [x1, y0, z1],
        [x1, y0, z0],
        [x1, y1, z0],
        [x1, y1, z1],
      ],
    },
    {
      shade: 0.9,
      pts: [
        [x0, y0, z1],
        [x1, y0, z1],
        [x1, y1, z1],
        [x0, y1, z1],
      ],
    },
    {
      shade: 1.06,
      pts: [
        [x0, y1, z1],
        [x1, y1, z1],
        [x1, y1, z0],
        [x0, y1, z0],
      ],
    },
  ];
}

/** Shade of a face by its unit normal: the three box faces keep their shades, slanted faces blend them. */
const shadeOf = (n: V3) => 0.74 * n[0] * n[0] + 1.06 * n[1] * n[1] + 0.9 * n[2] * n[2];
const norm = (v: V3): V3 => {
  const l = Math.hypot(v[0], v[1], v[2]) || 1;
  return [v[0] / l, v[1] / l, v[2] / l];
};

/**
 * Faces of a shaped panel (ADR-040) that face the viewer: a tilted blank's six faces turned about its pivot, or a
 * profile's two outline faces and one side face per outline edge.
 */
function shapedFaces(p: Panel): { shade: number; pts: P[] }[] {
  const b = p.box,
    s = p.shape!;
  const all: { n: V3; pts: P[] }[] = [];
  if (s.kind === 'tilt') {
    const x0 = b.x,
      x1 = b.x + b.w,
      y0 = b.y,
      y1 = b.y + b.h,
      z0 = b.z,
      z1 = b.z + b.d;
    const box6: { n: V3; pts: P[] }[] = [
      {
        n: [1, 0, 0],
        pts: [
          [x1, y0, z1],
          [x1, y0, z0],
          [x1, y1, z0],
          [x1, y1, z1],
        ],
      },
      {
        n: [-1, 0, 0],
        pts: [
          [x0, y0, z0],
          [x0, y0, z1],
          [x0, y1, z1],
          [x0, y1, z0],
        ],
      },
      {
        n: [0, 1, 0],
        pts: [
          [x0, y1, z1],
          [x1, y1, z1],
          [x1, y1, z0],
          [x0, y1, z0],
        ],
      },
      {
        n: [0, -1, 0],
        pts: [
          [x0, y0, z0],
          [x1, y0, z0],
          [x1, y0, z1],
          [x0, y0, z1],
        ],
      },
      {
        n: [0, 0, 1],
        pts: [
          [x0, y0, z1],
          [x1, y0, z1],
          [x1, y1, z1],
          [x0, y1, z1],
        ],
      },
      {
        n: [0, 0, -1],
        pts: [
          [x1, y0, z0],
          [x0, y0, z0],
          [x0, y1, z0],
          [x1, y1, z0],
        ],
      },
    ];
    const pv: V3 = [b.x + s.pivot[0], b.y + s.pivot[1], b.z + s.pivot[2]];
    for (const f of box6)
      all.push({
        n: rotateAbout(f.n, s.axis, s.angleDeg, [0, 0, 0]),
        pts: f.pts.map((q) => rotateAbout(q, s.axis, s.angleDeg, pv)),
      });
  } else {
    const t = p.thicknessAxis,
      ti = ['x', 'y', 'z'].indexOf(t);
    const ccw = area2(s.points) > 0 ? s.points : [...s.points].reverse();
    const back = profileWorld(b, t, ccw);
    const off: V3 = [0, 0, 0];
    off[ti] = ti === 0 ? b.w : ti === 1 ? b.h : b.d;
    const front = back.map((q) => [q[0] + off[0], q[1] + off[1], q[2] + off[2]] as V3);
    const tn: V3 = [0, 0, 0];
    tn[ti] = 1;
    const [ua, va] = inPlaneAxes(t);
    const ui = ['x', 'y', 'z'].indexOf(ua),
      vi = ['x', 'y', 'z'].indexOf(va);
    ccw.forEach(([u, v], i) => {
      const [u2, v2] = ccw[(i + 1) % ccw.length];
      // Counter-clockwise in (u, v): the outside of edge a → b is to its right, (dv, −du).
      const n: V3 = [0, 0, 0];
      n[ui] = v2 - v;
      n[vi] = -(u2 - u);
      all.push({
        n: norm(n),
        pts: [back[i], back[(i + 1) % ccw.length], front[(i + 1) % ccw.length], front[i]],
      });
    });
    // Outline faces last: a visible one is nearer than the part's own side faces (notches included).
    all.push({ n: tn, pts: front }, { n: [-tn[0], -tn[1], -tn[2]], pts: back });
  }
  // Normals are outward; keep the faces turned towards the viewer.
  return all
    .filter((f) => f.n[0] * V[0] + f.n[1] * V[1] + f.n[2] * V[2] > 1e-9)
    .map((f) => ({ shade: shadeOf(norm(f.n)), pts: f.pts as P[] }));
}

/** Screen bounds of a box: its eight corners projected. */
function screenBounds(b: Box): [number, number, number, number] {
  let u0 = Infinity,
    u1 = -Infinity,
    v0 = Infinity,
    v1 = -Infinity;
  for (const x of [b.x, b.x + b.w])
    for (const y of [b.y, b.y + b.h])
      for (const z of [b.z, b.z + b.d]) {
        const p: P = [x, y, z];
        u0 = Math.min(u0, sx(p));
        u1 = Math.max(u1, sx(p));
        v0 = Math.min(v0, sy(p));
        v1 = Math.max(v1, sy(p));
      }
  return [u0, u1, v0, v1];
}

/**
 * 1 when `a` must be drawn after `b` (it is nearer), -1 before, 0 when neither can hide the other. Boxes never overlap
 * (build checks), so some axis separates them; the viewer sits on the + side of every axis. A ray towards the viewer
 * only grows on every axis, so when two axes disagree neither box can cover the other.
 */
function nearer(a: Box, b: Box): number {
  let sign = 0;
  for (const [a0, a1, b0, b1] of [
    [a.x, a.x + a.w, b.x, b.x + b.w],
    [a.y, a.y + a.h, b.y, b.y + b.h],
    [a.z, a.z + a.d, b.z, b.z + b.d],
  ]) {
    const s = a0 >= b1 ? 1 : b0 >= a1 ? -1 : 0;
    if (s && sign && s !== sign) return 0;
    if (s) sign = s;
  }
  return sign;
}

/** Painter's order: far boxes first. Only boxes whose pictures overlap are compared; a cycle falls back to depth. */
function paintOrder(boxes: Box[]): number[] {
  const n = boxes.length;
  const sb = boxes.map(screenBounds);
  const after: number[][] = boxes.map(() => []);
  const indeg = new Array<number>(n).fill(0);
  for (let i = 0; i < n; i++)
    for (let j = i + 1; j < n; j++) {
      const [a, b] = [sb[i], sb[j]];
      if (a[1] <= b[0] || b[1] <= a[0] || a[3] <= b[2] || b[3] <= a[2]) continue;
      const c = nearer(boxes[i], boxes[j]);
      if (c > 0) {
        after[j].push(i);
        indeg[i]++;
      } else if (c < 0) {
        after[i].push(j);
        indeg[j]++;
      }
    }
  const depth = (b: Box) =>
    (b.x + b.w / 2) * V[0] + (b.y + b.h / 2) * V[1] + (b.z + b.d / 2) * V[2];
  const order: number[] = [];
  const done = new Array<boolean>(n).fill(false);
  while (order.length < n) {
    // Ready boxes, farthest first, so the result does not depend on input order more than it must.
    let pick = -1;
    for (let i = 0; i < n; i++)
      if (!done[i] && indeg[i] === 0 && (pick < 0 || depth(boxes[i]) < depth(boxes[pick])))
        pick = i;
    if (pick < 0)
      for (let i = 0; i < n; i++)
        if (!done[i] && (pick < 0 || depth(boxes[i]) < depth(boxes[pick]))) pick = i;
    done[pick] = true;
    order.push(pick);
    for (const k of after[pick]) indeg[k]--;
  }
  return order;
}

const hex = (c: string) => (/^#[0-9a-f]{6}$/i.test(c) ? c : '#c8c4bb');
function tint(c: string, f: number): string {
  const n = parseInt(hex(c).slice(1), 16);
  const ch = (v: number) =>
    Math.round(f <= 1 ? v * f : v + (255 - v) * (f - 1) * 3)
      .toString(16)
      .padStart(2, '0');
  return `#${ch((n >> 16) & 255)}${ch((n >> 8) & 255)}${ch(n & 255)}`;
}

/** SVG picture of a model, `size` px on its longer side. Empty models give an empty picture. */
export function snapshotSvg(model: FurnitureModel, materials: Material[], size = 240): string {
  const colour = new Map(materials.map((m) => [m.id, m.color]));
  const panels = model.panels;
  const pad = 6;
  if (!panels.length)
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}"/>\n`;
  let u0 = Infinity,
    u1 = -Infinity,
    v0 = Infinity,
    v1 = -Infinity;
  for (const p of panels) {
    const b = screenBounds(aabbOf(p));
    u0 = Math.min(u0, b[0]);
    u1 = Math.max(u1, b[1]);
    v0 = Math.min(v0, b[2]);
    v1 = Math.max(v1, b[3]);
  }
  const k = (size - 2 * pad) / Math.max(u1 - u0, v1 - v0, 1);
  const w = Math.round((u1 - u0) * k + 2 * pad),
    h = Math.round((v1 - v0) * k + 2 * pad);
  const f = (n: number) => String(Math.round(n * 10) / 10);
  const pt = (p: P) => `${f((sx(p) - u0) * k + pad)},${f((sy(p) - v0) * k + pad)}`;
  const out: string[] = [];
  for (const i of paintOrder(panels.map(aabbOf))) {
    const p = panels[i];
    const c = colour.get(p.materialId) ?? '#c8c4bb';
    const edge = tint(c, 0.55);
    for (const fc of p.shape ? shapedFaces(p) : faces(p.box))
      out.push(
        `<path d="M${fc.pts.map(pt).join('L')}Z" fill="${tint(c, fc.shade)}" stroke="${edge}"/>`,
      );
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" stroke-width="0.5" stroke-linejoin="round">${out.join('')}</svg>\n`;
}
