/**
 * The assistant's pure side (ADR-239, ADR-240): the shapes of a request and a reply, the argument specs of the action
 * catalog, plan checking and the change list shown before Apply. No store, no network: the catalog itself lives in
 * `src/store/assistantActions.ts` and the request is sent from `src/online`.
 */
import type { Diagnostic } from './types';

/** One argument of a catalog action, in call order. */
export interface ArgSpec {
  name: string;
  type: 'integer' | 'number' | 'string' | 'boolean' | 'object' | 'array' | 'any';
  /** The allowed values of a string argument. */
  enum?: readonly string[];
  /** A string argument may also be null. */
  nullable?: boolean;
  optional?: boolean;
  description?: string;
}

/** What the model is told about one action: its name, what it does and its arguments. */
export interface ActionSpec {
  name: string;
  description: string;
  args: readonly ArgSpec[];
}

/** One call of a plan: an action and its arguments by name. */
export interface PlanCall {
  action: string;
  args: Record<string, unknown>;
}

/** The model's reply: a question (nothing changes) or a plan of calls. */
type AssistantReply =
  { kind: 'question'; text: string } | { kind: 'plan'; summary: string; calls: PlanCall[] };

/** A chat line as sent to the backend. */
export interface ChatTurn {
  role: 'user' | 'assistant';
  text: string;
}

/** The body sent to the `assistant` Edge Function (ADR-239): never geometry, pictures or other saved data. */
export interface AssistantRequest {
  message: string;
  history: ChatTurn[];
  /** The open piece's design document, or the open project (the same JSON as their files). */
  document: { kind: 'design' | 'project'; value: unknown };
  /** What is selected: the project piece ids and the space id inside the open piece. */
  selection: { itemIds: string[]; spaceId: string | null | undefined };
  actions: ActionSpec[];
}

const isInt = (v: unknown) => typeof v === 'number' && Number.isInteger(v);

/** Why one argument value does not fit its spec, or null. */
function argProblem(spec: ArgSpec, v: unknown): string | null {
  if (v === undefined) return spec.optional ? null : `${spec.name} is missing`;
  if (v === null) return spec.nullable || spec.optional ? null : `${spec.name} must not be null`;
  switch (spec.type) {
    case 'integer':
      return isInt(v) ? null : `${spec.name} must be a whole number`;
    case 'number':
      return typeof v === 'number' && Number.isFinite(v) ? null : `${spec.name} must be a number`;
    case 'string':
      if (typeof v !== 'string') return `${spec.name} must be text`;
      return spec.enum && !spec.enum.includes(v)
        ? `${spec.name} must be one of ${spec.enum.join(', ')}`
        : null;
    case 'boolean':
      return typeof v === 'boolean' ? null : `${spec.name} must be true or false`;
    case 'object':
      return typeof v === 'object' && !Array.isArray(v) ? null : `${spec.name} must be an object`;
    case 'array':
      return Array.isArray(v) ? null : `${spec.name} must be a list`;
    default:
      return null;
  }
}

/**
 * Check a whole plan against the catalog before anything runs (ADR-240): every action known, every argument of the
 * right type, no unknown argument. Returns the problems; an empty list means the plan may run.
 */
export function planProblems(calls: readonly PlanCall[], specs: readonly ActionSpec[]): string[] {
  const byName = new Map(specs.map((s) => [s.name, s]));
  const out: string[] = [];
  if (!calls.length) out.push('The plan has no steps.');
  calls.forEach((c, i) => {
    const spec = byName.get(c.action);
    const at = `Step ${i + 1} (${String(c.action)})`;
    if (!spec) {
      out.push(`${at}: unknown action`);
      return;
    }
    const args = c.args && typeof c.args === 'object' ? c.args : {};
    for (const a of spec.args) {
      const p = argProblem(a, (args as Record<string, unknown>)[a.name]);
      if (p) out.push(`${at}: ${p}`);
    }
    for (const k of Object.keys(args))
      if (!spec.args.some((a) => a.name === k)) out.push(`${at}: unknown argument ${k}`);
  });
  return out;
}

/** A call's arguments in call order, for the store function. */
export const positional = (spec: ActionSpec, args: Record<string, unknown>): unknown[] =>
  spec.args.map((a) => args[a.name]);

