# ADR-084: Edit a project piece in place, keeping the project in view

- Status: Pending
- Date: 2026-10-25
- Depends on: ADR-022, ADR-051, ADR-083
- Design: docs/ui-design.md (section 4, project and editor screens)
- Backlog: N79

## Context

User, 2026-10-25: "Clicking on the piece goes into editor and exits the project 3d render thus losing tge overview,
picking/editing should maintain the scope within the project."

Today a tap on the selected project piece calls `editItem` ([ADR-083](../adr-done/ADR-083-select-from-the-whole-piece-inwards-one-level-per-tap.md)):
the store swaps `design` to the piece, `useView` switches to the piece alone, and the 3D view, plan and room front view
of the project disappear until _Back to project_. While editing, `projectModel` is not rebuilt (`syncItem` writes the
design into the project but placements and run parts follow only on _Back to project_, ADR-061).

This changes two settled decisions:

- ADR-083: "a 2nd tap on the selected piece opens it in the piece editor with the first level under the tap
  selected" → the 2nd tap selects that space **inside the project**; nothing is opened.
- [ADR-051](../adr-done/ADR-051-add-undo-and-redo-for-project-changes.md): "Edits made in the piece editor of a
  project piece become **one** project step when the user goes back to the project" → see G-055.

## Decision

Picking and editing a piece stay inside the project view.

- Selection in a project becomes piece + space: `selectedItemId` and `selectedId` together. Taps follow ADR-083 one
  level further out: 1st tap the piece, then its spaces one level per tap (`roomToPiece` + `drill`), then back to the
  piece. A tap on another piece selects that piece; a tap on nothing clears both.
- The 3D view, plan and room front view keep showing the whole project. The selected space of the selected piece is
  tinted and outlined in place (3D) and outlined on the room front view.
- The Compose sheet/inspector shows the space editor (contents, doors, divide) and the breadcrumb
  `Project / <piece> / Interior / …` for the selected space, and the project piece fields when only the piece is
  selected. Its edits go through the existing `updateSpace` path on the piece's embedded design.
- Every piece edit rebuilds the project model in the same step (placements and run parts follow, ADR-031, ADR-061), so
  the overview is never stale.
- 2D drawing, undo steps and the old full-screen editor: per the open questions (G-054, G-055, G-056).
- No change to the saved project or design document (no ADR-011 bump) and no Dexie change.

## Alternatives considered

- **Keep the editor, show a small project 3D inset** — two scenes on a phone; still leaves the project.
- **Editor with the project drawn ghosted around the piece** — same mode switch, more rendering work, editing still
  scoped to one piece.
- **Inspector-only editing (no drill in the project)** — loses ADR-083's tap-to-drill inside the project.

## Scope

- In scope: project-scoped selection (piece + space), drill in project 3D and room front view, space editor and
  breadcrumb in the project sheet/inspector, live project rebuild on piece edits, find-it script.
- Out of scope: nothing beyond the open questions (G-054, G-055, G-056).

## Consequences

- Positive: the overview stays on screen while a piece is filled, divided or given doors.
- Negative / risks: every edit rebuilds the whole project model (cost grows with pieces; measure on the largest sample
  project); the store's "design being edited" and "project" paths merge, touching undo and autosave.
- Harder to change later: a project selection is a pair (piece, space).

## Done when

- [ ] Store test: in a project, taps at one point select piece → bay → space → piece; `editingItemId` stays null.
- [ ] Store test: an edit to the selected space changes the piece's embedded design, rebuilds `projectModel`, and a
      piece resized under another moves the one on top in the same step.
- [ ] Store test: undo and redo follow the rule chosen in G-055 and keep a valid selection.
- [ ] The project 3D view stays mounted while a space is selected and edited (find-it: the canvas stays, no _Back to
      project_ button appears).
- [ ] `tools/project-drill/find-it.mjs` on the production build at 390 and 1280 px: from the bare app, new project,
      add a Wardrobe, tap it in 3D three times, find "Hanging" in the sheet/inspector, set it to shelves, and find the
      piece still in the project 3D view and plan.
- [ ] `pnpm lint`, `format:check`, `typecheck`, `test`, `build`, `docs:check` pass.

## Open questions

- 2D drawing while a project piece is edited: room front view with the piece's spaces in place, or the piece's own
  front view? Recommended: room front view (closest to "maintain the scope within the project"; estimate +35 % work,
  +30 % of value). (G-054)
- Undo: each piece edit one project step, or one step per piece until another piece is picked? Recommended: each edit
  one step (no "back to project" moment remains; estimate +10 % work). (G-055)
- Keep the full-screen piece editor behind an explicit _Open piece_ button, or remove it? Recommended: keep it behind
  the button; taps never leave the project (+5 % work). (G-056)
