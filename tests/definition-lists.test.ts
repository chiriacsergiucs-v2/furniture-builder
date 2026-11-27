// ADR-307: definition lists of variables and settings a piece links to.
import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { defaultMaterials, templates } from '../src/core/design';
import {
  addList,
  linkItem,
  listDiagnostics,
  removeList,
  setItemOverride,
  setListValue,
  valueSource,
} from '../src/core/defLists';
import {
  buildProjectModel,
  makeItem,
  newProject,
  PROJECT_SCHEMA,
  validateProject,
  type Project,
} from '../src/core/project';
import { follows, setListSetting, setProjectSetting } from '../src/core/projectSettings';
import {
  projectFromTemplate,
  TEMPLATE_SCHEMA,
  templateFromProject,
  validateProjectTemplate,
} from '../src/core/projectTemplate';
import { addVariable, applyBindings, deleteVariable, setBinding } from '../src/core/variables';
import type { CabinetParams, Design } from '../src/core/types';
import { useDesign } from '../src/store/designStore';

const tpl = (id: string) => templates.find((x) => x.id === id)!.create();
const st = () => useDesign.getState();
const cab = (p: Project, id: string) =>
  p.items.find((i) => i.id === id)!.design.product.params as CabinetParams;
const item = (p: Project, id: string) => p.items.find((i) => i.id === id)!;

/** Three base units bound on height to `height = 800`, and two lists A (700) and B (900). */
function room(): { p: Project; ids: string[]; a: string; b: string; v: string } {
  let p = newProject('Lists');
  const ids: string[] = [];
  for (let n = 0; n < 3; n++) {
    const it = makeItem(p, tpl('base-door'));
    ids.push(it.id);
    p = { ...p, items: [...p.items, it] };
  }
  const r = addVariable(p, 'height', '800');
  p = r.project;
  for (const id of ids) p = setBinding(p, id, 'height', 'height');
  const la = addList(p);
  const lb = addList(la.project);
  p = setListValue(lb.project, la.id, r.id, '700');
  p = setListValue(p, lb.id, r.id, '900');
  return { p: applyBindings(p), ids, a: la.id, b: lb.id, v: r.id };
}

