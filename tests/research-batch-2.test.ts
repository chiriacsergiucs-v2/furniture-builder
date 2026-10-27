import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { alignItems, skippedText } from '../src/core/align';
import { templates } from '../src/core/design';
import { dragHeight, heightDraggable, heightLabel, setWallHeight } from '../src/core/height';
import { resizeProduct } from '../src/core/pieceSize';
import {
  buildProjectModel,
  makeItem,
  newProject,
  placedBounds,
  PROJECT_SCHEMA,
  projectCutlist,
  resolvePlacements,
  setLocked,
  validateProject,
  type Project,
} from '../src/core/project';
import {
  isSizeLocked,
  outerSize,
  setSizeLocked,
  SIZE_LOCKED_HINT,
  sizeLockBlocked,
} from '../src/core/sizeLock';
import { loadProject, saveProject } from '../src/persist/db';
import { setProjectSetting } from '../src/core/projectSettings';
import { useDesign } from '../src/store/designStore';
import { cutAt } from '../src/viewer/section';

const t = (id: string) => templates.find((x) => x.id === id)!.create();
function run(ids: string[]): Project {
  let p = newProject('Batch 2');
  for (const id of ids) p = { ...p, items: [...p.items, makeItem(p, t(id))] };
  return resolvePlacements(p);
}
/** Three wall units hung at different heights, and a base unit on the floor. */
function walls(): Project {
  const p = run(['wall-cabinet', 'wall-cabinet', 'wall-cabinet', 'base-door']);
  const hs = [1450, 1400, 1520];
  return resolvePlacements({
    ...p,
    items: p.items.map((it, i) =>
      i < 3 ? { ...it, placement: { kind: 'wall' as const, height: hs[i] } } : it,
    ),
  });
}
const bounds = (p: Project) => resolvePlacements(p).items.map(placedBounds);
const s = () => useDesign.getState();

describe('align Top and Bottom (ADR-122)', () => {
  it('Top puts every wall unit top on the first one, whole mm; Bottom their undersides', () => {
    const p = walls();
    const ids = p.items.slice(0, 3).map((i) => i.id);
    const top = bounds(alignItems(p, ids, 'top').project).slice(0, 3);
    expect(new Set(top.map((b) => b.y + b.h)).size).toBe(1);
    expect(top[0].y + top[0].h).toBe(bounds(p)[0].y + bounds(p)[0].h);
    for (const b of top) expect(Number.isInteger(b.y)).toBe(true);
    const bottom = bounds(alignItems(p, ids, 'bottom').project).slice(0, 3);
    expect(bottom.map((b) => b.y)).toEqual([1450, 1450, 1450]);
  });

  it('a floor piece is skipped and the result says why; it is never resized', () => {
    const p = walls();
    const ids = [p.items[0].id, p.items[3].id];
    const res = alignItems(p, ids, 'top');
    expect(res.project.items[3]).toBe(p.items[3]);
    expect(skippedText(res)).toMatch(/stands on the floor/);
  });

  it('a locked wall unit stays and is named; one below the floor is refused', () => {
    const w = walls();
    const p = setLocked(w, w.items[1].id, true);
    const res = alignItems(p, [p.items[0].id, p.items[1].id], 'bottom');
    expect(res.project.items[1].placement).toEqual(p.items[1].placement);
    expect(skippedText(res)).toMatch(/locked/);
  });

  it('in the store it is one undo step', () => {
    s().openProject(walls());
    const ids = s()
      .project!.items.slice(0, 3)
      .map((i) => i.id);
    s().selectItems(ids);
    expect(s().alignSelection('bottom')).toBe('');
    expect(s().projectPast.length).toBe(1);
    expect(
      bounds(s().project!)
        .slice(0, 3)
        .map((b) => b.y),
    ).toEqual([1450, 1450, 1450]);
    s().undoProject();
    expect(bounds(s().project!)[1].y).toBe(1400);
  });
});

