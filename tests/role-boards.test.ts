// Role boards and the one Material control (ADR-163): a board per part role, one part winning over it, scopes.
import { describe, expect, it } from 'vitest';
import { buildModel } from '../src/core/build';
import { SCHEMA_VERSION, templates, validateDesign } from '../src/core/design';
import {
  applyMaterial,
  itemRoles,
  materialTargets,
  putRoleBoards,
  roleBoard,
} from '../src/core/finish';
import { makeItem, newProject, type Project } from '../src/core/project';
import type { Design, Material } from '../src/core/types';

const t = (id: string) => templates.find((x) => x.id === id)!.create();
const oak = (d: Design) => d.materials.find((m) => /oak/i.test(m.name))!;
const blue: Material = { id: 'b', name: 'MDF blue', thickness: 18, grain: false, color: '#3355aa' };
const thin: Material = {
  id: 'h',
  name: 'HDF 3 blue',
  thickness: 3,
  grain: false,
  color: '#3355aa',
};
const boardOf = (d: Design, panelId: string) =>
  d.materials.find((m) => m.id === buildModel(d).panels.find((p) => p.id === panelId)!.materialId)!
    .name;
const byRole = (d: Design, role: string) =>
  buildModel(d)
    .panels.filter((p) => p.role === role)
    .map((p) => d.materials.find((m) => m.id === p.materialId)!.name);

function room(): Project {
  let p = newProject('Material');
  for (const d of [t('base-door'), t('base-door'), t('wardrobe')])
    p = { ...p, items: [...p.items, makeItem(p, d)] };
  // The wardrobe stands apart from the run of two base units.
  return {
    ...p,
    items: p.items.map((it, i) =>
      i === 2 ? { ...it, position: { ...it.position, x: it.position.x + 500 } } : it,
    ),
  };
}

