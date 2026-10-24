# ADR-047: Two touching cabinets in a project merge into one cabinet; any other difference refuses the merge

- Status: Implemented
- Date: 2026-10-24
- Implemented: 2026-10-24
- Decided by: user: "merging 2 items into 1", items = pieces in a project
- Depends on: none
- Design: n/a
- Related: ADR-004, ADR-008, ADR-022, ADR-031, ADR-036
- Backlog: N42

## Context

On 2026-10-24 the user asked for "merging 2 items into 1". Asked what an item is, they chose **two pieces in a
project**. The two pieces each have their own carcass. Merging them has to produce one piece that `buildModel()` can
build, with no guessed geometry (ADR-004, ADR-010).

## Decision

- **Only two cabinets** (`product.kind === 'cabinet'`) merge. Corners, desks, frames, front-only panels and panel
  sets are refused with a reason.
- The two must **touch side by side** (gap 0 along the piece's width) and stand in the same run.
- **Everything except the width and the interior must already be the same.** That covers every other cabinet
  setting, the quarter turn, the number of copies, the placement, the bottom and back lines, and any board that has
  the same id in both pieces. A difference is listed in words and the merge button stays disabled. Nothing is
  averaged or picked silently (ADR-008).
- **What the merged piece is:**
  - One cabinet whose width is the sum of the two widths, so the footprint is unchanged.
  - Its interior is a left→right split of the two original interiors. Each interior keeps its own fronts and
    handles.
  - The two sides that met become one divider centred on the old joint. The left part is
    `width₁ − t − ⌊t/2⌋`; the right part takes the rest.
  - The other settings and boards are the left piece's. Boards found only in the right piece are added.
  - The name is "left + right". Catalog metadata, the library link and the wizard answers are dropped, because the
    merged piece is a new piece.
- **Other pieces:** any piece on or above either cabinet (ADR-031) is moved onto the merged one at the same place
  in the room. Run parts (ADR-036) are kept as they are.
- **Undo:** merging asks for confirmation; Undo in the project view brings the two pieces back
  (ADR-051).

## Consequences

- The cut list loses two sides and one back and gains one divider. Hinges and runners stay the same.
- Pieces that differ in height, depth, plinth and so on must be made the same in the editor first.

## Answers (2026-10-24, from the user)

1. Pieces with different heights or depths: **refuse, as today** — the merge button stays disabled and lists the
   difference.
2. Non-cabinet pieces: **no, cabinets only**.
3. Project-level undo: **yes** — built as ADR-051.

## Done when

- [x] Two touching base cabinets merge into one cabinet with the same footprint and both interiors (`tests/merge.test.ts`)
- [x] Works from either piece and with every quarter turn
- [x] Any other difference, or a piece that is not a cabinet, disables the merge and lists the reason
- [x] Pieces on or above either cabinet move onto the merged one
- [x] Find-it test passes from the bare app at phone and desktop widths (`tools/merge/find-it.mjs`)
- [x] Undo brings the two pieces back (ADR-051)
