# ADR-169: A common top or bottom across a gap, over corner units and desks

- Status: Pending
- Date: 2026-10-31
- Depends on: ADR-040, ADR-165
- Design: docs/ui-design.md (§4 Screens: project selected-items card)
- Backlog: N171
- Agreed: 2026-10-31, every question answered by the user (see Context)

## Context

User 2026-10-31: "ADR for G-317, G-318, G-320, G-321, G-322, same pr". G-320 (from ADR-165): a common panel needs
touching items; G-322: corner units and desks are refused. The request behind them: "Add the possibility to have a
common bottom or top between multiple items."

Answers (2026-10-31): **any gap**, with a guidance warning naming its width (no load or sag claim, ADR-010); **nothing
under the gap**; the row keeps ADR-165's rules (same height, depth, plinth, back); **all corner units** join, an L or
diagonal unit making the common panel **one shaped part** (cut to template, ADR-040); a **desk's worktop** joins as
the common top; a common **bottom** on a desk or frame is **refused with the reason**.

Change control: no new field: `Project.common` (ADR-165, project schemaVersion 17) keeps its shape; what it may
hold widens. ADR-165's "touching" rule is replaced by this ADR.

## Decision

- **Row.** Members form a chain: each next member stands along the previous one's wing, turned the same way, back
  edges in line, either touching or with a gap; or meets a corner unit at one of its two wing ends, turned like that
  wing. Same height (to the top of the top), plinth and back for all; depth equal per straight run (a corner wing
  counts as that run's depth; a desk compares its carcass depth, its front overhang stays its own).
- **Gap.** A gap along a straight run is bridged by the panel; nothing is added under it. Warning `common-gap`:
  "The common top spans a {n} mm gap with nothing under it." (guidance, never an error).
- **Corners.** Blind corners build like cabinets. L and diagonal units are built with their top over (bottom under)
  their sides while linked; the diagonal generator gains top over its returns for this. The common panel is the
  plan outline of all member tops (and gaps) as one profile part: the blank is its enclosing box, the outline its
  `profile` points (ADR-040 "cut to template"); a straight row stays a plain box.
- **Desks.** A desk's `worktop` is its top; it is left out while linked. All member tops must have the same board
  thickness, else refused with the reason. A desk refuses Common bottom: "{name} has no bottom."
- Frames and panel sets stay refused ("{name} is not a cabinet, corner unit or desk.").
- The outline is computed from the members' own tops (and the gap rectangles) by removing shared edges; integer mm
  throughout (ADR-003).

## Alternatives considered

- **Up to a width the user sets** — the user chose any gap with a warning.
- **A filler under the gap** — the user chose nothing under it.
- **Blind corners only** — the user chose all three.

## Scope

- In scope: the check, the shaped panel, diagonal top over, desk worktop, warnings, tests, find-it.
- Takes over G-320 and G-322.

## Consequences

- Positive: one top along a kitchen run through its corner and over a desk or a dishwasher gap.
- Negative / risks: a shaped top is cut to a template; its blank wastes the corner of the sheet.
- Harder to change later: the chain rule users learn.

## Done when

- [ ] Two cabinets 600 mm apart get one top 600 + 600 + gap wide and the `common-gap` warning (`tests/common-shapes.test.ts`).
- [ ] A blind corner with a cabinet on its wing: one plain top; an L corner with a cabinet on each wing: one profile
      top whose outline covers both wings, no overlaps (`tests/common-shapes.test.ts`).
- [ ] A diagonal corner with a cabinet: the corner's returns end under the common top; one profile part
      (`tests/common-shapes.test.ts`).
- [ ] A desk beside a cabinet of the same height: the desk's worktop is left out and one top covers both; Common bottom
      on the desk is refused with "has no bottom" (`tests/common-shapes.test.ts`).
- [ ] Find-it `tests/find-it/common-shapes.test.tsx` at 390 and 1280 px: an L corner and two cabinets selected → Common
      top → Parts shows "Common top" with "cut to template".

## Open questions

None. All answered by the user on 2026-10-31 (see Context).
