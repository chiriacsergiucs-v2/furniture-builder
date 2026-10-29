/**
 * Saved-data changes on this device, for the work that follows a save: the folder backup (ADR-133) and, when signed
 * in, the upload to the account (ADR-137). Fired by Dexie table hooks (`src/persist/db.ts`) after any row of a
 * user table is created, changed or deleted. Listeners run after the current task, never inside the transaction.
 */
export interface SavedChange {
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

export function emitSavedChange(c: SavedChange): void {
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
