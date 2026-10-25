import { describe, expect, it } from 'vitest';
import { buildModel, hasErrors } from '../src/core/build';
import { cutlist, drillingText, hardwareSummary } from '../src/core/cutlist';
import {
  changeKind,
  findInProduct,
  mapProductSpace,
  mapSpace,
  pedestalRoot,
  productRoots,
  splitSpace,
  templates,
  validateDesign,
} from '../src/core/design';
import { cutDimensions, distribute, overlaps } from '../src/core/geometry';
import type { CabinetParams, Design, Panel } from '../src/core/types';

const byTemplate = (id: string) => templates.find((t) => t.id === id)!.create();
const cab = (d: Design) => {
  if (d.product.kind !== 'cabinet') throw Error('not cabinet');
  return d.product.params;
};
const withCab = (d: Design, patch: Partial<CabinetParams>): Design => ({
  ...d,
  product: { ...d.product, params: { ...cab(d), ...patch } } as Design['product'],
});
const errors = (d: Design) => buildModel(d).diagnostics.filter((x) => x.severity === 'error');
const role = (panels: Panel[], r: Panel['role']) => panels.filter((p) => p.role === r);

describe('geometry', () => {
  it('distributes integer millimetres exactly', () => {
    expect(
      distribute(1000, [
        { mode: 'fr', value: 1 },
        { mode: 'fr', value: 2 },
      ]),
    ).toEqual([333, 667]);
    expect(
      distribute(1000, [
        { mode: 'mm', value: 300 },
        { mode: 'fr', value: 1 },
        { mode: 'fr', value: 1 },
      ]),
    ).toEqual([300, 350, 350]);
    expect(
      distribute(100, [
        { mode: 'mm', value: 300 },
        { mode: 'fr', value: 1 },
      ]),
    ).toBeNull();
    for (let t = 50; t < 3000; t += 37) {
      const parts = distribute(t, [
        { mode: 'fr', value: 1 },
        { mode: 'fr', value: 3 },
        { mode: 'fr', value: 7 },
      ])!;
      expect(parts.reduce((a, b) => a + b, 0)).toBe(t);
    }
  });
  it('treats touching boxes as not overlapping', () => {
    expect(
      overlaps(
        { x: 0, y: 0, z: 0, w: 10, h: 10, d: 10 },
        { x: 10, y: 0, z: 0, w: 10, h: 10, d: 10 },
      ),
    ).toBe(false);
    expect(
      overlaps(
        { x: 0, y: 0, z: 0, w: 10, h: 10, d: 10 },
        { x: 9, y: 0, z: 0, w: 10, h: 10, d: 10 },
      ),
    ).toBe(true);
  });
});

describe('every template', () => {
  for (const t of templates) {
    it(`${t.id}: builds with no errors, integer mm, no overlaps, valid document`, () => {
      const d = t.create();
      expect(validateDesign(d)).toEqual([]);
      const m = buildModel(d);
      expect(m.diagnostics.filter((x) => x.severity === 'error')).toEqual([]);
      // A panel set holds what the user lists (the template starts with one part).
      expect(m.panels.length).toBeGreaterThanOrEqual(d.product.kind === 'panels' ? 1 : 4);
      for (const p of m.panels)
        for (const v of Object.values(p.box)) expect(Number.isSafeInteger(v)).toBe(true);
      expect(new Set(m.panels.map((p) => p.id)).size).toBe(m.panels.length);
      // cut list conserves every panel
      expect(cutlist(m, d.materials).reduce((n, r) => n + r.quantity, 0)).toBe(m.panels.length);
    });
  }
});

describe('chest of drawers', () => {
  const d = byTemplate('chest');
  const m = buildModel(d);
  const p = cab(d);

  it('has the expected parts', () => {
    expect(role(m.panels, 'side')).toHaveLength(2);
    expect(role(m.panels, 'drawer-front')).toHaveLength(4);
    expect(role(m.panels, 'drawer-side')).toHaveLength(8);
    expect(role(m.panels, 'plinth')).toHaveLength(1);
    expect(role(m.panels, 'back')).toHaveLength(1);
  });

  it('picks the longest runner that fits and schedules one pair per drawer', () => {
    // depth 450 − 3 mm applied back = 447 opening; −10 rear clearance → 437 → 400 runner
    const hw = hardwareSummary(m);
    expect(hw).toEqual([
      expect.objectContaining({ kind: 'drawer-runner-pair', quantity: 4, sizeMm: 400 }),
    ]);
    for (const s of role(m.panels, 'drawer-side')) expect(s.box.d).toBe(400);
  });

  it('lays out fronts with exact gaps and half-gap outer reveals', () => {
    const fronts = role(m.panels, 'drawer-front').sort((a, b) => b.box.y - a.box.y);
    expect(fronts[0].box.y + fronts[0].box.h).toBe(p.height - 1);
    expect(fronts[3].box.y).toBe(p.plinthHeight + 1);
    for (let i = 0; i < 3; i++)
      expect(fronts[i].box.y - (fronts[i + 1].box.y + fronts[i + 1].box.h)).toBe(3);
    for (const f of fronts) {
      expect(f.box.x).toBe(1);
      expect(f.box.w).toBe(p.width - 2);
      expect(f.box.z).toBe(p.depth);
    }
  });

  it('drawer boxes clear the carcass sides by the runner clearance', () => {
    const t = 18;
    const sides = role(m.panels, 'drawer-side');
    const left = Math.min(...sides.map((s) => s.box.x));
    const right = Math.max(...sides.map((s) => s.box.x + s.box.w));
    expect(left).toBe(t + 13);
    expect(right).toBe(p.width - t - 13);
  });

  it('keeps panel ids stable when the cabinet is resized', () => {
    const resized = buildModel(withCab(d, { width: 1000, height: 1100, depth: 500 }));
    expect(resized.panels.map((x) => x.id).sort()).toEqual(m.panels.map((x) => x.id).sort());
    expect(resized.diagnostics.filter((x) => x.severity === 'error')).toEqual([]);
  });

  it('groups identical parts in the cut list with grain and edge notation', () => {
    const rows = cutlist(m, d.materials);
    const sides = rows.find((r) => r.labels.includes('Left side'))!;
    expect(sides.quantity).toBe(2);
    expect(sides.length).toBe(p.height - 18); // top sits over the sides
    expect(sides.width).toBe(p.depth - 3); // applied back
    expect(sides.edgesL).toBe(1); // front edge runs along the length
    expect(sides.edgesW).toBe(0);
    const fronts = rows.find((r) => r.labels.includes('Drawer front'))!;
    expect(fronts.edgesL + fronts.edgesW).toBe(4);
  });
});

