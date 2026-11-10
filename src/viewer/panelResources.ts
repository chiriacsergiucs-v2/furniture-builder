import {
  BoxGeometry,
  type BufferGeometry,
  Color,
  EdgesGeometry,
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
  side: Side;
  /** A back panel is slightly see-through in the Simple look. */
  back: boolean;
  finish?: BoardFinish;
}

/** The translucency of everything outside a selected space or lit step (ADR-087, ADR-174). */
const FADED = 0.28;

/** The key one shared material is kept under: equal keys draw the same. */
export function lookKey(l: BoardLook): string {
  const map = l.map ? l.map.uuid : 'plain';
  return l.realistic
    ? `p|${l.color}|${map}|${l.faded ? 1 : 0}|${l.finish ?? ''}|${l.side}`
    : `s|${l.color}|${map}|${l.faded ? 1 : 0}|${l.back ? 1 : 0}|${l.side}`;
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
      opacity: l.faded ? FADED : 1,
      depthWrite: !l.faded,
      side: l.side,
    });
  return new MeshStandardMaterial({
    map: l.map,
    color: new Color(l.color),
    roughness: 0.78,
    metalness: 0,
    transparent: l.back || l.faded,
    opacity: l.faded ? FADED : l.back ? 0.92 : 1,
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
  const c = [b.x + b.w / 2, b.y + b.h / 2, b.z + b.d / 2];
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

/**
 * The panels' edges as one line per edge style (plain, selected, each faded or not), rebuilt only when `deps`
 * change; the lines it replaced are disposed then, and all of them by `dispose`.
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
      const k = `${it.selected ? 1 : 0}${it.faded ? 1 : 0}`;
      groups.set(k, [...(groups.get(k) ?? []), it]);
    }
    this.lines = [...groups.values()].map((g) => {
      const { selected, faded } = g[0];
      const geometry = new LineSegmentsGeometry().setPositions(mergeEdges(g));
      const material = new LineMaterial({
        color: new Color(selected ? SELECT : EDGE).getHex(),
        linewidth: selected ? 1.6 : 1,
        transparent: faded,
        opacity: faded ? FADED : 1,
      });
      const line = new LineSegments2(geometry, material);
      line.computeLineDistances();
      // Display only, never picked (ADR-014).
      line.raycast = () => {};
      return line;
    });
    return this.lines;
  }
  dispose() {
    for (const l of this.lines) {
      l.geometry.dispose();
      (l.material as Material).dispose();
    }
    this.lines = [];
    this.deps = null;
  }
}
