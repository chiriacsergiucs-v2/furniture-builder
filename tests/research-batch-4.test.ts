// ADR-124: design codes, own edits carried on Replace and a newer revision, template references, project settings.
import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { catalogFamilies, insertVariant } from '../src/core/catalog';
import type { CatalogFamily } from '../src/core/catalog/types';
import { buildModel } from '../src/core/build';
import { validateDesign } from '../src/core/design';
import {
  carryEdits,
  carryText,
  ownEdits,
  resolveItem,
  settingsDiff,
  SIZE_SKIP,
  syncRef,
} from '../src/core/ownEdits';
import {
  makeItem,
  newProject,
  PROJECT_SCHEMA,
  resolvePlacements,
  validateProject,
  type Project,
} from '../src/core/project';
import {
  follows,
  followProject,
  setProjectSetting,
  settingOf,
  withSettings,
} from '../src/core/projectSettings';
import { codeIn, codeLink, decodeCode, encodeCode } from '../src/core/shareCode';
import type { Design, Handle, Material } from '../src/core/types';
import { useDesign } from '../src/store/designStore';

const variant = (familyId: string, variantId: string): Design => {
  const f = catalogFamilies.find((x) => x.id === familyId)!;
  return insertVariant(f, f.variants.find((v) => v.id === variantId)!)!;
};
const baseDoor = () => variant('base-doors', 'base-door');
const drawers3 = () => variant('base-drawers', 'drawers-3');
const table = () => variant('dining-table', 'dining-4'); // a frame: no fronts, no carcass
const knob: Handle = { kind: 'knob' };
const oak: Material = {
  id: 'oak',
  name: 'Oak veneer',
  thickness: 19,
  grain: true,
  color: '#b08850',
} as Material;

function project(designs: Design[]): Project {
  let p = newProject('Kitchen');
  for (const d of designs) p = { ...p, items: [...p.items, makeItem(p, d)] };
  return resolvePlacements(p);
}
/** The params without ids, to compare two designs by content. */
const content = (d: Design) =>
  JSON.stringify(d.product.params, (k, v: unknown) => (k === 'id' || /Id$/.test(k) ? undefined : v));

describe('design codes (ADR-124)', () => {
  it('a project round-trips through a code and through its link', async () => {
    const p = project([baseDoor(), drawers3()]);
    const code = await encodeCode(p);
    expect(code.startsWith('FB1-')).toBe(true);
    const back = await decodeCode(code);
    expect(back.ok && JSON.stringify(back.doc)).toBe(JSON.stringify(p));
    const link = codeLink('https://x.test/furniture-builder/#editor', code);
    expect(link).toBe(`https://x.test/furniture-builder/#open=${code}`);
    expect(codeIn(` ${link}\n`)).toBe(code);
    const viaLink = await decodeCode(link);
    expect(viaLink.ok && validateProject(viaLink.doc)).toEqual([]);
  });

  it('a damaged or foreign code is a message, never a throw', async () => {
    const code = await encodeCode(baseDoor());
    for (const bad of ['hello', 'FB1-', 'FB1-@@@', code.slice(0, code.length - 12)]) {
      const r = await decodeCode(bad);
      expect(r.ok).toBe(false);
      expect(r.ok ? '' : r.error).toMatch(/design code|damaged/);
    }
  });
});

describe('own edits (ADR-124, G-160)', () => {
  it('a fresh catalog copy has no own edits; ids never count', () => {
    const d = baseDoor();
    expect(settingsDiff(variant('base-doors', 'base-door'), d)).toEqual({});
  });

  it('carries every changed setting the new design has and lists the rest', () => {
    const p = withSettings(baseDoor(), { handle: knob });
    const item = makeItem(newProject(), p);
    const edits = ownEdits(item, catalogFamilies);
    expect(Object.keys(edits).length).toBeGreaterThan(0);
    const r = carryEdits(drawers3(), edits, SIZE_SKIP);
    expect(r.kept.length).toBeGreaterThan(0);
    expect(settingOf(r.design, 'handle')).toBe(JSON.stringify(knob));
    expect(validateDesign(r.design)).toEqual([]);
    expect(carryText(r)).toMatch(/^Kept: /);
  });

  it('the outer size is the new item’s on Replace, and an edit the new piece has no place for is listed', () => {
    const d = baseDoor();
    if (d.product.kind !== 'cabinet') throw new Error('cabinet expected');
    const wider = { ...d, product: { ...d.product, params: { ...d.product.params, width: 650 } } };
    const edits = { ...settingsDiff(baseDoor(), wider), 'nothing.here': 3 };
    const r = carryEdits(drawers3(), edits, SIZE_SKIP);
    const t = carryText(r);
    expect(t).toContain("width — the new item's size is used");
    expect(t).toContain('nothing here — the new piece has no such setting');
    const kept = buildModel(r.design).bounds.w;
    expect(kept).toBe(buildModel(drawers3()).bounds.w);
  });

  it('a carried edit that would add an error is not kept', () => {
    const r = carryEdits(drawers3(), { depth: 5 });
    expect(r.kept).toEqual([]);
    expect(r.notKept[0]).toMatch(/^depth — it does not fit/);
  });

  it('Replace in the store keeps the handle and says "Kept:"', () => {
    const p = project([withSettings(baseDoor(), { handle: knob })]);
    useDesign.getState().openProject(p);
    const id = p.items[0].id;
    const report = useDesign.getState().replaceItem(id, drawers3())!;
    expect(report.text).toMatch(/Kept: /);
    const now = useDesign.getState().project!.items[0];
    expect(settingOf(now.design, 'handle')).toBe(JSON.stringify(knob));
    expect(now.ref).toBeDefined();
  });
});

