import { create } from 'zustand';
import type { PlacedPiece } from '../core/project';
import type { Design } from '../core/types';

/** A catalog item being dragged from the list. */
export interface NewPieceDrag {
  design: Design;
  libraryId?: string;
  /** The piece as it would be built (ADR-004): its footprint is the outline. */
  me: PlacedPiece;
  /** The room point under the pointer, or null while it is off the plan. */
  room: { x: number; z: number } | null;
  alt: boolean;
}

/** The piece list beside the plan (ADR-094): open or closed, and the catalog item being dragged from it. */
interface PieceListState {
  open: boolean;
  drag: NewPieceDrag | null;
  setOpen: (open: boolean) => void;
  setDrag: (drag: NewPieceDrag | null) => void;
}

export const usePieceList = create<PieceListState>((set) => ({
  open: false,
  drag: null,
  setOpen: (open) => set(open ? { open } : { open, drag: null }),
  setDrag: (drag) => set({ drag }),
}));
