// ADR-251 (UI audit, Aligning and arranging): align, distribute, duplicate and the touching run work along the wall a
// piece stands on; a piece along another wall is named; an align that moves nothing says so.
import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { templates } from '../src/core/design';
import {
  makeItem,
  newProject,
  placedBounds,
  resolvePlacements,
  type Project,
} from '../src/core/project';
import { alignItems, distributeItems } from '../src/core/align';
import { duplicateItem, mirrorRun, touchingRun } from '../src/core/arrange';
import { useDesign } from '../src/store/designStore';

const tp = (id: string) => templates.find((x) => x.id === id)!.create();
const boxes = (p: Project) => resolvePlacements(p).items.map(placedBounds);

/** Three base cabinets on the left wall (turn 90), at z 0, `gap` and 2 × `gap`. */
function sideRow(gap = 600): Project {
  let p = newProject('Side');
  for (let i = 0; i < 3; i++) p = { ...p, items: [...p.items, makeItem(p, tp('base-door'))] };
  return resolvePlacements({
    ...p,
    items: p.items.map((it, i) => ({
      ...it,
      rotationY: 90 as const,
      position: { ...it.position, x: i === 1 ? 80 : 0, z: i * gap },
    })),
  });
}

describe('ADR-251 aligning along each wall', () => {
  it('Align Back on a side wall lines the pieces up across the wall, not along it (no overlap)', () => {
    const p = sideRow();
    const ids = p.items.map((i) => i.id);
    const r = alignItems(p, ids, 'back');
    const b = boxes(r.project);
    expect(new Set(b.map((x) => x.x)).size).toBe(1);
    expect(b.map((x) => x.z)).toEqual(boxes(p).map((x) => x.z));
  });

  it('Distribute on a side wall spaces the pieces along z', () => {
    let p = sideRow(700);
    p = {
      ...p,
      items: p.items.map((it, i) =>
        i === 1 ? { ...it, position: { ...it.position, x: 0, z: 650 } } : it,
      ),
    };
    const r = distributeItems(
      resolvePlacements(p),
      p.items.map((i) => i.id),
    );
    expect(r.gaps).toEqual([100, 100]);
  });

  it('a piece along another wall is named and stays', () => {
    let p = sideRow();
    p = resolvePlacements({
      ...p,
      items: p.items.map((it, i) => (i === 2 ? { ...it, rotationY: 0 as const } : it)),
    });
    const r = alignItems(
      p,
      p.items.map((i) => i.id),
      'left',
    );
    expect(r.skipped.join(' ')).toMatch(/stands along another wall/);
  });

  it('Duplicate on a side wall puts the copy beside the piece along that wall', () => {
    const p = sideRow();
    const d = duplicateItem(p, p.items[2].id)!;
    const all = boxes(d.project);
    const copy = all[d.project.items.findIndex((i) => i.id === d.id)];
    const orig = boxes(p)[2];
    expect(copy.x).toBe(orig.x);
    expect(copy.z).not.toBe(orig.z);
  });

  it('the touching run and Mirror the run are found along a side wall', () => {
    const p = sideRow();
    expect(touchingRun(p, p.items[1].id)).toHaveLength(3);
    const r = mirrorRun(p, p.items[0].id);
    expect(r.refused).toBeUndefined();
    expect(boxes(r.project).map((b) => b.x)).toEqual(boxes(p).map((b) => b.x));
  });

  it('an align that moves nothing says "Already in line."', () => {
    let p = newProject('Row');
    for (let i = 0; i < 2; i++) p = { ...p, items: [...p.items, makeItem(p, tp('base-door'))] };
    p = resolvePlacements(p);
    useDesign.getState().openProject(p);
    useDesign.getState().selectItems(useDesign.getState().project!.items.map((i) => i.id));
    expect(useDesign.getState().alignSelection('back')).toBe('Already in line.');
  });
});
