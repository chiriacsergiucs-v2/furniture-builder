/**
 * Value sets (ADR-164): a second, third… set of values for the project's variables (ADR-163). Set 1 is the variables
 * themselves. A complete set (every variable has a value that evaluates) has one duplicate of every bound piece,
 * linked to its original (ADR-111) so design edits reach it, bound values evaluated with the set's values, placed at
 * the set's origin. With a room, the set draws the room translated to its origin and its pieces are checked against
 * that room. A complete set can be saved as a separate project: the whole project at the set's values, the set's
 * values becoming set 1. Pure TypeScript, no UI.
 */
import { t } from './i18n';
import { newId } from './design';
import {
  placedBounds,
  pruneGroups,
  pruneRunExtras,
  type Project,
  type ProjectItem,
} from './project';
import { evaluateVariables, readTarget, writeTarget } from './variables';
import type { Design } from './types';
import type { VariableSet } from './setRoom';

export { roomAt, setRooms, type VariableSet } from './setRoom';

/** Gap between set 1 and the next set, and between sets. */
export const SET_GAP = 500;

export const setName = (n: number) => t('Set {n}', { n });

/** How many of the variables have a value in the set, and the total. */
export function setProgress(project: Project, set: VariableSet): { done: number; total: number } {
  const vars = project.variables ?? [];
  return {
    done: vars.filter((v) => (set.values[v.id] ?? '').trim() !== '').length,
    total: vars.length,
  };
}

/** A set is complete when every variable has a value that evaluates. */
export function setComplete(project: Project, set: VariableSet): boolean {
  const vars = project.variables ?? [];
  if (!vars.length) return false;
  const ev = evaluateVariables(vars, set.values);
  return vars.every((v) => ev.get(v.id)?.value !== undefined);
}

/** The x extent of the room, or of the pieces of set 1 (and the sets before `before`) when there is no room. */
export function setSpan(project: Project): { x0: number; w: number } {
  if (project.room) {
    const xs = project.room.outline.map((p) => p[0]);
    const x0 = Math.min(...xs);
    return { x0, w: Math.max(...xs) - x0 };
  }
  const items = project.items.filter((i) => !i.set);
  if (!items.length) return { x0: 0, w: 0 };
  const bs = items.map(placedBounds);
  const x0 = Math.min(...bs.map((b) => b.x));
  return { x0, w: Math.max(...bs.map((b) => b.x + b.w)) - x0 };
}

/** Add an empty set beside the last one. */
export function addSet(project: Project): { project: Project; id: string } {
  const sets = project.variableSets ?? [];
  const n = sets.length + 2;
  const span = setSpan(project);
  const origin = { x: (span.w + SET_GAP) * (n - 1), z: 0 };
  const id = newId();
  const set: VariableSet = { id, name: setName(n), values: {}, origin };
  return { project: { ...project, variableSets: [...sets, set] }, id };
}

export function updateSet(
  project: Project,
  id: string,
  patch: Partial<Pick<VariableSet, 'name' | 'values' | 'origin'>>,
): Project {
  const sets = project.variableSets ?? [];
  if (!sets.some((s) => s.id === id)) return project;
  const before = sets.find((s) => s.id === id)!;
  const variableSets = sets.map((s) => (s.id === id ? { ...s, ...patch } : s));
  let next: Project = { ...project, variableSets };
  // Moving the origin moves the set's pieces along with it.
  if (patch.origin && (patch.origin.x !== before.origin.x || patch.origin.z !== before.origin.z)) {
    const dx = patch.origin.x - before.origin.x,
      dz = patch.origin.z - before.origin.z;
    next = {
      ...next,
      items: next.items.map((i) =>
        i.set?.id === id
          ? { ...i, position: { ...i.position, x: i.position.x + dx, z: i.position.z + dz } }
          : i,
      ),
    };
  }
  return next;
}

/** Remove a set and its pieces. */
export function removeSet(project: Project, id: string): Project {
  const sets = (project.variableSets ?? []).filter((s) => s.id !== id);
  return pruneRunExtras(
    pruneGroups({
      ...project,
      items: project.items.filter((i) => i.set?.id !== id),
      ...(sets.length ? { variableSets: sets } : { variableSets: undefined }),
    }),
  );
}

