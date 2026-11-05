// Automatic repairs and Mirror the run carry a piece's whole group (ADR-176, N179): a repair on a grouped piece moves
// every member by the same offset; a repair the group cannot follow is listed refused with the reason and cannot be
// applied; Mirror the run mirrors every member of a group touching the run.
import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { mirrorRun } from '../src/core/arrange';
import { templates } from '../src/core/design';
import {
  buildProjectModel,
  makeItem,
  newProject,
  placedBounds,
  placeItem,
  resolvePlacements,
  setLocked,
  type Project,
} from '../src/core/project';
import { applicable, pieceName, repairsFor, settle, type Repair } from '../src/core/repairs';
import { groupItems } from '../src/core/selection';
import { useDesign } from '../src/store/designStore';

const t = (id: string) => templates.find((x) => x.id === id)!.create();
const s = () => useDesign.getState();
function run(ids: string[]): Project {
  let p = newProject('Group repairs');
  for (const id of ids) p = { ...p, items: [...p.items, makeItem(p, t(id))] };
  return resolvePlacements(p);
}
const group = (p: Project, ids: string[]) => groupItems(p, ids).project;
const at = (p: Project, id: string, x: number): Project => ({
  ...p,
  items: p.items.map((i) => (i.id === id ? { ...i, position: { ...i.position, x } } : i)),
});
const box = (p: Project, id: string) =>
  placedBounds(resolvePlacements(p).items.find((i) => i.id === id)!);
function overlapRepairs(p: Project): Repair[] {
  const pm = buildProjectModel(p);
  const d = pm.diagnostics.find((x) => x.code === 'pieces-overlap');
  expect(d).toBeDefined();
  return repairsFor(p, pm, d!);
}

describe('a repair on a grouped piece moves the whole group (ADR-176)', () => {
  it('every member moves by the same offset; the other piece stays', () => {
    // Base A at 0 and base B at 600 in one group; a wardrobe pushed 34 mm into B from the right.
    let p = run(['base-door', 'base-door', 'wardrobe']);
    const [a, b, w] = p.items.map((i) => i.id);
    p = group(p, [a, b]);
    p = at(p, w, box(p, w).x - 34);
    const reps = overlapRepairs(p);
    // Moving B alone 34 mm left would put it into A: only offered because A comes along.
    const left = reps.find((r) => r.label === `Move ${pieceName(p, b)} 34 mm to the left`);
    expect(left).toBeDefined();
    expect(left!.refused).toBeUndefined();
    const after = settle(left!.project);
    expect(box(after, a).x - box(p, a).x).toBe(-34);
    expect(box(after, b).x - box(p, b).x).toBe(-34);
    expect(box(after, w)).toEqual(box(p, w));
    expect(left!.preview.map((x) => x.id).sort()).toEqual([a, b].sort());
    // The group is kept as it was.
    expect(after.groups).toEqual(p.groups);
    // Every applicable repair keeps the group together: all members move by one offset.
    for (const r of reps.filter(applicable)) {
      const q = settle(r.project);
      const dx = [a, b].map((id) => box(q, id).x - box(p, id).x);
      expect(new Set(dx).size, r.label).toBe(1);
    }
  });

  it('applied, it is one undo step', () => {
    let p = run(['base-door', 'base-door', 'wardrobe']);
    const [a, b, w] = p.items.map((i) => i.id);
    p = at(group(p, [a, b]), w, box(p, w).x - 34);
    s().openProject(p);
    const reps = overlapRepairs(s().project!);
    const left = reps.find((r) => r.label === `Move ${pieceName(p, b)} 34 mm to the left`)!;
    const past = s().projectPast.length;
    s().updateProject(() => left.project);
    expect(s().projectPast.length).toBe(past + 1);
    expect(box(s().project!, a).x).toBe(box(p, a).x - 34);
    s().undoProject();
    expect(box(s().project!, a).x).toBe(box(p, a).x);
  });
});

