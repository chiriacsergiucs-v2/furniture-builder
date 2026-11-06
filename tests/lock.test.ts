import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  duplicateItem,
  mirrorItem,
  mirrorRun,
  tryTurn,
  turnAboutCentre,
} from '../src/core/arrange';
import { templates } from '../src/core/design';
import { mergeItems } from '../src/core/merge';
import {
  buildProjectModel,
  isLocked,
  makeItem,
  moveBlocked,
  moveBy,
  newProject,
  PROJECT_SCHEMA,
  resolvePlacements,
  setLocked,
  trySetGap,
  validateProject,
  type Project,
} from '../src/core/project';
import { repairsFor, settle } from '../src/core/repairs';
import { resizeProduct, type SizeField } from '../src/core/pieceSize';
import { outerSize, resizeBlocked, sizeLockBlocked } from '../src/core/sizeLock';
import type { Design } from '../src/core/types';
import { loadProject, saveProject } from '../src/persist/db';
import { useDesign } from '../src/store/designStore';

const t = (id: string) => templates.find((x) => x.id === id)!.create();
function run(ids: string[]): Project {
  let p = newProject('Locks');
  for (const id of ids) p = { ...p, items: [...p.items, makeItem(p, t(id))] };
  return resolvePlacements(p);
}
const lock = (p: Project, i: number) => setLocked(p, p.items[i].id, true);
const pos = (p: Project, i: number) => p.items[i].position;
const s = () => useDesign.getState();
type SizeKey = SizeField['key'];

