# ADR-109: Show the quick-count card over the project drawing and put Doors and fronts beside Snap

- Status: Pending
- Date: 2026-10-27
- Depends on: ADR-106
- Design: docs/ui-design.md (section 4, editor screen: stage toolbar, quick-count card)
- Backlog: N107
- Agreed: 2026-10-27 "Same row as Snap (Recommended)", "Show on 1st tap (Recommended)"

## Context

The user, 2026-10-27, after ADR-106: "i dont see doors text moved with other, i dont see the floating increment
decrement"; asked where, "Doors and front still full row" and "Nowhere". In a project's Compose drawing on a phone,
"Doors and fronts" took a row of its own above Snap / Select / Clearances, and the floating − N + card
([ADR-084](../adr-done/ADR-084-change-counts-with-a-plus-minus-stepper-above-the-selected-s.md), with Width and Depth from ADR-106) appeared only
over a single piece's drawing and the project's 3D view: never over the project's plan and front view. Asked, the
user chose "Same row as Snap (Recommended)" and "Show on 1st tap (Recommended)". This takes over G-125.

## Decision

- **Doors and fronts:** in a project's Compose drawing, the toggle moves from the stage toolbar into the plan's tool
  row, first, beside Snap, Select and Clearances. Elsewhere (single piece, 3D only, Build & Preview) it stays where it
  is. An empty stage toolbar is hidden.
- **Card over the project front view:** from the first tap on a piece (the piece loaded for edits, ADR-088), the
  quick-count card floats right above the selected piece in the room front view, with Width and Depth while the whole
  piece is selected (ADR-106) and the counts of a space inside it after a further tap. As over a single piece's
  drawing, the view gives up the card's height at its top so the card never covers the piece. Not shown for several
  pieces selected, a 3D model, or on a phone while 3D is shown (the 3D card is there).
- No model, store or document change; the card uses the existing `CountStepper`, `resizePiece` and `stepCount`.

## Alternatives considered

- **Doors and fronts into the Options menu** — offered, not chosen.
- **Card docked under the drawing on a phone** (as the 3D card, G-070) — tried: the bottom sheet covers the dock in
  Compose, so the card was not visible.
- **Card on the plan (top-down) view** — the plan has no heights; the front view shows doors, drawers and spaces.

## Scope

- In scope: the toggle's place, the floating card on the project front view, the find-it script.
- Out of scope: at 390 px "Clearances" wraps to a second row of the plan toolbar (G-134).

## Consequences

- Positive: a project piece is resized and its counts changed from the drawing in one tap, as a single piece.
- Negative / risks: while the card shows, the front view is shorter by the card's height.
- Harder to change later: nothing; no stored shape changes.

## Done when

- [x] In a project's Compose drawing "Doors and fronts" is in the row with "Snap", shown once, and unticking it hides
      the doors in the front view.
- [x] One tap on a project piece shows the card over the front view with "Width" and "Depth", on screen and not
      covered; typing a width resizes the piece; one Undo takes it back.
- [x] A further tap selects a space: the card keeps its counts and drops Width and Depth.
- [x] Find-it test passes from the bare app at phone and desktop widths (`tools/project-card/find-it.mjs`,
      production build).

## Open questions

- None open; the toolbar wrap at 390 px is G-134.
