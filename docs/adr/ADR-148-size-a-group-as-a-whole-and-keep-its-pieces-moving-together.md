# ADR-148: Size a group as a whole and keep its pieces moving together

- Status: Pending
- Date: 2026-10-29
- Depends on: ADR-097, ADR-106, ADR-122
- Design: docs/ui-design.md (Plan view, selection card)
- Backlog: N149
- Agreed: 2026-10-29 answers "Overall group size", "Add both proportionally and equally options", "Set on every
  piece", "Others absorb it", "Always together", "Yes, edit only", "Groups and single pieces", "New ADR + build"; approved
  2026-10-29 "Approve, build it", G-290 "Refuse (as in ADR)", G-291 "Yes, move group", G-292 "Mirror the group"

## Context

The user, 2026-10-29: "add the possibility to set the width, height and depth of grouped items, add the possibility
to block group items from being moved separately." Groups ([ADR-097](../adr-done/ADR-097-select-several-pieces-and-keep-them-as-groups.md)) are
selected together, but a second tap selects one piece and that piece then moves alone. A whole piece shows only
Width and Depth ([ADR-106](../adr-done/ADR-106-change-a-whole-piece-s-width-and-depth-where-it-is-selected.md)). ADR-097 says
"A first tap on a grouped piece selects the whole group, the next tap that piece"; this ADR keeps that tap but the
piece no longer moves on its own. No document change: groups and sizes are already saved.

## Decision

1. **Group size.** With a whole group selected, the selection card shows **Width**, **Height** and **Depth** (group
   "Size of the group") and a **Split width** switch, **Proportionally** · **Equally**. One undo step each. Pure
   `resizeGroup` in `src/core/groupSize.ts`; refusals are messages, never clamps (ADR-008).
   - **Width** is the group's room-x extent. The pieces must stand in columns: two pieces either cover the same x
     span or none of it (a wall unit over its base unit is one column). Otherwise the width is refused: "Width needs
     the pieces side by side in columns." The change is shared by the columns that can change: Proportionally by
     each column's width, Equally the same for each; leftover whole mm one each to the leftmost columns. Each piece
     in a column takes the column's new width; columns to the right shift by the growth on their left; gaps stay.
   - **Height** and **Depth** are set on every piece. Placement stays (floor, wall underside, on another piece);
     position (back, left) stays. The field shows the tallest / deepest piece; "Pieces differ" when they do.
   - **Fixed pieces** keep their size and the others take the change: a size-locked piece
     ([ADR-122](../adr-done/ADR-122-research-batch-2-align-heights-lock-sizes-height-drag-in-3d.md)), a piece without that
     size (bed: all three; loose panels: all three; panel: depth), and for Width a piece turned by 90°/270° or by an
     extra angle. A column holding a fixed piece is fixed. Fixed pieces are named in the result: "Kept: …".
   - Refused when no piece can change, when a piece would leave its Settings limits (named, with the limit), or when a
     placement-locked piece ([ADR-095](../adr-done/ADR-095-lock-a-piece-so-automatic-moves-and-repairs-leave-it-alone.md)) would have to shift.
2. **Height of one whole piece.** `sizeFields` gains **Height** with the Settings limits (cabinet 100–3000, desk
   400–1200, corner 300–2500, frame 200–1500, panel 50–3000; none for a bed or loose panels), so the ADR-106 card
   shows Width · Height · Depth.
3. **Always together.** A piece in a group never moves on its own: dragging it (plan and 3D Move mode), arrow keys,
   the position fields, the gap tool, the 3D wall-height drag (G-291), turning, mirroring (G-292), align and
   distribute move the whole group by the same whole-mm offset (`carryGroups`, `src/core/groupMove.ts`), or turn or
   mirror it about the group's centre. Up or down, wall units and free pieces follow; a member standing on the floor
   refuses the move ("… stands on the floor; the pieces of its group move up and down together."). A placement-locked
   member stops the whole move with its reason. A second tap still selects
   the single piece for editing only (its boards, inside, size).

## Alternatives considered

- **Same size on every piece** — not what the user picked ("Overall group size").
- **A per-group lock switch** — the user picked "Always together": no switch and no schema change.
- **Scale positions for non-column groups** — breaks touching pieces with rounding; refused instead (G-290).

## Scope

- In scope: group Width / Height / Depth with the split switch, single-piece Height, groups moving as one, also up
  and down and when mirrored (G-291, G-292).
- Out of scope: Width for groups not in columns, refused (G-290, user answer); repairs and Mirror the run moving a
  grouped piece alone (G-293).

## Consequences

- Positive: a kitchen run is sized in one step and cannot be pulled apart by accident.
- Negative / risks: the only way to move one grouped piece is Ungroup; every move path must ask for the group.
- Harder to change later: nothing saved changes.

## Done when

- [ ] `resizeGroup` width, both splits: shares, leftover mm, shifted columns, kept gaps (unit tests)
- [ ] Fixed pieces kept and named; limits, no-change and locked-shift refusals (unit tests)
- [ ] Height and depth set on every piece with placement kept; one undo step (unit tests)
- [ ] `sizeFields` returns Height with the Settings limits; bed and loose panels none (unit test)
- [ ] Dragging, arrow keys, X field, turn, align and distribute of one grouped piece move the whole group (unit tests)
- [ ] Find-it (jsdom, 390 and 1280 px): select a group, find "Size of the group", "Split width", change Width; a
      single piece shows "Height"
