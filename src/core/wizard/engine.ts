/**
 * New-piece wizard engine (ADR-044). Generic over the step library and the construction-type registry: it never
 * names a type. Answers → design → buildModel(); problems are diagnostics, never exceptions (ADR-008).
 */
import { buildModel } from '../build';
import { newId, validateDesign } from '../design';
import type { Design, FurnitureModel, Severity, WizardAnswers } from '../types';
import { CONSTRUCTION_TYPES, typeById } from './registry';
import {
  BASICS,
  REVIEW,
  STEPS,
  TYPE,
  compartmentsOf,
  contentUses,
  listOf,
  stepById,
  str,
} from './steps';
import type { Answers, ConstructionType, FieldDef, Option, StepDef } from './types';

export { BASICS, REVIEW, TYPE };

export const typeOf = (a: Answers): ConstructionType | undefined => typeById.get(str(a, 'type'));

const FIELD_DEFAULTS: Answers = Object.fromEntries(
  STEPS.flatMap((s) =>
    s.fields.filter((f) => f.default !== undefined).map((f) => [f.id, f.default]),
  ),
);

/** Every answer the wizard works with: field defaults, then the type's defaults, then what the user gave. */
export const resolve = (a: Answers): Answers => ({
  ...FIELD_DEFAULTS,
  ...(typeOf(a)?.defaults ?? {}),
  ...a,
});

/** The steps of the chosen type (Size and Type first, Review last) that apply to these answers. */
export function visibleSteps(a: Answers): StepDef[] {
  const r = resolve(a);
  const ids = [BASICS, TYPE, ...(typeOf(a)?.steps ?? []), REVIEW];
  return ids
    .map((id) => stepById.get(id))
    .filter((s): s is StepDef => !!s && (s.visible?.(r) ?? true));
}

export const visibleFields = (step: StepDef, a: Answers): FieldDef[] => {
  const r = resolve(a),
    t = typeOf(a);
  return step.fields
    .filter((f) => !t?.hide?.includes(f.id) && (f.visible?.(r) ?? true))
    .map((f) => (t?.labels?.[f.id] ? { ...f, label: t.labels[f.id] } : f));
};

/** Options of a choice field: the registry for the type picker, else the field's options narrowed by the type. */
export function fieldOptions(f: FieldDef, a: Answers): Option[] {
  if (f.id === 'type')
    return CONSTRUCTION_TYPES.map((t) => ({ value: t.id, label: t.label, help: t.description }));
  const allowed = typeOf(a)?.options?.[f.id];
  return (f.options ?? []).filter((o) => !allowed || allowed.includes(o.value));
}

export function fieldRange(f: FieldDef, a: Answers): { min: number; max: number } {
  const l = typeOf(a)?.limits?.[f.id];
  return { min: l?.min ?? f.min ?? 0, max: l?.max ?? f.max ?? 100_000 };
}

export interface Problem {
  severity: Severity;
  code: string;
  message: string;
  step?: string;
  field?: string;
}

const whole = (v: unknown, min: number, max: number) =>
  typeof v === 'number' && Number.isInteger(v) && v >= min && v <= max;

/** Range and choice problems of every visible field (errors: they block "Create piece"). */
export function fieldProblems(a: Answers): Problem[] {
  const r = resolve(a);
  const out: Problem[] = [];
  for (const s of visibleSteps(a)) {
    for (const f of visibleFields(s, a)) {
      const v = r[f.id];
      const { min, max } = fieldRange(f, a);
      const bad = (message: string) =>
        out.push({ severity: 'error', code: 'field', message, step: s.id, field: f.id });
      const unit = f.unit === 'mm' ? ' mm' : '';
      const opts = fieldOptions(f, a).map((o) => o.value);
      if (f.kind === 'text' && !(typeof v === 'string' && v.trim() && v.length <= 200))
        bad(`${f.label}: give a name (up to 200 characters).`);
      if (f.kind === 'int' && !whole(v, min, max))
        bad(`${f.label} must be a whole number from ${min} to ${max}${unit}.`);
      if (f.kind === 'choice' && !opts.includes(String(v ?? '')))
        bad(
          f.id === 'type'
            ? 'Choose a construction type.'
            : `${f.label}: choose one of the options.`,
        );
      if (
        f.kind === 'perCompartmentMm' &&
        !listOf<number>(r, f.id, 0).every((w) => whole(w, min, max))
      )
        bad(`${f.label}: whole numbers from ${min} to ${max}${unit}.`);
      if (
        f.kind === 'perCompartment' &&
        !listOf<string>(r, f.id, opts[0] ?? '').every((x) => opts.includes(x))
      )
        bad(`${f.label}: choose one of the options.`);
      if (f.kind === 'compartments') {
        compartmentsOf(r).forEach((c, i) => {
          const uses = contentUses(c.kind);
          if (!opts.includes(c.kind)) bad(`Compartment ${i + 1}: choose what it holds.`);
          if (uses.includes('shelves') && !whole(c.shelves, 0, max))
            bad(`Compartment ${i + 1}: shelves must be a whole number from 0 to ${max}.`);
          if (uses.includes('drawers') && !whole(c.drawers, 1, 10))
            bad(`Compartment ${i + 1}: drawers must be a whole number from 1 to 10.`);
        });
      }
    }
  }
  return out;
}

