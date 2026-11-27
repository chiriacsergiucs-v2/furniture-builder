/**
 * Definition lists (ADR-303): named lists of values for the project's variables (ADR-166) and the project settings
 * (ADR-124). A piece links to one list: its bindings are evaluated with the list's values and it follows the list's
 * settings. Precedence for a variable: the piece's own override › the list's value › the project's value; for a
 * setting: the list's › the project's. Lists change pieces in place; value sets (ADR-167) are a separate thing and a
 * value-set duplicate keeps its set's values. Pure TypeScript, no UI.
 */
import { t } from '@furniture-builder/i18n';
import { newId } from './design';
import type { DefinitionList, Project, ProjectItem } from './project';
import { listOf, withSettings } from './projectSettings';
import type { Diagnostic } from './types';
import { evaluateVariables, MAX_EXPR, MAX_VARIABLE_NAME, MAX_VARIABLES } from './variableCore';

export { listOf };

/** "List A", "List B", … the first free one (case-insensitive), then "List 27", … */
function freeName(lists: readonly DefinitionList[]): string {
  const taken = new Set(lists.map((l) => l.name.toLowerCase()));
  for (let i = 0; ; i++) {
    const tag = i < 26 ? String.fromCharCode(65 + i) : String(i + 1);
    const name = t('List {tag}', { tag });
    if (!taken.has(name.toLowerCase())) return name;
  }
}

/** Why a list name cannot be used, or null. */
export function listNameProblem(
  name: string,
  lists: readonly DefinitionList[],
  selfId?: string,
): string | null {
  const n = name.trim();
  if (!n) return t('A definition list needs a name.');
  if (n.length > MAX_VARIABLE_NAME)
    return t('A definition list name is at most {n} characters.', { n: MAX_VARIABLE_NAME });
  if (lists.some((l) => l.id !== selfId && l.name.toLowerCase() === n.toLowerCase()))
    return t('A definition list named “{name}” already exists.', { name: n });
  return null;
}

/** A new, empty list ("List A"): every value and setting is the project's until set. */
export function addList(project: Project): { project: Project; id: string } {
  const lists = project.definitionLists ?? [];
  if (lists.length >= MAX_VARIABLES) return { project, id: '' };
  const id = newId();
  const list: DefinitionList = { id, name: freeName(lists), values: {} };
  return { project: { ...project, definitionLists: [...lists, list] }, id };
}

/** Rename a list; an empty, too long or taken name is refused (the same project back). */
export function renameList(project: Project, id: string, name: string): Project {
  const lists = project.definitionLists ?? [];
  if (listNameProblem(name, lists, id)) return project;
  return {
    ...project,
    definitionLists: lists.map((l) => (l.id === id ? { ...l, name: name.trim() } : l)),
  };
}

/** Set (or with an empty text or null, clear) a list's value of a variable. */
export function setListValue(
  project: Project,
  listId: string,
  variableId: string,
  expr: string | null,
): Project {
  const lists = project.definitionLists ?? [];
  if (!lists.some((l) => l.id === listId)) return project;
  const v = expr?.trim() ?? '';
  if (v.length > MAX_EXPR) return project;
  return {
    ...project,
    definitionLists: lists.map((l) => {
      if (l.id !== listId) return l;
      const { [variableId]: _old, ...values } = l.values;
      void _old;
      return { ...l, values: v ? { ...values, [variableId]: v } : values };
    }),
  };
}

/** Remove a list: its pieces are unlinked and keep every number and board they have. */
export function removeList(project: Project, id: string): Project {
  const lists = project.definitionLists ?? [];
  if (!lists.some((l) => l.id === id)) return project;
  const rest = lists.filter((l) => l.id !== id);
  const items = project.items.map((i) => (i.list?.id === id ? unlinked(i) : i));
  const next: Project = { ...project, items };
  if (rest.length) next.definitionLists = rest;
  else delete next.definitionLists;
  return next;
}

function unlinked(item: ProjectItem): ProjectItem {
  const { list: _l, ...rest } = item;
  void _l;
  return rest;
}

/** The pieces linked to a list (value-set duplicates are never linked). */
export const listUsers = (project: Project, id: string): ProjectItem[] =>
  project.items.filter((i) => i.list?.id === id);

/**
 * Link a piece to a list (or with null, unlink it). Linking applies the list's settings at once (its bindings follow on
 * the commit); unlinking keeps what the piece has. Linking to another list drops the piece's overrides.
 */
