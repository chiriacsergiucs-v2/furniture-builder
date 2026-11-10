# UI audit 08 — Boards and edges: sub-flow map and bug hunt

- Date: 2026-11-10
- Domain: Boards and edges (`src/ui/info/features.ts:639-750`, 21 feature lines)
- ADR: [ADR-254](../adr/ADR-254-ui-audit-boards-every-board-change-told-truly.md)
- Method: code reading with file:line citations; reproductions run as throwaway jsdom tests outside the repo
  (vitest with a scratch config over `tests/find-it/setup.tsx`, at 1280 px and 390 px). No repo source was changed.

## Sub-flow map

Reachability: **P** = phone 390 px, **D** = desktop 1280 px. Entry points are the same at both widths unless noted.
Two surfaces carry the domain: the **Material** dialog (header bar button `src/ui/App.tsx:805-806`, dialog
`src/ui/MaterialDialog.tsx:85-506`) and **Settings → Boards, sheets and saw cut** (`src/ui/Dialogs.tsx:470-740`, one
row per board; edge band `src/ui/BoardBand.tsx`, picture `Dialogs.tsx:746-845`). Common panels and shared sides sit on
the selection card (`src/ui/Selection.tsx:248-318`).

| #   | Feature line (features.ts)                   | Sub-flow: entry → steps → end state                                                                                                                                 | Code                                                                                                       | Covering test                                                                          | P/D |
| --- | -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- | --- |
| 1   | Boards: name, thickness, grain, colour (:643) | Settings → Boards, sheets and saw cut → a board row → colour / Name (on blur) / Thickness / Has grain → `updateMaterial`; Add a material / Remove board (reason shown) | `Dialogs.tsx:603-631`, `:707-737`; store `updateMaterial`, `removeMaterial`                                | `tests/core.test.ts` (ADR-019); find-it opens the group only (`band-list-gap-marks`)  | P D |
| 2   | One Material control everywhere (:648)       | Header → Material → Apply to Part / Item / Group / Whole project → Parts → Board → Edge band → Apply material → status line                                       | `MaterialDialog.tsx:85-506`; store `applyMaterial` `designStore.ts:1734-1776`; core `finish.ts:381-450`    | `tests/role-boards.test.ts`, `tests/find-it/part-boards.test.tsx`, `selected-piece`   | P D |
| 3   | One PAL 18 board by default (:655)           | New piece → one board; wizard Board step offers the project's boards and the decor list                                                                            | core defaults; `Wizard.tsx:701-711`; `boardChoices` (`src/core/boards.ts`)                                 | `tests/defaults.test.ts`, `tests/find-it/board-choices.test.tsx`                       | P D |
| 4   | Common top or bottom (:662)                  | Select two side-by-side items → selection card → Common top / Common bottom → `setCommon`; disabled with the reason as a hint                                       | `Selection.tsx:248-297`; store `designStore.ts:1777-1797`; core `common.ts:113-250`                        | `tests/common-panel.test.ts`, `tests/find-it/common-panel.test.tsx`                    | P D |
| 5   | Run parts and edge bands in Material (:669)  | Material → Parts adds Run worktop / Fillers / Run plinth / Trims; Part lists "Run: …"; Edge band: keep, project band, seller band, Your own band…                  | `MaterialDialog.tsx:172-202`, `:437-494`; core `runPartsOf`, `putRunBoard`                                 | `tests/role-bands.test.ts`, `tests/run-parts.test.ts`                                  | P D |
| 6   | Common top across gaps, corners, desks (:676) | As 4, with a gap, an L/diagonal corner or a desk                                                                                                                   | core `common.ts`                                                                                           | `tests/common-shapes.test.ts`, `tests/find-it/common-shapes.test.tsx`                  | P D |
| 7   | Neighbours share one side panel (:683)       | Select side-by-side cabinets → Shared sides → `setShared`; disabled with the reason                                                                                 | `Selection.tsx:298-316`; core `shared.ts`                                                                  | `tests/shared-sides.test.ts`, `tests/find-it/shared-sides.test.tsx`                    | P D |
| 8   | Shared sides, blind corners, desks (:690)    | As 7 with a blind corner or a desk                                                                                                                                  | core `shared.ts:60-100`                                                                                    | `tests/shared-sides.test.ts`, `tests/kitchen-corners.test.ts`                          | P D |
| 9   | Stock sheets, trim and kerf (:696)           | Settings → Boards… → Saw cut (kerf); per board Sheet length / width / Trim each edge / Sheets in stock                                                              | `Dialogs.tsx:484-497`, `:668-702`                                                                          | `tests/core.test.ts`                                                                   | P D |
| 10  | Solid timber stock (:697)                    | A frame piece → Output → Solid timber to buy (lengths)                                                                                                              | `Editors.tsx:519`, `Output.tsx:264-276`                                                                    | `tests/constructions.test.ts`, `tests/fuzz.test.ts`                                    | P D |
| 11  | Manufacturer and type labels (:698)          | Board row → Manufacturer / Type selects (Not set)                                                                                                                   | `Dialogs.tsx:639-656`                                                                                      | `tests/materials.test.ts`                                                              | P D |
| 12  | Import your own decor list (:699)            | Boards… → Import decor list (CSV) → message; Decor from your list per board; Remove decor list (confirm)                                                           | `Dialogs.tsx:420-449`, `:498-561`, `:657-667`; `persist/db.ts:475-500`                                     | `tests/materials.test.ts`, `tests/find-it/band-list-gap-marks.test.tsx`                | P D |
| 13  | Boards and edge bands from a seller (:701)   | Board row → Product from a seller → picker → Use this → name, sizes, labels set → picture downloaded once; band row → Band from a seller                           | `SellerLinks.tsx:36-98`, `:101`; `ProductPicker.tsx:91-199`; `src/online/sellerPictureFile.ts`            | `tests/sellers.test.ts`, `tests/find-it/sellers.test.tsx`                              | P D |
| 14  | Seller board pictures shipped (:708)         | As 13; a shipped picture is taken from the app's own origin                                                                                                         | `SellerLinks.tsx:47-53`                                                                                    | `tests/seller-pictures.test.ts`, `tests/find-it/seller-pictures.test.tsx`              | P D |
| 15  | A picture from your device (:714)            | Board row → Add a picture → file → picture + average colour; tile sizes, Turn 90°, Remove picture; missing picture alert                                          | `Dialogs.tsx:746-845`                                                                                      | `tests/surface.test.ts`, `tests/materials.test.ts`                                     | P D |
| 16  | Matte, satin or gloss finish (:715)          | Board row → Finish segmented                                                                                                                                        | `Dialogs.tsx:632-637`                                                                                      | `tests/look-render.test.ts`                                                            | P D |
| 17  | Edge band per board (:717)                   | Board row → Edge band: Band type → common thicknesses → width, thickness, code, allowance (commit on blur/Enter); Fronts banded differently                         | `BoardBand.tsx:26-279`                                                                                     | `tests/edge-band.test.ts`, `tests/core.test.ts`                                        | P D |
| 18  | Band list import (:723)                      | Boards… → Import band list (CSV) → message; each band editor → From your band list → Matching bands / Other bands                                                 | `Dialogs.tsx:394-420`, `:562-601`; `BoardBand.tsx:288-344`; `persist/db.ts:504-515`                        | `tests/band-list.test.ts`, `tests/find-it/band-list-gap-marks.test.tsx`                | P D |
| 19  | Own board for any single part (:731)         | Material → Part → part select → Board → Apply; "Use its group's board again"; lost part warning → Clear                                                           | `MaterialDialog.tsx:355-403`; store `clearPartBoard` `designStore.ts:1852-1870`, `setPartMaterial` `:1989` | `tests/part-boards.test.ts`, `tests/find-it/part-boards.test.tsx`                      | P D |
| 20  | Style suggestions (:737)                     | Material (project item) → Suggest a style → Apply {name} → status                                                                                                  | `History.tsx:393-475`                                                                                      | `tests/history.test.ts`, `tests/find-it/history.test.tsx`                              | P D |
| 21  | Project-wide settings (:743)                 | Configure → Project settings (handle, overlay, plinth); Material → Whole project writes carcass/front/back; piece card → Follow project                          | `ProjectSettings.tsx:31-146`; `finish.ts:426-434`                                                          | `tests/research-batch-4.test.ts`, `tests/find-it/research-batch-4.test.tsx`            | P D |

