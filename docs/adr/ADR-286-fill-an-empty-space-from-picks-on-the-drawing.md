# ADR-286: Fill an empty space from picks on the drawing

- Status: Pending
- Date: 2026-11-22
- Depends on: ADR-285
- Design: https://claude.ai/artifact/HbCBLzkvgFuxRxmUKNzqF3 (design spec, slice 4: in-space picks)
- Backlog: N369
- Acceptance: browser

## Context

Slice 4 of the canvas-native phone editor (ADR-283, G-577; user 2026-11-22: "Proveed slices"). In the design, what goes
into a space is picked inside the space: an empty space shows Shelves · Drawers · Hanging · Door where it is drawn.
Counts of a filled space are already changed on the drawing by the quick-count card (ADR-084).

## Decision

While the canvas editor is on (ADR-283), a selected empty space shows a group "Fill this space" laid over it on the
front drawing, with four 44 px buttons:

1. **Shelves, Drawers, Hanging** set what goes there the way the Contents block does (`changeKind`); an empty space
   loses nothing, so no question is asked (ADR-246 asks only when something would be lost). The picks then go and the
   quick-count card (ADR-084) takes over the counts.
2. **Door** adds a single hinged door (the Doors and handles block's "Door"), pressed while there is one; a second tap
   takes it off.
3. Kept as today: Contents and Doors and handles in the lens card for every other choice; also fixed here: the depth tag
   (ADR-284) moves to the end of the overall width line, clear of the selected space's size above the piece.

## Alternatives considered

- **Picks for filled spaces too** — changing a filled space resets it (ADR-246); that stays in the card, where the
  question is asked.
- **A radial menu on long-press** — hidden; rejected in the design study.

## Scope

- In scope: the four picks over an empty selected space.
- Out of scope: problem pins (next slice, G-577).

## Consequences

- Positive: filling a space is two taps on the drawing.
- Negative / risks: on a very small space the picks spill over its edges (they stay readable, the space stays
  selected).

## Done when

- [x] Canvas editor on: a selected empty space shows "Fill this space" with Shelves, Drawers, Hanging and Door, each
      ≥ 44 px.
- [x] Door adds a door (pressed); a second tap takes it off.
- [x] Shelves fills the space: the picks go and the drawing names the shelves.
- [x] Canvas editor off: no picks.
- [x] Every new text has its Russian entry; `pnpm typecheck` passes.
- [x] `tools/space-picks/find-it.mjs` passes at 360 and 390 px from the bare app.
