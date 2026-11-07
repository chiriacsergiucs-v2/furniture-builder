# ADR-203: Keep project pieces safe while editing them

- Status: Implemented
- Date: 2026-11-06
- Implemented: 2026-11-06
- Depends on: ADR-012, ADR-034, ADR-046, ADR-076, ADR-083, ADR-093, ADR-095, ADR-102, ADR-121, ADR-123, ADR-125
- Design: docs/ui-design.md (section 4, editor screen; Plan view, 3D view)
- Backlog: N208
- Acceptance: browser

## Context

User goal (2026-11-06): "in groups of 7-10 gaps create adrs, no implementation". Nine gaps where editing a project
piece, its versions or templates surprises the user. Requests, in the gaps' words: G-106 "Not a quote: ADR-095 'Nothing moves it for the user'"; G-172, G-190 and
G-211 "Accept default, /batch all ready"; G-053 "Adjust the selecting to go from bigger to smaller … iteratively";
G-105 "New adr to override the conflicts for 4 and make it ready"; G-359, G-363 and G-365 "Not asked; noted in the
2026-11-05 design critique". User accepted the gaps' suggested picks on 2026-11-06.

No gap's Conflicts line names an implemented ADR. G-190 keeps ADR-012 and G-156: versions are deleted only when the
user picks that in the delete dialog. No change to `src/core/types.ts`, the design or project document or the Dexie
schema, so no `schemaVersion` bump (ADR-011).

## Decision

1. **Resizing a base under a locked piece is refused (G-106).** `resizeBlocked` (`src/core/sizeLock.ts`) also
   refuses an edit of piece P that changes its outside size when `carriedBy(project, P)` holds a locked piece, as
   `moveBlocked` does for a move. Reason `t('{name} sits on {base} and is locked — unlock it to resize {base}.')`
   (`ru/core.ts`), shown as the store `notice`. Unlocked pieces on it still follow.
2. **Angled outlines turn with the piece (G-172).** In `Viewer3D.tsx` the `SelectionOutline` of a space or piece
   inside an angled piece and the Move-mode `MoveGhost` get the same turn its panels get (`yawed`, ADR-121).
   No new text.
3. **Ask about versions on project delete (G-190).** After the existing delete confirm in `ProjectsPage.tsx`, when
   `listProjectVersions(id)` returns any, a second `askConfirm` asks
   `t('Also delete its {n|# kept version|# kept versions}?')`, buttons `t('Delete versions')` and
   `t('Keep them')` (`ru/catalog.ts`). Keep is the default: Esc, × and Keep delete nothing. Delete removes only the
   rows that list returned (new `deleteProjectVersions(ids)` in `src/persist/db.ts`); unreadable rows stay (ADR-012).
4. **Run handle shown in the piece editor (G-211).** New `runHandleFor(project, itemId)` (`src/core/project.ts`)
   returns the run handle that reaches the piece (`runHandleMembers`, not in `own`). While one applies, the
   Inspector's Doors and handles section shows its kind and hole spacing read-only, under
   `t('Set by Handles for this run')` (`ru/inspector.ts`), in place of the piece's handle controls. The piece's own
   handles stay in its design, untouched.
5. **Open in wizard inside a project (G-359).** Settings shows Open in wizard for a wizard-made piece opened from a
   project (`editingItemId` set, `design.wizard` present). Update piece then replaces that project item's design as
   one edit of the open piece, through the store's `commit`, so it stays in the project's own copy (ADR-022), never
   the library, and size locks (ADR-122) and decision 1 apply. Existing texts only.
6. **Warn when an imported template shadows an edited family (G-363).** In `Catalog.tsx` `importLocal`, a valid
   template whose `shadows` is already shadowed on the device, or earlier in the same file, asks
   `t('“{name}” is already edited on this device. Keep yours or use the imported one?')` with `t('Keep mine')` and
   `t('Use the imported one')` (`ru/catalog.ts`). Keep mine is the default and skips the imported one; Use the
   imported one replaces the device's edit only on that explicit choice. The summary adds
   `t(', {n} kept as they were')` (`ru/catalog.ts`).
7. **Handle side on a turned corner wing (G-365).** A test builds an L-corner whose wing-B door is hinged left and
   checks, in room coordinates after the quarter turn, that its handle holes sit on the door edge away from its
   hinge holes. A wrong side is a bug fixed in `src/core/corner.ts` in this ADR. No new text.
8. **Esc goes up one level (G-053).** New `parentOf(model, sel)` in `src/core/selectPath.ts`: a space → its parent
   space, a top space → the whole piece (`null`), the whole piece → nothing (`undefined`). In the piece editor the
   app's Esc (`App.tsx`) selects `parentOf` instead of clearing; dialogs and drags still take Esc first (ADR-160).
9. **Move and turn display-only models in 3D (G-105).** In Move mode a model's mesh takes the same drag as a piece
   (`pieceDrag.ts`, `floorDrop`, Snap as for pieces); the drop sets `position.x`/`z` through `updateProject`, one undo
   step. The Turn 90° buttons also show for a selected model and change `rotationY` by ±90 keeping its centre.
   Existing texts.

Each visible change adds its line to the feature tree (`src/core/features.ts`, ADR-158).

## Alternatives considered

- **G-106: keep the locked piece in place, leaving its base** — the piece would then float or clash; refusing
  matches how a move of the base is refused.
- **G-190: list orphaned versions on a page** — a new screen; asking at delete covers new deletes.
- **G-363: keep both as separate families** — leaves two near-identical families.
- **G-053: long press on phones too** — clashes with tap-to-drill; kept as a gap (G-388).

## Scope

- In scope: decisions 1–9, their tests, translations and feature-tree lines.
- Out of scope: a long-press "up one level" on phones (G-388); versions already left by projects deleted before this
  ADR (G-389).

## Consequences

- Positive: locks hold through resizes; 3D and the editor show what applies; nothing is lost silently.
- Negative / risks: one more dialog on project delete and on some imports. Harder to change later: none.

## Done when

- [x] Resizing a base under a locked piece is refused with the reason; an unlocked piece on it still follows
      (`tests/lock.test.ts`).
- [x] `runHandleFor` and `parentOf` return the expected handle and levels (`tests/run-handles.test.ts`,
      `tests/select-path.test.ts`).
- [x] The L-corner wing-B handle holes sit away from the hinge holes (`tests/corner-mount.test.ts`).
- [x] Deleting a project with versions asks; Keep leaves every version, Delete removes only readable ones; an
      import that shadows an edited family asks and Keep mine changes nothing (storage tests).
- [x] Every new text has its Russian entry (`pnpm typecheck`).
- [x] `tools/piece-safety/find-it.mjs` on the production build at 390 and 1280 px finds "Also delete its",
      "Set by Handles for this run", "Open in wizard" in a project piece's Settings, and Esc going up one level.
- [x] The same script, in 3D Move mode, drags and turns a display-only model and checks an angled piece's selection
      outline is turned with it.
