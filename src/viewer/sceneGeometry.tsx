/**
 * Board geometry and textures that the 3D view (Viewer3D.tsx) and its scene parts (ViewerScene.tsx) share: in their
 * own module so neither file imports the other in a cycle (G-485).
 */
import { useEffect, useMemo } from 'react';
import {
  type BufferGeometry,
  BoxGeometry,
  ExtrudeGeometry,
  Float32BufferAttribute,
  Matrix4,
  Path,
  ClampToEdgeWrapping,
  RepeatWrapping,
  SRGBColorSpace,
  Shape,
  Texture,
  TextureLoader,
} from 'three';
import { invalidate } from '@react-three/fiber';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { FRONT_ROLES } from '../core/panelRoles';
import { inPlaneAxes } from '../core/geometry';
import { boxUvs, planeUvs } from '../core/surface';
import { S } from './pieceDrag';
import type { MaterialImage, Panel } from '../core/types';

export const FRONT = FRONT_ROLES;
export const HIGHLIGHT = '#f2c230';

const geoCache = new WeakMap<Panel, ExtrudeGeometry>();
const unit = (a: 'x' | 'y' | 'z') => [a === 'x' ? 1 : 0, a === 'y' ? 1 : 0, a === 'z' ? 1 : 0];
/** A profiled board (ADR-040): its outline extruded through the thickness, placed on the blank's in-plane axes. */
export function profileGeometry(p: Panel): ExtrudeGeometry {
  const hit = geoCache.get(p);
  if (hit) return hit;
  if (p.shape?.kind !== 'profile') throw new Error('not a profile');
  const pts = p.shape.points;
  const shape = new Shape();
  pts.forEach(([u, v], i) => (i ? shape.lineTo(u * S, v * S) : shape.moveTo(u * S, v * S)));
  // Holes cut through the board (ADR-205: a back cut around a pipe or outlet) are extruded too.
  for (const hole of p.shape.holes ?? []) {
    const path = new Path();
    hole.forEach(([u, v], i) => (i ? path.lineTo(u * S, v * S) : path.moveTo(u * S, v * S)));
    shape.holes.push(path);
  }
  const tAxis = p.thicknessAxis,
    t = tAxis === 'x' ? p.box.w : tAxis === 'y' ? p.box.h : p.box.d;
  const g = new ExtrudeGeometry(shape, { depth: t * S, bevelEnabled: false });
  const [ua, va] = inPlaneAxes(tAxis);
  const [e1, e2, e3] = [unit(ua), unit(va), unit(tAxis)];
  g.applyMatrix4(
    new Matrix4().set(
      e1[0],
      e2[0],
      e3[0],
      p.box.x * S,
      e1[1],
      e2[1],
      e3[1],
      p.box.y * S,
      e1[2],
      e2[2],
      e3[2],
      p.box.z * S,
      0,
      0,
      0,
      1,
    ),
  );
  g.computeVertexNormals();
  geoCache.set(p, g);
  return g;
}

const followCache = new WeakMap<Panel, BufferGeometry | null>();
/** An extruded outline, placed by a matrix whose columns are where the shape's x, y and extrusion go, and its origin. */
function placedExtrude(
  outline: [number, number][],
  holes: [number, number][][],
  depth: number,
  cols: [number[], number[], number[]],
  origin: [number, number, number],
): ExtrudeGeometry {
  const shape = new Shape();
  outline.forEach(([u, v], i) => (i ? shape.lineTo(u * S, v * S) : shape.moveTo(u * S, v * S)));
  for (const hole of holes) {
    const path = new Path();
    hole.forEach(([u, v], i) => (i ? path.lineTo(u * S, v * S) : path.moveTo(u * S, v * S)));
    shape.holes.push(path);
  }
  const g = new ExtrudeGeometry(shape, { depth: depth * S, bevelEnabled: false });
  const [a, b, c] = cols;
  g.applyMatrix4(
    new Matrix4().set(
      a[0],
      b[0],
      c[0],
      origin[0] * S,
      a[1],
      b[1],
      c[1],
      origin[1] * S,
      a[2],
      b[2],
      c[2],
      origin[2] * S,
      0,
      0,
      0,
      1,
    ),
  );
  return g;
}

/**
 * ADR-209, display only: a crown's or pelmet's profile extruded along its length (`section`), or a worktop with its
 * rounded or bevelled front edge (`edgeProfile`), drawn as a lower slab, a top slab stopping `size` short of the front
 * and the shaped edge strip; its cut-out holes stay. Null when the panel has neither.
 */
