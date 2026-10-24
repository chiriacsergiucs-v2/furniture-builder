# ADR-051: Add undo and redo for project changes

- Status: Implemented
- Date: 2026-10-24
- Implemented: 2026-10-24
- Decided by: user, 2026-10-24, answer to ADR-047 question 3: "Yes, add project undo"
- Depends on: ADR-022, ADR-047
- Design: docs/ui-design.md (top bar: the Undo / Redo cluster)
- Backlog: N46

## Context

The piece editor has undo and redo (F15); the project view had none. Merging two pieces
(ADR-047) and removing a piece only asked for confirmation and could not be taken back.
Asked whether a project-level undo should be added, the user answered "Yes, add project undo".

## Decision

- The store keeps a project history next to the piece history: up to 100 earlier states
  (`projectPast`) and the undone ones (`projectFuture`), as whole `Project` snapshots. A
  project is a small document of embedded copies (ADR-022), so snapshots are cheap and
  exact; no inverse operations to get wrong.
- Every project change is one step: add, remove, merge, rename, quantity, position, turn,
  placement, gap, run parts, kerf. A new change clears redo.
- Edits made in the piece editor of a project piece become **one** project step when the
  user goes back to the project, and only if the piece changed. While the piece editor is
  open, Undo / Redo and Ctrl+Z / Ctrl+Shift+Z / Ctrl+Y act on the piece, as before.
- In the project view the same top-bar buttons and shortcuts act on the project (they were
  hidden there before). Undo keeps the selected piece if it still exists.
- Opening or closing a project starts an empty history; history is not saved. The restored
  state is autosaved like any other change.
- The merge confirmation now says "Undo brings the two pieces back"; removing a piece still
  asks for confirmation.

## Alternatives considered

- **Inverse operations per action** — rejected: every action (merge, placements that move
  stacked pieces) would need a correct inverse; snapshots are exact by construction.
- **One history shared by piece and project** — rejected: piece edits inside a project
  would interleave with project steps and Undo in the project view would change one piece
  unseen.
- **Saving the history** — rejected: no user asked for undo across reloads; it would need
  a Dexie version.

## Scope

- In scope: store history, top-bar buttons and shortcuts in the project view, merge copy.
- Out of scope: undo across reloads; undo in the library (deleting saved pieces).

## Consequences

- Positive: merge and remove can be taken back; ADR-047 no longer needs "cannot be undone".
- Negative: up to 100 project snapshots in memory (copies of small JSON documents).

## Done when

- [x] Undo after merging brings back both pieces; Redo merges them again (`tests/project-undo.test.ts`)
- [x] Remove, rename and quantity changes undo one step each; a new change clears redo
- [x] Piece-editor edits come back as one project step; Undo is ignored while the piece editor is open
- [x] Opening or closing a project starts a fresh history
- [x] Four code mutations of the history each fail a test
- [x] Find-it test passes from the bare app at phone and desktop widths (`tools/project-undo/find-it.mjs`)
