/**
 * Project variables (ADR-166): named numbers or formulas (`bottom height = 400`, `top = total − bottom height`) that
 * drive piece sizes, inner division sizes and positions through bindings. A binding names a target on a project item
 * and a formula; the store evaluates every binding on each commit (`applyBindings`) and writes the number into the
 * design or the position, so every view, check, cut list and export reads plain numbers (ADR-004) and old readers
 * read the last value (ADR-011). A problem (empty, syntax, unknown name, cycle, division by zero) is a diagnostic
 * (ADR-008): the bound fields keep their numbers and export is blocked. Integer millimetres: a non-whole result is
 * rounded to the nearest mm and the unrounded value is shown beside it. Pure TypeScript, no UI.
 */
import { t } from '@furniture-builder/i18n';
import { newId } from './design';
import {
  REQUEST_RANGE,
  requestKey,
  requestName,
  SIZE_AXES,
  type Project,
  type ProjectItem,
  type RequestTarget,
  type RunRequest,
  type SizeAxis,
} from './project';
import { isAxisLocked } from './sizeLock';
import type { Diagnostic, Mm } from './types';
import {
  applyDesignBindings,
  evaluateBinding,
  evaluateVariables,
  hasTarget,
  namesIn,
  rangeProblem,
  renameInExpr,
  readTarget,
  targetLabel,
  variableScope,
  writeTarget,
  type Binding,
  type ProjectVariable,
} from './variableCore';

import { dropListValues, listDiagnostics, listValues } from './defLists';

export * from './variableCore';

// ---------------------------------------------------------------------------
// Bindings on a project
// ---------------------------------------------------------------------------

/** The variable values an item's bindings are evaluated with: its value set's (ADR-167), or set 1's. */
export function scopeFor(
  project: Project,
  item: Pick<ProjectItem, 'set' | 'list'>,
): Map<string, number> {
  const vars = project.variables ?? [];
  const vs = item.set ? project.variableSets?.find((s) => s.id === item.set!.id) : undefined;
  // A value-set duplicate keeps its set's values; otherwise a linked piece takes its definition list's (ADR-303).
  return variableScope(vars, vs ? vs.values : listValues(project, item));
}

/**
 * The cache key of an item's scope: one per value set, one per definition list without piece overrides; null when the
 * piece has its own overrides (its scope is its own).
 */
export function scopeKey(item: Pick<ProjectItem, 'set' | 'list'>): string | null {
  if (item.set) return `set:${item.set.id}`;
  if (!item.list) return '';
  return item.list.values && Object.keys(item.list.values).length ? null : `list:${item.list.id}`;
}

/**
 * Every binding evaluated and written into its item. The same project when nothing changes. Problems are left to
 * `variableDiagnostics`; a binding with a problem leaves its field as it is.
 */
export function applyBindings(input: Project): Project {
  // Run requests follow their variables too (ADR-209).
  const project = applyRequestBindings(input);
  if (!project.items.some((i) => i.bindings?.length)) return project;
  const scopes = new Map<string, Map<string, number>>();
  const scopeOf = (item: ProjectItem) => {
    const k = scopeKey(item);
    if (k === null) return scopeFor(project, item);
    let s = scopes.get(k);
    if (!s) scopes.set(k, (s = scopeFor(project, item)));
    return s;
  };
  let changed = false;
  const items = project.items.map((item) => {
    if (!item.bindings?.length) return item;
    let next = item;
    for (const b of item.bindings) {
      // A locked size keeps its value (ADR-171): the lock outranks the binding; `variableDiagnostics` says so.
      if (SIZE_AXES.includes(b.target as SizeAxis) && isAxisLocked(item, b.target as SizeAxis))
        continue;
      const e = evaluateBinding(b.expr, scopeOf(item));
      if (e.value === undefined || rangeProblem(next, b.target, e.value)) continue;
      next = writeTarget(next, b.target, e.value);
    }
    if (next !== item) changed = true;
    return next;
  });
  return changed ? { ...project, items } : project;
}

// ---------------------------------------------------------------------------
// Bindings on run requests (ADR-209)
// ---------------------------------------------------------------------------

/** The request fields a variable can drive (ADR-209): worktop overhangs and a crown's or pelmet's height. */
export const REQUEST_TARGET_LABEL: Record<RequestTarget, string> = {
  front: t('Front overhang'),
  side: t('Side overhang'),
  height: t('Trim height'),
};

/** Whether a request has the field a target names: overhangs on a worktop, a height on a crown or pelmet. */
const requestHasTarget = (r: RunRequest, target: string): target is RequestTarget =>
  target === 'height'
    ? r.kind === 'crown' || r.kind === 'pelmet'
    : (target === 'front' || target === 'side') && r.kind === 'worktop';

