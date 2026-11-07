// Deleting a project's kept versions (ADR-203, G-190): `deleteProjectVersions(ids)` removes exactly the rows it is
// given — the ones `listProjectVersions` returned — so unreadable rows and other projects' versions stay (ADR-012).
// The two-question flow (Keep is the default) is in tests/find-it/piece-safety.test.tsx.
import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { newProject } from '../src/core/project';
import { makeVersion } from '../src/core/projectVersion';
import {
  db,
  deleteProject,
  deleteProjectVersions,
  listProjectVersions,
  saveProject,
  saveProjectVersion,
} from '../src/persist/db';

describe('deleteProjectVersions (ADR-203, G-190)', () => {
  beforeEach(async () => {
    await db.projectVersions.clear();
    await db.projects.clear();
  });

  it('removes only the listed readable versions; unreadable rows and other projects stay', async () => {
    const p = newProject('Gone'),
      other = newProject('Other');
    await saveProject(p);
    await saveProject(other);
    const mine = [makeVersion(p, 'manual'), makeVersion(p, 'session')];
    for (const v of mine) await saveProjectVersion(v);
    const theirs = makeVersion(other, 'manual');
    await saveProjectVersion(theirs);
    await db.projectVersions.put({ id: 'bad', projectId: p.id } as never);

    const listed = await listProjectVersions(p.id);
    expect(listed.map((v) => v.id).sort()).toEqual(mine.map((v) => v.id).sort());
    await deleteProject(p.id);
    await deleteProjectVersions(listed.map((v) => v.id));
    expect(await listProjectVersions(p.id)).toEqual([]);
    expect(await db.projectVersions.get('bad')).toBeDefined();
    expect((await listProjectVersions(other.id)).map((v) => v.id)).toEqual([theirs.id]);
  });

  it('Keep (no call) and an empty list delete nothing', async () => {
    const p = newProject('Kept');
    await saveProject(p);
    await saveProjectVersion(makeVersion(p, 'manual'));
    await deleteProject(p.id);
    await deleteProjectVersions([]);
    expect(await listProjectVersions(p.id)).toHaveLength(1);
    expect(await db.projectVersions.count()).toBe(1);
  });
});
