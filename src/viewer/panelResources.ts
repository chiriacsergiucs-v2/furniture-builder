import {
  BoxGeometry,
  BufferAttribute,
  BufferGeometry,
  Color,
  EdgesGeometry,
  LineBasicMaterial,
  LineSegments,
  type Material,
  Matrix4,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  type Side,
  type Texture,
  Vector3,
} from 'three';
import { LineMaterial } from 'three/examples/jsm/lines/LineMaterial.js';
import { LineSegments2 } from 'three/examples/jsm/lines/LineSegments2.js';
import { LineSegmentsGeometry } from 'three/examples/jsm/lines/LineSegmentsGeometry.js';
import { boxCentre } from '../core/geometry';
import { FOCUS_OPACITY } from '../core/selectPath';
import { finishLook } from '../core/surface';
import type { BoardFinish, Panel } from '../core/types';
import { S } from './pieceDrag';

/**
 * Shared three.js objects for the 3D view's boards (ADR-238): one material per look, one box geometry per size and
 * one merged edge line per edge style, instead of one of each per panel. Nothing here is ever changed after it is
 * made, so a shared object looks the same for every panel that uses it; a selected panel gets its own look key.
 */

/** Disposable objects kept by key; `sweep` disposes the ones no panel uses any more. */
export class Pool<T extends { dispose(): void }> {
  private items = new Map<string, T>();
  get(key: string, make: () => T): T {
    let v = this.items.get(key);
    if (!v) {
      v = make();
      this.items.set(key, v);
    }
    return v;
  }
  /** Dispose and forget every object whose key is not in `keep`. */
  sweep(keep: ReadonlySet<string>) {
    for (const [k, v] of this.items)
      if (!keep.has(k)) {
        v.dispose();
        this.items.delete(k);
      }
  }
  clear() {
    this.sweep(new Set());
  }
  get size() {
    return this.items.size;
  }
}

/** How a board is drawn: the plain preview (Simple, ADR-067) or the realistic look. */
export interface BoardLook {
  realistic: boolean;
  color: string;
  map: Texture | null;
  faded: boolean;
  /** The opacity of a faded board (FOCUS_OPACITY, ADR-270); the default is ADR-087's look. */
  fadeOpacity?: number;
  side: Side;
  /** A back panel is slightly see-through in the Simple look. */
  back: boolean;
  finish?: BoardFinish;
}

/** The translucency of everything outside a selected space or lit step (ADR-087, ADR-174). */
const FADED = FOCUS_OPACITY.fade;

/** The key one shared material is kept under: equal keys draw the same. */
export function lookKey(l: BoardLook): string {
  const map = l.map ? l.map.uuid : 'plain';
  return l.realistic
    ? `p|${l.color}|${map}|${l.faded ? (l.fadeOpacity ?? FADED) : 1}|${l.finish ?? ''}|${l.side}`
    : `s|${l.color}|${map}|${l.faded ? (l.fadeOpacity ?? FADED) : 1}|${l.back ? 1 : 0}|${l.side}`;
}

/** A new material for a look (the same values the per-panel JSX materials had). */
export function makeMaterial(l: BoardLook): Material {
  if (l.realistic)
    return new MeshPhysicalMaterial({
      map: l.map,
      color: new Color(l.color),
      metalness: 0,
      ...finishLook(l.finish),
      transparent: l.faded,
      opacity: l.faded ? (l.fadeOpacity ?? FADED) : 1,
      depthWrite: !l.faded,
      side: l.side,
    });
  return new MeshStandardMaterial({
    map: l.map,
    color: new Color(l.color),
    roughness: 0.78,
    metalness: 0,
    transparent: l.back || l.faded,
    opacity: l.faded ? (l.fadeOpacity ?? FADED) : l.back ? 0.92 : 1,
    depthWrite: !l.faded,
    side: l.side,
  });
}

export const sizeKey = (w: number, h: number, d: number) => `${w}x${h}x${d}`;

/** A board's box, in metres, from the shared pool. */
export function boxOf(pool: Pool<BufferGeometry>, w: number, h: number, d: number): BufferGeometry {
  return pool.get(sizeKey(w, h, d), () => new BoxGeometry(w * S, h * S, d * S));
}

