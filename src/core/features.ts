/**
 * What the app can do, as a tree of domains (ADR-158), for the Information and guides page. Written by hand from the
 * implemented ADRs; a feature built later adds its line here (CLAUDE.md). Texts are keys of the dictionary (ADR-153).
 */
import type { Key } from './i18n';

export interface Feature {
  /** What the user can do, in a few words. */
  name: Key;
  /** One sentence more, optional. */
  detail?: Key;
  /** The ADRs that built it. */
  adrs: string[];
}
export interface FeatureDomain {
  name: Key;
  features?: Feature[];
  /** Sub-domains, one level deep. */
  children?: FeatureDomain[];
}

export const FEATURES: FeatureDomain[] = [];
