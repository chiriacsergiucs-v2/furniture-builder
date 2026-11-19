/**
 * The standalone cut list optimizer (backlog row of 2026-11-19): typed part sizes and one board size, laid out by the
 * nesting engine (ADR-018, ADR-279) without a design. Inputs stay as typed text so a wrong value is shown, never
 * clamped (ADR-008); only whole millimetres are accepted (ADR-003). Pure: no React, no storage.
 */
import { DEFAULT_KERF, defaultSheetFor } from './design';
import type { NestJob } from '@furniture-builder/nesting';

export interface OptimizerPart {
  id: string;
  label: string;
  length: string;
  width: string;
  quantity: string;
}

export interface OptimizerInput {
  sheetLength: string;
  sheetWidth: string;
  kerf: string;
  trim: string;
  /** Grain lock: parts never rotate on the sheet. */
  grain: boolean;
  parts: OptimizerPart[];
}

/** `required`: empty; `whole`: not a whole number; `min`: below the smallest allowed value. */
export type OptimizerProblem = 'required' | 'whole' | 'min';

export interface OptimizerCheck {
  /** Null while any field has a problem or no part row is filled in. */
  job: NestJob | null;
  /** Keyed `sheetLength`, `sheetWidth`, `kerf`, `trim`, or `<part id>.length|width|quantity`. */
  problems: Record<string, OptimizerProblem>;
  /** Filled-in part rows. */
  filled: number;
}

export const optimizerPartId = (): string => Math.random().toString(36).slice(2, 10);

export const emptyOptimizerPart = (): OptimizerPart => ({
  id: optimizerPartId(),
  label: '',
  length: '',
  width: '',
  quantity: '1',
});

/** Starts from the user's PAL stock (src/core/design.ts): 2800 × 2070, 10 mm trim, 4 mm kerf, grain locked. */
export function defaultOptimizerInput(): OptimizerInput {
  const s = defaultSheetFor({ id: 'pal', name: 'PAL' });
  return {
    sheetLength: String(s.length),
    sheetWidth: String(s.width),
    kerf: String(DEFAULT_KERF),
    trim: String(s.trim),
    grain: true,
    parts: [emptyOptimizerPart()],
  };
}

function whole(text: string, min: number): number | OptimizerProblem {
  const v = text.trim();
  if (!v) return 'required';
  if (!/^\d+$/.test(v)) return 'whole';
  const n = Number(v);
  return n < min ? 'min' : n;
}

const blank = (p: OptimizerPart) =>
  !p.label.trim() &&
  !p.length.trim() &&
  !p.width.trim() &&
  (!p.quantity.trim() || p.quantity === '1');

/** Checks every field and builds the nesting job. A part row left fully blank is ignored. */
export function optimizerJob(input: OptimizerInput): OptimizerCheck {
  const problems: Record<string, OptimizerProblem> = {};
  const read = (key: string, text: string, min: number) => {
    const r = whole(text, min);
    if (typeof r === 'number') return r;
    problems[key] = r;
    return 0;
  };
  const length = read('sheetLength', input.sheetLength, 1);
  const width = read('sheetWidth', input.sheetWidth, 1);
  const kerf = read('kerf', input.kerf, 0);
  const trim = read('trim', input.trim, 0);
  const parts: NestJob['parts'] = [];
  for (const p of input.parts) {
    if (blank(p)) continue;
    parts.push({
      key: p.id,
      label: p.label.trim(),
      length: read(`${p.id}.length`, p.length, 1),
      width: read(`${p.id}.width`, p.width, 1),
      quantity: read(`${p.id}.quantity`, p.quantity, 1),
    });
  }
  const ok = Object.keys(problems).length === 0 && parts.length > 0;
  return {
    problems,
    filled: parts.length,
    job: ok
      ? {
          materialId: 'optimizer',
          materialName: `${length} × ${width}`,
          thickness: 0,
          grain: input.grain,
          sheet: { length, width, count: null },
          trim,
          kerf,
          parts,
        }
      : null,
  };
}

/** Reads a saved input; anything unreadable gives null (the caller starts fresh and leaves the stored text). */
export function parseOptimizerInput(raw: string | null): OptimizerInput | null {
  if (!raw) return null;
  try {
    const v: unknown = JSON.parse(raw);
    if (!v || typeof v !== 'object') return null;
    const o = v as Record<string, unknown>;
    const str = (x: unknown) => typeof x === 'string';
    if (
      !str(o.sheetLength) ||
      !str(o.sheetWidth) ||
      !str(o.kerf) ||
      !str(o.trim) ||
      typeof o.grain !== 'boolean' ||
      !Array.isArray(o.parts)
    )
      return null;
    const parts: OptimizerPart[] = [];
    for (const p of o.parts as unknown[]) {
      if (!p || typeof p !== 'object') return null;
      const q = p as Record<string, unknown>;
      if (![q.id, q.label, q.length, q.width, q.quantity].every(str)) return null;
      parts.push({
        id: q.id as string,
        label: q.label as string,
        length: q.length as string,
        width: q.width as string,
        quantity: q.quantity as string,
      });
    }
    return {
      sheetLength: o.sheetLength as string,
      sheetWidth: o.sheetWidth as string,
      kerf: o.kerf as string,
      trim: o.trim as string,
      grain: o.grain,
      parts: parts.length ? parts : [emptyOptimizerPart()],
    };
  } catch {
    return null;
  }
}
