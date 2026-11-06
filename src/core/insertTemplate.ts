/**
 * Insert a project template into an open project (ADR-123, research "paste ensemble"). The template's pieces join
 * the project as fresh copies with new ids (ADR-011): relative positions and placements are kept, linked copies get
 * new link ids so they never join the project's own links (ADR-111), and the template's run-part recipe applies when
 * the project has none of its own (ADR-060). Overlaps are left to the project checks (ADR-008).
 */
import { newId } from './design';
import { placedBounds, type Project, type ProjectItem } from './project';
import { withSettings } from './projectSettings';
import { remapRunExtras, remapRunKey, type ProjectTemplate } from './projectTemplate';
import type { Mm } from './types';

export interface InsertResult {
  project: Project;
  /** The inserted pieces, in template order. */
  ids: string[];
  /** Template variables whose name the project already had: the project's are kept and the bindings follow them. */
  kept: string[];
}

/** Where a template's block goes when no point is given: right of the project's pieces, against the back. */
export function insertPoint(project: Project): { x: Mm; z: Mm } {
  const right = project.items.length
    ? Math.max(...project.items.map((i) => placedBounds(i).x + placedBounds(i).w))
    : 0;
  return { x: right, z: 0 };
}

/** The template's variables whose name the project already has (compared without case): the project's are kept. */
export function keptVariables(project: Project, t: ProjectTemplate): string[] {
  const have = new Set((project.variables ?? []).map((v) => v.name.toLowerCase()));
  return (t.variables ?? []).filter((v) => have.has(v.name.toLowerCase())).map((v) => v.name);
}

/** The project with `t`'s pieces added, the block's left-back corner at `at` (default `insertPoint`). */
export function insertTemplate(
  project: Project,
  t: ProjectTemplate,
  at: { x: Mm; z: Mm } = insertPoint(project),
): InsertResult {
  if (!t.items.length) return { project, ids: [], kept: [] };
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
      // An inserted piece follows the project's settings, as a piece added from the catalog does (ADR-124, ADR-170).
      design: withSettings({ ...structuredClone(i.design), id: newId() }, project.settings),
      quantity: i.quantity,
      position: { x: i.offset.x - ox + ax, y: i.offset.y, z: i.offset.z - oz + az },
      rotationY: i.rotationY,
      ...(pl ? { placement: structuredClone(pl) } : {}),
      ...(i.linkId ? { linkId: linkOf(i.linkId) } : {}),
      ...(i.angle ? { angle: i.angle } : {}),
      ...(i.bindings?.length ? { bindings: structuredClone(i.bindings) } : {}),
    };
  });
  // The template's variables join the project; one whose name the project already has keeps the project's (ADR-170).
  const kept = keptVariables(project, t);
  const added = (t.variables ?? []).filter((v) => !kept.includes(v.name));
  const variables = added.length
    ? [...(project.variables ?? []), ...added.map((v) => ({ ...v, id: newId() }))]
    : project.variables;
  const connections = (t.connections ?? [])
    .filter((c) => ids.has(c.itemIds[0]) && ids.has(c.itemIds[1]))
    .map((c) => ({
      id: newId(),
      itemIds: [ids.get(c.itemIds[0])!, ids.get(c.itemIds[1])!] as [string, string],
    }));
  // Run handles and sinks join with the new piece ids and new ids of their own (ADR-204).
  const extras = remapRunExtras(t.runHandles, t.sinks, ids);
  const recipe = t.runRecipe;
  const removed = (recipe?.removed ?? [])
    .map((k) => remapRunKey(k, ids))
    .filter((k): k is string => k !== null);
  const next: Project = {
    ...project,
    items: [...project.items, ...items],
    ...(recipe && !project.runSettings ? { runSettings: { ...recipe.settings } } : {}),
    ...(removed.length
      ? { runPartsRemoved: [...(project.runPartsRemoved ?? []), ...removed] }
      : {}),
    ...(variables ? { variables } : {}),
    ...(connections.length
      ? { connections: [...(project.connections ?? []), ...connections] }
      : {}),
    ...(extras.runHandles.length
      ? { runHandles: [...(project.runHandles ?? []), ...extras.runHandles] }
      : {}),
    ...(extras.sinks.length ? { sinks: [...(project.sinks ?? []), ...extras.sinks] } : {}),
  };
  return { project: next, ids: items.map((i) => i.id), kept };
}
