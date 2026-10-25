# ADR-084: Show the count stepper over the 3D view too

- Status: Pending
- Date: 2026-10-25
- Depends on: ADR-014, ADR-083
- Design: docs/ui-design.md (§3 Components and states)
- Backlog: N79

## Context

[ADR-083](ADR-083-change-counts-with-a-plus-minus-stepper-above-the-selected-s.md) puts a `− N +` card right above
the selected space in the front drawing. Asked whether the card should also show over the 3D view, the user answered
(2026-10-25): "Yes - create new", then "Write and build both", with the placement "INside the rendered view
container!".

This changes [ADR-014](../adr-done/ADR-014-the-front-elevation-is-the-editing-surface-3d-is-a-non-autho.md), which says
the 3D viewer only selects and never edits. ADR-014 is implemented and stays as it is; this ADR adds one exception:
the quick-count card may sit over the 3D view and change counts. The viewer's own scene (meshes, clicks, camera)
still only selects.

## Decision

- The same `CountStepper` card shows over the 3D view of a single piece (Build & Preview, View › 3D or Both),
  for the space selected by a click in 3D, in the drawing or in the inspector.
- It is a DOM overlay beside the canvas inside the 3D view container (`.view.three`), not part of the scene.
  Each frame, a small component in the canvas projects the front top-centre of the selected space's box to screen
  pixels; the card's bottom centre goes there, clamped inside the view (6 px margin).
- The card goes away while nothing is selected, the anchor is behind the camera, a picture is being rendered
  (ADR-068), or a whole project is shown (pieces, not spaces, are selected there).
- Presses go through the same store action as over the drawing (one undo step each, ADR-051).

## Alternatives considered

- **drei `Html`** — tried first; it renders through a second React root that stayed empty in the production
  build, and cannot clamp the card inside the view.
- **A card fixed to a corner of the 3D view** — not "right above the selected item".

## Scope

- In scope: the overlay, its placement, hiding rules, find-it checks at 1280 and 390 px. ADR-014 still holds
  for everything else in 3D.

## Consequences

- Positive: counts can be changed while looking at the piece in 3D, on a phone too.
- Negative / risks: in the small phone 3D view the card covers part of the piece; it can be hidden by tapping
  empty space (clears the selection).
- Harder to change later: nothing structural; the overlay is one component in `src/viewer/Viewer3D.tsx`.

## Done when

- [x] `tools/count-stepper/find-it.mjs` passes at 1280 and 390 px: after selecting a door space and switching to
      Build & Preview, "Quick counts" shows inside the 3D view with "Doors" 2; "Fewer doors" → 1
- [x] No horizontal page scroll at 390 px with the card over 3D
- [x] lint, format:check, typecheck, test, build, docs:check pass
