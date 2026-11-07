import { beforeEach, describe, expect, it } from 'vitest';
import { templates } from '../src/core/design';
import { makeItem, newProject, type Project } from '../src/core/project';
import type { CabinetParams, Design } from '../src/core/types';
import { useDesign } from '../src/store/designStore';

type State = ReturnType<typeof useDesign.getState>;

const st = () => useDesign.getState();
const byTemplate = (id: string) => templates.find((t) => t.id === id)!.create();
const cab = (d: Design) => d.product.params as CabinetParams;

function two(): { p: Project; a: string; b: string } {
  const base = newProject('Row');
  const a = makeItem(base, byTemplate('base-door'));
  const b = makeItem({ ...base, items: [a] }, byTemplate('base-door'));
  return { p: { ...base, items: [a, b] }, a: a.id, b: b.id };
}

/** How many times subscribers hear of `fn`'s changes. */
function notifications(fn: () => void): number {
  let n = 0;
  const off = useDesign.subscribe(() => n++);
  try {
    fn();
  } finally {
    off();
  }
  return n;
}

describe('design store shape (ADR-231)', () => {
  beforeEach(() => st().load(byTemplate('chest')));

  it('one edit of a piece loaded from the project notifies subscribers once', () => {
    const { p, a } = two();
    st().openProject(p);
    st().selectItem(a);
    expect(st().drillItemId).toBe(a);
    const n = notifications(() => st().updateParams('cabinet', { width: 512 }));
    expect(n).toBe(1);
    expect(cab(st().project!.items[0].design).width).toBe(512);
    expect(cab(st().design).width).toBe(512);
    expect(st().projectPast).toHaveLength(1);
  });

  it('updateParams changes only the piece of its kind; the old names still edit', () => {
    const d = st().design;
    st().updateParams('desk', { width: 999 });
    expect(st().design).toBe(d);
    st().updateCabinet({ width: 640 });
    expect(cab(st().design).width).toBe(640);
  });

  it('every project action wrapper is a no-op when its change leaves the project as it is', () => {
    const { p, a } = two();
    const origin = { catalogId: 'none', revision: 1, productName: 'X', takenAt: '' };
    const cases: [string, (s: State) => void][] = [
      ['setLocked', (s) => s.setLocked(a, false)],
      ['setSizeLocked', (s) => s.setSizeLocked(a, false)],
      ['setTurnLocked', (s) => s.setTurnLocked(a, false)],
      ['setAxisLocked', (s) => s.setAxisLocked(a, 'width', false)],
      ['setBoardsLocked', (s) => s.setBoardsLocked(a, false)],
      ['setConstructionLocked', (s) => s.setConstructionLocked(a, false)],
      ['keepTemplate', (s) => s.keepTemplate('missing', 1)],
      ['linkTemplate', (s) => s.linkTemplate('missing', origin)],
      ['updateVariable', (s) => s.updateVariable('missing', { name: 'x' })],
      ['deleteVariable', (s) => s.deleteVariable('missing')],
      ['updateVariableSet', (s) => s.updateVariableSet('missing', { name: 'x' })],
      ['followProject', (s) => s.followProject('missing', 'body')],
      ['linkIdentical', (s) => s.linkIdentical('missing')],
      ['ungroup', (s) => s.ungroup('missing')],
      ['setProjectSellerItemQuantity', (s) => s.setProjectSellerItemQuantity('x', 'missing', 2)],
    ];
    for (const [name, call] of cases) {
      st().openProject(p);
      const before = st().project;
      const n = notifications(() => call(st()));
      expect({ name, n, same: st().project === before, past: st().projectPast.length }).toEqual({
        name,
        n: 0,
        same: true,
        past: 0,
      });
    }
  });

  it('editing a piece loaded from the project adds no piece history; project undo still works after leaving', () => {
    const { p, a } = two();
    st().openProject(p);
    st().selectItem(a);
    const w0 = cab(st().design).width;
    st().updateCabinet({ width: w0 + 10 });
    st().updateCabinet({ width: w0 + 20 });
    expect(st().past).toHaveLength(0);
    expect(st().projectPast).toHaveLength(2);
    st().undoProject();
    expect(cab(st().design).width).toBe(w0 + 10);
    st().selectItem(null);
    expect(st().drillItemId).toBeNull();
    st().undoProject();
    expect(cab(st().project!.items[0].design).width).toBe(w0);
  });
});
