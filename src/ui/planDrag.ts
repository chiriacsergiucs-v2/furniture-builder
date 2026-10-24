/**
 * The drag gesture on the project plan (ADR-065), kept free of React and the DOM so it can be unit-tested.
 * A press that moves more than `DRAG_THRESHOLD_PX` screen pixels is a drag; less than that is a tap. Nothing is
 * committed until the pointer is released; Esc, a second pointer or a cancelled pointer drop the gesture.
 */

/** Screen pixels a press must move before it counts as a drag. */
export const DRAG_THRESHOLD_PX = 4;

export interface DragGesture {
  /** The piece being pressed. */
  id: string;
  pointerId: number;
  /** Where the press started, in screen pixels and in plan mm. */
  sx: number;
  sy: number;
  x: number;
  z: number;
  /** True once the pointer has moved past the threshold. */
  dragging: boolean;
  /** The move so far in plan mm (unrounded to the step). */
  dx: number;
  dz: number;
}

export type DragEnd =
  { kind: 'tap'; id: string } | { kind: 'drop'; id: string; dx: number; dz: number };

export interface PointerAt {
  pointerId: number;
  /** Screen pixels. */
  sx: number;
  sy: number;
  /** Plan mm (x along the back wall, z away from it), or null when the plan cannot map the point. */
  room: { x: number; z: number } | null;
}

/**
 * A pointer goes down on a piece. While another pointer is already pressing, the second one cancels the gesture
 * (null); a press the plan cannot map starts nothing.
 */
export function pressPiece(g: DragGesture | null, id: string, p: PointerAt): DragGesture | null {
  if (g) return null;
  if (!p.room) return null;
  return {
    id,
    pointerId: p.pointerId,
    sx: p.sx,
    sy: p.sy,
    ...p.room,
    dragging: false,
    dx: 0,
    dz: 0,
  };
}

/** The pressing pointer moves; other pointers are ignored. */
export function movePointer(g: DragGesture | null, p: PointerAt): DragGesture | null {
  if (!g || p.pointerId !== g.pointerId || !p.room) return g;
  const dragging = g.dragging || Math.hypot(p.sx - g.sx, p.sy - g.sy) > DRAG_THRESHOLD_PX;
  return { ...g, dragging, dx: dragging ? p.room.x - g.x : 0, dz: dragging ? p.room.z - g.z : 0 };
}

/** The pressing pointer is released: a tap when it never passed the threshold, otherwise a drop. */
export function releasePointer(g: DragGesture | null, pointerId: number): DragEnd | null {
  if (!g || pointerId !== g.pointerId) return null;
  return g.dragging ? { kind: 'drop', id: g.id, dx: g.dx, dz: g.dz } : { kind: 'tap', id: g.id };
}

/**
 * The move an arrow key makes on a focused piece: 10 mm, 100 mm with Shift. Up is toward the back wall
 * (z decreases), as the plan is drawn. Null for any other key.
 */
export function arrowMove(key: string, shift: boolean): { dx: number; dz: number } | null {
  const d = shift ? 100 : 10;
  switch (key) {
    case 'ArrowLeft':
      return { dx: -d, dz: 0 };
    case 'ArrowRight':
      return { dx: d, dz: 0 };
    case 'ArrowUp':
      return { dx: 0, dz: -d };
    case 'ArrowDown':
      return { dx: 0, dz: d };
    default:
      return null;
  }
}
