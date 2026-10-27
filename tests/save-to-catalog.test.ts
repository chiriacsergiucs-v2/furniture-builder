import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { catalogFamilies, findFamily, insertable, insertVariant } from '../src/core/catalog';
import {
  mergeCatalog,
  templateFromDesign,
  templateOrigin,
  validateLocalTemplate,
} from '../src/core/catalog/local';
import { templates } from '../src/core/design';
import { linkItemOrigin, makeItem, newProject, validateProject } from '../src/core/project';
import { templateStatus } from '../src/core/templateRevision';
import { listTemplates } from '../src/persist/db';
import { useDesign } from '../src/store/designStore';
import { saveItemToCatalog } from '../src/store/saveToCatalog';
import { useTemplates } from '../src/store/templatesStore';

const fam = findFamily('base-doors')!;
const taken = () => insertVariant(fam, fam.variants.find(insertable)!, '2026-10-27T00:00:00.000Z')!;

describe('a project piece saved to the catalog (ADR-107)', () => {
  it('templateFromDesign with name, room and type: one variant equal to the design without catalog', () => {
    const d = taken();
    const t = templateFromDesign(d, {
      name: 'Hall cabinet',
      function: 'kitchen',
      rooms: ['hallway'],
    });
    expect(t.family).toMatchObject({
      name: 'Hall cabinet',
      function: 'kitchen',
      rooms: ['hallway'],
    });
    expect(t.family.variants).toHaveLength(1);
    expect(t.family.variants[0].design).toEqual({ ...d, catalog: undefined });
    expect(validateLocalTemplate(t)).toEqual([]);
  });

  it('the origin reads "From <name>, revision 1" against the template', () => {
    const t = templateFromDesign(taken(), { name: 'Mine', function: 'storage', rooms: ['other'] });
    const o = templateOrigin(t, '2026-10-27T10:00:00.000Z');
    expect(o).toEqual({
      catalogId: t.family.id,
      variantId: t.family.variants[0].id,
      revision: 1,
      productName: 'Mine',
      takenAt: '2026-10-27T10:00:00.000Z',
    });
    let p = newProject('Link');
    p = { ...p, items: [makeItem(p, taken())] };
    const kept = { ...p, items: [{ ...p.items[0], templateSeen: 5 }] };
    const linked = linkItemOrigin(kept, p.items[0].id, o);
    expect(linked.items[0].templateSeen).toBeUndefined();
    expect(validateProject(linked)).toEqual([]);
    expect(templateStatus(linked.items[0], mergeCatalog(catalogFamilies, [t]), [t])).toMatchObject({
      kind: 'current',
      name: 'Mine',
      revision: 1,
    });
    expect(linkItemOrigin(p, 'nope', o)).toBe(p);
  });

  it('saving stores one template and links only that piece; undo drops the link and keeps the template', async () => {
    let p = newProject('Save');
    p = { ...p, items: [makeItem(p, taken())] };
    p = { ...p, items: [...p.items, makeItem(p, templates[0].create())] };
    const s = useDesign.getState;
    s().openProject(p);
    const [a, b] = s().project!.items;
    const before = (await listTemplates()).length;

    expect(
      await saveItemToCatalog(a.id, { name: '  ', room: 'other', function: 'storage' }),
    ).toEqual({ error: 'Give the template a name.' });
    expect(s().projectPast.length).toBe(0);

    const res = await saveItemToCatalog(a.id, {
      name: 'Hall cabinet',
      room: 'hallway',
      function: 'storage',
    });
    if (!('template' in res)) throw new Error(res.error);
    const stored = await listTemplates();
    expect(stored.length).toBe(before + 1);
    expect(stored.find((t) => t.id === res.template.id)?.family.rooms).toEqual(['hallway']);
    expect(useTemplates.getState().locals[0].id).toBe(res.template.id);

    const [a2, b2] = s().project!.items;
    expect(a2.design.catalog?.origin).toMatchObject({
      catalogId: res.template.family.id,
      variantId: res.template.family.variants[0].id,
      revision: 1,
      productName: 'Hall cabinet',
    });
    expect({ ...a2.design, catalog: undefined }).toEqual({ ...a.design, catalog: undefined });
    expect(b2).toEqual(b);
    expect(s().projectPast.length).toBe(1);

    s().undoProject();
    expect(s().project!.items[0].design.catalog?.origin?.catalogId).toBe(fam.id);
    expect((await listTemplates()).some((t) => t.id === res.template.id)).toBe(true);
  });
});
