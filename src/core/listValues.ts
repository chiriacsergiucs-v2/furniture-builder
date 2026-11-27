/**
 * The values side of definition lists (ADR-307), kept free of `project.ts` so `variables.ts` and `projectSettings.ts`
 * can use it without joining the model import cycle (tests/core-boundary.test.ts): a linked piece's variable values,
 * where each comes from, the lists' diagnostics and dropping a deleted variable's values. Structural types only.
 */
import { t } from '@furniture-builder/i18n';
import type { Diagnostic } from './types';
import { evaluateVariables, type ProjectVariable } from './variableCore';

interface ListLike {
  id: string;
  name: string;
  values: Record<string, string>;
}
interface ListItem {
  id: string;
  design: { name: string };
  list?: { id: string; values?: Record<string, string> };
}
interface ListProject {
  variables?: ProjectVariable[];
  definitionLists?: ListLike[];
  items: ListItem[];
}

/** The definition list a piece is linked to, if it still exists. */
export const listOf = <L extends ListLike>(
  project: { definitionLists?: L[] },
  item: Pick<ListItem, 'list'>,
): L | undefined =>
  item.list ? project.definitionLists?.find((l) => l.id === item.list!.id) : undefined;

/** A variable's values leave every list and every piece override (the variable was deleted). */
export function dropListValues<P extends ListProject>(project: P, variableId: string): P {
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
  project: ListProject,
  item: ListItem,
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
  project: ListProject,
  item: Pick<ListItem, 'list'>,
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
export function listDiagnostics(project: ListProject): Diagnostic[] {
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
