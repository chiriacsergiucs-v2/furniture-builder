# UI audit 01 — Creating: sub-flow map and bug hunt

- Date: 2026-11-10
- Domain: Creating (`src/ui/info/features.ts:29-118`, 14 feature lines)
- ADR: [ADR-248](../adr-done/ADR-248-ui-audit-creating-one-tap-one-saved-checked-thing.md)
- Method: code reading with file:line citations; reproductions run as throwaway jsdom tests outside the repo
  (vitest with a scratch config over `tests/find-it/setup.tsx`, at 1280 px). No repo source was changed.

## Sub-flow map

Reachability: **P** = phone 390 px, **D** = desktop 1280 px. Entry points are the same at both widths unless noted.
The New dialog is `NewDialog` (`src/ui/Dialogs.tsx:148-292`), mounted once in `src/ui/App.tsx:1078-1086`.

| #   | Feature line (features.ts)                     | Sub-flow: entry → steps → end state                                                                                                                                                         | Code                                                                                                         | Covering test                                                         | P/D |
| --- | ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------- | --- |
| 1   | Start a new single piece (:32)                 | ⋯ More → New… → Start from → pick a template → `load(d)` → editor with the piece                                                                                                            | `MoreMenu.tsx:116-119`, `Dialogs.tsx:278-286`, `Catalog.tsx:197`                                             | `tests/find-it/start-new.test.tsx`                                    | P D |
| 2   | New-piece wizard (:38)                         | New… → New piece, step by step **or** Catalog → New piece → Type → steps → Review → Create piece → `saveDesign` → `load` → editor                                                           | `Dialogs.tsx:212-227`, `CatalogPage.tsx:285`, `Wizard.tsx:799-827`                                           | `tests/find-it/wizard.test.tsx`                                       | P D |
| 3   | Suggested combinations in the wizard (:45)     | A step with a generator → cards → Use → answers set, covered steps marked done → next open step                                                                                             | `Wizard.tsx:791-798`, cards `Wizard.tsx:532-577`                                                            | `tests/find-it/wizard.test.tsx`                                       | P D |
| 4   | Reopen a piece in the wizard (:51)             | Piece Settings → Open in wizard → stored answers → Update piece → `createPiece(…, from)` → `saveDesign` → `load`                                                                            | `App.tsx:1107`, `Wizard.tsx:599-640`, `Wizard.tsx:799-827`                                                   | `tests/find-it/wizard.test.tsx`, `piece-safety.test.tsx`              | P D |
| 5   | Keep a closed wizard as a draft (:57)          | Wizard with answers → × or Esc → confirm → `setWizardDraft` (memory only) → New piece again → Continue where you left off / Start over                                                      | `Wizard.tsx:602-627`, `Wizard.tsx:750-768`, `Wizard.tsx:862-875`, `src/store/uiStore.ts:6,73,126`           | `tests/find-it/wizard.test.tsx`                                       | P D |
| 6   | Reopen a project piece in the wizard (:64)     | Project piece → Settings → Open in wizard → Update piece → `replaceDesign` (one edit, project copy only; a lock refuses with its reason)                                                     | `Wizard.tsx:805-812`                                                                                         | `tests/find-it/piece-safety.test.tsx`                                 | P D |
| 7   | Create a project (:70)                         | (a) New… → Project with several pieces → `saveProject` awaited → open; (b) Projects page → Create a new project → name → Create project → `void saveProject` → open                         | (a) `Dialogs.tsx:184-200`; (b) `shell/ProjectsPage.tsx:108-115`, button `:262`                              | (a) `start-new.test.tsx:160-198`; (b) many, none with a failing save  | P D |
| 8   | Create a project from a project template (:76) | Projects page → project template row → Create project → name → `projectFromTemplate` kept in `created` ref → `saveProject` → open; failure shows the error with retry                      | `ProjectTemplates.tsx:225-250`, `:375-410`                                                                    | `tests/find-it/template-keeps.test.tsx`, `tests/project-actions.test.tsx` | P D |
| 9   | Fill a wall (:83)                              | New… → Fill a wall → Wall (width, depth, height) → Show suggestions → cards → Refine → Suggest again → Use this mix → `saveProject` → open                                                  | `WallFill.tsx:230-505`, core `src/core/wallfill.ts`                                                          | `tests/find-it/fill-wizards.test.tsx`, `start-new.test.tsx`          | P D |
| 10  | Make a new piece inside a project (:93)        | Project → Add a piece → New piece, step by step → wizard (`toProject`) → Add to project → `saveDesign` + `addPiece`                                                                         | `Project.tsx:2934-2990`, `App.tsx:937`, `Wizard.tsx:814-822`                                                 | `tests/find-it/board-choices.test.tsx`, `save-to-catalog.test.tsx`    | P D |
| 11  | Fill the room (:94)                            | (a) New… → Fill the room → Room → Walls → Show suggestions → Use this mix → new project; (b) in a project with a room: ⋯ More → Files → Fill the room… → Walls → Add this mix → `fillRoom` | `Dialogs.tsx:262-276`, `MoreMenu.tsx:144-149`, `RoomFill.tsx:303-410`, `src/store/designStore.ts:1814-1821` | `tests/find-it/roomfill.test.tsx`, `room-presets.test.tsx`            | P D |
| 12  | Fill the room in L and U rooms (:101)          | As 11, shape L or U; one corner kept when a wall is too short                                                                                                                               | `src/core/roomfill.ts` (ADR-216)                                                                             | core tests (`tests/roomfill*.test.ts`)                                | P D |
| 13  | Template descriptions in Start from (:105)     | New… → Start from → each built-in row shows its description                                                                                                                                 | `Catalog.tsx:191-194`, `:274`                                                                                | `tests/find-it/start-from-descriptions.test.tsx`                      | P D |
| 14  | Room presets (:111)                            | New… → Room preset (expands) → a preset → `projectFromTemplate` → `saveProject` → open                                                                                                      | `Dialogs.tsx:298-371`, core `src/core/catalog/roomPresets.ts`                                                | `tests/find-it/room-presets.test.tsx`                                 | P D |