describe('splits and fronts', () => {
  it('sideboard: fronts across dividers keep the same 3 mm gap', () => {
    const d = byTemplate('sideboard');
    const m = buildModel(d);
    const fronts = [...role(m.panels, 'door'), ...role(m.panels, 'drawer-front')];
    const doors = role(m.panels, 'door').sort((a, b) => a.box.x - b.box.x);
    const drawer = role(m.panels, 'drawer-front')[0];
    expect(drawer.box.x - (doors[0].box.x + doors[0].box.w)).toBe(3);
    expect(doors[1].box.x - (drawer.box.x + drawer.box.w)).toBe(3);
    expect(doors[0].box.x).toBe(1);
    expect(doors[1].box.x + doors[1].box.w).toBe(cab(d).width - 1);
    for (const f of fronts) expect(f.box.z).toBe(cab(d).depth);
    expect(hasErrors(m)).toBe(false);
  });

  it('doors over drawers turn them into internal drawers instead of colliding', () => {
    const d = byTemplate('chest');
    const p = cab(d);
    const withDoors = withCab(d, {
      interior: { ...p.interior, front: { kind: 'doors', count: 2 } },
    });
    const m = buildModel(withDoors);
    expect(role(m.panels, 'drawer-front')).toHaveLength(0);
    expect(role(m.panels, 'door')).toHaveLength(2);
    expect(m.diagnostics.filter((x) => x.severity === 'error')).toEqual([]);
    expect(m.diagnostics.some((x) => x.code === 'internal-drawers')).toBe(true);
  });

  it('doors inside doors are reported', () => {
    const d = byTemplate('wardrobe');
    const p = cab(d);
    if (p.interior.kind !== 'split') throw Error();
    const inner = p.interior.children[1];
    const bad = withCab(d, {
      interior: mapSpace(p.interior, inner.id, (s) => ({
        ...s,
        front: { kind: 'doors', count: 1 },
      })),
    });
    const codes = errors(bad).map((e) => e.code);
    expect(codes).toContain('doors-behind-doors');
    expect(codes).toContain('overlap');
  });

  it('splitting and changing kinds keeps a valid, buildable tree', () => {
    const d = byTemplate('bookcase');
    const p = cab(d);
    const split = splitSpace(p.interior, 'x', 3);
    const d2 = withCab(d, { interior: split });
    expect(validateDesign(d2)).toEqual([]);
    expect(errors(d2)).toEqual([]);
    expect(role(buildModel(d2).panels, 'divider')).toHaveLength(2);
    if (split.kind !== 'split') throw Error();
    const d3 = withCab(d2, {
      interior: mapSpace(split, split.children[1].id, (s) => changeKind(s, 'drawers')),
    });
    expect(errors(withCab(d3, { depth: 450 }))).toEqual([]);
  });

  it('reports fixed split sizes that do not fit', () => {
    const d = byTemplate('sideboard');
    const p = cab(d);
    if (p.interior.kind !== 'split') throw Error();
    const bad = withCab(d, { width: 500 });
    expect(errors(bad).map((e) => e.code)).toContain('split-fit');
  });

  it('reports drawers too deep for any runner', () => {
    expect(errors(withCab(byTemplate('chest'), { depth: 200 })).map((e) => e.code)).toContain(
      'runner-fit',
    );
  });

  it('reports a cabinet too small for its panels', () => {
    expect(errors(withCab(byTemplate('chest'), { width: 40 })).map((e) => e.code)).toContain(
      'carcass-too-small',
    );
  });
});

describe('cut dimensions', () => {
  it('length follows grain on grained boards and the long side otherwise', () => {
    const p: Panel = {
      id: 'a',
      nodeId: 'n',
      role: 'side',
      label: 'Side',
      materialId: 'm',
      box: { x: 0, y: 0, z: 0, w: 18, h: 300, d: 500 },
      thicknessAxis: 'x',
      grainAxis: 'y',
      banded: ['+z'],
    };
    expect(cutDimensions(p, true)).toMatchObject({ length: 300, width: 500, edgesL: 1, edgesW: 0 });
    expect(cutDimensions(p, false)).toMatchObject({
      length: 500,
      width: 300,
      edgesL: 0,
      edgesW: 1,
    });
  });
});

