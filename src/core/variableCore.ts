/**
 * The parts of project variables (ADR-166) that need no project: formulas, the binding targets on one placed piece,
 * and a piece's own variables (ADR-210). `build.ts` reads a piece's own variable problems from here, so the model
 * files never reach `project.ts`, not even through `variables.ts` (G-530, ADR-219). `variables.ts` re-exports all of
 * it. Pure TypeScript, no UI.
 */
import { t } from '@furniture-builder/i18n';
import { mapProductSpace, newId, setProductParams } from './design';
import type { Placement } from './placement';
import { sizeFields } from './pieceSize';
import type { Design, DesignVariable, Mm, Product, Space, Diagnostic } from './types';
import { MAX_EXPR, MAX_VARIABLE_NAME, MAX_VARIABLES, NAME_RE, SPLIT_TARGET } from './varLimits';
import { POSITION_MAX, POSITION_MIN } from './limits';

/** What a binding target reads and writes on a project item (a `ProjectItem` is one). */
interface BindItem {
  design: Design;
  position: { x: Mm; y: Mm; z: Mm };
  placement?: Placement;
}

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
type BindTarget = 'width' | 'height' | 'depth' | 'mountHeight' | 'x' | 'y' | 'z' | string;

export interface Binding {
  target: BindTarget;
  /** A variable name or a formula. */
  expr: string;
}

export { MAX_EXPR, MAX_VARIABLE_NAME, MAX_VARIABLES };

export const isBindTarget = (s: unknown): s is BindTarget =>
  typeof s === 'string' &&
  (['width', 'height', 'depth', 'mountHeight', 'x', 'y', 'z'].includes(s) || SPLIT_TARGET.test(s));

/** Why a variable name cannot be used, or null. */
export function nameProblem(
  name: string,
  others: readonly ProjectVariable[] = [],
  /** False when reading a stored variable: a name taken before a function had it still loads (ADR-206). */
  reserved = true,
): string | null {
  const n = name.trim();
  if (!n) return t('A variable needs a name.');
  if (n.length > MAX_VARIABLE_NAME)
    return t('A variable name is at most {n} characters.', { n: MAX_VARIABLE_NAME });
  if (!NAME_RE.test(n))
    return t('A variable name is letters, digits and spaces, starting with a letter.');
  if (reserved && isFunctionName(n))
    return t('“{name}” is the name of a formula function; pick another name.', { name: n });
  if (others.some((v) => v.name.toLowerCase() === n.toLowerCase()))
    return t('A variable named “{name}” already exists.', { name: n });
  return null;
}

// ---------------------------------------------------------------------------
// Formulas
// ---------------------------------------------------------------------------

/** Comparisons (ADR-209): 1 when true, 0 when not. */
type Cmp = '<' | '<=' | '>' | '>=' | '=' | '<>';
type Op = '+' | '-' | '*' | '/' | '(' | ')' | ',' | Cmp;
type Token =
  | { kind: 'num'; value: number; at: number; text: string }
  | { kind: 'name'; name: string; at: number; text: string }
  | { kind: 'fn'; name: string; at: number; text: string }
  | { kind: 'op'; op: Op; at: number; text: string };

const OPS: Record<string, Op> = {
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
  '<': '<',
  '>': '>',
  '=': '=',
  '≤': '<=',
  '≥': '>=',
  '≠': '<>',
};
/** Two-character comparisons, matched before the one-character operators (ADR-209). */
const OPS2: Record<string, Op> = { '<=': '<=', '>=': '>=', '<>': '<>' };
const CMPS = new Set<Op>(['<', '<=', '>', '>=', '=', '<>']);

/**
 * Formula functions (ADR-206): a name followed by `(` is a call. One entry per function: how many values it takes and
 * what it does; a later function (ADR-209) is one more entry. Their names are reserved for new variables.
 */
interface FormulaFunction {
  /** Fewest and most values; `max` absent = any number from `min`. */
  min: number;
  max?: number;
  apply: (args: number[]) => number;
  /** Why these values cannot be used (ADR-209: a rounding step of 0), or null; a diagnostic, never a throw. */
  problem?: (args: number[]) => string | null;
  /** Only this value's problem counts (ADR-209: `if` takes the chosen branch); the index from the values. */
  uses?: (args: number[]) => number[];
}
export const FUNCTIONS: Record<string, FormulaFunction> = {
  min: { min: 2, apply: (a) => Math.min(...a) },
  max: { min: 2, apply: (a) => Math.max(...a) },
  floor: { min: 1, max: 1, apply: ([x]) => Math.floor(x) },
  ceil: { min: 1, max: 1, apply: ([x]) => Math.ceil(x) },
  // `round(x, step)` (ADR-209): the nearest multiple of step.
  round: {
    min: 1,
    max: 2,
    apply: ([x, step]) => (step === undefined ? Math.round(x) : Math.round(x / step) * step),
    problem: ([, step]) =>
      step !== undefined && !(step > 0) ? t('The step of “round” must be more than 0.') : null,
  },
  // `if(c, a, b)` (ADR-209): a when c is not 0, else b.
  if: {
    min: 3,
    max: 3,
    apply: ([c, a, b]) => (c !== 0 ? a : b),
    uses: ([c]) => [0, c !== 0 ? 1 : 2],
  },
};
/** Whether a name is a formula function's, compared without case. */
export const isFunctionName = (name: string): boolean =>
  Object.hasOwn(FUNCTIONS, name.trim().toLowerCase());

