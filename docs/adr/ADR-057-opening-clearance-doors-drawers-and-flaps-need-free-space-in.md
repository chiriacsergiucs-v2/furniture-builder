# ADR-057: Opening clearance — doors and drawers need free space in front; warnings in projects

- Status: Pending
- Date: 2026-10-24
- Decided by: user, 2026-10-24: "create the ADRs … auto-accept the recommended suggestion" (answers below)
- Depends on: ADR-022, ADR-031, ADR-037
- Design: docs/ui-design.md (Plan view, Checks tab)
- Backlog: N54

## Context

Research feature _Collision + operational-clearance detection_ (rank 3, value 5.0, P0; IKEA PAX and Kitchen
reports: drawers hitting doors or hinges, appliances without clearance). Static collision exists: the project build
reports `pieces-overlap` and `run-part-overlap` errors (`src/core/project.ts`). Inside one piece, internal drawers
behind doors already give a guidance warning (`internal-drawers`, `src/core/cabinet.ts`). What is missing is the
space a door or drawer needs **in front of the piece** when it opens, checked against other pieces, run parts and
(once ADR-058 exists) walls and room openings.

## Decision

- **Clearance boxes** (axis-aligned, ADR-004), derived from the built model of each placed piece, in room
  coordinates, never stored:
  - hinged door: a box in front of the door, door width × door height × **door width** deep (the swing reach);
  - drawer: drawer-front width × front height × **drawer box depth** (full travel);
  - flap (ADR-037): flap width × flap height deep, upward for lift-up, downward for drop-down;
  - sliding doors: no clearance box (they move in their own plane).
- **Check:** a clearance box that overlaps another piece's panel, a run part, or (ADR-058) a wall, window sill zone
  or obstacle gives a **warning** `opening-blocked`: "Top drawer of Base cabinet 2 cannot open fully: it hits
  Wardrobe (needs 500 mm, 320 mm free)". Two clearance boxes overlapping each other (two doors swinging into the same
  corner) give the warning `openings-clash`.
- **Warnings, not errors.** They do not block export (ADR-008); clearances are guidance (ADR-010).
- **Shown** in the project's problem list and on the plan as a dashed outline of the blocked clearance when its
  piece is selected.

## Alternatives considered

- **Exact swing arcs** — not axis-aligned; the box is the conservative envelope of the arc and matches ADR-004.
- **Errors that block export** — users sometimes accept a door opening only to 90°; a warning keeps them in control.

## Scope

- In scope: doors, drawers and flaps against pieces, run parts, walls and obstacles.
- Out of scope: handle projection, exact swing arcs.

## Consequences

- Corner layouts and pieces facing each other in narrow rooms will show warnings — that is the point.
- Handle projection is not included (handle depth is not in the model).

## Done when

- [ ] Unit tests: a drawer unit with a wardrobe 300 mm in front → `opening-blocked` naming both; 600 mm free for a 500 mm drawer → no warning; two doors in an L corner → `openings-clash`; sliding doors → none; export still allowed.
- [ ] Find-it at 1440 and 375 px: project with a chest of drawers and a wardrobe turned to face it at 300 mm → the problem list shows **cannot open fully**; Parts CSV stays enabled.
- [ ] Find-it test passes from the bare app at phone and desktop widths (`tools/ensemble/find-it-adrs.mjs`)

## Answers

1. _Warning or error?_ — **Warning; export stays allowed.**
2. _Swing shape?_ — **Box as deep as the door is wide (conservative), not an arc.**
3. _Check door-against-door clashes too?_ — **Yes (`openings-clash`).**
4. _Include handles?_ — **No; handle depth is not modelled.**

## Implementation notes

`src/core/clearance.ts` (`localClearances`), `PlacedPiece.clearances`/`facing`, `openingChecks` in `src/core/project.ts` (`opening-blocked`, `openings-clash`, warnings), room walls and obstacles included (ADR-058); flaps keep a box twice their height (up or down) and as deep as they are high; fixed fronts need none. The plan outlines a selected piece's blocked clearances in red dashes. Tests: `tests/clearance.test.ts`, `tests/room.test.ts`. find-it `tools/ensemble/find-it-adrs.mjs` (production build, bare app, visible text, 1440 and 375 px): 60/60: Checks list _cannot open fully_; Parts CSV stays enabled.
