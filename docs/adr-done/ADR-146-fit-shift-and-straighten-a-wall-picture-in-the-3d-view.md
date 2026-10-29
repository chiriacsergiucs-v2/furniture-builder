# ADR-146: Fit, shift and straighten a wall picture in the 3D view

- Status: Implemented
- Date: 2026-10-29
- Implemented: 2026-10-29 (Built on the user's answers of 2026-10-29; tests and browser find-it before shipping)
- Depends on: ADR-093, ADR-145
- Design: docs/ui-design.md (room editor in the project Settings; 3D view toolbar)
- Backlog: N147
- Acceptance: browser
- Agreed: 2026-10-29, answers to G-283 to G-286 and the old-pictures question

## Context

User 2026-10-29: "add an ADR to be able to stretch or shift the 3D background across the wall, also the perspective
part, so I can wrap it correctly." Answers the same day: perspective = **straighten an angled photo** (handles on
the wall's corners in the photo); wrap = **fill one wall exactly**; stretch and shift = **drag on the wall in 3D**.

Today a wall picture ([ADR-145](../adr-done/ADR-145-set-a-colour-or-picture-as-the-background-of-each-room-wall.md))
only repeats from the floor and the room origin; it cannot be moved, and a photo taken at an angle stays skewed.

Answers 2026-10-29: G-283 a _Straighten photo_ dialog over the whole photo; G-284 **drop repeating**; G-285 the
front view shows the same fitted, straightened picture; G-286 edges snap to the wall ends, floor and ceiling, stretch is
free. Pictures saved before (repeating tiles) **fill their wall**.

Change control: [ADR-014](../adr-done/ADR-014-the-front-elevation-is-the-editing-surface-3d-is-a-non-autho.md) says
the 3D view "selects the owning space on click, but never edits geometry";
[ADR-093](../adr-done/ADR-093-move-and-turn-project-pieces-in-the-3d-view.md) made one exception (Move mode). The user
chose dragging in 3D, so this ADR adds a third exception: adjusting a wall picture. Pieces are still not edited there.
ADR-145's "A picture repeats" is replaced: a picture covers one rectangle of its wall once.

## Decision

1. **Model (ADR-011).** `WallImage` changes; project `schemaVersion` 15, versions 1–14 still load.
   - `fit?: { x: Mm; y: Mm; w: Mm; h: Mm }` — the picture covers this rectangle of the wall once: `x` from the wall's
     left end as seen from inside the room, `y` up from the floor, whole mm, `w`, `h` ≥ 1. Absent = the whole wall
     (wall length × room height). It may reach past the wall; the wall shows only its own area, and the picture's
     average colour outside the picture.
   - `straighten?: [Pt, Pt, Pt, Pt]` — the wall's corners in the photo (bottom-left, bottom-right, top-right,
     top-left), in ten-thousandths of the photo's width and height (integers 0–10000). That quadrilateral is mapped
     onto the `fit` rectangle by a projective (perspective) transform.
   - `tileWidth`, `tileHeight` become optional and unused: kept as read in old files, never written for new
     pictures. An old picture therefore fills its wall. Nothing in a saved file is rewritten on load.
   - `validateProject` reports a bad entry (size < 1, corner out of 0–10000, crossed or collinear corners) as a
     problem, never throws.
2. **Core (ADR-004).** `src/core/wallPicture.ts`: the homography from the four corners, the picture coordinates of a
   wall point, the fitted rectangle, and snapping a dragged rectangle to the wall ends, floor and ceiling
   (`SNAP_RANGE`, ADR-070). The viewer only turns a pointer into a wall point (mm) and calls core.
3. **Adjust in 3D.** An _Adjust wall picture_ button in the 3D toolbar of a project with a wall picture, beside _Move_
   (only one of the two is on). While on: tapping a wall with a picture selects it and shows the picture's outline
   with four corner handles and four side handles. Dragging inside shifts it; dragging a handle stretches it freely;
   dragging empty space still orbits. Edges snap to the wall ends, floor and ceiling; the _Snap_ toggle off or Alt
   held turns snapping off. A label shows "From left … · From floor … · W … × H …" in mm. One undo step per drag
   (ADR-051). Esc or a second finger cancels the drag. _Fill wall_ resets the rectangle to the whole wall.
4. **Straighten.** _Straighten photo_ (room editor, under the wall's picture) opens the whole photo with four
   handles to drag onto the wall's corners in it; _Apply_ saves them, _Reset_ removes the straightening.
5. **Room editor.** Under a wall picture: "From left … · From floor … · W … × H …", _Fill wall_ and _Straighten
   photo_. The tile fields go.
6. **Front view.** The wall behind a piece (ADR-145) draws the same fitted, straightened picture.

## Alternatives considered

- **Fields only (offsets and sizes in the room editor)** — no ADR-014 exception, but the user chose dragging in 3D.
- **Keep repeating as a choice** — the user chose to drop it (G-284).
- **Warp the picture once and save the result** — a second stored picture; straightening could not change later.

## Scope

- In scope: fit rectangle, shift and stretch by dragging in 3D with snapping, _Fill wall_, four-corner
  straightening, the same picture in the front view, saved in the project and project files.
- Out of scope: lens (barrel) distortion (G-287); dragging the picture in the 2D front view (G-288); floor, 2D plan,
  SVG and cut sheets (G-273, G-274).

## Consequences

- Positive: a photo of the real wall lands on the wall the right size, in the right place, without the camera angle.
- Negative / risks: another 3D editing exception; tiled backgrounds need a pre-tiled picture.
- Harder to change later: `fit`, `straighten` and project schemaVersion 15.

## Done when

- [x] A project with `fit` and `straighten` round-trips through save, export and import; versions 1–14 load and old
      pictures fill their wall; bad entries give a validation problem, not an exception (tests)
- [x] The homography maps the four corners exactly onto the rectangle corners; dragged edges snap to the wall ends,
      floor and ceiling within `SNAP_RANGE` and not with snapping off (tests)
- [x] Find-it (browser, 390 and 1280 px): 3D › _Adjust wall picture_ › tap Wall 1 › dragging inside changes "From
      left"; a corner handle changes "W … × H …"; one Undo restores it
- [x] Find-it: _Fill wall_ shows "From left 0 · From floor 0" and the wall length × room height
- [x] Find-it: _Straighten photo_ › drag a handle › _Apply_ changes the picture on the wall in 3D; _Reset_ restores it
- [x] Find-it: the front view behind a piece shows the fitted picture; with _Adjust wall picture_ off, 3D taps and
      drags behave as before
- [x] `pnpm docs:check` and every CI check pass

## Open questions

None. All answered 2026-10-29 (Context).
