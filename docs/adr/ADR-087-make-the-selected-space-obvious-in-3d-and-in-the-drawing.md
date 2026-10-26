# ADR-087: Make the selected space obvious in 3D and in the drawing

- Status: Pending
- Date: 2026-10-26
- Depends on: ADR-083, ADR-085
- Design: docs/ui-design.md (§3 Components and states)
- Backlog: N82

## Context

User, 2026-10-26, in their words:

> The highlight of the selected item need to be more obvious, suggest 5 designs that can be applied so it is clearer
> which part of the piece is selected, or if it is entirely selected, here is the example:
>
> 1. Click on piece
> 2. Click again on middle part of piece
> 3. Click again (now since this was last sub-item, the entire piece is selected again)
> 4. BUG - highlight remains on the smaller piece while actions of increase/decrease dividers of similar are applied
>    to the parent.

Today (`src/viewer/Viewer3D.tsx`) 3D tints only the panels whose `nodeId` equals the selected id: a leaf shows just
its shelves, a divided space just its dividers, and the whole piece (ADR-083 `null`) tints every panel 45 % green.
The space's own box is never drawn in 3D, so a bay with no shelves shows nothing. The front drawing
(`src/ui/Elevation.tsx`) outlines the selected space's box. The quick-count card (ADR-085) acts on `countSubject`,
which for the whole piece is the interior — so the card and the highlight can disagree.

## Decision

1. **Bug first.** Reproduce the user's 4 steps (3D and drawing) in a test; make the highlight come from the same
   `selectedId` the card acts on. One pure helper in `src/core/selectPath.ts`, `selectionBox(model, sel)`, returns
   the box to highlight (the piece bounds for `null`); 3D, the drawing and the card all use it. `inSelection(box,
panel)` says whether a panel belongs to it (its front-view centre is inside).
2. **One clear look** for the selected space, from these five; the user picked **A** (G-058):
   - **A — Outline and fade the rest.** A thick green box outline round the selected space; every panel outside it
     drawn at ~30 % opacity. Whole piece: outline round the piece, nothing faded.
   - **B — Tint everything inside.** Every panel inside the selected space tinted strong green; the rest untouched.
   - **C — Glass volume.** A translucent green box filling the selected space's inside, with a solid edge.
   - **D — Corner brackets and a label.** L-brackets at the box's front corners and a chip "Middle bay · 427 × 864".
   - **E — Nested level outlines.** Ancestors thin and dashed, the selected level thick, its children thin.
3. A in 3D (Simple look of a single piece): a 3.5 px green outline 3 mm outside the box, drawn over everything
   (also through doors); panels outside faded to 28 %; the selected space's own panels keep green edges; the old
   45 % tint is gone there. Not drawn in the exploded view (panels are away from their place). In the drawing
   (G-059): the outline is thicker and everything outside it is faded to 30 %.
4. Reproduction (2026-10-26, production build, 1280, 923 and 390 px, single piece and a piece opened from a
   project): the 3rd tap always selected the whole piece, and the card acted on it. The confusing part was the look:
   the whole piece tinted every panel lightly, so the small part's panels still looked highlighted. A fixes that.

## Alternatives considered

- **Stronger tint of today's panels only** — a bay with no panels of its own still shows nothing.
- **Pulse/animate the selection** — distracting on a phone, no gain over a static outline.

## Scope

- In scope: the regression test, design A in Simple 3D and in the drawing, find-it checks.
- Out of scope: the design in Realistic mode beyond today's tint (G-060); a heading on the card naming the
  selection, cut because it made the card cover the tap point on phones (G-065); the card covering much of the phone
  3D view, from ADR-085 (G-066). Pictures (ADR-068) stay without selection.

## Consequences

- Positive: one source for "what is selected" across 3D, drawing and card; the whole piece looks different from a
  part of it.
- Negative / risks: faded panels are transparent, so the outline is drawn last in the transparent pass (else the
  faded panels covered it), and a faded material is remounted (`transparent` does not switch on a live material).
- Harder to change later: nothing structural; the look lives in `Viewer3D.tsx` and `Elevation.tsx`.

## Done when

- [x] Store test of the user's steps: tap piece, tap a bay, tap again → `selectedId` is `null`, `selectionBox` is the
      piece bounds, the card's subject is the interior and no panel is outside the outline
      (`tests/select-path.test.ts`).
- [x] A bay keeps its own panels and the rest falls outside; a divided space keeps its divider and children (same
      file).
- [x] `tools/selection-look/find-it.mjs` at 1280 and 390 px: the user's steps in the drawing ("Whole cabinet",
      outline round the piece, nothing faded → "Shelves", bay outlined, rest faded → "Whole cabinet" again, and
      "More vertical dividers" then acts on the cabinet) and in 3D.
- [x] lint, format:check, typecheck, test, build, docs:check pass.

## Answered questions

- Design: user 2026-10-26 "A" — outline round the selected space, the rest faded (G-058).
- Front drawing too: user 2026-10-26 "Yes" (G-059).
