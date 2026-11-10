# UI audit 14 — Projects: sub-flow map and bug hunt

- Date: 2026-11-10
- Domain: Projects (`src/ui/info/features.ts:1153-1268`, 25 feature lines)
- ADR: [ADR-260](../adr/ADR-260-ui-audit-projects-failures-said-no-false-updated.md)
- Method: code reading with file:line citations; reproductions run as throwaway jsdom tests outside the repo
  (vitest with a scratch config over `tests/find-it/setup.tsx`, at 1280 px; `src/persist/db` mocked for storage
  failures as `tests/find-it/start-new.test.tsx:11-20` does). No repo source was changed. The quoted output keeps the scratch
  test's own labels, numbered before the findings were ordered: `D14-F2` output is finding F4, `D14-F3` is F2,
  `D14-F4` is F3.

## Sub-flow map

Reachability: **P** = phone 390 px, **D** = desktop 1280 px. The Projects page is `ProjectsPage`
(`src/ui/shell/ProjectsPage.tsx:51-347`); on a phone (`max-width: 520px`, `ProjectsPage.tsx:36`) a row's Settings,
Duplicate and Delete fold into a ⋯ menu (`RowMenu`, `ProjectsPage.tsx:353-416`). The project side panel is
`ProjectPanel` (`src/ui/Project.tsx:169`); on a phone it is the Compose bottom sheet with its handle and peek row
(`src/ui/App.tsx:907,917`).

