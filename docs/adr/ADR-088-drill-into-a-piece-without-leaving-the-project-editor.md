# ADR-088: Drill into a piece without leaving the project editor

- Status: Pending
- Date: 2026-10-26
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

- In a project, the 1st tap on a piece selects it (as today). Further taps on the selected piece drill into its
  spaces one level per tap (ADR-083 `drill`, the tap mapped into the piece by `roomToPiece`), **and the editor stays
  on the project** (breadcrumb "Living", project panel, Compose tab still the project's).
- The store keeps a project-level space selection: `selectedItemId` plus `selectedId` inside that item, without
  `editItem`. After the innermost level the next tap wraps to the whole piece (G-051).
- The project's left panel shows, under "Selected piece", the selected space's controls (G-061) and the quick-count
  card shows over the project 3D, anchored on the space (ADR-085 placement). Each change edits that piece's design
  through the project's undo (ADR-051), never a copy saved elsewhere.
- "Edit this piece" stays the only way into the piece editor.
- Plan view (no height): the 2nd tap selects the piece's interior and stays in the project (G-062).

## Alternatives considered

- **Keep opening the piece editor, add a "Back to project" button** — the user called leaving the project the bug.
- **Long-press to drill, tap to open** — hidden gesture; long-press is the browser menu on phones.

## Scope

- In scope: the store change, drilling in project 3D and room front view, the space controls in the project panel,
  the card over the project 3D, regression test of the user's 3 steps, find-it update.
- Out of scope: piece-wide settings (size, materials, carcass) from the project panel — they stay behind "Edit this
  piece" (G-061 covers what the panel shows).

## Consequences

- Positive: shelves and dividers of any piece change without leaving the project or losing its view.
- Negative / risks: the project panel gets longer on a phone; a project space selection is a new store state that
  undo/redo, delete and load must keep valid. `tools/drill-select/find-it.mjs` expects the piece editor today.
- Harder to change later: the pair (`selectedItemId`, `selectedId`) becomes the project's selection.

## Done when

- [ ] Store test of the user's steps: open project, tap item, tap again → the editor is still the project
      (`editingItemId` unset), `selectedItemId` is the item, `selectedId` the space under the tap; a 4th tap at the
      innermost level selects the whole piece again.
- [ ] Shelves `+` on that space changes only that piece in the project; one undo restores it.
- [ ] Undo/redo, removing the piece and opening another project leave a valid selection (store test).
- [ ] `tools/drill-select/find-it.mjs` at 390 and 1280 px: from the bare app, open a project, tap a piece twice in
      3D; "Project" heading still shows, the space controls show, "More shelves" changes the parts count; the
      "Compose" tab still shows the project.
- [ ] lint, format:check, typecheck, test, build, docs:check pass.

## Answered questions

- Project panel for a selected space: user 2026-10-26 "Agree" — the space's full panel plus the quick-count card
  (G-061).
- Plan, 2nd tap: user 2026-10-26 "Select" — select the piece's interior and stay in the project (G-062).
