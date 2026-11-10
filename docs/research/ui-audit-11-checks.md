# UI audit 11 — Checks and problems: sub-flow map and bug hunt

- Date: 2026-11-10
- Domain: Checks and problems (`src/ui/info/features.ts:860-894`, 6 feature lines)
- ADR: [ADR-258](../adr-done/ADR-258-ui-audit-checks-piece-guidance-listed-repairs-told.md)
- Method: code reading with file:line citations; reproductions run as throwaway tests outside the repo (vitest with a
  scratch config: core in node, the app in jsdom over `tests/find-it/setup.tsx` at 1280 px). No repo source was
  changed.

## Sub-flow map

Reachability: **P** = phone 390 px, **D** = desktop 1280 px. Checks is the last tab of the Results panel
(`src/ui/Output.tsx:47-52`); on a phone the panel stays collapsed until a tab is tapped (ADR-091, `Output.tsx:33-35`).
In a project the list is `projectModel.diagnostics` (`src/store/useView.ts:90`), in a single piece
`model.diagnostics` (`useView.ts:107`).

| #   | Feature line (features.ts)                                    | Sub-flow: entry → steps → end state                                                                                                                                                                                         | Code                                                                                                                                                                               | Covering test                                                                                            | P/D |
| --- | ------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- | --- |
| 1   | Problems checked on their own; errors block export (:864)     | Any edit → `buildModel` / `buildProjectModel` re-run their checks → Checks tab badge and list (errors first) → Parts Download CSV, Print, Client sheet, Sheets and Shopping counts disabled with "Fix the problems…" | `src/core/build.ts`, `src/core/project.ts:1504-1780`; `Output.tsx:37-52,101-180,415-480`; `src/ui/Shopping.tsx:180-195`; `src/ui/useNesting.ts:24`; `src/ui/Sheets.tsx:21-34` | `tests/fuzz.test.ts`, `tests/diagnostic-golden.test.ts`, `tests/find-it/model-diagnostics.test.tsx`      | P D |
| 2   | Overlap and room checks (:869)                                | Project → pieces overlap, or stand outside the room, into an obstacle, a door swing or a window → Checks lists it                                                                                                       | `project.ts:1590-1605` (overlap), `src/core/room.ts:585-670` (room)                                                                                                                | `tests/room.test.ts`, `tests/project.test.ts`                                                            | P D |
| 3   | Construction guidance (:870)                                  | A shelf span, a wide door, a shallow wardrobe… → warning labelled guidance in Checks; never blocks export                                                                                                               | `src/core/rules.ts`; piece list `Output.tsx:415-480`; Inspector inline list `src/ui/Inspector.tsx:458-470`                                                                         | `tests/constructions.test.ts`                                                                            | P D |
| 4   | Select the problem (:876)                                     | Checks → tap a row → piece(s) selected; with `itemIds`: panels lit, `useProblem.show` → plan scrolls, zone outlined                                                                                                    | `Output.tsx:449-475`, `src/store/problemStore.ts:21-29`, `src/store/focusedProblem.ts:59-83`, `src/ui/Project.tsx:1514-1521,1586,2255`                                             | `tests/find-it/compat-repairs.test.tsx`, `group-repairs.test.tsx`                                        | P D |
| 5   | Previewed repairs (:882)                                      | Banner above the plan → repairs as radios (smallest move marked; refused ones disabled with "Refused: reason") → dashed outline "After repair" → Apply (one undo step) or Close                                        | `src/ui/ProblemBanner.tsx:16-121`, `src/core/repairs.ts:459-…`                                                                                                                     | `tests/repairs.test.ts`, `tests/group-repairs.test.ts`, `tests/find-it/group-repairs.test.tsx`           | P D |
| 6   | Repair fillers kept by automatic refresh; the problem in 3D (:889) | Apply a filler repair → a `filler` run request survives refresh; the chosen problem's box is drawn in 3D                                                                                                           | `src/viewer/Viewer3D.tsx:2393`, run requests in `src/core` (ADR-209)                                                                                                              | `tests/run-parts.test.ts`, `tests/kitchen-follow-ups.test.ts`                                            | P D |

## Bug hunt

Each check below was applied to every sub-flow: empty / error / reload, undo/redo, edge input, locked and grouped
pieces, i18n, accessibility (role, label, focus, invalid state), 390 px, ADR-004 and ADR-008 (never throw, never clamp
silently, never hide or soften an error), selector stability. Only what failed is listed. Classes: **Proven**
(reproduced, output quoted), **Code-evident** (cited, not run), **Suspected**.

### D11-F1 — A piece's warnings, construction guidance included, never reach the project's Checks or its printed sheet (Proven, major)