export function linkItem(project: Project, itemId: string, listId: string | null): Project {
  const list = listId ? project.definitionLists?.find((l) => l.id === listId) : undefined;
  if (listId && !list) return project;
  let changed = false;
  const items = project.items.map((i) => {
    if (i.id !== itemId || i.set) return i;
    if (!list) {
      if (!i.list) return i;
      changed = true;
      return unlinked(i);
    }
    if (i.list?.id === list.id) return i;
    changed = true;
    // Only the keys the list sets: a value the piece kept against the project stays its own.
    return { ...i, list: { id: list.id }, design: withSettings(i.design, list.settings) };
  });
  return changed ? { ...project, items } : project;
}

/** Set (or with an empty text or null, remove) a linked piece's own value of a variable ("Use list value"). */
export function setItemOverride(
  project: Project,
  itemId: string,
  variableId: string,
  expr: string | null,
): Project {
  const v = expr?.trim() ?? '';
  if (v.length > MAX_EXPR) return project;
  let changed = false;
  const items = project.items.map((i) => {
    if (i.id !== itemId || !i.list) return i;
    const { [variableId]: _old, ...values } = i.list.values ?? {};
    void _old;
    const next = v ? { ...values, [variableId]: v } : values;
    changed = true;
    return {
      ...i,
      list: Object.keys(next).length ? { id: i.list.id, values: next } : { id: i.list.id },
    };
  });
  return changed ? { ...project, items } : project;
}

/** A variable's values leave every list and every piece override (the variable was deleted). */
export function dropListValues(project: Project, variableId: string): Project {
  const lists = project.definitionLists;
  const touched = project.items.some((i) => i.list?.values?.[variableId] !== undefined);
  if (!lists?.some((l) => variableId in l.values) && !touched) return project;
  return {
    ...project,
    ...(lists
      ? {
          definitionLists: lists.map((l) => {
            if (!(variableId in l.values)) return l;
            const { [variableId]: _g, ...values } = l.values;
            void _g;
            return { ...l, values };
          }),
        }
      : {}),
    items: touched
      ? project.items.map((i) => {
          if (i.list?.values?.[variableId] === undefined) return i;
          const { [variableId]: _g, ...values } = i.list.values;
          void _g;
          return {
            ...i,
            list: Object.keys(values).length ? { id: i.list.id, values } : { id: i.list.id },
          };
        })
      : project.items,
  };
}

/** Where a linked piece's value of a variable comes from: its own override, its list or the project. */
export function valueSource(
  project: Project,
  item: ProjectItem,
  variableId: string,
): 'piece' | 'list' | 'project' {
  if (item.list?.values?.[variableId]) return 'piece';
  return listOf(project, item)?.values[variableId] ? 'list' : 'project';
}

/**
 * Every variable's expression for a linked piece (override › list › project), for `evaluateVariables`; undefined when
 * the piece is not linked to an existing list.
 */
export function listValues(
  project: Project,
  item: Pick<ProjectItem, 'list'>,
): Record<string, string> | undefined {
  const list = listOf(project, item);
  if (!list) return undefined;
  const own = item.list?.values ?? {};
  const out: Record<string, string> = {};
  for (const v of project.variables ?? []) out[v.id] = own[v.id] || list.values[v.id] || v.expr;
  return out;
}

/**
 * A list value or a piece override that does not evaluate: an error that blocks export (ADR-008). Only the problems
 * the list (or the piece) brings are reported; one already in the project's (or the list's) values is reported there.
 */
export function listDiagnostics(project: Project): Diagnostic[] {
  const vars = project.variables ?? [];
  const lists = project.definitionLists ?? [];
  if (!vars.length || !lists.length) return [];
  const base = evaluateVariables(vars);
  const byList = new Map<string, ReturnType<typeof evaluateVariables>>();
  const out: Diagnostic[] = [];
  for (const l of lists) {
    const ev = evaluateVariables(vars, listValues(project, { list: { id: l.id } }));
    byList.set(l.id, ev);
    for (const v of vars) {
      const problem = ev.get(v.id)?.problem;
      if (problem && !base.get(v.id)?.problem)
        out.push({
          severity: 'error',
          code: 'list-value',
          message: t('{list}, variable “{name}”: {problem}', {
            list: l.name,
            name: v.name,
            problem,
          }),
          nodeId: `list:${l.id}`,
        });
    }
  }
  for (const i of project.items) {
    if (!i.list?.values || !Object.keys(i.list.values).length) continue;
    const listEv = byList.get(i.list.id);
    if (!listEv) continue;
    const ev = evaluateVariables(vars, listValues(project, i));
    for (const v of vars) {
      const problem = ev.get(v.id)?.problem;
      if (problem && !listEv.get(v.id)?.problem)
        out.push({
          severity: 'error',
          code: 'list-value',
          message: t('{piece}, own value of “{name}”: {problem}', {
            piece: i.design.name,
            name: v.name,
            problem,
          }),
          nodeId: i.id,
        });
    }
  }
  return out;
}
