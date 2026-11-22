# ADR-284: Size tags on the drawing open the matching size field

- Status: Implemented
- Date: 2026-11-22
- Implemented: 2026-11-22
- Depends on: ADR-283
- Design: https://claude.ai/artifact/HbCBLzkvgFuxRxmUKNzqF3 (design spec, slice 2: size tags and the mm bar)
- Backlog: N367
- Acceptance: browser

## Context

Slice 2 of the canvas-native phone editor (ADR-283, G-577). The user asked on 2026-11-22 to "proceed slices" after
ADR-283. In the design, sizes are changed on the drawing: a size shown on the piece is a tag; tapping it lets you type
the number, with nudges, while the drawing stays in sight above the keyboard.

Today the front drawing shows the overall width and height and the selected space's width as plain labels
(`src/ui/Elevation.tsx`, `Dim`, `DimV`); the fields that change them live in the editor (whole-piece Width, Height,
Depth; a split's part sizes in Division).

## Decision

While the canvas editor is on (ADR-283, phone, device flag):

1. **Tags.** The overall width and height labels on the front drawing, a depth tag beside them, and the selected
   part's size along its split (width for side by side, height for stacked) are buttons with a 44 px hit area, named
   "Width 800 mm" and so on. Off, they stay plain labels.
2. **One field, not a copy.** A tap selects the level that owns the size (the whole piece, or the split around the
   part), opens the lens card on the block that holds its field, and focuses that field. Typing, the field's own
   −/+ steps, its range message, formulas (ADR-166) and size locks (ADR-122) work as they do today.
3. **Above the keyboard.** While the on-screen keyboard is up (the visual viewport is shorter than the window), the
   card sits on top of it and the drawing re-frames into what is left.
4. Sizes come from the model (ADR-004); the tags add no geometry.

## Alternatives considered

- **A separate mm bar with its own validation** — a second path for the same number; risks drift from the field rules.
- **Drag on the tag to scrub** — needs a single-pointer alternative anyway (WCAG 2.5.7); the field is that alternative.
  Left for a later slice if wanted.

## Scope

- In scope: the tags, opening and focusing the field, docking the card above the keyboard.
- Out of scope: split bars and + divide handles (next slice, G-577), drag to scrub, depth on the drawing itself.

## Consequences

- Positive: a size is one tap from where it is drawn; no new editing rules.
- Negative / risks: on iOS Safari the keyboard docking depends on `visualViewport` (G-579 covers device checks).

## Done when

- [x] Canvas editor on at 390 px: the whole piece shows buttons "Width … mm", "Height … mm" and "Depth … mm" on the
      drawing, each at least 44 px.
- [x] Tapping the width tag opens the card with the Width field focused; typing 900 and Enter makes the tag read 900.
- [x] A part of a side-by-side split shows its width tag; a tap opens Division with that part's size field focused.
- [x] A part of a stacked split shows its height tag; a tap does the same.
- [x] With the keyboard up, the card's bottom is the keyboard's top (unit test of the docking rule).
- [x] Canvas editor off: the labels are not buttons.
- [x] Every new text has its Russian entry; `pnpm typecheck` passes.
- [x] `tools/size-tags/find-it.mjs` passes at 360 and 390 px from the bare app.
