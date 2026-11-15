/**
 * Parts the user already owns (ADR-271): marked on a cut-list row, kept as `ownedParts` (key → count) on the design and
 * on the project, and taken off the cut list and the sheet layouts only. Pure: nothing here builds geometry.
 */
import type { CutRow } from './cutlist';
import type { Material } from './types';

/** The most parts one key can own. */
const OWNED_MAX = 9999;

/**
 * The identity of a cut-list row for ownership: size, banded edges, thickness, drilling and board (the board as
 * `materialKey` in project.ts reads it, which core/owned.ts must not import: a cycle). The edge band's name is not part
 * of it, so naming a band later keeps the mark. The board comes last: its name may hold any text.
 */
export function ownedKey(r: CutRow, m: Pick<Material, 'name' | 'thickness' | 'grain' | 'image'>) {
  const board = `${m.name}|${m.thickness}|${m.grain ? 'grain' : 'plain'}${m.image ? `|img:${m.image.id}` : ''}`;
  return `${r.length}x${r.width}|${r.edgesL}${r.edgesW}|${r.thickness}|${r.drilling}|${board}`;
}

/** "720 × 560 mm" for a key: its size, readable without the rows it came from. */
export function ownedSize(key: string): string {
  const [size] = key.split('|');
  return `${size.replace('x', ' × ')} mm`;
}

/** A valid `ownedParts` map: keys of text, whole counts from 1 to `OWNED_MAX`. */
export function validOwned(v: unknown): v is Record<string, number> {
  return (
    typeof v === 'object' &&
    v !== null &&
    !Array.isArray(v) &&
    Object.keys(v).length <= 2000 &&
    Object.entries(v).every(
      ([k, n]) =>
        k.length > 0 &&
        k.length <= 300 &&
        typeof n === 'number' &&
        Number.isInteger(n) &&
        n >= 1 &&
        n <= OWNED_MAX,
    )
  );
}

export interface OwnedSplit {
  /** The rows still to cut: owned parts taken off, rows with none left removed. */
  cut: CutRow[];
  /** The `ownedKey` of each row of `cut`, in the same order. */
  cutKeys: string[];
  /** Rows with owned parts, as they were before: `owned` of them are owned, `quantity` in all. */
  owned: { row: CutRow; key: string; owned: number }[];
  /** Marks that match no part now, or more parts than are needed: the count left over. */
  unmatched: { key: string; count: number }[];
  /** How many parts each key has in the design, owned or not. */
  totals: Record<string, number>;
  /** The marks as saved: key → how many are owned. */
  marks: Record<string, number>;
}

/**
 * `rows` without the parts in `owned`. A key takes its count from the rows with that key in order; a part id of an
 * owned part leaves the row (so the highlight and the sheets follow what is cut).
 */
export function applyOwned(
  rows: CutRow[],
  owned: Record<string, number> | undefined,
  materials: readonly Material[],
): OwnedSplit {
  const marks = owned ?? {};
  const mats = new Map(materials.map((m) => [m.id, m]));
  const left = new Map(Object.entries(marks));
  const cut: CutRow[] = [];
  const cutKeys: string[] = [];
  const have: OwnedSplit['owned'] = [];
  const totals: Record<string, number> = {};
  for (const r of rows) {
    const m = mats.get(r.materialId);
    const key = m ? ownedKey(r, m) : '';
    totals[key] = (totals[key] ?? 0) + r.quantity;
    const n = Math.min(left.get(key) ?? 0, r.quantity);
    if (n) {
      left.set(key, (left.get(key) ?? 0) - n);
      have.push({ row: r, key, owned: n });
    }
    if (n >= r.quantity) continue;
    cut.push(n ? { ...r, quantity: r.quantity - n, panelIds: r.panelIds.slice(n) } : r);
    cutKeys.push(key);
  }
  const unmatched = [...left].filter(([, c]) => c > 0).map(([key, count]) => ({ key, count }));
  return { cut, cutKeys, owned: have, unmatched, totals, marks };
}

/** `owned` with `key` set to `count` (0 or less removes it); a new object, `undefined` when none are left. */
export function withOwned(
  owned: Record<string, number> | undefined,
  key: string,
  count: number,
): Record<string, number> | undefined {
  const next = { ...owned };
  const n = Math.max(0, Math.min(OWNED_MAX, Math.floor(count)));
  if (n > 0) next[key] = n;
  else delete next[key];
  return Object.keys(next).length ? next : undefined;
}
