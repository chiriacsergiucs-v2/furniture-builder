import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { SCHEMA_VERSION, templates } from '../src/core/design';
import { newProject, PROJECT_SCHEMA } from '../src/core/project';
import {
  copyDesign,
  copyProject,
  db,
  deleteDesign,
  listDesigns,
  loadDesign,
  saveDesign,
  saveProject,
} from '../src/persist/db';

describe('local storage', () => {
  it('saves, lists newest first, loads and deletes designs', async () => {
    const a = { ...templates[0].create(), updatedAt: '2026-01-01T00:00:00.000Z' };
    const b = { ...templates[1].create(), updatedAt: '2026-02-01T00:00:00.000Z' };
    await saveDesign(a);
    await saveDesign(b);
    expect((await listDesigns()).map((r) => r.id)).toEqual([b.id, a.id]);
    expect(await loadDesign(a.id)).toEqual(a);
    await saveDesign({ ...a, name: 'Renamed' });
    expect((await loadDesign(a.id))?.name).toBe('Renamed');
    await deleteDesign(a.id);
    expect(await loadDesign(a.id)).toBeUndefined();
  });
  it('skips a corrupt stored row instead of loading it', async () => {
    const d = templates[0].create();
    await db.designs.put({
      id: d.id,
      name: d.name,
      updatedAt: d.updatedAt,
      design: { ...d, schemaVersion: 99 } as never,
    });
    expect(await loadDesign(d.id)).toBeUndefined();
    expect(await db.designs.get(d.id)).toBeDefined(); // never deleted
  });
});

describe('copy a saved design or project (ADR-227)', () => {
  it('a valid design and project copy with a new id and the same content', async () => {
    const d = templates[0].create();
    await saveDesign(d);
    const rd = await copyDesign(d.id, 'Design copy');
    if (!rd.ok) throw new Error(rd.reason);
    expect(rd.id).not.toBe(d.id);
    const cd = await loadDesign(rd.id);
    expect(cd).toEqual({
      ...d,
      id: rd.id,
      name: 'Design copy',
      createdAt: cd!.createdAt,
      updatedAt: cd!.updatedAt,
    });
    expect(await loadDesign(d.id)).toEqual(d); // the source is untouched

    const p = newProject('Kitchen');
    await saveProject(p);
    const rp = await copyProject(p.id, 'Kitchen (copy)');
    if (!rp.ok) throw new Error(rp.reason);
    const row = await db.projects.get(rp.id);
    expect(row?.name).toBe('Kitchen (copy)');
    expect(row?.project).toEqual({
      ...p,
      id: rp.id,
      name: 'Kitchen (copy)',
      createdAt: row!.project.createdAt,
      updatedAt: row!.project.updatedAt,
    });
  });

  it('a copy of an older-version row is written at the current schemaVersion', async () => {
    const d = { ...templates[0].create(), schemaVersion: 8 } as never as ReturnType<
      (typeof templates)[0]['create']
    >;
    await saveDesign(d);
    const rd = await copyDesign(d.id, 'Old copy');
    if (!rd.ok) throw new Error(rd.reason);
    expect((await loadDesign(rd.id))?.schemaVersion).toBe(SCHEMA_VERSION);
    const p = { ...newProject('Old'), schemaVersion: 20 } as never as ReturnType<typeof newProject>;
    await saveProject(p);
    const rp = await copyProject(p.id, 'Old (copy)');
    if (!rp.ok) throw new Error(rp.reason);
    expect((await db.projects.get(rp.id))?.project.schemaVersion).toBe(PROJECT_SCHEMA);
  });

  it('a corrupt or missing row is refused with a reason; nothing is added or changed', async () => {
    const d = templates[0].create();
    const badDesign = {
      id: d.id,
      name: d.name,
      updatedAt: d.updatedAt,
      design: { ...d, schemaVersion: 99 },
    };
    await db.designs.put(badDesign as never);
    const p = newProject('Broken');
    const badProject = {
      id: p.id,
      name: p.name,
      updatedAt: p.updatedAt,
      project: { ...p, schemaVersion: 99 },
    };
    await db.projects.put(badProject as never);
    const garbage = { id: 'garbage', name: 'x', updatedAt: '2026', project: 'not a project' };
    await db.projects.put(garbage as never);
    const counts = async () => [await db.designs.count(), await db.projects.count()];
    const before = await counts();

    const rd = await copyDesign(d.id, 'copy');
    const rp = await copyProject(p.id, 'copy');
    const rg = await copyProject('garbage', 'copy');
    const rm = await copyProject('missing', 'copy');
    for (const r of [rd, rp, rg, rm]) {
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.reason.length).toBeGreaterThan(0);
    }
    expect(await counts()).toEqual(before);
    expect(await db.designs.get(d.id)).toEqual(badDesign); // kept as it was (ADR-012)
    expect(await db.projects.get(p.id)).toEqual(badProject);
    expect(await db.projects.get('garbage')).toEqual(garbage);
  });
});
