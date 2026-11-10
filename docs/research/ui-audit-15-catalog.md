# UI audit 15 — Catalog and templates: sub-flow map and bug hunt

- Date: 2026-11-10
- Domain: Catalog and templates (`src/ui/info/features.ts:1269-1333`, 13 feature lines)
- ADR: [ADR-262](../adr-done/ADR-262-ui-audit-catalog-keep-edits-name-every-button.md)
- Method: code reading with file:line citations; reproductions run as throwaway jsdom tests outside the repo
  (vitest with a scratch config over `tests/find-it/setup.tsx`, at 1280 and 390 px, `src/persist/db` mocked for
  storage failures as in `tests/find-it/catalog-brands.test.tsx:11-20`). No repo source was changed.

## Sub-flow map

Reachability: **P** = phone 390 px, **D** = desktop 1280 px. The Catalog page is `CatalogPage`
(`src/ui/CatalogPage.tsx:90-506`), reached from the top bar's Catalog link. On a phone the safety switch, "Save this
piece as a template" and Template files fold under "More catalog actions" (`src/ui/Catalog.tsx:178-189`).

| #   | Feature line (features.ts)                           | Sub-flow: entry → steps → end state                                                                                                                              | Code                                                                                                 | Covering test                                                              | P/D |
| --- | ---------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- | --- |
| 1   | Browse by room or type, with search (:1273)          | Catalog → By room / By type → Search → Jump to a group chips with counts → family blocks                                                                        | `CatalogPage.tsx:150-185,413-462`, `Catalog.tsx:84-160`                                              | `tests/find-it/catalog.test.tsx`, `tests/catalog-flows.test.ts`            | P D |
| 2   | 1–5 variants per family (:1278)                      | Each family lists its variants as cards; template editor Duplicate (≤ 5) and Remove variant (≥ 1)                                                               | `CatalogPage.tsx:776-788`, `:1227-1250`                                                              | `tests/templates-local.test.ts`                                            | P D |
| 3   | Catalog pictures (:1279)                             | Each insertable card shows a picture of its built model                                                                                                         | `Catalog.tsx:304-339`, `CatalogPage.tsx:576-585`                                                     | `tests/catalog.test.ts`                                                    | P D |
| 4   | Compact cards with More (:1281)                      | Card → More (only when a line is cut) → full text → Less; Open / Add                                                                                             | `CatalogPage.tsx:539-664`                                                                            | `tests/find-it/catalog.test.tsx`                                           | P D |
| 5   | Edit templates on this device (:1287)                | Family → Edit template → fields, variants, Edit design (template mode) → Save template (one revision) / Cancel; Reset to shipped; Keep mine / Use shipped     | `CatalogPage.tsx:1072-1285`, `:791-878`, store `templatesStore.ts:62-90`                             | `tests/find-it/catalog.test.tsx:130-150`, `tests/template-revision.test.ts` | P D |
| 6   | Save a design as a template (:1294)                  | Catalog → Save this piece as a template → Name, Room, Type → Save → "Saved to the catalog. Show “…”"                                                            | `CatalogPage.tsx:882-906`, `SaveToCatalog.tsx:56-138`, `store/saveToCatalog.ts:23-42`                | `tests/find-it/catalog.test.tsx`                                           | P D |
| 7   | Choose which edit to keep on template import (:1300) | Template files → Import templates → file → per edited family "Keep mine" / "Use the imported one" → summary message                                             | `CatalogPage.tsx:216-262`                                                                            | `tests/template-keeps.test.ts` (storage), no find-it for a failing write   | P D |
| 8   | Save a project piece to the catalog (:1305)          | Project piece → More actions → Save to catalog → form → Save → "Saved to the catalog. Open in Catalog"; piece linked                                            | `SaveToCatalog.tsx:17-53`, `store/saveToCatalog.ts:49-59`                                            | `tests/find-it/save-to-catalog.test.tsx`, `tests/save-to-catalog.test.ts`  | P D |
| 9   | Safety-regulated items (:1307)                       | Bunk bed / cradle card → "I check it myself" (or the switch) → Open enabled                                                                                      | `CatalogPage.tsx:630-645`, `:195-203`, `Catalog.tsx:170-175`                                         | `tests/find-it/catalog.test.tsx`                                           | P D |
| 10  | Catalog origin kept on copies (:1312)                | Open / Add a card → design carries `catalog.origin` → Saved list "Based on …"                                                                                    | `CatalogPage.tsx:1057-1061`, core `src/core/catalog` (ADR-028)                                       | `tests/catalog.test.ts`                                                    | P D |
| 11  | Brands (:1314)                                       | Catalog → Brands → chip per maker (count) → its decors and saved pieces with its board → a piece opens                                                          | `CatalogPage.tsx:915-1018`, core `catalog/decorBrands.ts:22-42`                                      | `tests/find-it/catalog-brands.test.tsx`                                    | P D |
| 12  | Family rule for your own templates (:1321)           | A piece from your own template keeps its rooms → pieces of rooms apart are warned about                                                                          | core (ADR-210)                                                                                       | `tests/catalog-families-210.test.ts`                                       | P D |
| 13  | Reference entries for upholstered pieces (:1328)     | Reference family cards → "Not available yet: …", Open disabled                                                                                                   | `CatalogPage.tsx:646-650,652-662`                                                                    | `tests/catalog.test.ts`                                                    | P D |

