/**
 * Quick counts for the selected space (ADR-084): which counts apply to it, and one step up or down.
 * Pure: the stepper over the drawing and the 3D view only renders these rows and applies `stepCount`.
 */
import { findInProduct, fr, makeSpace, productRoots, setDrawerCount, splitSpace } from './design';
import type { Selection } from './selectPath';
import type { Product, Space } from './types';

export type CountKey = 'vdiv' | 'hdiv' | 'shelves' | 'drawers' | 'doors' | 'sliding';

export interface CountRow {
  key: CountKey;
  label: string;
  value: number;
  min: number;
  max: number;
  /** The space the step changes: always the selected one (ADR-086). */
  target: string;
}

/** Same bounds as the inspector's counters (parts 2–8 → dividers 0–7, shelves 0–12, drawers 1–10). */
const MAX_DIVIDERS = 7;
const MAX_SHELVES = 12;
const MAX_DRAWERS = 10;

const DIV: Record<'x' | 'y', { key: CountKey; label: string }> = {
  x: { key: 'vdiv', label: 'Vertical dividers' },
  y: { key: 'hdiv', label: 'Horizontal dividers' },
};

/**
 * The space whose counts the card shows for a selection: the selected space, or for the whole piece (ADR-083 `null`)
 * its interior when it has exactly one (a cabinet; not a desk with two pedestals or an L-corner's two wings).
 */
export function countSubject(prod: Product, sel: Selection): string | undefined {
  if (typeof sel === 'string') return sel;
  if (sel !== null) return undefined;
  const roots = productRoots(prod);
  return roots.length === 1 ? roots[0].root.id : undefined;
}

/** The count rows for the selected space, in display order; empty when the id is not a space of the product. */
export function countRows(prod: Product, id: string): CountRow[] {
  const found = findInProduct(prod, id);
  if (!found) return [];
  const s = found.space;
  const rows: CountRow[] = [];
  // Every row changes the selected space only (ADR-086): a bay's dividers divide that bay, never its parent.
  for (const axis of ['x', 'y'] as const)
    rows.push({
      ...DIV[axis],
      value: s.kind === 'split' && s.axis === axis ? s.children.length - 1 : 0,
      min: 0,
      max: MAX_DIVIDERS,
      target: s.id,
    });
  if (s.kind === 'shelves')
    rows.push({
      key: 'shelves',
      label: 'Shelves',
      value: s.count,
      min: 0,
      max: MAX_SHELVES,
      target: s.id,
    });
  if (s.kind === 'drawers')
    rows.push({
      key: 'drawers',
      label: 'Drawers',
      value: s.count,
      min: 1,
      max: MAX_DRAWERS,
      target: s.id,
    });
  if (s.front?.kind === 'doors')
    rows.push({ key: 'doors', label: 'Doors', value: s.front.count, min: 1, max: 2, target: s.id });
  if (s.front?.kind === 'sliding')
    rows.push({
      key: 'sliding',
      label: 'Sliding doors',
      value: s.front.count,
      min: 2,
      max: 4,
      target: s.id,
    });
  return rows;
}

/** One divider more or fewer along `axis`. A new bay goes at the end, empty (ADR-089); removing takes the last bay. */
function stepDividers(t: Space, axis: 'x' | 'y', delta: 1 | -1): Space {
  if (t.kind !== 'split' || t.axis !== axis) return delta > 0 ? splitSpace(t, axis, 2) : t;
  const n = t.children.length;
  if (delta > 0)
    return n - 1 >= MAX_DIVIDERS
      ? t
      : { ...t, children: [...t.children, makeSpace('empty')], sizes: [...t.sizes, fr()] };
  if (n > 2) return { ...t, children: t.children.slice(0, -1), sizes: t.sizes.slice(0, -1) };
  // The last divider: one space again, holding the first bay's contents under the split's id and doors.
  const first = t.children[0];
  return { ...first, id: t.id, front: t.front ?? first.front ?? null };
}

/**
 * Apply one step to the row's target space. Steps outside the row's bounds return the space unchanged (the buttons
 * are disabled there); a count that does not fit the space is left to the model's diagnostics (ADR-008).
 */
export function stepCount(t: Space, key: CountKey, delta: 1 | -1): Space {
  switch (key) {
    case 'vdiv':
      return stepDividers(t, 'x', delta);
    case 'hdiv':
      return stepDividers(t, 'y', delta);
    case 'shelves': {
      if (t.kind !== 'shelves') return t;
      const count = t.count + delta;
      return count < 0 || count > MAX_SHELVES ? t : { ...t, count };
    }
    case 'drawers': {
      if (t.kind !== 'drawers') return t;
      const count = t.count + delta;
      return count < 1 || count > MAX_DRAWERS ? t : setDrawerCount(t, count);
    }
    case 'doors': {
      if (t.front?.kind !== 'doors') return t;
      const count = t.front.count + delta;
      return count === 1 || count === 2 ? { ...t, front: { ...t.front, count } } : t;
    }
    case 'sliding': {
      if (t.front?.kind !== 'sliding') return t;
      const count = t.front.count + delta;
      return count === 2 || count === 3 || count === 4 ? { ...t, front: { ...t.front, count } } : t;
    }
  }
}
