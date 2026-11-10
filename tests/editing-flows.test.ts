// ADR-243 to ADR-246: locks that hold, honest feedback, state that survives, and no silent data loss in the piece and
// item editing flows.
import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { mirrorRun } from '../src/core/arrange';
import { holdsSomething, splitSpace, templates, unsplit } from '../src/core/design';
import { mergeItems } from '../src/core/merge';
import { setBoardsLocked } from '../src/core/pieceLocks';
import {
  makeItem,
  newProject,
  removeBlocked,
  setLocked,
  setTurnLocked,
  type Project,
} from '../src/core/project';
import { setAxisLocked } from '../src/core/sizeLock';
import type { CabinetParams, Material, Space } from '../src/core/types';
import { CATALOG } from '../src/store/assistantActions';
import { useDesign } from '../src/store/designStore';

const t = (id: string) => templates.find((x) => x.id === id)!.create();
function row(...ids: string[]): Project {
  let p = newProject('Flows');
  for (const id of ids) p = { ...p, items: [...p.items, makeItem(p, t(id))] };
  return p;
}
const oak: Material = { id: 'o', name: 'Oak veneer', thickness: 18, grain: true, color: '#c9a36b' };
const st = () => useDesign.getState();

beforeEach(() => {
  useDesign.setState({ project: null, projectPast: [], projectFuture: [], notice: null });
});

describe('locks hold (ADR-243)', () => {
  it('a placement-locked piece is not removed, alone or in a selection; the notice names it', () => {
    const p = row('base-door', 'base-door');
    const [a, b] = p.items.map((i) => i.id);
    const locked = setLocked(p, a, true);
    expect(removeBlocked(locked, [a])).toMatch(/unlock it to remove it/);
    expect(removeBlocked(locked, [b])).toBeNull();
    st().openProject(locked);
    st().removeItem(a);
    expect(st().project!.items).toHaveLength(2);
    expect(st().notice).toMatch(/unlock it to remove it/);
    st().selectItems([a, b]);
    st().deleteSelection();
    expect(st().project!.items).toHaveLength(2);
    st().removeItem(b);
    expect(st().project!.items.map((i) => i.id)).toEqual([a]);
  });

  it('merging refuses a piece with a size, turn, boards or construction lock', () => {
    const p = row('base-door', 'base-door');
    const [a, b] = p.items.map((i) => i.id);
    expect(mergeItems(p, a, b).mergedId).not.toBeNull();
    for (const locked of [
      setAxisLocked(p, b, 'width', true),
      setTurnLocked(p, a, true),
      setBoardsLocked(p, b, true),
    ]) {
      const r = mergeItems(locked, a, b);
      expect(r.mergedId).toBeNull();
      expect(r.issues.join(' ')).toMatch(/locked; unlock it first/);
    }
  });

  it('Mirror the run refuses a turn-locked piece, as mirroring one piece does', () => {
    const p = row('base-door', 'base-door');
    const a = p.items[0].id;
    const r = mirrorRun(setTurnLocked(p, p.items[1].id, true), a);
    expect(r.refused).toMatch(/turn locked/);
  });
});

describe('honest feedback (ADR-244)', () => {
  it('Apply material to the project skips a boards-locked piece and names it; never a false "applied"', () => {
    const p0 = row('base-door', 'base-door');
    const [a, b] = p0.items.map((i) => i.id);
    st().openProject(setBoardsLocked(p0, b, true));
    const before = st().project!.items[1].design;
    const r = st().applyMaterial(a, ['front'], oak, 'project');
    expect(r.applied.length).toBeGreaterThan(0);
    expect(r.skipped.join(' ')).toMatch(/locked/);
    expect(st().project!.items[1].design).toBe(before);
    expect(st().project!.items[0].design.materials.some((m) => m.name === 'Oak veneer')).toBe(true);
  });

  it('a refused merge and a refused mirror leave a notice', () => {
    const p = row('base-door', 'base-door');
    const [a, b] = p.items.map((i) => i.id);
    st().openProject(setTurnLocked(p, a, true));
    st().mergeItems(a, b);
    expect(st().notice).toMatch(/locked; unlock it first/);
    useDesign.setState({ notice: null });
    st().mirrorItem(a);
    expect(st().notice).toMatch(/[Tt]urn locked/);
  });

  it('updateProject returns why a change was refused', () => {
    const p = row('base-door');
    const id = p.items[0].id;
    st().openProject(setAxisLocked(p, id, 'width', true));
    const why = st().updateProject((x) => ({
      ...x,
      items: x.items.map((i) =>
        i.id === id
          ? {
              ...i,
              design: {
                ...i.design,
                product: {
                  ...i.design.product,
                  params: { ...(i.design.product.params as CabinetParams), width: 900 },
                } as typeof i.design.product,
              },
            }
          : i,
      ),
    }));
    expect(why).toBeTruthy();
  });
});

