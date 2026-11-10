# UI audit 13 — Output: sub-flow map and bug hunt

- Date: 2026-11-10
- Domain: Output (`src/ui/info/features.ts:1017-1152`, 22 feature lines)
- ADR: [ADR-260](../adr/ADR-260-ui-audit-output-exports-blocked-said-one-language.md)
- Method: code reading with file:line citations; reproductions run as throwaway jsdom tests outside the repo
  (vitest with a scratch config over `tests/find-it/setup.tsx`, at 1280 px; `fetch` stubbed, no request). No repo
  source was changed.

## Sub-flow map

Reachability: **P** = phone 390 px, **D** = desktop 1280 px. The results are `Output` (`src/ui/Output.tsx:28-92`),
mounted in the editor (`src/ui/App.tsx:1074`); on a phone they sit under Build & Preview and stay folded until a tab
is tapped (`Output.tsx:33-35`, `toggleTab` `src/store/designStore.ts:2182-2184`). Prints render one of
`PrintAssembly`, `PrintClient` or `PrintSheet` (`App.tsx:1123-1128`) and call `window.print()` once the fonts are in
(`App.tsx:368-385`). Files live in ⋯ More → Files (`src/ui/shell/MoreMenu.tsx:121-235`).

| #   | Feature line (features.ts)                    | Sub-flow: entry → steps → end state                                                                                                     | Code                                                                                          | Covering test                                                                    | P/D |
| --- | --------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- | --- |
| 1   | Results tabs under the views (:1024)          | Editor → tab (Parts, Sheets, Hardware, Assembly, Shopping, Checks) → panel; Parts badge = parts, Checks badge = problems; phone: folded | `Output.tsx:41-91`                                                                            | `tests/find-it/model-diagnostics.test.tsx`, `phone-editor.test.tsx`              | P D |
| 2   | Assembly steps (:1031)                        | Assembly → steps per piece → Show step (lights parts) → ← → between steps → Print assembly steps → `PrintAssembly`                     | `Assembly.tsx:184-386`, print `:200-228`, sheet `:446-555`, core `src/core/assembly.ts`       | `tests/assembly.test.ts`, `tests/find-it/prints-exports.test.tsx:84-93`          | P D |
| 3   | Show the hardware step in 3D (:1038)          | Assembly → "Fit hardware to the sides" → Show step → sides and dividers lit                                                             | `Assembly.tsx:231-234,325-334`, `stepLitIds`                                                  | `tests/find-it/connections-typed.test.tsx`                                       | P D |
| 4   | Your own assembly steps (:1045)               | Step → Move step up/down or Rename step (`askText`) → `setAssembly` (one undo step) → Reset the steps (confirm)                         | `Assembly.tsx:291-376`                                                                        | `tests/connections-typed.test.ts`, `tests/find-it/connections-typed.test.tsx`    | P D |
| 5   | Project assembly order (:1052)                | Project → Assembly → Project order stages → print starts with them                                                                      | `Assembly.tsx:119-182`, `projectAssemblyOrder`                                                | `tests/find-it/assembly-order.test.tsx`                                          | P D |
| 6   | Cut list, finished sizes and band marks (:1064) | Parts → one table per board: Qty, Length, Width, Edges (L/W mark), Part; hover/focus a row lights its panels                          | `Output.tsx:196-258`, `EdgeMark :354-367`                                                    | `tests/edge-band.test.ts`, `tests/constructions.test.ts`                         | P D |
| 7   | Grouped parts, area and band metres (:1068)   | Parts → caption per board: m², band metres, grain; summary "N parts in M materials"                                                     | `Output.tsx:100-112,181-187,201-210`, core `cutlist.ts`                                       | `tests/edge-band.test.ts`                                                        | P D |
| 8   | Parts CSV (:1069)                             | Parts → Download CSV (disabled on errors) → `cutlistCsvRo` in the print language → `<name>-parts.csv`                                   | `Output.tsx:122-143`, `src/core/ro.ts:386-416`                                                | `tests/ro.test.ts`, `tests/i18n-print.test.ts`, `tests/print-names.test.ts`      | P D |
| 9   | Lengths list for solid stock (:1070)          | Parts → "Solid timber to buy" per section: lengths, cut into, left over; too-long parts named                                           | `Output.tsx:265-328`, `lengthsList`                                                           | `tests/constructions.test.ts`                                                    | P D |
| 10  | Sheet layouts (:1077)                         | Sheets → worker nests (blocked on errors) → Sheets to buy + one drawing per sheet; a layout failing its check is not shown              | `Sheets.tsx:17-140`, `useNesting.ts:19-68`                                                    | `tests/nesting.test.ts`, `tests/nesting-golden.test.ts`                          | P D |
| 11  | Running cost estimate (:1088)                 | Header chip (phone: mode row, amount) → tap → Build › Shopping                                                                         | `App.tsx:119-147,758,1071`, `useEstimate.ts:37-111`                                           | `tests/find-it/estimate-chip.test.tsx`                                           | P D |
| 12  | Shopping list (:1095)                         | Shopping → sections Boards, Edge banding, Hardware, Run parts, To choose → Print shopping list (`window.open` + `print`)                | `Shopping.tsx:94-364`, print `:142-179`, core `src/core/shopping.ts`                          | `tests/templates-prices-shopping.test.ts`, `tests/find-it/sellers.test.tsx`      | P D |
| 13  | Shopping list CSV (:1100)                     | Shopping → Shopping list CSV (disabled on errors) → `shoppingCsvRo` → `<title>-shopping.csv`                                            | `Shopping.tsx:237-257`, `shopping.ts:354-387`                                                 | `tests/shopping-csv.test.ts`                                                     | P D |
| 14  | Unit price on each row (:1102)                | Shopping → priced row → line total, unit price under it; "—" without a price                                                            | `Shopping.tsx:434-459`                                                                        | `tests/shopping-unit-price.test.ts`, `tests/find-it/shopping-unit-price.test.tsx` | P D |
| 15  | Cost estimate from your price list (:1108)    | Shopping → Prices → type a price (blur) / Currency / Export prices / Import prices (CSV) → `setPrice` / `savePrices` → estimate          | `Shopping.tsx:112-141,288-323,405-433`, `src/store/priceStore.ts:28-36`                       | `tests/templates-prices-shopping.test.ts`, `tests/find-it/estimate-chip.test.tsx` | P D |
| 16  | Seller products and seller prices (:1110)     | Shopping → Product (picker) → Use this → seller price; Seller units per item; Unlink; Add seller product                               | `Shopping.tsx:478-602`, `ProductPicker.tsx`                                                   | `tests/seller-prices.test.ts`, `tests/find-it/sellers.test.tsx`                  | P D |
| 17  | Project seller items (:1117)                  | Project → Shopping → Add seller product → project's own line → Quantity / Remove                                                        | `Shopping.tsx:268-287,497-537`                                                                | `tests/catalog-families-210.test.ts`, `tests/find-it/room-presets.test.tsx`      | P D |
| 18  | Print sheets or save as PDF (:1128)           | Parts → Print (disabled on errors) → `PrintSheet` (title, front view or pieces table, parts, hardware, checks, templates, sheets)       | `Output.tsx:144-153`, `PrintSheet.tsx:19-333`                                                 | `tests/i18n-print.test.ts`, `tests/prints-exports-ui.test.tsx`                   | P D |
| 19  | Download drawings as SVG (:1129)              | Piece → ⋯ More → Front view drawing → `downloadFrontSvg` (needs the front view on screen)                                              | `MoreMenu.tsx:170-181`, `shell/files.ts:49-52`                                                | `tests/prints-exports-ui.test.tsx`                                               | P D |
| 20  | Fusion 360 script (:1131)                     | Piece → ⋯ More → Fusion 360 script → `exportFusionPython` → `<name>-fusion.py`                                                          | `MoreMenu.tsx:182-194`, `src/core/fusion.ts`                                                  | `tests/fusion.test.ts`                                                           | P D |
| 21  | Review pack for a professional (:1137)        | Project → ⋯ More → Hand to a professional… → pack built (`withModels`, `withPictures`) → Download .zip / Share…                       | `MoreMenu.tsx:136-142`, `ReviewPack.tsx:26-137`, `src/core/reviewPack.ts`                     | `tests/review-pack.test.ts`                                                      | P D |
| 22  | Client sheet (:1143)                          | Parts → Client sheet (disabled on errors) → `PrintClient`: name, picture (last render › 3D still › front view), pieces, estimate      | `Output.tsx:154-169`, `PrintClient.tsx:17-99`                                                 | `tests/find-it/prints-exports.test.tsx:61-82`, `tests/prints-exports-ui.test.tsx` | P D |

