/** Guards for untrusted input (imported files, storage). Leaf module: imports nothing. */

/** A plain object: not null, not an array. */
export const isObj = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === 'object' && !Array.isArray(v);

/** A safe integer from `min` to `max` (defaults: -1e7 to 1e7). */
export const isInt = (v: unknown, min = -1e7, max = 1e7) =>
  typeof v === 'number' && Number.isSafeInteger(v) && v >= min && v <= max;