export function followUpGeometry(p: Panel): BufferGeometry | null {
  if (followCache.has(p)) return followCache.get(p)!;
  const b = p.box;
  let g: BufferGeometry | null = null;
  if (p.section && p.section.length >= 3) {
    // Across (z) and up (y) from the back-bottom corner, extruded along x.
    g = placedExtrude(
      p.section,
      [],
      b.w,
      [
        [0, 0, 1],
        [0, 1, 0],
        [1, 0, 0],
      ],
      [b.x, b.y, b.z],
    );
  } else if (p.edgeProfile && p.thicknessAxis === 'y') {
    const { kind, size: s, face } = p.edgeProfile;
    const t = b.h;
    const own = p.shape?.kind === 'profile' ? p.shape : null;
    const pts: [number, number][] = own
      ? own.points
      : [
          [0, 0],
          [b.w, 0],
          [b.w, b.d],
          [0, b.d],
        ];
    const holes = own?.holes ?? [];
    // The worktop's plan: u along x, v along z; the front line and how a point moves back from it.
    const onU = face[1] === 'x';
    const at = face === '+z' ? b.d : face === '+x' ? b.w : 0;
    const back = face[0] === '+' ? -s : s;
    const isFront = ([u, v]: [number, number]) => (onU ? u : v) === at;
    const pull = ([u, v]: [number, number]): [number, number] =>
      isFront([u, v]) ? (onU ? [u + back, v] : [u, v + back]) : [u, v];
    const clamp = ([u, v]: [number, number]): [number, number] => {
      const lim = at + back;
      const c = onU ? u : v;
      const k = face[0] === '+' ? Math.min(c, lim) : Math.max(c, lim);
      return onU ? [k, v] : [u, k];
    };
    const along = pts.filter(isFront).map(([u, v]) => (onU ? v : u));
    const plan: [number[], number[], number[]] = [
      [1, 0, 0],
      [0, 0, 1],
      [0, 1, 0],
    ];
    const parts: BufferGeometry[] = [
      placedExtrude(pts, holes, t - s, plan, [b.x, b.y, b.z]),
      placedExtrude(
        pts.map(pull),
        holes.map((h) => h.map(clamp)),
        s,
        plan,
        [b.x, b.y + t - s, b.z],
      ),
    ];
    if (along.length >= 2) {
      const e0 = Math.min(...along),
        e1 = Math.max(...along);
      // The edge strip's section: a back from the front, b up from the top slab's underside.
      const sec: [number, number][] = [
        [0, 0],
        [s, 0],
        [s, s],
      ];
      if (kind === 'rounded')
        for (let i = 1; i < 12; i++) {
          const th = (i / 12) * (Math.PI / 2);
          sec.push([s - s * Math.sin(th), s * Math.cos(th)]);
        }
      const y0 = b.y + t - s;
      const [aDir, eDir, origin]: [number[], number[], [number, number, number]] =
        face === '+z'
          ? [
              [0, 0, -1],
              [1, 0, 0],
              [b.x + e0, y0, b.z + b.d],
            ]
          : face === '-z'
            ? [
                [0, 0, 1],
                [1, 0, 0],
                [b.x + e0, y0, b.z],
              ]
            : face === '+x'
              ? [
                  [-1, 0, 0],
                  [0, 0, 1],
                  [b.x + b.w, y0, b.z + e0],
                ]
              : [
                  [1, 0, 0],
                  [0, 0, 1],
                  [b.x, y0, b.z + e0],
                ];
      parts.push(placedExtrude(sec, [], e1 - e0, [aDir, [0, 1, 0], eDir], origin));
    }
    g = mergeGeometries(parts.map((x) => x.toNonIndexed()));
  }
  g?.computeVertexNormals();
  followCache.set(p, g);
  return g;
}

/** A board with a picture (ADR-048): texture coordinates from the core, scaled to the part's size in mm. */
export function PictureGeometry({ p, img }: { p: Panel; img: MaterialImage }) {
  const g = useMemo(() => {
    if (p.shape?.kind === 'profile') {
      // Own copy of the extruded outline so its texture coordinates can change.
      const base = profileGeometry(p).clone();
      const [ua, va] = inPlaneAxes(p.thicknessAxis);
      // Extruded outlines carry coordinates in metres along the outline's plane; turn them into picture coordinates.
      const uv = base.getAttribute('uv');
      const mm = Array.from(uv.array as Float32Array, (v) => v / S);
      base.setAttribute('uv', new Float32BufferAttribute(planeUvs(p, img, ua, va, mm), 2));
      return base;
    }
    const b = new BoxGeometry(p.box.w * S, p.box.h * S, p.box.d * S);
    b.setAttribute('uv', new Float32BufferAttribute(boxUvs(p, img), 2));
    return b;
  }, [p, img]);
  useEffect(() => () => g.dispose(), [g]);
  return <primitive object={g} attach="geometry" />;
}

/** One texture per picture, shared by every part; freed when no material uses the picture any more. */
export function useTextures(urls: Map<string, string>, repeat = true): Map<string, Texture> {
  const textures = useMemo(() => {
    const m = new Map<string, Texture>();
    const loader = new TextureLoader();
    for (const [id, url] of urls) {
      if (url === 'missing') continue;
      // Rendered on demand (ADR-121): draw again once the picture has arrived.
      const t = loader.load(url, () => invalidate());
      t.wrapS = t.wrapT = repeat ? RepeatWrapping : ClampToEdgeWrapping;
      t.colorSpace = SRGBColorSpace;
      t.anisotropy = 4;
      m.set(id, t);
    }
    return m;
  }, [urls, repeat]);
  useEffect(() => () => textures.forEach((t) => t.dispose()), [textures]);
  return textures;
}
