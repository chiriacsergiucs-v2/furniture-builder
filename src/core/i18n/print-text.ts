/**
 * Print text (ADR-157). Key: the Romanian text (ADR-020); `PRINT_RU` and `PRINT_EN` give it in Russian and English.
 * `PRINT_EN` has the same keys as `PRINT_RU`, so a Romanian text without both fails the type check.
 */
export const PRINT_RU = {} satisfies Record<string, string>;

export const PRINT_EN: Record<keyof typeof PRINT_RU, string> = {};
