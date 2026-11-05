# ADR-181: Unit price and line total on each Shopping list row

- Status: Pending
- Date: 2026-11-05
- Depends on: ADR-172
- Design: docs/ui-design.md (section 4, Build & Preview tabs)
- Backlog: N184
- Agreed: 2026-11-05 "Proceed similarly with next 5 adrs"; answer "Shopping list rows"

## Context

Gap G-339 (ADR-172): no price per row. Re-checked 2026-11-05: each Shopping list row already shows its line total
(`src/ui/Shopping.tsx:404`); what is missing is the unit price the total comes from.

User, 2026-11-05: **"Shopping list rows"** — unit price and line total on each Shopping list row, where the seller
prices already are; "—" when a row has no price.

## Decision

1. Each priced Shopping list row shows, under its line total, the unit price it was worked out from: "{price} {currency}
   / {unit}" (sheet, m², m, piece, per worktop board), from the user's price or the seller price
   (`priceSource`, unchanged). A row without a price shows "—" instead of "price missing"; the "sheets not laid out"
   hint stays.
2. The printed list and the CSV gain a Unit price column (`pt()` texts in ro, ru, en).
3. No new price logic: the unit price is the stored entry's amount and unit.

## Alternatives considered

- **Shopping list and Parts** — a per-part cost split from the sheet price; not a seller fact, twice the work. Not
  chosen.

## Scope

- In scope: Shopping list rows, its print and CSV.
- Out of scope: per-part prices in the Parts table (the alternative of G-339 the user did not choose).

## Consequences

- Positive: each total can be checked against its unit price.
- Negative / risks: one more line per row on phones.

## Done when

- [ ] A row priced per m² shows "/ m²" with the entry's amount and the same line total as before (tests)
- [ ] A row without a price shows "—" (tests)
- [ ] The CSV and the print have the Unit price column in ro, ru and en (tests)
- [ ] Shopping list → a unit price beside a total at 390 and 1280 px (jsdom find-it)
- [ ] Russian entries for every new text