/** Why a value cannot go into a request field (ADR-008: never clamped silently), or null. */
function requestRangeProblem(target: RequestTarget, value: Mm): string | null {
  const r = REQUEST_RANGE[target];
  return value < r.min || value > r.max
    ? t('{n} mm is outside {min}–{max} mm.', { n: value, min: r.min, max: r.max })
    : null;
}

/** Every run request's bindings evaluated with set 1's values and written into it; the same project when none change. */
function applyRequestBindings(project: Project): Project {
  const reqs = project.runRequests;
  if (!reqs?.some((r) => r.bindings?.length)) return project;
  const scope = variableScope(project.variables ?? []);
  let changed = false;
  const runRequests = reqs.map((r) => {
    let next = r;
    for (const b of r.bindings ?? []) {
      if (!requestHasTarget(r, b.target)) continue;
      const e = evaluateBinding(b.expr, scope);
      if (e.value === undefined || requestRangeProblem(b.target, e.value)) continue;
      if (next[b.target] !== e.value) next = { ...next, [b.target]: e.value };
    }
    if (next !== r) changed = true;
    return next;
  });
  return changed ? { ...project, runRequests } : project;
}

/** Set, replace or (with `expr` null) remove the binding on a request field (ADR-209). */
export function setRequestBinding(
  project: Project,
  key: string,
  target: RequestTarget,
  expr: string | null,
): Project {
  const runRequests = (project.runRequests ?? []).map((r) => {
    if (requestKey(r) !== key) return r;
    const rest = (r.bindings ?? []).filter((b) => b.target !== target);
    const bindings = expr === null ? rest : [...rest, { target, expr: expr.trim() }];
    if (bindings.length) return { ...r, bindings };
    const { bindings: _b, ...without } = r;
    void _b;
    return without;
  });
  return { ...project, runRequests };
}

/** Problems of request bindings (ADR-209), as for pieces' bindings: errors that block export. */
function requestBindingDiagnostics(project: Project): Diagnostic[] {
  const out: Diagnostic[] = [];
  const reqs = (project.runRequests ?? []).filter((r) => r.bindings?.length);
  if (!reqs.length) return out;
  const scope = variableScope(project.variables ?? []);
  for (const r of reqs)
    for (const b of r.bindings!) {
      const name = requestName(r, project);
      const nodeId = `request:${requestKey(r)}`;
      const field = REQUEST_TARGET_LABEL[b.target as RequestTarget] ?? b.target;
      if (!requestHasTarget(r, b.target)) {
        out.push({
          severity: 'error',
          code: 'binding-target',
          message: t('{name} has no {field} to bind.', { name, field }),
          nodeId,
        });
        continue;
      }
      const e = evaluateBinding(b.expr, scope);
      const range = e.value !== undefined ? requestRangeProblem(b.target, e.value) : null;
      if (e.problem)
        out.push({
          severity: 'error',
          code: 'binding-problem',
          message: t('{name}, {field}: {problem}', { name, field, problem: e.problem }),
          nodeId,
        });
      else if (range)
        out.push({
          severity: 'error',
          code: 'binding-range',
          message: t('{name}, {field}: {problem} The field keeps {n} mm.', {
            name,
            field,
            problem: range,
            n: r[b.target] ?? 0,
          }),
          nodeId,
        });
    }
  return out;
}