## Bug hunt

Each check below was applied to every sub-flow: empty / error / storage failure / reload, double tap, edge input,
i18n (`t()`/`tr()`/`pt()`), accessibility (role, label, focus, invalid state), 390 px, ADR-004 and ADR-008, selector
stability, persistence and file round trip. Only what failed is listed. Classes: **Proven** (reproduced, output
quoted), **Code-evident** (cited, not run), **Suspected**.

### D13-F1 — Print assembly steps, Fusion 360 script and Front view drawing stay open while the design has errors (Proven, major)

ADR-008 is "errors block export"; ADR-020 line 23: "Printing is blocked, like CSV, while the design has errors". The
Parts tab keeps it (`Output.tsx:101,125,147,157`), the Shopping list too (`Shopping.tsx:180-182,240,261`). Print
assembly steps is disabled only while pictures are taken (`Assembly.tsx:256-264`); Fusion 360 script and Front view
drawing have no check (`MoreMenu.tsx:170-194`).
Reproduction: Chest of drawers loaded with width 20 → `D13-F1 errors: 1 CSV disabled: true Print disabled: true
Print assembly steps disabled: false Fusion disabled: false Front SVG disabled: false`, then Print assembly steps →
`assembly sheet printed with errors: Chest of drawersFișă de asamblare · 10.11.2026…`.

