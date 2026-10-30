// One PAL 18 board for every part by default; board choices come from the project's boards (ADR-164).
import { afterEach, describe, expect, it } from 'vitest';
import { boardChoices } from '../src/core/boards';
import { buildModel } from '../src/core/build';
import { defaultMaterials, templates } from '../src/core/design';
import { roleBoard } from '../src/core/finish';
import type { Decor } from '../src/core/materials';
import { makeItem, materialKey, newProject } from '../src/core/project';
import type { Design, Material } from '../src/core/types';
import { check, fieldOptions, toDesign } from '../src/core/wizard/engine';
import { setWizardBoards, STEPS } from '../src/core/wizard/steps';

const t = (id: string) => templates.find((x) => x.id === id)!.create();
/** Every board id the piece's root names (carcass, fronts, back, drawers, desk top, frame panels). */
function boardIds(d: Design): string[] {
  const p = d.product;
  switch (p.kind) {
    case 'cabinet':
    case 'corner':
      return [
        p.params.bodyMaterialId,
        p.params.frontMaterialId,
        p.params.backMaterialId,
        p.params.drawers.boxMaterialId,
        p.params.drawers.bottomMaterialId,
      ];
    case 'desk':
      return [
        p.params.topMaterialId,
        p.params.bodyMaterialId,
        p.params.frontMaterialId,
        p.params.drawers.boxMaterialId,
        p.params.drawers.bottomMaterialId,
      ];
    case 'frame':
      return [p.params.panelMaterialId];
    case 'panel':
      return [p.params.materialId];
    default:
      return [];
  }
}
const boardField = STEPS.flatMap((s) => s.fields).find((f) => f.id === 'board')!;
const oak = defaultMaterials().find((m) => m.id === 'pal18oak')!;
const blue: Material = { id: 'b', name: 'MDF blue', thickness: 18, grain: false, color: '#3355aa' };
const decor: Decor = {
  id: 'd1',
  list: 'mine.csv',
  maker: 'egger',
  makerText: 'Egger',
  kind: 'pal',
  code: 'H1145',
  name: 'Bardolino oak',
  thickness: 18,
  color: '#a07850',
} as Decor;

afterEach(() => setWizardBoards(null));

describe('PAL 18 by default (ADR-164)', () => {
  it('every template and new piece uses PAL 18 white for every board it names', () => {
    for (const id of [
      'chest',
      'bookcase',
      'base-door',
      'sideboard',
      'wardrobe',
      'corner-l',
      'desk-pedestal',
    ]) {
      const d = t(id);
      expect(new Set(boardIds(d)), id).toEqual(new Set(['pal18']));
      expect(
        buildModel(d).diagnostics.filter((x) => x.severity === 'error'),
        id,
      ).toEqual([]);
    }
  });

  it('the wizard puts its board on every board of the piece, PAL 18 when nothing else is offered', () => {
    for (const type of ['cabinet', 'wardrobe', 'desk', 'bed']) {
      const d = toDesign({ type })!;
      const ids = new Set(boardIds(d));
      expect(ids.size, type).toBe(1);
      expect(d.materials.find((m) => m.id === [...ids][0])!.name, type).toBe('PAL 18 white');
    }
    const oaky = toDesign({ type: 'cabinet', board: 'pal18oak' })!;
    expect(new Set(boardIds(oaky))).toEqual(new Set(['pal18oak']));
  });
});

describe('board choices (ADR-164)', () => {
  it('list the project boards, then the decors; the built-ins only when there is nothing else', () => {
    let p = newProject('Boards');
    p = { ...p, items: [makeItem(p, t('chest'))] };
    const keys = boardChoices(p, null, [decor]).map((c) => c.key);
    expect(keys.at(-1)).toBe('decor:d1');
    expect(keys.slice(0, -1)).toEqual(
      [...new Set(p.items[0].design.materials.map(materialKey))]
        .sort((a, b) => a.localeCompare(b))
        .filter((k) => keys.includes(k)),
    );
    expect(boardChoices(null, null, [decor]).map((c) => c.key)).toEqual(['decor:d1']);
    expect(boardChoices(null, null, []).map((c) => c.board.id)).toEqual(
      defaultMaterials().map((m) => m.id),
    );
    // A decor becomes a board with the list's values.
    const d = boardChoices(null, null, [decor])[0].board;
    expect([d.name, d.thickness, d.color]).toEqual(['Egger H1145 Bardolino oak', 18, '#a07850']);
  });

  it("the wizard offers them, defaults to the project's carcass board and copies a new board in", () => {
    let p = newProject('Boards');
    const chest = t('chest');
    const withBlue: Design = {
      ...chest,
      materials: [...chest.materials, blue],
      product:
        chest.product.kind === 'cabinet'
          ? { ...chest.product, params: { ...chest.product.params, bodyMaterialId: 'b' } }
          : chest.product,
    };
    p = { ...p, items: [makeItem(p, withBlue)] };
    const first = p.items[0].design;
    setWizardBoards(
      boardChoices(p, null, [decor]),
      first.materials.find((m) => m.id === roleBoard(first, 'body')),
    );
    const opts = fieldOptions(boardField, { type: 'cabinet' }).map((o) => o.label);
    expect(opts).toContain('MDF blue, 18 mm');
    expect(opts).toContain('Egger H1145 Bardolino oak, 18 mm (your list)');
    // The default is the project's carcass board, on every board of the new piece.
    const d = toDesign({ type: 'cabinet' })!;
    const ids = new Set(boardIds(d));
    expect(ids.size).toBe(1);
    expect(d.materials.find((m) => m.id === [...ids][0])!.name).toBe('MDF blue');
    expect(check({ type: 'cabinet' }).errors).toBe(0);
    // A decor answer: the decor's board on every part.
    const dd = toDesign({ type: 'wardrobe', board: 'decor:d1' })!;
    expect(new Set(boardIds(dd).map((id) => dd.materials.find((m) => m.id === id)!.name))).toEqual(
      new Set(['Egger H1145 Bardolino oak']),
    );
    // A board the wizard does not offer is an error; a built-in answer stored on a piece stays valid.
    expect(check({ type: 'cabinet', board: 'nope' }).errors).toBeGreaterThan(0);
    expect(opts).not.toContain('PAL 16 white (16 mm)');
    expect(check({ type: 'cabinet', board: 'pal16' }).errors).toBe(0);
    // Same as a built-in: keeps the built-in id, so stored answers stay valid.
    setWizardBoards(boardChoices(null, null, []), oak);
    expect(toDesign({ type: 'cabinet' })!.product.kind).toBe('cabinet');
    expect(new Set(boardIds(toDesign({ type: 'cabinet' })!))).toEqual(new Set(['pal18oak']));
  });
});