/** Problems of variables and bindings (ADR-008): errors block export; a bound size on a size-locked piece warns. */
export function variableDiagnostics(project: Project): Diagnostic[] {
  // Run requests' bindings (ADR-209) are checked even without variables: a name then is unknown.
  const out: Diagnostic[] = requestBindingDiagnostics(project);
  const vars = project.variables ?? [];
  if (!vars.length) return out;
  const report = (setName: string | null, values?: Record<string, string>) => {
    const ev = evaluateVariables(vars, values);
    for (const v of vars) {
      const r = ev.get(v.id);
      if (r?.problem)
        out.push({
          severity: 'error',
          code: 'variable-problem',
          message: setName
            ? t('{set}, variable “{name}”: {problem}', {
                set: setName,
                name: v.name,
                problem: r.problem,
              })
            : t('Variable “{name}”: {problem}', { name: v.name, problem: r.problem }),
          nodeId: `var:${v.id}`,
        });
    }
  };
  report(null);
  for (const s of project.variableSets ?? []) {
    if (!project.items.some((i) => i.set?.id === s.id)) continue;
    const ev = evaluateVariables(vars, s.values);
    if (vars.some((v) => ev.get(v.id)?.value === undefined))
      out.push({
        severity: 'warning',
        code: 'set-incomplete',
        message: t('{set} is incomplete; its pieces keep their last values.', { set: s.name }),
        nodeId: `set:${s.id}`,
      });
  }
  for (const s of project.variableSets ?? [])
    if (project.items.some((i) => i.set?.id === s.id)) report(s.name, s.values);
  out.push(...listDiagnostics(project));
  const scopes = new Map<string, Map<string, number>>();
  for (const item of project.items) {
    if (!item.bindings?.length) continue;
    const k = scopeKey(item);
    let scope = k === null ? undefined : scopes.get(k);
    if (!scope) {
      scope = scopeFor(project, item);
      if (k !== null) scopes.set(k, scope);
    }
    for (const b of item.bindings) {
      const e = evaluateBinding(b.expr, scope);
      if (e.problem)
        out.push({
          severity: 'error',
          code: 'binding-problem',
          message: t('{name}, {field}: {problem}', {
            name: item.design.name,
            field: targetLabel(b.target),
            problem: e.problem,
          }),
          nodeId: item.id,
        });
      else if (e.value !== undefined && rangeProblem(item, b.target, e.value))
        out.push({
          severity: 'error',
          code: 'binding-range',
          message: t('{name}, {field}: {problem} The field keeps {n} mm.', {
            name: item.design.name,
            field: targetLabel(b.target),
            problem: rangeProblem(item, b.target, e.value)!,
            n: readTarget(item, b.target) ?? 0,
          }),
          nodeId: item.id,
        });
      else if (b.target === 'y' && item.placement && item.placement.kind !== 'wall')
        out.push({
          severity: 'error',
          code: 'binding-floor',
          message: t(
            '{name}: Above floor follows “{expr}” but the piece stands on the floor or on a piece; set Placed to Anywhere or Wall.',
            { name: item.design.name, expr: b.expr },
          ),
          nodeId: item.id,
        });
      else if (!hasTarget(item, b.target))
        out.push({
          severity: 'error',
          code: 'binding-target',
          message: t('{name} has no {field} to bind.', {
            name: item.design.name,
            field: targetLabel(b.target),
          }),
          nodeId: item.id,
        });
      else if (SIZE_AXES.includes(b.target as SizeAxis) && isAxisLocked(item, b.target as SizeAxis))
        out.push({
          severity: 'warning',
          code: 'binding-held',
          message: t(
            '{name}: {field} keeps its value — it follows “{expr}”, but that size is locked.',
            {
              name: item.design.name,
              field: targetLabel(b.target),
              expr: b.expr,
            },
          ),
          nodeId: item.id,
        });
    }
  }
  return out;
}

/** The binding on `target` of an item, if any. */
export const bindingOf = (
  item: Pick<ProjectItem, 'bindings'>,
  target: string,
): Binding | undefined => item.bindings?.find((b) => b.target === target);

/** Set, replace or (with `expr` null) remove the binding on `target`; bindings are evaluated by the next commit. */
export function setBinding(
  project: Project,
  itemId: string,
  target: string,
  expr: string | null,
): Project {
  const items = project.items.map((i) => {
    if (i.id !== itemId) return i;
    const rest = (i.bindings ?? []).filter((b) => b.target !== target);
    const bindings = expr === null ? rest : [...rest, { target, expr: expr.trim() }];
    if (!bindings.length) {
      const { bindings: _b, ...without } = i;
      void _b;
      return without;
    }
    return { ...i, bindings };
  });
  return { ...project, items };
}

/** Items whose bindings refer to the variable, and the other variables whose formulas do. */
export function variableUsers(
  project: Project,
  id: string,
): { items: ProjectItem[]; vars: ProjectVariable[]; sets: string[] } {
  const vars = project.variables ?? [];
  const v = vars.find((x) => x.id === id);
  if (!v) return { items: [], vars: [], sets: [] };
  const names = vars.map((x) => x.name);
  const refers = (expr: string) =>
    namesIn(expr, names).some((n) => n.toLowerCase() === v.name.toLowerCase());
  return {
    items: project.items.filter((i) => i.bindings?.some((b) => refers(b.expr))),
    vars: vars.filter((x) => x.id !== id && refers(x.expr)),
    sets: (project.variableSets ?? [])
      .filter((s) => Object.entries(s.values).some(([k, e]) => k !== id && refers(e)))
      .map((s) => s.name),
  };
}

export function addVariable(
  project: Project,
  name: string,
  expr: string,
): { project: Project; id: string } {
  const id = newId();
  const variables = [...(project.variables ?? []), { id, name: name.trim(), expr: expr.trim() }];
  return { project: { ...project, variables }, id };
}

