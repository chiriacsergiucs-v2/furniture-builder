/**
 * Saved-data changes on this device, for the work that follows a save: the folder backup (ADR-133) and, when signed
 * in, the upload to the account (ADR-137). Fired by the write functions themselves (`savedRows` in `src/persist/db.ts`,
 * ADR-235) after any row of a user table is created, changed or deleted. Listeners run after the current task, never
 * inside the transaction.
 */
interface SavedChange {
  table: string;
  key: string;
  deleted: boolean;
}
type Listener = (c: SavedChange) => void;
const listeners = new Set<Listener>();

export function onSavedChange(l: Listener): () => void {
  listeners.add(l);
  return () => listeners.delete(l);
}

/** Rows changed since the folder backup last took them (ADR-235), by table: the next backup reads only these. */
const dirty = new Map<string, Set<string>>();

/** The changed rows so far, by table; the set starts empty again. */
export function takeDirty(): Map<string, Set<string>> {
  const out = new Map(dirty);
  dirty.clear();
  return out;
}

export function emitSavedChange(c: SavedChange): void {
  let keys = dirty.get(c.table);
  if (!keys) dirty.set(c.table, (keys = new Set()));
  keys.add(c.key);
  if (!listeners.size) return;
  setTimeout(() => {
    for (const l of listeners) {
      try {
        l(c);
      } catch {
        /* a listener's failure never reaches the save */
      }
    }
  }, 0);
}
