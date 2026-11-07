import { FrontSide, Group, Mesh, type BufferGeometry, type Material, Vector3 } from 'three';
import { describe, expect, it, vi } from 'vitest';
import { buildModel } from '../src/core/build';
import { templates } from '../src/core/design';
import type { Panel } from '../src/core/types';
import {
  boxOf,
  edgePositions,
  lookKey,
  makeMaterial,
  MergedEdges,
  panelMatrix,
  Pool,
  sizeKey,
  type EdgeItem,
} from '../src/viewer/panelResources';

// ADR-238: the 3D view shares one material per look and one box per size, and draws the panel edges as one merged
// line per edge style, instead of one material, one geometry and one edge line per panel.
const S = 0.001;
const design = (id: string) => templates.find((t) => t.id === id)!.create();
/** A 40-panel model: a chest of drawers (30 panels) and a bookcase (10). */
function fortyPanels() {
  const a = design('chest');
  const b = design('bookcase');
  const ma = buildModel(a);
  const mb = buildModel(b);
  const panels = [...ma.panels, ...mb.panels];
  const colors = new Map([...a.materials, ...b.materials].map((m) => [m.id, m.color]));
  return { panels, colors };
}

/** The pools as the 3D view's Panels fill them for one render of the Simple look, nothing selected. */
function draw(panels: Panel[], colors: Map<string, string>, faded = (_p: Panel) => false) {
  const materials = new Pool<Material>();
  const boxes = new Pool<BufferGeometry>();
  const used = panels.map((p) => {
    const look = {
      realistic: false,
      color: colors.get(p.materialId) ?? '#cccccc',
      map: null,
      faded: faded(p),
      side: FrontSide,
      back: p.role === 'back',
    };
    return {
      material: materials.get(lookKey(look), () => makeMaterial(look)),
      geometry: boxOf(boxes, p.box.w, p.box.h, p.box.d),
      look: lookKey(look),
    };
  });
  return { materials, boxes, used };
}