| #   | Feature line (features.ts)                         | Sub-flow: entry → steps → end state                                                                                                                              | Code                                                                                                            | Covering test                                                                              | P/D |
| --- | -------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ | --- |
| 1   | Several pieces in one room, combined lists (:1157) | Open a project → Add a piece (several) → Output lists every piece's parts together                                                                               | `designStore.ts:1029-1036` (`addPiece`), `buildProjectModel` (`designStore.ts:852`)                             | `tests/project.test.ts`, `tests/project-rows-golden.test.ts`                               | P D |
| 2   | Projects page (:1162)                              | Projects → row → open; Settings / Duplicate / Delete (⋯ on a phone) → confirm → list read again                                                                  | `ProjectsPage.tsx:128-164` (duplicate, remove), `:166-243` (row), `:353-416` (RowMenu)                          | `tests/find-it/projects-duplicate.test.tsx`; delete failure: no test found                 | P D |
| 3   | Ask about kept versions when deleting (:1168)      | Delete project → Confirm → "Also delete its N kept versions?" → Keep them (default, Esc) / Delete versions                                                       | `ProjectsPage.tsx:146-161`, `persist/db.ts:401-402`                                                             | `tests/project-delete-versions.test.ts`, `tests/find-it/piece-safety.test.tsx`             | P D |
| 4   | Versions of deleted projects (:1174)               | Open a project → History → Versions of deleted projects (N) → Restore as a new project → saved copy opens / Delete → confirm                                     | `src/ui/History.tsx:237-344`, `persist/db.ts:377-393`                                                           | `tests/orphan-versions.test.ts`, `tests/find-it/editor-nav.test.tsx`, `library-saves.test.tsx` | P D |
| 5   | Resize the phone sheet (:1180)                     | Phone editor → drag the handle → snaps to Collapsed / Half / Full; tap toggles; arrow keys, Home, End step                                                       | `src/ui/SheetHandle.tsx:40-126`, `App.tsx:907`                                                                  | `tests/find-it/editor-nav.test.tsx`                                                        | P   |
| 6   | Own glyphs for Fill a wall / Fill the room (:1186) | New… → the two rows show their own icons                                                                                                                         | `src/ui/Dialogs.tsx:251,267`                                                                                    | no test found (visual only)                                                                | P D |
| 7   | Back to the editor only with a design open (:1190) | Gaps / Research page → "Back to the editor" shown only when a design or project is open                                                                          | `src/ui/Research.tsx:96,155`, `src/ui/Gaps.tsx:48,194`, `App.tsx:238-241`                                       | `tests/find-it/editor-nav.test.tsx`, `catch-up-editor.test.tsx`                            | P D |
| 8   | Add a piece from a list with pictures (:1196)      | Compose → Add a piece → dialog lists built-in items, saved pieces and project templates with pictures → tap → piece added and placing                             | `Project.tsx:2934-3090` (`AddPieceList`), `designStore.ts:1029-1036`                                            | `tests/find-it/setup.tsx:132-149` (used by most find-it tests)                             | P D |
| 9   | Tap the plan to place (:1197)                      | After Add: the plan waits (`placingItemId`) → tap a spot or "Place to the right" → piece placed                                                                  | `Project.tsx:1494,1671`, `designStore.ts:1035`                                                                  | `tests/find-it/history.test.tsx`, `kitchen-follow-ups.test.tsx`                            | P D |
| 10  | Drag a catalog item onto the plan (:1198)          | Desktop list beside the plan → drag an item → drop → `addPieceAt` (snapped drop connects)                                                                        | `src/ui/pieceDrag.ts`, `Project.tsx:86`, `designStore.ts:1037-1048`                                             | `tests/drop-new-piece.test.ts`                                                             | D   |
| 11  | Insert a project template (:1199)                  | Add a piece → Project templates → tap → `insertTemplate` → notice of kept variables and dropped wall links                                                       | `Project.tsx:3040-3080`, `designStore.ts:1595-1603`                                                             | `tests/history.test.ts`, `tests/find-it/template-keeps.test.tsx`                           | P D |
| 12  | Replace a piece (:1200)                            | Select a piece → More actions → Replace… → list (same width; "Show other widths") → tap → confirm if edited → `replaceItem` → notice                             | `src/ui/Replace.tsx:27-121`, `Project.tsx:960,1072`                                                             | `tests/replace.test.ts`, `tests/find-it/selected-piece.test.tsx`                           | P D |
| 13  | Template updated notices (:1206)                   | A piece whose catalog template has a newer revision → notice on the card and on the Projects row → Update / Keep mine                                            | `src/ui/TemplateRevision.tsx:25-160`, `ProjectsPage.tsx:70-85`                                                  | `tests/template-revision.test.ts`                                                          | P D |
| 14  | Template references (:1207)                        | Every project change runs `syncRef` so a catalog piece keeps only its overrides                                                                                  | `designStore.ts:806-808`                                                                                        | `tests/template-revision.test.ts`                                                          | P D |
| 15  | Undo and redo with named steps (:1213)             | Top bar Undo / Redo (Ctrl+Z, Ctrl+Y) → `undoProject` / `redoProject`; titles name the step                                                                       | `App.tsx:203-245,767-772`, `designStore.ts:1543-1566`                                                           | `tests/project-undo.test.ts`, `tests/history.test.ts`                                      | P D |
| 16  | Edit history (:1218)                               | Settings/History → Edit history → list "As opened", steps, undone steps → tap → `jumpProject`                                                                    | `History.tsx:347-387`, `designStore.ts:1567-1576`                                                               | `tests/find-it/history.test.tsx`                                                           | P D |
| 17  | Version history (:1219)                            | History → Save a version / Restore (current kept first) / Delete; Retry on a read failure                                                                        | `History.tsx:29-230`, `src/store/versions.ts:11-40`                                                             | `tests/history.test.ts`, `tests/find-it/history.test.tsx`                                  | P D |
| 18  | Save as a project template (:1220)                 | Settings → Save as project template → name, Include the room → Save; a failure keeps the dialog                                                                  | `src/ui/ProjectTemplates.tsx:22-160`                                                                            | `tests/project-actions.test.tsx`, `tests/find-it/template-keeps.test.tsx`                  | P D |
| 19  | Project variables and formulas (:1221)             | Settings → Variables → New variable + Value → Add; ƒ beside a field → Bind sheet → Bind / Unbind                                                                 | `src/ui/Variables.tsx:105-260` (BindControl), `:363-520` (ProjectVariables)                                     | `tests/variables.test.ts`, `tests/find-it/variables.test.tsx`                              | P D |
| 20  | Variables in a piece (:1228)                       | Piece settings → Variables → add → ƒ beside width/height/depth/underside height                                                                                  | `Variables.tsx:265-361` (DesignVariables)                                                                       | `tests/find-it/piece-variables.test.tsx`                                                   | P D |
| 21  | Formula functions (:1235)                          | Type `min(…)`, `max`, `floor`, `ceil`, `round`; comma or semicolon                                                                                               | `src/core/variables.ts`                                                                                         | `tests/variables.test.ts`                                                                  | P D |
| 22  | Comparisons, if, stepped rounding (:1242)          | Type `if(a > b, x, y)` and stepped `round` in a variable or binding                                                                                              | `src/core/variables.ts`                                                                                         | `tests/variables.test.ts`                                                                  | P D |
| 23  | Value sets (:1247)                                 | Settings → Variables → Add set → values → duplicates drawn → Save as separate project → "Keep the set?" → Saved note with Open                                   | `Variables.tsx:526-700`, `src/core/sets.ts:43-48,488-…`                                                         | `tests/sets.test.ts`; UI failure and double tap: no test found                            | P D |
| 24  | Side panel ordered by use (:1254)                  | Add a piece at the top; one piece selected → All pieces (N), Previous / Next piece; toolbar; More actions (Open in the piece editor, Rename…, Replace…, Save to catalog, Update from saved piece, locks, Mirror the run, Remove) | `Project.tsx:286-345`, `:848-1072`, `:225-243` (Update from saved piece)                                         | `tests/find-it/selected-piece.test.tsx`; Update from saved piece: no test found            | P D |
| 25  | Quick actions on the phone sheet (:1261)           | Phone, sheet closed, one piece selected → peek row Edit / Duplicate / Turn; none selected → Add                                                                  | `Project.tsx:569-622`, `App.tsx:917`                                                                            | `tests/find-it/phone-editor.test.tsx`                                                      | P   |

