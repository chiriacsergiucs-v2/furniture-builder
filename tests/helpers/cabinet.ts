import type { CabinetParams, Design } from '../../src/core/types';

/** The design with the cabinet parameters in `patch` replaced; any other product is returned unchanged. */
export const withCab = (d: Design, patch: Partial<CabinetParams>): Design =>
  d.product.kind === 'cabinet'
    ? { ...d, product: { ...d.product, params: { ...d.product.params, ...patch } } }
    : d;
