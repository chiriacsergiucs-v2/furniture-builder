import { t, tr } from '@furniture-builder/i18n';
import { findInProduct } from '../core/design';
import type { Selection } from '../core/selectPath';
import { KIND_LABEL, WHOLE_LABEL as WHOLE, placed, spacePlace } from '../core/spaceNames';

/** One line naming what is selected in the piece, for the phone sheet's peek row (ADR-079). */
export function selectionLabel(prod: Parameters<typeof findInProduct>[0], id: Selection) {
  if (id === null) return WHOLE[prod.kind];
  const found = id ? findInProduct(prod, id) : undefined;
  if (!found) return null;
  if (found.space.id === found.root.id) return tr(found.label);
  return placed(
    spacePlace(found.root, found.space.id),
    found.space.kind === 'split' ? t('Divided space') : KIND_LABEL[found.space.kind],
  );
}
