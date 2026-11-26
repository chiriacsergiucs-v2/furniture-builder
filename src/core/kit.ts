/**
 * Kits (ADR-298): a piece inserted as a pre-made build keeps only its outer size and its boards open. Pure checks the
 * store runs before each edit; geometry still comes only from `buildModel()` (ADR-004).
 */
import { t } from '@furniture-builder/i18n';
import type { Design, KitEdit } from './types';

/** The edits a design's kit keeps open, or null when the design is not a kit. */
const kitAllows = (d: Design): readonly KitEdit[] | null => d.catalog?.kit?.allow ?? null;

const SIZE = new Set(['width', 'height', 'depth']);
/** A product's board choices (body, front, back board…) are boards, not structure. */
const isBoardKey = (k: string) => k.endsWith('MaterialId');

/** The product as text with the chosen keys of its params left out. */
function productWithout(d: Design, drop: (k: string) => boolean): string {
  const p = d.product as unknown as { params?: Record<string, unknown> };
  if (!p.params) return JSON.stringify(p);
  const params = Object.fromEntries(Object.entries(p.params).filter(([k]) => !drop(k)));
  return JSON.stringify({ ...p, params });
}

/**
 * Why an edit to a kit is refused, or null. Taking the kit away (Unlock all edits) is always allowed; while it stays,
 * the product may change only its outer size (`size`) and its board choices (`boards`), and the design's boards
 * (`materials`, role and part boards) only with `boards`.
 */
export function kitBlocked(prev: Design, next: Design): string | null {
  const allow = kitAllows(prev);
  if (!allow || !next.catalog?.kit) return null;
  const open = (k: string) =>
    (allow.includes('size') && SIZE.has(k)) || (allow.includes('boards') && isBoardKey(k));
  const shapeChanged = productWithout(prev, open) !== productWithout(next, open);
  const boardsChanged =
    JSON.stringify([prev.materials, prev.roleMaterials, prev.partMaterials]) !==
    JSON.stringify([next.materials, next.roleMaterials, next.partMaterials]);
  if (shapeChanged || (boardsChanged && !allow.includes('boards')))
    return t('Locked in a kit. Unlock all edits to change it.');
  return null;
}

/** The design with its kit removed (Unlock all edits); the same design when it is not a kit. */
export function unlockKit(d: Design): Design {
  if (!d.catalog?.kit) return d;
  const { kit, ...catalog } = d.catalog;
  void kit;
  return { ...d, catalog };
}
