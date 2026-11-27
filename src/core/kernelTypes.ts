/**
 * Kernel types (G-548, ADR-306): the units and shapes every domain names. Pure data: no React, no storage, no three.js.
 *
 * Coordinate system (millimetres, integers):
 *   x → width, left to right
 *   y → height, floor (0) upwards
 *   z → depth, back (0) towards the viewer/front
 */

/** Integer millimetres. Enforced at runtime by `assertMm` / design validation. */
export type Mm = number;

export type Axis = 'x' | 'y' | 'z';

/** Axis-aligned box: minimum corner + size. Every panel is one of these. */
export interface Box {
  x: Mm;
  y: Mm;
  z: Mm;
  w: Mm;
  h: Mm;
  d: Mm;
  /**
   * A project piece typed at an angle (ADR-121): the box is turned `deg` whole degrees about the vertical line
   * through (cx, cz), the same way as a quarter turn (90 turns +z towards +x). Only placed panels, clearances and
   * envelopes of an angled piece carry it; a piece's own model never does. Absent = axis-aligned.
   */
  yaw?: Yaw;
}

/** A turn about a vertical line (ADR-121): whole degrees 1–89, the line at room (cx, cz) in mm (may be .5). */
export interface Yaw {
  deg: number;
  cx: number;
  cz: number;
}

/** A face direction, used to name banded edges of a panel in world terms. */
export type Face = '-x' | '+x' | '-y' | '+y' | '-z' | '+z';
