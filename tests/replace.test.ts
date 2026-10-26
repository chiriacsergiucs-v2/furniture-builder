import { beforeEach, describe, expect, it } from 'vitest';
import { catalogFamilies, insertVariant } from '../src/core/catalog';
import { mirrorItem } from '../src/core/arrange';
import { roleBoard } from '../src/core/finish';
import {
  buildProjectModel,
  makeItem,
  newProject,
  placedBounds,
  resolvePlacements,
  type Project,
  type ProjectItem,
} from '../src/core/project';
import {
  designEdited,
  fitsPlacement,
  replaceItem,
  replaceOptions,
  replaceReport,
} from '../src/core/replace';
import type { Design, Material } from '../src/core/types';
import { useDesign } from '../src/store/designStore';

const variant = (familyId: string, variantId: string): Design => {
  const f = catalogFamilies.find((x) => x.id === familyId)!;
  return insertVariant(
    f,
    f.variants.find((v) => v.id === variantId)!,
  )!;
};
const baseDoor = () => variant('base-doors', 'base-door'); // 600 wide, floor
const drawers3 = () => variant('base-drawers', 'drawers-3'); // 600 wide, floor
const drawers800 = () => variant('base-drawers', 'drawers-800'); // 800 wide, floor
const wall600 = () => variant('wall-cabinet', 'wall-1-door'); // 600 wide, wall

function run(designs: Design[]): Project {
  let p = newProject('Kitchen');
  for (const d of designs) p = { ...p, items: [...p.items, makeItem(p, d)] };
  return resolvePlacements(p);
}
const board = (d: Design, role: 'front' | 'body'): Material =>
  d.materials.find((m) => m.id === roleBoard(d, role))!;
const oak: Material = {
  id: 'oak',
  name: 'Oak veneer',
  thickness: 19,
  grain: true,
  color: '#b08850',
} as Material;

