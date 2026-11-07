# ADR-214: Place AR furniture by a corner or into a room corner

- Status: Implemented
- Date: 2026-11-07
- Implemented: 2026-11-07
- Depends on: ADR-208, ADR-213
- Design: docs/ui-design.md (3D view, AR overlay)
- Backlog: N219
- Acceptance: browser

## Context

User, 2026-11-07: "Enhance ar corners/floating/accuracy". Answers to the questions asked the same day:

- Corners: "Preview footprint corners", "Snap into a room corner", "Place by a corner, not centre".
- Corner snap: "Two floor taps".
- Ring point: "Switch button" (Centre → Back-left → Back-right).

Today ([ADR-208](../adr-done/ADR-208-room-surfaces-plan-tracing-placed-3d-models-and-ar.md)) the ring marks the
content's floor centre and the front turns to the phone; nothing lines up with a wall.

## Decision

1. **Footprint preview.** While placing, the ring is replaced by the content's real footprint on the floor: a
   rectangle outline of its width × depth with a mark at each of the 4 corners and a thicker front edge. The chosen
   point (below) is marked with a dot. It moves with the floor hit and faces the phone, as placing will.
2. **Point switch.** A "Point: Centre" button cycles Centre → Back-left → Back-right (left and right as seen from the
   front). The hit puts that point of the footprint on the floor spot; the front still faces the phone.
3. **Room corner (two floor taps).** A "Room corner" button starts corner mode:
   - Hint 1: "Tap the floor in the room corner." The first tap fixes the corner spot.
   - Hint 2: "Tap the floor along the wall the back goes against." The second tap gives the wall direction.
   - The back goes along the line corner → second tap, the front toward the phone's side of that line. If the
     wall runs to the right as seen from the room, the back-left corner sits in the room corner; otherwise the
     back-right. "Cancel corner" returns to normal placing.
4. Both taps use the floor-only, stable hits of ADR-213 and the placed content keeps its anchor.

## Alternatives considered

- **Detect walls automatically** — plain walls are often not detected; recorded as G-477.
- **Fixed back-left point** — needs Turn for a right-hand corner; the user chose the switch.

## Scope

- In scope: footprint preview, point switch, two-tap room corner, their hints and buttons, Russian text.
- Out of scope: automatic wall detection (G-477); a gap from the walls for skirting boards (G-478); real-phone
  check (G-482).

## Consequences

- Positive: furniture can be put exactly where it will stand, flush in a corner.
- Negative / risks: the corner is as accurate as the user's taps and the phone's floor; walls that are not square
  show as a gap on one side.
- Harder to change later: nothing.

## Done when

- [x] The footprint preview has the content's width × depth and its chosen point on the hit (unit test)
- [x] Point switch cycles Centre → Back-left → Back-right and the placed content puts that point on the hit (unit test)
- [x] Two taps place the back along the tapped wall line with the right corner in the room corner, for a wall
      running either way (unit test)
- [x] Cancel corner returns to normal placing (unit test)
- [x] Browser find-it at 390 and 1280 px finds "Point: Centre", "Room corner" and both corner hints