### D13-F2 — The printed Shopping list mixes the print language and the app language (Proven, minor)

ADR-181 item 4: every header follows the print language "so a print never mixes languages". `printList` writes the
quantity unit with the app's `UNIT_SHOWN` (`Shopping.tsx:63-68,152`) and the estimate line with `t()`
(`Shopping.tsx:161-172`), while the CSV uses `pt(UNIT_PRINT[…])` (`shopping.ts:322,378`). The quantity also prints
with a dot (`5.29`) where the CSV writes `5,29` (`shopping.ts:377`).
Reproduction (print language Romanian, app English): print → `Plăci | Cantitate | … | 5.29 m² | … | Feronerie | … |
4 pcs | …`, `has "Estimate:": true`; CSV → `Feronerie;Ball-bearing side runner pair, 400 mm;4;buc;…`.

### D13-F3 — The Shopping list CSV file name is the raw title (Proven, minor)

Parts CSV names its file with `fileName(view.title)` (`Output.tsx:129`); the Shopping list CSV uses
`${view.title}-shopping.csv` (`Shopping.tsx:244`), so slashes, colons and quotes reach the file name.
Reproduction: piece named `Kids/room: "chest"` → `D13-F3 file names: ["kidsroom-chest-parts.csv","Kids/room:
\"chest\"-shopping.csv"]`.

### D13-F4 — A price import the device refuses is not said; the chip says "No prices yet" when prices could not be read (Proven / Code-evident, major)

`importCsv` awaits `savePrices` with no catch (`Shopping.tsx:115-141`) and is started with `void` (`:317`). A single
typed price does say its failure (`Shopping.tsx:112-114`).
Reproduction: `savePrices` rejecting → Prices → Import prices → `D13-F4 status after failed import: ["Estimate: 0,00
lei — 2 prices missing (incomplete)"] unhandled: [ 'Error: QuotaExceededError' ]` — no message, no success either.
Code-evident: the header chip treats `priceState === 'failed'` as `none` and shows "No prices yet"
(`App.tsx:123-131`), while the Shopping list says "Prices could not be read from this browser." (`Shopping.tsx:108-109`).

