/**
 * Kept versions of a project (ADR-123, research "version history and recovery"; G-083). A version is a full copy
 * of the project document at one moment, saved on the device in its own table (Dexie v10). Versions are kept until
 * the user deletes them (G-156): nothing removes them automatically, and restoring never rewrites one.
 */
import { newId } from './design';
import { validateProject, type Project } from './project';

/** `session`: the project as it was opened, kept at the first change after opening (G-155). */
export type VersionKind = 'session' | 'manual' | 'before-restore';

export interface ProjectVersion {
  id: string;
  projectId: string;
  savedAt: string;
  kind: VersionKind;
  project: Project;
}

export const VERSION_KIND_TEXT: Record<VersionKind, string> = {
  session: 'When opened',
  manual: 'Saved by you',
  'before-restore': 'Before a restore',
};

export function makeVersion(project: Project, kind: VersionKind, now = new Date()): ProjectVersion {
  return {
    id: newId(),
    projectId: project.id,
    savedAt: now.toISOString(),
    kind,
    project: structuredClone(project),
  };
}

/** Problems of a version read from storage; never throws (ADR-008). Empty = usable. */
export function validateVersion(v: unknown): string[] {
  if (!v || typeof v !== 'object') return ['Version must be an object'];
  const r = v as Record<string, unknown>;
  const errs: string[] = [];
  if (typeof r.id !== 'string' || !r.id) errs.push('Missing version id');
  if (typeof r.projectId !== 'string' || !r.projectId) errs.push('Missing project id');
  if (typeof r.savedAt !== 'string' || Number.isNaN(Date.parse(r.savedAt)))
    errs.push('Missing saved time');
  if (!['session', 'manual', 'before-restore'].includes(r.kind as string))
    errs.push('Unknown version kind');
  errs.push(...validateProject(r.project));
  if (!errs.length && (r.project as Project).id !== r.projectId)
    errs.push('The version belongs to another project');
  return errs;
}

/**
 * The project to continue with after restoring `v` over `current`: the version's content under the current
 * project's id, name kept from the version, stamped now. The version itself is never changed.
 */
export function restoredProject(current: Project, v: ProjectVersion, now = new Date()): Project {
  return { ...structuredClone(v.project), id: current.id, updatedAt: now.toISOString() };
}
