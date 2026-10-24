# ADR-064: One shopping list for a project: boards, banding, hardware, run parts and what is still to choose

- Status: Pending
- Date: 2026-10-24
- Decided by: user, 2026-10-24: "create the ADRs … auto-accept the recommended suggestion" (answers below)
- Depends on: ADR-010, ADR-018, ADR-020, ADR-036
- Design: docs/ui-design.md (results → Shopping list)
- Backlog: N59

## Context

Research feature _Consumer order completeness_ (value 3.8, P0/P1 by parent _Automatic BOM_; IKEA Kitchen: missing
items escape planning). The verify batch (N48) showed the project Parts CSV, sheets and print already exist. They are
cutting documents: boards by size. What to **buy** is spread over the Parts tab (sheets, edge banding), the hardware
schedule (`hardwareSummary`), run parts, appliance niches ("per its drawing") and user-specified hardware (sliding,
flaps, fixed fronts). Nothing collects them, and nothing says what is still undecided.

## Decision

- **Project and piece → Parts → "Shopping list"** with sections:
  1. _Boards_: per board, number of stock sheets from nesting (ADR-018), or m² when the board has no sheet size;
  2. _Edge banding_: metres per board and thickness;
  3. _Hardware_: every scheduled item with count and source pieces (hinges, runners, rails, handles, brackets);
  4. _Run parts_: worktop, plinth, fillers, covers (ADR-036, ADR-054);
  5. **To choose before buying**: items the model needs but whose product is user-specified — appliance per its
     drawing, sliding/flap hardware (ADR-037), fixed-front fixing (ADR-054), safety items awaiting values.
- **Not counted** line, always shown: "Screws, dowels, cams and glue are not counted" — they are not modelled and
  are not invented (ADR-010).
- **Outputs:** Shopping list CSV (Romanian, `;`, like the Parts CSV) and a print page (ADR-020). Prices appear per
  line when ADR-062's price list has them.
- Online ordering is ADR-063 (Pending).

## Alternatives considered

- **Extend the Parts CSV** — mixes cutting sizes with purchase quantities; cutters and shops need different lists.
- **Count fasteners from joints** — joint fixings are not modelled; any count would be invented.

## Scope

- In scope: shopping list screen, CSV and print, "to choose" list.
- Out of scope: fastener counts, online ordering (ADR-063).

## Consequences

- "Complete" means: every modelled part and every scheduled item, plus an explicit _to choose_ list.

## Done when

- [ ] Unit tests: a project with a sink base, an oven niche and a run → list has sheets, banding, hinges, runners, worktop and plinth, and _To choose_ lists the oven and the sink front fixing; quantities × piece quantity.
- [ ] Find-it at 1440 and 375 px: project → **Parts** → **Shopping list** → sections **Boards**, **Hardware**, **To choose before buying** visible; **Shopping list CSV** downloads.
- [ ] Find-it test passes from the bare app at phone and desktop widths (`tools/ensemble/find-it-adrs.mjs`)

## Answers

1. _Separate list or extend the Parts CSV?_ — **Separate Shopping list (screen, CSV, print).**
2. _Count screws and fixings?_ — **No; a fixed "not counted" line.**
3. _Boards in sheets or m²?_ — **Sheets from nesting; m² when no sheet size.**
4. _Online ordering?_ — **No; Pending in ADR-063.**

## Implementation notes

`src/core/shopping.ts` (`shoppingList`, `shoppingCsvRo`), new results tab **Shopping list** (`src/ui/Shopping.tsx`): Boards (sheets from the layout worker, else m²; solid stock in metres), Edge banding, Hardware, Run parts, **To choose before buying** (appliance niches, flap and sliding hardware, fixed-front fixing, and the rules' _hardware from a datasheet_, _anti-tip_ and _safety_ checks), the fixed "not counted" line; **Shopping list CSV** (Romanian, `;`) and **Print shopping list**. Tabs wrap on phones (found by the find-it run: five tabs were wider than 375 px). Tests: `tests/templates-prices-shopping.test.ts`. find-it `tools/ensemble/find-it-adrs.mjs` (production build, bare app, visible text, 1440 and 375 px): 60/60.