/** Answers → design: the type's seed, then each visible step writes its answers into it. */
export function toDesign(a: Answers): Design | null {
  const t = typeOf(a);
  if (!t) return null;
  const r = resolve(a);
  return visibleSteps(a).reduce((d, s) => (s.apply ? s.apply(r, d) : d), t.seed(r));
}

export interface Check {
  design: Design | null;
  model: FurnitureModel | null;
  problems: Problem[];
  errors: number;
  warnings: number;
}

const memo = new Map<string, Check>();
const MEMO_SIZE = 64;

/** Field problems, design validation and every buildModel() diagnostic. Never throws. Memoised by answers. */
export function check(a: Answers): Check {
  const key = JSON.stringify(resolve(a));
  const hit = memo.get(key);
  if (hit) return hit;
  const problems = fieldProblems(a);
  let design: Design | null = null,
    model: FurnitureModel | null = null;
  try {
    design = toDesign(a);
    if (design) {
      for (const m of validateDesign(design))
        problems.push({ severity: 'error', code: 'invalid-design', message: m });
      model = buildModel(design);
      for (const d of model.diagnostics)
        problems.push({ severity: d.severity, code: d.code, message: d.message });
    }
  } catch (e) {
    problems.push({
      severity: 'error',
      code: 'build-failed',
      message: `These answers cannot be built (${e instanceof Error ? e.message : 'unknown problem'}).`,
    });
    model = null;
  }
  const out: Check = {
    design,
    model,
    problems,
    errors: problems.filter((p) => p.severity === 'error').length,
    warnings: problems.filter((p) => p.severity === 'warning').length,
  };
  memo.set(key, out);
  if (memo.size > MEMO_SIZE) memo.delete(memo.keys().next().value as string);
  return out;
}

/**
 * The finished piece (ADR-046): a fresh id and timestamps on the built design, or the problems that block it —
 * the same errors that block export.
 */
export function createPiece(
  a: Answers,
  now = new Date().toISOString(),
  replaces?: Design,
): { ok: true; design: Design } | { ok: false; problems: Problem[] } {
  const c = check(a);
  if (!c.design || c.errors)
    return { ok: false, problems: c.problems.filter((p) => p.severity === 'error') };
  // The answers travel with the piece so it can be reopened in the wizard (ADR-046 answer).
  const d: Design = {
    ...structuredClone(c.design),
    createdAt: now,
    updatedAt: now,
    wizard: { answers: structuredClone(resolve(a)) as WizardAnswers },
  };
  if (!replaces) return { ok: true, design: { ...d, id: newId() } };
  // Reopened piece: same id and creation date; catalog fields other than the category are kept.
  return {
    ok: true,
    design: {
      ...d,
      id: replaces.id,
      createdAt: replaces.createdAt,
      catalog: { ...replaces.catalog, ...d.catalog },
    },
  };
}

/** What the wizard would build from the answers stored on a piece, without ids, to compare with the piece. */
const shape = (d: Design) =>
  JSON.stringify([d.product, d.materials], (k, v) => (k === 'id' ? undefined : v));

/** The answers stored on a piece, when it was made in the wizard. */
export const storedAnswers = (d: Design): Answers | null =>
  d.wizard ? (structuredClone(d.wizard.answers) as Answers) : null;

/** True when the piece was changed in the editor after the wizard made it (reopening would replace those changes). */
export function editedSinceWizard(d: Design): boolean {
  const a = storedAnswers(d);
  if (!a) return false;
  const built = check(a).design;
  return !built || shape(built) !== shape(d);
}

/** Steps whose fields a set of answer keys touches. */
export const stepsWriting = (a: Answers, keys: string[]): string[] =>
  visibleSteps(a)
    .filter((s) => s.fields.some((f) => keys.includes(f.id)))
    .map((s) => s.id);

/** The first visible step after `from` that is not done, or Review. */
export function nextOpenStep(a: Answers, from: string, done: Set<string>): string {
  const steps = visibleSteps(a);
  const i = steps.findIndex((s) => s.id === from);
  return steps.slice(i + 1).find((s) => s.id !== REVIEW && !done.has(s.id))?.id ?? REVIEW;
}
