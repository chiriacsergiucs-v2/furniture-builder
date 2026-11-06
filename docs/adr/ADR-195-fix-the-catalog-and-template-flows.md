# ADR-195: Fix the catalog and template flows: honest revisions, visible storage errors, readable cards

- Status: Pending
- Date: 2026-11-05
- Depends on: ADR-034, ADR-096, ADR-107, ADR-118, ADR-119, ADR-153, ADR-166
- Design: docs/ui-design.md (section 4, catalog)
- Backlog: N200
- Acceptance: browser

## Context

Catalog page, template editor, revisions, Save to catalog and variables: code read, Playwright probes and screenshots
of the production build at 390 and 1280 px. The user asked: "Split the entire app into domains or flows …
critique of design … 1 adr with high and medium issues and fixes per flow".

## Decision

1. **"Edit design" records revisions that never happened (High).** `Catalog.tsx:1248` saves the draft (+1) before the
   editor opens and `designStore.ts:1801` adds +1 on Save, so one edit counts two; Edit design → Cancel still leaves
   "Edited on this device" after a reload (probe) and earlier pieces get "Template updated" (ADR-096) for nothing; "Keep
   mine" (`Catalog.tsx:1008`) raises `basedOn`, so `localRevision` (`local.ts:58`) jumps too. Fix: carry the
   unsaved draft into the editor, save once on "Save to template", return to it on Cancel; "Keep mine" writes a new
   optional `seenShipped` field (old readers ignore it), not `basedOn`.
2. **Storage failures are silent (High).** `templatesStore.ts:24` sets `error` but nothing renders it; the editor's Save
   (`Catalog.tsx:1298`), the template-mode Save (`App.tsx:597`, then navigates away) and Reset/Delete (`:958`, `:975`)
   do not catch a rejected write, so the edit is lost silently; `SavedList` (`:1061`) says "Nothing saved on this device
   yet." when the read fails. Fix: `save`/`remove` set the store `error`; the Catalog shows it as an `alert error`
   (role=alert); a failed Save keeps the draft open; a failed read says it could not be read.
3. **Counts ignore the search (Medium).** `itemCount` (`Catalog.tsx:136`) and the group heading count every variant of a
   family with one match: search "flap" shows "Living room 9 items" over 1 card (probe). Fix: count matched variants.
4. **Nearly every card is cut (Medium).** 182 of 183 cards show "More" at 390 px, 121 at 1280 (facts line cut on
   166 / 88): the text column beside the 96 px picture and Open is ≈150 px (`styles.css:3456`). Fix: Open under the
   picture (column 1, rows 3–4): ≈240 px for text, same height, one meta line (ADR-118), "More" where still cut.
5. **"Save this piece as a template" bypasses the ADR-107 dialog (Medium).** `Catalog.tsx:1032`: shown on the bare app
   with no design open (probe), asks only a name, files under "other" / "storage", then stays disabled. Fix: reuse the
   Save to catalog form (name, room, type), hide it when `designOpen` is false, confirm with a link to the new family.
