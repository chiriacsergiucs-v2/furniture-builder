import { beforeEach, describe, expect, it } from 'vitest';
import { templates } from '../src/core/design';
import { addLinkedCopy } from '../src/core/linked';
import {
  makeItem,
  newProject,
  PROJECT_SCHEMA,
  type Project,
  type RunRequest,
} from '../src/core/project';
import { setSizeLocked } from '../src/core/sizeLock';
import type { CabinetParams, Design } from '../src/core/types';
import { addVariable, setBinding } from '../src/core/variables';
import { useDesign } from '../src/store/designStore';

const st = () => useDesign.getState();
const byTemplate = (id: string) => templates.find((t) => t.id === id)!.create();
const cab = (d: Design) => d.product.params as CabinetParams;
const item = (p: Project, id: string) => p.items.find((i) => i.id === id)!;

/** Two linked copies of one chest; the second has its size locked. */
function lockedCopy(): { p: Project; a: string; b: string } {
  const base = newProject();
  const a = makeItem(base, byTemplate('chest'));
  const res = addLinkedCopy({ ...base, items: [a] }, a.id)!;
  return { p: setSizeLocked(res.project, res.id, true), a: a.id, b: res.id };
}

describe('Back to project goes through the project commit (ADR-226)', () => {
  beforeEach(() => st().load(byTemplate('chest')));

  it('a bound size edited in the piece editor takes its variable again on Back to project', () => {
    const base = newProject();
    const a = makeItem(base, byTemplate('base-door'));
    let p: Project = { ...base, items: [a] };
    p = addVariable(p, 'w', '700').project;
    p = setBinding(p, a.id, 'width', 'w');
    st().openProject(p);
    st().updateProject((x) => x); // the binding applied once, as any project edit does
    expect(cab(item(st().project!, a.id).design).width).toBe(700);
    const steps = st().projectPast.length;
    st().editItem(a.id);
    st().updateCabinet({ width: 500 });
    st().backToProject();
    expect(cab(item(st().project!, a.id).design).width).toBe(700);
    expect(st().notice).toMatch(/follows/);
    expect(st().editingItemId).toBeNull();
    expect(st().projectPast.length).toBe(steps + 1);
  });

  it('a size-locked linked copy rewritten through the piece editor is refused with the notice Update gives', () => {
    const { p, a, b } = lockedCopy();
    // The notice the same change gets from updateItem.
    st().openProject(p);
    const wide = { ...item(p, a).design };
    wide.product = {
      ...wide.product,
      params: { ...cab(wide), width: cab(wide).width + 100 },
    } as Design['product'];
    st().updateItem(a, { design: wide });
    const want = st().notice;
    expect(want).toMatch(/size locked/);
    expect(st().project!.items.map((i) => i.design)).toEqual(p.items.map((i) => i.design));

    st().openProject(p);
    st().editItem(a);
    st().updateCabinet({ width: cab(item(p, a).design).width + 100 });
    st().backToProject();
    expect(st().notice).toBe(want);
    expect(st().editingItemId).toBeNull();
    expect(cab(item(st().project!, b).design).width).toBe(cab(item(p, b).design).width);
    expect(cab(item(st().project!, a).design).width).toBe(cab(item(p, a).design).width);
    expect(st().projectPast).toHaveLength(0);
  });

  it('one undo step still reverts a whole piece-editor session', () => {
    const { p, a, b } = lockedCopy();
    const unlocked = setSizeLocked(p, b, false);
    st().openProject(unlocked);
    st().editItem(a);
    st().rename('Left');
    st().updateCabinet({ width: 777 });
    st().backToProject();
    expect(st().projectPast).toHaveLength(1);
    expect(st().projectPastNames.at(-1)).toMatch(/^Edit /);
    expect(st().project!.schemaVersion).toBe(PROJECT_SCHEMA);
    st().undoProject();
    expect(cab(item(st().project!, a).design).width).toBe(cab(item(p, a).design).width);
  });

  it('setRunRequest equals the project commit of the same next project', () => {
    const base = newProject();
    const a = makeItem(base, byTemplate('base-door'));
    const p: Project = { ...base, items: [a], runSettings: { scribe: 0, auto: true } };
    const r: RunRequest = { kind: 'worktop', from: [a.id] };
    st().openProject(p);
    st().setRunRequest(r);
    const viaAction = st().project!;
    st().openProject(p);
    st().updateProject((x) => ({ ...x, runRequests: [r], runPartsRemoved: [] }));
    const viaCommit = st().project!;
    const strip = (x: Project) => ({ ...x, updatedAt: '' });
    expect(strip(viaAction)).toEqual(strip(viaCommit));
    expect(viaAction.schemaVersion).toBe(PROJECT_SCHEMA);
  });
});