// The edge outline of each geometry (drei's Edges threshold, 15°), worked out once per geometry.
const edgeCache = new WeakMap<BufferGeometry, Float32Array>();
export function edgePositions(g: BufferGeometry): Float32Array {
  let hit = edgeCache.get(g);
  if (!hit) {
    const e = new EdgesGeometry(g, 15);
    hit = new Float32Array(e.attributes.position.array);
    e.dispose();
    edgeCache.set(g, hit);
  }
  return hit;
}

/**
 * Where a panel's mesh sits in the panels' group, as the JSX places it: `centred` meshes sit at the box centre (a tilted
 * one turned about its pivot, ADR-040); profiled and shaped ones are drawn where they are. An angled piece's panels
 * turn about its vertical line (ADR-121).
 */
export function panelMatrix(p: Panel, centred: boolean): Matrix4 {
  const b = p.box;
  const m = new Matrix4();
  const y = b.yaw;
  if (y)
    m.makeTranslation(y.cx * S, 0, y.cz * S)
      .multiply(new Matrix4().makeRotationY((y.deg * Math.PI) / 180))
      .multiply(new Matrix4().makeTranslation(-y.cx * S, 0, -y.cz * S));
  if (!centred) return m;
  const k = boxCentre(b);
  const c = [k.x, k.y, k.z];
  const s = p.shape;
  if (s?.kind !== 'tilt')
    return m.multiply(new Matrix4().makeTranslation(c[0] * S, c[1] * S, c[2] * S));
  const pv = [b.x + s.pivot[0], b.y + s.pivot[1], b.z + s.pivot[2]];
  const a = (s.angleDeg * Math.PI) / 180;
  const axis = new Vector3(s.axis === 'x' ? 1 : 0, s.axis === 'y' ? 1 : 0, s.axis === 'z' ? 1 : 0);
  return m
    .multiply(new Matrix4().makeTranslation(pv[0] * S, pv[1] * S, pv[2] * S))
    .multiply(new Matrix4().makeRotationAxis(axis, a))
    .multiply(
      new Matrix4().makeTranslation((c[0] - pv[0]) * S, (c[1] - pv[1]) * S, (c[2] - pv[2]) * S),
    );
}

/** One panel's edges in the merged line: its outline, where the mesh sits, and how the edges look. */
export interface EdgeItem {
  positions: Float32Array;
  matrix: Matrix4;
  /** The selected space's own panels (or a tinted piece) have thicker edges in the selection colour. */
  selected: boolean;
  faded: boolean;
  /** The opacity of faded edges (ADR-270); the default is ADR-087's look. */
  fadeOpacity?: number;
}

const EDGE = '#3b403c';
export const SELECT = '#2d5b4c';

/** Every item's edges, moved to where its mesh sits, in one array of segment end points. */
function mergeEdges(items: readonly EdgeItem[]): Float32Array {
  const out = new Float32Array(items.reduce((n, i) => n + i.positions.length, 0));
  const v = new Vector3();
  let o = 0;
  for (const it of items) {
    const p = it.positions;
    for (let k = 0; k < p.length; k += 3) {
      v.set(p[k], p[k + 1], p[k + 2]).applyMatrix4(it.matrix);
      out[o++] = v.x;
      out[o++] = v.y;
      out[o++] = v.z;
    }
  }
  return out;
}

/** What a plain (1-pixel) edge line's thin twin is built from: its points and style (ThinTwins). */
interface TwinSource {
  points: Float32Array;
  style: { color: number; transparent: boolean; opacity: number };
}

/**
 * The panels' edges as one line per edge style (plain, selected, each faded or not), rebuilt only when `deps`
 * change; the lines it replaced are disposed then, and all of them by `dispose`. Each plain (1-pixel) line keeps what
 * its thin twin is built from (ThinTwins).
 */
