import { describe, expect, it } from 'vitest';
import { alignItems, distributeItems, skippedText } from '../src/core/align';
import { templates } from '../src/core/design';
import {
  buildProjectModel,
  makeItem,
  newProject,
  placedBounds,
  resolvePlacements,
  setLocked,
  type Project,
} from '../src/core/project';
import { snapDrag } from '../src/core/snap';
import { useDesign } from '../src/store/designStore';

const t = (id: string) => templates.find((x) => x.id === id)!.create();
/** Pieces placed left to right, each moved by its own offset (x, z) from where makeItem put it. */
function at(ids: string[], offsets: [number, number][]): Project {
  let p = newProject('Align');
  for (const id of ids) p = { ...p, items: [...p.items, makeItem(p, t(id))] };
  return resolvePlacements({
    ...p,
    items: p.items.map((it, i) => ({
      ...it,
      position: {
        ...it.position,
        x: it.position.x + offsets[i][0],
        z: it.position.z + offsets[i][1],
      },
    })),
  });
}
const b = (p: Project) => resolvePlacements(p).items.map(placedBounds);

describe('align to the first selected piece (ADR-099)', () => {
  // A 600 base, an 800 chest 300 mm further and 37 mm forward, a 1000 wardrobe.
  const p = at(
    ['base-door', 'chest', 'wardrobe'],
    [
      [0, 0],
      [300, 37],
      [500, 11],
    ],
  );
  const ids = p.items.map((i) => i.id);
  const ref = b(p)[0];

  it('left, right and centre along the wall; whole mm, a half mm rounds down', () => {
    const left = b(alignItems(p, ids, 'left').project);
    expect(left.map((x) => x.x)).toEqual([ref.x, ref.x, ref.x]);
    const right = b(alignItems(p, ids, 'right').project);
    expect(right.map((x) => x.x + x.w)).toEqual([0, 1, 2].map(() => ref.x + ref.w));
    const centre = b(alignItems(p, ids, 'centre').project);
    for (const c of centre) {
      expect(Number.isInteger(c.x)).toBe(true);
      expect(c.x).toBe(ref.x + Math.floor((ref.w - c.w) / 2));
    }
    // Depth untouched.
    expect(left.map((x) => x.z)).toEqual(b(p).map((x) => x.z));
  });

  it('back and front in depth', () => {
    expect(b(alignItems(p, ids, 'back').project).map((x) => x.z)).toEqual([ref.z, ref.z, ref.z]);
    expect(b(alignItems(p, ids, 'front').project).map((x) => x.z + x.d)).toEqual(
      [0, 1, 2].map(() => ref.z + ref.d),
    );
  });

  it('a locked piece stays and is named; the others align', () => {
    const q = setLocked(p, ids[1], true);
    const r = alignItems(q, ids, 'left');
    expect(r.skipped.join()).toContain(q.items[1].design.name);
    expect(skippedText(r)).toMatch(/^Not moved: .* is locked/);
    const out = b(r.project);
    expect(out[1]).toEqual(b(q)[1]);
    expect(out[2].x).toBe(ref.x);
    expect(alignItems(p, ids.slice(0, 1), 'left').project).toBe(p);
  });
});

describe('distribute evenly along the wall (ADR-099)', () => {
  it('ends stay; equal gaps; leftover mm one each to the leftmost gaps', () => {
    // 600 + 600 + 800 + 600 wide, spread so the free length is 973 over 3 gaps → 325, 324, 324.
    const p = at(
      ['base-door', 'base-door', 'chest', 'base-door'],
      [
        [0, 0],
        [10, 0],
        [20, 0],
        [1003 - 30, 0],
      ],
    );
    const ids = [p.items[2].id, p.items[0].id, p.items[3].id, p.items[1].id];
    const before = b(p);
    const r = distributeItems(p, ids);
    expect(r.gaps).toEqual([325, 324, 324]);
    const out = b(r.project);
    expect(out[0]).toEqual(before[0]);
    expect(out[3]).toEqual(before[3]);
    const xs = out.map((x) => x.x);
    expect(xs.every(Number.isInteger)).toBe(true);
    const gaps = [0, 1, 2].map((i) => out[i + 1].x - (out[i].x + out[i].w));
    expect(gaps).toEqual([325, 324, 324]);
    // Depth untouched; two pieces: nothing.
    expect(out.map((x) => x.z)).toEqual(before.map((x) => x.z));
    expect(distributeItems(p, ids.slice(0, 2)).project).toBe(p);
  });

  it('a locked middle piece stays and is named', () => {
    const p = at(
      ['base-door', 'base-door', 'base-door'],
      [
        [0, 0],
        [100, 0],
        [600, 0],
      ],
    );
    const q = setLocked(p, p.items[1].id, true);
    const r = distributeItems(
      q,
      q.items.map((i) => i.id),
    );
    expect(r.skipped.length).toBe(1);
    expect(b(r.project)).toEqual(b(q));
  });
});

