# ADR-023: More space options: chosen drawer heights and adjustable shelves with 32 mm pin rows

- Status: Implemented
- Date: 2026-10-21
- Implemented: 2026-10-21
- Decided by: open questions answered by the user
- Depends on: none
- Design: n/a
- Related: ADR-005, ADR-006, ADR-010, ADR-011
- Backlog: N05

## Context

Drawers are equal height and shelves are fixed today (ADR-005). Real chests often grade drawer heights, and most
shelving is adjustable on the 32 mm system.

## Decision

- `drawers` gains optional `heights: SplitSize[]` (same mm/share rules as splits); fronts and boxes follow those
  heights with the existing gap rules (ADR-006). Absent = equal, so old designs are unchanged.
- `shelves` gains `adjustable: boolean`. Adjustable shelves are shortened by a clearance (default 1 mm per side, a
  setting) and the sides they sit between get a **pin-row annotation**: hole-row positions on the 32 mm grid from
  the front and back edges, listed with the part. It is an annotation for the shop, labelled as such; no drilling
  depth or hardware model is claimed (ADR-010).
Both are optional fields, so the design document stays version-compatible (validated as optional).

## Alternatives considered

- **New space kinds** (`graded-drawers`, `adjustable-shelves`) — duplicates logic; options on existing kinds are
  simpler.

## Consequences

- Cut list rows for adjustable shelves differ from fixed ones by the clearance.
- Pin rows add a column to the parts list for sides and dividers.

## Evidence (repository files)

- `src/core/types.ts` — `DrawersSpace.heights`, `ShelvesSpace.adjustable`, `PinRows`, `CabinetParams.shelfClearance/pinRowSetback`.
- `src/core/cabinet.ts` — drawer heights (front-driven slots), adjustable shelves, `addPinRows` with 16 mm offset on double-sided panels, shelf-pin hardware.
- `src/core/cutlist.ts` — `drillingText`, drilling in grouping key and CSV.
- `src/core/design.ts` — validation, `setDrawerCount`.
- `src/ui/Inspector.tsx` — drawer heights editor, adjustable toggle, pin settings; `src/ui/Output.tsx` drilling line.
- `tests/core.test.ts` — ADR-023 block (5 tests); `tests/fuzz.test.ts` covers both options.

## Compliance check

When accepted: designs without the new fields build byte-identical models (snapshot test); fuzz covers graded
drawers.

## Answers (2026-10-21, from the user)

- **Hole rows:** 37 mm from the front and back edges, 32 mm grid.
- **Adjustable shelf clearance:** 1 mm per side (shelf 2 mm shorter than the opening).

Built and accepted 2026-10-21. Designs without the new fields build identical models (test).

## Note (2026-10-23)

A space too short for a pin hole on one side (holes must stay 64 mm clear of its top and bottom) is now the error
`pin-rows-short`. Before, that side was skipped silently and the shelf rested on one edge. Found by the seeded fuzz
while building ADR-040; regression test in `tests/core.test.ts`.
