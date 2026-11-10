# ADR-246: Ask before an edit drops contents and hold the assistant to the field limits

- Status: Pending
- Date: 2026-11-10
- Depends on: none
- Design: n/a
- Backlog: N253

## Context

Same request as [ADR-243](ADR-243-keep-locks-in-force-in-every-editing-flow.md). The flow map found:

- Changing "What goes here", lowering "Parts" and "Remove dividers" dropped contents with no question; "Remove
  dividers" made two shelves while removing the last divider with the quick count (ADR-086) kept the first bay.
- Remove and Delete took Enter as "remove".
- The assistant could set sizes outside the fields' limits, add variables with empty or duplicate names, and its
  `setKerf` never set the project's saw cut.
- Delete and Ctrl+D did nothing for a multi-selection; Ctrl+A and a click on a 3D model left models out of a
  multi-selection.
- A part's own board (ADR-151) could not go back to its group's board from the UI.

## Decision

- Confirm before a contents change, a lower part count or Remove dividers, only when something would be lost
  (`holdsSomething`, `src/core/design.ts`). Danger confirms focus Cancel (`cancelFirst`).
- `unsplit` keeps the first part's contents, the same as the quick count.
- Assistant calls `resizePiece`, `setKerf`, `addDesignVariable`, `updateDesignVariable`, `addVariable` and
  `updateVariable` check the fields' limits and `nameProblem`; a refusal fails the plan's preview with the reason.
  In the project view `setKerf` sets the project's saw cut.
- Delete asks to delete a multi-selection; Ctrl+D duplicates it as a block; Ctrl+A takes 3D models; Select mode
  or a modifier adds a clicked model.
- The Material dialog's Part scope gets "Use its group's board again" for a part with its own board.

## Alternatives considered

- **Rely on undo** (status quo) — undo works, but the user is not told anything was lost.
- **Clamp the assistant's values** — ADR-008 forbids silent clamping.

## Scope

- In scope: the confirms, `unsplit`, assistant checks, keys and the board reset above.
- Out of scope: switching a front between Sliding and Flap still resets the other kind's few settings (undo
  restores them); `applyFinish` keeps no UI of its own (the Material dialog covers it, ADR-163); overlaps stay a
  diagnostic, never a refusal (ADR-008).

## Consequences

- Positive: no silent loss; the assistant cannot write what the fields would refuse.
- Negative / risks: one more tap for edits that drop contents.

## Done when

- [x] Remove dividers keeps the first part (`tests/editing-flows.test.ts`)
- [x] The assistant is refused out-of-range sizes and saw cuts and bad variable names; in the project view it sets
      the project's saw cut (`tests/editing-flows.test.ts`)
- [x] Select all takes the placed 3D models (`tests/editing-flows.test.ts`)
