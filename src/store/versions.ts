/**
 * Kept project versions (ADR-123): the store holds the open project, storage holds its versions. Restoring keeps the
 * current state as a version first, then puts the chosen version's content in place (one undo step); no version is
 * rewritten or deleted here (G-156).
 */
import { makeVersion, restoredProject, type ProjectVersion } from '../core/projectVersion';
import { db, saveProjectVersion } from '../persist/db';
import { useDesign } from './designStore';

/** Keep the open project as a version the user asked for ("Save a version"). */
export async function saveVersionNow(database = db): Promise<ProjectVersion | null> {
  const p = useDesign.getState().project;
  if (!p) return null;
  const v = makeVersion(p, 'manual');
  await saveProjectVersion(v, database);
  return v;
}

/**
 * The project as it was opened, kept once per editing session at its first change (G-155). Projects opened empty
 * (nothing to go back to) are not kept.
 */
export async function keepSessionVersion(database = db): Promise<ProjectVersion | null> {
  const base = useDesign.getState().takeSessionBase();
  if (!base || (!base.items.length && !base.room && !base.models?.length)) return null;
  const v = makeVersion(base, 'session');
  await saveProjectVersion(v, database);
  return v;
}

/** Restore `v` over the open project: the current state is kept as a version first. */
export async function restoreVersion(v: ProjectVersion, database = db): Promise<boolean> {
  const p = useDesign.getState().project;
  if (!p || p.id !== v.projectId) return false;
  await saveProjectVersion(makeVersion(p, 'before-restore'), database);
  useDesign.getState().restoreProjectTo(restoredProject(p, v));
  return true;
}
