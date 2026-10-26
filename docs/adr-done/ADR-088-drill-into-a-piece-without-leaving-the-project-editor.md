# ADR-088: Drill into a piece without leaving the project editor

- Status: Implemented
- Date: 2026-10-26
- Implemented: 2026-10-26
- Depends on: ADR-083, ADR-086
- Design: docs/ui-design.md (section 4, editor screen)
- Backlog: N83

## Context

User, 2026-10-26, in their words:

> one more ADR, which would keep the project editor open while we click on the item second time (yes editing of ),
> and it gives us the opportunity to add or remove shelves and change its structure. the item is triggered, but we
> should be kept on the edit of the project view.
> Reproduce steps: 1. Edit project 2. Click item 3. click again
> Bug here - we are in the edit of the item, not project, unwanted behaviour. Also clicking on the Compose tab at
> this point will move you to composing of the item. So it basically kicked us out of the project edit.

[ADR-083](../adr-done/ADR-083-select-from-the-whole-piece-inwards-one-level-per-tap.md) decided (user answer "2 yes",
G-052): "a 2nd tap on the selected piece opens it in the piece editor with the first level under the tap selected".
`tapItem` in `src/store/designStore.ts` calls `editItem`, which switches the editor to the piece. ADR-083 is
implemented and stays as it is; this ADR replaces that one rule. The user's new words are the later decision.

## Decision

- In a project, the 1st tap on a piece selects it, whole piece. Further taps on the selected piece drill into its
  spaces one level per tap (ADR-083 `drill`, the tap mapped into the piece by `roomToPiece`), **and the editor stays
  on the project** (project panel, Compose tab still the project's). After the innermost level the next tap wraps
  to the whole piece (G-051).
- Store: `drillItemId`, the project piece loaded into `design`/`model` while the project editor stays open; active
  only while it is the selected piece (`selectItem`, `tapItem` load it; selecting nothing, another project or "Edit
  this piece" drop it). `editingItemId`, which switches the screen to the piece editor, is not set. Each change to
  the loaded piece is written into the project as one project undo step (ADR-051); after a project undo, a move or a
  removal the loaded piece follows its project copy or is dropped.
- The project panel shows, under "Selected piece", an "Inside this piece" section: the selected space's own panel
  (Contents, Doors and handles, Divide this space, Layouts, breadcrumb), or for the whole piece where to tap and its
  quick counts (G-061). The quick-count card shows over the project 3D, and design A (ADR-087) outlines the space
  there, placed in the room like the piece (`pieceBoxToRoom` in `src/core/project.ts`).
- "Edit this piece" stays the only way into the piece editor.
- Plan view (no height): a further tap selects the piece's interior and stays in the project (G-062).

## Alternatives considered

- **Keep opening the piece editor, add a "Back to project" button** — the user called leaving the project the bug.
- **Long-press to drill, tap to open** — hidden gesture; long-press is the browser menu on phones.

## Scope

- In scope: the store change, drilling in project 3D, plan and room front view, the "Inside this piece" section, the
  card and outline over the project 3D, the selected space outlined on the plan (its width × depth footprint) and on
  the room front view with the rest faded (G-067, user 2026-10-26), tests of the user's steps, find-it script.
- Out of scope: piece-wide settings (size, materials, carcass) from the project panel — they stay behind "Edit this
  piece" (G-068).

## Consequences

- Positive: shelves and dividers of any piece change without leaving the project or losing its view.
- Negative / risks: the project panel gets longer on a phone; a project space selection is a new store state that
  undo/redo, delete and load must keep valid. `tools/drill-select/find-it.mjs` expected the piece editor; its
  project step now checks the new rule.
- Harder to change later: the pair (`selectedItemId`, `selectedId`) becomes the project's selection.

## Done when

- [x] Store test of the user's steps: open project, tap item, tap again → `editingItemId` still unset, the space
      under the tap selected; a 4th tap at the innermost level selects the whole piece again; turned 0° and 90°
      (`tests/select-path.test.ts`).
- [x] Shelves `+` on that space changes only that piece in the project and the project model; one project undo
      restores it and the loaded piece follows (same file).
- [x] Selecting nothing, removing the piece and opening another project leave a valid selection; "Edit this piece"
      still opens the piece editor; a selected space is placed in the room like its panels at 0/90/180/270° (same
      file).
- [x] `tools/project-drill/find-it.mjs` at 1280 and 390 px: from the bare app, a project with a Sideboard; plan taps
      keep the project open with "Inside this piece"; in 3D a further tap shows "Shelves", "More shelves" adds a
      part, "Compose" still shows the project, Undo takes it back, the next tap is the whole piece again.
- [x] Same script: the plan and the room front view outline the selected space (G-067); taps on the room front
      view drill too; at 390 px the card is docked under the 3D view.
- [x] lint, format:check, typecheck, test, build, docs:check pass.

## Answered questions

- Project panel for a selected space: user 2026-10-26 "Agree" — the space's full panel plus the quick-count card
  (G-061).
- Plan, 2nd tap: user 2026-10-26 "Select" — select the piece's interior and stay in the project (G-062).
