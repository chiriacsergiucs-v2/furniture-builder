# ADR-117: Put the pieces list first and fold the selected piece's sections

- Status: Implemented
- Date: 2026-10-27
- Implemented: 2026-10-27
- Depends on: none
- Design: docs/ui-design.md (section 4, project panel)
- Backlog: N116
- Agreed: 2026-10-27 "Selected piece card"

## Context

The user, 2026-10-27: "Run a critique for listings, headers, text, button sizes, gaps, groupings." Critique: [2026-10-27 UI critique](../retros/2026-10-27-ui-critique.md). The project's
Selected piece card runs ≈1 900 px on desktop and ≈8 sheet heights on a phone; the pieces list sits below it. The user
picked "Selected piece card: pieces list first; Position, Clearance, Finish, Merge folded into collapsible groups."

## Decision

- In the Project panel the pieces list comes before the Selected piece card.
- In the card, Width, Depth and the piece's name stay open; Position, Clearance, Finish and Merge each become a closed
  `Group` (`src/ui/controls.tsx`, `<details>`) with its title as summary. A group that holds an error diagnostic opens
  itself (ADR-008: errors are never hidden).
- No model, store or document change.

## Alternatives considered

- **Tabs inside the card** — more taps on a phone; not offered.

## Scope

- In scope: the order and the four groups; a jsdom find-it test.

## Consequences

- Positive: the list is reachable without scrolling; the card is short.
- Negative / risks: one more tap to reach Position, Clearance, Finish, Merge.
- Harder to change later: nothing.

## Done when

- [x] In a project with two pieces, the pieces list heading comes before "Selected piece" in the panel.
- [x] With a piece selected, "Position", "Clearance", "Finish" and "Merge" are closed groups; opening one shows its
      fields; Width and Depth are visible without opening anything.
- [x] Find-it passes from the bare app at phone and desktop widths (`tests/find-it/selected-piece.test.tsx`, jsdom).