## Bug hunt

Each check below was applied to every sub-flow: empty / error / offline-storage failure / reload, double tap, edge input, i18n, accessibility (role, label, focus, invalid state), 390 px, ADR-004 and ADR-008, selector stability, persistence. Only what failed is listed. Classes: **Proven** (reproduced, output quoted), **Code-evident** (cited, not run), **Suspected**.

### D01-F1 — A double tap on a room preset makes two projects (Proven, major)

`RoomPresets.use` (`Dialogs.tsx:303-313`) has no in-flight guard and calls `projectFromTemplate` (new ids) on every tap. The sibling "Project with several pieces" row is guarded since ADR-193 (`Dialogs.tsx:177-200`, test `start-new.test.tsx:180-197`); project templates keep the made project in a ref (`ProjectTemplates.tsx:225,389-392`).
Reproduction: New… → Room preset → `user.dblClick` on "Home office…" → `F1 projects added by a double tap: 2`.

### D01-F2 — Projects page "Create project" opens an unsaved project and says nothing when storage fails (Proven, major)

`ProjectsPage.create` (`shell/ProjectsPage.tsx:108-115`) calls `void saveProject(p)` and opens the project at once. A failing save is an unhandled rejection; the user sees the editor and no alert. The New dialog path saves first and reports the failure (ADR-193, `Dialogs.tsx:184-200`).
Reproduction: `saveProject` rejecting with `QuotaExceededError` → Create a new project → Create project → `F2 editor opened: true alerts: []` and vitest "Unhandled Rejection: Error: QuotaExceededError".

### D01-F3 — "Add this mix" adds pieces on top of the pieces already in the project (Proven, major)