describe('definition lists (ADR-307)', () => {
  it('names new lists List A, List B', () => {
    const { p } = room();
    expect(p.definitionLists!.map((l) => l.name)).toEqual(['List A', 'List B']);
  });

  it('linked pieces take their list’s values; the others the project’s', () => {
    const { p: p0, ids, a, b } = room();
    let p = linkItem(p0, ids[0], a);
    p = applyBindings(linkItem(p, ids[2], b));
    expect(ids.map((id) => cab(p, id).height)).toEqual([700, 800, 900]);
    p = applyBindings(linkItem(p, ids[1], a));
    expect(ids.map((id) => cab(p, id).height)).toEqual([700, 700, 900]);
    expect(validateProject(p)).toEqual([]);
  });

  it('a change to a list reaches every linked piece in one undo step', () => {
    const { p: p0, ids, a, b, v } = room();
    st().openProject(
      applyBindings(linkItem(linkItem(linkItem(p0, ids[0], a), ids[1], a), ids[2], b)),
    );
    const before = st().projectPast.length;
    st().setDefinitionListValue(a, v, '720');
    const p = st().project!;
    expect(ids.map((id) => cab(p, id).height)).toEqual([720, 720, 900]);
    expect(st().projectPast).toHaveLength(before + 1);
    st().undoProject();
    expect(ids.map((id) => cab(st().project!, id).height)).toEqual([700, 700, 900]);
  });

  it('a piece override wins over its list; Use list value restores it', () => {
    const { p: p0, ids, a, v } = room();
    let p = applyBindings(setItemOverride(linkItem(p0, ids[0], a), ids[0], v, '650'));
    expect(cab(p, ids[0]).height).toBe(650);
    expect(valueSource(p, item(p, ids[0]), v)).toBe('piece');
    p = applyBindings(setItemOverride(p, ids[0], v, null));
    expect(cab(p, ids[0]).height).toBe(700);
    expect(valueSource(p, item(p, ids[0]), v)).toBe('list');
    expect(item(p, ids[0]).list).toEqual({ id: a });
  });

  it('a bad list formula or override is an error that blocks export; the size keeps its number', () => {
    const { p: p0, ids, a, v } = room();
    let p = applyBindings(linkItem(p0, ids[0], a));
    p = applyBindings(setListValue(p, a, v, '700 +'));
    expect(cab(p, ids[0]).height).toBe(700);
    const d = listDiagnostics(p);
    expect(d.map((x) => [x.severity, x.code])).toEqual([['error', 'list-value']]);
    expect(buildProjectModel(p).diagnostics.some((x) => x.code === 'list-value')).toBe(true);
    p = setItemOverride(setListValue(p, a, v, '700'), ids[0], v, 'nope');
    expect(listDiagnostics(p).map((x) => x.nodeId)).toEqual([ids[0]]);
  });

  it('settings: linking applies the list’s handle and carcass board; changes reach followers only', () => {
    const { p: p0, ids, a } = room();
    const oak = { ...defaultMaterials()[0], id: 'oak', name: 'Oak 18' };
    let p = setListSetting(p0, a, 'handle', { kind: 'knob' }).project;
    p = setListSetting(p, a, 'body', oak).project;
    p = linkItem(linkItem(p, ids[0], a), ids[1], a);
    for (const id of ids.slice(0, 2)) {
      expect(follows(p, item(p, id), 'handle')).toBe('follows');
      expect(follows(p, item(p, id), 'body')).toBe('follows');
      expect(item(p, id).design.materials.some((m) => m.name === 'Oak 18')).toBe(true);
    }
    expect(item(p, ids[2]).design.materials.some((m) => m.name === 'Oak 18')).toBe(false);
    // Piece 2 takes its own handle; the list's next handle reaches piece 1 only.
    const own = useHandle(item(p, ids[1]).design, { kind: 'bar' });
    p = { ...p, items: p.items.map((i) => (i.id === ids[1] ? { ...i, design: own } : i)) };
    const res = setListSetting(p, a, 'handle', { kind: 'push' });
    expect(res.applied).toHaveLength(1);
    expect(follows(res.project, item(res.project, ids[1]), 'handle')).toBe('own');
    // A project handle skips pieces whose list sets the handle.
    const pr = setProjectSetting(res.project, 'handle', null);
    expect(pr.applied).toHaveLength(1);
    expect(follows(pr.project, item(pr.project, ids[0]), 'handle')).toBe('follows');
  });

  it('Follow list puts the list’s value back', () => {
    const { p: p0, ids, a } = room();
    st().openProject(
      linkItem(setListSetting(p0, a, 'handle', { kind: 'knob' }).project, ids[0], a),
    );
    const own = useHandle(item(st().project!, ids[0]).design, { kind: 'bar' });
    st().updateItem(ids[0], { design: own });
    expect(follows(st().project!, item(st().project!, ids[0]), 'handle')).toBe('own');
    st().followProject(ids[0], 'handle');
    expect(follows(st().project!, item(st().project!, ids[0]), 'handle')).toBe('follows');
  });

  it('deleting a list unlinks: bound sizes take the project’s value, boards stay; deleting a variable drops its list values', () => {
    const { p: p0, ids, a, v } = room();
    let p = applyBindings(setItemOverride(linkItem(p0, ids[0], a), ids[1], v, '1'));
    p = applyBindings(removeList(p, a));
    expect(item(p, ids[0]).list).toBeUndefined();
    expect(cab(p, ids[0]).height).toBe(800);
    p = applyBindings(linkItem(p, ids[0], p.definitionLists![0].id));
    p = setItemOverride(p, ids[0], v, '650');
    p = deleteVariable(p, v);
    expect(p.definitionLists!.every((l) => !(v in l.values))).toBe(true);
    expect(item(p, ids[0]).list).toEqual({ id: p.definitionLists![0].id });
  });

  it('schemaVersion 23 validates, a 22 file loads, an unknown list is refused', () => {
    const { p: p0, ids, a } = room();
    const p = linkItem(p0, ids[0], a);
    expect(PROJECT_SCHEMA).toBe(23);
    expect(validateProject({ ...p, schemaVersion: 23 })).toEqual([]);
    const { definitionLists: _d, ...old } = { ...p0, schemaVersion: 22 as const };
    void _d;
    expect(validateProject(old)).toEqual([]);
    expect(validateProject({ ...p, schemaVersion: 22 })).toContain(
      'Definition lists need project schemaVersion 23',
    );
    const bad = { ...p, items: p.items.map((i) => ({ ...i, list: { id: 'nope' } })) };
    expect(validateProject(bad).some((e) => e.includes('unknown definition list'))).toBe(true);
  });

  it('templates (version 4) keep lists and links with new ids; a version 3 template loads', () => {
    const { p: p0, ids, a } = room();
    const p = applyBindings(linkItem(p0, ids[0], a));
    const t = templateFromProject(p, 'Kitchen');
    expect(t.schemaVersion).toBe(TEMPLATE_SCHEMA);
    expect(TEMPLATE_SCHEMA).toBe(4);
    expect(validateProjectTemplate(JSON.parse(JSON.stringify(t)))).toEqual([]);
    const q = projectFromTemplate(t);
    expect(validateProject(q)).toEqual([]);
    expect(q.definitionLists!.map((l) => l.name)).toEqual(['List A', 'List B']);
    expect(q.definitionLists![0].id).not.toBe(a);
    expect(q.items[0].list).toEqual({ id: q.definitionLists![0].id });
    expect((q.items[0].design.product.params as CabinetParams).height).toBe(700);
    expect(validateProjectTemplate({ ...t, schemaVersion: 3 })).toContain(
      'Definition lists need template schemaVersion 4',
    );
    const plain = templateFromProject({ ...p0, definitionLists: undefined }, 'Plain');
    expect(validateProjectTemplate({ ...plain, schemaVersion: 3 })).toEqual([]);
  });
});

/** The design with every handle holder set to `h` (as a piece edited on its own). */
function useHandle(d: Design, h: { kind: 'bar' | 'knob' | 'push' }): Design {
  const params = structuredClone(d.product.params) as unknown as Record<string, unknown>;
  const walk = (v: unknown) => {
    if (Array.isArray(v)) v.forEach(walk);
    else if (v && typeof v === 'object') {
      const o = v as Record<string, unknown>;
      if ('handle' in o || (typeof o.kind === 'string' && typeof o.id === 'string' && o.front))
        o.handle = h;
      Object.entries(o).forEach(([k, x]) => k !== 'handle' && walk(x));
    }
  };
  walk(params);
  return { ...d, product: { ...d.product, params } as unknown as Design['product'] };
}
