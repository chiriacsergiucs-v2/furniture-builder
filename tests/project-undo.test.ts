import { beforeEach, describe, expect, it } from 'vitest';
import { templates } from '../src/core/design';
import { makeItem, newProject, type Project } from '../src/core/project';
import type { CabinetParams } from '../src/core/types';
import { useDesign } from '../src/store/designStore';

const t = (id: string) => templates.find((x) => x.id === id)!.create();
function run(ids: string[]): Project {
  let p = newProject('Run');
  for (const id of ids) p = { ...p, items: [...p.items, makeItem(p, t(id))] };
  return p;
}
const s = () => useDesign.getState();
const names = () => s().project!.items.map((i) => i.design.name);

describe('project undo and redo (ADR-051)', () => {
  beforeEach(() => s().openProject(run(['base-door', 'base-door'])));

  it('undo brings back the two pieces a merge joined; redo merges them again', () => {
    const [a, b] = s().project!.items;
    expect(s().mergeItems(a.id, b.id)).toEqual([]);
    expect(s().project!.items).toHaveLength(1);
    s().undoProject();
    expect(s().project!.items.map((i) => i.id)).toEqual([a.id, b.id]);
    expect(s().projectModel!.diagnostics).toEqual([]);
    expect(s().selectedItemId).toBeNull();
    s().redoProject();
    expect(s().project!.items).toHaveLength(1);
    expect((s().project!.items[0].design.product.params as CabinetParams).width).toBe(1200);
  });

  it('undoes removing a piece, renaming the project and changing a quantity, one step each', () => {
    const [a, b] = s().project!.items;
    s().updateProject((p) => ({ ...p, name: 'Kitchen' }));
    s().updateItem(b.id, { quantity: b.quantity + 2 });
    s().removeItem(a.id);
    expect(s().project!.items).toHaveLength(1);
    s().undoProject();
    expect(s().project!.items.map((i) => i.id)).toEqual([a.id, b.id]);
    s().undoProject();
    expect(s().project!.items[1].quantity).toBe(b.quantity);
    s().undoProject();
    expect(s().project!.name).toBe('Run');
    expect(s().projectPast).toHaveLength(0);
    s().undoProject(); // nothing left: no change
    expect(s().project!.name).toBe('Run');
  });

  it('a new change after undo clears redo', () => {
    s().updateProject((p) => ({ ...p, name: 'A' }));
    s().undoProject();
    expect(s().projectFuture).toHaveLength(1);
    s().updateProject((p) => ({ ...p, name: 'B' }));
    expect(s().projectFuture).toHaveLength(0);
  });

  it('edits made in the piece editor come back as one project step; nothing changed adds no step', () => {
    const [a] = s().project!.items;
    s().editItem(a.id);
    s().backToProject();
    expect(s().projectPast).toHaveLength(0);
    s().updateProject((p) => ({ ...p, name: 'Kitchen' }));
    s().editItem(a.id);
    s().rename('Left');
    s().updateCabinet({ width: 500 });
    s().undoProject(); // ignored while the piece editor is open
    expect(s().editingItemId).toBe(a.id);
    expect(s().project!.name).toBe('Kitchen');
    expect(names()[0]).toBe('Left');
    s().backToProject();
    expect(names()[0]).toBe('Left');
    expect(s().projectPast).toHaveLength(2);
    s().undoProject();
    expect(s().project!.name).toBe('Kitchen');
    expect(names()[0]).toBe(a.design.name);
    expect((s().project!.items[0].design.product.params as CabinetParams).width).toBe(
      (a.design.product.params as CabinetParams).width,
    );
  });

  it('opening or closing a project starts a fresh history', () => {
    s().updateProject((p) => ({ ...p, name: 'A' }));
    s().openProject(run(['base-door']));
    expect(s().projectPast).toHaveLength(0);
    s().updateProject((p) => ({ ...p, name: 'B' }));
    s().closeProject();
    expect(s().projectPast).toHaveLength(0);
    expect(s().projectFuture).toHaveLength(0);
  });
});
