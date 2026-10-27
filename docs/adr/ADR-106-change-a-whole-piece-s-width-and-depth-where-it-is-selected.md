# ADR-106: Change a whole piece's width and depth where it is selected

- Status: Pending
- Date: 2026-10-27
- Depends on: ADR-083, ADR-085, ADR-088
- Design: docs/ui-design.md (section 3, components: `MmField`; section 4, editor screen)
- Backlog: N104
- Agreed: 2026-10-27 "Card + side panel (Recommended)", "I am talking about a piece from catalog, no size change is available . No inside this pieceethis", "New ADR, full find-it (Recommended)"

## Context

The user, 2026-10-27: "Add the posibility to change width/depth when whole cabinet or whole piece is selected".
Today the size is only under Settings (ADR-080) or, for a project piece, in "Size, boards and construction" after
opening **Inside this piece** (ADR-088). A catalog piece added to a project shows no size at all when tapped.
Asked where, the user chose the side panel and the quick-count card; asked about projects, they said the piece
from the catalog, selected, without opening Inside this piece.

This widens [ADR-085](../adr-done/ADR-085-show-the-count-stepper-over-the-3d-view-too.md)'s exception to ADR-014 (the quick-count card over the 3D view changes the
design through the store): while the whole piece is selected the card also holds Width and Depth.

## Decision

- **Core** `src/core/pieceSize.ts`: `sizeFields(product)` lists Width and Depth with the same labels and limits as
  the piece's Settings editor (cabinet, desk, corner, table/bench/stool/chair); a filler/cover panel has Width only;
  a bed (size from the mattress) and a set of loose panels have none. `resizeProduct` changes one of them.
- **Store:** `resizePiece(key, mm)` for the open piece (one undo step, `commit`); `resizeItem(id, key, mm)` for a
  project piece (one project undo step); as any edit, a brand's product loses its brand, its origin stays (ADR-028).
- **UI** `src/ui/PieceSize.tsx` (two `MmField`s, group "Size of the whole piece"), shown:
  - in Compose when the whole piece is selected (single piece);
  - in the quick-count card over the drawing and the 3D view when the whole piece is selected (also an opened
    project piece); folded with the card on a phone;
  - in the project's **Selected piece** card for the tapped piece, without opening Inside this piece.
- Out-of-range input shows the field's existing error; nothing is clamped silently (ADR-008).
- No schema change: the fields already exist in the design document.

## Alternatives considered

- **Side panel only** — the user chose the card too.
- **Only after opening Inside this piece** — the user said a catalog piece must be resizable when just selected.
- **Height too** — not asked; Height stays under Settings.

## Scope

- In scope: core helper, two store actions, the fields in Compose, the quick-count card and the project card,
  tests, find-it.
- Out of scope: a floating card over the project views for a piece not opened (G-123); bed and loose panels (G-124).

## Consequences

- Positive: a catalog piece in a project is resized in one tap, without opening its editor.
- Negative / risks: the quick-count card is taller while the whole piece is selected.
- Harder to change later: nothing; no stored shape changes.

## Done when

- [x] Core: cabinet, desk, corner and frame (not bed) give Width and Depth with their Settings limits; bed and loose
      panels give none; resizing changes only that size (covered by tests).
- [x] The open piece and a project piece are each resized in one undo step; the saved piece is untouched (tests).
- [x] Compose with the whole piece selected shows Width and Depth; the drawing follows a typed width.
- [x] The quick-count card over the drawing and the 3D view shows Width and Depth for the whole piece.
- [x] A catalog piece added to a project shows Width and Depth in its Selected piece card; typing a depth changes
      its floor size.
- [x] Find-it test passes from the bare app at phone and desktop widths (`tools/piece-size/find-it.mjs`,
      production build).

## Open questions

- A floating Width/Depth card over the project views for a selected piece not opened? Default: no (G-123).
- Bed and loose panels: show the mattress size, or nothing? Default: nothing (G-124).