## Bug hunt

Each check below was applied to every sub-flow: empty / error / storage failure / reload, double tap, undo/redo,
edge input, locked pieces, i18n, accessibility (role, label, focus, invalid state), 390 px, ADR-004 and ADR-008,
selector stability, persistence. Only what failed is listed. Classes: **Proven** (reproduced, output quoted),
**Code-evident** (cited, not run), **Suspected**.

### D14-F1 — Delete on the Projects page says nothing when storage refuses it (Proven, major)

`ProjectsPage.remove` (`ProjectsPage.tsx:136-164`) awaits `deleteProject` / `deleteDesign` /
`deleteProjectVersions` with no `catch`; the callers drop the promise (`void remove(r, kind)`, `:207,235`). The same
page reports a failed read and a refused duplicate in its message line (`:89-97`, `:133`).
Reproduction: a saved project "Old kitchen", `deleteProject` rejecting with `QuotaExceededError` → Delete Old kitchen
→ Confirm Delete → `D14-F1 alerts: [] row still listed: true unhandled: [ 'Error: QuotaExceededError' ]`.

### D14-F2 — Value set "Save as separate project": a double tap saves two projects, a failed save is silent (Proven, major)

`ValueSets.save` (`Variables.tsx:534-544`) has no in-flight guard and no `catch`; `projectFromSet` makes new ids each
call (`sets.ts:502`), and the button passes the promise to nobody (`onSave={() => save(set)}`, `:561`). ADR-193 and
ADR-247 set the rule "one tap makes one thing, a failure is said" for creation paths.
Reproduction: Settings → Variables → `w` = 400 → Add set → value 500 → `user.dblClick` on Save as separate project →
`D14-F3 projects added by a double tap on Save as separate project: 2`; with `saveProject` rejecting →
`D14-F3 failed save → alerts: [] confirm dialogs: 0 unhandled: [ 'Error: QuotaExceededError' ]`.

### D14-F3 — "Update from saved piece" on a size-locked piece says "Updated" while the update was refused (Proven, major)