describe('replaceItem (ADR-098)', () => {
  it('keeps id, position, turn, quantity, placement, zones, lock, group and boards by role', () => {
    const p0 = run([baseDoor(), baseDoor()]);
    const it0 = p0.items[1];
    // The old piece has an oak front (as finish scope would put it) and a custom carcass board name.
    const old = it0.design;
    const body = { ...board(old, 'body'), name: 'Grey carcass' };
    const edited: Design = {
      ...old,
      materials: [...old.materials.map((m) => (m.id === body.id ? body : m)), oak],
      product:
        old.product.kind === 'cabinet'
          ? { ...old.product, params: { ...old.product.params, frontMaterialId: 'oak' } }
          : old.product,
      updatedAt: '2030-01-01T00:00:00.000Z',
    };
    // Lock (ADR-095) and group (ADR-097) are fields on the item; whatever the item carries is kept.
    const item = {
      ...it0,
      design: edited,
      quantity: 3,
      rotationY: 90,
      position: { x: 1700, y: 0, z: 40 },
      zones: { service: { side: 'back', depth: 50 } },
      locked: true,
      group: 'g1',
      libraryId: 'lib-1',
    } as ProjectItem;
    const p = { ...p0, items: [p0.items[0], item] };
    const fresh = drawers3();
    const next = replaceItem(p, item.id, fresh);
    const got = next.items[1] as ProjectItem & { locked?: boolean; group?: string };
    expect(got.id).toBe(item.id);
    expect(got.position).toEqual(item.position);
    expect(got.rotationY).toBe(90);
    expect(got.quantity).toBe(3);
    expect(got.placement).toEqual(item.placement);
    expect(got.zones).toEqual(item.zones);
    expect(got.locked).toBe(true);
    expect(got.group).toBe('g1');
    // The design is the new item's copy with its own catalog origin; the saved-piece link goes with the old design.
    expect(got.design.catalog?.origin?.variantId).toBe('drawers-3');
    expect(got.design.id).toBe(fresh.id);
    expect(got.libraryId).toBeUndefined();
    // Boards carry over by part role.
    expect(board(got.design, 'front').name).toBe('Oak veneer');
    expect(board(got.design, 'front').thickness).toBe(19);
    expect(board(got.design, 'body').name).toBe('Grey carcass');
    // The other piece and the input are untouched.
    expect(next.items[0]).toBe(p.items[0]);
    expect(board(fresh, 'front').name).not.toBe('Oak veneer');
  });

  it('a piece turned to face the back wall keeps its back and left side; a deeper one grows into the room', () => {
    const p0 = run([baseDoor()]);
    const it0 = {
      ...p0.items[0],
      rotationY: 180,
      position: { x: 1000, y: 0, z: 2000 },
    } as ProjectItem;
    const p = { ...p0, items: [it0] };
    const a = placedBounds(it0);
    const next = replaceItem(p, it0.id, drawers800());
    const b = placedBounds(next.items[0]);
    // Back at +z and left side at +x stay put.
    expect(b.z + b.d).toBe(a.z + a.d);
    expect(b.x + b.w).toBe(a.x + a.w);
    expect(b.w).toBe(800);
  });

  it('the new copy drops its own default boards once the old boards took their place', () => {
    const p0 = run([baseDoor()]);
    const old = p0.items[0].design;
    const withOak: Design = {
      ...old,
      materials: [...old.materials, oak],
      product:
        old.product.kind === 'cabinet'
          ? { ...old.product, params: { ...old.product.params, frontMaterialId: 'oak' } }
          : old.product,
    };
    const p = { ...p0, items: [{ ...p0.items[0], design: withOak }] };
    const fresh = drawers3();
    const freshFront = board(fresh, 'front');
    const got = replaceItem(p, p.items[0].id, fresh).items[0].design;
    // The copy's own front board is no longer used by any part: it goes; the oak board is there once.
    expect(got.materials.some((m) => m.id === freshFront.id)).toBe(false);
    expect(got.materials.filter((m) => m.name === 'Oak veneer')).toHaveLength(1);
    expect(roleBoard(got, 'front')).toBe(got.materials.find((m) => m.name === 'Oak veneer')!.id);
  });

  it('a missing item leaves the project as it is', () => {
    const p = run([baseDoor()]);
    expect(replaceItem(p, 'nope', drawers3())).toBe(p);
  });

  it('a part role the new design lacks is skipped; a role the old one lacks keeps the default board', () => {
    const p = run([baseDoor()]);
    const front = variant('integrated-front', 'front-dishwasher-600'); // panel: a front, no carcass
    const next = replaceItem(p, p.items[0].id, front);
    expect(roleBoard(next.items[0].design, 'body')).toBeNull();
    expect(board(next.items[0].design, 'front').name).toBe(board(p.items[0].design, 'front').name);
  });

  it('a wall piece stays on the wall at its height', () => {
    const p = run([wall600()]);
    expect(p.items[0].placement?.kind).toBe('wall');
    const next = resolvePlacements(
      replaceItem(p, p.items[0].id, variant('wall-cabinet', 'wall-hood')),
    );
    expect(next.items[0].placement).toEqual(p.items[0].placement);
    expect(next.items[0].position).toEqual(p.items[0].position);
  });
});

