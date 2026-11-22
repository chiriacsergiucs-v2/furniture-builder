# ADR-285: Divide handles and dividers on the drawing

- Status: Pending
- Date: 2026-11-22
- Depends on: ADR-284
- Design: https://claude.ai/artifact/HbCBLzkvgFuxRxmUKNzqF3 (design spec, slice 3: split bars and + divide handles)
- Backlog: N368
- Acceptance: browser

## Context

Slice 3 of the canvas-native phone editor (ADR-283, G-577; user 2026-11-22: "Proveed slices"). In the design a space
is divided on the drawing with a green + on its edge, and the divider between two parts is moved by dragging it. Today
dividing needs the Divide this space block (Side by side, Stacked) and part sizes are typed in Division.

## Decision

While the canvas editor is on (ADR-283):

1. **+ handles.** An undivided selected space shows "Divide side by side" on its right edge and "Divide stacked" on
   its bottom edge, 44 px buttons. A tap makes the same two-part split as the Divide block (`splitSpace`, 2 parts).
2. **Dividers.** The selected split, or the split around the selected part, shows a divider between each pair of
   parts ("Divider 1 of 2", a slider). Dragging it sizes the part before it: that part's size becomes a fixed size
   (`mm`), the others keep theirs. The drawing shows the size while dragging; the model changes once, on release (one
   undo step), in whole millimetres, 10 mm steps while Snap is on (Alt frees it).
3. **Without a drag.** ← → (↑ ↓ for stacked) on the focused divider step 10 mm; the size tag (ADR-284) types it
   (WCAG 2.5.7).
4. Positions come from the model (ADR-004); a size that leaves the split short or over is a diagnostic as today
   (ADR-008).

## Alternatives considered

- **Live re-layout while dragging** — every move rebuilds the model and adds history; one commit on release matches
  the height drag (ADR-122).
- **+ adds a part to the parent split** — the parent's Parts counter does that; a + that divides the space it is on is
  easier to predict.

## Scope

- In scope: the two + handles, dividers with drag and arrow keys.
- Out of scope: in-space picks (next slice, G-577), 3D handles.

## Consequences

- Positive: dividing and resizing parts without opening a card.
- Negative / risks: a dragged part becomes a fixed size; a share split turns mixed (visible in Division).

## Done when

- [x] Canvas editor on: an undivided selected space shows "Divide side by side" and "Divide stacked", each ≥ 44 px.
- [x] "Divide side by side" adds one space to the drawing; "Divide stacked" on a part does the same.
- [x] The split shows "Divider 1 of 1".
- [x] Dragging the divider right makes the first part wider; one Undo restores the size.
- [x] → on the focused divider adds 10 mm.
- [x] Canvas editor off: no handles.
- [x] Every new text has its Russian entry; `pnpm typecheck` passes; the drag rule has a unit test.
- [x] `tools/divide-handles/find-it.mjs` passes at 360 and 390 px from the bare app.
