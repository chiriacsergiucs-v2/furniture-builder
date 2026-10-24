# ADR-039: Upholstered, mechanised and shaped pieces are catalog reference entries until a shaped-part ADR exists

- Status: Implemented
- Date: 2026-10-22
- Implemented: 2026-10-23
- Decided by: user request; defaults below await confirmation
- Depends on: none
- Design: n/a
- Related: ADR-004, ADR-010, ADR-032, ADR-038
- Backlog: N29

## Context

The user's list includes sofas, sectionals, armchairs, accent chairs, recliners, ergonomic office chairs and outdoor
loungers, plus chairs with raked backs. Their defining parts are upholstery, mechanisms (recline, gas lift, adjustable
backrest) or angled and curved members. ADR-004 allows only axis-aligned boxes; casework tools handle these only as
decorative blocks (research 2026-10-22, unverified).

## Decision

- These families are in the catalog with `support: 'reference'`: the card and detail panel show their **default
  structure** (frame members, deck, arms, back, cushions or mechanism), **typical dimension ranges** (labelled
  typical) and **configurations** (seat count, modules and layout for sectionals, arm style, mechanism type), from
  `docs/catalog.md`.
- They are not generated, not in _Start from_ (ADR-032 default), and produce no cut list. The detail panel says
  which ADR would unlock them.
- **Partial unlock without new geometry:** a sofa or armchair _base frame_ made of straight rails and 18 mm panel
  arms can be modelled with the frame root (ADR-038) as `kind: 'bench'` with arms — offered as a variant
  "Frame only (no upholstery)" with `requires: ['root:frame']`; upholstery, springs, foam and mechanisms are listed as
  purchased items with no specifications.
- A future **shaped-part ADR** (angled boxes or extruded profiles) would unlock raked chair backs, splayed legs,
  loungers and diagonal corner fronts.

## Alternatives considered

- **Drop these families** (research report recommendation) — rejected: the user asked for the entire catalog.
- **Approximate angles with stepped boxes** — rejected: wrong cut sizes.

## Consequences

- The catalog is complete for browsing; only buildable variants can be inserted.

## Evidence (repository files)

- `src/core/types.ts` (`Box`, `Panel`), ADR-004 consequences ("Rotated or shaped parts … need a new panel kind").

## Compliance check

When accepted: every `reference` family has structure, ranges and configurations text and no insertable variant
except ones whose `requires[]` is built.

## Open questions (defaults used until answered)

1. Is a shaped-part ADR wanted next (raked backs, tapered legs, diagonal fronts)? Default: not scheduled.

## Implementation (2026-10-23)

Armchair, accent chair, sofa, sectional, recliner, ergonomic office chair and outdoor lounger are `reference` families:
structure, typical ranges and configurations on their cards, not in _Start from_. Armchair, accent chair and sofa (2
and 3 seats) have an insertable _Frame only_ variant built with the frame root (a bench with a vertical back) whose
upholstery is a _to choose_ reminder; sectional, recliner, office chair and lounger have no insertable variant.
Open question 1: no shaped-part ADR scheduled.

Evidence: `src/core/catalog/furniture.ts`, `tests/catalog.test.ts`.

Verification 2026-10-23 (branch `feat/catalog-templates`): `npm run lint`, `npm run typecheck`, `npm test` (157 passed), `npm run build` passed; `FUZZ_N=30000` fuzz passed (cabinets with the new fronts and flags, and frames); scripted headless Chromium against the production build at 1280 and 390 px, 18/18 checks, no page errors, no sideways scroll. Six code mutations each fail a test. Not checked on a real phone, with a screen reader, or on the deployed site.

## Amendment (2026-10-23)

All seven families now have items that open (frame only / frame shell, upholstery and mechanisms as _to choose_
reminders) and appear in _Start from_; their support is `ready`. Items that need angled parts (reclining frame,
adjustable lounger backrest, raked garden-bench back, diagonal corner front) still wait for a shaped-part ADR.

## Answers (2026-10-23, from the user)

1. **Yes, write the shaped-part ADR next**: ADR-040 (Proposed).
