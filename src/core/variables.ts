/**
 * Project variables (ADR-163): named numbers or formulas (`bottom height = 400`, `top = total − bottom height`) that
 * drive piece sizes, inner division sizes and positions through bindings. A binding names a target on a project item
 * and a formula; the store evaluates every binding on each commit (`applyBindings`) and writes the number into the
 * design or the position, so every view, check, cut list and export reads plain numbers (ADR-004) and old readers
 * read the last value (ADR-011). A problem (empty, syntax, unknown name, cycle, division by zero) is a diagnostic
 * (ADR-008): the bound fields keep their numbers and export is blocked. Integer millimetres: a non-whole result is
 * rounded to the nearest mm and the unrounded value is shown beside it. Pure TypeScript, no UI.
 */
import { t } from './i18n';
import { mapProductSpace, newId, setProductParams } from './design';
import type { Project, ProjectItem } from './project';
import { sizeFields } from './pieceSize';
import type { Diagnostic, Mm, Product, Space } from './types';

export interface ProjectVariable {
  id: string;
  /** Unique in a project, compared without case; letters, digits and spaces. */
  name: string;
  /** A number or a formula over other variables: `+ − × ÷`, parentheses, decimals. */
  expr: string;
}

/**
 * What a binding drives: the piece's outer size, its mount height (a wall cabinet's `mountHeight` and the wall
 * placement height), its room position, or one fixed size of a split (`split:<spaceId>:<index>`).
 */
export type BindTarget = 'width' | 'height' | 'depth' | 'mountHeight' | 'x' | 'y' | 'z' | string;

export interface Binding {
  target: BindTarget;
  /** A variable name or a formula. */
  expr: string;
}

export const MAX_VARIABLE_NAME = 60;
export const MAX_EXPR = 200;
export const MAX_VARIABLES = 100;
const SPLIT_TARGET = /^split:([^:]+):(\d+)$/;
const NAME_RE = /^[\p{L}][\p{L}\p{N} _]*$/u;

export const isBindTarget = (s: unknown): s is BindTarget =>
  typeof s === 'string' &&
  (['width', 'height', 'depth', 'mountHeight', 'x', 'y', 'z'].includes(s) || SPLIT_TARGET.test(s));

/** Why a variable name cannot be used, or null. */
export function nameProblem(name: string, others: readonly ProjectVariable[] = []): string | null {
  const n = name.trim();
  if (!n) return t('A variable needs a name.');
  if (n.length > MAX_VARIABLE_NAME)
    return t('A variable name is at most {n} characters.', { n: MAX_VARIABLE_NAME });
  if (!NAME_RE.test(n))
    return t('A variable name is letters, digits and spaces, starting with a letter.');
  if (others.some((v) => v.name.toLowerCase() === n.toLowerCase()))
    return t('A variable named “{name}” already exists.', { name: n });
  return null;
}

// ---------------------------------------------------------------------------
// Formulas
// ---------------------------------------------------------------------------

type Token =
  | { kind: 'num'; value: number; at: number; text: string }
  | { kind: 'name'; name: string; at: number; text: string }
  | { kind: 'op'; op: '+' | '-' | '*' | '/' | '(' | ')'; at: number; text: string };

const OPS: Record<string, '+' | '-' | '*' | '/' | '(' | ')'> = {
  '+': '+',
  '-': '-',
  '−': '-',
  '*': '*',
  '×': '*',
  '·': '*',
  '/': '/',
  '÷': '/',
  '(': '(',
  ')': ')',
};

/**
 * Split a formula into tokens. Variable names may hold spaces, so the known names are matched first, longest
 * first, without case; anything else that starts with a letter is an unknown name (reported by the parser).
 */
