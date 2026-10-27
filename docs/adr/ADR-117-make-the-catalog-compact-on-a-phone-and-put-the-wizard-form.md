# ADR-117: Make the catalog compact on a phone and put the wizard form first

- Status: Pending
- Date: 2026-10-27
- Depends on: none
- Design: docs/ui-design.md (section 4, catalog and wizard)
- Backlog: N116
- Acceptance: browser
- Agreed: 2026-10-27 "Catalog density + wizard"

## Context

The user, 2026-10-27: "Run a critique for listings, headers, text, button sizes, gaps, groupings." Critique: [2026-10-27 UI critique](../retros/2026-10-27-ui-critique.md). The Catalog is
≈74 000 px tall at 390 (≈1 060 px per family); five control rows (≈360 px) come before the first family and 180 px of
them are sticky; tags push to a second line in 72 of 183 cards. In the wizard on a phone the preview comes first and the
form starts at y ≈ 540; the footer has Back, Cancel, Skip and Next in three styles. The user picked "Catalog density +
wizard: compact cards on phone, family details behind disclosure, fewer sticky rows; wizard form before preview, drop
Cancel."

## Decision

- Catalog at ≤ 760 px: compact item cards (96 px picture, name, one meta line with tags); each family's Default
  structure and Configurations behind a closed "About this family" disclosure; only the search row is sticky, source and
  grouping switches fold into one row.
- Wizard at ≤ 760 px: the step's fields come before the preview; the footer is Back, Skip, Next; Cancel goes (the
  dialog's × closes).

## Alternatives considered

- **Filter sheet for the catalog switches** — more taps; not chosen.

## Scope

- In scope: the Catalog list layout and the wizard order and footer on a phone; a browser find-it script.
- Out of scope: catalog data; the desktop catalog layout (G-138).

## Consequences

- Positive: the catalog scrolls ≈ 3× shorter; the wizard form is on the first screen.
- Negative / risks: family details take one tap.
- Harder to change later: nothing.

## Done when

- [ ] At 390 px the Catalog page is under 30 000 px tall and each item card's tags sit on one meta line.
- [ ] At 390 px only the search row stays on screen when the Catalog is scrolled; "About this family" opens the details.
- [ ] At 390 px the wizard's first field is above the preview; the footer has no "Cancel".
- [ ] Find-it passes from the bare app at phone and desktop widths (`tools/catalog-compact/find-it.mjs`, production
      build).