describe('desk', () => {
  it('pedestal desk reuses the cabinet generator and leaves knee space', () => {
    const d = byTemplate('desk-pedestal');
    const m = buildModel(d);
    expect(hasErrors(m)).toBe(false);
    expect(role(m.panels, 'worktop')).toHaveLength(1);
    expect(role(m.panels, 'drawer-front')).toHaveLength(3);
    expect(role(m.panels, 'gable')).toHaveLength(1);
    // Carcass and worktop belong to the desk; drawer parts belong to the pedestal's own space (ADR-026).
    for (const p of m.panels) {
      if (p.role.startsWith('drawer')) expect(p.nodeId).not.toBe(d.product.id);
      else expect(p.nodeId).toBe(d.product.id);
    }
    const top = role(m.panels, 'worktop')[0];
    for (const p of m.panels)
      if (p !== top) expect(p.box.y + p.box.h).toBeLessThanOrEqual(top.box.y);
  });
  it('two pedestals too wide for the desk is an error', () => {
    const d = byTemplate('desk-pedestal');
    if (d.product.kind !== 'desk') throw Error();
    const bad: Design = {
      ...d,
      product: {
        ...d.product,
        params: { ...d.product.params, support: 'two-pedestals', width: 800 },
      },
    };
    expect(errors(bad).map((e) => e.code)).toContain('no-knee-space');
  });
});

describe('document validation', () => {
  it('rejects non-integer sizes, unknown materials and duplicate ids', () => {
    const d = byTemplate('chest');
    expect(validateDesign(withCab(d, { width: 800.5 }))).toContain(
      'width must be a whole number of mm',
    );
    expect(validateDesign(withCab(d, { bodyMaterialId: 'nope' }))).toContain(
      'bodyMaterialId refers to an unknown material',
    );
    const p = cab(d);
    const dup = withCab(d, {
      interior: {
        id: 'x',
        kind: 'split',
        axis: 'x',
        sizes: [
          { mode: 'fr', value: 1 },
          { mode: 'fr', value: 1 },
        ],
        children: [
          { id: 'y', kind: 'empty' },
          { id: 'y', kind: 'empty' },
        ],
      },
    });
    expect(validateDesign(dup).some((e) => e.startsWith('Duplicate space id'))).toBe(true);
    expect(p).toBeTruthy();
  });
});

describe('regressions from independent review', () => {
  it('rejects absurd counts before building (no crash)', () => {
    const d = withCab(byTemplate('chest'), {
      interior: { id: 'a', kind: 'drawers', count: 2 ** 32 },
    });
    expect(validateDesign(d)).toContain('Invalid drawer count');
    expect(() => buildModel(d)).not.toThrow();
    expect(errors(d).map((e) => e.code)).toContain('drawer-count');
    const tooMany = withCab(byTemplate('chest'), {
      interior: { id: 'a', kind: 'drawers', count: 15 },
    });
    expect(errors(tooMany).map((e) => e.code)).toContain('drawer-low');
  });
  it('warns when fixed split sizes do not add up', () => {
    const d = withCab(byTemplate('chest'), {
      interior: {
        id: 'a',
        kind: 'split',
        axis: 'x',
        sizes: [
          { mode: 'mm', value: 200 },
          { mode: 'mm', value: 200 },
        ],
        children: [
          { id: 'b', kind: 'empty' },
          { id: 'c', kind: 'empty' },
        ],
      },
    });
    expect(buildModel(d).diagnostics.map((x) => x.code)).toContain('split-resized');
  });
  it('warns when desk drawer fronts stand proud of the worktop', () => {
    const d = byTemplate('desk-pedestal');
    if (d.product.kind !== 'desk') throw Error();
    const bad: Design = {
      ...d,
      product: { ...d.product, params: { ...d.product.params, frontOverhang: 0 } },
    };
    expect(buildModel(bad).diagnostics.map((x) => x.code)).toContain('fronts-proud');
  });
  it('keeps separate hinge lines for doors of different heights', () => {
    const d = withCab(byTemplate('wardrobe'), {
      width: 1000,
      height: 2000,
      interior: {
        id: 'r',
        kind: 'split',
        axis: 'x',
        sizes: [
          { mode: 'fr', value: 1 },
          { mode: 'fr', value: 1 },
        ],
        children: [
          { id: 'a', kind: 'shelves', count: 4, front: { kind: 'doors', count: 1 } },
          {
            id: 'b',
            kind: 'split',
            axis: 'y',
            sizes: [
              { mode: 'fr', value: 1 },
              { mode: 'fr', value: 1 },
            ],
            children: [
              { id: 'c', kind: 'shelves', count: 1, front: { kind: 'doors', count: 1 } },
              { id: 'e', kind: 'shelves', count: 1, front: { kind: 'doors', count: 1 } },
            ],
          },
        ],
      },
    });
    const hinges = hardwareSummary(buildModel(d)).filter((h) => h.kind === 'hinge');
    expect(hinges.length).toBe(2);
    expect(hinges.reduce((n, h) => n + h.quantity, 0)).toBe(4 + 3 + 3);
  });
  it('internal drawers keep clear of the doors', () => {
    const d = byTemplate('chest');
    const p = cab(d);
    const m = buildModel(
      withCab(d, {
        shelfSetback: 0,
        interior: { ...p.interior, front: { kind: 'doors', count: 1 } },
      }),
    );
    const maxZ = Math.max(
      ...m.panels.filter((x) => x.role.startsWith('drawer')).map((x) => x.box.z + x.box.d),
    );
    expect(maxZ).toBeLessThanOrEqual(p.depth - 20);
  });
  it('a desk with no usable knee space is an error', () => {
    const d = byTemplate('desk-pedestal');
    if (d.product.kind !== 'desk') throw Error();
    const bad: Design = {
      ...d,
      product: {
        ...d.product,
        params: {
          ...d.product.params,
          support: 'two-pedestals',
          width: 900,
          pedestal: { width: 440, drawerCount: 3 },
        },
      },
    };
    expect(errors(bad).map((e) => e.code)).toContain('knee-narrow');
  });
});