describe('role boards (ADR-163)', () => {
  it('swap the board of every part of that role; a part board wins; another thickness is the thickness error', () => {
    const d = t('bookcase');
    const o = oak(d);
    const withRoles: Design = { ...d, roleMaterials: { shelf: o.id, top: o.id } };
    expect(new Set(byRole(withRoles, 'shelf'))).toEqual(new Set([o.name]));
    expect(new Set(byRole(withRoles, 'top'))).toEqual(new Set([o.name]));
    expect(byRole(withRoles, 'side')).not.toContain(o.name);
    const shelf = buildModel(d).panels.find((p) => p.role === 'shelf')!;
    const body = d.materials.find((m) => m.id === roleBoard(d, 'body'))!;
    const both: Design = { ...withRoles, partMaterials: { [shelf.id]: body.id } };
    expect(boardOf(both, shelf.id)).toBe(body.name);
    expect(validateDesign(both)).toEqual([]);
    const hdf = d.materials.find((m) => m.thickness < 10)!;
    const wrong: Design = { ...d, roleMaterials: { shelf: hdf.id } };
    expect(buildModel(wrong).diagnostics.some((x) => x.code === 'thickness')).toBe(true);
  });

  it('are validated: an unknown role or material, and the field in a version-5 file', () => {
    const d = t('bookcase');
    expect(SCHEMA_VERSION).toBe(6);
    expect(validateDesign({ ...d, roleMaterials: { shelf: 'nope' } })).toContain(
      'Role board for shelf refers to an unknown role or material',
    );
    expect(
      validateDesign({ ...d, roleMaterials: { door: oak(d).id } as Design['roleMaterials'] }),
    ).toContain('Role board for door refers to an unknown role or material');
    expect(
      validateDesign({ ...d, schemaVersion: 5, roleMaterials: { shelf: oak(d).id } }),
    ).toContain('Role boards need schemaVersion 6');
    expect(validateDesign({ ...d, schemaVersion: 5 })).toEqual([]);
  });

  it('putRoleBoards: Top and Shelves change only those; Carcass clears the role entries; missing roles are skipped', () => {
    const d = t('bookcase');
    const r = putRoleBoards(d, ['top', 'shelf', 'drawer-box'], blue);
    expect(r.applied).toEqual(['top', 'shelf']);
    expect(r.skipped).toEqual(['drawer-box']);
    expect(new Set(byRole(r.design, 'shelf'))).toEqual(new Set(['MDF blue']));
    expect(new Set(byRole(r.design, 'top'))).toEqual(new Set(['MDF blue']));
    expect(byRole(r.design, 'side')).not.toContain('MDF blue');
    expect(r.design.materials.filter((m) => m.name === 'MDF blue')).toHaveLength(1);
    const c = putRoleBoards(r.design, ['body'], thin);
    // Carcass = sides, top and bottom: their role entries go; the shelves keep theirs.
    expect(c.design.roleMaterials).toEqual({ shelf: r.design.roleMaterials!.shelf });
    expect(new Set(byRole(c.design, 'top'))).toEqual(new Set(['HDF 3 blue']));
    expect(itemRoles(t('bookcase'))).toContain('shelf');
    expect(itemRoles(t('bookcase'))).not.toContain('drawer-box');
  });

  it('materialTargets: Group is the selection when 2+ are selected, else the run; null when in no run', () => {
    const p = room();
    const [a, b, w] = p.items.map((i) => i.id);
    expect(materialTargets(p, a, 'group')!.map((i) => i.id)).toEqual([a, b]);
    expect(materialTargets(p, w, 'group')).toBeNull();
    expect(materialTargets(p, w, 'group', [w, a])!.map((i) => i.id)).toEqual([a, w]);
    expect(materialTargets(p, w, 'item')!.map((i) => i.id)).toEqual([w]);
    expect(materialTargets(p, w, 'project')).toHaveLength(3);
  });

  it('applyMaterial: scope Group reaches the run, Project everything and records the settings; skips are named', () => {
    const p = room();
    const [a, , w] = p.items.map((i) => i.id);
    const g = applyMaterial(p, a, ['front', 'shelf'], blue, 'group');
    expect(g.applied).toHaveLength(2);
    expect(byRole(g.project.items[0].design, 'door')).toContain('MDF blue');
    expect(byRole(g.project.items[2].design, 'door')).not.toContain('MDF blue');
    expect(g.project.settings?.front).toBeUndefined();
    const all = applyMaterial(p, w, ['body', 'back'], blue, 'project');
    expect(all.applied).toHaveLength(3);
    expect(all.project.settings?.body?.name).toBe('MDF blue');
    expect(all.project.settings?.back?.name).toBe('MDF blue');
    expect(all.project.settings?.front).toBeUndefined();
    const none = applyMaterial(p, w, ['worktop'], blue, 'item');
    expect(none.applied).toEqual([]);
    expect(none.skipped[0]).toMatch(/has no worktop/);
    expect(applyMaterial(p, w, ['front'], blue, 'group').skipped).toEqual(['not in a run']);
  });

  it('is one undo step in the store, for a project and for the open piece', async () => {
    const { useDesign } = await import('../src/store/designStore');
    const st = () => useDesign.getState();
    const p = room();
    st().openProject(p);
    const before = st().project;
    const r = st().applyMaterial(p.items[0].id, ['top', 'front'], blue, 'project');
    expect(r.applied).toHaveLength(3);
    expect(byRole(st().project!.items[2].design, 'top')).toContain('MDF blue');
    st().undoProject();
    expect(st().project).toBe(before);
    // A part of a project item.
    const side = buildModel(p.items[0].design).panels.find((x) => x.role === 'side')!;
    st().applyMaterial(p.items[0].id, [], blue, 'part', `${p.items[0].id}:${side.id}`);
    expect(boardOf(st().project!.items[0].design, side.id)).toBe('MDF blue');
    st().undoProject();
    expect(st().project).toBe(before);
  });
});