export function tokenize(
  expr: string,
  names: readonly string[],
): { tokens: Token[] } | { problem: string } {
  const sorted = [...names].sort((a, b) => b.length - a.length);
  const tokens: Token[] = [];
  let i = 0;
  const lower = expr.toLowerCase();
  while (i < expr.length) {
    const c = expr[i];
    if (/\s/.test(c)) {
      i++;
      continue;
    }
    const op = OPS[c];
    if (op) {
      tokens.push({ kind: 'op', op, at: i, text: c });
      i++;
      continue;
    }
    const num = /^\d+(?:[.,]\d+)?/.exec(expr.slice(i));
    if (num) {
      tokens.push({ kind: 'num', value: Number(num[0].replace(',', '.')), at: i, text: num[0] });
      i += num[0].length;
      continue;
    }
    const hit = sorted.find((n) => {
      if (!lower.startsWith(n.toLowerCase(), i)) return false;
      const after = expr[i + n.length];
      return after === undefined || !/[\p{L}\p{N}_]/u.test(after);
    });
    if (hit) {
      tokens.push({ kind: 'name', name: hit, at: i, text: expr.slice(i, i + hit.length) });
      i += hit.length;
      continue;
    }
    const word = /^[\p{L}_][\p{L}\p{N}_ ]*/u.exec(expr.slice(i));
    if (word) {
      const w = word[0].trim();
      return { problem: t('Unknown variable “{name}”.', { name: w }) };
    }
    return { problem: t('Unexpected “{text}” in the formula.', { text: c }) };
  }
  return { tokens };
}

/** Evaluate a formula with the given values; a problem is a sentence for the user. */
export function evaluateExpr(
  expr: string,
  values: ReadonlyMap<string, number>,
): { raw: number } | { problem: string } {
  if (!expr.trim()) return { problem: t('The formula is empty.') };
  const tk = tokenize(expr, [...values.keys()]);
  if ('problem' in tk) return tk;
  const tokens = tk.tokens;
  let pos = 0;
  let problem: string | null = null;
  const fail = (p: string) => {
    problem ??= p;
    return NaN;
  };
  const peek = () => tokens[pos];
  const primary = (): number => {
    const tok = peek();
    if (!tok) return fail(t('The formula ends too early.'));
    pos++;
    if (tok.kind === 'num') return tok.value;
    if (tok.kind === 'name')
      return values.get(tok.name) ?? fail(t('Unknown variable “{name}”.', { name: tok.name }));
    if (tok.op === '(') {
      const v = sum();
      const close = peek();
      if (!close || close.kind !== 'op' || close.op !== ')') return fail(t('A “(” is not closed.'));
      pos++;
      return v;
    }
    if (tok.op === '-') return -primary();
    if (tok.op === '+') return primary();
    return fail(t('Unexpected “{text}” in the formula.', { text: tok.text }));
  };
  const product = (): number => {
    let v = primary();
    for (;;) {
      const tok = peek();
      if (!tok || tok.kind !== 'op' || (tok.op !== '*' && tok.op !== '/')) return v;
      pos++;
      const r = primary();
      if (tok.op === '*') v *= r;
      else if (r === 0) v = fail(t('Division by zero.'));
      else v /= r;
    }
  };
  const sum = (): number => {
    let v = product();
    for (;;) {
      const tok = peek();
      if (!tok || tok.kind !== 'op' || (tok.op !== '+' && tok.op !== '-')) return v;
      pos++;
      const r = product();
      v = tok.op === '+' ? v + r : v - r;
    }
  };
  const raw = sum();
  if (problem) return { problem };
  if (pos < tokens.length)
    return { problem: t('Unexpected “{text}” in the formula.', { text: tokens[pos].text }) };
  if (!Number.isFinite(raw)) return { problem: t('The formula has no value.') };
  return { raw };
}

/** The names a formula refers to (empty when it does not parse). */
export function namesIn(expr: string, names: readonly string[]): string[] {
  const tk = tokenize(expr, names);
  if ('problem' in tk) return [];
  return [...new Set(tk.tokens.flatMap((x) => (x.kind === 'name' ? [x.name] : [])))];
}