`buildProjectModel` carries a piece's own diagnostics into the project only as one summary error per piece with
errors (`project.ts:1551-1561`, code `piece-errors`); its warnings are dropped. The project's Checks list
(`useView.ts:90`, `Output.tsx:415-480`) and the printed project sheet's warnings (`src/ui/PrintSheet.tsx:31`) read that
list. The piece card shows errors only (`Project.tsx:1095-1110`). ADR-035 promises labelled guidance warnings
(`docs/adr-done/ADR-035-construction-guidance-is-a-rules-registry-keyed-by-part-role.md:26-38`); the feature line says "labelled as guidance".
Reproduction (core): bookcase +300 mm → `D11-F1 template bookcase + 300 piece warnings: [ 'shelf-span' ] | project
Checks: []`.

### D11-F2 — Two exports stay open while an error exists (Proven, major — Moved to ADR-260 in FLOW 02: ADR-260 D13-F1)

ADR-008: errors block export; `Shopping.tsx:181` states "errors block every export, like Parts CSV and Print cutting
sheet". Not blocked:

- ⋯ More → **Fusion 360 script** (`src/ui/shell/MoreMenu.tsx:182-194`) builds `exportFusionPython(design, model)` with
  no check.
- Assembly → **Print assembly steps** (`src/ui/Assembly.tsx:200-228,263`) prints the steps and parts with no check.

Reproduction: New single piece → a base cabinet 40 mm wide (`carcass-too-small`) → `D11-F2 errors [
'carcass-too-small' ] | Fusion 360 script disabled: false`; Parts → `Download CSV disabled: [ true ]`; Assembly →
`D11-F3 Print assembly steps disabled: false`.

### D11-F3 — The banner says "No repair clears this without causing another problem" for problems no repair is ever tried on (Code-evident, minor)

A check row with `itemIds` opens the banner (`Output.tsx:455-458`). For a code outside `REPAIRABLE`
(`repairs.ts:67-75`) `repairsFor` returns `[]` at once (`repairs.ts:465`), and the banner shows the sentence above
(`ProblemBanner.tsx:74-79`). Codes with `itemIds` and no repair family: `common-panel-broken`, `common-gap`,
`common-top-layers` (`src/core/common.ts:289-325`), `shared-side-broken` (`src/core/shared.ts:247-252`),
`connection-broken` (`src/core/connections.ts:419-442`). The row itself says only "Show on the plan" for them
(`mayRepair`, `repairs.ts:81-85`; `Output.tsx:469-473`), so the two disagree.

### D11-F4 — Checks is announced as "Checks1", and the banner appears unannounced (Proven / Code-evident, minor)

- The Checks tab has no `aria-label` (`Output.tsx:47-52`) and its badge is a bare number in the button
  (`Output.tsx:69-70`). Proven: the tab names in the reproduction read `'Checks1'`. Neither the count nor whether it
  counts problems or checks is said.
- Tapping a check scrolls the plan to the banner (`Project.tsx:1515-1521`) but the banner is a plain `section`
  (`ProblemBanner.tsx:42`): no status announcement and focus stays on the tapped row, so a screen reader hears nothing
  after the tap. Code-evident.

### D11-F5 — "Runs into an obstacle" is an error with no place: tapping it outlines nothing (Code-evident, minor — Rejected in FLOW 02)

`hits-obstacle` carries `nodeId` only, no `itemIds` or `box` (`room.ts:616-621`); the tap selects the piece
(`Output.tsx:428-431`) but opens no banner and outlines nothing.

### D11-F6 — The front view drawing (SVG) is downloadable while an error exists (Code-evident — Moved to ADR-260 in FLOW 02: ADR-260 D13-F1)

⋯ More → Front view drawing (`MoreMenu.tsx:171-180`) has no error check. Unlike the design file (which saves work and
must stay), whether a drawing counts as an export under ADR-008 is not stated in the repo.

## Checked, no finding

- Errors are never filtered out: the Checks list sorts errors first and keeps every row (`Output.tsx:444-447`); a
  fixed problem leaves the banner because it is looked up again (`focusedProblem.ts:66-75`), not hidden.
- Parts CSV, Print, Client sheet (`Output.tsx:121-166`), Sheets (`useNesting.ts:24`, `Sheets.tsx:21-34`) and Shopping
  sheet counts (`Shopping.tsx:180-195`) are blocked with a visible sentence, not only a `title`.
- Review pack: its parts CSV is made with errors on purpose and its summary lists every problem (ADR-121 lines 44-49,
  `ReviewPack.tsx:124-130`).
- Apply: a refused repair cannot be chosen or applied (`ProblemBanner.tsx:25,58`, `focusedProblem.ts:78-81`); a stale
  repair and a lock refusal are said instead of "Applied" (`ProblemBanner.tsx:27-34`, ADR-244).
- Messages are made with `t()` in the core and shown with `tr()` (`Output.tsx:468`, `Inspector.tsx:466`); the banner
  shows `d.message` as made (`ProblemBanner.tsx:46`), already translated.
- Selectors: `useFocusedProblem` and `Output` read stored values; the `.filter` calls run outside selectors
  (`Output.tsx:37`, `Inspector.tsx:325`).
- 390 px: the banner and its radios are a fieldset in the plan column; no fixed widths found in the files read.
