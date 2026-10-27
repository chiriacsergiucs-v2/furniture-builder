/**
 * Insert a project template into an open project (ADR-123, research "paste ensemble"). The template's pieces join
 * the project as fresh copies with new ids (ADR-011): relative positions and placements are kept, linked copies get
 * new link ids so they never join the project's own links (ADR-111), and the template's run-part recipe applies when
 * the project has none of its own (ADR-060). Overlaps are left to the project checks (ADR-008).
 */
import { newId } from './design';
import { placedBounds, type Project, type ProjectItem } from './project';
import { remapRunKey, type ProjectTemplate } from './projectTemplate';
import type { Mm } from './types';

export interface InsertResult {
  project: Project;
  /** The inserted pieces, in template order. */
  ids: string[];
}

/** Where a template's block goes when no point is given: right of the project's pieces, against the back. */
export function insertPoint(project: Project): { x: Mm; z: Mm } {
  const right = project.items.length
    ? Math.max(...project.items.map((i) => placedBounds(i).x + placedBounds(i).w))
    : 0;
  return { x: right, z: 0 };
}

/** The project with `t`'s pieces added, the block's left-back corner at `at` (default `insertPoint`). */
export function insertTemplate(
  project: Project,
  t: ProjectTemplate,
  at: { x: Mm; z: Mm } = insertPoint(project),
): InsertResult {
  if (!t.items.length) return { project, ids: [] };
  // Templates saved with their room keep room positions: the block is moved by its own left-back corner.
  const ox = Math.min(...t.items.map((i) => i.offset.x));
  const oz = Math.min(...t.items.map((i) => i.offset.z));
  const ax = Math.round(at.x) || 0,
    az = Math.round(at.z) || 0;
  const ids = new Map(t.items.map((i) => [i.ref, newId()]));
  const links = new Map<string, string>();
  const linkOf = (l: string) => {
    if (!links.has(l)) links.set(l, newId());
    return links.get(l)!;
  };
  const items: ProjectItem[] = t.items.map((i) => {
    const pl =
      i.placement?.kind === 'above'
        ? { ...i.placement, baseId: ids.get(i.placement.baseId) ?? i.placement.baseId }
        : i.placement;
    return {
      id: ids.get(i.ref)!,
      design: { ...structuredClone(i.design), id: newId() },
      quantity: i.quantity,
      position: { x: i.offset.x - ox + ax, y: i.offset.y, z: i.offset.z - oz + az },
      rotationY: i.rotationY,
      ...(pl ? { placement: structuredClone(pl) } : {}),
      ...(i.linkId ? { linkId: linkOf(i.linkId) } : {}),
    };
  });
  const recipe = t.runRecipe;
  const removed = (recipe?.removed ?? [])
    .map((k) => remapRunKey(k, ids))
    .filter((k): k is string => k !== null);
  const next: Project = {
    ...project,
    items: [...project.items, ...items],
    ...(recipe && !project.runSettings ? { runSettings: { ...recipe.settings } } : {}),
    ...(removed.length ? { runPartsRemoved: [...(project.runPartsRemoved ?? []), ...removed] } : {}),
  };
  return { project: next, ids: items.map((i) => i.id) };
}