export class MergedEdges {
  private deps: readonly unknown[] | null = null;
  lines: LineSegments2[] = [];
  update(deps: readonly unknown[], items: () => readonly EdgeItem[]): LineSegments2[] {
    if (this.deps && deps.length === this.deps.length && deps.every((d, i) => d === this.deps![i]))
      return this.lines;
    this.dispose();
    this.deps = deps;
    const groups = new Map<string, EdgeItem[]>();
    for (const it of items()) {
      const k = `${it.selected ? 1 : 0}${it.faded ? (it.fadeOpacity ?? FADED) : 1}`;
      groups.set(k, [...(groups.get(k) ?? []), it]);
    }
    this.lines = [...groups.values()].map((g) => {
      const { selected, faded, fadeOpacity } = g[0];
      const points = mergeEdges(g);
      const style = {
        color: new Color(selected ? SELECT : EDGE).getHex(),
        transparent: faded,
        opacity: faded ? (fadeOpacity ?? FADED) : 1,
      };
      const geometry = new LineSegmentsGeometry().setPositions(points);
      const material = new LineMaterial({ ...style, linewidth: selected ? 1.6 : 1 });
      const line = new LineSegments2(geometry, material);
      line.computeLineDistances();
      // Display only, never picked (ADR-014).
      line.raycast = () => {};
      // The selection keeps its wider line in a drag too.
      if (!selected) line.userData.twin = { points, style } satisfies TwinSource;
      return line;
    });
    return this.lines;
  }
  dispose() {
    for (const l of this.lines) {
      l.geometry.dispose();
      l.material.dispose();
    }
    this.lines = [];
    this.deps = null;
  }
}

/**
 * The thin twins of the plain edge lines: a plain GL line of the same colour and points as each, drawn in its place
 * while a slow drag turns the view (`setThin`, orbiting.ts): a fat line draws each segment as its own instance, which
 * costs a slow GPU most of a frame. Built from the lines (MergedEdges) in an effect and disposed in its cleanup, so a
 * StrictMode remount builds them again (useThinTwins, G-605). A GL line is 1 device pixel wide (WebGL draws no wider
 * line on most devices), while the fat line is 1 CSS pixel: on a 2x screen the twin is half as wide (G-605, recorded).
 */
export class ThinTwins {
  /** The thin twins of the plain lines, hidden until `setThin(true)`. */
  readonly thin: LineSegments[] = [];
  /** One unseen segment per twin that keeps its shader ready (sharing the twin's material). */
  readonly warm: LineSegments[] = [];
  private readonly twins: [LineSegments2, LineSegments][] = [];
  constructor(lines: readonly LineSegments2[]) {
    for (const line of lines) {
      const source = line.userData.twin as TwinSource | undefined;
      if (!source) continue;
      const twinGeometry = new BufferGeometry();
      twinGeometry.setAttribute('position', new BufferAttribute(source.points, 3));
      // Measured now, not lazily on the first frame it is drawn (the first frame of a drag).
      twinGeometry.computeBoundingSphere();
      const twin = new LineSegments(twinGeometry, new LineBasicMaterial(source.style));
      twin.raycast = () => {};
      twin.visible = false;
      this.twins.push([line, twin]);
      this.thin.push(twin);
      // The twin's first segment, moved far below the floor (beyond any camera's far plane), drawn in every frame
      // with the twin's material and points: the GPU builds the twin's shader and pipeline and uploads its points
      // with the still view, not on the first frame of a drag (a long task there on a slow GPU, drag-perf.mjs). It
      // draws no pixel.
      const warmGeometry = new BufferGeometry();
      warmGeometry.setAttribute('position', twinGeometry.getAttribute('position'));
      warmGeometry.setDrawRange(0, 2);
      const warm = new LineSegments(warmGeometry, twin.material);
      warm.position.y = -1e5;
      warm.frustumCulled = false;
      warm.raycast = () => {};
      this.warm.push(warm);
    }
  }
  /** Draw the thin twins instead of the plain fat lines (true), or the fat lines again (false). */
  setThin(on: boolean) {
    for (const [fat, twin] of this.twins) {
      fat.visible = !on;
      twin.visible = on;
    }
  }
  /** Disposes the twins and shows the fat lines again. */
  dispose() {
    this.setThin(false);
    for (const t of this.thin) {
      t.geometry.dispose();
      (t.material as Material).dispose();
    }
    for (const w of this.warm) w.geometry.dispose();
    this.thin.length = 0;
    this.warm.length = 0;
    this.twins.length = 0;
  }
}
