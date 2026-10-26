import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { catalogFamilies, findFamily, insertable, insertVariant } from '../src/core/catalog';
import { mergeCatalog, shadowOf, type LocalTemplate } from '../src/core/catalog/local';
import { templates } from '../src/core/design';
import {
  keepTemplate,
  makeItem,
  newProject,
  PROJECT_SCHEMA,
  validateProject,
  type Project,
} from '../src/core/project';
import { replaceItem } from '../src/core/replace';
import { latestRevision, newerCount, templateStatus } from '../src/core/templateRevision';
import { loadProject, saveProject } from '../src/persist/db';
import { useDesign } from '../src/store/designStore';

const fam = findFamily('base-doors')!;
const variant = fam.variants.find(insertable)!;
/** A catalog copy as Start from makes it, from the shipped family or one shown from this device. */
const taken = (f = fam as Parameters<typeof insertVariant>[0]) =>
  insertVariant(f, variant, '2026-10-26T00:00:00.000Z')!;
/** The family edited on this device, saved `edits` times (each save adds one revision, ADR-034). */
const edited = (edits: number): LocalTemplate => {
  const t = shadowOf(fam);
  return { ...t, revision: t.revision + edits };
};
const projectWith = (...designs: ReturnType<typeof taken>[]): Project => {
  let p = newProject('Revisions');
  for (const d of designs) p = { ...p, items: [...p.items, makeItem(p, d)] };
  return p;
};

describe('templateStatus (ADR-096)', () => {
  it('a piece without a catalog origin is your own design', () => {
    expect(templateStatus({ design: templates[0].create() }, catalogFamilies, [])).toEqual({
      kind: 'own',
    });
  });

  it('a piece from the shipped template is up to date at its revision', () => {
    const s = templateStatus({ design: taken() }, catalogFamilies, []);
    expect(s).toMatchObject({ kind: 'current', revision: fam.catalogVersion, kept: false });
    if (s.kind === 'current') expect(s.name).toContain(fam.name);
  });

  it('a newer shipped catalogVersion is reported as newer', () => {
    const shipped = [{ id: fam.id, catalogVersion: fam.catalogVersion + 2 }];
    expect(templateStatus({ design: taken() }, shipped, [])).toMatchObject({
      kind: 'newer',
      revision: fam.catalogVersion,
      latest: fam.catalogVersion + 2,
    });
  });

  it('a template edited on this device after the piece was taken is newer; a piece taken after is current', () => {
    const before = taken();
    const local = edited(1);
    expect(latestRevision(fam.id, catalogFamilies, [local])).toBe(local.revision);
    expect(templateStatus({ design: before }, catalogFamilies, [local])).toMatchObject({
      kind: 'newer',
      revision: 1,
      latest: local.revision,
    });
    // Taken from the template as this device shows it: it records the edited revision.
    const view = mergeCatalog(catalogFamilies, [local]).find((f) => f.id === fam.id)!;
    const after = taken(view);
    expect(after.catalog?.origin?.revision).toBe(local.revision);
    expect(templateStatus({ design: after }, catalogFamilies, [local]).kind).toBe('current');
    // Edited again: the piece taken in between is behind by one.
    expect(templateStatus({ design: after }, catalogFamilies, [edited(2)])).toMatchObject({
      kind: 'newer',
      revision: local.revision,
      latest: local.revision + 1,
    });
  });

  it('Keep mine hides the notice for that revision only', () => {
    const d = taken();
    const local = edited(1);
    expect(
      templateStatus({ design: d, templateSeen: local.revision }, catalogFamilies, [local]),
    ).toMatchObject({ kind: 'current', kept: true });
    expect(
      templateStatus({ design: d, templateSeen: local.revision }, catalogFamilies, [edited(2)])
        .kind,
    ).toBe('newer');
  });

  it('a template no longer in the catalog or on the device is reported as gone', () => {
    const d = taken();
    const lost = {
      ...d,
      catalog: { ...d.catalog, origin: { ...d.catalog!.origin!, catalogId: 'gone' } },
    };
    expect(templateStatus({ design: lost }, catalogFamilies, []).kind).toBe('gone');
  });

  it('newerCount counts the pieces with a newer template', () => {
    const p = projectWith(taken(), taken(), { ...templates[0].create() });
    expect(newerCount(p.items, catalogFamilies, [])).toBe(0);
    expect(newerCount(p.items, catalogFamilies, [edited(1)])).toBe(2);
  });
});

describe('Keep mine in a project (ADR-096)', () => {
  it('records the revision, is one undo step, and a replace clears it', () => {
    const p = projectWith(taken());
    const s = useDesign.getState;
    s().openProject(p);
    s().keepTemplate(p.items[0].id, 2);
    expect(s().project!.items[0].templateSeen).toBe(2);
    expect(s().projectPast.length).toBe(1);
    s().keepTemplate(p.items[0].id, 2);
    expect(s().projectPast.length).toBe(1);
    s().undoProject();
    expect(s().project!.items[0].templateSeen).toBeUndefined();
    const kept = keepTemplate(p, p.items[0].id, 2);
    expect(keepTemplate(kept, 'nope', 2)).toBe(kept);
    expect(keepTemplate(kept, kept.items[0].id, 0)).toBe(kept);
    const replaced = replaceItem(kept, kept.items[0].id, taken());
    expect(replaced.items[0].templateSeen).toBeUndefined();
  });

  it('survives save and reload; older project versions load; the field needs version 7', async () => {
    const q = projectWith(taken());
    const k = keepTemplate(q, q.items[0].id, 3);
    expect(k.schemaVersion).toBe(PROJECT_SCHEMA);
    expect(PROJECT_SCHEMA).toBe(7);
    expect(validateProject(k)).toEqual([]);
    await saveProject(k);
    expect((await loadProject(k.id))?.items[0].templateSeen).toBe(3);
    for (const v of [1, 2, 3, 4, 5, 6])
      expect(validateProject({ ...q, schemaVersion: v })).toEqual([]);
    expect(validateProject({ ...k, schemaVersion: 6 })).toContain(
      'Kept template revisions need project schemaVersion 7',
    );
    expect(validateProject({ ...k, items: [{ ...k.items[0], templateSeen: 0 }] })).toContain(
      'Invalid kept template revision',
    );
    // A stored version-6 project (no kept revisions) loads unchanged.
    const v6 = { ...q, id: 'v6', schemaVersion: 6 as const };
    await saveProject(v6);
    expect(await loadProject('v6')).toEqual(v6);
  });
});
