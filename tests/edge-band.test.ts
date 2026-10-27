import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { buildModel } from '../src/core/build';
import { boardBandText, cutlist, hardwareSummary } from '../src/core/cutlist';
import { SCHEMA_VERSION, templates, upgradeDesign, validateDesign } from '../src/core/design';
import { bandText, parseTenths, tenthsText } from '../src/core/materials';
import {
  buildProjectModel,
  makeItem,
  newProject,
  projectCutlist,
  suggestRunParts,
} from '../src/core/project';
import { boardBandRo, CSV_HEADERS_RO, cutlistCsvRo } from '../src/core/ro';
import { shoppingList } from '../src/core/shopping';
import type { Design, EdgeBand, Material } from '../src/core/types';
import { loadDesign, saveDesign } from '../src/persist/db';

const chest = () => templates.find((t) => t.id === 'chest')!.create();
const patch = (d: Design, id: string, p: Partial<Material>): Design => ({
  ...d,
  materials: d.materials.map((m) => (m.id === id ? { ...m, ...p } : m)),
});
const ABS08: EdgeBand = { kind: 'abs', thickness: 8, width: 22, code: 'H1145' };
const ABS2: EdgeBand = { kind: 'abs', thickness: 20, width: 22 };
/** Board ids of the chest's banded carcass and front parts. */
function boards(d: Design) {
  const panels = buildModel(d).panels.filter((p) => p.banded.length);
  const front = panels.find((p) => p.role === 'drawer-front')!.materialId;
  const carcass = panels.find((p) => p.role === 'side')!.materialId;
  return { front, carcass };
}
const shop = (d: Design) => {
  const model = buildModel(d);
  return shoppingList({
    rows: cutlist(model, d.materials),
    materials: d.materials,
    hardware: hardwareSummary(model),
    sheets: null,
  });
};

