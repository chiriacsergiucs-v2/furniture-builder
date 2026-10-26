import type { PointerEvent as ReactPointerEvent } from 'react';
import { create } from 'zustand';
import type { Design } from '../core/types';
import { makeItem, placeItem, type PlacedPiece } from '../core/project';
import { dropNewPiece } from '../core/snap';
import { useDesign } from '../store/designStore';
import { DRAG_THRESHOLD_PX } from './planDrag';
import { snapIsOn } from './useSnap';

/**
 * The piece list beside the plan (ADR-094): **Add a piece** in Compose opens it (closed by default) — a side panel
 * next to the plan on desktop, a bottom sheet on a phone. An item is dragged onto the plan (press and drag with a
 * mouse; long-press, 300 ms, on touch, which folds the sheet away) or tapped, which keeps ADR-056's "Tap the plan to
 * place". Pointer Events throughout; nothing is added until a release over the plan, and Esc drops the drag.
 */

/** How long a touch must rest on an item before it lifts into a drag (ADR-094). */
export const LONG_PRESS_MS = 300;

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

/** Screen point → plan room point; registered by the plan while it is on screen. */
type PlanHit = (clientX: number, clientY: number) => { x: number; z: number } | null;
let planHit: PlanHit | null = null;
export function registerPlanHit(f: PlanHit | null) {
  planHit = f;
}

/** Where the dragged piece lands with the plan's Snap toggle and Alt as they are (ADR-070). */
export function newPieceTarget(d: NewPieceDrag) {
  const { project, projectModel } = useDesign.getState();
  if (!d.room || !project || !projectModel) return null;
  return dropNewPiece(project, projectModel.pieces, d.me, d.room, snapIsOn() && !d.alt);
}

// One gesture at a time, kept outside React so window listeners see it between renders.
let pending: {
  pointerId: number;
  sx: number;
  sy: number;
  touch: boolean;
  make: () => { design: Design; libraryId?: string } | null;
  timer: number | null;
  begun: boolean;
} | null = null;
let clickAfterDrag = false;

/** True once after a drag ended, so the click that may follow it does not also tap-pick the item. */
export function consumeDragClick(): boolean {
  const was = clickAfterDrag;
  clickAfterDrag = false;
  return was;
}

/** Drop the gesture in progress, if any: nothing is added. */
export function endPieceDrag() {
  if (pending?.timer != null) window.clearTimeout(pending.timer);
  pending = null;
  window.removeEventListener('pointermove', onMove);
  window.removeEventListener('pointerup', onUp);
  window.removeEventListener('pointercancel', onCancel);
  window.removeEventListener('keydown', onKey, true);
  window.removeEventListener('keyup', onKey, true);
  document.removeEventListener('touchmove', onTouchMove);
  if (usePieceList.getState().drag) usePieceList.getState().setDrag(null);
}

function begin() {
  if (!pending || pending.begun) return;
  const made = pending.make();
  const project = useDesign.getState().project;
  if (!made || !project) return endPieceDrag();
  pending.begun = true;
  pending.timer = null;
  clickAfterDrag = true;
  const me = placeItem(makeItem(project, made.design, made.libraryId));
  usePieceList.getState().setDrag({ ...made, me, room: null, alt: false });
}

function onMove(e: PointerEvent) {
  if (!pending || e.pointerId !== pending.pointerId) return;
  if (!pending.begun) {
    if (Math.hypot(e.clientX - pending.sx, e.clientY - pending.sy) <= DRAG_THRESHOLD_PX) return;
    // A touch that moves before the long-press is a scroll of the list; a mouse press that moves is a drag.
    if (pending.touch) return endPieceDrag();
    begin();
  }
  const d = usePieceList.getState().drag;
  if (!d) return;
  const room = planHit?.(e.clientX, e.clientY) ?? null;
  // Unchanged: no new state, so the plan does not redraw and re-snap for nothing.
  if (room?.x === d.room?.x && room?.z === d.room?.z && e.altKey === d.alt) return;
  usePieceList.getState().setDrag({ ...d, room, alt: e.altKey });
}

function onUp(e: PointerEvent) {
  if (!pending || e.pointerId !== pending.pointerId) return;
  const d = usePieceList.getState().drag;
  // Only a drag that reached the plan drops: a long-press released where it started (the sheet folded away from
  // under the finger, so the plan may be there now) adds nothing.
  const room = d?.room ? (planHit?.(e.clientX, e.clientY) ?? null) : null;
  const t = d && room ? newPieceTarget({ ...d, room, alt: e.altKey }) : null;
  const touch = pending.touch;
  endPieceDrag();
  if (!d) return;
  // A click event may follow on the item; it must not tap-pick (the flag is read once, or cleared soon).
  window.setTimeout(() => (clickAfterDrag = false), 400);
  if (!t) return;
  useDesign.getState().addPieceAt(d.design, t.position.x, t.position.z, d.libraryId);
  // On a phone the folded sheet steps aside so the piece is seen; on a desktop the list stays for the next one.
  if (touch) usePieceList.getState().setOpen(false);
}

function onCancel(e: PointerEvent) {
  if (pending && e.pointerId === pending.pointerId) endPieceDrag();
}

function onKey(e: KeyboardEvent) {
  if (!pending?.begun) return;
  if (e.key === 'Escape' && e.type === 'keydown') {
    e.preventDefault();
    e.stopPropagation();
    endPieceDrag();
    return;
  }
  if (e.key === 'Alt') {
    e.preventDefault();
    const d = usePieceList.getState().drag;
    if (d) usePieceList.getState().setDrag({ ...d, alt: e.type === 'keydown' });
  }
}

/** While a touch drag is on, the page must not scroll under it (Chrome ignores touch-action set mid-gesture). */
function onTouchMove(e: TouchEvent) {
  if (pending?.begun && e.cancelable) e.preventDefault();
}

/** Pointer handlers that make a list item draggable onto the plan. `make` builds the item's design when it lifts. */
export function dragSource(make: () => { design: Design; libraryId?: string } | null) {
  return {
    onPointerDown: (e: ReactPointerEvent<HTMLElement>) => {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      if (pending) return endPieceDrag();
      const touch = e.pointerType !== 'mouse';
      // A mouse press must not start a text selection or the browser's own image drag; it still focuses the item.
      if (!touch) {
        e.preventDefault();
        e.currentTarget.focus({ preventScroll: true });
      }
      clickAfterDrag = false;
      pending = {
        pointerId: e.pointerId,
        sx: e.clientX,
        sy: e.clientY,
        touch,
        make,
        timer: touch ? window.setTimeout(begin, LONG_PRESS_MS) : null,
        begun: false,
      };
      window.addEventListener('pointermove', onMove);
      window.addEventListener('pointerup', onUp);
      window.addEventListener('pointercancel', onCancel);
      window.addEventListener('keydown', onKey, true);
      window.addEventListener('keyup', onKey, true);
      document.addEventListener('touchmove', onTouchMove, { passive: false });
    },
    // The long-press must lift the item, not open the browser's menu.
    onContextMenu: (e: { preventDefault: () => void }) => {
      if (pending) e.preventDefault();
    },
    onDragStart: (e: { preventDefault: () => void }) => e.preventDefault(),
  };
}

/** True while an item is pressed or dragged from the list. */
export const pieceDragActive = () => !!pending;
