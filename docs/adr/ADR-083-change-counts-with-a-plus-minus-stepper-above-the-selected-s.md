# ADR-083: Change counts with a plus-minus stepper above the selected space

- Status: Pending
- Date: 2026-10-25
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

No change to `src/core/types.ts` or the design document: every count already exists (`ShelvesSpace.count`,
`DrawersSpace.count` with optional `heights`, `SplitSpace.children`/`sizes`, `DoorsFront.count`,
`SlidingFront.count`). Divider panels already carry their split's `nodeId`, so tapping a divider selects the split.

## Decision

A **count stepper** (`src/ui/CountStepper.tsx`) floats in the front-elevation drawing (`Elevation.tsx`) just
above the selected space's box (below it when the box touches the top edge), inside the drawing at 390 px.
It shows one row per count that applies to the selected node:

| Selected node                                 | Rows (label · value)                                                                    |
| --------------------------------------------- | --------------------------------------------------------------------------------------- |
| Leaf space (shelves, drawers, hanging, empty) | **Vertical dividers** 0 · **Horizontal dividers** 0, plus the content row below         |
| Shelves                                       | **Shelves** · `count` (0 upwards)                                                       |
| Drawers                                       | **Drawers** · `count` (1 upwards); `heights`, when set, gain or lose a share at the end |
| Split (or one of its dividers)                | **Vertical dividers** or **Horizontal dividers** (per `axis`) · `children − 1`          |
| Any space with hinged doors                   | **Doors** · 1 or 2                                                                      |
| Any space with sliding doors                  | **Sliding doors** · 2–4                                                                 |

- `−` and `+` are buttons with accessible names ("Fewer shelves", "More shelves", …) and are disabled at the
  type's bounds above; there is no other upper limit. Too many parts for the space are the existing diagnostics
  (ADR-008), never a silent clamp.
- `+` on a leaf's divider row calls `splitSpace(s, axis, 2)`; on a split it appends one bay at the end with 2
  shelves (same as the inspector's Add) and a `fr 1` size. `−` removes the last bay and its size; from one
  divider it collapses to one space holding the first bay's contents (G-053).
- Each press is one `updateSpace` call, so it is one undo step (ADR-051). Pure count logic lives in
  `src/core/design.ts` (`stepCount(space, row, delta)`) and is unit-tested; the UI only renders the rows.
- The stepper hides while nothing is selected or the selection is a side-wing space (selected from the inspector).

## Alternatives considered

- **Bigger number fields in the inspector** — keeps the user scrolling away from the drawing; not "above the
  selected piece".
- **Stepper in the 3D view** — ADR-014 keeps the 3D view select-only; in Both (ADR-081) the drawing is beside it.
- **Drag handles to add dividers** — slower to discover, needs precise touch on a phone.

## Scope

- In scope: the stepper over the front drawing, the rows above, `stepCount` with tests, find-it script.
- Out of scope: the 3D view (G-051); counts outside cabinet spaces — frame, panel set, panel, project plan
  (G-052).

## Consequences

- Positive: the common edits are one tap away on a phone; no document change, no storage version.
- Negative / risks: the stepper can cover part of a small space; removing a bay drops its contents (undo restores).
- Harder to change later: nothing structural.

## Done when

- [ ] `stepCount` covers every row in the table, both directions and both bounds (tests in `tests/`)
- [ ] `−` on a split removes the last bay and its size; from one divider it leaves the first bay's contents (tests)
- [ ] Each press is one undo step (store test)
- [ ] A count beyond what fits gives the existing error diagnostic, not a clamp (test)
- [ ] `tools/count-stepper/find-it.mjs` passes at 390 and 1280 px: from the bare app open a piece, tap a space,
      find "More shelves" above it, press it, see the value go up; tap a divider, find "Vertical dividers"
- [ ] No horizontal page scroll at 390 px with the stepper shown
- [ ] lint, format:check, typecheck, test, build, docs:check pass

## Open questions

- Where `+` adds and `−` removes a bay, and what a new bay holds; default: at the end, with 2 shelves (G-053).
- Full or light acceptance (ADR-066); default: full (G-054).
- Which counts outside cabinet spaces should step (G-052).