/** `expr` with every reference to `from` written as `to`; the same text when it does not refer to it. */
export function renameInExpr(
  expr: string,
  from: string,
  to: string,
  names: readonly string[],
): string {
  const tk = tokenize(expr, names);
  if ('problem' in tk) return expr;
  let out = '';
  let last = 0;
  for (const x of tk.tokens) {
    if (x.kind !== 'name' || x.name !== from) continue;
    out += expr.slice(last, x.at) + to;
    last = x.at + x.text.length;
  }
  return out + expr.slice(last);
}

export interface Evaluated {
  /** The whole-mm value the bound fields take; absent when the variable has a problem. */
  value?: Mm;
  /** The unrounded result, when it differs from `value`. */
  raw?: number;
  problem?: string;
}

/**
 * Evaluate every variable: set 1 with `values` absent, or a value set (ADR-164) whose `values` replace the
 * variables' own formulas by id (an absent or empty value is a problem). Cycles are reported on every variable in
 * them.
 */
export function evaluateVariables(
  vars: readonly ProjectVariable[],
  values?: Readonly<Record<string, string>>,
): Map<string, Evaluated> {
  const out = new Map<string, Evaluated>();
  const names = vars.map((v) => v.name);
  const byName = new Map(vars.map((v) => [v.name.toLowerCase(), v]));
  const exprOf = (v: ProjectVariable) => (values ? (values[v.id] ?? '') : v.expr);
  const visiting = new Set<string>();
  const resolve = (v: ProjectVariable): Evaluated => {
    const done = out.get(v.id);
    if (done) return done;
    if (visiting.has(v.id))
      return { problem: t('“{name}” refers to itself in a circle.', { name: v.name }) };
    visiting.add(v.id);
    const scope = new Map<string, number>();
    let problem: string | undefined;
    for (const n of namesIn(exprOf(v), names)) {
      const dep = byName.get(n.toLowerCase());
      if (!dep) continue;
      const r = resolve(dep);
      if (r.value === undefined) {
        problem ??= r.problem?.includes('circle')
          ? t('“{name}” refers to itself in a circle.', { name: v.name })
          : t('“{name}” depends on “{dep}”, which has a problem.', { name: v.name, dep: dep.name });
      } else scope.set(n, r.value);
    }
    visiting.delete(v.id);
    let res: Evaluated;
    if (problem) res = { problem };
    else {
      const e = evaluateExpr(exprOf(v), scope);
      if ('problem' in e) res = { problem: e.problem };
      else {
        const value = Math.round(e.raw);
        res = value === e.raw ? { value } : { value, raw: e.raw };
      }
    }
    out.set(v.id, res);
    return res;
  };
  for (const v of vars) resolve(v);
  return out;
}

/** The values of every variable that evaluates, by name, for binding formulas. */
export function variableScope(
  vars: readonly ProjectVariable[],
  values?: Readonly<Record<string, string>>,
): Map<string, number> {
  const ev = evaluateVariables(vars, values);
  const scope = new Map<string, number>();
  for (const v of vars) {
    const r = ev.get(v.id);
    if (r?.value !== undefined) scope.set(v.name, r.value);
  }
  return scope;
}

/** A binding's value under `scope`, as the bound field shows it. */
export function evaluateBinding(expr: string, scope: ReadonlyMap<string, number>): Evaluated {
  const e = evaluateExpr(expr, scope);
  if ('problem' in e) return { problem: e.problem };
  const value = Math.round(e.raw);
  return value === e.raw ? { value } : { value, raw: e.raw };
}

/** `333.33 → 333 mm`, or `333 mm`, or the problem. */
export function evaluatedText(e: Evaluated): string {
  if (e.value === undefined) return e.problem ?? '';
  if (e.raw !== undefined)
    return t('{raw} → {n} mm', { raw: String(Math.round(e.raw * 100) / 100), n: e.value });
  return t('{n} mm', { n: e.value });
}

// ---------------------------------------------------------------------------
// Binding targets on an item
// ---------------------------------------------------------------------------