6. **Validation copy is developer wording, untranslated (Medium).** `local.ts:170–214` strings ("Rooms must be known
   room names", "Family needs an id and a name", "Invalid variant") reach the user raw in the editor (`Catalog.tsx:1289`),
   Save to catalog (`saveToCatalog.ts:33`) and import, with no Russian entry (nor has `local.ts:118`). Fix: the
   validator returns codes; the UI maps each to a `t()` sentence ("Tick at least one room").
7. **Safety-gated items read "Not available yet" and point to a hidden switch (Medium).** `Catalog.tsx:813` prefixes the
   bunk bed and cradle reason (`types.ts:76`) with "Not available yet"; the switch it names is folded under "More catalog
   actions" on a phone (ADR-118). Fix: when `safety:user-confirmed` is the only missing capability the card says
   "Safety-regulated: you check it against the standards yourself" with a button "I check it myself" setting that flag.
8. **Formula fields open the numeric keyboard (Medium).** `Variables.tsx:272, 403, 517` set `inputMode="decimal"` on
   "Value or formula", set values and the strip, though the hint asks for "bottom height + 18" (ADR-166): no letters
   on a phone. Fix: drop `inputMode` on these three fields.

Every text added or changed gets its Russian entry (ADR-153).

## Alternatives considered

- **Commit before editing, delete the row on Cancel (1)** — cancelling on an edited template would delete real edits.
- **Per-call toasts for storage errors (2)** — the editor would still close on failure; one store error covers all.
- **Meta line on its own row under the picture (4)** — ≈24 px per card, ≈4 400 px more at 390 (ADR-118 limit).
- **Wrap the raw validator strings in `t()` (6)** — still developer wording ("known room names").

## Scope

- In scope: the fixes above, their tests, a jsdom find-it test (tests/find-it/catalog.test.tsx, 390 and 1280 px).
- Out of scope: the header "118 items" against room chips that sum to 183 (a family under every room, ADR-032) (G-362).
- Out of scope: two imported templates shadowing one shipped family (the last wins, `local.ts:85`) (G-363).

## Consequences

- Positive: revisions mean real changes (ADR-096 notices are trustworthy); no edit is lost silently; counts, cards and
  the safety gate say what they mean; one save dialog.
- Negative / risks: `seenShipped` is a new optional field on the local template (validated; old readers ignore it); Open
  moves on cards with a picture; the ADR-118/119 browser script may need new selectors.

## Done when

- [x] Edit design → Cancel leaves no local row; → Save adds one revision; Keep mine leaves `localRevision` as is.
- [x] A rejected template write or read shows an alert on the Catalog page and keeps the draft.
- [x] Searching "flap" shows chip and heading counts equal to the cards shown.
- [ ] At 390 px under 30 % of cards show "More"; the page stays under 30 000 px; one meta line per card. — Not met:
      178 of 183 cards (97.3 %) still show "More"; the page (29 734 px) and one meta line per card are met (G-477).
- [x] "Save this piece as a template" is absent with no design open, else opens the name/room/type form.
- [x] A draft with no rooms or no name shows the user sentence in English and Russian; no raw validator string renders.
- [x] A safety-gated card shows "I check it myself"; tapping it enables Open and ticks the catalog switch.
- [x] The three formula inputs have no `inputMode`; find-it passes at 390 and 1280 px.

## Implementation evidence

Run locally on 2026-11-06 on branch `adr-195-catalog-template-flows` (not merged, not deployed, not live-verified).

- Item 1: Edit design carries the unsaved draft into template mode (no save); "Save to template" stores it once
  (`saveTemplateEdit`, revision + 1); Cancel hands the draft back to the Catalog editor (`cancelTemplateEdit`).
  "Keep mine" writes the new optional `seenShipped` (validated in `validateLocalTemplate`; old rows without it read
  as before; no Dexie version change, no row rewritten). `basedOn` and `localRevision` stay.
- Item 2: `save`/`remove` never throw; they return false and set the store `error`, shown on the Catalog page as
  `alert error` (role=alert, scrolled into view, Dismiss). A failed editor Save keeps the editor open; a failed
  template-mode Save reopens the draft (edited design included). A failed templates read and a failed saved-designs
  read say they could not be read.
- Item 3: chip and heading counts count matched variants; the heading uses a plural ("1 item").
- Item 4: Open under the picture (column 1, rows 3–4), picture 96 × 34 px, no row gap, so a card keeps its height
  (92 px at 390 px, as before). Text column 214 px at 390 px (281 px at 1280) instead of ≈150. Cards without a
  picture keep the old layout. The "More" target is not reached: the meta line needs 272 px at the median (G-477).
- Item 5: "Save this piece as a template" is hidden when no design is open and opens the shared Save to catalog
  form (`CatalogSaveForm`: name, room, type); the confirmation links to the new family.
- Item 6: `validateLocalTemplate` returns codes; `templateProblemText` maps each to a `t()` sentence with a Russian
  entry (editor, Save to catalog, backup import). `templateFromDesign`'s texts got Russian data entries.
- Item 7: a card waiting only for `safety:user-confirmed` says "Safety-regulated: you check it against the standards
  yourself" with "I check it myself", which sets the catalog switch.
- Item 8: `inputMode` removed from the formula fields in `Variables.tsx` (the three named, plus the per-variable
  "Value of …" field in Settings, which also takes formulas).
- Needed for reachability: at 390 px the template-mode bar covered Cancel with the Undo button; the template-mode path
  now takes its own row on a phone.

Checks: `tests/catalog-flows.test.ts` 16/16, `tests/find-it/catalog.test.tsx` 16/16 (jsdom, 390 and 1280 px),
`tests/find-it/variables.test.tsx` new inputMode case at both widths. Browser acceptance
`tools/catalog-flows/find-it.mjs` on the production build (preview, port 4176): 39 passed, 1 failed (the item-4
"More" share at 390 px). Lint, format:check, typecheck, `pnpm test` (189 files, 1677 tests passed), build and docs check passed after rebasing on main.