describe('state survives (ADR-245)', () => {
  it('a template edit gives back the open project and its undo history', () => {
    const p = row('base-door');
    st().openProject(p);
    st().updateProject((x) => ({ ...x, name: 'Renamed' }));
    const project = st().project;
    const tpl = {
      id: 'tpl',
      revision: 1,
      family: { id: 'f', name: 'F', variants: [{ id: 'v', name: 'V', design: t('base-door') }] },
    } as unknown as Parameters<ReturnType<typeof st>['editTemplateVariant']>[0];
    st().editTemplateVariant(tpl, 'v');
    expect(st().project).toBeNull();
    st().finishTemplateEdit(false);
    expect(st().project).toBe(project);
    expect(st().projectPast).toHaveLength(1);
  });

  it('"Change all copies" is remembered on this device', () => {
    const kept = new Map<string, string>();
    globalThis.localStorage ??= {
      getItem: (k: string) => kept.get(k) ?? null,
      setItem: (k: string, v: string) => void kept.set(k, v),
      removeItem: (k: string) => void kept.delete(k),
    } as Storage;
    st().setLinkAll(false);
    expect(localStorage.getItem('fb:link-all-off')).toBe('1');
    st().setLinkAll(true);
    expect(localStorage.getItem('fb:link-all-off')).toBeNull();
  });

  it('Select all takes the placed 3D models too', () => {
    const p = row('base-door', 'base-door');
    const model = {
      id: 'm1',
      modelId: 'x',
      name: 'Lamp',
      size: { w: 100, h: 100, d: 100 },
      position: { x: 0, z: 0 },
    };
    st().openProject({ ...p, models: [model] } as unknown as Project);
    st().selectAll();
    expect(st().selectedItemIds).toContain('m1');
    expect(st().selectedItemIds).toHaveLength(3);
  });
});

describe('no silent data loss (ADR-246)', () => {
  it('Remove dividers keeps the first part, as the quick count does', () => {
    const drawers: Space = { id: 's', kind: 'drawers', count: 3, front: null };
    const split = splitSpace(drawers, 'x', 2);
    const back = unsplit(split);
    expect(back.id).toBe('s');
    expect(back.kind).toBe('drawers');
    expect(holdsSomething(drawers)).toBe(true);
    expect(holdsSomething({ id: 'e', kind: 'empty', front: null })).toBe(false);
  });

  it('the assistant is held to the same limits and names as the fields', () => {
    st().load(t('base-door'));
    expect(() => CATALOG.resizePiece.run!(st(), { key: 'width', value: 99999 })).toThrow(
      /whole number/,
    );
    expect(() => CATALOG.addDesignVariable.run!(st(), { name: '', expr: '1' })).toThrow();
    CATALOG.addDesignVariable.run!(st(), { name: 'gap', expr: '2' });
    expect(() => CATALOG.addDesignVariable.run!(st(), { name: 'Gap', expr: '3' })).toThrow(
      /already exists/,
    );
    expect(() => CATALOG.setKerf.run!(st(), { kerf: 40 })).toThrow(/0 to 20/);
  });

  it('the assistant sets the project saw cut in the project view', () => {
    st().openProject(row('base-door'));
    CATALOG.setKerf.run!(st(), { kerf: 3 });
    expect(st().project!.cutting?.kerf).toBe(3);
  });
});