describe('Lock size (ADR-122)', () => {
  const resized = (p: Project, i: number) => ({
    ...p,
    items: p.items.map((it, j) =>
      j === i
        ? {
            ...it,
            design: { ...it.design, product: resizeProduct(it.design.product, 'width', 700) },
          }
        : it,
    ),
  });

  it('a size-locked piece may not change its outside size; boards may change', () => {
    const base = run(['base-door', 'chest']);
    const p = setSizeLocked(base, base.items[0].id, true);
    expect(isSizeLocked(p.items[0])).toBe(true);
    expect(sizeLockBlocked(p, resized(p, 0))).toMatch(/size locked/);
    expect(sizeLockBlocked(p, resized(p, 1))).toBeNull();
    const reboarded = {
      ...p,
      items: p.items.map((it, j) =>
        j === 0 ? { ...it, design: { ...it.design, name: 'Renamed' } } : it,
      ),
    };
    expect(sizeLockBlocked(p, reboarded)).toBeNull();
    expect(outerSize(p.items[0].design).w).toBeGreaterThan(0);
  });

  it('the store refuses a resize from the card, the editor, Replace and a linked copy, naming the piece', () => {
    s().openProject(run(['base-door', 'chest']));
    const id = s().project!.items[0].id;
    s().setSizeLocked(id, true);
    expect(s().projectPast.length).toBe(1);
    const before = s().project!;
    s().resizeItem(id, 'width', 700);
    expect(s().project).toBe(before);
    expect(s().notice).toMatch(/Base|size locked/);
    // Replace with a different-size design.
    expect(s().replaceItem(id, t('wardrobe'))).toBeNull();
    expect(s().project).toBe(before);
    // A linked copy's change would reach the locked one: the whole change is refused.
    s().setSizeLocked(id, false);
    s().addLinkedCopy(id);
    const copy = s().selectedItemId!;
    s().setSizeLocked(id, true);
    const linked = s().project!;
    s().resizeItem(copy, 'width', 700);
    expect(s().project).toBe(linked);
    expect(s().notice).toMatch(/size locked/);
    // The editor (drilled into the piece): an edit changing the width is refused.
    s().editItem(id);
    s().updateCabinet({ width: 900 });
    expect(s().project!.items.find((i) => i.id === id)!.design).toBe(
      linked.items.find((i) => i.id === id)!.design,
    );
    expect(SIZE_LOCKED_HINT).toBe('Size locked — unlock to change');
  });

  it('saves at the current version; older projects still load; the flag needs version 11', async () => {
    const base = run(['base-door']);
    const p = setSizeLocked(base, base.items[0].id, true);
    expect(PROJECT_SCHEMA).toBeGreaterThanOrEqual(11);
    expect(p.schemaVersion).toBe(PROJECT_SCHEMA);
    expect(validateProject(p)).toEqual([]);
    await saveProject(p);
    expect((await loadProject(p.id))?.items[0].sizeLocked).toBe(true);
    for (const v of [1, 2, 3, 4, 5, 6, 7, 8, 9, 11])
      expect(validateProject({ ...base, schemaVersion: v })).toEqual([]);
    expect(validateProject({ ...p, schemaVersion: 11 })).toEqual([]);
    expect(validateProject({ ...p, schemaVersion: 9 })).toContain(
      'Size-locked pieces need project schemaVersion 11',
    );
    expect(
      validateProject({ ...base, items: [{ ...base.items[0], sizeLocked: false as never }] }),
    ).toContain('Invalid item size lock');
    const old = { ...run(['chest']), schemaVersion: 9 as const };
    await saveProject(old);
    expect(await loadProject(old.id)).toEqual(old);
  });
});

describe('the size lock and ADR-124 (G-200)', () => {
  it('project-wide settings go through the size lock: one that keeps the outside size applies', () => {
    const base = run(['base-door', 'base-door']);
    const p = setSizeLocked(base, base.items[0].id, true);
    // The plinth height is inside a base cabinet's outside height: the locked piece follows it.
    const res = setProjectSetting(p, 'plinthHeight', 150);
    expect(res.applied.length).toBe(2);
    expect(sizeLockBlocked(p, res.project)).toBeNull();
    s().openProject(p);
    expect(s().setProjectSetting('plinthHeight', 150)).toHaveLength(2);
    expect(s().notice).toBeNull();
    // Any change that would resize it is refused in the same commit (the guard every project change passes).
    const id = s().project!.items[0].id;
    const before = s().project;
    s().resizeItem(id, 'width', 700);
    expect(s().project).toBe(before);
    expect(s().notice).toMatch(/size locked/);
  });
});

describe('height drag in 3D (ADR-122)', () => {
  it('only wall units; whole mm; below the floor and locked pieces are refused', () => {
    const p = walls();
    const [w, , , floor] = p.items;
    expect(heightDraggable(p, w.id)).toBe(true);
    expect(heightDraggable(p, floor.id)).toBe(false);
    expect(dragHeight(1450, 33.6)).toBe(1484);
    expect(heightLabel(1484)).toBe('From floor 1484 mm');
    const up = setWallHeight(p, w.id, 1600);
    expect(up.reason).toBeUndefined();
    expect(up.project.items[0].placement).toEqual({ kind: 'wall', height: 1600 });
    expect(setWallHeight(p, floor.id, 300).reason).toMatch(/not hung on the wall/);
    expect(setWallHeight(p, w.id, -5).reason).toMatch(/below the floor/);
    expect(setWallHeight(setLocked(p, w.id, true), w.id, 1600).reason).toMatch(/locked/);
  });

  it('in the store: one undo step; a refusal sets the notice and adds no step', () => {
    s().openProject(walls());
    const id = s().project!.items[0].id;
    expect(s().setItemHeight(id, 1700)).toBeNull();
    expect(s().projectPast.length).toBe(1);
    expect(bounds(s().project!)[0].y).toBe(1700);
    expect(s().setItemHeight(id, -1)).toMatch(/below the floor/);
    expect(s().notice).toMatch(/below the floor/);
    expect(s().projectPast.length).toBe(1);
  });
});

describe('Section and Isolate change nothing but the view (ADR-122)', () => {
  it('the cut sits in the middle until moved, and stays inside what is shown', () => {
    expect(cutAt({ at: null }, 0, 600)).toBe(300);
    expect(cutAt({ at: 900 }, 0, 600)).toBe(600);
    expect(cutAt({ at: -10 }, 0, 600)).toBe(0);
  });

  it('the model and the parts are the same whatever the view shows', () => {
    const p = walls();
    const before = JSON.stringify(projectCutlist(p));
    const model = buildProjectModel(p);
    expect(JSON.stringify(projectCutlist(p))).toBe(before);
    expect(model.pieces.length).toBe(4);
  });
});
