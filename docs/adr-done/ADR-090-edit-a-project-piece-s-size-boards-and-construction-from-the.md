# ADR-090: Edit a project piece's size, boards and construction from the project editor

- Status: Implemented
- Date: 2026-10-26
- Implemented: 2026-10-26
- Depends on: ADR-080, ADR-088
- Design: docs/ui-design.md (section 4, editor screen)
- Backlog: N86

## Context

[ADR-088](../adr-done/ADR-088-drill-into-a-piece-without-leaving-the-project-editor.md) keeps the project editor
open while a piece's spaces are edited, and left piece-wide settings (size, boards, construction) behind "Edit this
piece" (G-071). The user, 2026-10-26: "Go 068" — build it.

## Decision

- "Inside this piece" (ADR-088) gets a button "Size, boards and construction". It opens a dialog with the same
  panels as the piece's Settings (ADR-080): the whole-piece editor (size, construction, drawers), its boards and
  fasteners — for the piece loaded for edits (`drillItemId`), without leaving the project.
- Each change goes through the store's `commit`, so it is written into the project copy as one project undo step
  (ADR-051); a resized piece moves what sits on it and its run parts follow (`commitProject`).
- Found while testing: Enter in a millimetre field committed and then blurred, and the blur committed again — two
  undo steps per Enter, in the piece editor too. Enter now only leaves the field; the blur commits once
  (`src/ui/controls.tsx`).

## Alternatives considered

- **Inline the whole-piece editor in the project panel** — the panel is already long on a phone; a dialog keeps the
  space controls in sight.
- **Keep "Edit this piece" for these** — the gap the user asked to close.

## Scope

- In scope: the button and dialog, the store test, the find-it steps, the Enter fix in `MmField`.

## Consequences

- Positive: a project piece's size and boards change without leaving the project.
- Negative / risks: two places edit a project piece's settings (this dialog and the piece editor's Settings); both
  use the same panels.

## Done when

- [x] Store test: with the piece loaded from the project, a width change updates the project copy and the project
      model; one project undo restores both (`tests/select-path.test.ts`).
- [x] `tools/project-drill/find-it.mjs` at 1280 and 390 px: "Size, boards and construction" → Width +100 widens the
      piece on the plan, the project editor stays open, one Undo takes it back.
- [x] lint, format:check, typecheck, test, build, docs:check pass.
