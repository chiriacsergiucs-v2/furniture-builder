# ADR-117: Compact catalog on desktop and full card text on demand

- Status: Deferred (open question G-144: where the full card text shows)
- Date: 2026-10-27
- Depends on: ADR-116
- Design: docs/ui-design.md (section 4, catalog)
- Backlog: N115
- Acceptance: browser
- Agreed: 2026-10-27 "accept gap picks" (G-138 "Yes, same disclosure on desktop", G-143 "Full text … on tap")

## Context

Critique: [2026-10-27 UI critique](../retros/2026-10-27-ui-critique.md). [ADR-116](ADR-116-make-the-catalog-compact-on-a-phone-and-put-the-wizard-form.md) made the Catalog compact only at
≤ 760 px; at 1280 px it is still 36 785 px tall (G-138). On a phone each card's text lines end in an ellipsis with no
way to read the rest (G-143). The user, 2026-10-27: "accept gap picks". G-143's pick named "the item's detail view",
but the Catalog has no item detail view: tapping a card opens the item. Where the full text shows is G-144.

## Decision

- At every width: compact item cards (picture, name, one meta line with tags) and each family's details behind the
  closed "About this family" disclosure, as ADR-116 does on a phone. Only the search row is sticky.
- A card whose text is cut gets a way to read the full text without opening the item; the place is G-144 (default
  until answered: a "More" toggle on the card that expands its lines in place).

## Alternatives considered

- **Desktop unchanged** — not chosen (G-138 pick).

## Scope

- In scope: the Catalog list at every width; the full-text toggle; a browser find-it script.

## Consequences

- Positive: the desktop catalog scrolls about 3× shorter; no text is unreachable.
- Negative / risks: family details take one tap on desktop too.
- Harder to change later: nothing.

## Done when

- [ ] At 1280 px the Catalog page is under 15 000 px tall and "About this family" opens the details.
- [ ] At 390 and 1280 px every cut card line can be read in full from the card without opening the item.
- [ ] Find-it passes from the bare app at phone and desktop widths (`tools/catalog-compact/find-it.mjs`, extended).

## Open questions

- Where does a cut card's full text show: a "More" toggle that expands the card in place (default), or a tooltip on
  the ⓘ? G-144.
