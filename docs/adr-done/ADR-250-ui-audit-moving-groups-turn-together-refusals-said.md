# ADR-250: UI audit — Moving: a group turns as one, fields fit every place, refusals are said where asked

- Status: Implemented
- Date: 2026-11-10
- Implemented: 2026-11-10
- Depends on: none
- Design: docs/ui-design.md
- Backlog: N259
- Acceptance: full

## Context

The user asked for a domain-by-domain UI audit (2026-11-10): map every sub-flow, find what breaks it, propose the
best fix, then cross-examine. This ADR is domain 03, **Moving** (`src/ui/info/features.ts:239-301`). The full
sub-flow map (10 feature lines, entry → steps → end state, code and tests per row) and the evidence are in
[docs/research/ui-audit-03-moving.md](../research/ui-audit-03-moving.md).

Summary of the map: a piece moves by a drag or the arrow keys on the plan (`src/ui/Project.tsx:2045-2186`), by a drag
in 3D Move mode (`src/viewer/pieceDrag.ts:146-212`), by typed fields and the gap tool in the card's Position group
(`Project.tsx:480-516,1325-1460`), by Move to (`src/ui/MoveTo.tsx:12-71`), and turns by Turn ↺ / ↻, R, [ / ] and the
round handle (`Project.tsx:1195-1265,2045-2068,2335-2357`). All are reachable at 390 and 1280 px.

ADR-148 settled that a grouped piece never moves or turns on its own; ADR-244 that every refusal is said. One turn path
breaks the first, the card's fields contradict places other paths make, and two card controls lose the user's place
or their reason.

## Findings

| Id     | Class        | Severity | Finding                                                                                                                                                             |
| ------ | ------------ | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D03-F1 | Proven       | major    | The turn handle and [ / ] turn one grouped piece alone; the rest of the group only shifts (`designStore.ts:1326-1337`, `Project.tsx:1843-1848,2061-2068`).          |
| D03-F2 | Proven       | minor    | Gap (max 5000) and wall height (max 3000) fields show a false error for places a drag or the 3D height drag make (`Project.tsx:500,1398,1464`).                     |
| D03-F3 | Proven       | minor    | A Move to tap removes the tapped button from the card and focus falls to the page body (`MoveTo.tsx:36`).                                                           |
| D03-F4 | Proven       | minor    | A refused From left / From back / Placed change reverts the field with no word in the card; only the plan says why (`designStore.ts:1049-1057`).                    |
| D03-F5 | Code-evident | major    | Accepted (user 2026-11-10): in 3D Move mode, pressing a piece of a multi-selection drops the selection and drags one piece (`src/viewer/pieceDrag.ts:168-171,210`). |

## Decision

One rule for every move path: **a group moves and turns as one, a field accepts every place the app itself makes, and
a refusal is said where the user asked.**

1. **F1:** `setItemRotation` on a piece in a group is refused with "{name} is in a group; turn the group with Turn ↺
   or Turn ↻, or ungroup it to turn it alone." (`t()` with its Russian entry), in core, so the handle, [ / ] and the
   hidden Rotation field all keep ADR-148. The handle is not shown for a grouped piece, as for a locked one.
2. **F2:** the card's gap, "Underside above the floor" and "Above floor" fields take the same bound as From left
   (0 to 20000); the core keeps its own checks (ADR-008). The steppers keep their bound.
3. **F3:** after a Move to tap, focus moves to the Move to group's first button, or to its status line when none is
   left (`tabIndex={-1}`).
4. **F4:** `updateItem` returns the refusal reason (as `setGap` does); `PlacementFields` shows it under the fields in a
   `role="status"` line, like the gap tool.
5. **F5:** decided by the user: see the last Decision item.
6. **F5 (D03-F5, user 2026-11-10):** in 3D Move mode, pressing a piece that is part of a multi-selection keeps the selection and drags all of it as the plan does (one undo step; locks refuse as on the plan).

## Alternatives considered

