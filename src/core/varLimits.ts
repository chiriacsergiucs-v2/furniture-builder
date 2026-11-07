/**
 * Limits of variables and bindings (ADR-166), shared by project variables (`variables.ts`) and a piece's own
 * variables (ADR-210, validated in `design.ts`). No imports, so `design.ts` can read them without an import cycle.
 */
export const MAX_VARIABLE_NAME = 60;
export const MAX_EXPR = 200;
export const MAX_VARIABLES = 100;
export const SPLIT_TARGET = /^split:([^:]+):(\d+)$/;
export const NAME_RE = /^[\p{L}][\p{L}\p{N} _]*$/u;
/** What a piece's own binding may drive (ADR-210): its sizes and divisions, never a position. */
const DESIGN_TARGETS = ['width', 'height', 'depth', 'mountHeight'] as const;
export const isDesignTarget = (s: unknown): s is string =>
  typeof s === 'string' &&
  ((DESIGN_TARGETS as readonly string[]).includes(s) || SPLIT_TARGET.test(s));
