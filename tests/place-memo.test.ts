// ADR-221: placed pieces are memoised and the project cut list and hardware read the project model.
import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as build from '../src/core/build';
import { templates } from '../src/core/design';
import {
  makeItem,
  newProject,
  placeItem,
  projectCutlist,
  projectHardware,
  type Project,
} from '../src/core/project';
import { useDesign } from '../src/store/designStore';

// Spy on every export, keeping its implementation (a mock factory would leave the modules it imports unmocked).
vi.mock('../src/core/build', { spy: true });

const calls = () => vi.mocked(build.buildModel).mock.calls.length;
const t = (id: string) => templates.find((x) => x.id === id)!.create();
const st = () => useDesign.getState();

/** `n` base units side by side on the floor. */
function row(n: number): Project {
  let p = newProject('Row');
  for (let i = 0; i < n; i++) p = { ...p, items: [...p.items, makeItem(p, t('base-door'))] };
  return p;
}

describe('placeItem memo and the project model (ADR-221)', () => {
  beforeEach(() => st().load(t('chest')));

  it('one commit plus the cut list and hardware of a 30-item project build each piece once', () => {
    st().openProject(row(30));
    vi.mocked(build.buildModel).mockClear();
    // Every piece changed (a new identity): each one has to be built again, once.
    st().updateProject((p) => ({ ...p, items: p.items.map((i) => ({ ...i })) }));
    const { project, projectModel } = st();
    projectCutlist(project!, projectModel!);
    projectHardware(project!, projectModel!);
    expect(calls()).toBeLessThanOrEqual(31);
  });

  it('placing the same item twice returns the same object; a changed item gets a new result', () => {
    const p = row(2);
    const [a] = p.items;
    const first = placeItem(a);
    expect(placeItem(a)).toBe(first);
    expect(placeItem(a, {})).toBe(first);
    // Other options are another result, itself kept.
    const noPlinth = placeItem(a, { noPlinth: true });
    expect(noPlinth).not.toBe(first);
    expect(placeItem(a, { noPlinth: true })).toBe(noPlinth);
    const moved = { ...a, position: { ...a.position, x: a.position.x + 100 } };
    const again = placeItem(moved);
    expect(again).not.toBe(first);
    expect(again.bounds.x).toBe(first.bounds.x + 100);
  });
});
