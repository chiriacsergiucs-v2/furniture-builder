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
    expect(tpl.schemaVersion).toBe(TEMPLATE_SCHEMA);
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
    expect(validateProjectTemplate({ ...tpl, schemaVersion: 3 })).toContain(
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