describe('a locked piece stays where it is (ADR-095)', () => {
  it('lock and unlock set and clear the flag; unknown ids and no-ops return the same project', () => {
    const p = run(['base-door']);
    const l = lock(p, 0);
    expect(l.items[0].locked).toBe(true);
    expect(isLocked(l.items[0])).toBe(true);
    expect(setLocked(l, l.items[0].id, true)).toBe(l);
    const u = setLocked(l, l.items[0].id, false);
    expect('locked' in u.items[0]).toBe(false);
    expect(setLocked(p, 'nope', true)).toBe(p);
  });

  it('a drag or an arrow key does not move it and says why; unlocked it moves', () => {
    const p = lock(run(['base-door']), 0);
    const res = moveBy(p, p.items[0].id, 500, 0);
    expect(res.project).toBe(p);
    expect(res.reason).toMatch(/is locked — unlock it to move it/);
    expect(res.reason).toContain(p.items[0].design.name);
    const free = moveBy(setLocked(p, p.items[0].id, false), p.items[0].id, 500, 0);
    expect(free.reason).toBeUndefined();
    expect(pos(free.project, 0).x).toBe(pos(p, 0).x + 500);
  });

  it('turn is refused with the reason; the plain helper returns the same project', () => {
    const p = lock(run(['base-door']), 0);
    const res = tryTurn(p, p.items[0].id, 1);
    expect(res.project).toBe(p);
    expect(res.reason).toMatch(/locked/);
    expect(turnAboutCentre(p, p.items[0].id, 1)).toBe(p);
  });

  it('mirror is refused for a locked piece', () => {
    const p = lock(run(['base-door']), 0);
    const res = mirrorItem(p, p.items[0].id);
    expect(res.project).toBe(p);
    expect(res.reason).toMatch(/^Locked — unlock to move/);
  });

  it('mirror the run refuses when the run holds a locked piece, and names it', () => {
    const p = lock(run(['base-door', 'base-door', 'chest']), 1);
    const res = mirrorRun(p, p.items[0].id);
    expect(res.project).toBe(p);
    expect(res.refused).toMatch(/Mirror the run refused: .*piece 2.* is locked/);
    // Unlocked, the run is mirrored as before.
    expect(mirrorRun(setLocked(p, p.items[1].id, false), p.items[0].id).project).not.toBe(p);
  });

  it('the gap tool refuses when it would move a locked piece on the right, and names it', () => {
    const p = lock(run(['base-door', 'base-door', 'chest']), 2);
    const res = trySetGap(p, p.items[1].id, 100, true);
    expect(res.project).toBe(p);
    expect(res.reason).toContain(p.items[2].design.name);
    // Without moving the pieces on its right, nothing locked moves: allowed.
    const own = trySetGap(p, p.items[1].id, 100, false);
    expect(own.reason).toBeUndefined();
    expect(pos(own.project, 1).x).toBe(pos(p, 1).x + 100);
    expect(pos(own.project, 2)).toEqual(pos(p, 2));
    // The selected piece itself locked: refused.
    const self = lock(run(['base-door', 'base-door']), 1);
    expect(trySetGap(self, self.items[1].id, 50).reason).toMatch(/locked/);
  });

  it('a base carrying a locked piece is not moved or turned; a piece on a locked base still moves', () => {
    let p = run(['base-door', 'wall-cabinet']);
    const [base, top] = p.items;
    p = resolvePlacements({
      ...p,
      items: [base, { ...top, placement: { kind: 'above', baseId: base.id, gap: 0, offsetX: 0 } }],
    });
    const carried = setLocked(p, top.id, true);
    expect(moveBlocked(carried, [base.id])).toMatch(/sits on .* and is locked/);
    expect(moveBy(carried, base.id, 300, 0).project).toBe(carried);
    expect(tryTurn(carried, base.id).reason).toMatch(/sits on/);
    // The base locked, the piece on it is not: it may be dragged off.
    const lockedBase = setLocked(p, base.id, true);
    const off = moveBy(lockedBase, top.id, 300, 0);
    expect(off.reason).toBeUndefined();
    expect(pos(off.project, 0)).toEqual(pos(lockedBase, 0));
  });

  it('a locked piece two levels up blocks the bottom base; the message names both', () => {
    let p = run(['base-door', 'wall-cabinet', 'wall-cabinet']);
    const [base, mid, top] = p.items;
    p = resolvePlacements({
      ...p,
      items: [
        base,
        { ...mid, placement: { kind: 'above', baseId: base.id, gap: 0, offsetX: 0 } },
        { ...top, placement: { kind: 'above', baseId: mid.id, gap: 0, offsetX: 0 } },
      ],
    });
    const q = setLocked(p, top.id, true);
    const why = moveBlocked(q, [base.id]);
    expect(why).toContain(base.design.name);
    expect(why).toMatch(/piece 3\) sits on/);
    // Moving the whole stack together is still refused: the top one is locked itself.
    expect(moveBlocked(q, [base.id, mid.id, top.id])).toMatch(/is locked — unlock it to move it/);
    expect(moveBlocked(p, [base.id])).toBeNull();
  });

  it('merging keeps a lock on the merged piece', () => {
    const p = lock(run(['base-door', 'base-door']), 0);
    const res = mergeItems(p, p.items[0].id, p.items[1].id);
    expect(res.mergedId).toBeTruthy();
    expect(res.project.items.find((i) => i.id === res.mergedId)?.locked).toBe(true);
  });

  it('a duplicate of a locked piece starts unlocked; the original stays locked', () => {
    const p = lock(run(['base-door']), 0);
    const res = duplicateItem(p, p.items[0].id)!;
    expect(res.project.items[0].locked).toBe(true);
    expect(res.project.items[1].locked).toBeUndefined();
  });
});

