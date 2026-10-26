# ADR-098: Replace a piece with a compatible catalog alternative

- Status: Implemented
- Date: 2026-10-26
- Implemented: 2026-10-26
- Depends on: ADR-028, ADR-055, ADR-061
- Design: docs/ui-design.md (Plan view)
- Backlog: N96
- Agreed: 2026-10-26 "New adr 5"; answer "Same width; others behind a switch"

## Context

The user, 2026-10-26: "New adr 5". Item 5 of the fit review: _Smart replace/swap with compatible alternatives_ (rank
11, value 4.6, P1, Not Started; merged into it: _Replace workflow_ and _Preserve user intent through change_). The
paper: "Replacing a 600 mm drawer cabinet with another compatible 600 mm cabinet should preserve placement,
material context, group membership, neighbouring connections and generated top where possible" (line 135); "select
a module and browse only compatible alternatives" (line 183). Each project piece keeps its catalog origin
(`catalogId`, `variantId`, `revision`, [ADR-028](../adr-done/ADR-028-catalog-metadata-and-origin-link-live-in-the-design-document.md)); run parts follow pieces by themselves ([ADR-061](../adr-done/ADR-061-run-parts-stay-up-to-date-the-user-s-removals-are-remembered.md)).

## Decision

- **Replace…** on the selected-piece card opens a list of compatible catalog items (pictures, names, sizes).
  Compatible = same placement kind (floor, wall, on another piece) and the same width as the piece; a **Show other
  widths** switch adds the rest, each with "neighbours may need moving".
- **What carries over:** the project item keeps its id, position (left-back corner), quarter turn, quantity,
  placement, clearance zones, lock ([ADR-095](../adr-done/ADR-095-lock-a-piece-so-automatic-moves-and-repairs-leave-it-alone.md)) and group ([ADR-097](../adr/ADR-097-select-several-pieces-and-keep-them-as-groups.md)). Its boards carry over by part role,
  as finish scope applies them ([ADR-055](../adr-done/ADR-055-apply-a-board-to-this-piece-this-run-or-the-whole-project.md)). The design is the new item's copy with its own catalog origin.
- **What updates:** run parts refresh (ADR-061), checks rerun; the result says what changed ("Replaced. Worktop 2400
  → 2600 mm. 1 problem: …") and opens the problem with its repairs ([ADR-071](../adr-done/ADR-071-select-the-problem-and-offer-previewed-repairs-for-diagnosti.md)).
- **Confirmation:** when the piece was edited after it was added, the dialog says the edits are replaced. One undo step.
- Pure function `replaceItem(project, itemId, design)` in `src/core`; compatibility from the built models.

## Alternatives considered

- **Delete and add** — loses position, group, lock and boards; the research asks to keep intent.
- **Keep the old copy's edits on the new item** — edits are made to a specific space tree and do not map onto
  another design.

## Scope

- In scope: Replace list with compatible items, carry-over, refresh, result message, undo.
- Out of scope: carrying the old piece's own edits onto the new design (G-087).

## Consequences

- Positive: late changes keep the plan intact.
- Negative / risks: role-based board carry-over can miss a part role the old design did not have; it keeps that
  part's default board.

## Done when

- [x] `replaceItem` keeps id, position, turn, quantity, placement, zones, lock, group and boards (unit tests,
      `tests/replace.test.ts`)
- [x] Run parts follow a replaced piece of another width; one undo step (unit tests, `tests/replace.test.ts`)
- [x] Find-it at 1440 and 390 px: select a base cabinet → **Replace…** → only same-width items listed → pick one →
      the piece is replaced in place; Undo restores it; no page errors (`tools/replace/find-it.mjs`, 30/30 PASS on
      the production build, 2026-10-26)

## Answers (2026-10-26)

1. Compatible means the same width; other widths behind **Show other widths** (user, 2026-10-26). The question is closed (G-088).