/** A duplicate of `src` for `set`: new ids, the original's design, placed at the set's origin. */
function duplicateFor(src: ProjectItem, set: VariableSet): ProjectItem {
  const { locked: _l, sizeLocked: _s, linkId: _k, ...rest } = structuredClone(src);
  void _l;
  void _s;
  void _k;
  return {
    ...rest,
    id: newId(),
    design: { ...rest.design, id: newId() },
    ...(src.bindings ? { bindings: src.bindings } : {}),
    set: { id: set.id, of: src.id },
    position: {
      ...src.position,
      x: src.position.x + set.origin.x,
      z: src.position.z + set.origin.z,
    },
  };
}

/** `design` as the copy carries it: the same but for the copy's own id. */
const designFor = (src: Design, own: string): Design => ({ ...src, id: own });

/** Design content without its id, for "did the original change" (cached per design object). */
const contentCache = new WeakMap<Design, string>();
const content = (d: Design): string => {
  let c = contentCache.get(d);
  if (c === undefined) {
    const { id: _id, ...rest } = d;
    void _id;
    c = JSON.stringify(rest);
    contentCache.set(d, c);
  }
  return c;
};

/**
 * The set-1 pieces a set duplicates (ADR-164, G-321 closed): every bound piece, every piece placed on or above one
 * of them (ADR-031, through a chain) and every piece grouped with one of them (ADR-097).
 */
export function setMembers(project: Project): Set<string> {
  const base = project.items.filter((i) => !i.set);
  const out = new Set(base.filter((i) => i.bindings?.length).map((i) => i.id));
  if (!out.size) return out;
  for (;;) {
    const before = out.size;
    for (const i of base) {
      if (out.has(i.id)) continue;
      if (i.placement?.kind === 'above' && out.has(i.placement.baseId)) out.add(i.id);
    }
    for (const g of project.groups ?? [])
      if (g.itemIds.some((x) => out.has(x))) g.itemIds.forEach((x) => out.add(x));
    if (out.size === before) return out;
  }
}

/**
 * Keep every complete set's duplicates in step with set 1: one duplicate per member piece (`setMembers`), its
 * design, bindings and template reference the original's (one way, ADR-164: a duplicate is edited through its
 * original); a duplicate whose original is gone or left the members goes. An incomplete set keeps what it has.
 * The same project when nothing changes; every commit applies it.
 */
export function syncSets(project: Project): Project {
  const sets = project.variableSets ?? [];
  if (!sets.length) return project;
  const items = [...project.items];
  let changed = false;
  const byId = new Map(items.map((i) => [i.id, i]));
  const members = setMembers(project);
  for (const set of sets) {
    const complete = setComplete(project, set);
    for (let n = items.length - 1; n >= 0; n--) {
      const d = items[n];
      if (d.set?.id !== set.id) continue;
      const src = byId.get(d.set.of);
      if (!src || !members.has(src.id)) {
        items.splice(n, 1);
        changed = true;
        continue;
      }
      // The original's design with the duplicate's own bound values: what the duplicate should hold.
      let want = { ...d, design: designFor(src.design, d.design.id) };
      for (const b of src.bindings ?? []) {
        const v = readTarget(d, b.target);
        if (v !== undefined) want = writeTarget(want, b.target, v);
      }
      const sameDesign = content(d.design) === content(want.design);
      const sameRef = JSON.stringify(d.ref ?? null) === JSON.stringify(src.ref ?? null);
      const sameBindings =
        d.bindings === src.bindings ||
        JSON.stringify(d.bindings ?? null) === JSON.stringify(src.bindings ?? null);
      if (!sameDesign || !sameBindings || !sameRef) {
        items[n] = {
          ...d,
          design: sameDesign ? d.design : want.design,
          ...(src.bindings ? { bindings: src.bindings } : {}),
          ...(src.ref ? { ref: structuredClone(src.ref) } : {}),
        };
        if (!src.bindings) delete items[n].bindings;
        if (!src.ref) delete items[n].ref;
        changed = true;
      }
    }
    if (!complete) continue;
    const have = new Set(items.filter((i) => i.set?.id === set.id).map((i) => i.set!.of));
    for (const src of project.items) {
      if (src.set || !members.has(src.id) || have.has(src.id)) continue;
      items.push(duplicateFor(src, set));
      changed = true;
    }
  }
  if (!changed) return project;
  // A duplicate placed on a piece follows that piece's duplicate in its set, or stands free at its position.
  const dupOf = new Map<string, string>();
  for (const i of items) if (i.set) dupOf.set(`${i.set.id}:${i.set.of}`, i.id);
  const setOf = new Map(items.map((i) => [i.id, i.set?.id]));
  const placed = items.map((i) => {
    if (!i.set || i.placement?.kind !== 'above') return i;
    // Already on its set's own copy of the base.
    if (setOf.get(i.placement.baseId) === i.set.id) return i;
    const base = dupOf.get(`${i.set.id}:${i.placement.baseId}`);
    if (base)
      return i.placement.baseId === base
        ? i
        : { ...i, placement: { ...i.placement, baseId: base } };
    const { placement: _p, ...free } = i;
    void _p;
    return free;
  });
  // A duplicate grouped with its original's group mates is grouped with their duplicates (ADR-097).
  const groups = project.groups?.length
    ? [
        ...project.groups,
        ...sets.flatMap((set) =>
          project
            .groups!.map((g) => ({
              id: `${g.id}:${set.id}`,
              name: g.name,
              itemIds: g.itemIds
                .map((x) => dupOf.get(`${set.id}:${x}`))
                .filter((x): x is string => !!x),
            }))
            .filter((g) => g.itemIds.length >= 2 && !project.groups!.some((o) => o.id === g.id)),
        ),
      ]
    : project.groups;
  return { ...project, items: placed, ...(groups ? { groups } : {}) };
}

