/**
 * Linked copies of a piece in a project (ADR-111): items with the same `linkId` share their whole design, as if they
 * were one piece placed several times. Each copy keeps its own id, position, turn, placement, quantity, lock and its
 * design's own id.
 */
import { duplicateItem } from './arrange';
import { newId } from './design';
import type { Project, ProjectItem } from './project';
import type { Design } from './types';

/** The other items linked to `id` (not `id` itself); empty when it is not linked. */
export function linkedWith(project: Project, id: string): ProjectItem[] {
  const it = project.items.find((i) => i.id === id);
  if (!it?.linkId) return [];
  return project.items.filter((i) => i.id !== id && i.linkId === it.linkId);
}

/** How many copies share `id`'s link, itself included; 1 when it is not linked. */
export const linkCount = (project: Project, id: string): number =>
  linkedWith(project, id).length + 1;

const withoutLink = (it: ProjectItem): ProjectItem => {
  const { linkId: _l, ...rest } = it;
  void _l;
  return rest;
};

/** A link held by one item only is no link: it goes. Unchanged projects come back as the same object. */
export function pruneLinks(project: Project): Project {
  const counts = new Map<string, number>();
  for (const i of project.items)
    if (i.linkId) counts.set(i.linkId, (counts.get(i.linkId) ?? 0) + 1);
  if (![...counts.values()].some((n) => n < 2)) return project;
  return {
    ...project,
    items: project.items.map((i) => (i.linkId && counts.get(i.linkId)! < 2 ? withoutLink(i) : i)),
  };
}

/**
 * Place a linked copy of `id` beside it, as Duplicate does (ADR-069); both carry the same `linkId` (the original's, or
 * a new one). Null for an unknown id.
 */
export function addLinkedCopy(
  project: Project,
  id: string,
): { project: Project; id: string } | null {
  const src = project.items.find((i) => i.id === id);
  const res = src && duplicateItem(project, id);
  if (!src || !res) return null;
  const linkId = src.linkId ?? newId();
  return {
    id: res.id,
    project: {
      ...res.project,
      items: res.project.items.map((i) => (i.id === id || i.id === res.id ? { ...i, linkId } : i)),
    },
  };
}

/** `design` as copy `to` holds it: everything shared except the design's own id. */
const shared = (design: Design, to: ProjectItem): Design =>
  design.id === to.design.id ? design : { ...design, id: to.design.id };

/**
 * Carry design changes from `before` to `next` across links. For each link group where some copies' designs changed
 * and others did not: with `all`, the unchanged copies take the changed design (the first changed copy's); without it,
 * the changed copies leave the group. When every copy changed (e.g. a board applied to the whole project) nothing is
 * carried. Groups left with one item lose their link.
 */
export function propagateLinks(before: Project | null, next: Project, all: boolean): Project {
  if (!before || !next.items.some((i) => i.linkId)) return pruneLinks(next);
  const old = new Map(before.items.map((i) => [i.id, i.design]));
  const changed = (i: ProjectItem) => old.has(i.id) && old.get(i.id) !== i.design;
  const groups = new Map<string, ProjectItem[]>();
  for (const i of next.items)
    if (i.linkId) groups.set(i.linkId, [...(groups.get(i.linkId) ?? []), i]);
  const source = new Map<string, Design>();
  const leave = new Set<string>();
  for (const [linkId, members] of groups) {
    const moved = members.filter(changed);
    if (!moved.length || moved.length === members.length) continue;
    if (all) source.set(linkId, moved[0].design);
    else for (const m of moved) leave.add(m.id);
  }
  if (!source.size && !leave.size) return pruneLinks(next);
  return pruneLinks({
    ...next,
    items: next.items.map((i) => {
      if (leave.has(i.id)) return withoutLink(i);
      const d = i.linkId ? source.get(i.linkId) : undefined;
      return d && !changed(i) ? { ...i, design: shared(d, i) } : i;
    }),
  });
}
