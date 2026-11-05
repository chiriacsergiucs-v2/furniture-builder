/** Types for tests (ADR-172); the converter itself is plain JavaScript. */
import type { SellerCatalog } from '../../src/core/sellers/types';

export function convert(
  data: unknown,
  thumbs?: Record<string, string> | null,
  previous?: SellerCatalog | null,
): SellerCatalog;