describe('repairs never move a locked piece (ADR-095)', () => {
  /** Two pieces side by side, the second pushed 100 mm into the first. */
  function overlapping(): Project {
    const p = run(['base-door', 'wardrobe']);
    const [a, b] = p.items;
    return { ...p, items: [a, { ...b, position: { ...b.position, x: b.position.x - 100 } }] };
  }
  const repairs = (p: Project) => {
    const pm = buildProjectModel(p);
    const d = pm.diagnostics.find((x) => x.code === 'pieces-overlap')!;
    expect(d).toBeTruthy();
    return repairsFor(p, pm, d);
  };
  const boxOf = (p: Project, id: string) =>
    buildProjectModel(settle(p)).pieces.find((pc) => pc.item.id === id)!.bounds;

  it('unlocked, both pieces may be moved; one locked, only the other moves', () => {
    const p = overlapping();
    const [a, b] = p.items.map((i) => i.id);
    const all = repairs(p);
    const moved = (r: (typeof all)[number]) => r.preview.map((x) => x.id);
    expect(all.some((r) => moved(r).includes(b))).toBe(true);
    for (const which of [a, b]) {
      const q = setLocked(p, which, true);
      const reps = repairs(q);
      expect(reps.length).toBeGreaterThan(0);
      for (const r of reps) {
        expect(moved(r)).not.toContain(which);
        expect(boxOf(r.project, which)).toEqual(boxOf(q, which));
      }
    }
  });

  it('both locked: no repair is offered', () => {
    let p = overlapping();
    for (const it of p.items) p = setLocked(p, it.id, true);
    expect(repairs(p)).toEqual([]);
  });
});

describe('locked pieces in the store (ADR-095)', () => {
  beforeEach(() => s().openProject(run(['base-door', 'chest'])));

  it('Lock is one undo step; a refused drag sets the notice and adds no step', () => {
    const id = s().project!.items[0].id;
    s().setLocked(id, true);
    expect(s().project!.items[0].locked).toBe(true);
    expect(s().projectPast.length).toBe(1);
    const at = s().project!.items[0].position;
    expect(s().moveItemBy(id, 400, 0)).toMatch(/locked/);
    expect(s().notice).toMatch(/locked/);
    expect(s().project!.items[0].position).toEqual(at);
    expect(s().projectPast.length).toBe(1);
    expect(s().turnItem(id, 1)).toMatch(/locked/);
    expect(s().mirrorItem(id)).toMatch(/Locked/);
    // A drag in the 3D view (ADR-093) drops through the same move: refused too.
    expect(s().dropItemAt(id, { x: 0, z: 0 }, { x: 400, z: 0 }, false)).toMatch(/locked/);
    expect(s().project!.items[0].position).toEqual(at);
    expect(s().projectPast.length).toBe(1);
    s().undoProject();
    expect(s().project!.items[0].locked).toBeUndefined();
    expect(s().moveItemBy(id, 400, 0)).toBeNull();
    expect(s().project!.items[0].position.x).toBe(at.x + 400);
    expect(s().notice).toBeNull();
  });
});

describe('locked pieces are saved (ADR-095, ADR-011)', () => {
  it('a project with a locked piece saves and reloads; it is written at the current version', async () => {
    const p = lock(run(['base-door', 'chest']), 1);
    expect(p.schemaVersion).toBe(PROJECT_SCHEMA);
    expect(validateProject(p)).toEqual([]);
    await saveProject(p);
    const back = await loadProject(p.id);
    expect(back?.items[1].locked).toBe(true);
    expect(back?.items[0].locked).toBeUndefined();
  });

  it('older project versions still load; a lock needs version 6; a bad flag is refused', () => {
    const p = run(['base-door']);
    for (const v of [1, 2, 3, 4, 5])
      expect(validateProject({ ...p, schemaVersion: v })).toEqual([]);
    const l = lock(p, 0);
    expect(validateProject({ ...l, schemaVersion: 5 })).toContain(
      'Locked pieces need project schemaVersion 6',
    );
    const bad = { ...p, items: [{ ...p.items[0], locked: false }] };
    expect(validateProject(bad)).toContain('Invalid item lock');
  });

  it('a stored older project (version 5, no locks) loads unchanged', async () => {
    const p = { ...run(['chest']), schemaVersion: 5 as const };
    await saveProject(p);
    expect(await loadProject(p.id)).toEqual(p);
  });
});