describe('editable desk pedestals (ADR-026)', () => {
  it('exposes each pedestal as editable spaces and edits them independently', () => {
    const d = byTemplate('desk-pedestal');
    if (d.product.kind !== 'desk') throw Error();
    const both: Design = {
      ...d,
      product: {
        ...d.product,
        params: { ...d.product.params, support: 'two-pedestals', width: 1600 },
      },
    };
    const roots = productRoots(both.product);
    expect(roots.map((r) => r.side)).toEqual(['left', 'right']);
    const m = buildModel(both);
    for (const r of roots) expect(m.spaces.some((s) => s.nodeId === r.root.id)).toBe(true);
    // turn the right unit into a divided unit: shelves over one big drawer
    const right = roots[1].root;
    const product = mapProductSpace(both.product, right.id, (s) => splitSpace(s, 'y', 2));
    const edited: Design = { ...both, product };
    expect(validateDesign(edited)).toEqual([]);
    const m2 = buildModel(edited);
    expect(m2.diagnostics.filter((x) => x.severity === 'error')).toEqual([]);
    expect(findInProduct(edited.product, right.id)?.side).toBe('right');
    // the left unit is untouched
    const leftFronts = (mm: typeof m) =>
      mm.panels.filter((p) => p.role === 'drawer-front' && p.box.x < 800).length;
    expect(leftFronts(m2)).toBe(leftFronts(m));
  });
  it('older desks without stored trees still build and become editable', () => {
    const d = byTemplate('desk-pedestal');
    if (d.product.kind !== 'desk') throw Error();
    const legacy: Design = {
      ...d,
      product: {
        ...d.product,
        params: { ...d.product.params, pedestal: { width: 420, drawerCount: 4 } },
      },
    };
    expect(validateDesign(legacy)).toEqual([]);
    const root = pedestalRoot(
      (legacy.product as Extract<Design['product'], { kind: 'desk' }>).params,
      'left',
      legacy.product.id,
    );
    expect(root).toMatchObject({ kind: 'drawers', count: 4 });
    const edited = mapProductSpace(legacy.product, root.id, (s) => changeKind(s, 'shelves'));
    expect(edited).not.toBe(legacy.product);
    expect(
      buildModel({ ...legacy, product: edited }).panels.filter((p) => p.role === 'shelf').length,
    ).toBe(2);
  });
});