### D13-F5 — Hand to a professional: a failed read of the project's 3D models or pictures leaves an empty dialog (Proven, major)

The pack is built in an effect with no catch (`ReviewPack.tsx:34-61`); on a rejection `pack` stays `null`, the list is
empty and Download .zip stays disabled (`:103`), with no message.
Reproduction: `withModels` rejecting → project → ⋯ → Hand to a professional… → `D13-F5 Download disabled: true items:
0 status: [] unhandled: [ 'Error: UnknownError' ]`.

### D13-F6 — A project's prints name the same piece two ways (Proven, minor)

ADR-212 (G-381) gave the printed piece name (`printPieceName`) to the parts CSV, which swaps the `Piece:` prefix of
each label (`ro.ts:386-392`, `Output.tsx:133-135`). The cutting sheet's pieces table uses it (`PrintSheet.tsx:77`) but
its parts list keeps the stored name (`PrintSheet.tsx:118`), and the Client sheet lists `pc.item.design.name`
(`PrintClient.tsx:25-38`).
Reproduction (project with two Base cabinet, 1 door; Romanian print): `cutting sheet: pieces table: Corp bază cu uși —
1 ușă + raft | parts list: Base cabinet, 1 door: Lateral stânga, …`; `client sheet piece: Base cabinet, 1 door`;
`parts CSV row 1: Corp bază cu uși — 1 ușă + raft: Lateral stânga / …`.

### D13-F7 — The Client sheet can show another piece's render (Code-evident, minor)

`lastRender` is set only by the Render dialog (`src/ui/RenderDialog.tsx:87`) and never cleared when another piece or
project opens (no other writer: `src/store/uiStore.ts:103-108`); Client sheet prefers it (`Output.tsx:164`). ADR-206
item 1 names "the last PNG the Render dialog made this session". Render needs WebGL; not reproduced in jsdom.

### D13-F8 — Shopping fields: a wrong value is only coloured, and a wrong seller quantity is dropped in silence (Code-evident, minor)

- Price (`Shopping.tsx:407-417`) and Seller units per item (`:557-570`) get the class `bad` only: no `aria-invalid`, no
  text saying what is wrong.
- Quantity of a project seller item ignores anything not an integer 0–9999 with no sign (`Shopping.tsx:520-531`),
  against ADR-008 (never clamp or drop silently); its label uses `l.label` without `tr()` (`:525`).

### D13-F9 — Client sheet: "1 linii fără preț" (Code-evident, polish)

`PrintClient.tsx:86-90` writes the count before `pt('linii fără preț')`, which has no singular form (`print-text.ts:303,
584`: "строк без цены", "lines without a price"); `format` supports plural forms in the print language
(`src/core/i18n/print.ts:43`).

### D13-F10 — A failed sheet layout shows the validator's English text (Code-evident, polish; Rejected in FLOW 02)

`Sheets.tsx:124-125` shows `result.errors` (English strings from `src/core/nesting/validate.ts:28-36`) after a
translated sentence.

## Checked, no finding

- Parts CSV, Print and Client sheet are disabled on errors with the reason in the title and an alert
  (`Output.tsx:117-179`); Shopping CSV and print too (`Shopping.tsx:180-267`).
- Review pack with errors: allowed on purpose, the summary lists them (ADR-121 lines 44-49); the dialog says so
  (`ReviewPack.tsx:124-130`).
- Lengths fallback 2400 and 3000 mm (`Output.tsx:269`) is the user's answer in ADR-038 (lines 66-67, 77).
- Sheets: blocked on errors, worker failure said, main-thread fallback (`useNesting.ts:41-55`); stale results dropped
  by request id (`:33-34`).
- Selectors return stored references (`PrintClient.tsx:19-21`, `Shopping.tsx:97`, `Assembly.tsx:69-71,121-122`); no
  geometry in the UI files read (ADR-004): sizes come from the model or the cut list.
- Every visible text in the files read goes through `t()`/`tr()`/`pt()` except the ones listed above.
- Assembly: Rename step with an empty name returns to the generated title (`Assembly.tsx:359-370`); Reset asks first
  (`:296-305`); ← → move between steps (`:243-253`).