describe('template references (ADR-124, G-161)', () => {
  it('a catalog piece refers to its template; a piece of your own does not', () => {
    const p = newProject();
    expect(makeItem(p, baseDoor()).ref).toEqual({ overrides: {} });
    const own = baseDoor();
    delete own.catalog;
    expect(makeItem(p, own).ref).toBeUndefined();
  });

  it('overrides follow the piece; template + overrides rebuilds the same design', () => {
    const item = makeItem(newProject(), baseDoor());
    const edited = { ...item, design: withSettings(item.design, { handle: knob, plinthHeight: 120 }) };
    const synced = syncRef(edited, catalogFamilies);
    expect(Object.keys(synced.ref!.overrides).sort()).toEqual(
      Object.keys(settingsDiff(baseDoor(), edited.design)).sort(),
    );
    expect(content(resolveItem(synced, catalogFamilies))).toBe(content(edited.design));
  });

  it('a newer revision keeps the overrides; a missing template falls back to the kept copy', () => {
    const item = syncRef(
      { ...makeItem(newProject(), baseDoor()), design: withSettings(baseDoor(), { handle: knob }) },
      catalogFamilies,
    );
    const bumped: CatalogFamily[] = catalogFamilies.map((f) =>
      f.id === 'base-doors' ? { ...f, catalogVersion: f.catalogVersion + 1 } : f,
    );
    // The template moved on: the stored overrides are the piece's edits.
    expect(ownEdits(item, bumped)).toEqual(item.ref!.overrides);
    const f = bumped.find((x) => x.id === 'base-doors')!;
    const next = carryEdits(insertVariant(f, f.variants.find((v) => v.id === 'base-door')!)!, ownEdits(item, bumped));
    expect(settingOf(next.design, 'handle')).toBe(JSON.stringify(knob));
    expect(resolveItem(item, [])).toBe(item.design);
  });

  it('projects saved before version 12 still load; refs and settings need version 12', () => {
    const p = project([baseDoor()]);
    const { ref: _r, ...plain } = p.items[0];
    void _r;
    const old9 = { ...p, schemaVersion: 9, items: [plain] };
    expect(validateProject(old9)).toEqual([]);
    expect(validateProject({ ...old9, items: p.items })).toContain(
      'Template references need project schemaVersion 12',
    );
    expect(validateProject({ ...old9, settings: { handle: knob } })).toContain(
      'Project settings need project schemaVersion 12',
    );
    expect(PROJECT_SCHEMA).toBe(12);
    expect(validateProject({ ...p, settings: { plinthHeight: 900 } })).toContain(
      'Project plinth height must be 0 to 500 mm',
    );
  });
});

describe('project-wide settings (ADR-124, G-162)', () => {
  it('a setting reaches every piece that has the part; a table has no fronts', () => {
    const p = project([baseDoor(), drawers3(), table()]);
    const r = setProjectSetting(p, 'front', oak);
    expect(r.applied).toHaveLength(2);
    expect(r.project.items.map((i) => follows(r.project, i, 'front'))).toEqual([
      'follows',
      'follows',
      'n/a',
    ]);
  });

  it('a change reaches following pieces only; Follow project brings one back', () => {
    let p = setProjectSetting(project([baseDoor(), baseDoor()]), 'handle', knob).project;
    // The second piece gets its own handle.
    const own = withSettings(p.items[1].design, { handle: { kind: 'bar' } });
    p = { ...p, items: [p.items[0], { ...p.items[1], design: own }] };
    expect(follows(p, p.items[1], 'handle')).toBe('own');
    const r = setProjectSetting(p, 'handle', { kind: 'push' });
    expect(r.applied).toHaveLength(1);
    expect(settingOf(r.project.items[1].design, 'handle')).toBe(JSON.stringify({ kind: 'bar' }));
    const back = followProject(r.project, p.items[1].id, 'handle');
    expect(follows(back, back.items[1], 'handle')).toBe('follows');
  });

  it('every setting gives a valid design; clearing one changes no piece', () => {
    const p0 = project([baseDoor(), drawers3()]);
    let p = p0;
    p = setProjectSetting(p, 'body', oak).project;
    p = setProjectSetting(p, 'back', { ...oak, id: 'b', name: 'HDF', thickness: 3 }).project;
    p = setProjectSetting(p, 'frontStyle', 'inset').project;
    p = setProjectSetting(p, 'plinthHeight', 120).project;
    for (const it of p.items) expect(validateDesign(it.design)).toEqual([]);
    expect(validateProject({ ...p, schemaVersion: PROJECT_SCHEMA })).toEqual([]);
    const cleared = setProjectSetting(p, 'plinthHeight', undefined);
    expect(cleared.applied).toEqual([]);
    expect(cleared.project.items).toBe(p.items);
    expect(cleared.project.settings?.plinthHeight).toBeUndefined();
  });

  it('in the store: one undo step, and a new piece follows the settings', () => {
    useDesign.getState().openProject(project([baseDoor()]));
    const before = useDesign.getState().projectPast.length;
    expect(useDesign.getState().setProjectSetting('handle', knob)).toHaveLength(1);
    expect(useDesign.getState().projectPast.length).toBe(before + 1);
    useDesign.getState().addPiece(baseDoor());
    const p = useDesign.getState().project!;
    expect(follows(p, p.items[1], 'handle')).toBe('follows');
    useDesign.getState().undoProject();
    useDesign.getState().undoProject();
    expect(useDesign.getState().project!.settings).toBeUndefined();
  });
});

beforeEach(() => {
  useDesign.getState().closeProject();
});
