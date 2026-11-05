# ADR-182: Move to moves a multi-selection as one block

- Status: Implemented
- Date: 2026-11-05
- Implemented: 2026-11-05
- Depends on: ADR-147
- Design: docs/ui-design.md (section 4, project side panel)
- Backlog: N185
- Agreed: 2026-11-05 "Proceed similarly with next 5 adrs"; answer "As one block"

## Context

Gap G-294 (ADR-147): the one-tap Move to buttons (walls, ceiling, floor, neighbours; `src/core/moveTo.ts`,
`src/ui/MoveTo.tsx`) move only the selected piece, never a multi-selection.

User, 2026-11-05: **"As one block"** — the selection moves together, keeping its layout, until the block meets the
wall or neighbour; the same as dragging a selection.

## Decision

1. `moveToOptions` and `moveTo` accept several ids. The block is the selection's combined footprint (and height for
   ceiling and floor); each action moves the block by one offset so its leading edge meets the target, as for one
   piece. Neighbours are pieces outside the selection.
2. The block carries groups and connected pieces (`carryUnits`, ADR-148, ADR-168); a locked piece refuses the action
   with its reason, as today.
3. The Selected pieces card shows the Move to buttons when two or more pieces are selected; each tap is one undo step.

## Alternatives considered

- **Each piece on its own** — can scatter or stack the selection. Not chosen.

## Scope

- In scope: Move to for a selection in the side panel; 3D Move mode uses the same buttons.

## Consequences

- Positive: a row of pieces goes to a wall in one tap.
- Negative / risks: an action off for one member is off for the block, with the reason.

## Done when

- [x] Three selected pieces, Move to the back wall: all move by the same dz, the block's back meets the wall (tests)
- [x] Move to a neighbour stops at the first piece outside the selection; a locked member refuses with its reason
      (tests)
- [x] Select 2 pieces → Selected pieces → Move to → the back wall at 390 and 1280 px (jsdom find-it)
- [x] Russian entries for every new text