/** Read the reply the backend returns; anything else is null (shown as an error, nothing changes). */
export function parseReply(v: unknown): AssistantReply | null {
  if (!v || typeof v !== 'object') return null;
  const r = v as Record<string, unknown>;
  if (r.kind === 'question' && typeof r.text === 'string' && r.text.trim())
    return { kind: 'question', text: r.text };
  if (r.kind === 'plan' && typeof r.summary === 'string' && Array.isArray(r.calls)) {
    const calls: PlanCall[] = [];
    for (const c of r.calls) {
      if (!c || typeof c !== 'object' || typeof (c as PlanCall).action !== 'string') return null;
      const args = (c as PlanCall).args;
      calls.push({
        action: (c as PlanCall).action,
        args: args && typeof args === 'object' && !Array.isArray(args) ? args : {},
      });
    }
    return { kind: 'plan', summary: r.summary, calls };
  }
  return null;
}

/** One changed value between two documents: its path and the two values as short text. */
export interface Change {
  path: string;
  before: string;
  after: string;
}

const SKIP = new Set(['updatedAt', 'createdAt']);
const show = (v: unknown): string => {
  if (v === undefined) return '—';
  const s = typeof v === 'string' ? v : JSON.stringify(v);
  return s.length > 60 ? `${s.slice(0, 57)}…` : s;
};
const named = (v: unknown): string | undefined => {
  if (!v || typeof v !== 'object') return undefined;
  const o = v as Record<string, unknown>;
  const n = o.name ?? (o.design as Record<string, unknown> | undefined)?.name ?? o.id;
  return typeof n === 'string' ? n : undefined;
};

/**
 * The changes between two documents (ADR-240), as readable paths: `Wardrobe › product › params › width: 1200 → 1000`.
 * Array items are named by their `name` or `id`; timestamps are skipped. At most `limit` lines.
 */
export function changesBetween(before: unknown, after: unknown, limit = 40): Change[] {
  const out: Change[] = [];
  const walk = (a: unknown, b: unknown, path: string[]) => {
    if (out.length >= limit || a === b) return;
    const objA = a && typeof a === 'object';
    const objB = b && typeof b === 'object';
    if (objA && objB && Array.isArray(a) === Array.isArray(b)) {
      if (Array.isArray(a) && Array.isArray(b)) {
        const id = (x: unknown) =>
          x && typeof x === 'object' ? (x as { id?: unknown }).id : undefined;
        const keyed =
          a.every((x) => typeof id(x) === 'string') && b.every((x) => typeof id(x) === 'string');
        if (keyed) {
          const mapA = new Map(a.map((x) => [id(x), x]));
          const mapB = new Map(b.map((x) => [id(x), x]));
          for (const [k, x] of mapA) {
            const label = named(x) ?? String(k);
            if (!mapB.has(k))
              out.push({ path: [...path, label].join(' › '), before: 'present', after: 'removed' });
            else walk(x, mapB.get(k), [...path, label]);
          }
          for (const [k, x] of mapB)
            if (!mapA.has(k))
              out.push({
                path: [...path, named(x) ?? String(k)].join(' › '),
                before: '—',
                after: 'added',
              });
          return;
        }
        const n = Math.max(a.length, b.length);
        for (let i = 0; i < n; i++) walk(a[i], b[i], [...path, String(i + 1)]);
        return;
      }
      const ka = a as Record<string, unknown>;
      const kb = b as Record<string, unknown>;
      for (const k of new Set([...Object.keys(ka), ...Object.keys(kb)])) {
        if (SKIP.has(k)) continue;
        walk(ka[k], kb[k], [...path, k]);
      }
      return;
    }
    if (JSON.stringify(a) === JSON.stringify(b)) return;
    out.push({ path: path.join(' › ') || '(document)', before: show(a), after: show(b) });
  };
  walk(before, after, []);
  return out;
}

/** Diagnostics in `after` that were not in `before` (by severity, code and message), errors first. */
export function newDiagnostics(
  before: readonly Diagnostic[],
  after: readonly Diagnostic[],
): Diagnostic[] {
  const key = (d: Diagnostic) => `${d.severity}|${d.code}|${d.message}`;
  const had = new Set(before.map(key));
  const rank = (d: Diagnostic) => (d.severity === 'error' ? 0 : 1);
  return after.filter((d) => !had.has(key(d))).sort((x, y) => rank(x) - rank(y));
}
