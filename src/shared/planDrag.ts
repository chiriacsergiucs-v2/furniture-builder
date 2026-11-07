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

// ── Turning with the handle (ADR-169) ───────────────────────────────────────────────────────────────────────────

/** Degrees the pointer stays within of a quarter turn to snap to it; Shift steps instead. */
export const TURN_SNAP_DEG = 5;
export const TURN_SHIFT_STEP = 15;

export interface TurnGesture {
  id: string;
  pointerId: number;
  /** The piece's centre on the plan, mm. */
  cx: number;
  cz: number;
  /** The piece's whole turn at press, 0–359. */
  start: number;
  /** The pointer's angle about the centre at press, degrees (counter-clockwise positive, as the piece turns). */
  from: number;
  /** The turn the piece would take now, 0–359 whole degrees. */
  angle: number;
  /** True once the pointer moved: a tap on the handle turns nothing. */
  moved: boolean;
  /** Esc was pressed: the piece keeps its angle and the release turns nothing (the gesture ends on release). */
  cancelled?: boolean;
}

/** The pointer's angle about the centre, degrees 0–360, counter-clockwise positive (the plan draws z downward). */
export function pointerDeg(cx: number, cz: number, x: number, z: number): number {
  const d = (Math.atan2(-(z - cz), x - cx) * 180) / Math.PI;
  return ((d % 360) + 360) % 360;
}

/**
 * The turn for a pointer at `now` degrees from a press at `from`, starting from `start`: whole degrees 0–359; within
 * `TURN_SNAP_DEG` of a quarter turn it snaps to it; with Shift it steps by `TURN_SHIFT_STEP`.
 */
export function turnAngle(start: number, from: number, now: number, shift: boolean): number {
  const raw = (((start + (now - from)) % 360) + 360) % 360;
  if (shift) return (Math.round(raw / TURN_SHIFT_STEP) * TURN_SHIFT_STEP) % 360;
  const q = Math.round(raw / 90) * 90;
  const off = Math.abs(raw - q);
  if (Math.min(off, 360 - off) <= TURN_SNAP_DEG) return q % 360;
  return Math.round(raw) % 360;
}

/** The handle is pressed. A press the plan cannot map starts nothing. */
export function pressTurn(
  id: string,
  centre: { x: number; z: number },
  start: number,
  p: PointerAt,
): TurnGesture | null {
  if (!p.room) return null;
  return {
    id,
    pointerId: p.pointerId,
    cx: centre.x,
    cz: centre.z,
    start,
    from: pointerDeg(centre.x, centre.z, p.room.x, p.room.z),
    angle: start,
    moved: false,
  };
}

/** The pressing pointer moves; other pointers are ignored. */
export function moveTurn(g: TurnGesture | null, p: PointerAt, shift: boolean): TurnGesture | null {
  if (!g || g.cancelled || p.pointerId !== g.pointerId || !p.room) return g;
  const angle = turnAngle(g.start, g.from, pointerDeg(g.cx, g.cz, p.room.x, p.room.z), shift);
  return angle === g.angle && g.moved ? g : { ...g, angle, moved: true };
}

/** The pointer is released: the angle to set, or null when nothing changed. */
export function releaseTurn(g: TurnGesture | null, pointerId: number): number | null {
  if (!g || g.cancelled || pointerId !== g.pointerId || !g.moved || g.angle === g.start)
    return null;
  return g.angle;
}

/** Esc during a turn: back to the angle at press; the gesture stays until the pointer is released. */
export function cancelTurn(g: TurnGesture | null): TurnGesture | null {
  return g ? { ...g, angle: g.start, cancelled: true } : null;
}

/**
 * Esc during a press (ADR-065) or a turn (ADR-169): the gesture is dropped, and the click the browser fires when the
 * pointer is released must not select or open the piece. True when there was a gesture to cancel.
 */
export function cancelPress(g: DragGesture | TurnGesture | null): boolean {
  return !!g;
}

/** The [ and ] keys turn the focused piece by 1°, with Shift by 15° (ADR-169). Null for any other key. */
export function bracketTurn(key: string, shift: boolean): number | null {
  const d = shift ? TURN_SHIFT_STEP : 1;
  return key === ']' ? d : key === '[' ? -d : null;
}

/** The footprint corners turned by `deg` (counter-clockwise, as the piece turns) about the centre, whole mm. */
export function turnedFootprint(
  corners: readonly (readonly [number, number])[],
  cx: number,
  cz: number,
  deg: number,
): [number, number][] {
  const r = (deg * Math.PI) / 180;
  const c = Math.cos(r),
    s = Math.sin(r);
  return corners.map(([x, z]) => {
    const dx = x - cx,
      dz = z - cz;
    return [Math.round(cx + dx * c + dz * s), Math.round(cz - dx * s + dz * c)];
  });
}
