import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { buildModel } from '../src/core/build';
import { cutlist, hardwareSummary } from '../src/core/cutlist';
import { templates, validateDesign } from '../src/core/design';
import { exportFusionPython } from '../src/core/fusion';
import { nestingJobs } from '../src/core/nesting/fromDesign';
import { cutlistCsvRo } from '../src/core/ro';
import { shoppingList } from '../src/core/shopping';
import { FINISHES, finishLook, isFinish } from '../src/core/surface';
import type { Design, Material } from '../src/core/types';
import { loadDesign, saveDesign } from '../src/persist/db';
import { takePictures, withPictures } from '../src/persist/images';
import { hasWebGL2, RENDER_SIZES, renderFileName } from '../src/ui/renderSupport';
import { defaultLook, parseLook } from '../src/ui/useLook';

const withFinish = (d: Design, finish: unknown): Design => ({
  ...d,
  materials: d.materials.map((m) => ({ ...m, finish }) as Material),
});
const kitchen = () => templates[0].create();

describe('board finish (ADR-066)', () => {
  it('accepts matte, satin and gloss, rejects anything else, and is optional', () => {
    const d = kitchen();
    expect(d.materials.every((m) => m.finish === undefined)).toBe(true);
    expect(validateDesign(d)).toEqual([]);
    for (const f of ['matte', 'satin', 'gloss'])
      expect(validateDesign(withFinish(d, f))).toEqual([]);
    for (const bad of ['shiny', '', 3, null])
      expect(validateDesign(withFinish(d, bad)).join()).toMatch(/Invalid finish/);
    expect(FINISHES.map((f) => f.label)).toEqual(['Matte', 'Satin', 'Gloss']);
    expect(isFinish('gloss') && !isFinish('Gloss')).toBe(true);
  });

  it('round-trips through the exported file and device storage', async () => {
    const d = withFinish(kitchen(), 'gloss');
    const file = JSON.parse(JSON.stringify(await withPictures(d, [d])));
    const back = (await takePictures(file)).data as Design;
    expect(validateDesign(back)).toEqual([]);
    expect(back.materials.map((m) => m.finish)).toEqual(d.materials.map(() => 'gloss'));
    await saveDesign(d);
    expect((await loadDesign(d.id))!.materials.every((m) => m.finish === 'gloss')).toBe(true);
  });

  it('never changes the cut list, CSV, sheets, shopping list, hardware or Fusion export', () => {
    const plain = kitchen();
    const gloss = withFinish(plain, 'gloss');
    const outputs = (d: Design) => {
      const model = buildModel(d);
      const rows = cutlist(model, d.materials);
      const hardware = hardwareSummary(model);
      return {
        rows,
        csv: cutlistCsvRo(rows),
        jobs: nestingJobs(d, model).jobs,
        hardware,
        shop: shoppingList({ rows, materials: d.materials, hardware, sheets: null }),
        // The Fusion file's header carries the time it was made.
        fusion: exportFusionPython(d, model).replace(/^# Generated .*$/m, ''),
      };
    };
    expect(outputs(gloss)).toEqual(outputs(plain));
  });

  it('looks glossier as the finish goes matte → satin → gloss; absent is matte', () => {
    const [m, s, g] = (['matte', 'satin', 'gloss'] as const).map(finishLook);
    expect(m.roughness).toBeGreaterThan(s.roughness);
    expect(s.roughness).toBeGreaterThan(g.roughness);
    expect(g.clearcoat).toBeGreaterThan(0);
    expect(finishLook(undefined)).toEqual(m);
  });
});

describe('3D look setting (ADR-066)', () => {
  it('defaults to realistic on laptops and simple on phones; reads only known values', () => {
    expect(defaultLook(1280)).toBe('realistic');
    expect(defaultLook(1024)).toBe('realistic');
    expect(defaultLook(390)).toBe('simple');
    expect(parseLook('realistic')).toBe('realistic');
    expect(parseLook('simple')).toBe('simple');
    expect(parseLook('fancy')).toBeNull();
    expect(parseLook(null)).toBeNull();
  });
});

describe('render a picture (ADR-067)', () => {
  it('needs WebGL 2 and never throws while checking', () => {
    expect(hasWebGL2(() => ({ getContext: (k) => (k === 'webgl2' ? {} : null) }))).toBe(true);
    expect(hasWebGL2(() => ({ getContext: () => null }))).toBe(false);
    expect(
      hasWebGL2(() => ({
        getContext: () => {
          throw new Error('blocked');
        },
      })),
    ).toBe(false);
  });

  it('offers 1920 × 1080 first, then 1280 × 720', () => {
    expect(RENDER_SIZES.map((s) => [s.width, s.height])).toEqual([
      [1920, 1080],
      [1280, 720],
    ]);
  });

  it('names the file after the design, without characters file systems refuse', () => {
    expect(renderFileName('Kitchen 3 m')).toBe('Kitchen 3 m render.png');
    expect(renderFileName('A/B: "corner"?')).toBe('A B corner render.png');
    expect(renderFileName('  ')).toBe('Furniture render.png');
  });
});