describe('drawer heights and adjustable shelves (ADR-023)', () => {
  it('designs without the new fields build the same model as before', () => {
    const d = byTemplate('chest');
    const a = buildModel(d);
    const b = buildModel(withCab(d, { interior: { ...cab(d).interior } }));
    expect(b.panels).toEqual(a.panels);
  });
  it('chosen front heights: fixed top drawer, the rest share; boxes stay behind their fronts', () => {
    const d = withCab(byTemplate('chest'), {
      interior: {
        id: 'dr',
        kind: 'drawers',
        count: 3,
        heights: [
          { mode: 'mm', value: 150 },
          { mode: 'fr', value: 1 },
          { mode: 'fr', value: 2 },
        ],
      },
    });
    expect(validateDesign(d)).toEqual([]);
    const m = buildModel(d);
    expect(m.diagnostics.filter((x) => x.severity === 'error')).toEqual([]);
    const fronts = role(m.panels, 'drawer-front').sort((a, b) => b.box.y - a.box.y);
    expect(fronts[0].box.h).toBe(150);
    expect(fronts[2].box.h).toBeGreaterThan(fronts[1].box.h * 1.9);
    // each drawer box lies within its own front's vertical span ± the gap
    for (let i = 0; i < 3; i++) {
      const sides = m.panels.filter(
        (p) => p.role === 'drawer-side' && p.label.startsWith(`Drawer ${i + 1} `),
      );
      for (const s of sides) {
        expect(s.box.y).toBeGreaterThanOrEqual(fronts[i].box.y - 3 - 30);
        expect(s.box.y + s.box.h).toBeLessThanOrEqual(fronts[i].box.y + fronts[i].box.h + 3);
      }
    }
  });
  it('rejects heights that do not match the count or do not fit', () => {
    const wrong = withCab(byTemplate('chest'), {
      interior: { id: 'dr', kind: 'drawers', count: 3, heights: [{ mode: 'fr', value: 1 }] },
    });
    expect(validateDesign(wrong)).toContain('Drawer heights must list one size per drawer');
    expect(errors(wrong).map((e) => e.code)).toContain('drawer-heights');
    const tooBig = withCab(byTemplate('chest'), {
      interior: {
        id: 'dr',
        kind: 'drawers',
        count: 2,
        heights: [
          { mode: 'mm', value: 900 },
          { mode: 'fr', value: 1 },
        ],
      },
    });
    expect(errors(tooBig).map((e) => e.code)).toContain('drawer-heights');
  });
  it('adjustable shelves are 1 mm shorter each side and the sides get 32 mm pin rows 37 mm from the edges', () => {
    const d = withCab(byTemplate('bookcase'), {
      interior: { id: 'sh', kind: 'shelves', count: 4, adjustable: true },
    });
    const m = buildModel(d);
    expect(m.diagnostics.filter((x) => x.severity === 'error')).toEqual([]);
    const opening = m.spaces.find((s) => s.nodeId === 'sh')!.box;
    for (const s of role(m.panels, 'shelf')) {
      expect(s.box.w).toBe(opening.w - 2);
      expect(s.box.x).toBe(opening.x + 1);
    }
    const sides = role(m.panels, 'side');
    expect(sides.every((s) => s.pinRows?.length === 1)).toBe(true);
    const rows = sides[0].pinRows![0];
    expect(rows.rows).toEqual([37, sides[0].box.d - 37]);
    for (let i = 1; i < rows.holes.length; i++) expect(rows.holes[i] - rows.holes[i - 1]).toBe(32);
    expect(hardwareSummary(m).find((h) => h.kind === 'shelf-pin')?.quantity).toBe(16);
    const rowsInList = cutlist(m, d.materials).find((r) => r.labels.includes('Left side'))!;
    expect(rowsInList.drilling).toMatch(/2 rows × \d+ holes ø5, 37 mm from edges/);
  });
  it('a divider drilled from both faces has its second row offset by 16 mm', () => {
    const d = withCab(byTemplate('bookcase'), {
      width: 1000,
      interior: {
        id: 'r',
        kind: 'split',
        axis: 'x',
        sizes: [
          { mode: 'fr', value: 1 },
          { mode: 'fr', value: 1 },
        ],
        children: [
          { id: 'a', kind: 'shelves', count: 3, adjustable: true },
          { id: 'b', kind: 'shelves', count: 3, adjustable: true },
        ],
      },
    });
    const m = buildModel(d);
    const div = role(m.panels, 'divider')[0];
    expect(div.pinRows).toHaveLength(2);
    expect(Math.abs(div.pinRows![1].holes[0] - div.pinRows![0].holes[0]) % 32).toBe(16);
  });
});

describe('front styles and handles (ADR-024)', () => {
  it('inset: fronts sit flush inside their openings with the full gap and everything else moves back', () => {
    const d = withCab(byTemplate('sideboard'), { frontStyle: 'inset' });
    const p = cab(d);
    const m = buildModel(d);
    expect(m.diagnostics.filter((x) => x.severity === 'error')).toEqual([]);
    const fronts = [...role(m.panels, 'door'), ...role(m.panels, 'drawer-front')];
    for (const f of fronts) {
      expect(f.box.z).toBe(p.depth - 18);
      expect(f.box.z + f.box.d).toBe(p.depth);
    }
    const doors = role(m.panels, 'door').sort((a, b) => a.box.x - b.box.x);
    expect(doors[0].box.x).toBe(18 + 3); // inside the left side, 3 mm reveal
    // shelves behind inset doors stop behind the door
    for (const s of role(m.panels, 'shelf'))
      expect(s.box.z + s.box.d).toBeLessThanOrEqual(p.depth - 18);
  });
  it('half overlay: outer fronts stop half a gap short of the side centre line', () => {
    const d = withCab(byTemplate('sideboard'), { frontStyle: 'half' });
    const m = buildModel(d);
    expect(m.diagnostics.filter((x) => x.severity === 'error')).toEqual([]);
    const doors = role(m.panels, 'door').sort((a, b) => a.box.x - b.box.x);
    expect(doors[0].box.x).toBe(9 + 2); // lo(18) + hi(3)
    expect(doors[1].box.x + doors[1].box.w).toBe(cab(d).width - 18 + 9 - 1);
  });
  it('bar handles: centred on drawer fronts, on the opening edge of doors, one per front in the hardware list', () => {
    const d = withCab(byTemplate('sideboard'), {});
    const p = cab(d);
    if (p.interior.kind !== 'split') throw Error();
    const [l, mid] = p.interior.children;
    let interior = mapSpace(p.interior, mid.id, (s) => ({
      ...s,
      handle: { kind: 'bar', holeSpacing: 128, position: 'top' },
    }));
    interior = mapSpace(interior, l.id, (s) => ({
      ...s,
      handle: { kind: 'bar', holeSpacing: 160 },
    }));
    const m = buildModel(withCab(d, { interior }));
    const df = role(m.panels, 'drawer-front')[0];
    const [[u1, v1], [u2, v2]] = df.handleHoles!.at;
    expect(u2 - u1).toBe(128);
    expect(v1).toBe(v2);
    expect(u1 + 64).toBe(Math.floor(df.box.w / 2));
    expect(v1).toBe(df.box.h - 40);
    const door = role(m.panels, 'door').sort((a, b) => a.box.x - b.box.x)[0];
    expect(door.handleHoles!.at.every(([u]) => u === door.box.w - 40)).toBe(true); // left-hinged: handle on the right
    const hw = hardwareSummary(m);
    expect(hw.find((h) => h.label === 'Bar handle, 128 mm centres')?.quantity).toBe(3);
    expect(hw.find((h) => h.label === 'Bar handle, 160 mm centres')?.quantity).toBe(1);
    expect(cutlist(m, d.materials).some((r) => r.drilling.includes('handle holes ø5'))).toBe(true);
  });
  it('push-to-open schedules latches and drills nothing; knobs drill one hole', () => {
    const d = byTemplate('chest');
    const p = cab(d);
    const push = buildModel(withCab(d, { interior: { ...p.interior, handle: { kind: 'push' } } }));
    expect(hardwareSummary(push).find((h) => h.kind === 'push-latch')?.quantity).toBe(4);
    expect(role(push.panels, 'drawer-front').every((f) => !f.handleHoles)).toBe(true);
    const knob = buildModel(withCab(d, { interior: { ...p.interior, handle: { kind: 'knob' } } }));
    expect(role(knob.panels, 'drawer-front').every((f) => f.handleHoles?.at.length === 1)).toBe(
      true,
    );
  });
  it('a handle longer than the front is reported', () => {
    const d = byTemplate('chest');
    const m = buildModel(
      withCab(d, {
        width: 300,
        interior: { ...cab(d).interior, handle: { kind: 'bar', holeSpacing: 320 } },
      }),
    );
    expect(m.diagnostics.map((x) => x.code)).toContain('handle-fit');
  });
});

