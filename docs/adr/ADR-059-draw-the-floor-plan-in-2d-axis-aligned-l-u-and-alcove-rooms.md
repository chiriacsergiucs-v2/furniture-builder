# ADR-059: Draw the floor plan in 2D: rooms made of axis-aligned wall runs (L, U and alcove shapes)

- Status: Pending
- Date: 2026-10-24
- Decided by: user, 2026-10-24: "create the ADRs … auto-accept the recommended suggestion" (answers below)
- Depends on: ADR-058
- Design: docs/ui-design.md (project panel → Room; Plan view)
- Backlog: N56

## Context

Research feature _Construct the floor plan in 2D_ (value 3.5, P0 by parent; HomeByMe, IKEA PAX room-modelling
complaints). ADR-058 gives a rectangular room. Real kitchens and bedrooms often have an L shape, a chimney breast or
an alcove; users need to draw that outline on the plan, not type a rectangle.

## Decision

- **Room outline** = a closed list of corner points in whole mm where every wall is parallel to x or z
  (`room.outline: [x, z][]`, optional; absent = ADR-058's rectangle). Walls carry ids so ADR-058 features attach to
  a wall id instead of `'back' | 'left' | …`.
- **Drawing on the plan:** Project → Room → **Draw the room**: tap corners on the plan; each new wall snaps to
  horizontal or vertical and to whole 10 mm; _Close_ joins the last corner to the first. Every wall length is then
  editable as a mm field (the list of walls with lengths), so precise numbers always win.
- **Templates:** _Rectangle_, _L-shape_, _U-shape_, _Alcove_ fill the outline from four to six lengths.
- **Checks:** ADR-058's `outside-room` uses the outline (a piece must lie inside it). A self-crossing or open outline
  is an error on the room ("walls cross at …") and room checks are skipped until fixed (ADR-008).
- Each wall edit is one undo step (ADR-051).

## Alternatives considered

- **Free-angle walls** — break ADR-004; angled walls stay out until a shaped-wall ADR.
- **Import a floor-plan image to trace** — useful later; tracing still needs this outline model first.

## Scope

- In scope: ready shapes, wall lengths, drawing corners on the plan.
- Out of scope: angled walls, tracing a picture of a plan.

## Consequences

- Pieces still stand against walls by their numbers; snapping a piece to a wall is not part of this ADR.

## Done when

- [ ] Unit tests: L-shape outline from lengths; point-in-outline for pieces; self-crossing outline → room error; walls stay axis-aligned after any edit.
- [ ] Find-it at 1440 and 375 px: project → **Room** → **L-shape** → the plan shows six walls with lengths; a piece in the cut-out corner shows **outside the room**.
- [ ] Find-it test passes from the bare app at phone and desktop widths (`tools/ensemble/find-it-adrs.mjs`)

## Answers

1. _Allow angled walls?_ — **No; walls parallel to x or z only.**
2. _Draw by tapping or by typing lengths?_ — **Both: tap to sketch, every length editable as mm.**
3. _Snap step while drawing?_ — **10 mm (lengths can be typed to 1 mm).**
4. _Offer ready shapes?_ — **Yes: Rectangle, L, U, Alcove.**

## Implementation notes

`shapeOutline` (Rectangle, L, U, Alcove; the room remembers its ready shape), `setWallLength` **stretches** the room (every corner beyond the wall's end moves), so walls always close square; `snapCorner` (10 mm, along x or z; within 50 mm of the first corner's line it lands on it, found by the find-it run), `closeOutline`; store `startDrawRoom`/`addRoomCorner`/`finishDrawRoom` (one undo step); banner **Tap the corners of the room** with _Close the room_. Tests: `tests/room.test.ts`. find-it `tools/ensemble/find-it-adrs.mjs` (production build, bare app, visible text, 1440 and 375 px): 60/60: L-shape six walls; drawn room four walls.
