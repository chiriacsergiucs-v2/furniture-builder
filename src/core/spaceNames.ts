import { t, tr } from '@furniture-builder/i18n';
import { findInProduct, parentOf } from './design';
import type { Product, Space, SpaceKind } from './types';

/**
 * Where a space sits among its siblings, in words (ADR-267): `Left`/`Right` for two children of a vertical split,
 * `Left`/`Middle`/`Right` for three, `Bay i of n` for more; `Top`/`Bottom`, `Top`/`Middle`/`Bottom` and `Row i of n`
 * for a horizontal split. `null` for a space with no divided parent (the first level of a piece).
 */
export function spacePlace(root: Space, id: string): string | null {
  const parent = parentOf(root, id);
  if (!parent || parent.kind !== 'split') return null;
  const i = parent.children.findIndex((c) => c.id === id);
  if (i < 0) return null;
  const n = parent.children.length;
  const across = parent.axis === 'x';
  if (n === 2)
    return (across ? [t('Left@@place'), t('Right@@place')] : [t('Top@@place'), t('Bottom@@place')])[
      i
    ];
  if (n === 3)
    return (
      across
        ? [t('Left@@place'), t('Middle@@place'), t('Right@@place')]
        : [t('Top@@place'), t('Middle@@place'), t('Bottom@@place')]
    )[i];
  return across ? t('Bay {i} of {n}', { i: i + 1, n }) : t('Row {i} of {n}', { i: i + 1, n });
}

/** `what` with its place in front ("Left: Drawers"); `what` alone when the space has no place. */
export function placed(place: string | null, what: string): string {
  return place ? t('{place}: {what}', { place, what }) : what;
}

/** What a space is, by kind (the crumb text, ADR-267). */
export const KIND_LABEL: Record<SpaceKind, string> = {
  empty: t('Empty'),
  shelves: t('Shelves'),
  drawers: t('Drawers'),
  hanging: t('Hanging'),
  split: t('Divided'),
};

/** The whole piece, by product kind. */
export const WHOLE_LABEL: Record<Product['kind'], string> = {
  cabinet: t('Whole cabinet'),
  desk: t('Whole desk'),
  corner: t('Whole corner unit'),
  panel: t('Whole panel'),
  frame: t('Whole frame'),
  panels: t('Whole panel set'),
};

/** The name of a space on the path and in the tree: its place and kind ("Left: Drawers"). */
export const spaceName = (root: Space, s: Space) =>
  placed(spacePlace(root, s.id), KIND_LABEL[s.kind]);

/** The name of a space of a piece by id (ADR-267 names), or null when it is not in the piece. */
export function nameOfSpace(prod: Product, id: string): string | null {
  const f = findInProduct(prod, id);
  if (!f) return null;
  return f.space.id === f.root.id ? tr(f.label) : spaceName(f.root, f.space);
}
