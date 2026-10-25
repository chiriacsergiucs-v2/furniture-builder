# ADR-069: Duplicate, mirror and turn a piece about its centre in a project

- Status: Pending
- Date: 2026-10-24
- Depends on: ADR-031, ADR-051, ADR-065
- Design: docs/ui-design.md (project panel, Plan view)
- Backlog: N64

## Context

The user, 2026-10-24, on the Feature Research & Catalog selection: "Identify the features and subfeatures
necessary for the following items from research. Import 3D models and model libraries · Duplicate, mirror and
predictable rotate operations · Also for these: [14 features marked Interested]", then "Draft adrs for each".

Research row: _Duplicate, mirror and predictable rotate operations_ (rank 19, P0). Today a project item has a
quantity, a quarter-turn **Turn** (`rotationY`) and can be dragged ([ADR-065](../adr-done/ADR-065-drag-a-piece-on-the-plan-to-move-it.md)); a design can be duplicated in the
library (F14). Turning keeps the piece's lowest corner (`position` is the rotated piece's min corner,
[ADR-031](../adr-done/ADR-031-pieces-in-a-project-are-placed-on-the-floor-on-the-wall-or-o.md)), so a turned piece jumps on the plan. There is no duplicate in place and no mirror.

## Decision

- **Duplicate** (button in the selected-piece card, Ctrl/Cmd+D): a copy of the item, new ids (ADR-011), placed
  touching the original on its right in the room's x (or on its left if the right is taken), same placement and
  turn. One undo step ([ADR-051](../adr-done/ADR-051-add-undo-and-redo-for-project-changes.md)). Overlaps that result are the usual diagnostics, never prevented.
- **Turn about the centre:** _Turn 90°_ buttons (and **R** / Shift+R with the piece focused on the plan) turn
  the piece about the centre of its footprint; the new `position` is rounded to whole mm (half-mm centres round
  down). The numeric Turn field keeps its current meaning for typed values.
- **Mirror (handing):** _Mirror_ swaps left and right inside one piece: door `hinge`, `pedestal-left` ↔
  `pedestal-right`, corner units' side, handle positions, and the order of side-by-side spaces. The parts keep
  their sizes, so the cut list keeps the same rows; drilling notes follow the mirrored parts. A piece with nothing to mirror
  says "Nothing to mirror in this piece".
- **Mirror a run** (several pieces touching along x): positions reflect about the run's centre and each piece is
  mirrored, as one undo step.
- Free angles stay out: every part is an axis-aligned box ([ADR-004](../adr-done/ADR-004-every-part-is-an-axis-aligned-box-one-furnituremodel-feeds-e.md), ADR-003).

## Alternatives considered

- **Keep the corner-anchored turn** — it is why rotating feels unpredictable.
- **Mirror by negative scale in 3D** — would mirror geometry but not hinges or the cut list; the model must stay
  the source (ADR-004).

## Scope

- In scope: duplicate in place, turn about the centre, mirror a piece, mirror a run, keyboard shortcuts.
- Out of scope: multi-select and groups, free angles, copy/paste between projects.

## Consequences

- Positive: laying out repeated and handed units takes one tap each.
- Negative / risks: mirroring must know every handed parameter; a missed one leaves a piece half-mirrored, so
  each product root lists its handed fields in one place with a test.
- Harder to change later: nothing stored changes shape.

## Done when

- [ ] Duplicate gives a touching copy with new ids, one undo step (unit test)
- [ ] Turn 90° four times returns the piece to the same position; the footprint centre stays within 1 mm
      (unit test, fuzz over sizes)
- [ ] Mirror twice returns the same design; mirror keeps the cut-list sizes and swaps hinge and pedestal sides
      (unit test per product root)
- [ ] Mirror a run reflects positions about the run centre, one undo step (unit test)
- [ ] _Duplicate_, _Turn 90°_ and _Mirror_ are found by text at 390 px and 1280 px (find-it)
- [ ] All CI checks pass

## Open questions

- Where the copy goes when both sides are taken — default: on the right anyway, with the overlap diagnostic.
- Mirror a run also mirrors run parts (fillers, covers) — default: they refresh by themselves (ADR-061).
- Half-mm rounding when turning: rounding down every time drifts the piece 2 mm in x and z per four turns, which
  breaks "Turn 90° four times returns the piece to the same position" — default built: round down when the piece
  ends at 90° or 270° and up when it ends at 0° or 180°, so two turns cover the same floor, four return exactly and
  the centre moves at most ½ mm.
- Mirror and the generator's integer split: a split's rounding remainder goes to its last share part, so a mirrored
  piece whose side-by-side spaces differ can have parts 1 mm wider or narrower than before (2 catalog pieces:
  wardrobe 3, credenza file) — default built: keep the generator, accept ±1 mm; the alternative is a symmetric
  split rounding, which changes existing cut lists.
- Pieces with a fixed hand (lounger backrest, daybed side panel, both built at the left end): mirroring them needs a
  stored side — default built: Mirror says it cannot mirror them yet; Mirror a run still moves them.
- A run for Mirror a run — default built: pieces at the same height and depth side by side with gaps up to 150 mm,
  as for run parts (ADR-036); pieces resting on run pieces are mirrored with it.
- A piece placed on another piece keeps its back aligned with its base (ADR-031) — default built: Turn keeps its
  centre along x only.
