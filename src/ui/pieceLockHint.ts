import {
  BOARDS_LOCKED_HINT,
  CONSTRUCTION_LOCKED_HINT,
  isBoardsLocked,
  isConstructionLocked,
} from '../core/pieceLocks';
import { useDesign } from '../store/designStore';

/**
 * The hint of the open project piece's board or construction lock (ADR-211), for the Boards and Construction groups;
 * null when that part is free or no project piece is open. A string or null, so the selector stays stable.
 */
export function usePieceLockHint(what: 'boards' | 'construction'): string | null {
  return useDesign((s) => {
    const id = s.editingItemId ?? s.drillItemId;
    const it = id ? s.project?.items.find((i) => i.id === id) : undefined;
    if (what === 'boards') return isBoardsLocked(it) ? BOARDS_LOCKED_HINT : null;
    return isConstructionLocked(it) ? CONSTRUCTION_LOCKED_HINT : null;
  });
}
