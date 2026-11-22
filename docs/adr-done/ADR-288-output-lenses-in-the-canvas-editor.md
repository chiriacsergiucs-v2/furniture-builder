# ADR-288: Output lenses in the canvas editor

- Status: Implemented
- Date: 2026-11-22
- Implemented: 2026-11-22
- Depends on: ADR-287
- Design: https://claude.ai/artifact/HbCBLzkvgFuxRxmUKNzqF3 (design spec, slice 6: output lenses)
- Backlog: N371
- Acceptance: browser

## Context

Slice 6 of the canvas-native phone editor (ADR-283, G-577; user 2026-11-22: "Proveed slices"). In the design the
results are lenses over the drawing: Parts, Sheets, Hardware, Assembly and Shopping open while the piece stays in sight,
and the Parts lens labels the parts on the drawing. Today on a phone they live under Build & Preview, collapsed until a
tab is tapped (ADR-091); Checks already has its chip and pins (ADR-287).

## Decision

While the canvas editor is on (ADR-283), in Compose:

1. **Chips.** After the editor's blocks, the chip rail has Parts, Sheets, Hardware, Assembly and Shopping.
2. **Card.** A chip opens the results section itself (the same `Output`, its own tabs, lists, Download CSV and Print
   rules, ADR-008) as a card over the bottom of the screen, up to 55 % of its height, with a Close button; the editor's
   card closes. The drawing re-frames above it, as for the editor's card. Esc closes it.
3. **Parts on the drawing.** While Parts is open, each door and drawer front on the front drawing shows its cut size
   (length × width) from the same cut-list row (ADR-004).
4. Build & Preview and the Cut list nav are unchanged.

## Alternatives considered

- **Tables only in Build & Preview** — the drawing leaves the screen; the brief asks for results over the canvas.
- **Labels on every panel** — sides and rails are a few millimetres wide on a phone drawing; fronts carry the sizes
  people check first.

## Scope

- In scope: five chips, the results card in Compose, front sizes on the drawing.
- Out of scope: sheet layouts drawn on the piece, the Find search and first-run hints (next slice, G-577).

## Consequences

- Positive: results and the drawing on one screen.
- Negative / risks: a tall list leaves a small drawing; the card scrolls.

## Done when

- [x] Canvas editor on: the rail has Parts, Sheets, Hardware, Assembly and Shopping chips.
- [x] Each chip opens that results tab as a card with its panel; the drawing stays above the card.
- [x] With Parts open, the fronts on the drawing show their cut sizes.
- [x] Close brings the rail back and the sizes go.
- [x] Canvas editor off: no output chips.
- [x] `pnpm typecheck` passes (no new text).
- [x] `tools/output-lenses/find-it.mjs` passes at 360 and 390 px from the bare app.