describe('stock sheets in the design (ADR-019) and sheet layouts (ADR-018)', () => {
  it('a version-1 file validates, upgrades in memory with the user defaults, and builds identical panels', async () => {
    const { upgradeDesign } = await import('../src/core/design');
    const v2 = byTemplate('sideboard');
    const v1 = {
      ...v2,
      schemaVersion: 1 as const,
      cutting: undefined,
      materials: v2.materials.map(({ sheet: _s, ...m }) => {
        void _s;
        return m;
      }),
    };
    expect(validateDesign(v1)).toEqual([]);
    const up = upgradeDesign(v1);
    // Upgraded to the current shape (3 since ADR-077, which adds only optional band fields).
    expect(up.schemaVersion).toBe(3);
    expect(up.cutting?.kerf).toBe(4);
    expect(up.materials.find((m) => m.id === 'pal18')!.sheet).toEqual({
      length: 2800,
      width: 2070,
      trim: 10,
      count: null,
    });
    expect(up.materials.find((m) => m.id === 'mdf18')!.sheet).toEqual({
      length: 2440,
      width: 1220,
      trim: 10,
      count: null,
    });
    expect(up.materials.find((m) => m.id === 'hdf3')!.sheet).toEqual({
      length: 2800,
      width: 2070,
      trim: 10,
      count: null,
    });
    expect(buildModel(up).panels).toEqual(buildModel(v1).panels);
    expect(validateDesign(up)).toEqual([]);
    expect(upgradeDesign(up)).toBe(up);
  });
  it('rejects broken sheet settings', () => {
    const d = byTemplate('chest');
    const bad = {
      ...d,
      materials: d.materials.map((m) =>
        m.id === 'pal18'
          ? { ...m, sheet: { length: 2800, width: 2070, trim: 1500, count: null } }
          : m,
      ),
    };
    expect(validateDesign(bad).some((e) => e.startsWith('Invalid sheet'))).toBe(true);
  });
  it('every template lays out on its stock sheets with a valid, validated result', async () => {
    const { nest } = await import('../src/core/nesting');
    const { nestingJobs } = await import('../src/core/nesting/fromDesign');
    for (const t of templates) {
      const d = t.create();
      const { jobs } = nestingJobs(d, buildModel(d));
      expect(jobs.length).toBeGreaterThan(0);
      for (const j of jobs) {
        const r = nest(j, { maxMs: 10_000 });
        expect(r.valid).toBe(true);
        expect(r.unplaced).toEqual([]);
        expect(j.kerf).toBe(4);
        expect(j.trim).toBe(10);
      }
    }
  });
});

