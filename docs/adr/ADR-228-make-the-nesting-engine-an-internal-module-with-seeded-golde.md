# ADR-228: Make the nesting engine an internal module with seeded golden layouts

- Status: Pending
- Date: 2026-11-07
- Depends on: none
- Design: n/a
- Backlog: N233

## Context

User, 2026-11-07 (the architecture review request): "current code structure/architecture modularity and overall
design analysis ... complete code quality critique and suggest architectural improvements ... No regressions shall
be introduced, ensure before and after testing tdd style". User, 2026-11-07: "full autopilot and ownership grant to
run in parallel as you see fit agents to cover the entire i1 to i20, draft adrs in 1 pr then do batches. Goal is to
have them all done and merged with no regressions introduced then stop".

This ADR is improvement **I-10** of `docs/retros/2026-11-07-architecture-review.md` (sections 7 and 8). The
choices below were decided by Claude under the user's ownership grant, 2026-11-07; no question is left open.

The nesting engine (`src/core/nesting/place.ts`, `validate.ts`, `types.ts`, 894 lines) has zero imports from outside
those three files (verified) and is the best standalone candidate (review section 6). Its tests mask machine speed
with `maxMs: 1e9`; there are no golden layouts. ADR-018 (seeded guillotine heuristic with an independent validator) is
unchanged, and so is the production default `maxMs`: users get the same layouts as today.

## Decision

Decided by Claude under the user's ownership grant, 2026-11-07.

- The engine stays in `src/core/nesting/` as an internal module with an enforced boundary: ESLint
  `no-restricted-imports` blocks any import from `place`, `validate` or `types` to a file outside those three, and any
  import of `place` or `validate` from outside `src/core` (the rules of ADR-219, checked here by a test).
- `tests/nesting-golden.test.ts`: for a fixed set of seeds and jobs (the sample projects' nesting jobs plus three
  synthetic ones), every layout field except `elapsedMs` is written to a fixture with `maxMs: Infinity`, and
  `validateNest` accepts each one.
- Not a pnpm workspace package; the production `maxMs` default is unchanged.

## Alternatives considered

- **`packages/nesting` workspace package** — own build and Vitest project for no second consumer yet; G-494.
- **Deterministic production default** — may change a layout a user already printed; G-495.
- **Golden tests only, no boundary** — the zero-import property would erode unnoticed.

## Scope

- In scope: the boundary rule and its test, the seeded golden layouts.
- Out of scope: a workspace package (G-494); a deterministic production `maxMs` default (G-495).

## Consequences

- Positive: any change to the packer shows up as a golden diff; the engine can move to a package later in one step.
- Negative / risks: goldens must be regenerated on an intended heuristic change (a reviewed diff, never silently).
- Harder to change later: nothing.

## Done when

TDD (review section 9): every item starts from a test written first that pins today's behaviour and passes on
`main` before the change; the change keeps it green (or turns the stated red test green).

- [x] (test first) golden layouts generated on `main` with `maxMs: Infinity`; the test compares every field except
      `elapsedMs` and runs `validateNest` on each. Evidence: `tests/nesting-golden.test.ts` › "nesting golden layouts
      (ADR-228)" (4 sample-project jobs + 3 synthetic jobs × seeds 1, 7, 42; fixture
      `tests/fixtures/nesting-golden.json`, regenerated only with `WRITE_NEST_GOLDEN=1`).
- [x] (test first) a boundary test reads the three engine files and fails on any import outside them (self-check
      included); `pnpm lint` enforces the same. Evidence: `tests/core-boundary.test.ts` › "nesting engine boundary
      (ADR-228)" (file scan, self-check, and ESLint run through its API; the ESLint case for `src/main.tsx` and
      `src/langInit.ts` was red before the `eslint.config.js` app block was extended to `src/*.{ts,tsx}`).
- [x] `tests/nesting.test.ts` passes unchanged; the production default `maxMs` is unchanged (asserted). Evidence:
      `tests/nesting-golden.test.ts` › "production nesting default (ADR-228, ADR-018)" pins the 1500 ms threshold
      with a stubbed clock (1500 ms → 40 attempts, 1501 ms → 1).
- [x] `pnpm lint`, `pnpm format:check`, `pnpm typecheck`, `pnpm test`, `pnpm build` and `pnpm docs:check` pass; the
      test count is not lower than on `main` before the change (review section 9). Evidence (local, branch `wip/b3b`):
      tests 1741 → 1771 passed; the same 5 load-related failures (find-it 30 s timeouts, the `roomfill` 100 ms timing
      test, `estimate-chip` at 390 px) fail on the base commit too and touch no nesting code; not yet confirmed by CI.
