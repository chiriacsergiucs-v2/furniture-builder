# ADR-211: Editor and navigation follow-ups

- Status: Pending
- Date: 2026-11-06
- Depends on: ADR-012, ADR-079, ADR-106, ADR-120, ADR-123, ADR-159, ADR-171, ADR-191, ADR-194, ADR-203
- Design: docs/ui-design.md (section 4, Screens: editor and phone bottom sheet, project panel, New dialog)
- Backlog: N216
- Acceptance: browser

## Context

User 2026-11-06: "Do the same for next 50 gaps with no questions" (after accepting the suggested picks of the first
50); so these picks are accepted. Requests, in the gaps' words: G-027 "Help
with the sticky bars top and bottom, they occupy too much"; G-308 "Add the select to 3d, so i can click on them to
multiselect"; G-337 "Separate locks per parameter"; G-356 and G-358 "Not asked" (2026-11-05 critiques); G-388 "Adjust
the selecting to go from bigger to smaller"; G-126 "Add the posibility to change width/depth when whole cabinet or
whole piece is selected"; G-148 "accept as written (ADR-120 …)"; G-389 "Accept default, /batch all ready (G-156: keep
every version until the user deletes it)".

G-027's other half, the desktop mode switch in the top bar, conflicts with ADR-079 ("a segmented control under the app
bar") and stays out (G-452). ADR-191's ask before closing a dirty wizard stays; only its words change, since closing no
longer loses the answers. G-389 deletes a version only on the user's tap (ADR-012, G-156).

## Decision

1. **Bottom sheet drag with three stops (G-027).** On phones (≤ 760 px, Compose) `sheetOpen` becomes
   `sheetStop: 'peek' | 'half' | 'full'` (`App.tsx`). Peek is the 56 px row; half is today's open sheet (40 dvh,
   N82), still what a tap or a chosen project piece opens; full reaches the top bar and overlays the stage
   (ADR-112). A grab handle `.sheet-handle` on the peek row (`role="slider"`, name `t('Resize the sheet')`, value text `t('Collapsed')`, `t('Half')`, `t('Full screen')`; arrows step) follows the
   finger (`touch-action: none`) and snaps to the nearest stop; a move under 8 px is a tap (peek ↔ half, as now).
   Classes `sheet-open` (half, full) and `sheet-full`. Desktop is unchanged.
2. **Selection box in the front view (G-308).** `RoomFront` (`Project.tsx`) takes the plan's box rules (ADR-097): a
   press on empty space with a mouse or pen, or with Select on, draws a box; Shift/Ctrl/Cmd adds. New
   `itemsInFrontBox(project, a, b, placed)` (`src/core/selection.ts`) returns the pieces whose x and y extent touches
   the rectangle.
3. **Lock boards and Lock construction (G-337).** `ProjectItem` gets `boardsLocked?: true` and
   `constructionLocked?: true`, saved from project `schemaVersion` 22 (21 is planned by ADR-205); 20 and 21 files load
   unchanged, absent = unlocked (ADR-011). New `src/core/pieceLocks.ts`: `lockBlocked(project, id, next)` refuses a
   change of the boards (`materials`, `partMaterials`, `roleMaterials`, `roleBands`, `partBands` and the product's
   `*MaterialId` params) or of the construction (the params the Inspector's Construction group `g-build` edits, per
   kind in `CONSTRUCTION_KEYS`), wherever `resizeBlocked` and `sizeLockBlocked` already guard. Reasons
   `t('Boards locked — unlock to change')` and `t('Construction locked — unlock to change')`, also shown as the hint
   on the disabled groups. More actions adds `t('Lock boards')`/`t('Unlock boards')` and
   `t('Lock construction')`/`t('Unlock construction')` (`ru/project.ts`). `hasAnyLock` (snap) is unchanged.
4. **Wizard draft for the session (G-356).** Closing a new-piece wizard (`from` null) with answers keeps
   `{answers, stepId, done}` in `useUi` (memory only, never storage). The close ask reads
   `t('Close the wizard? Your answers stay as a draft until you close the app.')` with `t('Close')`. Next open, the
   Type step shows `t('Continue where you left off')` and `t('Start over')`; creating the piece or Start over clears
   it. A reopened piece keeps "Discard the answers?".