describe('edge band specs on boards (ADR-077)', () => {
  it('validate the type list, thickness 1–100 tenths and width 1–100 mm, and are optional', () => {
    const d = chest();
    const id = boards(d).carcass;
    expect(validateDesign(d)).toEqual([]);
    expect(validateDesign(patch(d, id, { band: ABS08, frontBand: ABS2 }))).toEqual([]);
    for (const kind of ['abs', 'pvc', 'pp', 'melamine', 'veneer', 'other'] as const)
      expect(validateDesign(patch(d, id, { band: { ...ABS08, kind } }))).toEqual([]);
    for (const [thickness, width] of [
      [1, 1],
      [100, 100],
    ])
      expect(validateDesign(patch(d, id, { band: { kind: 'pvc', thickness, width } }))).toEqual([]);
    const bad: unknown[] = [
      { ...ABS08, kind: 'wood' },
      { ...ABS08, thickness: 0 },
      { ...ABS08, thickness: 101 },
      { ...ABS08, thickness: 0.8 },
      { ...ABS08, width: 0 },
      { ...ABS08, width: 101 },
      { ...ABS08, width: 22.5 },
      { ...ABS08, code: 5 },
      { ...ABS08, allowance: -1 },
      { kind: 'abs', width: 22 },
      'ABS 0.8 x 22',
      null,
    ];
    for (const band of bad) {
      expect(validateDesign(patch(d, id, { band: band as EdgeBand })).join()).toMatch(
        /Invalid edge band/,
      );
      expect(validateDesign(patch(d, id, { frontBand: band as EdgeBand })).join()).toMatch(
        /Invalid front edge band/,
      );
    }
  });

  it('round-trip through a file and device storage; older files load unchanged', async () => {
    const d = patch(chest(), boards(chest()).carcass, {
      band: { ...ABS08, allowance: 30 },
      frontBand: ABS2,
    });
    expect(d.schemaVersion).toBe(SCHEMA_VERSION);
    expect(SCHEMA_VERSION).toBe(4);
    const file = JSON.parse(JSON.stringify(d)) as Design;
    expect(validateDesign(file)).toEqual([]);
    expect(file).toEqual(d);
    await saveDesign(d);
    expect(await loadDesign(d.id)).toEqual(d);
    // Version 2 (and 1, in core.test.ts) still validate and upgrade to 4 with the same parts.
    const v2 = { ...chest(), schemaVersion: 2 as const };
    expect(validateDesign(v2)).toEqual([]);
    const up = upgradeDesign(v2);
    expect(up.schemaVersion).toBe(4);
    expect(up.materials).toEqual(v2.materials);
    expect(buildModel(up).panels).toEqual(buildModel(v2).panels);
    expect(upgradeDesign(up)).toBe(up);
    expect(validateDesign({ ...chest(), schemaVersion: 5 }).join()).toMatch(/schemaVersion/);
  });

  it('never change cut sizes (ADR-009): only the band is named', () => {
    const d = chest();
    const { carcass, front } = boards(d);
    const banded = patch(patch(d, carcass, { band: ABS08, frontBand: ABS2 }), front, {
      band: { kind: 'pvc', thickness: 10, width: 23 },
    });
    const sizes = (x: Design) =>
      cutlist(buildModel(x), x.materials)
        .map((r) => [r.materialId, r.thickness, r.length, r.width, r.edgesL, r.edgesW, r.quantity])
        .sort();
    expect(sizes(banded)).toEqual(sizes(d));
    expect(buildModel(banded).panels).toEqual(buildModel(d).panels);
  });

  it('name the band in each board header, the parts CSV and the printed sheet', () => {
    const d = chest();
    const { carcass } = boards(d);
    const rows = cutlist(buildModel(d), d.materials);
    const own = (rs: typeof rows) => rs.filter((r) => r.materialId === carcass);
    expect(boardBandText(own(rows))).toBe('Edge band: not named yet');
    expect(boardBandRo(own(rows))).toBe('cant nespecificat');
    const named = patch(d, carcass, { band: ABS08 });
    const r2 = cutlist(buildModel(named), named.materials);
    expect(boardBandText(own(r2))).toBe('Edge band: ABS 0.8 × 22 mm, H1145');
    expect(boardBandRo(own(r2))).toBe('cant ABS 0,8 × 22 mm, H1145');
    const csv = cutlistCsvRo(r2);
    const [head, ...lines] = csv.slice(1).trim().split('\r\n');
    expect(head.split(';')).toEqual(CSV_HEADERS_RO);
    expect(CSV_HEADERS_RO).toContain('Tip cant');
    expect(lines.some((l) => l.includes('ABS 0,8 × 22 mm, H1145'))).toBe(true);
    expect(csv).toContain('nespecificat'); // other boards' banded parts: not named yet
    expect(bandText(ABS2)).toBe('ABS 2 × 22 mm');
    expect(tenthsText(4)).toBe('0.4');
    expect(parseTenths('0,8')).toBe(8);
    expect(parseTenths('1.25')).toBeNull();
    expect(parseTenths('0')).toBeNull();
  });

  it('give doors and drawer fronts their own band only when one is set', () => {
    const d = chest();
    const { front } = boards(d);
    const one = patch(d, front, { band: ABS08 });
    const fr = (x: Design) =>
      cutlist(buildModel(x), x.materials).filter((r) => r.labels.includes('Drawer front'));
    expect(fr(one).every((r) => r.band?.thickness === 8 && !r.bandFront)).toBe(true);
    const two = patch(one, front, { frontBand: ABS2 });
    expect(fr(two).some((r) => r.band?.thickness === 20 && r.bandFront)).toBe(true);
    expect(
      boardBandText(cutlist(buildModel(two), two.materials).filter((r) => r.materialId === front)),
    ).toMatch(/fronts ABS 2 × 22 mm/);
  });

  it('shopping list: one line per band with its metres, shared bands combined, allowance added', () => {
    const d = chest();
    const { carcass, front } = boards(d);
    const both = patch(patch(d, carcass, { band: ABS08 }), front, { band: ABS08 });
    const rows = cutlist(buildModel(both), both.materials);
    const metres = (ids: string[], a = 0) =>
      rows
        .filter((r) => ids.includes(r.materialId))
        .reduce(
          (s, r) => s + (r.edgesL * (r.length + a) + r.edgesW * (r.width + a)) * r.quantity,
          0,
        ) / 1000;
    const edges = rows
      .filter((r) => [carcass, front].includes(r.materialId))
      .reduce((n, r) => n + (r.edgesL + r.edgesW) * r.quantity, 0);
    const lines = shop(both).filter((l) => l.section === 'banding');
    expect(lines).toHaveLength(1);
    expect(lines[0].label).toBe('ABS 0.8 × 22 mm, H1145');
    expect(lines[0].unit).toBe('m');
    expect(lines[0].quantity).toBeCloseTo(metres([carcass, front]), 2);
    expect(lines[0].priceKey).toBe('band:ABS 0.8 × 22 mm, H1145');
    // A 30 mm trim allowance per edge on both boards adds 30 mm for every banded edge.
    const trim = patch(patch(d, carcass, { band: { ...ABS08, allowance: 30 } }), front, {
      band: { ...ABS08, allowance: 30 },
    });
    const withTrim = shop(trim).filter((l) => l.section === 'banding');
    expect(withTrim).toHaveLength(1);
    expect(withTrim[0].quantity).toBeCloseTo(metres([carcass, front]) + (edges * 30) / 1000, 2);
    // Different bands stay apart.
    const apart = patch(both, front, { band: ABS2 });
    expect(
      shop(apart)
        .filter((l) => l.section === 'banding')
        .map((l) => l.label)
        .sort(),
    ).toEqual(['ABS 0.8 × 22 mm, H1145', 'ABS 2 × 22 mm']);
  });

  it('shopping list: boards without a band are to choose before buying, not priced', () => {
    const d = chest();
    const { carcass, front } = boards(d);
    const lines = shop(patch(d, carcass, { band: ABS08 }));
    const name = d.materials.find((m) => m.id === front)!.name;
    const choose = lines.find((l) => l.section === 'choose' && l.label === `Edge band for ${name}`);
    expect(choose).toBeDefined();
    expect(choose!.quantity).toBeGreaterThan(0);
    expect(choose!.priceKey).toBeUndefined();
    expect(lines.filter((l) => l.section === 'banding').map((l) => l.label)).toEqual([
      'ABS 0.8 × 22 mm, H1145',
    ]);
    expect(shop(d).some((l) => l.section === 'banding')).toBe(false);
  });

  it('a band narrower than the board it covers is an error; as wide or wider is fine', () => {
    const d = chest();
    const { carcass, front } = boards(d);
    const t = d.materials.find((m) => m.id === carcass)!.thickness;
    const errs = (x: Design) => buildModel(x).diagnostics.filter((g) => g.code === 'band-narrow');
    const narrow = patch(d, carcass, { band: { kind: 'abs', thickness: 8, width: t - 1 } });
    const e = errs(narrow);
    expect(e).toHaveLength(1);
    expect(e[0].severity).toBe('error');
    expect(e[0].message).toBe(
      `Edge band ABS 0.8 × ${t - 1} mm on ${d.materials.find((m) => m.id === carcass)!.name} is narrower than the ${t} mm board.`,
    );
    expect(e[0].panelIds!.length).toBeGreaterThan(1);
    expect(errs(patch(d, carcass, { band: { kind: 'abs', thickness: 8, width: t } }))).toEqual([]);
    expect(errs(patch(d, carcass, { band: ABS08 }))).toEqual([]);
    // A narrow front band is checked on the fronts only.
    const ft = d.materials.find((m) => m.id === front)!.thickness;
    const fronts = patch(d, front, {
      band: ABS08,
      frontBand: { kind: 'pvc', thickness: 20, width: ft - 2 },
    });
    expect(errs(fronts)).toHaveLength(1);
    expect(errs(fronts)[0].message).toMatch(/^Edge band PVC 2 × /);
  });

  it('a project keeps parts with different bands apart and combines the same band', () => {
    const a = patch(chest(), boards(chest()).carcass, { band: ABS08 });
    const b = { ...chest(), name: 'Other chest' };
    let p = newProject('Bands');
    p = {
      ...p,
      items: [makeItem(p, a), { ...makeItem(p, b), position: { x: 1500, y: 0, z: 0 } }],
    };
    const rows = projectCutlist(p);
    const sides = rows.filter((r) => r.labels.some((l) => /Left side/.test(l)));
    expect(sides.some((r) => r.band) && sides.some((r) => !r.band)).toBe(true);
    expect(boardBandText(rows.filter((r) => r.materialId === sides[0].materialId))).toMatch(
      /ABS 0.8 × 22 mm, H1145 · some parts not named yet/,
    );
  });

  it('run parts take the band named on their board in the pieces, and are checked too', () => {
    let p = newProject('Run');
    for (let i = 0; i < 3; i++) {
      const d = templates.find((t) => t.id === 'base-door')!.create();
      const under =
        d.product.kind === 'cabinet'
          ? {
              ...d,
              product: { ...d.product, params: { ...d.product.params, bottom: 'under' as const } },
            }
          : d;
      p = { ...p, items: [...p.items, makeItem(p, under)] };
    }
    p = { ...p, runParts: suggestRunParts(p), runSettings: { scribe: 0, auto: true } };
    const run = projectCutlist(p).filter((r) => r.labels.some((l) => l.startsWith('Run: ')));
    const banded = run.find((r) => r.edgesL + r.edgesW > 0);
    expect(banded).toBeDefined();
    expect(banded!.band).toBeUndefined();
    const name = banded!.materialName;
    const t = p.runParts!.find((rp) => rp.material.name === name)!.material.thickness;
    const named = (width: number) => ({
      ...p,
      items: p.items.map((it) => ({
        ...it,
        design: {
          ...it.design,
          materials: it.design.materials.map((m) =>
            m.name === name ? { ...m, band: { kind: 'abs' as const, thickness: 20, width } } : m,
          ),
        },
      })),
    });
    const wide = named(t + 4);
    const after = projectCutlist(wide).filter((r) => r.labels.some((l) => l.startsWith('Run: ')));
    expect(after.find((r) => r.materialName === name && r.edgesL + r.edgesW)!.band?.width).toBe(
      t + 4,
    );
    const narrowErr = (q: typeof p) =>
      buildProjectModel(q).diagnostics.filter(
        (d) => d.code === 'band-narrow' && d.nodeId?.startsWith('run:'),
      );
    expect(narrowErr(wide)).toEqual([]);
    expect(narrowErr(named(t - 1)).length).toBeGreaterThan(0);
  });
});
