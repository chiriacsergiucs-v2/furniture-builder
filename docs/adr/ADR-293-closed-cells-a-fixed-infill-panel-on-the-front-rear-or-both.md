# ADR-293: Closed cells: a fixed infill panel on the front, rear or both faces

- Status: Pending
- Date: 2026-11-24
- Depends on: ADR-011, ADR-282, ADR-292
- Design: n/a
- Backlog: N381
- Acceptance: full

## Context

The reference divider has one closed block per tier ("partial walls"). Today a cell can only be empty, hold shelves,
a rail or drawers, or carry an opening front (`src/core/types.ts:335-362,379-453`). Nothing puts a fixed panel in a
cell, so a closed block is impossible. On a two-faced piece (ADR-292) the block can face either side.

## Decision

- `EmptySpace.infill?: 'front' | 'rear' | 'both'` (schemaVersion 11, the same bump as ADR-292). `'rear'` and
  `'both'` are allowed only when the piece has `back: 'none'`.
- `buildModel()` adds one panel per face, new role `infill`. It sits between the surrounding panels, flush with the
  front edge (`front`) or the rear edge (`rear`) (user, 2026-11-24: flush, no shadow line), the size of the cell's opening, in the carcass board. Its exposed
  edges are not banded, because it sits between the cell's own panels.
- Fixing: one hardware item "Infill fixing — choose" per panel (ADR-010: the user picks dowels, screws or glue).
  It stays a "to choose" item in the shopping list (`src/core/shopping.ts:55`).
- A cell with an infill cannot also take a front or an appliance niche: that is the error `infill-front`, and
  export is blocked (ADR-008).
- Staggered rows (ADR-282): a span keeps its `infill` when the rule rewrites a row and the span keeps its id.
- UI: Space › Contents › Empty gains **Closed panel**: Front / Rear / Both (Rear and Both only on open pieces).
  Both 2D and 3D draw the panel (ADR-004).

## Alternatives considered

- **A door with no hinges** — misuses the front model; the hinge, handle and clearance checks would fire.
- **A separate small cabinet placed inside** — two carcasses, a double wall and a cut list that does not match
  the photo.
- **An infill on any space kind** — a closed cell with shelves inside is rare. Kept to Empty for a small first slice.

## Scope

- In scope: the field, the role, the panel, the fixing item, the error, the editor, the stagger carry-over.
- Out of scope: an infill on shelves, drawers or hanging spaces (G-593); grooves for an infill (G-594).

## Consequences

- Positive: closed blocks, one-sided or two-sided, on any cabinet, corner or desk unit cell.
- Negative / risks: a new panel role touches the cut list, the assembly order and the parts names (Romanian and
  Russian entries).
- Harder to change later: the saved `infill` shape.

## Done when

- [ ] `front`, `rear` and `both` give 1, 1 and 2 `infill` panels of the opening size (`tests/infill.test.ts`)
- [ ] `rear` or `both` on a piece with a back is refused; an infill with a front is the error `infill-front` (same)
- [ ] Each infill schedules one "Infill fixing — choose" item (same)
- [ ] After Randomize, a span that keeps its id keeps its infill (same)
- [ ] The cut list and the printed parts list show each infill with its size (same)
- [ ] Find-it at 390 and 1280 px: Bookcase › tap a space › Contents › Closed panel › Both
      (`tests/find-it/infill.test.tsx`)
- [ ] Every new text has its Russian entry, and parts names their Romanian entry (`pnpm typecheck`)