5. **Own glyphs on Start something new (G-358).** New icons `wall` and `room-plan` (`icons.tsx`) on the Fill a wall
   and Fill the room rows (`Dialogs.tsx`); Project keeps `project`. No new text.
6. **Up one level on phones (G-388).** At ≤ 760 px `Crumbs` (`Inspector.tsx`) shows a button
   `t('Up one level')` (`ru/inspector.ts`) that selects ADR-203's `parentOf(model, sel)`; hidden at the whole piece.
7. **Mattress size where a bed is selected (G-126).** `PieceSize` shows a bed's `Mattress width` (300–2200) and
   `Mattress length` (600–2300) as in Settings, via new `bedSizeFields`/`resizeBed` (`pieceSize.ts`); a width or
   depth lock disables the matching field. Loose panels stay without fields.
8. **Gaps, Research and Select (G-148).** `GapsPage` and `ResearchPage` show Back to the editor only when
   `designOpen` (as the Catalog, ADR-120); ADR ids stay. The three Select toggles get an `info` tip
   `t('About Select')`: `t('With Select on, each tap adds or removes a piece; with a mouse, Shift, Ctrl or Cmd-click does the same.')`,
   plus on the plan and front view `t(' A drag on empty space selects every piece it touches.')`.
9. **Versions of deleted projects (G-389).** New `listOrphanVersions()` (`src/persist/db.ts`): readable versions whose
   `projectId` has no project row; unreadable rows are skipped and kept. History (`History.tsx`) adds a folded
   `t('Versions of deleted projects ({n})')`, shown when any exist, each with `t('Restore as a new project')` (saves a
   copy with a new id named `t('{name} (restored)')` and opens it; the version stays) and Delete (existing confirm and
   `deleteProjectVersion`, only on that tap). Nothing deletes versions automatically.

Every new text has its Russian entry (ADR-153); each visible change adds its feature line (`src/core/features.ts`).

## Alternatives considered

- **G-027: two stops only** — too little room for a long editor on a phone.
- **G-308: a box in 3D too** — the drag already orbits the camera; the gap's pick is the front view only.
- **G-337: one Lock everything** — the user asked for separate locks per parameter.
- **G-389: the list on the Projects page** — the pick names History; reachable without a project is G-454.

## Scope

- In scope: decisions 1–9, their tests, translations and feature lines.
- Out of scope: the desktop mode switch in the top bar (G-452); locking a piece's insides (G-453); the orphaned
  versions list with no project open (G-454).

## Consequences

- Positive: the phone sheet sizes to the task; locks cover boards and construction; kept versions stay reachable.
- Negative / risks: project schema 22 (renumbered if a sibling ADR ships first); the orphan list needs a project open.
  Harder to change later: the two lock flags in saved projects.

## Done when

- [ ] Lock boards and Lock construction refuse their changes with the reason; size and place still change; schema 20
      and 21 projects load unchanged (`tests/param-locks.test.ts`).
- [ ] `itemsInFrontBox`, `bedSizeFields` and `resizeBed` return the expected pieces and sizes (tests).
- [ ] `listOrphanVersions` lists only readable versions without a project and keeps unreadable rows; Restore saves a
      new project and keeps the version; Delete removes only the tapped one (`tests/history.test.ts`).
- [ ] Every new text has its Russian entry (`pnpm typecheck`).
- [ ] `tools/editor-nav/find-it.mjs` (production build, 390 px touch): dragging "Resize the sheet" reaches full, half
      and peek; arrow keys step; "Up one level" selects the parent space; a bed shows "Mattress width".
- [ ] The same script at 390 and 1280 px: a front-view drag box selects two pieces; "Lock boards" disables Boards
      with its hint; "About Select" opens; Gaps and Research show no Back with no design open.
- [ ] The same script: a closed New piece wizard reopens with "Continue where you left off" on its step; the Fill a
      wall and Fill the room rows have different glyphs.
- [ ] The same script: after deleting a project and keeping its versions, History lists "Versions of deleted
      projects"; Restore as a new project opens it; Delete asks and removes one.