/** Rename or change a variable; a rename follows into every formula, binding and value set. */
export function updateVariable(
  project: Project,
  id: string,
  patch: { name?: string; expr?: string },
): Project {
  const vars = project.variables ?? [];
  const v = vars.find((x) => x.id === id);
  if (!v) return project;
  const name = patch.name?.trim() ?? v.name;
  const names = vars.map((x) => x.name);
  const ren = (expr: string) => (name === v.name ? expr : renameInExpr(expr, v.name, name, names));
  const variables = vars.map((x) =>
    x.id === id ? { ...x, name, expr: patch.expr?.trim() ?? x.expr } : { ...x, expr: ren(x.expr) },
  );
  let next: Project = { ...project, variables };
  if (name !== v.name) {
    next = {
      ...next,
      items: next.items.map((i) =>
        i.bindings?.length
          ? { ...i, bindings: i.bindings.map((b) => ({ ...b, expr: ren(b.expr) })) }
          : i,
      ),
      // Run requests' bindings follow a rename too (ADR-209).
      ...(next.runRequests?.some((r) => r.bindings?.length)
        ? {
            runRequests: next.runRequests.map((r) =>
              r.bindings?.length
                ? { ...r, bindings: r.bindings.map((b) => ({ ...b, expr: ren(b.expr) })) }
                : r,
            ),
          }
        : {}),
      ...(next.variableSets
        ? {
            variableSets: next.variableSets.map((s) => ({
              ...s,
              values: Object.fromEntries(Object.entries(s.values).map(([k, e]) => [k, ren(e)])),
            })),
          }
        : {}),
    };
  }
  return next;
}

/** Remove a variable; the bindings and formulas that used it go, and their fields keep their numbers. */
export function deleteVariable(project: Project, id: string): Project {
  const vars = project.variables ?? [];
  const v = vars.find((x) => x.id === id);
  if (!v) return project;
  const names = vars.map((x) => x.name);
  const refers = (expr: string) =>
    namesIn(expr, names).some((n) => n.toLowerCase() === v.name.toLowerCase());
  const items = project.items.map((i) => {
    if (!i.bindings?.some((b) => refers(b.expr))) return i;
    const bindings = i.bindings.filter((b) => !refers(b.expr));
    if (bindings.length) return { ...i, bindings };
    const { bindings: _b, ...without } = i;
    void _b;
    return without;
  });
  // A run request's binding on it goes too; the field keeps its number (ADR-209).
  const runRequests = project.runRequests?.map((r) => {
    if (!r.bindings?.some((b) => refers(b.expr))) return r;
    const bindings = r.bindings.filter((b) => !refers(b.expr));
    if (bindings.length) return { ...r, bindings };
    const { bindings: _b, ...without } = r;
    void _b;
    return without;
  });
  const variables = vars.filter((x) => x.id !== id);
  const variableSets = project.variableSets?.map((s) => {
    const { [id]: _gone, ...values } = s.values;
    void _gone;
    return { ...s, values };
  });
  // Its values leave every definition list and every piece's override (ADR-303).
  const lists = dropListValues({ ...project, items }, id);
  return {
    ...lists,
    ...(runRequests ? { runRequests } : {}),
    ...(variables.length ? { variables } : { variables: undefined }),
    ...(variableSets ? { variableSets } : {}),
  };
}

/**
 * Why the last change left a bound field where it was (ADR-166: a bound position axis does not move in Move mode or
 * Move to): the first bound target whose value `tried` changed but `applied` holds, or null.
 */
export function heldByBinding(
  before: Project | null,
  tried: Project,
  applied: Project,
): string | null {
  if (!before) return null;
  const was = new Map(before.items.map((i) => [i.id, i]));
  const done = new Map(applied.items.map((i) => [i.id, i]));
  for (const i of tried.items) {
    const b = was.get(i.id),
      a = done.get(i.id);
    if (!b || !a || !i.bindings?.length) continue;
    for (const bd of i.bindings) {
      const t0 = readTarget(b, bd.target),
        t1 = readTarget(i, bd.target),
        t2 = readTarget(a, bd.target);
      if (t0 !== undefined && t1 !== undefined && t1 !== t0 && t2 !== t1)
        return t('{name}: {field} follows “{expr}”; unbind it to change it.', {
          name: i.design.name,
          field: targetLabel(bd.target),
          expr: bd.expr,
        });
    }
  }
  return null;
}

/**
 * Every project piece's own bindings, evaluated with its own variables only (ADR-210): the piece's parameters. A
 * project binding on the same target wins (it is left to `applyBindings`), and a locked size keeps its value
 * (ADR-171). The same project when nothing changes.
 */
export function applyPieceBindings(project: Project): Project {
  if (!project.items.some((i) => i.design.bindings?.length)) return project;
  let changed = false;
  const items = project.items.map((item) => {
    if (!item.design.bindings?.length) return item;
    const skip = [
      ...(item.bindings ?? []).map((b) => b.target),
      ...SIZE_AXES.filter((a) => isAxisLocked(item, a)),
    ];
    const design = applyDesignBindings(item.design, skip);
    if (design === item.design) return item;
    changed = true;
    return { ...item, design };
  });
  return changed ? { ...project, items } : project;
}
