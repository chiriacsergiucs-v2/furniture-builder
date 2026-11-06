// ADR-211 (G-389): versions of deleted projects. `listOrphanVersions` lists the readable versions whose project row is
// gone, newest first; unreadable rows are skipped and kept (ADR-012); only the user's Delete removes one (G-156).
// Restore as a new project and Delete in History are proven in `tests/find-it/editor-nav.test.tsx`.
import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { templates } from '../src/core/design';
import { makeItem, newProject, type Project } from '../src/core/project';
import { makeVersion } from '../src/core/projectVersion';
import {
  db,
  deleteProject,
  deleteProjectVersion,
  listOrphanVersions,
  listProjectVersions,
  saveProject,
  saveProjectVersion,
} from '../src/persist/db';

const tpl = (id: string) => templates.find((x) => x.id === id)!.create();
function project(name: string): Project {
  const p = newProject(name);
  return { ...p, items: [makeItem(p, tpl('base-door'))] };
}

describe('versions of deleted projects (ADR-211, G-389)', () => {
  beforeEach(async () => {
    await db.projects.clear();
    await db.projectVersions.clear();
  });

  it('lists only readable versions whose project is gone, newest first; unreadable rows stay', async () => {
    const live = project('Kept kitchen');
    const gone = project('Deleted hallway');
    await saveProject(live);
    await saveProject(gone);
    const liveV = makeVersion(live, 'manual', new Date('2026-11-01T10:00:00Z'));
    const old = makeVersion(gone, 'manual', new Date('2026-11-01T10:00:00Z'));
    const recent = makeVersion(gone, 'session', new Date('2026-11-03T10:00:00Z'));
    for (const v of [liveV, old, recent]) await saveProjectVersion(v);
    // Unreadable rows: no project, and a wrong kind; neither has a project row.
    await db.projectVersions.put({ id: 'bad-1', projectId: 'nobody' } as never);
    await db.projectVersions.put({ ...old, id: 'bad-2', kind: 'x' } as never);

    // While its project exists, no version is an orphan.
    expect(await listOrphanVersions()).toEqual([]);

    // The project is deleted with Keep versions (ADR-203): its versions stay and are listed.
    await deleteProject(gone.id);
    const orphans = await listOrphanVersions();
    expect(orphans.map((v) => v.id)).toEqual([recent.id, old.id]);
    expect(orphans.every((v) => v.projectId === gone.id)).toBe(true);
    expect(await db.projectVersions.get('bad-1')).toBeDefined();
    expect(await db.projectVersions.get('bad-2')).toBeDefined();
    expect(await db.projectVersions.count()).toBe(5);
    // The live project's versions are untouched.
    expect((await listProjectVersions(live.id)).map((v) => v.id)).toEqual([liveV.id]);
  });

  it('Delete removes only the tapped version; listing never deletes anything', async () => {
    const gone = project('Deleted desk');
    const a = makeVersion(gone, 'manual', new Date('2026-11-01T10:00:00Z'));
    const b = makeVersion(gone, 'manual', new Date('2026-11-02T10:00:00Z'));
    await saveProjectVersion(a);
    await saveProjectVersion(b);
    await listOrphanVersions();
    await listOrphanVersions();
    expect(await db.projectVersions.count()).toBe(2);
    await deleteProjectVersion(b.id);
    expect((await listOrphanVersions()).map((v) => v.id)).toEqual([a.id]);
    expect(await db.projectVersions.get(a.id)).toBeDefined();
  });

  it('a restored copy (new id) gives the project a row again; the version itself stays', async () => {
    const gone = project('Deleted bedroom');
    const v = makeVersion(gone, 'manual');
    await saveProjectVersion(v);
    // A copy under a new id: the orphan is still an orphan, and stays.
    await saveProject({
      ...structuredClone(v.project),
      id: 'copy-1',
      name: 'Deleted bedroom (restored)',
    });
    expect((await listOrphanVersions()).map((x) => x.id)).toEqual([v.id]);
    expect(await db.projectVersions.get(v.id)).toBeDefined();
  });
});
