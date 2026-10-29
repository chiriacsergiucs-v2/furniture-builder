import { t } from './i18n';
import type { Mm, Product } from './types';

/** One outside size of a whole piece that can be changed from its selection (ADR-106; height ADR-148). */
export interface SizeField {
  key: 'width' | 'height' | 'depth';
  label: string;
  value: Mm;
  min: Mm;
  max: Mm;
}

/**
 * The width, height and depth fields of a whole piece, with the same labels and limits as its Settings editor. A bed's
 * size comes from the mattress, a panel has no depth and a set of loose panels has no outside size, so those are left
 * out.
 */
export function sizeFields(product: Product): SizeField[] {
  const f = (key: SizeField['key'], label: string, value: Mm, min: Mm, max: Mm): SizeField => ({
    key,
    label,
    value,
    min,
    max,
  });
  switch (product.kind) {
    case 'cabinet':
      return [
        f('width', t('Width'), product.params.width, 100, 4000),
        f('height', t('Height'), product.params.height, 100, 3000),
        f('depth', t('Depth'), product.params.depth, 100, 1200),
      ];
    case 'desk':
      return [
        f('width', t('Width'), product.params.width, 400, 3000),
        f('height', t('Height'), product.params.height, 400, 1200),
        f('depth', t('Depth'), product.params.depth, 300, 1200),
      ];
    case 'corner': {
      const v = product.params.variant;
      const label =
        v === 'blind' ? t('Width') : v === 'diagonal' ? t('Along each wall') : t('Back wing');
      return [
        f('width', label, product.params.width, 300, 3000),
        f('height', t('Height'), product.params.height, 300, 2500),
        f('depth', t('Depth'), product.params.depth, 200, 900),
      ];
    }
    case 'frame':
      return product.params.kind === 'bed'
        ? []
        : [
            f('width', t('Width'), product.params.width, 200, 4000),
            f('height', t('Height'), product.params.height, 200, 1500),
            f('depth', t('Depth'), product.params.depth, 200, 2000),
          ];
    case 'panel':
      return [
        f('width', t('Width'), product.params.width, 20, 3000),
        f('height', t('Height'), product.params.height, 50, 3000),
      ];
    case 'panels':
      return [];
  }
}

/** The piece with one outside size changed; the same product when that size does not apply to it. */
export function resizeProduct(product: Product, key: SizeField['key'], value: Mm): Product {
  if (!sizeFields(product).some((s) => s.key === key)) return product;
  return { ...product, params: { ...product.params, [key]: value } } as Product;
}
