# ADR-236: Housekeeping: dead code, misplaced modules, type cycle and store locations

- Status: Pending
- Date: 2026-11-07
- Depends on: none
- Design: n/a
- Backlog: N241

## Context

User, 2026-11-07 (the architecture review request): "current code structure/architecture modularity and overall
design analysis ... complete code quality critique and suggest architectural improvements ... No regressions shall
be introduced, ensure before and after testing tdd style". User, 2026-11-07: "full autopilot and ownership grant to
run in parallel as you see fit agents to cover the entire i1 to i20, draft adrs in 1 pr then do batches. Goal is to
have them all done and merged with no regressions introduced then stop".

This ADR is improvement **I-18** of `docs/retros/2026-11-07-architecture-review.md` (sections 7 and 8). The
choices below were decided by Claude under the user's ownership grant, 2026-11-07; no question is left open.

Housekeeping found by the review (sections 2 and 3): `wallCount` in `src/core/room.ts` has zero references; about
117 exports in the largest core modules are unused outside their own file; `src/core/features.ts` (the feature tree,
ADR-158) is imported only by `src/ui/Info.tsx`; `src/core/samples/mobila.ts` only by tests; `shopping ↔ fasteners/prices`
is a type cycle; `CLAUDE.md` lists ADR-085 and ADR-093 as the only viewer edit exceptions while the code also edits in
the viewer for ADR-102, ADR-122, ADR-146 and ADR-169; six Zustand stores live in `src/ui`.

## Decision

Decided by Claude under the user's ownership grant, 2026-11-07.

- Delete `wallCount`. Drop `export` from symbols with no importer outside their file (found by a script run once,
  list in the commit); a symbol used by a test keeps its export.
- Move `src/core/features.ts` to `src/ui/info/features.ts` (ADR-158's rule "a new feature adds its line" now points
  there: `CLAUDE.md` and the skills updated). Move `src/core/samples/mobila.ts` to `tests/fixtures/mobila.ts`.
- `src/core/shopping-types.ts` holds the types `fasteners` and `prices` need, breaking the cycle.
- `CLAUDE.md` ADR-014 exception list adds ADR-102, ADR-122, ADR-146 and ADR-169.
- The six stores (`priceStore`, `problemStore`, the `Fasteners` and `Confirm` stores, `shell/uiStore`, `pieceDrag`)
  move to `src/store/`; their components import them.

## Alternatives considered

- **Delete unused exports' code too** — some are used inside their file; only the `export` is unnecessary.
- **Keep `features.ts` in core** — it is UI content with a `Key` type, read only by the Info page.
- **Leave the stores in ui** — the store layer stays split across two folders.

## Scope

- In scope: the items above, no behaviour change.
- Out of scope: splitting `App.tsx` and memoising heavy children (G-500); breaking import cycles beyond the shopping
  types (G-485).

## Consequences

- Positive: a smaller public surface; files live where their layer is.
- Negative / risks: a moved path missed by a doc or a skill (`pnpm docs:check` and `rg` catch it).
- Harder to change later: nothing.

## Done when

TDD (review section 9): every item starts from a test written first that pins today's behaviour and passes on
`main` before the change; the change keeps it green (or turns the stated red test green).

- [x] (test first) a test that imports the feature tree and the six stores from their new paths and asserts their
      shape (red before the move, green after); every existing test passes with updated imports. Evidence:
      `tests/store-locations.test.ts` › "the six stores import from src/store with their state and actions", "the feature
      tree imports from src/ui/info" (red before: the modules did not resolve).
- [x] `rg wallCount src` is empty; the type cycle is gone (a scan of `shopping`, `fasteners`, `prices` imports).
      Evidence: `tests/store-locations.test.ts` › "no sample generator and no wallCount under src", "shopping, fasteners
      and prices do not import each other in a cycle".
- [x] No `samples/mobila` under `src`; `CLAUDE.md` names `src/ui/info/features.ts` and the four viewer exceptions.
      Evidence: `tests/store-locations.test.ts` › "no sample generator and no wallCount under src"; `CLAUDE.md` diff.
- [x] `tests/core-boundary.test.ts` (ADR-219) passes; no Zustand `create(` remains under `src/ui`. Evidence:
      `tests/core-boundary.test.ts`, `tests/store-locations.test.ts` › "no Zustand store is created under src/ui".
- [x] `pnpm lint`, `pnpm format:check`, `pnpm typecheck`, `pnpm test`, `pnpm build` and `pnpm docs:check` pass; the
      test count is not lower than on `main` before the change (review section 9).
      Evidence (ran 2026-11-07, local, branch `wip/b1a` at the ADR-220 commit): all six pass; `pnpm test` 1725 passed /
      0 failed (195 files), up from 1714 tests (192 files) before ADR-236.
