// ADR-170: project templates keep connections, variables and bindings; inserted pieces take the project settings.
import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { connect, isConnected } from '../src/core/connections';
import { templates } from '../src/core/design';
import { insertTemplate, keptVariables } from '../src/core/insertTemplate';
import { makeItem, newProject, validateProject, type Project } from '../src/core/project';
import {
  projectFromTemplate,
  TEMPLATE_SCHEMA,
  templateFromProject,
  validateProjectTemplate,
} from '../src/core/projectTemplate';
import { addVariable, applyBindings, setBinding } from '../src/core/variables';
import type { CabinetParams } from '../src/core/types';
import { useDesign } from '../src/store/designStore';

const t = (id: string) => templates.find((x) => x.id === id)!.create();
const cab = (p: Project, i: number) => p.items[i].design.product.params as CabinetParams;
function row(...ids: string[]): Project {
  let p = newProject('Template');
  for (const id of ids) p = { ...p, items: [...p.items, makeItem(p, t(id))] };
  return p;
}
/** Two touching base units, connected, with a variable `h` bound to the first one's height. */
function bound(): Project {
  let p = row('base-door', 'base-door');
  const [a, b] = p.items.map((i) => i.id);
  p = addVariable(p, 'h', '600').project;
  p = setBinding(p, a, 'height', 'h');
  return applyBindings(connect(p, a, b));
}
const st = () => useDesign.getState();

describe('templateFromProject (ADR-170)', () => {
  it('keeps variables, bindings and connections at schemaVersion 2; without them a template stays version 1', () => {
    const tpl = templateFromProject(bound(), 'Kitchen');
    // Variables, bindings and connections alone make version 2; version 3 (TEMPLATE_SCHEMA) is for run handles,
    // sinks and the later fields (ADR-204).
    expect(tpl.schemaVersion).toBe(2);
    expect(TEMPLATE_SCHEMA).toBe(3);
    expect(tpl.variables?.map((v) => [v.name, v.expr])).toEqual([['h', '600']]);
    expect(tpl.items[0].bindings).toEqual([{ target: 'height', expr: 'h' }]);
    expect(tpl.items[1].bindings).toBeUndefined();
    expect(tpl.connections).toEqual([{ itemIds: [tpl.items[0].ref, tpl.items[1].ref] }]);
    expect(validateProjectTemplate(tpl)).toEqual([]);
    const plain = templateFromProject(row('base-door', 'base-door'), 'Plain');
    expect(plain.schemaVersion).toBe(1);
    expect(plain.variables).toBeUndefined();
    expect(plain.connections).toBeUndefined();
    expect(validateProjectTemplate(plain)).toEqual([]);
  });
  it('refuses the new fields in a version-1 template, and unknown or doubled connection refs', () => {
    const tpl = templateFromProject(bound(), 'Kitchen');
    const v1 = { ...tpl, schemaVersion: 1 };
    const errs = validateProjectTemplate(v1);
    expect(errs.some((e) => /Variables need template schemaVersion 2/.test(e))).toBe(true);
    expect(errs.some((e) => /Connections need template schemaVersion 2/.test(e))).toBe(true);
    expect(errs.some((e) => /bindings need template schemaVersion 2/.test(e))).toBe(true);
    const [a, b] = tpl.items.map((i) => i.ref);
    expect(validateProjectTemplate({ ...tpl, connections: [{ itemIds: [a, 'nope'] }] })).toContain(
      'Invalid template connection',
    );
    expect(validateProjectTemplate({ ...tpl, connections: [{ itemIds: [a, a] }] })).toContain(
      'Invalid template connection',
    );
    expect(
      validateProjectTemplate({ ...tpl, connections: [{ itemIds: [a, b] }, { itemIds: [b, a] }] }),
    ).toContain('Invalid template connection');
    expect(validateProjectTemplate({ ...tpl, schemaVersion: 4 })).toContain(
      'Not a project template',
    );
  });
});

describe('projectFromTemplate (ADR-170)', () => {
  it('a new project gets the variables, the bindings on the new ids and the connection between the new pieces', () => {
    const tpl = templateFromProject(bound(), 'Kitchen');
    const p = projectFromTemplate(tpl);
    expect(validateProject(p)).toEqual([]);
    expect(p.variables?.map((v) => v.name)).toEqual(['h']);
    expect(p.items[0].bindings).toEqual([{ target: 'height', expr: 'h' }]);
    expect(cab(p, 0).height).toBe(600);
    expect(isConnected(p, p.items[0].id, p.items[1].id)).toBe(true);
    expect(p.connections![0].id).not.toBe(tpl.connections![0].itemIds[0]);
  });
});