describe('shared viewer resources (ADR-238)', () => {
  it('a 40-panel model: materials ≤ distinct looks, geometries ≤ distinct sizes', () => {
    const { panels, colors } = fortyPanels();
    expect(panels).toHaveLength(40);
    const { materials, boxes, used } = draw(panels, colors);
    const looks = new Set(used.map((u) => u.look));
    const sizes = new Set(panels.map((p) => sizeKey(p.box.w, p.box.h, p.box.d)));
    expect(new Set(used.map((u) => u.material)).size).toBeLessThanOrEqual(looks.size);
    expect(materials.size).toBe(looks.size);
    expect(new Set(used.map((u) => u.geometry)).size).toBeLessThanOrEqual(sizes.size);
    expect(boxes.size).toBe(sizes.size);
    // Far fewer than one of each per panel (40 + 40 before).
    expect(materials.size).toBeLessThan(10);
    expect(boxes.size).toBeLessThan(20);
  });

  it('a different look gets its own material; the shared one is never changed', () => {
    const { panels, colors } = fortyPanels();
    const first = panels[0];
    const { used } = draw(panels, colors, (p) => p !== first);
    const own = used[0].material;
    expect(used.slice(1).every((u) => u.material !== own)).toBe(true);
    expect(own.opacity).toBe(1);
    expect(used[1].material.opacity).toBeCloseTo(0.28);
  });

  it('sweep disposes only what no panel uses', () => {
    const pool = new Pool<Material>();
    const look = (color: string) => ({
      realistic: false,
      color,
      map: null,
      faded: false,
      side: FrontSide,
      back: false,
    });
    const a = pool.get(lookKey(look('#111111')), () => makeMaterial(look('#111111')));
    const b = pool.get(lookKey(look('#222222')), () => makeMaterial(look('#222222')));
    const da = vi.spyOn(a, 'dispose');
    const db = vi.spyOn(b, 'dispose');
    pool.sweep(new Set([lookKey(look('#111111'))]));
    expect(da).not.toHaveBeenCalled();
    expect(db).toHaveBeenCalledOnce();
    expect(pool.size).toBe(1);
  });

  it('the merged edges sit where the per-panel edges were drawn, also for a turned or tilted panel', () => {
    const { panels } = fortyPanels();
    const boxes = new Pool<BufferGeometry>();
    const p = panels[3];
    const tilted: Panel = {
      ...p,
      box: { ...p.box, yaw: { cx: 300, cz: 200, deg: 30 } },
      shape: { kind: 'tilt', axis: 'x', angleDeg: 12, pivot: [0, 0, 0] },
    } as Panel;
    for (const q of [p, tilted]) {
      const b = q.box;
      // The JSX: yaw groups, then the tilt group about the pivot, then the mesh at the box centre.
      const outer = new Group();
      let at = outer;
      if (b.yaw) {
        outer.position.set(b.yaw.cx * S, 0, b.yaw.cz * S);
        outer.rotation.set(0, (b.yaw.deg * Math.PI) / 180, 0);
        const inner = new Group();
        inner.position.set(-b.yaw.cx * S, 0, -b.yaw.cz * S);
        outer.add(inner);
        at = inner;
      }
      const c = [b.x + b.w / 2, b.y + b.h / 2, b.z + b.d / 2];
      const mesh = new Mesh(boxOf(boxes, b.w, b.h, b.d));
      if (q.shape?.kind === 'tilt') {
        const s = q.shape;
        const pv = [b.x + s.pivot[0], b.y + s.pivot[1], b.z + s.pivot[2]];
        const g = new Group();
        g.position.set(pv[0] * S, pv[1] * S, pv[2] * S);
        g.rotation.set((s.angleDeg * Math.PI) / 180, 0, 0);
        mesh.position.set((c[0] - pv[0]) * S, (c[1] - pv[1]) * S, (c[2] - pv[2]) * S);
        g.add(mesh);
        at.add(g);
      } else {
        mesh.position.set(c[0] * S, c[1] * S, c[2] * S);
        at.add(mesh);
      }
      outer.updateMatrixWorld(true);
      const m = panelMatrix(q, true);
      const v = new Vector3(0.01, -0.02, 0.03);
      expect(
        v.clone().applyMatrix4(m).distanceTo(v.clone().applyMatrix4(mesh.matrixWorld)),
      ).toBeLessThan(1e-9);
    }
  });

  it('one line per edge style for the whole model; a new model disposes the old lines', () => {
    const { panels } = fortyPanels();
    const boxes = new Pool<BufferGeometry>();
    const items = (ps: Panel[], selected: string | null): EdgeItem[] =>
      ps.map((p) => ({
        positions: edgePositions(boxOf(boxes, p.box.w, p.box.h, p.box.d)),
        matrix: panelMatrix(p, true),
        selected: p.id === selected,
        faded: false,
      }));
    const edges = new MergedEdges();
    const lines = edges.update([panels, ''], () => items(panels, null));
    // One line for 40 panels (40 drei Edges before), with each box's 12 edges.
    expect(lines).toHaveLength(1);
    expect(lines[0].geometry.getAttribute('instanceStart').count).toBe(40 * 12);
    // The same panels and styles: the same lines, nothing disposed.
    const spy = vi.spyOn(lines[0].geometry, 'dispose');
    expect(edges.update([panels, ''], () => items(panels, null))).toBe(lines);
    expect(spy).not.toHaveBeenCalled();
    // A changed model (a new panel list) disposes the old merged edges.
    const next = panels.slice(0, 20);
    const sel = edges.update([next, '1'], () => items(next, next[0].id));
    expect(spy).toHaveBeenCalledOnce();
    // Selected and plain edges are separate lines (the selection keeps its own colour and width).
    expect(sel).toHaveLength(2);
    expect(sel.map((l) => l.material.linewidth).sort()).toEqual([1, 1.6]);
    const last = sel.map((l) => vi.spyOn(l.geometry, 'dispose'));
    edges.dispose();
    last.forEach((s) => expect(s).toHaveBeenCalledOnce());
  });
});
