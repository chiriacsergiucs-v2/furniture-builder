# ADR-071: Select the problem and offer previewed repairs for diagnostics

- Status: Pending
- Date: 2026-10-24
- Depends on: ADR-008, ADR-057, ADR-058
- Design: docs/ui-design.md (Output › Checks, Plan view)
- Backlog: N66

## Context

The user, 2026-10-24, on the Feature Research & Catalog selection: "Identify the features and subfeatures
necessary for the following items from research. Import 3D models and model libraries · Duplicate, mirror and
predictable rotate operations · Also for these: [14 features marked Interested]", then "Draft adrs for each".

Research row: _Explainable warnings with suggested repairs_ (rank 7, P1): select and explain the problem, suggest
repairs, automated fixes. Today checks give plain messages that block export ([ADR-008](../adr-done/ADR-008-problems-are-diagnostics-checked-independently-of-the-genera.md)); project checks
cover overlaps, the room ([ADR-058](../adr-done/ADR-058-the-project-has-a-room-walls-doors-windows-and-obstacles-chec.md)) and opening clearance ([ADR-057](../adr-done/ADR-057-opening-clearance-doors-drawers-and-flaps-need-free-space-in.md)), but a message does not show where
the problem is or how to fix it.

## Decision

- **Diagnostics carry where and how much:** the `Diagnostic` type gains optional `itemIds` (project pieces
  involved), `box` (the overlap or blocked zone, mm) and `amount` (mm). Messages state the amount: "Base 600 and
  Tall 600 overlap by 34 mm".
- **Select the problem:** tapping a check selects the pieces involved, outlines `box` on the plan and in 3D, and
  scrolls the plan to it.
- **Repairs are computed in the core** per diagnostic code (`repairsFor`), each a description plus a project
  patch:
  - overlap → move the second piece by `amount` left or right (whichever side is free), or move the first;
  - door blocked by a neighbour → reverse the hinge (if the door is single), move the neighbour by `amount`,
    or add a filler of `amount` between them (ADR-054 fillers);
  - outside the room → move inside by `amount`.
- **Preview, then apply:** a repair shows its result as an outline; **Apply** commits it as one undo step and
  the checks re-run. Nothing is applied automatically, and no diagnostic is hidden or softened (ADR-008).
- Repairs that would create another error are not offered.

## Alternatives considered

- **Red geometry only** — the research's point is that it does not tell the user what to do.
- **Automatic fixing** — silent changes break ADR-008; the user applies each repair.

## Scope

- In scope: where/amount on project diagnostics, select-the-problem, three repair families, preview, apply.
- Out of scope: repairs inside a single piece's design, choosing another catalog item as a repair.

## Consequences

- Positive: problems are found and fixed in the same place.
- Negative / risks: every repair needs a test that it clears its diagnostic and creates no error.
- Harder to change later: `Diagnostic` gains optional fields (model shape, no stored data).

## Done when

- [ ] Overlap, door-blocked and outside-room diagnostics carry pieces, box and amount (unit tests)
- [ ] Each offered repair clears its diagnostic and adds no error (unit tests, fuzz over layouts)
- [ ] Applying a repair is one undo step (unit test)
- [ ] Tapping a check selects and outlines the problem; **Apply** is found (find-it at 390 px and 1280 px)
- [ ] All CI checks pass

## Open questions

- Which repair is listed first — default: the smallest move.
