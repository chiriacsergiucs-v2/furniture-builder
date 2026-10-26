# ADR-097: Select several pieces and keep them as groups

- Status: Pending
- Date: 2026-10-26
- Depends on: ADR-051, ADR-065, ADR-069
- Design: docs/ui-design.md (Plan view)
- Backlog: N95
- Agreed: 2026-10-26 "New adr 2"; answer "Group first, then the piece"

## Context

The user, 2026-10-26: "New adr 2". Item 2 of the fit review: _Multi-select, groups and whole-ensemble transforms_
(rank 8, value 4.7, P0, In Progress, missing "multi-select, selection box and saved groups"). The paper: "Users
need to move a complete kitchen run, wardrobe bank or desk/storage combination without losing individual item
configurability" (line 132); "grouping and connection are different concepts" (line 386). Planner 5D users asked
for group selection, selection boxes and cycling overlapping objects (line 45). Today one piece is selected at a
time (`selectedItemId`); run-wide actions exist ("This run", "Mirror the run").

## Decision

- **Several selected pieces:** the store keeps `selectedItemIds` (the first is the main one shown on the card).
  Desktop: Shift- or Ctrl/Cmd-click adds or removes a piece; Ctrl/Cmd+A selects all. Phone: a **Select** button
  turns on multi-tap selection. Esc clears.
- **Selection box:** on the Plan, dragging on empty space draws a box; every piece whose footprint it touches is
  selected (with Select on, on phones).
- **Cycle overlapping:** tapping the same spot again selects the next piece under the pointer (stacked or
  overlapping pieces), in drawing order.
- **Act on the selection:** dragging any selected piece moves them all by the same whole-mm offset; snapping uses
  the moved piece; placement rules and locks ([ADR-095](ADR-095-lock-a-piece-so-automatic-moves-and-repairs-leave-it-alone.md)) apply to each. **Delete**, **Duplicate** and **Turn 90°**
  (about the selection's centre, rounded to whole mm) work on the selection; finish scope gains **Selected pieces**
  ([ADR-055](../adr-done/ADR-055-apply-a-board-to-this-piece-this-run-or-the-whole-project.md)). Each action is one undo step.
- **Groups:** **Group** keeps the selection as a named group (`Project.groups: {id, name, itemIds}[]`, project
  `schemaVersion` raised to the next free version; older versions still load). A first tap on a grouped piece
  selects the whole group, the next tap that piece (as [ADR-083](../adr-done/ADR-083-select-from-the-whole-piece-inwards-one-level-per-tap.md) does inside a piece). **Ungroup** removes the group.
  Groups are listed in the project panel; a piece belongs to at most one group. Groups never merge pieces and are not
  connections.
- Pure helpers in `src/core` (`moveItems`, `turnSelection`, `groupOf`); the UI only collects ids.

## Alternatives considered

- **Groups as merged pieces** — loses each item's configuration ([ADR-047](../adr-done/ADR-047-two-touching-cabinets-in-a-project-merge-into-one-cabinet-an.md) merge is a separate action).
- **Runs instead of groups** — runs are inferred from touching pieces; users group pieces that do not touch.

## Scope

- In scope: multi-select, selection box, cycling, moving, deleting, duplicating and turning a selection, finish
  scope, groups.
- Out of scope: mirroring a selection (G-085).

## Consequences

- Positive: a kitchen run or wardrobe bank moves as one, and each piece keeps its own settings.
- Negative / risks: every Plan tool must say whether it acts on one piece or the selection.

## Done when

- [ ] Moving and turning a selection keep whole mm, placement rules and locks (unit tests)
- [ ] Groups save and reload; older project versions load; a deleted piece leaves its group (storage tests)
- [ ] Every selection action is one undo step (unit test)
- [ ] Find-it at 1440 px: box-select three pieces → drag → all move; **Group** → tap selects the group, tap again
      the piece; at 390 px: **Select** → tap two pieces → **Delete** → Undo brings them back; no page errors

## Answers (2026-10-26)

1. The first tap on a grouped piece selects the group, the next tap the piece (user, 2026-10-26). The question is closed (G-086).