describe('a repair the group cannot follow is refused, with the reason (ADR-176)', () => {
  /** A, B, C side by side; A and C grouped and A locked; B pushed 34 mm into C. */
  function lockedGroup() {
    let p = run(['base-door', 'base-door', 'base-door']);
    const [a, b, c] = p.items.map((i) => i.id);
    p = setLocked(group(p, [a, c]), a, true);
    p = at(p, b, box(p, b).x + 34);
    return { p, a, b, c };
  }

  it('listed with "Refused" and the reason; it changes nothing and has no preview', () => {
    const { p, a, b, c } = lockedGroup();
    const reps = overlapRepairs(p);
    const right = reps.find((r) => r.label === `Move ${pieceName(p, c)} 34 mm to the right`);
    expect(right).toBeDefined();
    expect(applicable(right!)).toBe(false);
    expect(right!.refused).toBe(`${pieceName(p, a)} is locked — unlock it to move it.`);
    expect(right!.project).toBe(p);
    expect(right!.preview).toEqual([]);
    // The piece outside the group can still be moved: that repair applies.
    const back = reps.find((r) => r.label === `Move ${pieceName(p, b)} 34 mm to the left`);
    expect(back && applicable(back)).toBe(true);
    expect(box(settle(back!.project), b).x).toBe(600);
    // Smallest move first, refused or not.
    const ds = reps.map((r) => r.distance);
    expect(ds).toEqual([...ds].sort((x, y) => x - y));
  });

  it('a wall unit grouped with a floor unit cannot hang higher: refused, it stands on the floor', () => {
    let p = run(['wardrobe', 'base-door']);
    const baseId = p.items[1].id;
    const tall = placeItem(p.items[0]).bounds;
    const w = makeItem(p, t('wall-cabinet'));
    p = {
      ...p,
      items: [
        ...p.items,
        {
          ...w,
          position: { x: tall.x, y: tall.h - 10, z: 0 },
          placement: { kind: 'wall', height: tall.h - 10 },
        },
      ],
    };
    p = group(resolvePlacements(p), [w.id, baseId]);
    const reps = overlapRepairs(p);
    const up = reps.find((r) => r.label === `Hang ${pieceName(p, w.id)} 10 mm higher`);
    expect(up).toBeDefined();
    expect(up!.refused).toBe(
      `${pieceName(p, baseId)} stands on the floor; the pieces of its group move up and down together.`,
    );
  });

  it('only applicable repairs ever change the project', () => {
    const { p } = lockedGroup();
    for (const r of overlapRepairs(p).filter((x) => !applicable(x))) expect(r.project).toBe(p);
  });
});

describe('Mirror the run carries the whole group (ADR-176)', () => {
  beforeEach(() => {
    // A at 0 and B at 600 touch; C stands apart at 3000, grouped with B.
    let p = run(['base-door', 'base-door', 'base-door']);
    const [, b, c] = p.items.map((i) => i.id);
    p = group(at(p, c, 3000), [b, c]);
    s().openProject(p);
  });

  it('mirrors every member of a group touching the run, one undo step', () => {
    const before = s().project!;
    const [a, b, c] = before.items.map((i) => i.id);
    const past = s().projectPast.length;
    const res = s().mirrorRun(a);
    expect(res.refused).toBeUndefined();
    expect(s().projectPast.length).toBe(past + 1);
    const after = s().project!;
    // The run widened to 0…3600: positions reflect about its centre, C with them.
    expect(box(after, a).x).toBe(3000);
    expect(box(after, b).x).toBe(2400);
    expect(box(after, c).x).toBe(0);
    // C's design is mirrored, as A's and B's.
    for (const id of [a, b, c])
      expect(after.items.find((i) => i.id === id)!.design).not.toEqual(
        before.items.find((i) => i.id === id)!.design,
      );
    s().undoProject();
    expect(s().project!.items).toEqual(before.items);
  });

  it('a group member that cannot mirror refuses the whole action, with the reason', () => {
    const p0 = s().project!;
    const [a, , c] = p0.items.map((i) => i.id);
    const p = setLocked(p0, c, true);
    const res = mirrorRun(p, a);
    expect(res.project).toBe(p);
    expect(res.refused).toBe(
      `Mirror the run refused: ${pieceName(p, c)} is locked — unlock it to move it.`,
    );
  });
});