/**
 * The whole project at a set's values as its own project (ADR-164): every piece not in a set plus the set's
 * duplicates at their originals' positions, the set's values as set 1, no sets, the room, settings, groups and run
 * requests pruned to the surviving pieces. New ids (ADR-011). Null for an unknown or incomplete set.
 */
export function projectFromSet(project: Project, setId: string, now = new Date()): Project | null {
  const set = project.variableSets?.find((s) => s.id === setId);
  if (!set || !setComplete(project, set)) return null;
  const idMap = new Map<string, string>();
  // Set-1 pieces that have duplicates in this set are replaced by them; the other pieces come as they are.
  const replaced = new Map(
    project.items.filter((i) => i.set?.id === setId).map((i) => [i.set!.of, i]),
  );
  const chosen: { from: ProjectItem; item: ProjectItem }[] = [];
  for (const i of project.items) {
    if (i.set) continue;
    const dup = replaced.get(i.id);
    chosen.push({ from: i, item: dup ?? i });
  }
  for (const c of chosen) idMap.set(c.from.id, newId());
  const mapId = (id: string) => idMap.get(id) ?? id;
  const dupToFrom = new Map(chosen.map((c) => [c.item.id, c.from.id]));
  const items: ProjectItem[] = chosen.map(({ from, item }) => {
    const { set: _s, ...rest } = structuredClone(item);
    void _s;
    const placement =
      rest.placement?.kind === 'above'
        ? {
            ...rest.placement,
            baseId: mapId(dupToFrom.get(rest.placement.baseId) ?? rest.placement.baseId),
          }
        : rest.placement;
    return {
      ...rest,
      id: idMap.get(from.id)!,
      design: { ...rest.design, id: newId() },
      position: { ...from.position },
      ...(placement ? { placement } : {}),
    };
  });
  const ids = new Set(items.map((i) => i.id));
  const keep = (list: string[]) => list.map(mapId).filter((x) => ids.has(x));
  const variables = (project.variables ?? []).map((v) => ({
    ...v,
    expr: set.values[v.id] ?? v.expr,
  }));
  const stamp = now.toISOString();
  const {
    variableSets: _vs,
    runParts: _rp,
    runPartsRemoved: _rr,
    ...rest
  } = structuredClone(project);
  void _vs;
  void _rp;
  void _rr;
  const next: Project = {
    ...rest,
    id: newId(),
    name: t('{project} — {set}', { project: project.name, set: set.name }),
    createdAt: stamp,
    updatedAt: stamp,
    items,
    variables,
    ...(project.groups
      ? { groups: project.groups.map((g) => ({ ...g, id: newId(), itemIds: keep(g.itemIds) })) }
      : {}),
    ...(project.runRequests
      ? {
          runRequests: project.runRequests
            .map((r) => ({ ...r, from: keep(r.from) }))
            .filter((r) => r.from.length),
        }
      : {}),
    ...(project.runHandles
      ? {
          runHandles: project.runHandles
            .map((h) => ({ ...h, id: newId(), from: keep(h.from) }))
            .filter((h) => h.from.length),
        }
      : {}),
    ...(project.sinks
      ? {
          sinks: project.sinks
            .map((s) => ({ ...s, id: newId(), baseId: mapId(s.baseId) }))
            .filter((s) => ids.has(s.baseId)),
        }
      : {}),
  };
  return pruneRunExtras(pruneGroups(next));
}
