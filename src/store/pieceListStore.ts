import { create } from 'zustand';
import type { PlacedPiece } from '../core/project';
import type { Design } from '../core/types';

/** A catalog item being dragged from the list. */
export interface NewPieceDrag {
  design: Design;
  libraryId?: string;
  /** The piece as it would be built (ADR-004): its footprint is the outline. */
  me: PlacedPiece;
  /** The room point under the pointer (on the plan or the 3D view's floor, ADR-303), or null while it is off both. */
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

/**
 * Screen point → room point on the 3D view's floor plane (ADR-303), registered by the 3D view while it is mounted in
 * a project and not exploded; null over anything else. The piece list's drag reads it when the plan has no point.
 */
type ViewHit = (clientX: number, clientY: number) => { x: number; z: number } | null;
let viewHit: ViewHit | null = null;
export function registerViewHit(f: ViewHit | null) {
  viewHit = f;
}
export const viewDropHit = (clientX: number, clientY: number) =>
  viewHit?.(clientX, clientY) ?? null;
