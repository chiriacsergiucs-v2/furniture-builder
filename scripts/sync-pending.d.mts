/** Types for tests; the script itself is plain JavaScript (scripts/sync-pending.mjs). */
import type { Feature, FeatureDomain } from '../src/ui/info/features';

export const EXEMPT: string[];
export function implementedDates(repo?: string): Record<string, string>;
export function featureLines(
  domains: FeatureDomain[],
  path?: string[],
): { path: string; feature: Feature }[];
export function openGaps(text: string): number;
export function pendingAdrs(repo?: string): Set<string>;
export function pending(
  domains: FeatureDomain[],
  implemented: Record<string, string>,
  exempt?: string[],
  inProgress?: Set<string>,
): { unchecked: string[]; stale: string[]; unknown: string[]; uncited: string[] };
