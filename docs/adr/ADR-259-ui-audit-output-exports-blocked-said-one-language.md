# ADR-259: UI audit — Output: every export blocked on errors, every failure said, one print language

- Status: Pending
- Date: 2026-11-10
- Depends on: none
- Design: docs/ui-design.md
- Backlog: none
- Acceptance: full

## Context

The user asked for a domain-by-domain UI audit (2026-11-10): map every sub-flow, find what breaks it, propose the
best fix, then cross-examine. This ADR is domain 13, **Output** (`src/ui/info/features.ts:1017-1152`). The full
sub-flow map (22 feature lines, entry → steps → end state, code and tests per row) and the evidence are in
[docs/research/ui-audit-13-output.md](../research/ui-audit-13-output.md).

Summary of the map: the results tabs (`src/ui/Output.tsx:28-92`) hold Parts (CSV, Print, Client sheet, solid timber
lengths), Sheets (`src/ui/Sheets.tsx`), Hardware, Assembly (`src/ui/Assembly.tsx`), Shopping
(`src/ui/Shopping.tsx`) and Checks; the header chip opens Shopping (`src/ui/App.tsx:119-147`); ⋯ More → Files holds
Front view drawing, Fusion 360 script and Hand to a professional (`src/ui/shell/MoreMenu.tsx:136-194`). All are
reachable at 390 and 1280 px.

Three rules are already settled: errors block export and printing (ADR-008; ADR-020 line 23), a print never mixes
languages (ADR-181 item 4), and printed piece names follow the print language (ADR-212, G-381). Parts and the Shopping
list keep them; three exports, the Shopping list print and two prints do not, and two storage failures are not said.

## Findings

| Id      | Class        | Severity | Finding                                                                                                                                                  |
| ------- | ------------ | -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D13-F1  | Proven       | major    | Print assembly steps, Fusion 360 script and Front view drawing work while the design has errors (`Assembly.tsx:256-264`, `MoreMenu.tsx:170-194`).        |
| D13-F2  | Proven       | minor    | The printed Shopping list writes units and the estimate line in the app language and decimals with a dot (`Shopping.tsx:152,161-172`); the CSV does not. |
| D13-F3  | Proven       | minor    | The Shopping list CSV file name is the raw title (`Shopping.tsx:244`); reproduced: `Kids/room: "chest"-shopping.csv`.                                    |
| D13-F4  | Proven/Code  | major    | A refused price import says nothing (`Shopping.tsx:115-141`; unhandled rejection); the chip says "No prices yet" when prices could not be read.          |
| D13-F5  | Proven       | major    | Hand to a professional with a failed model or picture read: empty list, Download .zip disabled, no message (`ReviewPack.tsx:34-61`).                     |
| D13-F6  | Proven       | minor    | A project's cutting sheet parts list and Client sheet print the stored piece name; its pieces table and the CSV print the print name.                    |
| D13-F7  | Code-evident | minor    | The Client sheet can show the render of another piece (`lastRender` never cleared, `Output.tsx:164`, `uiStore.ts:103-108`).                              |
| D13-F8  | Code-evident | minor    | Wrong Price and Seller units are only coloured; a wrong seller-item Quantity is dropped in silence, its label untranslated (`Shopping.tsx:407-570`).     |
| D13-F9  | Code-evident | polish   | Client sheet prints "1 linii fără preț" / "1 lines without a price" (`PrintClient.tsx:86-90`).                                                           |
| D13-F10 | Rejected     | —        | A failed sheet layout shows the validator's English details (`Sheets.tsx:124-125`); see Cross-examination.                                               |

## Decision

One rule for every output: **an export or print is blocked while there is an error, every failure is said where the
user tapped, and a print speaks only the print language.**

1. **F1:** Print assembly steps, Front view drawing and Fusion 360 script are disabled while the shown design has an
   error, with the Parts tab's reason "Fix the problems listed under Checks first" as title and, in the menu, as the
   small text under the item.
2. **F2:** `printList` uses `pt(UNIT_PRINT[…])` (exported from `src/core/shopping.ts`), the CSV's decimal comma, and a
   new `pt()` estimate line in ro, ru, en ("Estimare: {total} {currency}", with the missing-price and seller parts).
3. **F3:** the Shopping list CSV is named `${fileName(view.title)}-shopping.csv`.
4. **F4:** `importCsv` catches a failed save or read and says "The prices could not be saved on this device." in the
   Shopping list status; the chip shows "Prices could not be read" (new `t()` key, Russian entry) when
   `priceState === 'failed'`.
5. **F5:** the review pack effect catches a failure and says "The pack could not be made: pictures or 3D models could
   not be read from this browser." in the dialog's status; Download stays disabled.
6. **F6:** the cutting sheet's parts list swaps the piece prefix with `printPieceNames` as the CSV does, and the
   Client sheet lists `printPieceName(pc.item.design)`.
7. **F8:** Price and Seller units per item get `aria-invalid` and a hint naming the expected value; Quantity of a
   seller item does the same instead of dropping the value, and its label goes through `tr()`.
