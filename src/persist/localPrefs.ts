/**
 * Device preferences kept in localStorage (ADR-002: on this device only, no telemetry). Storage can be blocked (a
 * private window, a browser that keeps nothing): reads then give the caller's `blocked` value and writes report
 * false, so a choice lasts for this visit only (reuse health check M8, G-570). Keys are the callers' own, unchanged.
 */

/** The stored value for `key` run through `parse` (null when unset); `blocked` when storage or `parse` throws. */
export function readLocal<T>(key: string, parse: (v: string | null) => T, blocked: T): T {
  try {
    return parse(localStorage.getItem(key));
  } catch {
    return blocked;
  }
}

/** Keep `value` under `key`, or remove the key for null. False when storage refused it. */
export function writeLocal(key: string, value: string | null): boolean {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}