/** The split and index a `split:` target names, or null. */
export function splitTarget(target: string): { spaceId: string; index: number } | null {
  const m = SPLIT_TARGET.exec(target);
  return m ? { spaceId: m[1], index: Number(m[2]) } : null;
}

export const TARGET_LABEL: Record<
  'width' | 'height' | 'depth' | 'mountHeight' | 'x' | 'y' | 'z',
  string
> = {
  width: t('Width'),
  height: t('Height'),
  depth: t('Depth'),
  mountHeight: t('Underside above the floor'),
  x: t('From left'),
  y: t('Above floor'),
  z: t('From back'),
};

export function targetLabel(target: string): string {
  const s = splitTarget(target);
  if (s) return t('Division {n}', { n: s.index + 1 });
  return TARGET_LABEL[target as keyof typeof TARGET_LABEL] ?? target;
}

const findSplit = (product: Product, spaceId: string): Extract<Space, { kind: 'split' }> | null => {
  let found: Extract<Space, { kind: 'split' }> | null = null;
  mapProductSpace(product, spaceId, (s) => {
    if (s.kind === 'split') found = s;
    return s;
  });
  return found;
};

/** The number a target holds now, or undefined when the piece has no such part (a bed has no height field). */
export function readTarget(item: ProjectItem, target: string): number | undefined {
  const p = item.design.product;
  const s = splitTarget(target);
  if (s) {
    const sp = findSplit(p, s.spaceId);
    const z = sp?.sizes[s.index];
    return z?.mode === 'mm' ? z.value : undefined;
  }
  switch (target) {
    case 'width':
    case 'height':
    case 'depth':
      return sizeFields(p).find((f) => f.key === target)?.value;
    case 'mountHeight':
      return item.placement?.kind === 'wall'
        ? item.placement.height
        : p.kind === 'cabinet'
          ? p.params.mountHeight
          : undefined;
    case 'x':
      return item.position.x;
    case 'z':
      return item.position.z;
    case 'y':
      return item.placement?.kind === 'wall' ? item.placement.height : item.position.y;
  }
  return undefined;
}

/** Whether the piece has the part a target names (so it can be bound). */
export function hasTarget(item: ProjectItem, target: string): boolean {
  const s = splitTarget(target);
  if (s) {
    const sp = findSplit(item.design.product, s.spaceId);
    return !!sp && s.index < sp.sizes.length;
  }
  if (target === 'mountHeight')
    return item.placement?.kind === 'wall' || item.design.product.kind === 'cabinet';
  if (target === 'x' || target === 'y' || target === 'z') return true;
  return readTarget(item, target) !== undefined;
}

/** The item with `target` set to `value`; the same item when it already holds it or has no such part. */
export function writeTarget(item: ProjectItem, target: string, value: Mm): ProjectItem {
  const p = item.design.product;
  const s = splitTarget(target);
  if (s) {
    const product = mapProductSpace(p, s.spaceId, (sp) => {
      if (sp.kind !== 'split' || s.index >= sp.sizes.length) return sp;
      const z = sp.sizes[s.index];
      if (z.mode === 'mm' && z.value === value) return sp;
      return { ...sp, sizes: sp.sizes.map((x, i) => (i === s.index ? { mode: 'mm', value } : x)) };
    });
    return product === p ? item : { ...item, design: { ...item.design, product } };
  }
  switch (target) {
    case 'width':
    case 'height':
    case 'depth': {
      if (readTarget(item, target) === undefined || readTarget(item, target) === value) return item;
      const product = setProductParams(p, { [target]: value } as Partial<Product['params']>);
      return { ...item, design: { ...item.design, product } };
    }
    case 'mountHeight': {
      let next = item;
      if (p.kind === 'cabinet' && p.params.mountHeight !== value)
        next = {
          ...next,
          design: { ...next.design, product: setProductParams(p, { mountHeight: value }) },
        };
      if (next.placement?.kind === 'wall' && next.placement.height !== value)
        next = { ...next, placement: { ...next.placement, height: value } };
      return next;
    }
    case 'x':
      return item.position.x === value
        ? item
        : { ...item, position: { ...item.position, x: value } };
    case 'z':
      return item.position.z === value
        ? item
        : { ...item, position: { ...item.position, z: value } };
    case 'y':
      if (item.placement?.kind === 'wall')
        return item.placement.height === value
          ? item
          : { ...item, placement: { ...item.placement, height: value } };
      return item.position.y === value
        ? item
        : { ...item, position: { ...item.position, y: value } };
  }
  return item;
}