- **F1: turn the whole group to any degree about its centre** — matches ADR-148's words, but groups would then hold
  angled pieces at mixed angles; larger core change and fuzz work. The refusal keeps the rule now.
- **F2: drop the field bounds** — `MmField` needs a bound for its message; ±20000 is already the From left bound.
- **F3: keep off actions as buttons in the card** — ADR-160 chose to fold them away; moving focus keeps that choice.

## Scope

- In scope: F1–F4 as decided; tests for each.
- Out of scope: F5 until answered; any-degree group turns.

## Consequences

- Positive: every turn path keeps groups together; no red field on a value the app made; keyboard users keep their
  place; refusals are said in the card.
- Negative / risks: a grouped piece loses the handle; the user turns the group by quarter turns or ungroups.

## Done when

- [x] [ / ], the handle and `setRotation` on a grouped piece change nothing and say the group sentence; the handle is gone for it (core test + find-it).
- [x] A gap of 5400 mm and a wall unit at 3200 mm show no field error in the card (test).
- [x] After a Move to tap the focus is inside the Move to group (test).
- [x] A refused From left on a grouped piece with a locked member shows the reason in the card (test).
- [x] In 3D Move mode, dragging one piece of a two-piece selection moves both by the same amount in one undo step (store test + browser script).
- [x] Find-it test passes from the bare app at phone and desktop widths.

Evidence: tests/find-it/audit-moving.test.tsx; tests/find-it/audit-moving.test.tsx, tools/ui-audit-3d/find-it.mjs (production build in Chromium, 1280 and 390 px) (run 2026-11-10 in the sandbox: the full suite and the files above pass).

## Cross-examination

One round, 2026-11-10. The skeptic checked each finding for duplicates (of each other and of ADR-248), for behaviour an
implemented ADR intends, for conflicts with the hard rules, for over-engineering and for missing tests.

| Id     | Skeptic                                                                                                                                          | Proposer                                                                                                                                                                                                                                        | Verdict                    |
| ------ | ------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------- |
| D03-F1 | ADR-169 built the handle for "the selected piece"; a second tap selects one grouped piece on purpose, so turning it alone may be meant.          | ADR-148 line 43-46 names turning among the paths that act on the whole group, and line 48-49 limits the second tap to "editing only (its boards, inside, size)". `turnItem` keeps it (`group-size.test.ts:164-171`). Reproduced in core and UI. | Accepted                   |
| D03-F2 | The bounds are guidance; few walls are over 5 m.                                                                                                 | The field turns red on a value nobody typed, which ADR-008 forbids (never show a false error); a 6 m wall and a 3D drag to 3200 mm both reproduce it. No ADR sets 5000 or 3000 (none found in ADR-022, ADR-031, ADR-122).                       | Accepted                   |
| D03-F3 | ADR-160 chose to show only working actions; a vanishing button is the design.                                                                    | The fold is kept; only focus moves. CLAUDE.md requires visible keyboard focus; focus on `<body>` is reproduced.                                                                                                                                 | Accepted                   |
| D03-F4 | The plan's notice already says why (ADR-244 is implemented), so this is a duplicate.                                                             | ADR-244 put the reason in the notice; on the same card the gap tool also says it inline (`Project.tsx:505-509`) and From left does not. Reproduced: "in card: false". Not a duplicate of ADR-248 (creation paths only).                         | Accepted                   |
| D03-F5 | ADR-093 says pressing a piece selects it; ADR-159 brought Select to 3D for taps only (lines 30-34) and kept drag out. Changing Move mode is new. | ADR-097 line 29 says dragging any selected piece moves them all, but it predates multi-select in 3D. No implemented ADR decides the 3D case, so the user picks.                                                                                 | Accepted (user 2026-11-10) |

No physical-fact question arose. Decided without asking: F1 refuses rather than turning a group to any degree; F2 uses
the existing ±20000 bound; F3 focuses the first remaining button.

## User decision (2026-11-10)

- **D03-F5:** Move the whole selection, as the plan does.
