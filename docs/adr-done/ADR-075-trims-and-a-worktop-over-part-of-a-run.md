# ADR-075: Trims and a worktop over part of a run

- Status: Implemented
- Date: 2026-10-24
- Implemented: 2026-10-25 (Merged to main; CI run 40170561018 and Deploy GitHub Pages run 40170561007 green on 895eb54)
- Depends on: ADR-036, ADR-054, ADR-061
- Design: docs/ui-design.md (Project panel › Run parts)
- Backlog: N70

## Context

The user, 2026-10-24, on the Feature Research & Catalog selection: "Identify the features and subfeatures
necessary for the following items from research. Import 3D models and model libraries · Duplicate, mirror and
predictable rotate operations · Also for these: [14 features marked Interested]", then "Draft adrs for each".

Research rows: _Automatically generated shared countertops_ (rank 13) and _Automatic fillers, plinths, end
panels and trim_ (rank 14). The app already adds one worktop over a run, fillers with scribe, cover panels and a
run plinth, and keeps them up to date ([ADR-036](../adr-done/ADR-036-kitchen-modules-tall-units-construction-flags-on-the-cabinet.md), [ADR-054](../adr-done/ADR-054-run-plinth-replaces-piece-plinths-filler-scribe-sink-false-fr.md), [ADR-061](../adr-done/ADR-061-run-parts-stay-up-to-date-the-user-s-removals-are-remembered.md)). Missing: a worktop over only
part of a run, worktop overhang settings, and trims (crown/top molding, light pelmet, ceiling filler).

## Decision

- **Worktop over chosen pieces:** _Add worktop over…_ lets the user tick adjacent base units; the worktop spans
  them only. It is a run part like today's, keyed by its pieces, and refreshes when they move or resize.
- **Overhang:** front and side overhang in mm on each worktop (defaults: the current values, unchanged).
- **Trims** (new run-part kinds `crown`, `pelmet`, `ceiling-filler`), offered for runs of wall or tall units:
  crown and pelmet are strips along the run's front at the top or bottom edge; a ceiling filler closes the gap
  from the run top to the room height. Board and height chosen by the user; they appear in the cut list and
  shopping list like other run parts.

## Alternatives considered

- **Draw trims as decoration only** — they are bought and cut, so they must be in the cut list.

## Scope

- In scope: partial worktop, overhang fields, three trim kinds.
- Out of scope: profiled molding shapes, worktop cut-outs for sinks and hobs.

## Consequences

- Harder to change later: three run-part kinds, the chosen pieces and an overhang field are saved in projects, so
  the project `schemaVersion` goes up by one (the next free number when this ships; projects are at 1 today) and older files still load (ADR-011).

## Done when

- [x] A worktop over two of four pieces spans exactly those two and refreshes with them (unit tests)
- [x] Overhang changes the worktop size and position (unit test)
- [x] Crown, pelmet and ceiling filler sizes follow the run and room height; they are in the cut list
      (unit tests)
- [x] _Add worktop over…_ and the trims are found (find-it at 390 px and 1280 px)
- [x] All CI checks pass

## Open questions

- Default trim heights — no defaults; you give them.