`updateFromLibrary` (`Project.tsx:225-243`) calls `updateItem` and then always sets "Updated from the saved piece.".
`updateItem` (`designStore.ts:1049-1057`) drops the refusal that `commitProject` returns (`designStore.ts:810-823`,
the size lock of ADR-122). The panel then shows "Updated" beside the refusal notice, and the piece is unchanged.
Reproduction: saved piece 800 mm wide; the project copy 1000 mm, size locked → More actions → Update from saved piece
→ Replace → `D14-F4 saved width 800 item width now 1000 | notice: Saved base has its size locked — unlock its size to
change it. | panel says Updated: true`.

### D14-F4 — Projects page Duplicate: a double tap makes two copies (Proven, minor — Rejected in FLOW 02)

`duplicate` (`ProjectsPage.tsx:128-135`) has no in-flight guard. Reproduction: `user.dblClick` on Duplicate Hall →
`D14-F2 copies made by a double tap: 2`.

### D14-F5 — Edit history "As opened" is not the project as opened after 100 steps (Proven, minor)

The history keeps the last 100 steps (`HISTORY = 100`, `designStore.ts:614`; `.slice(-HISTORY)`, `:856-861`). The
first row of Edit history is always labelled "As opened" and jumps back by every kept step (`History.tsx:357-360`).
Reproduction: open a project, 101 kerf changes, jump to "As opened" →
`D14-F5 kept steps 100 | after As opened kerf = 1 (as opened: undefined)`.

### D14-F6 — Three lists show a storage read failure as "nothing there" (Code-evident, minor)

- Add a piece: saved pieces `listDesigns().catch(() => setSaved([]))` (`Project.tsx:2954-2957`) and project templates
  `listProjectTemplates().catch(() => setProjectTemplates([]))` (`Project.tsx:2963-2966`).
- History → Versions of deleted projects: `listOrphanVersions().catch(() => setRows([]))` (`History.tsx:245-247`); the
  group then renders nothing (`:262`).

The Projects page (`ProjectsPage.tsx:89-97`) and the project's own versions (`History.tsx:57-62,132-139`, with Retry)
say "could not be read" for the same failure.

### D14-F7 — A variable or formula with a problem is named but its field is not marked (Code-evident, minor)

- Project and piece variables: the value input (`Variables.tsx:333-340`, project `:466-473`, Compose strip `:760`) has no
  `aria-invalid`; the problem is in a sibling `<span role="alert">` (`:343-348`, `:475-480`) not tied to the field by `aria-describedby`.
- Bind sheet: the Formula input (`Variables.tsx:230-238`) is not `aria-invalid` while the alert under it names the
  problem (`:240-248`).
- Value set rows: an erroneous value shows only a red class, no role and no `aria-invalid` (`Variables.tsx:626-645`).
- The name check (`nameProblem`, `:275-279`, `:407-411`) shows its alert under the add row without marking "New variable".

## Checked, no finding

- Version history Save / Restore / Delete: one in-flight ref, failures said, a project switch drops stale messages
  (`History.tsx:46,71-85`, ADR-200).
- Versions of deleted projects: Restore and Delete are busy-guarded and say their failures (`History.tsx:263-299`).
- Save as a project template: in-flight ref, failure kept in the dialog for retry (`ProjectTemplates.tsx:46-62`).
- Ask about kept versions: Keep is the default and Esc deletes none (`ProjectsPage.tsx:147-159`, ADR-203).
- Delete on the open row is disabled at both widths (`ProjectsPage.tsx:232`, `:408-411`).
- Undo and redo wait while a piece is open in the piece editor (`designStore.ts:1547,1558`; Edit history disabled,
  `History.tsx:106-107`).
- Resize the phone sheet: `role="slider"` with label, value text and keys (`SheetHandle.tsx:106-125`).
- Previous / Next piece wrap around and are disabled with one piece (`Project.tsx:269-273,317-337`).
- Zustand selectors in the files read return stored values or primitives; no `.filter`/`.map` inside a selector.
- Every visible text in the files read goes through `t()`/`tr()` with a Russian entry; the Gaps page's literal "Back
  to the editor" (`Gaps.tsx:194`) is untranslated by the user's rule.
- Rows 6, 10, 13, 14, 21, 22: read for the checks above, no failure found; their core logic is covered by the tests
  named in the map.