## Bug hunt

Each check of the brief was applied to every sub-flow: empty / error / storage failure / reload, double tap, edge
input, i18n, accessibility, 390 px, ADR-004, ADR-008, selector stability, persistence and import/export. Only what
failed is listed. Classes: **Proven** (reproduced, output quoted), **Code-evident** (cited, not run), **Suspected**.

### D15-F1 — "Use the imported one" deletes your edit before the import is stored (Proven, major)

`importLocal` removes every local edit of the family first (`CatalogPage.tsx:249`), then saves the imported template
(`:252`). When the browser's storage refuses the write, both are gone. Reproduced (a local edit `mine` of the first
family, an imported `theirs` of the same family, `saveTemplate` rejecting): `D15-F1 @1280 rows after import: []
message: 0 templates imported. alert: [ 'The template could not be saved in this browser’s storage.Dismiss' ]`, same
at 390. The user chose to replace their edit, not to lose it; the alert says the save failed but not that the edit was
removed. ADR-195 item 2: "no edit is lost silently"; CLAUDE.md: nothing deletes saved work without the user's
decision.

### D15-F2 — A file that is not a templates file says "0 templates imported." (Proven, minor)

`importLocal` reads any JSON and treats a missing `templates` array as an empty list (`CatalogPage.tsx:219-220`); the
"could not be read as a templates file" sentence is only for JSON that does not parse (`:257-259`). Reproduced with a
project-shaped file: `D15-F2 @1280 message: [ '0 templates imported.' ]`, same at 390. The user picked the wrong file
and is told the import ran.

### D15-F3 — Brands says "No saved piece has a board of this maker yet." when the saved pieces could not be read (Proven, minor)

`DecorBrandList` turns a failed designs read into an empty list (`CatalogPage.tsx:928`) and then shows the empty
sentence (`:1011`). Reproduced with `listDesigns` rejecting: `D15-F3 shown: No saved piece has a board of this maker
yet. alerts: 0`. ADR-195 item 2 made the Saved list say a failed read as such (`CatalogPage.tsx:1020-1040`); the
same read here still reads as "none".

### D15-F4 — 183 buttons named "Open" and 68 named "Edit template", none saying which item (Proven, minor)

The card's main button has only its visible word (`CatalogPage.tsx:652-662`); the family's Edit template too
(`:742-746`). The same card's More and I check it myself buttons already point to the item name with
`aria-describedby={nameId}` (`:600,639`). Reproduced: `D15-F4 @1280 buttons named exactly "Open": 183, with a
description: 0; "Edit template": 68`, same at 390. A screen-reader list of buttons is 183 identical entries.

### D15-F5 — Template editor: every variant row has the same labels, and problems are not tied to their fields (Proven / Code-evident, minor)

- Each variant row's inputs and buttons are named "Variant name", "Variant summary", "Move up", "Move down",
  "Duplicate", "Remove variant" (`CatalogPage.tsx:1186-1248`). Proven: after two Duplicates, `"Variant name" inputs:
  3, "Move up": 3`.
- Problems show as one alert under the form (`:1258-1263`); no field is `aria-invalid`. Proven: Name cleared, rooms
  unticked, first variant name cleared → `name aria-invalid=null alert=["Give the template a name. Tick at least one
  room. Give every variant a name of up to 200 characters."]`.
- Only the first three problems are shown (`errs.slice(0, 3)`, `:1261`), so a fourth appears only after three are
  fixed. Code-evident.

## Checked, no finding

- Storage failures of Save template, Reset, Delete and the templates read show the page alert and keep the draft
  (`templatesStore.ts:31-58`, `CatalogPage.tsx:110-115,360-372`; ADR-195).
- Keep mine on import is the default and changes nothing (`CatalogPage.tsx:229-248`, ADR-203).
- Counts follow the search (`Catalog.tsx:166-168`, ADR-195 item 3); the header total against room sums is G-362
  (ADR-195 out of scope).
- Safety switch and grouping are kept in browser storage with try/catch (`Catalog.tsx:30-49`, `CatalogPage.tsx:195-203`).
- `useCatalog` merges outside any selector (`Catalog.tsx:72-75`); selectors return store fields.
- Item facts come from `buildModel` (`CatalogPage.tsx:69-82`, ADR-004).
- Every visible text in `CatalogPage.tsx`, `Catalog.tsx` and `SaveToCatalog.tsx` goes through `t()`/`tr()`; the
  Romanian line is marked `lang="ro"` (`CatalogPage.tsx:621-625`).
- Duplicate stops at five variants and Remove at one (`CatalogPage.tsx:1227,1248`, ADR-033).
