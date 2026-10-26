import { useEffect } from 'react';
import { Icon } from './icons';
import { AddPieceList } from './Project';
import { endPieceDrag, pieceDragActive, usePieceList } from './pieceDrag';

/** The list panel or sheet; rendered only while open. */
export function PieceList({ onBrowse }: { onBrowse?: () => void }) {
  const open = usePieceList((s) => s.open);
  const dragging = usePieceList((s) => !!s.drag);
  const setOpen = usePieceList((s) => s.setOpen);
  useEffect(() => {
    if (!open) return;
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !pieceDragActive() && !e.defaultPrevented) setOpen(false);
    };
    window.addEventListener('keydown', onEsc);
    return () => window.removeEventListener('keydown', onEsc);
  }, [open, setOpen]);
  useEffect(() => () => endPieceDrag(), []);
  if (!open) return null;
  return (
    <dialog open className={`piece-list ${dragging ? 'folded' : ''}`} aria-label="Add a piece">
      <header>
        <h2>Add a piece</h2>
        <button
          type="button"
          className="btn icon ghost sm close"
          onClick={() => setOpen(false)}
          aria-label="Close"
        >
          <Icon name="x" />
        </button>
      </header>
      <div className="piece-list-body">
        <p className="hint">
          Drag an item onto the plan (on a phone, hold it first), or tap it and then tap the plan.
        </p>
        <AddPieceList onDone={() => setOpen(false)} onBrowse={onBrowse} drag />
      </div>
    </dialog>
  );
}
