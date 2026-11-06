/**
 * A plan picture to trace over (ADR-208, G-012): a picture of the user's floor plan from this device, drawn under the
 * plan at a scale set from two taps and a typed length. Point `a` (whole picture pixels) sits at room (0, 0); the
 * distance from `a` to `b` in the picture is `length` mm in the room. Pure: the plan only turns taps into room mm.
 */
import type { Pt } from './room';
import type { Mm } from './types';
import { t } from './i18n';

export interface PlanPicture {
  /** Row id in this device's `images` table. */
  id: string;
  name: string;
  /** Two points in the picture, whole pixels from its top-left corner. */
  a: Pt;
  b: Pt;
  /** The room distance between them, whole mm. */
  length: Mm;
  /** Kept but not drawn ("Show the plan picture" off). */
  hidden?: true;
}

/** Millimetres per picture pixel; 0 when `a` and `b` are the same point. */
export function planScale(pp: Pick<PlanPicture, 'a' | 'b' | 'length'>): number {
  const px = Math.hypot(pp.b[0] - pp.a[0], pp.b[1] - pp.a[1]);
  return px > 0 ? pp.length / px : 0;
}

/**
 * Where a picture of `width` × `height` pixels lies on the plan, in whole room mm (x, z of its top-left, w, d): the
 * plan frames and measures it, and its sizes are whole mm like every other (ADR-003).
 */
export function planPictureRect(
  pp: Pick<PlanPicture, 'a' | 'b' | 'length'>,
  width: number,
  height: number,
): { x: number; z: number; w: number; d: number } {
  const s = planScale(pp);
  const mm = (v: number) => Math.round(v) || 0;
  return { x: mm(-pp.a[0] * s), z: mm(-pp.a[1] * s), w: mm(width * s), d: mm(height * s) };
}

/** The picture pixel (whole) under a room point (mm), at the picture's present scale. */
export function roomToPicture(
  pp: Pick<PlanPicture, 'a' | 'b' | 'length'>,
  x: number,
  z: number,
): Pt {
  const s = planScale(pp) || 1;
  return [Math.round(pp.a[0] + x / s), Math.round(pp.a[1] + z / s)];
}

/** A new plan picture: 10 mm per pixel along its width until the scale is set (`a` at the top-left corner). */
export function newPlanPicture(id: string, name: string, width: number): PlanPicture {
  const w = Math.max(1, Math.round(width));
  return { id, name, a: [0, 0], b: [w, 0], length: w * 10 };
}

const isInt = (v: unknown, min = -1e7) =>
  typeof v === 'number' && Number.isSafeInteger(v) && v >= min && v <= 1e7;
const isPt = (v: unknown) =>
  Array.isArray(v) && v.length === 2 && v.every((n) => isInt(n, 0) && (n as number) <= 100_000);

/** Problems with a stored plan picture (ADR-008: reported, never thrown). */
export function planPictureProblems(v: unknown): string[] {
  const o = v as Record<string, unknown> | null;
  const ok =
    !!o &&
    typeof o === 'object' &&
    !Array.isArray(o) &&
    typeof o.id === 'string' &&
    !!o.id &&
    o.id.length <= 200 &&
    typeof o.name === 'string' &&
    o.name.length <= 500 &&
    isPt(o.a) &&
    isPt(o.b) &&
    ((o.a as number[])[0] !== (o.b as number[])[0] ||
      (o.a as number[])[1] !== (o.b as number[])[1]) &&
    isInt(o.length, 1) &&
    (o.hidden === undefined || o.hidden === true);
  return ok ? [] : [t('Invalid plan picture')];
}
