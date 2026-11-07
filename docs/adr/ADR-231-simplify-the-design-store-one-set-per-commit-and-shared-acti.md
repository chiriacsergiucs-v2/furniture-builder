# ADR-231: Simplify the design store: one set per commit and shared action helpers

- Status: Pending
- Date: 2026-11-07
- Depends on: ADR-226
- Design: n/a
- Backlog: N236

## Context

User, 2026-11-07 (the architecture review request): "current code structure/architecture modularity and overall
design analysis ... complete code quality critique and suggest architectural improvements ... No regressions shall
be introduced, ensure before and after testing tdd style". User, 2026-11-07: "full autopilot and ownership grant to
run in parallel as you see fit agents to cover the entire i1 to i20, draft adrs in 1 pr then do batches. Goal is to
have them all done and merged with no regressions introduced then stop".

This ADR is improvement **I-13** of `docs/retros/2026-11-07-architecture-review.md` (sections 7 and 8). The
choices below were decided by Claude under the user's ownership grant, 2026-11-07; no question is left open.

`src/store/designStore.ts` makes 2–5 `set()` calls per edit, each re-running every mounted selector (Zustand 5 does
not batch); `updateCabinet/Desk/PanelSet/Panel/Frame` are identical; 11 project actions are the same 4-line wrapper
around `get().project`; piece history is pushed in drill mode and never cleared; `closeProject` has no UI caller
(only tests). Depends on [ADR-226](ADR-226-route-backtoproject-and-setrunrequest-through-commitproject.md), which
settles `commitProject`'s shape first.

## Decision

Decided by Claude under the user's ownership grant, 2026-11-07.

- `commit` and `commitProject` collect their partial state and call `set()` once at the end.
- One `updateParams(kind, patch)` replaces the identical `update*` actions; the old names stay as one-line aliases
  only if a UI caller needs them, else callers move.
- A `projectAction(f, name?)` helper replaces the 4-line wrappers: it reads `get().project`, runs `f`, and commits
  only when `f(p) !== p`.
- Piece history is not pushed while drilling (`drillItemId && !editingItemId`).
- `closeProject` is removed (no UI caller); the tests that use it switch to the action that clears the project in the
  UI (the one the Projects page uses), or to `useDesign.setState` in setup.

## Alternatives considered

- **Slices (`projectSlice`, `selectionSlice`, `viewSlice`)** — larger file churn; kept as G-498.
- **Wire `closeProject` to a UI button** — a new feature nobody asked for.
- **Batch with `unstable_batchedUpdates`** — React-only and does not reduce selector runs.

## Scope

- In scope: single `set()`, `updateParams`, `projectAction`, drill history, `closeProject` removal.
- Out of scope: splitting the store into slices (G-498).

## Consequences

- Positive: selector passes per edit about −50 % (estimate); fewer copies to keep in step.
- Negative / risks: an action that relied on the state between two `set()` calls.
- Harder to change later: nothing.

## Done when

TDD (review section 9): every item starts from a test written first that pins today's behaviour and passes on
`main` before the change; the change keeps it green (or turns the stated red test green).

- [ ] (test first) subscription counter: one `updateCabinet` (via `updateParams`) in drill mode notifies subscribers
      once (red before: 2 or more).
- [ ] (test first) table-driven: each `projectAction` wrapper is a no-op (no history entry) when `f(p) === p`.
- [ ] (test first) drilling into a piece and editing pushes no piece-history entry; undo still works after leaving.
- [ ] `closeProject` is gone; the five tests that used it pass with their replacement.
- [ ] Every existing store test passes unchanged.
- [ ] `pnpm lint`, `pnpm format:check`, `pnpm typecheck`, `pnpm test`, `pnpm build` and `pnpm docs:check` pass; the
      test count is not lower than on `main` before the change (review section 9).
