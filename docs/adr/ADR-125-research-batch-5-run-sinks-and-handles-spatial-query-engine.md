# ADR-125: Research batch 5: run sinks and handles, spatial query engine trial

- Status: Pending
- Date: 2026-10-27
- Depends on: ADR-061, ADR-075
- Design: docs/ui-design.md (project editor, run parts)
- Backlog: N126
- Agreed: 2026-10-27: "Accept default" (the suggested picks of G-163, G-164 and G-165)

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

1. **Run handles.** **Handles for this run** in Run parts: for a run of base units (the runs of ADR-054/061), one
   handle from the shipped handle list (Bar with the existing hole-centre list, Knob, Push to open; ADR-010, ADR-024)
   on every door and drawer front of the run, on one line. The line is a **height in mm** above the floor the user
   enters, or **Top of fronts** in one tap (G-164, accepted). A front the line does not cross gets the handle near its
   top. Stored as `Project.runHandles` (`from` = the run's pieces, `own` = pieces that keep their own handles,
   ADR-061 overrides); applied when the model is built (`applyRunHandles`, ADR-004), never written into the pieces'
   designs, so removing it gives each piece its own handles back. The run is found again on every build, so a piece
   added to the run gets the handles; a removed run handle is not proposed again.
2. **Run sinks.** **Sink** in Run parts: over a base the user picks, a cut-out in the run worktop whose width and
   depth the user enters (no default, ADR-010; G-163, accepted): a note on the worktop's cut-list row ("sink
   cut-out W × D mm") and a line "Sink (your choice)" under _To choose before buying_ in the shopping list. No 3D
   sink. Diagnostics: no worktop over the base (warning), a cut-out wider than the base (warning), a cut-out as deep
   as the worktop or deeper (error, ADR-008). Stored as `Project.sinks`.
3. **Spatial query trial.** A measured trial of `@dimforge/rapier3d-compat` as a query engine only (no physics),
   added as a **devDependency** only (G-165, accepted: nothing ships in the app unless it wins): the sample projects
   checked by today's box tests and by Rapier contact queries, comparing answers, time and package size. The numbers
   go in N126; adopting it needs a new ADR.

Project `schemaVersion` 13 stores `runHandles` and `sinks` (ADR-011); older versions still load.

Built as one change, one pull request, one test run and one ship (the user's request).

## Alternatives considered

- **Handles stay per piece** — no aligned line across a run, which the research asks for.
- **Skip Rapier** — would drop a listed feature (R2); a trial costs little and informs typed rotation
  ([ADR-121](ADR-121-research-batch-1-render-3d-on-demand-review-pack-typed-rotat.md), G-149).

## Scope

- In scope: the two features above, core and UI-logic tests, jsdom find-it, the trial's measurements.
- Out of scope: nothing; the answered questions are G-163 to G-165.
- Skipped while building: project templates keep no run handles or sinks (G-210); the piece editor shows the piece's own
  handles, not the run's (G-211); the sink cut-out is not drawn (G-212).

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

Answered 2026-10-27 ("Accept default"): G-163 cut-out, note and shopping line; G-164 a height in mm with Top of fronts
as a one-tap choice; G-165 a measured trial first.
