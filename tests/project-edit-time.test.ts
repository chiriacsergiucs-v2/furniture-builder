// G-487: one edit of a 60-item project through the store (commitProject), plus the view every mounted useView() reads.
// Before G-487 each mounted useView() derived the project cut list and hardware itself; now viewOf makes the view once
// per state and every mount shares it. The time bound is generous so a busy machine does not fail it; set G487_LOG=1
// to print the medians.
import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { templates } from '../src/core/design';
import {
  makeItem,
  newProject,
  projectCutlist,
  projectHardware,
  type Project,
} from '../src/core/project';
import { applyOwned } from '../src/core/owned';
import { useDesign } from '../src/store/designStore';
import { viewOf } from '../src/store/useView';

const IDS = ['base-door', 'wall-cabinet', 'chest', 'bookcase', 'sideboard', 'wardrobe'];
const t = (id: string) => templates.find((x) => x.id === id)!.create();
const st = () => useDesign.getState();
/** Result panels reading useView() at once in this timing (the 3D view, elevation, estimate, outputs …). */
const MOUNTS = 6;

/** 60 pieces of six kinds, each placed beside the last. */
function project60(): Project {
  let p = newProject('Sixty');
  for (let i = 0; i < 60; i++)
    p = { ...p, items: [...p.items, makeItem(p, t(IDS[i % IDS.length]))] };
  return p;
}

const median = (xs: number[]) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)];
const inputs = () => {
  const s = st();
  return {
    design: s.design,
    model: s.model,
    project: s.project,
    projectModel: s.projectModel,
    editing: s.editingItemId,
    carcass: undefined,
    back: undefined,
  };
};

/** Move one piece through the store; time the commit, one derivation as each mount did before, and the shared view. */
function oneEdit(n: number) {
  const p = st().project!;
  const item = p.items[n % p.items.length];
  const a = performance.now();
  st().updateItem(item.id, {
    position: { ...item.position, x: item.position.x + (n % 2 ? -10 : 10) },
  });
  const b = performance.now();
  const { project, projectModel } = st();
  const rows = projectCutlist(project!, projectModel!);
  applyOwned(rows, project!.ownedParts, projectModel!.materials);
  projectHardware(project!, projectModel!);
  const c = performance.now();
  const views = Array.from({ length: MOUNTS }, () => viewOf(inputs()));
  const d = performance.now();
  expect(new Set(views).size).toBe(1);
  return { commit: b - a, derive: c - b, shared: d - c };
}

describe('a 60-item project edit (G-487)', () => {
  it('every mounted view shares one derived cut list and hardware, and an edit stays under the bound', () => {
    st().openProject(project60());
    expect(st().project!.items).toHaveLength(60);
    for (let i = 0; i < 5; i++) oneEdit(i); // warm up
    const runs = Array.from({ length: 21 }, (_, i) => oneEdit(i));
    const m = (f: (r: (typeof runs)[number]) => number) => median(runs.map(f));
    const commit = m((r) => r.commit);
    const before = m((r) => r.commit + MOUNTS * r.derive);
    const after = m((r) => r.commit + r.shared);
    if (process.env.G487_LOG)
      console.log(
        `G-487 60 items: commit ${commit.toFixed(2)} ms, derive ${m((r) => r.derive).toFixed(2)} ms per mount, ` +
          `${MOUNTS} mounts before ${before.toFixed(2)} ms, after ${after.toFixed(2)} ms`,
      );
    // The gap's threshold is 10 ms on a quiet machine; 150 ms keeps a loaded CI runner from failing it.
    expect(after).toBeLessThan(150);
  });

  it('a new state makes a new view; the same state gives the same view', () => {
    st().openProject(project60());
    const v1 = viewOf(inputs());
    expect(viewOf(inputs())).toBe(v1);
    const item = st().project!.items[0];
    st().updateItem(item.id, { position: { ...item.position, x: item.position.x + 10 } });
    const v2 = viewOf(inputs());
    expect(v2).not.toBe(v1);
    expect(v2.mode).toBe('project');
    expect(v2.rows).toEqual(projectCutlist(st().project!, st().projectModel!));
  });
});
