# ADR-020: Printing and drawings: SVG from the model plus a print stylesheet, no PDF library

- Status: Implemented
- Date: 2026-10-21
- Implemented: 2026-10-21
- Decided by: open questions answered by the user
- Depends on: none
- Design: n/a
- Related: ADR-004, ADR-009, ADR-014, ADR-018
- Backlog: N02

## Context

The user needs paper in the workshop: parts list, front elevation with dimensions, and (after ADR-018) one sheet
diagram per board. A PDF library would add hundreds of kilobytes and a second layout engine.

## Decision

Add a print view that renders, from `FurnitureModel` and the cut list only: a title block (design name, date,
overall size), the front elevation SVG with dimensions, the grouped parts list with edge marks, the hardware list, and
open checks. A `@media print` stylesheet sets A4 pages, black-on-white, page breaks per section. _Save as PDF_ is the
browser's own print dialog. SVG drawings (elevation, later sheet diagrams) are also downloadable as files. Printing is
blocked, like CSV, while the design has errors.

## Alternatives considered

- **jsPDF / pdf-lib** — larger bundle, separate layout code to keep in sync.
- **Server-side PDF** — breaks ADR-002.

## Consequences

- Output depends on the browser's print engine; checked by screenshots of print preview.
- The elevation component gains a print variant (no hover states, fixed scale bar).

## Evidence (repository files)

- `src/ui/PrintSheet.tsx` — Romanian A4 sheet: title block, front view, parts list with drilling, hardware, checks to verify, sheets to buy and per-sheet cutting plans; computes no geometry.
- `src/core/ro.ts` — Romanian part names, hardware wording, drilling text, `cutlistCsvRo` (`;`-separated, UTF-8 BOM).
- `src/ui/App.tsx` — Print (blocked on errors; waits for Romanian glyphs before the dialog), Drawing (self-contained SVG), Parts CSV in Romanian.
- `src/styles.css` — `@page A4 portrait` print rules.
- `tests/ro.test.ts` — CSV format, every generated part label translated, hardware/drilling wording; print PDF rendered from the running app during development.

## Compliance check

When accepted: the print view imports only `src/core` and presentational components; it computes no geometry.

## Answers (2026-10-21, from the user)

- **Page:** A4 portrait.
- **Language for the panel shop:** Romanian on printed sheets **and in the parts CSV** — column headers
  _Denumire, Material, Grosime, Lungime, Lățime, Buc., Cant L, Cant l, Fibră_. The app UI stays English. This changes
  the CSV headers defined under ADR-009 when N02 is built; sizes and edge notation are unchanged.

Built and accepted 2026-10-21. CSV uses semicolons and a UTF-8 BOM so Romanian Excel opens it in columns with diacritics.