describe('replaceOptions (ADR-098: same width; others behind a switch)', () => {
  it('a 600 base unit gets 600 floor items first, none from the wall, not its own variant', () => {
    const p = run([baseDoor()]);
    const opts = replaceOptions(p.items[0], catalogFamilies);
    const same = opts.filter((o) => o.sameWidth);
    expect(same.length).toBeGreaterThan(3);
    expect(same.every((o) => o.w === 600)).toBe(true);
    expect(same.some((o) => o.variant.id === 'drawers-3')).toBe(true);
    expect(opts.some((o) => o.variant.id === 'base-door')).toBe(false);
    expect(opts.some((o) => o.family.id === 'wall-cabinet')).toBe(false);
    // Same width first, then the other widths, nearest first.
    const firstOther = opts.findIndex((o) => !o.sameWidth);
    expect(opts.slice(firstOther).every((o) => !o.sameWidth)).toBe(true);
    expect(opts.some((o) => o.variant.id === 'drawers-800' && !o.sameWidth)).toBe(true);
    const gaps = opts.slice(firstOther).map((o) => Math.abs(o.w - 600));
    expect(gaps).toEqual([...gaps].sort((a, b) => a - b));
  });

  it('a wall piece is offered wall-hung items only; a piece on another piece any', () => {
    const p = run([wall600()]);
    const opts = replaceOptions(p.items[0], catalogFamilies);
    expect(opts.length).toBeGreaterThan(0);
    expect(opts.every((o) => o.family.id === 'wall-cabinet' || o.variant.id === 'media-wall')).toBe(
      true,
    );
    const above = {
      ...p.items[0],
      placement: { kind: 'above', baseId: 'x', gap: 0, offsetX: 0 },
    } as ProjectItem;
    expect(fitsPlacement(above, baseDoor())).toBe(true);
    expect(fitsPlacement(p.items[0], baseDoor())).toBe(false);
  });

  it('a piece on another piece is offered same-width items only (G-102)', () => {
    const p = run([wall600()]);
    const above = {
      ...p.items[0],
      placement: { kind: 'above', baseId: 'x', gap: 0, offsetX: 0 },
    } as ProjectItem;
    const opts = replaceOptions(above, catalogFamilies);
    expect(opts.length).toBeGreaterThan(0);
    expect(opts.every((o) => o.sameWidth && o.w === 600)).toBe(true);
    // Standing and wall-hung items both count, as the placement carries over.
    expect(opts.some((o) => o.family.id === 'wall-cabinet')).toBe(true);
    expect(opts.some((o) => o.family.id !== 'wall-cabinet')).toBe(true);
  });

  it('an edited piece is told apart from a fresh copy', () => {
    const d = baseDoor();
    expect(designEdited(d, catalogFamilies)).toBe(false);
    expect(designEdited({ ...d, updatedAt: '2030-01-01T00:00:00.000Z' }, catalogFamilies)).toBe(
      true,
    );
    // A mirror changes the copy without stamping it: still an edit.
    const p = run([variant('base-doors', 'base-door')]);
    const mirrored = mirrorItem(p, p.items[0].id).project.items[0].design;
    expect(mirrored.updatedAt).toBe(mirrored.createdAt);
    expect(designEdited(mirrored, catalogFamilies)).toBe(true);
  });
});

describe('replacing in the store: run parts follow, one undo step (ADR-098, ADR-061)', () => {
  const s = () => useDesign.getState();
  beforeEach(() => {
    s().openProject(run([baseDoor(), baseDoor(), baseDoor()]));
    s().suggestRunParts();
  });

  it('a wider piece at the end of the run lengthens the worktop in the same step; undo restores both', () => {
    const worktop = () => s().project!.runParts!.find((r) => r.kind === 'worktop')!;
    expect(worktop()).toBeTruthy();
    const before = s().project!;
    const w0 = worktop().box.w;
    const last = before.items[2];
    const steps = s().projectPast.length;
    const report = s().replaceItem(last.id, drawers800())!;
    expect(s().projectPast.length).toBe(steps + 1);
    expect(s().project!.items[2].id).toBe(last.id);
    expect(s().project!.items[2].design.catalog?.origin?.variantId).toBe('drawers-800');
    expect(worktop().box.w).toBe(w0 + 200);
    expect(report.text).toMatch(/^Replaced\./);
    expect(report.text).toContain('600 → 800 mm wide');
    expect(report.text).toContain(`Worktop ${w0} → ${w0 + 200} mm`);
    expect(report.problems.filter((d) => d.severity === 'error')).toEqual([]);
    s().undoProject();
    expect(s().project).toBe(before);
    expect(worktop().box.w).toBe(w0);
    expect(s().project!.items[2].design.catalog?.origin?.variantId).toBe('base-door');
  });

  it('a wider piece in the middle overlaps its neighbour: the report names the problem', () => {
    const mid = s().project!.items[1];
    const report = s().replaceItem(mid.id, drawers800())!;
    expect(report.problems.length).toBeGreaterThan(0);
    expect(report.problems[0].severity).toBe('error');
    expect(report.text).toMatch(/\d+ problems?: /);
  });

  it('nothing open or a missing piece: no change, no report', () => {
    const steps = s().projectPast.length;
    expect(s().replaceItem('nope', drawers3())).toBeNull();
    expect(s().projectPast.length).toBe(steps);
  });
});

describe('replaceReport', () => {
  it('says only "Replaced." when nothing else changed', () => {
    const p = run([baseDoor()]);
    const next = replaceItem(p, p.items[0].id, drawers3());
    const r = replaceReport(p, buildProjectModel(p), next, buildProjectModel(next), p.items[0].id);
    expect(r.text).toBe('Replaced.');
    expect(r.problems).toEqual([]);
  });
});
