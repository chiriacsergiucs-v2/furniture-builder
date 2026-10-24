# ADR-062: Cost estimate from the user's own price list (no supplier service)

- Status: Pending
- Date: 2026-10-24
- Decided by: user, 2026-10-24: "create the ADRs … auto-accept the recommended suggestion" (answers below)
- Depends on: ADR-002, ADR-010, ADR-012, ADR-018
- Design: docs/ui-design.md (results → Shopping list)
- Backlog: N59

## Context

Research feature _Live price/cost estimate_ (rank 24, value 4.1 "Medium if data exists", P1/P2; Roomle pricing,
Cyncly live pricing data, VividWorks). The app has no prices anywhere. ADR-002 forbids remote services and ADR-010
forbids invented data, so prices can only come from the user. Supplier price feeds or online ordering would be a
non-free outside integration: that part is split into **ADR-063 (Pending)**.

## Decision

- **Price list on this device:** the next free Dexie version adds table `prices: 'id'` (shared with ADR-060's
  `projectTemplates` if built in the same change; otherwise whichever ships second takes the following version). Entries:
  - board: by `materialKey` (name + thickness + grain), price **per sheet** (stock sheet size from the board) or
    **per m²** — the user chooses which;
  - edge banding: per metre, by board;
  - hardware: per item kind as the hardware schedule names it (hinge, runner pair, handle, rail …);
  - run parts use their board's price; worktop boards may be priced per piece.
- **Estimate:** the **Shopping list** tab (ADR-064) of a piece or project shows **"Estimate: 4 812 lei — 3 prices missing"**: sheets from the
  nesting result (ADR-018) × sheet price, or m² × m² price; edge-band metres × price; hardware counts × price.
  Missing prices are listed by name, never guessed; the total is marked _incomplete_ while any is missing.
- **Currency:** one setting, default **lei (RON)** (the app's outputs are Romanian); amounts are user input, shown
  with two decimals; no exchange rates.
- **Import/export** of the price list as CSV (`kind;key;unit;price`), like the decor list (ADR-049).

## Alternatives considered

- **Prices stored on each board in the design** — every copy of a piece would carry its own price and drift.
- **Supplier price feed** — needs a remote, usually paid, service: ADR-063 (Pending).

## Scope

- In scope: the user's own price list on this device, estimate, CSV import/export.
- Out of scope: supplier prices and ordering (ADR-063).

## Consequences

- Estimates are only as good as the user's list; the UI says "your prices, saved on this device".

## Done when

- [ ] Unit tests: estimate from sheets and from m²; missing prices listed, total marked incomplete; CSV round trip; unreadable price rows skipped and kept.
- [ ] Find-it at 1440 and 375 px: piece → **Parts** → **Prices** → enter a sheet price for the body board → the line **Estimate:** shows a total and **prices missing** for the rest.
- [ ] Find-it test passes from the bare app at phone and desktop widths (`tools/ensemble/find-it-adrs.mjs`)

## Answers

1. _Where do prices come from?_ — **The user's own list on this device; supplier feeds are ADR-063 (Pending).**
2. _Board price per sheet or per m²?_ — **User's choice per board; sheet counts from nesting when per sheet.**
3. _Currency?_ — **One setting, default lei (RON); no conversion.**
4. _What if a price is missing?_ — **Listed by name; total marked incomplete; nothing guessed.**

## Implementation notes

`src/core/prices.ts` (whole minor units, per sheet / per m² / per m / per piece, currency row, CSV), Dexie v7 `prices`. The estimate is shown in the new **Shopping list** tab (ADR-064) — not in the Parts tab — because it prices the shopping lines: **Estimate: … lei — N prices missing (incomplete)**; **Prices** opens a price field and unit beside every line, _Currency_, _Export prices_, _Import prices_. Board per-sheet prices need the sheet layout; while the design has errors, boards show m² and per-sheet prices count as missing. Tests: `tests/templates-prices-shopping.test.ts`. find-it `tools/ensemble/find-it-adrs.mjs` (production build, bare app, visible text, 1440 and 375 px): 60/60.
