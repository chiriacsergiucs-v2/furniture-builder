# ADR-083: Change counts with a plus-minus stepper above the selected space

- Status: Implemented
- Date: 2026-10-25
- Implemented: 2026-10-25
- Depends on: ADR-051, ADR-079
- Design: docs/ui-design.md (§3 Components and states)
- Backlog: N78

## Context

User request 2026-10-25, in their words:

> Divider(horizontal and vertical)/drawer/shelf/all other applicable pleces based on configuration
> \+ currentNuber -
> Placement: above the selected piece
> Usage - quick increment/decremebt number of structural configuration based on the selected item/piece/subpiece

Today counts are changed in the inspector (`src/ui/Inspector.tsx`): number fields for shelves and drawers, a
door-count choice, and Divide / Add / Remove division for splits. On a phone that means scrolling away from the
drawing. The request is a compact `−  N  +` control floating over the drawing, right above the selection.
Answers 2026-10-25: placement "right above the selected item in the rendering container" / "INside the rendered view
container!"; acceptance "Full"; counts outside cabinet spaces "Not now"; the stepper over 3D too: "Yes - create new"
([ADR-084](../adr-done/ADR-084-show-the-count-stepper-over-the-3d-view-too.md)).

No change to `src/core/types.ts` or the design document: every count already exists (`ShelvesSpace.count`,
`DrawersSpace.count` with optional `heights`, `SplitSpace.children`/`sizes`, `DoorsFront.count`,
`SlidingFront.count`). Divider panels already carry their split's `nodeId`, so tapping a divider selects the split.

## Decision

A **count stepper** — a card, `role="group"` named "Quick counts" (`src/ui/CountStepper.tsx`) —
floats inside the front-elevation drawing (`Elevation.tsx`), right above the selected space's box, centred on it and
kept inside the drawing. While a space is selected the drawing gives up the card's height at its top, so there is
always room above the selection (on a phone the piece otherwise fills the drawing). It shows one row per count that
applies to the selected node:

| Selected node                                 | Rows (label · value)                                                                                                                  |
| --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| Leaf space (shelves, drawers, hanging, empty) | **Vertical dividers** 0 · **Horizontal dividers** 0 (a bay counts its parent's dividers along the parent's axis), plus the rows below |
| Shelves                                       | **Shelves** · `count` (0 upwards)                                                                                                     |
| Drawers                                       | **Drawers** · `count` (1 upwards); `heights`, when set, gain or lose a share at the end                                               |
| Split (or one of its dividers)                | **Vertical dividers** or **Horizontal dividers** (per `axis`) · `children − 1`                                                        |
| Any space with hinged doors                   | **Doors** · 1 or 2                                                                                                                    |
| Any space with sliding doors                  | **Sliding doors** · 2–4                                                                                                               |

- `−` and `+` are buttons with accessible names ("Fewer shelves", "More shelves", …), disabled at the same bounds
  as the inspector's counters: dividers 0–7 (parts 2–8), shelves 0–12, drawers 1–10. Too many parts for the
  space are the existing diagnostics (ADR-008), never a silent clamp.
- `+` on a leaf's divider row calls `splitSpace(s, axis, 2)`; on a split it appends one bay at the end with 2
  shelves (same as the inspector's Add) and a `fr 1` size. `−` removes the last bay and its size; from one
  divider it collapses to one space holding the first bay's contents (G-053).
- Each press is one store `stepCount(key, delta)` → one `updateSpace` call, so one undo step (ADR-051). When the
  selected bay is removed, the space that held it is selected. Pure logic lives in `src/core/counts.ts`
  (`countRows(product, id)`, `stepCount(space, key, delta)`) and is unit-tested; the UI only renders the rows.
- The stepper hides while nothing is selected or the selection is a side-wing space (selected from the inspector).

## Alternatives considered

- **Bigger number fields in the inspector** — keeps the user scrolling away from the drawing; not "above the
  selected piece".
- **Stepper in the 3D view only** — the drawing is where spaces are tapped in Compose; 3D gets the same card in
  [ADR-084](../adr-done/ADR-084-show-the-count-stepper-over-the-3d-view-too.md).
- **Drag handles to add dividers** — slower to discover, needs precise touch on a phone.

## Scope

- In scope: the stepper over the front drawing, the rows above, `stepCount` with tests, find-it script.
- Out of scope: the 3D view, moved to ADR-084 (G-051); counts outside cabinet spaces — frame, panel set, panel,
  project plan (G-052, user: "Not now").

## Consequences

- Positive: the common edits are one tap away on a phone; no document change, no storage version.
- Negative / risks: the drawing is a little smaller while a space is selected, and the card covers the selected
  width dimension above the piece (the inspector still shows it); removing a bay drops its contents (undo restores).
- Harder to change later: nothing structural.

## Done when

- [x] `stepCount` covers every row in the table, both directions and both bounds (`tests/counts.test.ts`)
- [x] `−` on a split removes the last bay and its size; from one divider it leaves the first bay's contents (tests)
- [x] Each press is one undo step (store test)
- [x] A count beyond what fits gives the existing error diagnostic, not a clamp (test)
- [x] `tools/count-stepper/find-it.mjs` passes at 1280 and 390 px: from the bare app open a Sideboard, tap the
      drawer bank, find "Quick counts" with "Vertical dividers", "Horizontal dividers" and "Drawers" right above it
      inside the drawing; "More drawers" → 4 and the drawing says "4 drawers"; "Fewer vertical dividers" → one bay
      fewer; tap a door space, "More doors" → 2
- [x] No horizontal page scroll at 390 px with the stepper shown
- [x] lint, format:check, typecheck, test, build, docs:check pass

## Open questions

- Where `+` adds and `−` removes a bay, and what a new bay holds; built with the default: at the end, with 2
  shelves (G-053, not answered yet).
- Answered 2026-10-25: acceptance Full (G-054); counts outside cabinet spaces "Not now" (G-052).