/** Why a call has the wrong number of values, or null. */
function arityProblem(name: string, f: FormulaFunction, n: number): string | null {
  if (f.max !== undefined && f.min === f.max && n !== f.min)
    return t('“{fn}” takes exactly {n|# value|# values}.', { fn: name, n: f.min });
  if (n < f.min) return t('“{fn}” takes at least {n|# value|# values}.', { fn: name, n: f.min });
  if (f.max !== undefined && n > f.max)
    return t('“{fn}” takes at most {n|# value|# values}.', { fn: name, n: f.max });
  return null;
}

/**
 * Split a formula into tokens. Variable names may hold spaces, so the known names are matched first, longest
 * first, without case; anything else that starts with a letter is an unknown name (reported by the parser). A
 * function name followed by `(` is a call (ADR-206), even when a variable has that name; inside a call's
 * parentheses `,` or `;` separates the values, so decimals there take a point.
 */
export function tokenize(
  expr: string,
  names: readonly string[],
): { tokens: Token[] } | { problem: string } {
  const sorted = [...names].sort((a, b) => b.length - a.length);
  const tokens: Token[] = [];
  /** Open parentheses: true for a call's. */
  const parens: boolean[] = [];
  let i = 0;
  const lower = expr.toLowerCase();
  while (i < expr.length) {
    const c = expr[i];
    if (/\s/.test(c)) {
      i++;
      continue;
    }
    const inCall = parens.length > 0 && parens[parens.length - 1];
    if (inCall && (c === ',' || c === ';')) {
      tokens.push({ kind: 'op', op: ',', at: i, text: c });
      i++;
      continue;
    }
    const two = OPS2[expr.slice(i, i + 2)];
    if (two) {
      tokens.push({ kind: 'op', op: two, at: i, text: expr.slice(i, i + 2) });
      i += 2;
      continue;
    }
    const op = OPS[c];
    if (op) {
      const prev = tokens[tokens.length - 1];
      if (op === '(') parens.push(prev?.kind === 'fn');
      if (op === ')') parens.pop();
      tokens.push({ kind: 'op', op, at: i, text: c });
      i++;
      continue;
    }
    const num = (inCall ? /^\d+(?:\.\d+)?/ : /^\d+(?:[.,]\d+)?/).exec(expr.slice(i));
    if (num) {
      tokens.push({ kind: 'num', value: Number(num[0].replace(',', '.')), at: i, text: num[0] });
      i += num[0].length;
      continue;
    }
    const call = /^([\p{L}_][\p{L}\p{N}_]*)\s*\(/u.exec(expr.slice(i));
    if (call && isFunctionName(call[1])) {
      tokens.push({ kind: 'fn', name: call[1].toLowerCase(), at: i, text: call[1] });
      i += call[1].length;
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
    if (tok.kind === 'fn') {
      // A call (ADR-206): name `(` value {, value} `)`; the tokenizer saw the `(` after the name.
      const f = FUNCTIONS[tok.name];
      pos++;
      const args: number[] = [];
      // The problem each value raised, if it was the first (ADR-209: `if` keeps only its chosen branch's).
      const raised: (string | null)[] = [];
      const close = peek();
      if (close && close.kind === 'op' && close.op === ')') pos++;
      else
        for (;;) {
          const had = problem;
          args.push(compare());
          raised.push(had === null && problem !== null ? problem : null);
          const nx = peek();
          if (nx && nx.kind === 'op' && nx.op === ',') {
            pos++;
            continue;
          }
          if (!nx || nx.kind !== 'op' || nx.op !== ')') return fail(t('A “(” is not closed.'));
          pos++;
          break;
        }
      const bad = arityProblem(tok.text, f, args.length);
      if (bad) return fail(bad);
      // A value the call does not use (the other branch of `if`) may have no value, e.g. a division by zero there.
      if (f.uses && raised.some(Boolean)) {
        const used = new Set(f.uses(args));
        // Only a value problem is dropped; a formula that does not parse stays a problem wherever it is.
        const soft = [t('Division by zero.'), t('The step of “round” must be more than 0.')];
        if (raised.every((r, i) => !r || (!used.has(i) && soft.includes(r)))) problem = null;
        else return NaN;
        const v = f.apply(args);
        return Number.isFinite(v) ? v : fail(t('The formula has no value.'));
      }
      const why = f.problem?.(args);
      if (why) return fail(why);
      return f.apply(args);
    }
    if (tok.op === '(') {
      const v = compare();
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
  /** A comparison (ADR-209): 1 when it holds, 0 when not; one per expression level, no chains. */
  const compare = (): number => {
    const v = sum();
    const tok = peek();
    if (!tok || tok.kind !== 'op' || !CMPS.has(tok.op)) return v;
    pos++;
    const r = sum();
    const holds =
      tok.op === '<'
        ? v < r
        : tok.op === '<='
          ? v <= r
          : tok.op === '>'
            ? v > r
            : tok.op === '>='
              ? v >= r
              : tok.op === '='
                ? v === r
                : v !== r;
    return holds ? 1 : 0;
  };
  const raw = compare();
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

interface Evaluated {
  /** The whole-mm value the bound fields take; absent when the variable has a problem. */
  value?: Mm;
  /** The unrounded result, when it differs from `value`. */
  raw?: number;
  /** The unrounded result, always; formulas over this variable take it so a chain is rounded once. */
  exact?: number;
  problem?: string;
}

/**
 * Evaluate every variable: set 1 with `values` absent, or a value set (ADR-167) whose `values` replace the
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
      } else scope.set(n, r.exact ?? r.value);
    }
    visiting.delete(v.id);
    let res: Evaluated;
    if (problem) res = { problem };
    else {
      const e = evaluateExpr(exprOf(v), scope);
      if ('problem' in e) res = { problem: e.problem };
      else {
        // Rounded once, at the end of a chain: a formula over this variable takes the unrounded value (`exact`).
        const value = Math.round(e.raw);
        res = value === e.raw ? { value, exact: e.raw } : { value, raw: e.raw, exact: e.raw };
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
    if (r?.value !== undefined) scope.set(v.name, r.exact ?? r.value);
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
function splitTarget(target: string): { spaceId: string; index: number } | null {
  const m = SPLIT_TARGET.exec(target);
  return m ? { spaceId: m[1], index: Number(m[2]) } : null;
}

const TARGET_LABEL: Record<'width' | 'height' | 'depth' | 'mountHeight' | 'x' | 'y' | 'z', string> =
  {
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
export function readTarget(item: BindItem, target: string): number | undefined {
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
        : p.kind === 'cabinet' || p.kind === 'corner'
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

/** The whole-mm range a target accepts (the same limits as its field); null when the piece has no such part. */
function targetRange(item: BindItem, target: string): { min: Mm; max: Mm } | null {
  const s = splitTarget(target);
  if (s) return hasTarget(item, target) ? { min: 1, max: 10000 } : null;
  switch (target) {
    case 'width':
    case 'height':
    case 'depth': {
      const f = sizeFields(item.design.product).find((x) => x.key === target);
      return f ? { min: f.min, max: f.max } : null;
    }
    case 'mountHeight':
      return hasTarget(item, target) ? { min: 0, max: 3000 } : null;
    case 'y':
      return { min: 0, max: 3000 };
    case 'x':
    case 'z':
      return { min: POSITION_MIN, max: POSITION_MAX };
  }
  return null;
}

/** Why a value cannot go into a target, or null: outside the field's range (ADR-008: never clamped silently). */
export function rangeProblem(item: BindItem, target: string, value: Mm): string | null {
  const r = targetRange(item, target);
  if (!r) return null;
  if (value < r.min || value > r.max)
    return t('{n} mm is outside {min}–{max} mm.', { n: value, min: r.min, max: r.max });
  return null;
}

/** Whether the piece has the part a target names (so it can be bound). */
export function hasTarget(item: BindItem, target: string): boolean {
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
export function writeTarget<T extends BindItem>(item: T, target: string, value: Mm): T {
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
// A piece's own variables (ADR-210)
// ---------------------------------------------------------------------------

/** A stand-in placed piece for a design alone, so the target helpers above serve a piece's own bindings. */
const asItem = (d: Design): BindItem => ({
  design: d,
  position: { x: 0, y: 0, z: 0 },
});

/** The values of a piece's own variables that evaluate, by name. */
export const designScope = (d: Pick<Design, 'variables'>): Map<string, number> =>
  variableScope(d.variables ?? []);

/**
 * The piece's own bindings evaluated with its own variables and written into its sizes (ADR-210). Targets in `skip`
 * are left alone (a project binding on the same target wins). The same design when nothing changes; problems are
 * left to `designVariableDiagnostics`, and a binding with a problem leaves its field as it is.
 */
export function applyDesignBindings(d: Design, skip: readonly string[] = []): Design {
  if (!d.bindings?.length) return d;
  const scope = designScope(d);
  let item = asItem(d);
  for (const b of d.bindings) {
    if (skip.includes(b.target)) continue;
    const e = evaluateBinding(b.expr, scope);
    if (e.value === undefined || rangeProblem(item, b.target, e.value)) continue;
    item = writeTarget(item, b.target, e.value);
  }
  return item.design;
}

/** Problems of a piece's own variables and bindings (ADR-008): errors, so export is blocked. */
export function designVariableDiagnostics(d: Design): Diagnostic[] {
  const vars = d.variables ?? [];
  if (!vars.length && !d.bindings?.length) return [];
  const out: Diagnostic[] = [];
  const ev = evaluateVariables(vars);
  for (const v of vars) {
    const r = ev.get(v.id);
    if (r?.problem)
      out.push({
        severity: 'error',
        code: 'variable-problem',
        message: t('Variable “{name}”: {problem}', { name: v.name, problem: r.problem }),
        nodeId: `var:${v.id}`,
      });
  }
  const scope = designScope(d);
  const item = asItem(d);
  for (const b of d.bindings ?? []) {
    const e = evaluateBinding(b.expr, scope);
    const field = targetLabel(b.target);
    const range = e.value !== undefined ? rangeProblem(item, b.target, e.value) : null;
    const problem = e.problem
      ? e.problem
      : range
        ? t('{problem} The field keeps {n} mm.', {
            problem: range,
            n: readTarget(item, b.target) ?? 0,
          })
        : !hasTarget(item, b.target)
          ? t('{name} has no {field} to bind.', { name: d.name, field })
          : null;
    if (problem)
      out.push({
        severity: 'error',
        code: 'binding-problem',
        message: t('{name}, {field}: {problem}', { name: d.name, field, problem }),
        nodeId: d.product.id,
      });
  }
  return out;
}

export function addDesignVariable(
  d: Design,
  name: string,
  expr: string,
): { design: Design; id: string } {
  const id = newId();
  const variables = [...(d.variables ?? []), { id, name: name.trim(), expr: expr.trim() }];
  return { design: { ...d, variables }, id };
}

/** Rename or change a piece's own variable; a rename follows into its formulas and bindings. */
export function updateDesignVariable(
  d: Design,
  id: string,
  patch: { name?: string; expr?: string },
): Design {
  const vars = d.variables ?? [];
  const v = vars.find((x) => x.id === id);
  if (!v) return d;
  const name = patch.name?.trim() ?? v.name;
  const names = vars.map((x) => x.name);
  const ren = (expr: string) => (name === v.name ? expr : renameInExpr(expr, v.name, name, names));
  return {
    ...d,
    variables: vars.map((x) =>
      x.id === id
        ? { ...x, name, expr: patch.expr?.trim() ?? x.expr }
        : { ...x, expr: ren(x.expr) },
    ),
    ...(d.bindings ? { bindings: d.bindings.map((b) => ({ ...b, expr: ren(b.expr) })) } : {}),
  };
}

/** Remove a piece's own variable; the bindings that used it go and their fields keep their numbers. */
export function deleteDesignVariable(d: Design, id: string): Design {
  const vars = d.variables ?? [];
  const v = vars.find((x) => x.id === id);
  if (!v) return d;
  const names = vars.map((x) => x.name);
  const refers = (expr: string) =>
    namesIn(expr, names).some((n) => n.toLowerCase() === v.name.toLowerCase());
  const variables = vars.filter((x) => x.id !== id);
  const bindings = (d.bindings ?? []).filter((b) => !refers(b.expr));
  return {
    ...d,
    variables: variables.length ? variables : undefined,
    bindings: bindings.length ? bindings : undefined,
  };
}

/** Set, replace or (with `expr` null) remove a piece's own binding on `target`. */
export function setDesignBinding(d: Design, target: string, expr: string | null): Design {
  const rest = (d.bindings ?? []).filter((b) => b.target !== target);
  const bindings = expr === null ? rest : [...rest, { target, expr: expr.trim() }];
  return { ...d, bindings: bindings.length ? bindings : undefined };
}

/** How many of the piece's bindings and which of its other variables refer to its variable `id`. */
export function designVariableUsers(
  d: Design,
  id: string,
): { bindings: number; vars: DesignVariable[] } {
  const vars = d.variables ?? [];
  const v = vars.find((x) => x.id === id);
  if (!v) return { bindings: 0, vars: [] };
  const names = vars.map((x) => x.name);
  const refers = (expr: string) =>
    namesIn(expr, names).some((n) => n.toLowerCase() === v.name.toLowerCase());
  return {
    bindings: (d.bindings ?? []).filter((b) => refers(b.expr)).length,
    vars: vars.filter((x) => x.id !== id && refers(x.expr)),
  };
}
