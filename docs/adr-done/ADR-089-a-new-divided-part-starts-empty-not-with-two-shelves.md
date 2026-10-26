# ADR-089: A new divided part starts empty, not with two shelves

- Status: Implemented
- Date: 2026-10-26
- Implemented: 2026-10-26
- Depends on: ADR-086
- Design: n/a
- Backlog: N85

## Context

Bug report from the user, 2026-10-26, in their words:

> 1. Editing right column, currently has 1 vertical divider (image 3)
> 2. Add a horizontal divider (image 4) adds the divider, but somehow it decided to add also two shells in it. This
>    is not wanted behavior.

Cause (reproduced 2026-10-26: the new tests fail on the old code; the find-it step on the old build counted 3 new panels, 1 divider and 2 shelves): `splitSpace` in `src/core/design.ts` keeps the old content
in the first part and fills every new part with `makeSpace('shelves')`, which has `count: 2`. `stepDividers` in
`src/core/counts.ts` does the same for an added bay ("A new bay goes at the end with 2 shelves", ADR-084). So `+`
Horizontal dividers on the right column moved its vertical split to the top part and put 2 shelves in the new bottom
part. Same for vertical dividers, the "Side by side"/"Stacked" buttons and the Parts counter.

## Decision

- A new part made by a divider is empty (`makeSpace('empty')`); the existing content stays in the first part, as
  today (G-066).
- It applies to every way of adding a part: quick-count vertical and horizontal dividers, "Side by side",
  "Stacked" and Parts `+` (G-067).
- Removing a divider keeps today's rule (the first part's content survives).
- Catalog layouts and templates that call `splitSpace` and then set each part's content are unchanged; the catalog
  snapshots (`pnpm catalog:snapshots`) must not change.

## Alternatives considered

- **Copy the neighbouring part's content** — still adds parts the user did not ask for.
- **Shelves with count 0** — reads as "Shelves" in the inspector though nothing is there; "Empty" says it.

## Scope

- In scope: `splitSpace` and `stepDividers`, regression tests, the find-it step, catalog snapshot check.

## Consequences

- Positive: a divider adds a divider and nothing else.
- Negative / risks: designs that relied on the 2 default shelves get empty parts; saved designs do not change
  (nothing is migrated, ADR-012).

## Done when

- [x] `tests/counts.test.ts`: on a space with 1 vertical divider, `+` Horizontal dividers gives 2 parts, the first
      holding the vertical split unchanged, the second `empty`; no new shelf panels in the model. Fails on today's
      code.
- [x] Same for `+` Vertical dividers on an undivided bay and for `splitSpace` from the inspector buttons.
- [x] `pnpm catalog:snapshots` shows no change; fuzz `FUZZ_N=30000` passes.
- [x] `tools/count-stepper/find-it.mjs` at 390 and 1280 px: the user's steps; after "More horizontal dividers" the
      parts count rises by the divider only (no shelves).
- [x] lint, format:check, typecheck, test, build, docs:check pass.

## Answered questions

- New part: user 2026-10-26 "Empty" (G-066).
- Every way of dividing: user 2026-10-26 "Yes" (G-067).