describe('wall and corner cabinets (ADR-025)', () => {
  it('wall cabinet: no plinth, two brackets and a rail cut to width', () => {
    const d = byTemplate('wall-cabinet');
    const m = buildModel(d);
    expect(role(m.panels, 'plinth')).toHaveLength(0);
    expect(Math.min(...m.panels.map((p) => p.box.y))).toBe(0);
    const hw = hardwareSummary(m);
    expect(hw.find((h) => h.kind === 'wall-bracket')?.quantity).toBe(2);
    expect(hw.find((h) => h.kind === 'wall-rail')?.sizeMm).toBe(cab(d).width);
    expect(m.diagnostics.map((x) => x.code)).not.toContain('wall-back');
    expect(buildModel(withCab(d, { back: 'applied' })).diagnostics.map((x) => x.code)).toContain(
      'wall-back',
    );
  });
  it('blind corner: blind panel one gap from the door, mirrored for the right', () => {
    for (const side of ['left', 'right'] as const) {
      const d0 = byTemplate('corner-blind');
      if (d0.product.kind !== 'corner') throw Error();
      const d: Design = {
        ...d0,
        product: { ...d0.product, params: { ...d0.product.params, side } },
      };
      const m = buildModel(d);
      expect(m.diagnostics.filter((x) => x.severity === 'error')).toEqual([]);
      const blind = role(m.panels, 'blind-panel')[0];
      const door = role(m.panels, 'door')[0];
      const gap =
        side === 'left'
          ? door.box.x - (blind.box.x + blind.box.w)
          : blind.box.x - (door.box.x + door.box.w);
      expect(gap).toBe(3);
      expect(
        side === 'left' ? blind.box.x : d0.product.params.width - (blind.box.x + blind.box.w),
      ).toBe(1);
    }
  });
  it('L corner: two wings open at the corner, door leaves clear of each other, fold hinge scheduled', () => {
    for (const side of ['left', 'right'] as const) {
      const d0 = byTemplate('corner-l');
      if (d0.product.kind !== 'corner') throw Error();
      const p = { ...d0.product.params, side };
      const m = buildModel({ ...d0, product: { ...d0.product, params: p } });
      expect(m.diagnostics.filter((x) => x.severity === 'error')).toEqual([]);
      expect(role(m.panels, 'side')).toHaveLength(3); // wing B has no side at the corner
      expect(role(m.panels, 'door')).toHaveLength(2);
      expect(hardwareSummary(m).some((h) => h.kind === 'corner-hinge')).toBe(true);
      // wing B runs along the side wall to the full wing width
      expect(Math.max(...m.panels.map((x) => x.box.z + x.box.d))).toBe(p.wingWidth);
      // its spaces are editable but not drawn in the front view
      expect(m.spaces.some((s) => s.nodeId === p.wingInterior.id && s.view === 'side')).toBe(true);
    }
  });
  it('random corners: never overlapping when no error is reported', () => {
    let seed = 7;
    const rnd = () => {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      return seed / 0x7fffffff;
    };
    const ri = (a: number, b: number) => a + Math.floor(rnd() * (b - a + 1));
    let clean = 0;
    for (let i = 0; i < 400; i++) {
      const d0 = byTemplate(rnd() < 0.5 ? 'corner-blind' : 'corner-l');
      if (d0.product.kind !== 'corner') throw Error();
      const kinds = ['empty', 'shelves', 'drawers'] as const;
      const sp = (id: string) =>
        ({
          id,
          kind: kinds[ri(0, 2)],
          count: ri(1, 4),
          front:
            rnd() < 0.6 ? { kind: 'doors' as const, count: (rnd() < 0.5 ? 1 : 2) as 1 | 2 } : null,
        }) as never;
      const p = {
        ...d0.product.params,
        side: rnd() < 0.5 ? ('left' as const) : ('right' as const),
        width: ri(600, 1400),
        wingWidth: ri(600, 1400),
        blindWidth: ri(150, 700),
        depth: ri(300, 650),
        height: ri(400, 1000),
        plinthHeight: rnd() < 0.3 ? 0 : ri(40, 120),
        frontGap: ri(0, 5),
        top: rnd() < 0.5 ? ('over' as const) : ('between' as const),
        back: (['applied', 'inset', 'none'] as const)[ri(0, 2)],
        interior: sp('ia'),
        wingInterior: sp('ib'),
      };
      const m = buildModel({ ...d0, product: { ...d0.product, params: p } });
      if (m.diagnostics.some((x) => x.severity === 'error')) continue;
      clean++;
      for (let a = 0; a < m.panels.length; a++)
        for (let b = a + 1; b < m.panels.length; b++) {
          if (overlaps(m.panels[a].box, m.panels[b].box))
            throw Error(`overlap ${m.panels[a].id} ${m.panels[b].id} in ${JSON.stringify(p)}`);
        }
      for (const x of m.panels)
        for (const v of Object.values(x.box)) expect(Number.isSafeInteger(v)).toBe(true);
    }
    expect(clean).toBeGreaterThan(100);
  });
});

