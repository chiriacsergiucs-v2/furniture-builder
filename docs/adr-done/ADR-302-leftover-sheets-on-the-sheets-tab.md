# ADR-302: Leftover sheets on the Sheets tab

- Status: Implemented
- Date: 2026-11-27
- Implemented: 2026-11-27
- Depends on: ADR-011, ADR-018, ADR-019
- Design: docs/ui-design.md
- Backlog: N429

## Context

The user (2026-11-27): "Sheets can also be configurable, in my case when i am on tab sheets, I want to be able to
choose that sheet 1 is of a custom size. Basically, I have a leftover and I want to reuse it." Picks: leftovers are
saved with the design; parts fill leftovers first, then full sheets; "Sheets to buy" counts only full sheets; one pull
request with the Sheets tab part labels asked in the same request.

Today a board has one stock sheet (ADR-019, `Material.sheet`) and the placer (ADR-018) lays every sheet at that size.

## Decision

- **Model:** `Material.leftovers?: { length: Mm; width: Mm }[]` (schemaVersion 15). Each entry is one physical piece
  the user owns; length runs along the grain like `sheet.length` (ADR-009). The board's trim applies to a leftover
  as to a full sheet. Validation: at most 50 entries, whole mm from 1 to 20 000; a leftover in a file older than 15 is
  an error. Older files load unchanged (the field is optional).
- **Placer:** `NestJob.leftovers?` lists the pieces. Every attempt opens them before any full sheet, so parts go on
  leftovers first; leftovers that end empty are dropped. `SheetLayout.leftover` names the piece used and its size is
  that piece's size. `NestStats.leftoversUsed` counts them; the stock `count` limits full sheets only. A leftover with
  no usable area after trim makes the job invalid (shown as "sheet settings are invalid", never skipped silently).
  The independent validator checks each leftover sheet against its piece, each piece at most once.
- **UI:** each board's section on the Sheets tab has a **Leftovers** list (add, set length and width, remove), saved
  on the board as one undo step; a leftover sheet's caption reads "Sheet N · leftover L × W". "Sheets to buy" and the
  estimate count full sheets only.

## Alternatives considered

- **Session-only leftovers** — no ADR, but lost on reload; the user picked saving.
- **Replace sheet N by a size** — the user picked filling leftovers first.

## Scope

- In scope: design mode Sheets tab, the placer, validator, estimate and printed buy list.
- Out of scope: editing leftovers on a project's Sheets tab (a project lays out full sheets only, G-609).

## Consequences

- Positive: an offcut the user owns is used before buying a new sheet.
- Negative / risks: the placer opens up to 50 extra sheets per attempt; the attempt count is unchanged.
- Harder to change later: the saved `leftovers` shape.

## Done when

- [x] A design with leftovers validates and reaches the layout; a leftover in a schemaVersion 14 file is an error
      (`tests/leftovers.test.ts`).
- [x] Parts fill a leftover before a full sheet; the validator accepts it and rejects a leftover sheet of the wrong
      size or used twice (`packages/nesting/tests/nesting.test.ts`).
- [x] "Sheets to buy" counts full sheets only (`tests/leftovers.test.ts`, `tests/find-it/sheets-leftovers.test.tsx`).
- [x] Find-it: Sheets tab → Leftovers → Add leftover; a sheet caption reads "leftover" at 390 and 1280 px
      (`tests/find-it/sheets-leftovers.test.tsx`).
