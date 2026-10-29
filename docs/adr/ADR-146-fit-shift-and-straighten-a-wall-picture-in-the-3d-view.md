# ADR-146: Fit, shift and straighten a wall picture in the 3D view

- Status: Deferred (open questions G-283 to G-286)
- Date: 2026-10-29
- Depends on: ADR-093, ADR-145
- Design: docs/ui-design.md (room editor in the project Settings; 3D view toolbar)
- Backlog: N147
- Acceptance: browser

## Context

User 2026-10-29: "add an ADR to be able to stretch or shift the 3D background across the wall, also the perspective
part, so I can wrap it correctly." Answers the same day: perspective = **straighten an angled photo** (handles on
the wall's corners in the photo); wrap = **fill one wall exactly**; stretch and shift = **drag on the wall in 3D**.

Today a wall picture ([ADR-145](../adr-done/ADR-145-set-a-colour-or-picture-as-the-background-of-each-room-wall.md))
only repeats: one copy covers _Tile width_ × _Tile height_ mm, anchored at the floor and the room origin. It cannot be
moved, cannot cover the wall once, and a photo of a real wall taken at an angle stays skewed.

Change control: [ADR-014](../adr-done/ADR-014-the-front-elevation-is-the-editing-surface-3d-is-a-non-autho.md) says
the 3D view "selects the owning space on click, but never edits geometry";
[ADR-093](../adr-done/ADR-093-move-and-turn-project-pieces-in-the-3d-view.md) made one exception (Move mode). The user
chose dragging in 3D, so this ADR adds a second exception: adjusting a wall picture. Pieces are still not edited there.

## Decision

1. **Model (ADR-011).** `WallImage` gets two optional fields; absent = today's repeating picture.
   - `fit?: { x: Mm; y: Mm; w: Mm; h: Mm }` — the picture covers this rectangle of the wall once, no repeat: `x` from
     the wall's left end as seen from inside the room, `y` up from the floor, whole mm, `w`, `h` ≥ 1. It may reach
     past the wall (shifted or larger); the wall shows only its own area. Outside the picture the wall shows the
     picture's average colour.
   - `straighten?: [Pt, Pt, Pt, Pt]` — the wall's corners in the photo (bottom-left, bottom-right, top-right,
     top-left), in ten-thousandths of the photo's width and height (integers 0–10000). That quadrilateral of the photo
     is mapped onto the `fit` rectangle by a projective (perspective) transform.
   - Project `schemaVersion` 15; versions 1–14 still load unchanged. `validateProject` reports a bad entry (size < 1,
     corner out of 0–10000, crossed or collinear corners) as a problem, never throws.
2. **Core (ADR-004).** `src/core` gets the pure maths: the homography from the four corners, and the picture
   coordinates of a wall point. The viewer only turns a pointer into a wall point (mm) and calls core.
3. **Adjust in 3D.** An _Adjust wall picture_ button in the 3D toolbar of a project with a wall picture, beside _Move_
   (only one of the two is on). While on: tapping a wall with a picture selects it and shows the picture's outline
   with four corner handles and four side handles. Dragging inside shifts it; dragging a handle stretches it;
   dragging empty space still orbits. A label shows "From left … · From floor … · W … × H …" in mm. One undo step
   per drag (ADR-051). Esc or a second finger cancels the drag. _Fill wall_ sets the rectangle to the whole wall
   (0, 0, wall length, room height). The pointer is projected onto the wall plane; values are whole mm.
4. **Straighten.** _Straighten photo_ (room editor, under the wall's picture, and in Adjust mode) opens the photo
   with four handles to drag onto the wall's corners in it (placement: G-283). _Reset_ removes the straightening.
5. **Room editor.** Under a wall picture, read-only "Fits From left … · From floor … · W … × H …" and a _Repeat_
   choice (behaviour: G-284); the tile fields stay for repeating pictures.

## Alternatives considered

- **Fields only (offsets and sizes in the room editor)** — precise and no ADR-014 exception, but the user chose
  dragging in 3D.
- **Warp the picture once on a canvas and save the result** — simpler rendering, but a second stored picture per wall
  and the straightening could not be changed later.
- **One picture wrapped across wall corners** — not what the user picked ("fill one wall exactly").

## Scope

- In scope: fit rectangle, shift and stretch by dragging in 3D, _Fill wall_, four-corner straightening, saved in the
  project and project files.
- Out of scope: lens (barrel) distortion (G-287); dragging the picture in the 2D front view (G-288); floor, 2D plan,
  SVG and cut sheets (G-273, G-274).

## Consequences

- Positive: a photo of the real wall lands on the wall the right size, in the right place, without the camera angle.
- Negative / risks: a second 3D editing exception; drag precision on a phone is coarse (whole mm, label shows values).
- Harder to change later: `fit`, `straighten` and project schemaVersion 15.

## Done when

- [ ] A project with `fit` and `straighten` round-trips through save, export and import; versions 1–14 load; bad
      entries give a validation problem, not an exception (tests)
- [ ] The homography maps the four corners exactly onto the rectangle corners, and the centre consistently (tests)
- [ ] Find-it (browser, 390 and 1280 px): 3D › _Adjust wall picture_ › tap Wall 1 › drag inside moves the picture
      (the label changes "From left"); a corner handle changes "W … × H …"; one Undo restores it
- [ ] Find-it: _Fill wall_ shows "From left 0 · From floor 0" and the wall length × room height
- [ ] Find-it: _Straighten photo_ › drag the four handles › the picture on the wall in 3D changes; _Reset_ restores it
- [ ] Find-it: with _Adjust wall picture_ off, tapping and dragging in 3D behave as before (orbit, select, Move)
- [ ] `pnpm docs:check` and every CI check pass

## Open questions

- **G-283** Where the wall's corners are marked in the photo: A, a _Straighten photo_ dialog over the whole photo
  (suggested: what you described, and the parts beyond the wall stay visible); B, dragging each picture corner on the
  wall in 3D (~+20 % work, estimate).
- **G-284** Repeat: A, new pictures start repeating (today), _Fill wall_ switches; B, new pictures start filling the
  wall, _Repeat_ still available (suggested: closest to "fill one wall exactly"); C, drop repeating.
- **G-285** Front view: A, it draws the same fitted, straightened picture (suggested, ~+15 % work, estimate); B, it
  keeps repeating tiles.
- **G-286** Dragging: snap edges to the wall ends, floor and ceiling, off with _Snap_ and Alt (suggested, ADR-070) or
  no snap; stretch free (suggested: "stretch"), proportions kept, or free with Shift keeping them.
