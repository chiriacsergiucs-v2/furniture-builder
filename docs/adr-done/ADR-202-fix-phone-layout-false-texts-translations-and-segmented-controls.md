# ADR-202: Fix the phone layout, false texts, translations and segmented controls

- Status: Implemented
- Date: 2026-11-06
- Implemented: 2026-11-06
- Depends on: ADR-048, ADR-074, ADR-157, ADR-185, ADR-191
- Design: docs/ui-design.md (3. Components and states)
- Backlog: N207
- Acceptance: browser

## Context

The user asked: "in groups of 7-10 gaps create adrs, no implementation". This ADR takes over nine gaps:

- G-003 (Materials fields overlap at 375 px): phone first, no overlap or sideways scroll at 390 px (context, not a quote).
- G-096 (Brands list promises a cancelled feed): the feed was cancelled by the user, "Mark 029 as won't do" (G-044).
- G-353 (catalog piece names untranslated on prints): "Translate with the print"; user-typed names are not (G-304).
- G-042 (Romanian labels part only): "Hardware and fastener completeness".
- G-357 (Doors is a dropdown on desktop): not asked; noted in the ADR-191 critique of 2026-11-05.
- G-360, G-361, G-362, G-366: not asked; from the 2026-11-05 design critique ("critique of design … 1 adr with
  high and medium issues and fixes per flow").

User accepted the gaps' suggested picks on 2026-11-06. No pick conflicts with an implemented ADR, needs a physical
value (ADR-010) or touches saved designs; the design document does not change, so no `schemaVersion` bump (ADR-011).

## Decision

1. **Materials row on a phone (G-003, bug).** At ≤760 px `.materials li` (`src/styles.css` ~2803) keeps colour and
   name on row one; Thickness, Has grain, Finish, the board product and the sheet fields each take
   `grid-column: 1 / -1`, so none lands in the 36 px column. No text changes.
2. **True Brands text (G-096).** `Catalog.tsx:618` reads "No brand products are bundled with the app. Import your
   own under Template files › Import templates." The old key and its Russian entry (`ru/catalog.ts:47`) are deleted;
   the new key gets its Russian entry there.
3. **Hardware notes as whole sentences (G-366).** `hingeBand()` goes; the cabinet and corner hinge notes pick one
   whole sentence per door-height band (today's eight texts, whose entries in `ru/data-parts.ts` stay). Notes with
   numbers (sliding pair, lift-up front, appliance niche, side clearance) are one key each with `{placeholders}`, a
   Russian entry in `ru/data-parts.ts`, shown through `tr()`; the number-specific literal entries are deleted. The
   pick says `t()`: notes are model data, and `t()` in a generator would freeze one language into the model, so
   they use `tr()` (CLAUDE.md, built-in data).
4. **Catalog piece names on prints (G-353).** `printPieceName(design)` (`src/core/catalog/`): while `design.name`
   equals the default name of the variant in `catalog.origin` (`catalogId`, `variantId`), it prints in the print
   language: Romanian `{nameRo} — {VARIANT_RO[variantId]}`, Russian its `ru/data-catalog.ts` entry (read directly,
   whatever the UI language), English the name. A renamed piece prints as typed (G-304). Used by the assembly sheet
   (headings, front-view labels, project order) and the cut sheet's _Piese în proiect_ table. No new keys: a test
   asserts every variant has both names.
5. **Fastener CSV and print text (G-042, part).** `fastenerShopLines` also returns `printLabel` and `printDetail`
   built with `pt()`; `shoppingCsvRo` and the printed list use them, and the footer uses a `pt()` sentence instead
   of `NOT_COUNTED`. New `print-text.ts` keys with Russian and English entries: the six joint line names, their
   six "how" texts, "Orientativ: numărat din model", the choose line and the footer; existing plural keys and
   'Setări › Elemente de fixare' are reused. The user's fastener name prints as typed.
6. **Catalog counts hint (G-362).** The header count stays. Under _By room_ a hint reads "A family can sit in
   several rooms, so the room counts add up to more than the total." (`t()`, Russian entry in `ru/catalog.ts`).
7. **Doors as a segmented control (G-357).** `Wizard.tsx:179` uses `Segmented` up to five options. A five-option
   control gets `.segmented.wrap`: labels stay on one line and are never clipped; at 390 px it wraps to a second
   row, at 1280 px it fits one row. No text changes.
8. **Short Review labels (G-360).** `FieldDef` gets an optional `reviewLabel` (wizard definition, not saved data).
   'Width of each compartment (0 = share the rest)' gets "Compartment widths" (Russian "Ширина секций" in
   `ru/data-wizard.ts`); Review shows `tr(f.reviewLabel ?? f.label)`.
9. **Arrow keys on segmented controls (G-361).** One helper in `controls.tsx` gives a roving tabindex: only the
   selected option is a Tab stop (the first when none); ←/↑ and →/↓ move and select, wrapping; Home and End go to
   the ends. `Segmented` uses it, and so do the hand-written single-choice groups: Editor mode, View and Look
   (`App.tsx`), Group by and Source (`Catalog.tsx`), the material scope (`MaterialDialog.tsx`), Research sections
   and Features in the assessment (`Research.tsx`). Checkable chips (`.segmented.multi`) keep one Tab stop per
   toggle. The wizard type radios belong to ADR-194. No text changes; the feature tree (`src/core/features.ts`)
   gets an "Arrow keys in segmented controls" line with its Russian entry.

## Alternatives considered

- **G-366: keep one literal entry per number** — every new size gives an untranslated note.
- **G-353: a new Romanian table of every default name** — 100+ entries to keep in step; `nameRo` and
  `VARIANT_RO` already exist.
- **G-361: key handlers per screen** — eight copies that drift; the pick is one shared change.
- **G-096: hide Brands while empty** — the second route of the gap's question; it removes a source instead of
  saying what is true.

## Scope

- In scope: the nine fixes above, their unit tests, Russian, English and Romanian entries, one browser find-it script.
- Out of scope: G-042's project-level fasteners panel and drilling positions drawn from the user's values (G-380);
  piece names in the parts CSV and the shopping list title stay as named (G-381).

## Consequences

- Positive: no phone overlap, no false promise, prints without English fragments, one keyboard model.
- Negative / risks: the arrow-key helper changes every segmented control; find-it checks two of them.
- Harder to change later: hardware note keys are sentences with placeholders; editing one edits its entry.

## Done when

- [x] At 375 and 390 px the Materials row has no overlapping field and no horizontal page scroll; the empty Brands
      list shows the new text in English and Russian (browser find-it).
- [x] Under Russian, every hardware note of every catalog variant's model translates, with no English left (test).
- [x] Romanian, Russian and English assembly prints of an untouched "Base cabinet, 1 door" show its name in that
      language; a renamed piece prints as typed (tests).
- [x] The Russian and English shopping CSV show fastener lines, details and footer in that language (tests).
- [x] _By room_ shows the several-rooms hint; Wizard Doors shows five whole segmented labels at 390 and 1280 px;
      Review reads "Compartment widths: 0 mm" (browser find-it).
- [x] In `Segmented` and the eight hand-written groups, Tab reaches only the selected option; arrows, Home and End
      move and select (unit test of the helper; find-it on Editor mode and Finish).
- [x] `tools/texts-and-controls/find-it.mjs` passes against the production build at 390 and 1280 px.
- [x] Lint, format, typecheck, test, build and docs check pass.
