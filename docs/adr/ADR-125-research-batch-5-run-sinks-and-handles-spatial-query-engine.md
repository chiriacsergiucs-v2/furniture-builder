# ADR-125: Research batch 5: run sinks and handles, spatial query engine trial

- Status: Deferred (open questions G-163, G-164, G-165)
- Date: 2026-10-27
- Depends on: ADR-061, ADR-075
- Design: docs/ui-design.md (project editor, run parts)
- Backlog: N126

## Context

The user (2026-10-27): "Check which features are left in the features reasearch, and that we dont have, for all
missing sorted by complexity, low to medium-high (including), create 1 ADR per batch of 4 features, and ship it as
1 big change, 1 Pr, 1 run of the tests, 1 ship, 4 features."

Last batch of the features left after ADR-093…120 (list in [ADR-121](ADR-121-research-batch-1-render-3d-on-demand-review-pack-typed-rotat.md)). 18 features left, so this batch has
two, not four:

| Research feature (id)                                            | Complexity  | What is missing here                  |
| ---------------------------------------------------------------- | ----------- | ------------------------------------- |
| Generated sinks, handles, derived parts (`gen-sinks-handles`)    | Medium-high | sinks and handles generated for a run |
| Spatial query engine (Rapier) without physics (`rapier-queries`) | Medium-high | not evaluated                         |

Handles today are chosen per piece (N06); run parts (ADR-061) are rebuilt from the pieces they span.
`@dimforge/rapier3d-compat` is a WASM library; its licence, size and offline behaviour must be checked before it
can be a dependency (CLAUDE.md: no dependency with an unknown licence or telemetry).

## Decision

1. **Run handles.** A run (ADR-054/061) gets **Handles for this run**: one handle type and one height line for
   every front in the run, kept as a generated run part, refreshed when pieces change; a piece can override it
   (ADR-061 overrides survive). Handle specs come from the shipped handle list only (ADR-010). Where the line sits
   waits for G-164.
2. **Run sinks.** A sink is a generated run part over a base the user picks: what it produces waits for G-163.
   Sizes are the user's input, never invented (ADR-010); the shopping list (ADR-064) gets its line.
3. **Spatial query trial.** A measured trial of Rapier as a query engine only (no physics): the same projects
   checked by today's box tests and by Rapier queries, comparing results, time and bundle size, lazy-loaded so the
   first load is unchanged. The result is recorded in this ADR's backlog row; adopting it waits for G-165.

Built as one change, one pull request, one test run and one ship (the user's request).

## Alternatives considered

- **Handles stay per piece** — no aligned line across a run, which the research asks for.
- **Skip Rapier** — would drop a listed feature (R2); a trial costs little and informs typed rotation
  ([ADR-121](ADR-121-research-batch-1-render-3d-on-demand-review-pack-typed-rotat.md), G-149).

## Scope

- In scope: the two features above, core and UI-logic tests, jsdom find-it, the trial's measurements.
- Out of scope: nothing; the undecided parts are the open questions (G-163 to G-165).

## Consequences

- Positive: one handle line across a kitchen run; sinks counted in the cut list and shopping list; a measured answer
  on Rapier.
- Negative / risks: a WASM dependency would add bundle weight; the trial must not ship it unless G-165 says so.
- Harder to change later: run handle and sink records in saved projects (ADR-011).

## Done when

- [ ] Run handles: every front in the run gets the run's handle on one line; an overridden piece keeps its own
      (tests).
- [ ] Adding a piece to the run refreshes the handles; removing a run handle stays removed (ADR-061) (tests).
- [ ] A sink over the chosen base appears in the cut list note and the shopping list with the user's size (tests).
- [ ] The trial's numbers (agreement with box tests, time, bundle size, licence) are recorded in N126.
- [ ] jsdom find-it at 390 and 1280 px: "Handles for this run", "Sink".

## Open questions

- **G-163** Sinks: a cut-out in the run worktop sized by the user, a cut-list note and a shopping line — or also a
  sink as a 3D item? Suggested: cut-out, note and shopping line (no sink sizes invented, ADR-010).
- **G-164** Handle line: at the top of fronts, centred, or a height in mm the user enters? Suggested: a height in mm
  with top-of-front as a one-tap choice.
- **G-165** Rapier: a measured trial with nothing shipped unless it wins, or adopt it now? Suggested: trial first
  (the research says "evaluate").
