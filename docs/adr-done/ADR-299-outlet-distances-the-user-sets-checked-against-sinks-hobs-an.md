# ADR-299: Outlet distances the user sets, checked against sinks, hobs and pipes

- Status: Implemented
- Date: 2026-11-27
- Implemented: 2026-11-27
- Depends on: ADR-072, ADR-205
- Design: docs/ui-design.md (Room panel)
- Backlog: N426

## Context

[ADR-072](../adr-done/ADR-072-pipes-and-outlets-in-the-room-checked-against-the-pieces.md) put pipes and outlets
in the room and left "electrical rules" out of scope; gap G-406 records it: "No electrical rules: distances of outlets
from sinks, hobs or water are not checked." Its question was "Which rules, and from which regulation? The app must not
invent them (ADR-010)." The user accepted the suggested pick on 2026-11-27 ("Also do the medium work", "Auto-accept if
confidence > 85%"): "Only the distances the user enters, checked as warnings and labelled as the user's rule."

The distances are stored on the room in the project document, so the document shape changes (ADR-011).

## Decision

- `Room.outletDistances?: { sink?, hob?, pipe? }`, whole mm, each at least 1. Absent, or a key left out, means no
  check for that kind. There is no default and no value taken from a regulation (ADR-010). Project `schemaVersion`
  goes to 22 (`OUTLET_DISTANCES_SINCE`); version 21 and older files load unchanged, a version-21 file carrying the
  field is refused (ADR-011).
- Check (`outletDistanceChecks` in `src/core/room.ts`, run by `buildProjectModel`): for each outlet on a wall, the
  shortest straight-line gap from its zone on the wall face to each sink and hob cut-out (`cutoutOutlines`, the box in
  the worktop) and to each pipe's zone on the wall face. A gap smaller than the distance set is a **warning**, code
  `outlet-near`, never an error; its message says "(your rule)" and names the measured gap (whole mm, rounded down)
  and the distance set. Sink and hob warnings point at the cut-out (`sink:<id>`, `hob:<id>`).
- Room panel (decided by Claude): once the room has an outlet, the section shows "Outlet distances (your rule)" with
  three empty fields, _Outlet to a sink_, _Outlet to a hob_, _Outlet to a pipe_, and a hint that empty means no check and
  that the app has no built-in distances. A value that is not a whole number of 1 mm or more is marked at its field
  and not saved (ADR-008); emptying a field removes it.

## Alternatives considered

- **Built-in distances from a regulation** — refused: the app must not invent or quote physical rules (ADR-010), and
  the rule differs by country.
- **Store the distances in the project settings (ADR-124)** — the rule is about the room's outlets and the room is
  absent in projects without one; keeping it on the room drops it with the room.
- **Measure along the wall only** — simpler, but a sink cut-out lies in the worktop, not on the wall; the straight-line
  gap covers both and is stated in the code.

## Scope

- In scope: the stored distances, validation, the warning, the three fields, Russian text.
- Out of scope: any built-in or regulation value (ADR-010, by decision); water points other than pipes (none exist in
  the model).

## Consequences

- Positive: the user's own electrical rule is checked on every change.
- Harder to change later: the field is saved in projects (schemaVersion 22).

## Done when

- [x] No distances, or empty ones: no `outlet-near` warning (`tests/outlet-distances.test.ts`)
- [x] An outlet closer than the entered distance to a sink, a hob or a pipe warns, and the message says it is the
      user's rule; at the distance or farther it does not (`tests/outlet-distances.test.ts`)
- [x] schemaVersion 22 validates the field, 21 refuses it and older files load; bad values are refused
      (`tests/outlet-distances.test.ts`)
- [x] "Outlet distances (your rule)" and its three empty fields are found after _Add outlet_; a typed value is saved,
      a bad one is marked (find-it at 390 and 1280 px, `tests/find-it/outlet-distances.test.tsx`)
