# ADR-291: Catalog finder: a search-first catalog and product picker behind a switch

- Status: Pending
- Date: 2026-11-22
- Depends on: ADR-032, ADR-161, ADR-195, ADR-283
- Design: n/a (concept A "Finder", picked by the user from three previews on 2026-11-22)
- Backlog: N377
- Acceptance: browser

## Context

The user asked to rework the catalog (2026-11-22): "Ui rework the catalog part, something seems like verybad ui/ux,
replace it with something absolutely different, same toggle approach", with the scope "both": the Catalog page and the
seller product picker. Findings on the production build (Chromium, 390 × 844): the Catalog page is 19 365 px tall,
the first card starts near y = 690 under six bands of controls, a family repeats under every room it carries, and the
Add/Open verb is only in a label. The product picker has search only: no kind filter, count or paging, and the pictures
switch sits above the list on every open. Of three concepts (A Finder, B Room rails, C Drill-down) the user picked A.
"Same toggle approach" is the device flag of the canvas editor (ADR-283).

## Decision

1. A device flag `fb:catalogFinder`, off unless `on` is stored, switched from More › "Catalog finder (preview)".
2. With the flag on, the Catalog page shows: a title row with a "Catalog actions" button (New piece, Back to the editor,
   Save this piece as a template, Template files, the safety switch, all the grouped page's own controls); a sticky
   bar with the search and one row of filters (Source, Room, Type, Ready to open); a count line; a flat grid with each
   family once, 24 at a time with Show more. A family opens in a sheet that re-hosts the grouped page's family block,
   whose item tiles also show their verb (Add or Open). Saved, Brands and the template editor are the same components.
3. With the flag on, the product picker shows kind chips (from the caller's list, in its order), a product count, 30
   products at a time with Show more, and the pictures switch under the list.
4. The pure rules (`src/ui/catalogFinder.ts`) are unit-tested; the grouped page and picker are unchanged with the
   flag off.

## Alternatives considered

- **B Room rails** and **C Drill-down** — not picked by the user.

## Scope

- In scope: the Catalog page and the seller product picker behind the flag.
- Out of scope: the default and the grouped page's future (G-582); research and a published spec (G-583); Start from
  and the Materials band select (G-584); the filter row on narrow phones (G-585).

## Consequences

- Positive: on a phone the page is about 2 800 px tall instead of 19 365; the first family is on the first screen.
- Negative / risks: two layouts of the same page until the user decides (G-582).

## Done when

- [ ] More › "Catalog finder (preview)" turns the finder on and off; off shows the grouped page (browser script)
- [ ] The grid lists each family once, 24 first, starting in the first screen at 390 and 1280 px (browser script)
- [ ] Room, Type and Ready to open narrow the grid and the count; a search with no match says so (browser script)
- [ ] A family opens in a sheet whose items show their verb and open in the editor (browser script)
- [ ] The product picker shows kind chips, a count and 30 products with Show more (browser script)
- [ ] The finder's rules are unit-tested; every new text has its Russian entry (typecheck)
