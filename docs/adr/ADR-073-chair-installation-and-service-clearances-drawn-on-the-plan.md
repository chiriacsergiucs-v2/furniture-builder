# ADR-073: Chair, installation and service clearances, drawn on the plan

- Status: Pending
- Date: 2026-10-24
- Depends on: ADR-057, ADR-058
- Design: docs/ui-design.md (Plan view, Output › Checks)
- Backlog: N68

## Context

The user, 2026-10-24, on the Feature Research & Catalog selection: "Identify the features and subfeatures
necessary for the following items from research. Import 3D models and model libraries · Duplicate, mirror and
predictable rotate operations · Also for these: [14 features marked Interested]", then "Draft adrs for each".

Research row: _Collision + operational-clearance detection_ (rank 3, P0) with envelopes for solid body, door
swing, drawer extension, chair/user space, installation and service zones, and clearance overlays with severity.
The app already checks bodies overlapping, the room, and door, drawer and flap opening clearance
([ADR-057](../adr-done/ADR-057-opening-clearance-doors-drawers-and-flaps-need-free-space-in.md), [ADR-058](../adr-done/ADR-058-the-project-has-a-room-walls-doors-windows-and-obstacles-chec.md)). Missing: chair space, installation clearance, service zones, and drawing all of
them on the plan.

## Decision

- **Envelopes** are boxes derived in the core (`envelopesOf`), never stored:
  - _chair_: in front of a desk or table knee space, depth from the user's setting;
  - _installation_: above a tall unit, the extra height needed to stand it up (its diagonal minus its height),
    checked against the room height;
  - _service_: an optional zone the user sets on a piece (for example behind an appliance niche), size in mm.
- Each envelope gives a **warning** when another piece or the room enters it; installation over the room
  height is an **error** only if the user marks the unit "assembled lying down" — otherwise a warning.
- **Overlay:** a _Clearances_ toggle on the plan draws all envelopes (bodies, door swings, drawer travel, chair,
  service) as hatched zones coloured by the worst problem: none, warning, error.
- The sizes for chair and service zones come from the user (ADR-010); nothing is invented.

## Alternatives considered

- **Rapier or another physics engine for queries** — every part is an axis-aligned box; the core's box tests
  are exact and need no dependency.
- **Oriented boxes (OBB)** — not needed while turns are quarter turns.

## Scope

- In scope: three new envelopes, their warnings, the overlay toggle.
- Out of scope: animated door opening, human figures.

## Consequences

- Positive: "looks right but cannot be built" problems show while planning.
- Harder to change later: the optional service zone and chair depth are saved on the project item, so
  the project `schemaVersion` goes up by one (the next free number when this ships; projects are at 1 today) and older files still load (ADR-011).

## Done when

- [ ] Chair, installation and service envelopes are derived and checked (unit tests)
- [ ] The tall-unit installation check uses the diagonal and the room height (unit test)
- [ ] _Clearances_ toggle draws zones in three severities (find-it at 390 px and 1280 px)
- [ ] All CI checks pass; `FUZZ_N=30000` fuzz passes

## Open questions

- Chair space depth — no default; you give it (for example the depth you plan for).
- Service zone sizes per appliance — no defaults; set per piece.