In a project, ⋯ → Fill the room… builds each mix as its own project (`roomfill.ts:1033-1045`, `newProject(name)` with the room only) and keeps it when that project has no error (`roomfill.ts:906-909`). `fillRoom` then appends the mix to the open project with no check against its pieces (`designStore.ts:1814-1821`). The card says "each checked for problems" (`RoomFill.tsx:708`).
Reproduction: New… → Fill the room → Use this mix (32 pieces, 0 errors) → ⋯ → Fill the room… → Show suggestions → Add this mix → `F3 errors after: 32 items 64 [ 'pieces-overlap' ]`. The existing find-it test (`roomfill.test.tsx:44-63`) does the same on a wall already filled and only counts pieces.

### D01-F4 — Wizard "Create piece" / "Add to project" double tap saves two pieces (Proven, major)

`Wizard.create` (`Wizard.tsx:799-827`) awaits `saveDesign` with no in-flight guard; the button is only disabled on errors (`Wizard.tsx:1035-1044`). `createPiece` makes a new id each call. With `toProject`, both copies are also added to the project.
Reproduction: Catalog → New piece → Cabinet → Next… → `user.dblClick` on Create piece → `F5 designs added by a double tap: 2`.

### D01-F5 — Some invalid answers are named but their field is not marked (Proven / Code-evident, minor)

- Fill a wall: "Tall cabinet height" and "Wall cabinet depth" get no `problem` prop (`WallFill.tsx:410-418`) though `checkWall` reports them (`wallfill.ts:203-204`). Proven: after `-5` in three fields → `Tall cabinet height aria-invalid= null`, `Wall cabinet depth aria-invalid= null`, `Wall cabinet height aria-invalid= true`. Fill the room marks both (`RoomFill.tsx:606-616`).
- Fill the room: "Walkway width" (`RoomFill.tsx:693-698`) — the `room-island` issue has no field (`roomfill.ts:471-477`), so `fieldOf` returns nothing (`RoomFill.tsx:167-172`). Code-evident.
- Fill the room: "Budget ceiling" not an amount shows an error alert (`RoomFill.tsx:676-681`) but the field is not `aria-invalid`. Code-evident.

### D01-F6 — "Fill the room…" sits inside the More menu's "Files" group (Code-evident, minor)

`MoreMenu.tsx:121-149`: the button is a child of `role="group" aria-labelledby="menu-files"`, so a screen reader announces it as a file action; it creates pieces, like New…, which sits above the group (`MoreMenu.tsx:116-119`).

### D01-F7 — Room preset error: other wording, and it stays after the dialog is closed (Code-evident, minor)

`RoomPresets` keeps `error` and `shown` in its own state (`Dialogs.tsx:300-303`) while `NewDialog` stays mounted (`App.tsx:1078`), so an old error shows on the next opening; `NewDialog` clears its own error on each opening (`Dialogs.tsx:170-175`). Its text "The project could not be created on this device." differs from the row above it, "The project could not be saved in this browser’s storage." (`Dialogs.tsx:196`).

### D01-F8 — The draft offer has buttons but no sentence (Code-evident, minor)

The `role="status"` box (`Wizard.tsx:862-875`) holds only "Continue where you left off" and "Start over"; nothing says a draft exists or how old it is, and the status announcement reads only the button labels.

### D01-F9 — A draft from one project's wizard resumes in another context with that project's board (Rejected in FLOW 02: named as an error, not silent)

The draft stores answers only (`uiStore.ts:6`, `Wizard.tsx:756-758`), not whether it was started from a project. The Board answer can name a board of project A (`setWizardBoards`, `Wizard.tsx:701-711`); continued in project B or from New…, that board may not be offered. Not reproduced.

## Checked, no finding

- Fill a wall "Use this mix" double tap: the mix's project has fixed ids (`WallFill.tsx:271-280`), so a second save overwrites the same row — no duplicate.
- Project template create: guarded and retry keeps the same project (`ProjectTemplates.tsx:235-250`, `:389-392`).
- New… → Project with several pieces: guarded and failure reported (`Dialogs.tsx:177-200`).
- Wizard close guard and backdrop (ADR-191): `Wizard.tsx:599-627`, `Dialogs.tsx:120-124`.
- Every visible text in the files read goes through `t()`/`tr()`; no untranslated literal found.
