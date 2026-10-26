# ADR-099: Align centres and distribute pieces evenly

- Status: Pending
- Date: 2026-10-26
- Depends on: ADR-070, ADR-097
- Design: docs/ui-design.md (Plan view)
- Backlog: N97
- Agreed: 2026-10-26 "New adr 7"; answer "Along the wall only"

## Context

The user, 2026-10-26: "New adr 7". Item 7 of the fit review: _Edge/face/centre alignment and equal distribution_
(rank 17, value 4.4, P0, In Progress, missing "centre alignment and equal distribution"; merged into it: _Inference
points_). Snapping ([ADR-070](../adr-done/ADR-070-snap-a-dragged-piece-to-neighbours-and-walls-with-a-preview.md)) already aligns faces to neighbours and walls. Several pieces can be selected
once [ADR-097](ADR-097-select-several-pieces-and-keep-them-as-groups.md) ships.

## Decision

- **Centre snapping:** dragging a piece also snaps its centre line to a neighbour's centre line (left–right), within
  the same 60 mm range and ranking as ADR-070, labelled "centre". Typical use: a wall unit centred over a base unit.
- **Align** (two or more selected pieces): **Left**, **Centre**, **Right** (along the wall) and **Back**, **Front**
  (depth), to the first selected piece. Whole mm.
- **Distribute evenly** (three or more selected pieces, along the wall): the leftmost and rightmost stay; the others
  move so the gaps between neighbours are equal. Integer splits as ADR-003: leftover millimetres go one each to the
  leftmost gaps.
- Placement rules apply; locked pieces ([ADR-095](ADR-095-lock-a-piece-so-automatic-moves-and-repairs-leave-it-alone.md)) do not move and the action says so. Each action is one undo
  step. Pure functions `alignItems` and `distributeItems` in `src/core`.

## Alternatives considered

- **Align to the selection's bounding box** — less predictable than "to the first selected piece".
- **Distribute by equal centres** — unequal gaps between pieces of different widths; the research names equal spacing.

## Scope

- In scope: centre snapping, align (5 ways), distribute along the wall.
- Out of scope: aligning heights (top/bottom of wall units) (G-089).

## Consequences

- Positive: tidy runs in one tap.
- Negative / risks: depends on multi-select (ADR-097); centre snapping adds candidates, so a drag may grab a centre
  when a face was meant — the label says which.

## Done when

- [ ] Align and distribute give exact whole-mm positions, leftover mm to the leftmost gaps (unit tests)
- [ ] Centre snapping ranks with ADR-070 deterministically (unit test)
- [ ] Find-it at 1440 and 390 px: select three pieces → **Distribute evenly** → equal gaps shown; drag a wall unit
      over a base unit → "centre" label; no page errors

## Answers (2026-10-26)

1. Distribute works along the wall only (user, 2026-10-26). The question is closed (G-090).
