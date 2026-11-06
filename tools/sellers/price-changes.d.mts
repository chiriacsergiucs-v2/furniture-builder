/** Types for tests (ADR-206); the summary itself is plain JavaScript. */
import type { SellerCatalog } from '../../src/core/sellers/types';

export const MAX_LINES: number;

export function priceChanges(
  previous: SellerCatalog | null,
  next: SellerCatalog | null,
  max?: number,
): string;