describe('insertTemplate (ADR-170)', () => {
  it('adds the variables, keeps a clashing one of the project, binds to it, remaps connections, applies settings', () => {
    const tpl = templateFromProject(bound(), 'Kitchen');
    let target = row('base-door');
    target = addVariable(target, 'H', '700').project; // same name, other case: the project's wins
    target = { ...target, settings: { plinthHeight: 120 } };
    const res = insertTemplate(target, tpl);
    expect(res.ids).toHaveLength(2);
    expect(res.kept).toEqual(['h']);
    const p = applyBindings(res.project);
    expect(validateProject({ ...p, schemaVersion: 18 })).toEqual([]);
    expect(p.variables?.map((v) => [v.name, v.expr])).toEqual([['H', '700']]);
    const [a, b] = res.ids.map((id) => p.items.find((i) => i.id === id)!);
    expect(a.bindings).toEqual([{ target: 'height', expr: 'h' }]);
    expect((a.design.product.params as CabinetParams).height).toBe(700);
    expect(isConnected(p, a.id, b.id)).toBe(true);
    // The project's settings: plinth 120 on both inserted pieces, as Add a piece does (G-203).
    expect((a.design.product.params as CabinetParams).plinthHeight).toBe(120);
    expect((b.design.product.params as CabinetParams).plinthHeight).toBe(120);
    expect(cab(target, 0).plinthHeight).not.toBe(120);
  });
  it('a template without variables adds none; a new variable name is added once', () => {
    const tpl = templateFromProject(bound(), 'Kitchen');
    const target = row('base-door');
    const res = insertTemplate(target, tpl);
    expect(res.kept).toEqual([]);
    expect(res.project.variables?.map((v) => v.name)).toEqual(['h']);
    const again = insertTemplate(res.project, tpl);
    expect(again.kept).toEqual(['h']);
    expect(again.project.variables).toHaveLength(1);
    const plain = templateFromProject(row('base-door'), 'Plain');
    expect(insertTemplate(target, plain).project.variables).toBeUndefined();
  });
});

describe('store (ADR-170)', () => {
  beforeEach(() => st().openProject(addVariable(row('base-door'), 'h', '700').project));
  it('inserting a template with a clashing variable keeps the project’s and says so; one undo step', () => {
    const tpl = templateFromProject(bound(), 'Kitchen');
    expect(keptVariables(st().project!, tpl)).toEqual(['h']);
    const ids = st().insertTemplate(tpl);
    expect(ids).toHaveLength(2);
    expect(st().project!.variables).toHaveLength(1);
    const inserted = st().project!.items.find((i) => i.id === ids[0])!;
    expect((inserted.design.product.params as CabinetParams).height).toBe(700);
    expect(isConnected(st().project!, ids[0], ids[1])).toBe(true);
    st().undoProject();
    expect(st().project!.items).toHaveLength(1);
  });
});