describe('centre snapping (ADR-099)', () => {
  /** A base cabinet and a wall cabinet hung at its depth, the wall cabinet `off` mm right of centred. */
  function wallOverBase(off: number): Project {
    let p = newProject('Centre');
    p = { ...p, items: [makeItem(p, t('base-door'))] };
    const wall = makeItem(p, t('wall-cabinet'));
    const base = placedBounds(p.items[0]);
    const w = placedBounds({ ...wall, position: { ...wall.position, x: 0 } }).w;
    const x = base.x + Math.floor((base.w - w) / 2) + off;
    return resolvePlacements({
      ...p,
      items: [...p.items, { ...wall, position: { ...wall.position, x, z: 0 } }],
    });
  }

  it('a wall unit dropped near a base unit’s centre snaps to it, labelled "centre", whole mm', () => {
    const p = wallOverBase(0);
    const pm = buildProjectModel(p);
    const id = p.items[1].id;
    // Dragged 30 mm right: against the back wall (0 mm) first, then the centre (30 mm) on the other axis.
    const r = snapDrag(p, pm.pieces, id, 30, 0)!;
    expect(r.snap?.label).toMatch(/back wall · centre to centre with /i);
    const me = placedBounds({ ...p.items[1], position: r.position });
    const base = placedBounds(p.items[0]);
    expect(Math.abs(me.x + me.w / 2 - (base.x + base.w / 2))).toBeLessThanOrEqual(0.5);
    expect(Number.isInteger(r.position.x)).toBe(true);
    // The same drag always gives the same snap.
    expect(snapDrag(p, pm.pieces, id, 30, 0)).toEqual(r);
  });

  it('ranks with ADR-070: nearest first, and at equal distance a wall or side wins over a centre', () => {
    const p = wallOverBase(0);
    const pm = buildProjectModel(p);
    const id = p.items[1].id;
    // Far from the centre (out of range): no centre candidate.
    const far = snapDrag(p, pm.pieces, id, 200, 0)!;
    expect(far.snap?.kind).not.toBe('centre');
    // Back wall and centre both 0 mm away: the wall ranks first (ADR-070 order), the centre completes the other axis.
    const here = snapDrag(p, pm.pieces, id, 0, 0)!;
    expect(here.snap?.kind).toBe('wall');
    expect(here.snap?.label).toMatch(/back wall · centre to centre/i);
    // 200 mm off the back wall (out of range), the centre alone snaps: kind "centre".
    const off = snapDrag(p, pm.pieces, id, 20, 200)!;
    expect(off.snap?.kind).toBe('centre');
    expect(off.snap?.label).toMatch(/^Centre to centre with /);
  });
});

describe('align and distribute in the store (ADR-099)', () => {
  it('each is one undo step and says the gaps', () => {
    const s = useDesign.getState;
    const p = at(
      ['base-door', 'base-door', 'base-door'],
      [
        [0, 0],
        [50, 0],
        [400, 0],
      ],
    );
    s().openProject(p);
    s().selectItems(p.items.map((i) => i.id));
    const n = s().projectPast.length;
    expect(s().distributeSelection()).toMatch(/^Gaps now \d+ · \d+ mm\.$/);
    expect(s().projectPast.length).toBe(n + 1);
    s().undoProject();
    expect(s().project).toBe(p);
    // Already aligned at the back: nothing to do, no step; Left is one step.
    s().alignSelection('back');
    expect(s().projectPast.length).toBe(n);
    s().alignSelection('left');
    expect(s().projectPast.length).toBe(n + 1);
  });
});