## Bug hunt

Each check below was applied to every sub-flow: empty / error / storage failure / undo / reload, double tap, edge
input, i18n, accessibility (role, label, focus, invalid state), 390 px, ADR-004 and ADR-008, selector stability,
persistence. Only what failed is listed. Classes: **Proven** (reproduced, output quoted), **Code-evident** (cited, not
run), **Suspected**.

### D08-F1 — "Use its group's board again" and "Clear" say done on a boards-locked piece (Proven, major)

`MaterialDialog.tsx:375-382` calls `clearPart(...)` and then always sets "{part}: back to its group's board.";
`clearPartBoard` (`designStore.ts:1852-1870`) returns nothing and drops the refusal `commitProject` returns
(`designStore.ts:811-822`, `pieceLocks.ts:86-93`). The lost-part **Clear** (`MaterialDialog.tsx:394-399`) has the same
gap. ADR-244 ("A refusal is never counted as applied") fixed this for Apply material but not for these two buttons.
Reproduction: project, left side given its own board, then `setBoardsLocked(item, true)` → Material → Part → Left side →
Use its group's board again → `D08-F1 status: Left side: back to its group's board. | partMaterials after:
{"e6e00b62/side/0":"7b2275f0"} | boardsLocked: true | notice: Boards locked — unlock to change`.

### D08-F2 — Clearing a board's name leaves an empty field and keeps the old name without a word (Proven, minor)

`Dialogs.tsx:612-618`: `onBlur` updates only when the trimmed text is not empty; the field is uncontrolled
(`defaultValue`, `key={m.name}`), so it stays empty while the board keeps its name. Nothing marks the field or says
why (ADR-008: never ignore input silently). Reproduction: chest of drawers → Settings → Boards… → clear Name → Tab →
`D08-F2 field value: "" stored name: PAL 18 white aria-invalid: null alerts: 0`.

### D08-F3 — The lost-part warning shows an internal id (Proven, minor)

`MaterialDialog.tsx:393` prints `{id}` — the generated panel id — in "{id} no longer exists; its board is not used.".
Reproduction (the flow of `tests/find-it/part-boards.test.tsx`): Plinth → oak → Settings → Wall brackets → Material →
Part → `D08-F3 warning text: e0a67cf7/plinth no longer exists; its board is not used. Clear`. The same text in Russian
shows the same id. The model's own warning names no id (`build.ts:80-86`).

### D08-F4 — "Your own band…" in the Material dialog does not mark a wrong thickness and has no allowance (Proven, minor; narrowed in FLOW 02: ADR-188 names no allowance)

`MaterialDialog.tsx:454-493`: the thickness input has no `aria-invalid` or error text; a single generic hint shows
(`:488-492`); there is no trim allowance field, and the width is an `MmField` that reverts a wrong value. The board's
own band editor does all of this per field (`BoardBand.tsx:183-205`, `:241-262`). Reproduction: Material → Edge band →
Your own band… → thickness `-3` → `D08-F4 thickness aria-invalid: null describedby: null apply disabled: true
allowance field: 0`.

### D08-F5 — Why "Group" is unavailable is only in a tooltip (Proven, minor)

`MaterialDialog.tsx:298-305,343`: a disabled **Group** radio carries the reason "Not in a run; select two or more
items for a group" only in `title`, which a touch screen never shows and a disabled button does not announce. The
selection card shows its reasons as visible hints (`Selection.tsx:294,315`).
Reproduction (FLOW 02, 390 px): project with one piece → Material → `D08-F5 Group disabled: true | title: Not in a run;
select two or more items for a group | describedby: null | reason as text: false`.

### D08-F6 — Every board row's fields share one accessible name (Proven, minor)

`Dialogs.tsx:612-626,668-701`: Name, Thickness, Has grain, Finish, Sheet length… are labelled the same in each row;
only the colour input names its board (`:608`). A screen-reader user hears five "Name" fields. Reproduction: chest of
drawers → Settings → Boards… → `D08-F6 textboxes named "Name": 5 thickness fields: 5`.

### D08-F7 — The band list cannot be removed (Code-evident, minor)

The decor list has **Remove decor list** with a confirm (`Dialogs.tsx:524-549`, `persist/db.ts:494`); the band list,
"parsed like it" (ADR-212 item 8), has only Import (`Dialogs.tsx:576-590`) and storage has no clear function
(`persist/db.ts:504-515`). Once imported, every board's band editor offers it for good.

### D08-F8 — Apply-material and common-panel messages name pieces untranslated (Code-evident, minor; moved to ADR-264 in FLOW 02)

`finish.ts:408-415` writes `it.design.name` into the applied and skipped lists, and `MaterialDialog.tsx:282-288` joins
them as they are; the common and shared reasons do the same (`common.ts:120-131`, `shared.ts:124-140`). Built-in names
have Russian entries (`src/core/i18n/ru/data-catalog.ts:147` "Base cabinet, 1 door"), and the selection card already
passes them through `tr()` (`Selection.tsx:138`); Style suggestions does `r.skipped.map((s) => tr(s))`
(`History.tsx:456`). In Russian the Material dialog says "…: Base cabinet, 1 door: locked".

### D08-F9 — A repeated Apply material adds an undo step and says "Applied" (Proven, polish; rejected in FLOW 02)

`putRoleBoards` returns a new design even when the board is already the one used (`finish.ts:283-293`), so
`commitApplied` (`designStore.ts:741-746`) commits again. Reproduction: Item → Fronts → PAL 18 oak → Apply twice →
`D08-F9 undo steps 2 3 4 status: Applied to 1 item. names: … | Apply material | Apply material`.

### D08-F10 — "Show seller pictures (online)" off still downloads the picture on a pick (Code-evident, needs a decision)

`ProductPicker.tsx:123-131` turns off list pictures only; `SellerLinks.tsx:41-66` downloads the seller's picture on
**Use this** whatever the switch says. ADR-161 lines 32-36 intend the download on a pick and lines 50-52 the switch for
lists, so this is a product choice, not a defect: does the switch mean "no seller request at all"?

## Checked, no finding

- Apply material on a boards-locked item, group and project: refused or skipped and named (`designStore.ts:1734-1776`,
  ADR-244).
- Board band editor: per-field `aria-invalid` and errors, one commit per blur, follows undo (`BoardBand.tsx:158-205`).
- Decor and band list import: unreadable file, no rows and a storage failure each say so (`Dialogs.tsx:394-449`).
- Remove board: refused with the reason in an alert (`Dialogs.tsx:707-724`).
- Picture: failure keeps the old look and says so; a missing picture is an error alert (`Dialogs.tsx:752-818`).
- Common top / Shared sides: off and disabled with the reason as a visible hint (`Selection.tsx:270-316`); covered by
  find-it tests at both widths.
- Selectors in the files read return stable values (no `.filter`/`.map` inside `useDesign` / `useUi` selectors).
- Part rows are a projection of `buildModel` (`MaterialDialog.tsx:64-79`), no geometry in the UI (ADR-004).
- Every other visible text in the files read goes through `t()`/`tr()`.