describe('run handles and sinks in templates (ADR-204)', () => {
  /** Three touching base units with a run handle (the middle one keeps its own) and a sink over the first. */
  function kitchen(): Project {
    const p = row('base-door', 'base-door', 'base-door');
    const ids = p.items.map((i) => i.id);
    return {
      ...p,
      runHandles: [
        {
          id: 'rh1',
          from: ids,
          handle: { kind: 'bar', holeSpacing: 128 },
          height: 800,
          own: [ids[1]],
        },
      ],
      sinks: [{ id: 'sk1', baseId: ids[0], w: 500, d: 400 }],
    };
  }
  it('a template with a run handle and a sink is version 3, over template refs; without them it stays 1 or 2', () => {
    const src = kitchen();
    expect(validateProject(src)).toEqual([]);
    const tpl = templateFromProject(src, 'Kitchen');
    expect(tpl.schemaVersion).toBe(3);
    const refs = tpl.items.map((i) => i.ref);
    expect(tpl.runHandles).toEqual([
      { from: refs, handle: { kind: 'bar', holeSpacing: 128 }, height: 800, own: [refs[1]] },
    ]);
    expect(tpl.sinks).toEqual([{ baseId: refs[0], w: 500, d: 400 }]);
    expect(validateProjectTemplate(tpl)).toEqual([]);
    expect(templateFromProject(row('base-door'), 'Plain').schemaVersion).toBe(1);
    expect(templateFromProject(bound(), 'Vars').schemaVersion).toBe(2);
  });
  it('a handle over a gone piece keeps the rest; a sink over a gone base is dropped', () => {
    const src = kitchen();
    const first = src.items[0].id;
    const p: Project = {
      ...src,
      runHandles: [{ ...src.runHandles![0], from: [...src.runHandles![0].from, 'gone'] }],
      sinks: [...src.sinks!, { id: 'sk2', baseId: 'gone', w: 500, d: 400 }],
    };
    const tpl = templateFromProject(p, 'Kitchen');
    expect(tpl.runHandles![0].from).not.toContain('gone');
    expect(tpl.runHandles![0].from).toHaveLength(3);
    expect(tpl.sinks).toHaveLength(1);
    expect(tpl.sinks![0].baseId).toBe(first);
  });
  it('versions 1 and 2 load unchanged; handles or sinks below version 3 and unknown refs are refused', () => {
    const v1 = templateFromProject(row('base-door', 'base-door'), 'Plain');
    const v2 = templateFromProject(bound(), 'Vars');
    expect(validateProjectTemplate(structuredClone(v1))).toEqual([]);
    expect(validateProjectTemplate(structuredClone(v2))).toEqual([]);
    expect(projectFromTemplate(v1).runHandles).toBeUndefined();
    expect(projectFromTemplate(v2).sinks).toBeUndefined();
    const tpl = templateFromProject(kitchen(), 'Kitchen');
    expect(validateProjectTemplate({ ...tpl, schemaVersion: 2 })).toEqual(
      expect.arrayContaining([
        'Run handles need template schemaVersion 3',
        'Sinks need template schemaVersion 3',
      ]),
    );
    expect(validateProjectTemplate({ ...tpl, schemaVersion: 1 })).toContain(
      'Run handles need template schemaVersion 3',
    );
    const rh = tpl.runHandles![0];
    expect(validateProjectTemplate({ ...tpl, runHandles: [{ ...rh, from: ['nope'] }] })).toContain(
      'Invalid template run handle',
    );
    expect(validateProjectTemplate({ ...tpl, runHandles: [{ ...rh, own: ['nope'] }] })).toContain(
      'Invalid template run handle',
    );
    expect(
      validateProjectTemplate({ ...tpl, sinks: [{ ...tpl.sinks![0], baseId: 'nope' }] }),
    ).toContain('Invalid template sink');
  });
  it('a project made from it has both, on the new piece ids, with new ids of their own', () => {
    const tpl = templateFromProject(kitchen(), 'Kitchen');
    const p = projectFromTemplate(tpl);
    expect(validateProject(p)).toEqual([]);
    const ids = p.items.map((i) => i.id);
    expect(ids.some((id) => tpl.items.some((i) => i.ref === id))).toBe(false);
    expect(p.runHandles).toHaveLength(1);
    expect(p.runHandles![0].from).toEqual(ids);
    expect(p.runHandles![0].own).toEqual([ids[1]]);
    expect(p.runHandles![0].id).not.toBe('rh1');
    expect(p.sinks).toEqual([{ id: expect.any(String), baseId: ids[0], w: 500, d: 400 }]);
    expect(p.sinks![0].id).not.toBe('sk1');
    const again = projectFromTemplate(tpl);
    expect(again.runHandles![0].id).not.toBe(p.runHandles![0].id);
    expect(again.sinks![0].id).not.toBe(p.sinks![0].id);
  });
  it('an insert adds both on the inserted pieces with new ids; the project’s own stay', () => {
    const tpl = templateFromProject(kitchen(), 'Kitchen');
    const target = kitchen();
    const res = insertTemplate(target, tpl);
    const p = res.project;
    expect(validateProject(p)).toEqual([]);
    expect(p.runHandles).toHaveLength(2);
    expect(p.sinks).toHaveLength(2);
    expect(p.runHandles![0]).toEqual(target.runHandles![0]);
    expect(p.sinks![0]).toEqual(target.sinks![0]);
    const rh = p.runHandles![1];
    expect(rh.from).toEqual(res.ids);
    expect(rh.own).toEqual([res.ids[1]]);
    expect(rh.id).not.toBe('rh1');
    expect(p.sinks![1].baseId).toBe(res.ids[0]);
    expect(p.sinks![1].id).not.toBe('sk1');
  });
});