// ---------------------------------------------------------------------------
// Bindings on a project
// ---------------------------------------------------------------------------

/** The variable values an item's bindings are evaluated with: its value set's (ADR-164), or set 1's. */
export function scopeFor(project: Project, item: Pick<ProjectItem, 'set'>): Map<string, number> {
  const vars = project.variables ?? [];
  const vs = item.set ? project.variableSets?.find((s) => s.id === item.set!.id) : undefined;
  return variableScope(vars, vs?.values);
}

/**
 * Every binding evaluated and written into its item. The same project when nothing changes. Problems are left to
 * `variableDiagnostics`; a binding with a problem leaves its field as it is.
 */
export function applyBindings(project: Project): Project {
  if (!project.items.some((i) => i.bindings?.length)) return project;
  const scopes = new Map<string, Map<string, number>>();
  const scopeOf = (item: ProjectItem) => {
    const k = item.set?.id ?? '';
    let s = scopes.get(k);
    if (!s) scopes.set(k, (s = scopeFor(project, item)));
    return s;
  };
  let changed = false;
  const items = project.items.map((item) => {
    if (!item.bindings?.length) return item;
    let next = item;
    for (const b of item.bindings) {
      const e = evaluateBinding(b.expr, scopeOf(item));
      if (e.value === undefined) continue;
      next = writeTarget(next, b.target, e.value);
    }
    if (next !== item) changed = true;
    return next;
  });
  return changed ? { ...project, items } : project;
}

/** Problems of variables and bindings (ADR-008): errors block export; a bound size on a size-locked piece warns. */
export function variableDiagnostics(project: Project): Diagnostic[] {
  const out: Diagnostic[] = [];
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
  for (const s of project.variableSets ?? [])
    if (project.items.some((i) => i.set?.id === s.id)) report(s.name, s.values);
  const scopes = new Map<string, Map<string, number>>();
  for (const item of project.items) {
    if (!item.bindings?.length) continue;
    const k = item.set?.id ?? '';
    let scope = scopes.get(k);
    if (!scope) scopes.set(k, (scope = scopeFor(project, item)));
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
      else if (item.sizeLocked && ['width', 'height', 'depth'].includes(b.target))
        out.push({
          severity: 'warning',
          code: 'binding-size-lock',
          message: t('{name}: {field} follows “{expr}” although its size is locked.', {
            name: item.design.name,
            field: targetLabel(b.target),
            expr: b.expr,
          }),
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
): { items: ProjectItem[]; vars: ProjectVariable[] } {
  const vars = project.variables ?? [];
  const v = vars.find((x) => x.id === id);
  if (!v) return { items: [], vars: [] };
  const names = vars.map((x) => x.name);
  const refers = (expr: string) =>
    namesIn(expr, names).some((n) => n.toLowerCase() === v.name.toLowerCase());
  return {
    items: project.items.filter((i) => i.bindings?.some((b) => refers(b.expr))),
    vars: vars.filter((x) => x.id !== id && refers(x.expr)),
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
  const variables = vars.filter((x) => x.id !== id);
  const variableSets = project.variableSets?.map((s) => {
    const { [id]: _gone, ...values } = s.values;
    void _gone;
    return { ...s, values };
  });
  return {
    ...project,
    items,
    ...(variables.length ? { variables } : { variables: undefined }),
    ...(variableSets ? { variableSets } : {}),
  };
}

/**
 * Why the last change left a bound field where it was (ADR-163: a bound position axis does not move in Move mode or
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
