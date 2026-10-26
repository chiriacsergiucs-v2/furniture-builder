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

1. **Bug first.** Reproduce the user's 4 steps (3D and drawing) in a failing test; fix so the highlight is always
   derived from the same `selectedId` the card acts on. One pure helper in `src/core/selectPath.ts`,
   `selectionBox(model, sel)`, returns the box to highlight (the piece bounds for `null`); 3D, the drawing and the
   card all use it.
2. **One clear look** for the selected space, from these five; the user picked **A** (G-058):
   - **A — Outline and fade the rest.** A thick green box outline round the selected space; every panel outside it
     drawn at ~35 % opacity. Whole piece: outline round the piece, nothing faded.
   - **B — Tint everything inside.** Every panel inside the selected space (its dividers, shelves, drawers, children)
     tinted strong green; the rest untouched. Whole piece: all panels tinted plus the outline.
   - **C — Glass volume.** A translucent green box (≈20 % opacity) filling the selected space's inside, with a
     solid edge. Whole piece: the volume round the whole piece.
   - **D — Corner brackets and a label.** Four L-brackets at the selected box's front corners and a chip
     "Middle bay · 427 × 864" pinned to it. Whole piece: brackets on the piece, chip "Whole cabinet".
   - **E — Nested level outlines.** Each level of the path is outlined: ancestors thin and dashed, the selected
     level thick and solid, its children thin. Shows depth as well as the selection.
3. The quick-count card's heading names what it acts on ("Whole cabinet", "Divided space", "Shelves"), so the card
   and the highlight say the same thing.

## Alternatives considered

- **Stronger tint of today's panels only** — a bay with no panels of its own still shows nothing.
- **Pulse/animate the selection** — distracting on a phone, no gain over a static outline.

## Scope

- In scope: the bug fix with a regression test, the chosen design in Simple 3D, the card heading, find-it checks.
- Out of scope: the design in Realistic mode beyond today's tint (G-060). Pictures (ADR-068) stay without selection.

## Consequences

- Positive: one source for "what is selected" across 3D, drawing and card; the whole piece looks different from a
  part of it.
- Negative / risks: A and C need transparency, which can sort badly in three.js; E is the busiest on a phone.
- Harder to change later: nothing structural; the look lives in `Viewer3D.tsx` and `Elevation.tsx`.

## Done when

- [ ] Store test of the user's steps: tap piece, tap middle, tap again → `selectedId` is `null`, `selectionBox` is
      the piece bounds and the card's subject is the whole piece; fails on today's code if the bug is in the model.
- [ ] 3D draws the chosen design for a leaf, a divided space and the whole piece (unit test on the box/panel set it
      uses).
- [ ] The card heading names the selection ("Whole cabinet" after the third tap).
- [ ] `tools/drill-select/find-it.mjs` at 390 and 1280 px: the user's 4 steps in 3D; after step 3 the card says
      "Whole cabinet" and its dividers `+` adds a bay to the cabinet.
- [ ] lint, format:check, typecheck, test, build, docs:check pass.

## Answered questions

- Design: user 2026-10-26 "A" — outline round the selected space, the rest faded (G-058).
- Front drawing too: user 2026-10-26 "Yes" (G-059).
