import { t } from './i18n';
import { parentOf } from './design';
import type { Space } from './types';

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
