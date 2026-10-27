import { useEffect, useRef } from 'react';
import { InfoTip } from './controls';
import { Icon } from './icons';
import { AddPieceList } from './Project';
import { endPieceDrag, pieceDragActive, usePieceList } from './pieceDrag';

/** The list panel or sheet; rendered only while open. */
export function PieceList({
  onBrowse,
  onWizard,
}: {
  onBrowse?: () => void;
  onWizard?: () => void;
}) {
  const open = usePieceList((s) => s.open);
  const dragging = usePieceList((s) => !!s.drag);
  const setOpen = usePieceList((s) => s.setOpen);
  const ref = useRef<HTMLDialogElement>(null);
  // Focus moves into the list when it opens and back to where it was (Add a piece) when it closes.
  useEffect(() => {
    if (!open) return;
    const back = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    ref.current?.focus({ preventScroll: true });
    return () => {
      if (back?.isConnected) back.focus({ preventScroll: true });
    };
  }, [open]);
  useEffect(() => () => endPieceDrag(), []);
  if (!open) return null;
  return (
    <dialog
      ref={ref}
      open
      tabIndex={-1}
      className={`piece-list ${dragging ? 'folded' : ''}`}
      aria-label="Add a piece"
      onKeyDown={(e) => {
        // Esc inside the list closes it; Esc during a drag only drops the drag (handled first, ADR-094).
        if (e.key === 'Escape' && !pieceDragActive() && !e.defaultPrevented) {
          e.preventDefault();
          setOpen(false);
        }
      }}
    >
      <header>
        <div className="info-row">
          <h2>Add a piece</h2>
          <InfoTip label="About adding a piece" align="start">
            Drag an item onto the plan (on a phone, hold it first), or tap it and then tap the plan.
          </InfoTip>
        </div>
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
        <AddPieceList onDone={() => setOpen(false)} onBrowse={onBrowse} onWizard={onWizard} drag />
      </div>
    </dialog>
  );
}
