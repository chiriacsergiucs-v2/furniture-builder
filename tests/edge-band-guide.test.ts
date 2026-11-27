import 'fake-indexeddb/auto';
import { afterEach, describe, expect, it } from 'vitest';
import { setPrintLang } from '@furniture-builder/i18n/print';
import { buildModel } from '../src/core/build';
import { cutlist } from '../src/core/cutlist';
import { SCHEMA_VERSION, templates, upgradeDesign, validateDesign } from '../src/core/design';
import { boardBandGuideRo, boardBandRo } from '../src/core/ro';
import type { Design, EdgeBand, Material } from '../src/core/types';
import { loadDesign, saveDesign } from '../src/persist/db';

// ADR-301 (G-460): a band's tolerances and edgebander settings, typed by the user, never filled in (ADR-010).

const chest = (): Design => templates.find((t) => t.id === 'chest')!.create();
const carcassOf = (d: Design) =>
  buildModel(d).panels.find((p) => p.role === 'side' && p.banded.length)!.materialId;
const patch = (d: Design, id: string, p: Partial<Material>): Design => ({
  ...d,
  materials: d.materials.map((m) => (m.id === id ? { ...m, ...p } : m)),
});
const ABS08: EdgeBand = { kind: 'abs', thickness: 8, width: 22, code: 'H1145' };
const GUIDED: EdgeBand = {
  ...ABS08,
  thicknessTolerance: 1,
  widthTolerance: 5,
  overhang: 20,
  edgebander: '210 °C, 12 m/min',
};

afterEach(() => setPrintLang('ro'));

describe('band tolerances and edgebander settings (ADR-301)', () => {
  it('are empty by default: no template band carries them', () => {
    const guide = ['thicknessTolerance', 'widthTolerance', 'overhang', 'edgebander'];
    for (const tpl of templates) {
      const d = tpl.create();
      const bands = d.materials.flatMap((m) => [m.band, m.frontBand]).filter(Boolean);
      for (const b of bands) for (const k of guide) expect(b).not.toHaveProperty(k);
    }
    const d = chest();
    const rows = cutlist(buildModel(d), d.materials);
    expect(boardBandGuideRo(rows.filter((r) => r.materialId === carcassOf(d)))).toBeNull();
  });

  it('validate each field, and need schemaVersion 14; version 13 files still load', () => {
    const d = chest();
    const id = carcassOf(d);
    expect(SCHEMA_VERSION).toBe(14);
    expect(validateDesign(patch(d, id, { band: GUIDED, frontBand: GUIDED }))).toEqual([]);
    for (const bad of [
      { thicknessTolerance: 0 },
      { widthTolerance: 101 },
      { overhang: 1.5 },
      { edgebander: '' },
      { edgebander: 'x'.repeat(201) },
      { edgebander: 5 },
    ])
      expect(
        validateDesign(patch(d, id, { band: { ...ABS08, ...bad } as EdgeBand })).join(),
      ).toMatch(/Invalid edge band/);
    const v13 = { ...patch(d, id, { band: ABS08 }), schemaVersion: 13 as const };
    expect(validateDesign(v13)).toEqual([]);
    expect(upgradeDesign(v13).schemaVersion).toBe(14);
    expect(
      validateDesign({ ...v13, materials: patch(d, id, { band: GUIDED }).materials }),
    ).toContain('Band tolerances and edgebander settings need schemaVersion 14');
    expect(
      validateDesign({ ...v13, partBands: { p1: { ...ABS08, overhang: 10 } } } as Design),
    ).toContain('Band tolerances and edgebander settings need schemaVersion 14');
  });

  it('save to the device and a file and reload equal', async () => {
    const d = patch(chest(), carcassOf(chest()), { band: GUIDED });
    const file = JSON.parse(JSON.stringify(d)) as Design;
    expect(validateDesign(file)).toEqual([]);
    expect(file).toEqual(d);
    await saveDesign(d);
    const back = await loadDesign(d.id);
    expect(back).toEqual(d);
    expect(back!.materials.find((m) => m.band?.edgebander)!.band).toEqual(GUIDED);
  });

  it('print on the cut sheet only when filled, in Romanian, Russian and English; cut sizes unchanged', () => {
    const d = chest();
    const id = carcassOf(d);
    const own = (x: Design) =>
      cutlist(buildModel(x), x.materials).filter((r) => r.materialId === id);
    expect(boardBandGuideRo(own(patch(d, id, { band: ABS08 })))).toBeNull();
    const g = patch(d, id, { band: GUIDED });
    expect(boardBandRo(own(g))).toBe('cant ABS 0,8 × 22 mm, H1145');
    expect(boardBandGuideRo(own(g))).toBe(
      'cant, după fișa dvs. (orientativ): ABS 0,8 × 22 mm, H1145: grosime ±0,1 mm, lățime ±0,5 mm, ' +
        'surplus de tăiat 2 mm pe parte, mașina de cantuit: 210 °C, 12 m/min',
    );
    // Only the overhang filled: only it prints.
    expect(boardBandGuideRo(own(patch(d, id, { band: { ...ABS08, overhang: 15 } })))).toBe(
      'cant, după fișa dvs. (orientativ): ABS 0,8 × 22 mm, H1145: surplus de tăiat 1,5 mm pe parte',
    );
    setPrintLang('ru');
    expect(boardBandGuideRo(own(g))).toBe(
      'кромка, по вашему техническому листу (ориентир): ABS 0,8 × 22 мм, H1145: толщина ±0,1 мм, ' +
        'ширина ±0,5 мм, свес под обрезку 2 мм на сторону, кромкооблицовочный станок: 210 °C, 12 m/min',
    );
    setPrintLang('en');
    expect(boardBandGuideRo(own(g))).toBe(
      'edge band, from your datasheet (guidance): ABS 0.8 × 22 mm, H1145: thickness ±0.1 mm, ' +
        'width ±0.5 mm, overhang to trim 2 mm per side, edgebander: 210 °C, 12 m/min',
    );
    const sizes = (x: Design) =>
      cutlist(buildModel(x), x.materials).map((r) => [r.length, r.width, r.edgesL, r.edgesW]);
    expect(sizes(g)).toEqual(sizes(patch(d, id, { band: ABS08 })));
  });
});