8. **F9:** `pt('{n|# linie fără preț|# linii fără preț}')` with its Russian and English plural forms.
9. **F7:** not decided here (Open questions). **F10:** no change (rejected).

## Alternatives considered

- **F1: warn instead of blocking** — an assembly sheet or a Fusion model of overlapping parts is the error ADR-008
  keeps from leaving the app; a warning would soften an error diagnostic.
- **F2: translate every Shopping line into the print language** — larger (core lines are built in the app language,
  `shopping.ts:96-118`, e.g. `:103-104`); ADR-181 asked for headers only. Units and the estimate line are headers of the same print.
- **F5: build the pack without the failed models** — the project file in the pack would silently lack them.

## Scope

- In scope: F1–F6, F8, F9 as decided; tests for each.
- Out of scope: F7 until the user answers; translating Shopping line items into the print language (not asked).

## Consequences

- Positive: the same block-and-say rule on every output; one language per printed page.
- Negative / risks: `tests/find-it/prints-exports.test.tsx:79-81` expects the stored name "Chest of drawers" in the
  Client sheet under a Romanian print and must expect the print name.

## Done when

- [ ] With an error, Print assembly steps, Front view drawing and Fusion 360 script are disabled with the reason (test).
- [ ] The printed Shopping list has no app-language word in ro and en print languages, and the CSV file name is cleaned (test).
- [ ] A refused price import and an unreadable price list are said on the Shopping list and on the chip, no unhandled rejection (test).
- [ ] Hand to a professional with a failing model read says why and leaves no unhandled rejection (test).
- [ ] A project's cutting sheet parts list, Client sheet and CSV use the same printed piece name (test).
- [ ] Wrong Price, Seller units and seller Quantity are `aria-invalid` with a hint, in English and Russian (test).
- [ ] The Client sheet says "1 linie fără preț" for one line and "2 linii fără preț" for two (test).
- [ ] Find-it test passes from the bare app at phone and desktop widths.

## Cross-examination

One round, 2026-11-10. The skeptic checked each finding for duplicates, for behaviour an implemented ADR intends, for
conflicts with the hard rules, for over-engineering and for missing tests.

| Id      | Skeptic                                                                                                    | Proposer                                                                                                                                                                              | Verdict             |
| ------- | ---------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------- |
| D13-F1  | ADR-021 and ADR-174 say nothing about errors; a user may want to finish an errored design in Fusion.       | ADR-008's rule is "errors block export" (CLAUDE.md hard rule) and ADR-020 line 23 blocks printing; no later ADR exempts these three. Reproduced: all three enabled with one error.    | Accepted            |
| D13-F2  | ADR-181 item 4 promised headers only; line items are English too.                                          | Units and the estimate are not line items; ADR-181 item 4's reason is "a print never mixes languages", and the CSV already prints `buc` where the print says `pcs`. Reproduced.       | Accepted            |
| D13-F3  | Browsers clean file names themselves.                                                                      | Not every browser does it the same way; the Parts CSV and every other file use `fileName()` (`Output.tsx:129`, `MoreMenu.tsx:129,163,186`). One call.                                 | Accepted            |
| D13-F4  | Duplicate of ADR-247's save rule?                                                                          | ADR-247 covers creation paths only. A typed price already says its failure (`Shopping.tsx:112-114`); the import does not. Reproduced: no message and an unhandled rejection.          | Accepted            |
| D13-F5  | Rare: needs a broken IndexedDB.                                                                            | Rare, but the dialog is a dead end with no word; ADR-008 spirit and the storage rule say failures are named. Reproduced.                                                              | Accepted            |
| D13-F6  | `tests/find-it/prints-exports.test.tsx:79-81` expects the stored name, so ADR-206 intends it.              | ADR-206 came before ADR-212, whose reason is "prints speak one language" (ADR-212 line 82); the cutting sheet already contradicts itself between two tables. The test line changes.   | Accepted            |
| D13-F7  | ADR-206 item 1 says "the last PNG the Render dialog made this session": intended.                          | Intended as written, but the ADR did not consider a render of another piece; whether to change it is the user's call.                                                                 | Needs user decision |
| D13-F8  | Polish.                                                                                                    | A value dropped with no word breaks ADR-008 ("never clamped silently"); the rest of the editor marks wrong fields `aria-invalid` (ADR-199 test `piece-editor-inputs.test.tsx:27-31`). | Accepted            |
| D13-F9  | Over-engineering for one word.                                                                             | One `pt()` key with plural forms that `format` already supports (`src/core/i18n/print.ts:43`); a printed sheet for a client should read right.                                        | Accepted            |
| D13-F10 | A translated lead sentence is already there; the details come from an internal check that should not fail. | Agreed: the details are for a bug report, the user-facing sentence is translated (`Sheets.tsx:124`).                                                                                  | Rejected            |

## Open questions

- **D13-F7:** Which picture should the Client sheet use after a render of another piece? (a) the last render of the
  session, as now (ADR-206); (b) the last render only when it was made of the piece or project now open, else the 3D
  still or front view; (c) forget the render whenever another piece or project opens. Suggested: (b).
