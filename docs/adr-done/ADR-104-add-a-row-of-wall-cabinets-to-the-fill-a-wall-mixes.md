# ADR-104: Add a row of wall cabinets to the fill-a-wall mixes

- Status: Implemented
- Date: 2026-10-27
- Implemented: 2026-10-27
- Depends on: ADR-103
- Design: docs/ui-design.md (section 4, screens; wizard and catalog cards)
- Backlog: N102
- Agreed: 2026-10-27 "Wall cabinets above", "Second ADR right after (Recommended)", "Own mix, same total width", "Up to the entered height", "The whole wall width", "Catalog height, Refine field", "Door over shelves, Open shelves, Lift-up flap, Any", "Top box sized to the gap", "Yes, every catalog wall variant", "Full find-it test (Recommended)", "Refine choice, default any (Recommended)"

## Context

Same request as [ADR-103](../adr-done/ADR-103-fill-a-wall-width-with-a-suggested-mix-of-pieces-reverse-bui.md) (user,
2026-10-27: "a reverse furniture building, total width, to the mix of furniture pieces that fill that space …
So basically a mix and match"). Asked which piece kinds may appear, the user also chose **Wall cabinets above**.
That doubles the ADR, so the user chose a second ADR built right after ADR-103.

Requirement ledger (R1): (1) the mixes can have a row of wall cabinets above the base row; (2) the wall row has
its own mix of widths over the whole wall width; (3) its top touches the entered height; (4) over a tall cabinet,
a top box fills the gap up to the entered height; (5) any catalog wall-cabinet variant may appear.

## Decision

- **Wall row:** Refine gets **Wall cabinets: any / always / never** (default any, the user's answer; G-115) and
  **Wall cabinet height** (catalog default). With any, the first 4 cards show mixes with and without a wall row.
- **Widths:** the wall row is its own mix (not aligned with the base joints), with the same rules as ADR-103: any
  whole mm in [min, max], one width per stretch, exact split (ADR-003). It covers the whole wall width; over a tall
  cabinet only where a top box fits. Wall cabinets keep the catalog depth (G-123).
- **Over tall cabinets:** each tall cabinet gets a top box of its own width, sized to entered height − tall
  height. No room means no box there. The rest of the wall row fills the stretches over the base cabinets.
- **Height:** wall-cabinet tops sit at the entered height (ADR-031 wall placement). A wall cabinet that would
  reach into the base row overlaps it, which is an error in projects (`pieces-overlap`, ADR-008), so such mixes are
  not offered and the Suggestions step says why and what to change; nothing is clamped (G-124).
- **Kinds:** every catalog wall-cabinet variant (door over shelves, open shelves, lift-up flap, over-hood and the
  rest), resized. The ADR-103 centre divider rule applies to shelves past `shelfSpan`.
- **Ranking and picture:** as in ADR-103; the card picture and the width text show both rows
  ("Wall: 750 · 750 · 750 · 750 / Base: 600 · …").
- **Use this mix** saves the wall cabinets placed on the wall (ADR-031) in the same ordinary project. No new
  stored shape.

## Alternatives considered

- **Wall widths aligned with the base joints:** the user chose an own mix.
- **Wall row only over the base cabinets:** the user chose the whole wall width.
- **Shorten the tall cabinets under the wall row:** the user chose top boxes sized to the gap.

## Scope

- In scope: the wall row in `suggestMixes`, top boxes over tall cabinets, the two Refine fields, both rows in the
  picture, tests, and the find-it step.
- Out of scope: none beyond ADR-103 (G-113, G-114).
- Decided while building: wall cabinets keep the catalog depth (G-123); a wall row that overlaps the base row is
  dropped, not warned (G-124).

## Consequences

- Positive: a full wall (base, tall, wall row) from one wizard.
- Negative / risks: more combinations; the wall row is searched separately from the base row so the count stays
  bounded.
- Harder to change later: nothing stored beyond an ordinary project.

## Done when

- [x] Core: with Wall cabinets always, every mix has a wall row summing exactly to the wall width (2600 mm high, with
      top boxes), tops at the entered height, widths in range (tests).
- [x] Core: over a 2200 mm tall cabinet (catalog height, G-117) with 2600 entered, a 400 mm top box of the tall's width; with 2200
      entered, no box (tests).
- [x] Core: any catalog wall variant can appear; open wall shelves past the span get a centre divider (tests).
- [x] A wall row that would reach into the base row is not offered; the Suggestions step says by how much and to
      lower the wall cabinet height (tests; G-124).
- [x] The card picture and width text show both rows; Use this mix places the wall cabinets on the wall.
- [x] Find-it passes from the bare app at phone and desktop widths (`tools/wall-fill/find-it.mjs`, wall row step).
