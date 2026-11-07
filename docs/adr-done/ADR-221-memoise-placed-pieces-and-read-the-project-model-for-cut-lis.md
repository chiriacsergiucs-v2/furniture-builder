# ADR-221: Memoise placed pieces and read the project model for cut list and hardware

- Status: Implemented
- Date: 2026-11-07
- Implemented: 2026-11-07
- Depends on: none
- Design: n/a
- Backlog: N226

## Context

User, 2026-11-07 (the architecture review request): "current code structure/architecture modularity and overall
design analysis ... complete code quality critique and suggest architectural improvements ... No regressions shall
be introduced, ensure before and after testing tdd style". User, 2026-11-07: "full autopilot and ownership grant to
run in parallel as you see fit agents to cover the entire i1 to i20, draft adrs in 1 pr then do batches. Goal is to
have them all done and merged with no regressions introduced then stop".

This ADR is improvement **I-03** of `docs/retros/2026-11-07-architecture-review.md` (sections 7 and 8). The
choices below were decided by Claude under the user's ownership grant, 2026-11-07; no question is left open.

`placeItem` in `src/core/project.ts` re-runs `buildModel` from 13 call sites with no memo, and `projectCutlist` and
`projectHardware` rebuild every item instead of reading `projectModel.pieces[i].model` (review sections 4 and 5).
Estimate: ≥ 421 `buildModel` calls per edit on a 60-item project → ≈ 61; ≈ 25 ms → ≈ 4 ms. ADR-004 stays: every list
is still a projection of `buildModel()`.

## Decision

Decided by Claude under the user's ownership grant, 2026-11-07.

- A module-level `WeakMap` cache in `placeItem`, keyed by the item object and then by a string key of the options it
  reads; items are immutable store snapshots, so identity is a valid key. No cache outside `placeItem`.
- `projectCutlist(project, projectModel?)` and `projectHardware(project, projectModel?)` read
  `projectModel.pieces[i].model` when given one and build it once otherwise; their callers pass the model they hold.
- Output unchanged: the cut-list rows and hardware are byte-identical to today's.

## Alternatives considered

- **Cache by a hash of the item JSON** — costs a serialisation per call, close to the saving.
- **Derive the cut list and hardware once in `commitProject` and store them** — larger store change; kept as G-487.
- **Memoise `buildModel` itself** — its inputs are not one object, and the call sites differ in options.

## Scope

- In scope: the `placeItem` memo, the two functions reading the model, their callers.
- Out of scope: deriving the cut list, hardware and view once in the store (G-487).

## Consequences

- Positive: edits on large projects stop rebuilding each piece several times.
- Negative / risks: a stale result if an item is ever mutated in place (none today: the store is immutable); the
  WeakMap frees entries with their items.
- Harder to change later: code that mutates an item now also breaks the cache, so immutability becomes load-bearing.

## Done when

TDD (review section 9): every item starts from a test written first that pins today's behaviour and passes on
`main` before the change; the change keeps it green (or turns the stated red test green).

- [x] (test first) golden: `projectCutlist` and `projectHardware` rows for every sample project (`mobilaLiving` and
      the others in the samples) written to a fixture on `main`; byte-identical after the change. Evidence: `tests/project-rows-golden.test.ts` › "rows and hardware of every
      sample project are byte-identical to the golden file" (fixture `tests/fixtures/project-rows.golden.json`, written
      before the change; the two samples plus a run with a run plinth, common top, shared sides, run handle and a piece
      placed above).
- [x] (test first) `buildModel` spied with a counter: one `commitProject` plus `projectCutlist` and `projectHardware`
      on a 30-item project makes at most 31 calls (red before). Evidence: `tests/place-memo.test.ts` › "one commit plus the cut list and
      hardware of a 30-item project build each piece once": 90 calls before, 30 after.
- [x] Placing the same item twice returns the same object; a changed item (new identity) gets a new result. Evidence: `tests/place-memo.test.ts` › "placing
      the same item twice returns the same object; a changed item gets a new result".
- [x] `FUZZ_N=30000 pnpm exec vitest run tests/fuzz.test.ts` passes (9 tests, 2026-11-07).
- [x] `pnpm lint`, `pnpm format:check`, `pnpm typecheck`, `pnpm test`, `pnpm build` and `pnpm docs:check` pass; the
      test count is not lower than on `main` before the change (review section 9). Evidence: CI run 42354663319 (PR #200) green on every job.