describe('a base carrying a locked piece is not resized (ADR-203, G-106)', () => {
  /** A base cabinet with a wall cabinet resting on it; the top one locked when asked. */
  function stack(lockTop: boolean): Project {
    let p = run(['base-door', 'wall-cabinet']);
    const [base, top] = p.items;
    p = resolvePlacements({
      ...p,
      items: [base, { ...top, placement: { kind: 'above', baseId: base.id, gap: 0, offsetX: 0 } }],
    });
    return lockTop ? setLocked(p, top.id, true) : p;
  }
  const size = (d: Design, key: SizeKey) =>
    outerSize(d)[key === 'width' ? 'w' : key === 'height' ? 'h' : 'd'];
  const param = (d: Design, key: SizeKey) =>
    (d.product.params as unknown as Record<SizeKey, number>)[key];
  const resized = (d: Design, key: SizeKey, by: number): Design => ({
    ...d,
    product: resizeProduct(d.product, key, param(d, key) + by),
  });

  it('resizeBlocked refuses an outside-size change with the reason naming both pieces', () => {
    const p = stack(true);
    const [base, top] = p.items;
    for (const key of ['width', 'height', 'depth'] as const) {
      const next = resized(base.design, key, 50);
      expect(size(next, key)).toBe(size(base.design, key) + 50);
      const why = resizeBlocked(p, base.id, next);
      expect(why).toMatch(/sits on .* and is locked — unlock it to resize/);
      expect(why).toContain(top.design.name);
      expect(why).toContain(base.design.name);
    }
    // Not a size change: allowed (only a resize is refused).
    expect(resizeBlocked(p, base.id, { ...base.design, name: 'Renamed' })).toBeNull();
    expect(resizeBlocked(p, base.id, base.design)).toBeNull();
    expect(resizeBlocked(p, 'nope', resized(base.design, 'width', 50))).toBeNull();
    // Unlocked on top: the base may be resized.
    const free = stack(false);
    expect(resizeBlocked(free, base.id, resized(base.design, 'height', 50))).toBeNull();
  });

  it('sizeLockBlocked refuses the whole project change; an unlocked piece on it allows it', () => {
    const p = stack(true);
    const grow = (q: Project): Project => ({
      ...q,
      items: [{ ...q.items[0], design: resized(q.items[0].design, 'height', 60) }, q.items[1]],
    });
    expect(sizeLockBlocked(p, grow(p))).toMatch(/sits on .* and is locked — unlock it to resize/);
    expect(sizeLockBlocked(null, grow(p))).toBeNull();
    expect(sizeLockBlocked(stack(false), grow(stack(false)))).toBeNull();
  });

  it('in the store: a resize is refused with the notice and no undo step; unlocked, the piece on it follows', () => {
    s().openProject(stack(true));
    const [base, top] = s().project!.items;
    const h0 = param(base.design, 'height');
    const past = s().projectPast.length;
    s().resizeItem(base.id, 'height', h0 + 60);
    expect(s().notice).toMatch(/sits on .* and is locked — unlock it to resize/);
    expect(s().project!.items[0].design).toBe(base.design);
    expect(s().projectPast.length).toBe(past);
    // The piece editor: the edit of the open piece is refused the same way.
    s().editItem(base.id);
    useDesign.setState({ notice: null });
    s().resizePiece('height', h0 + 60);
    expect(param(s().design, 'height')).toBe(h0);
    expect(s().notice).toMatch(/sits on .* and is locked/);
    s().backToProject();
    // Unlocked on top: the resize goes through and the piece on it rises with it.
    s().setLocked(top.id, false);
    const y0 = s().project!.items[1].position.y;
    s().resizeItem(base.id, 'height', h0 + 60);
    expect(param(s().project!.items[0].design, 'height')).toBe(h0 + 60);
    expect(s().project!.items[1].position.y).toBe(y0 + 60);
  });
});