describe('review fixes (2026-10-22)', () => {
  const fr = (value = 1) => ({ mode: 'fr' as const, value });
  it('holes drilled from the two faces of a divider never coincide, whatever the space heights', () => {
    for (let low = 200; low <= 600; low += 13) {
      const d = withCab(byTemplate('bookcase'), {
        width: 1000,
        height: 1800,
        interior: {
          id: 'r',
          kind: 'split',
          axis: 'x',
          sizes: [fr(), fr()],
          children: [
            { id: 'L', kind: 'shelves', count: 2, adjustable: true },
            {
              id: 'R',
              kind: 'split',
              axis: 'y',
              sizes: [fr(), { mode: 'mm', value: low }],
              children: [
                { id: 'RT', kind: 'shelves', count: 2, adjustable: true },
                { id: 'RB', kind: 'empty' },
              ],
            },
          ],
        },
      });
      const div = role(buildModel(d).panels, 'divider')[0];
      const [a, b] = div.pinRows!;
      expect(a.face).not.toBe(b.face);
      expect(a.holes.filter((h) => b.holes.includes(h))).toEqual([]);
      for (const r of div.pinRows!)
        for (const h of r.holes)
          expect((((h - (r.face === '+x' ? 0 : 16)) % 32) + 32) % 32).toBe(0);
    }
  });
  it('pin rows sit 37 mm inside the shelves themselves, not the panel edges', () => {
    for (const d of [
      withCab(byTemplate('base-door'), {
        frontStyle: 'inset',
        interior: {
          ...cab(byTemplate('base-door')).interior,
          adjustable: true,
        } as CabinetParams['interior'],
      }),
      withCab(byTemplate('wall-cabinet'), {
        backInset: 40,
        interior: {
          ...cab(byTemplate('wall-cabinet')).interior,
          adjustable: true,
        } as CabinetParams['interior'],
      }),
    ]) {
      const m = buildModel(d);
      expect(m.diagnostics.filter((x) => x.severity === 'error')).toEqual([]);
      const shelf = role(m.panels, 'shelf')[0],
        side = role(m.panels, 'side')[0];
      const [rear, front] = side.pinRows![0].rows.map((r) => side.box.z + r);
      expect(rear).toBe(shelf.box.z + 37);
      expect(front).toBe(shelf.box.z + shelf.box.d - 37);
    }
  });
  it('drilling text says "one face" when stacked spaces drill the same face twice', () => {
    const d = withCab(byTemplate('bookcase'), {
      interior: {
        id: 'r',
        kind: 'split',
        axis: 'y',
        sizes: [fr(), fr()],
        children: [
          { id: 'A', kind: 'shelves', count: 1, adjustable: true },
          { id: 'B', kind: 'shelves', count: 1, adjustable: true },
        ],
      },
    });
    const side = role(buildModel(d).panels, 'side')[0];
    expect(side.pinRows).toHaveLength(2);
    expect(drillingText(side)).toMatch(/one face$/);
  });
  it('pin row setback must leave room for the hole; sizes are capped', () => {
    expect(validateDesign(withCab(byTemplate('bookcase'), { pinRowSetback: 0 }))).toContain(
      'pinRowSetback must be 8 to 300 mm',
    );
    expect(
      validateDesign(withCab(byTemplate('bookcase'), { width: 2 ** 53 - 1 })).length,
    ).toBeGreaterThan(0);
    const d = byTemplate('bookcase');
    expect(
      validateDesign({ ...d, materials: d.materials.map((m) => ({ ...m, thickness: 1e15 })) }),
    ).toContain('Invalid material');
  });
  it('mirrored L corner keeps the side-wing handle on the same edge as seen from its front', () => {
    const build = (side: 'left' | 'right') => {
      const d0 = byTemplate('corner-l');
      if (d0.product.kind !== 'corner') throw Error();
      const p = d0.product.params;
      return buildModel({
        ...d0,
        product: {
          ...d0.product,
          params: { ...p, side, wingInterior: { ...p.wingInterior, handle: { kind: 'knob' } } },
        },
      });
    };
    const doorB = (m: ReturnType<typeof buildModel>) =>
      role(m.panels, 'door').find((p) => p.thicknessAxis === 'x')!;
    const l = doorB(build('left')),
      r = doorB(build('right'));
    expect(l.handleHoles && r.handleHoles).toBeTruthy();
    expect(r.handleHoles!.at.map(([u]) => u)).toEqual(l.handleHoles!.at.map(([u]) => l.box.d - u));
  });
  it('L corner plinth runs continuously round the corner', () => {
    const d0 = byTemplate('corner-l');
    if (d0.product.kind !== 'corner') throw Error();
    const m = buildModel(d0);
    const [a, b] = role(m.panels, 'plinth')
      .sort((p, q) => p.box.w - q.box.w)
      .reverse();
    // b (side wing) ends exactly on a's front face
    expect(b.box.z).toBe(a.box.z + a.box.d);
    expect(b.box.x).toBeGreaterThanOrEqual(a.box.x);
  });
});

describe('adjustable shelves in a short space (fuzz finding 2026-10-23)', () => {
  it('when pin holes fit on only one side, it is an error instead of a shelf resting on one edge', () => {
    const d = templates.find((t) => t.id === 'bookcase')!.create();
    if (d.product.kind !== 'cabinet') throw new Error('cabinet');
    // A 141 mm space between dividers: room for a +x hole at 64 mm but none on the −x grid (16 + 32k).
    d.product.params.interior = {
      id: 'r',
      kind: 'split',
      axis: 'y',
      sizes: [
        { mode: 'fr', value: 1 },
        { mode: 'mm', value: 141 },
      ],
      children: [
        { id: 'top', kind: 'empty' },
        {
          id: 'low',
          kind: 'split',
          axis: 'x',
          sizes: [
            { mode: 'fr', value: 1 },
            { mode: 'mm', value: 325 },
            { mode: 'fr', value: 1 },
          ],
          children: [
            { id: 'a', kind: 'empty' },
            { id: 'b', kind: 'shelves', count: 1, adjustable: true },
            { id: 'c', kind: 'empty' },
          ],
        },
      ],
    };
    const m = buildModel(d);
    expect(m.diagnostics.find((x) => x.code === 'pin-rows-short')?.severity).toBe('error');
  });
});
