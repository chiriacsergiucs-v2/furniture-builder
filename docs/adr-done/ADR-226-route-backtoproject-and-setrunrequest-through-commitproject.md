# ADR-226: Route backToProject and setRunRequest through commitProject

- Status: Implemented
- Date: 2026-11-07
- Implemented: 2026-11-07
- Depends on: none
- Design: n/a
- Backlog: N231

## Context

User, 2026-11-07 (the architecture review request): "current code structure/architecture modularity and overall
design analysis ... complete code quality critique and suggest architectural improvements ... No regressions shall
be introduced, ensure before and after testing tdd style". User, 2026-11-07: "full autopilot and ownership grant to
run in parallel as you see fit agents to cover the entire i1 to i20, draft adrs in 1 pr then do batches. Goal is to
have them all done and merged with no regressions introduced then stop".

This ADR is improvement **I-08** of `docs/retros/2026-11-07-architecture-review.md` (sections 7 and 8). The
choices below were decided by Claude under the user's ownership grant, 2026-11-07; no question is left open.

Verified by the review: `backToProject` in `src/store/designStore.ts` runs `propagateLinks → resolvePlacements →
refreshRunParts` and skips the rest of `commitProject`: `syncRef`, `sizeLockBlocked`, `syncSets`, `applyBindings`,
`heldByBinding`, the four prunes, the `schemaVersion` stamp and `keepSelected`. What escapes is a size-locked linked
copy rewritten by `propagateLinks`, a bound field edited without `applyBindings`, value-set duplicates and stale
`ref.overrides`. `setRunRequest` re-implements run planning the same way. A correctness fix; no new UI text.

## Decision

Decided by Claude under the user's ownership grant, 2026-11-07.

- `commitProject(next, name?, opts?)` gains `opts.base?: Project`: the project the history entry and the refusal
  checks compare against (default: the current project, as today).
- `backToProject` builds the edited project and calls `commitProject(next, name, { base: projectBeforeEdit })`, where
  `projectBeforeEdit` is the project when the piece editor opened; one history entry, as today.
- `setRunRequest` computes its next project and calls `commitProject` instead of its own steps.
- A refusal (size lock, binding) behaves as it does for `updateItem`: same notice, project unchanged.

## Alternatives considered

- **Copy the missing steps into `backToProject`** — a third copy of the pipeline to keep in step.
- **Leave it** — the escapes above stay reachable from the piece editor.
- **Make the piece editor edit the project directly** — a larger change to drill mode and undo.

## Scope

- In scope: `commitProject`'s `base` option, `backToProject`, `setRunRequest`, their tests.

## Consequences

- Positive: one commit pipeline; bindings, size locks, sets and prunes hold after the piece editor too.
- Negative / risks: a refusal notice where the old path silently accepted (the intended fix).
- Harder to change later: nothing.

## Done when

TDD (review section 9): every item starts from a test written first that pins today's behaviour and passes on
`main` before the change; the change keeps it green (or turns the stated red test green).

- [x] (test first) store test: edit a bound size in the piece editor, `backToProject`, the binding is reapplied
      (red before, green after). Evidence: `tests/back-to-project-commit.test.ts` › "a bound size edited in the piece
      editor takes its variable again on Back to project".
- [x] (test first) store test: a size-locked linked copy rewritten through the piece editor is refused with the same
      notice `updateItem` gives (red before). Evidence: `tests/back-to-project-commit.test.ts` › "a size-locked linked
      copy rewritten through the piece editor is refused with the notice Update gives".
- [x] (test first) store test: `setRunRequest` result equals `commitProject` of the same next project (sets synced,
      prunes applied, `schemaVersion` stamped). Evidence: `tests/back-to-project-commit.test.ts` › "setRunRequest
      equals the project commit of the same next project" (green before: `setRunRequest` already ended in
      `commitProject`; its own `schemaVersion` stamp was dropped as redundant).
- [x] `tests/project-undo.test.ts`, `linked.test.ts` and `place-and-undo.test.ts` pass unchanged; one undo step still
      reverts a whole piece-editor session. Evidence: those files unchanged and green;
      `tests/back-to-project-commit.test.ts` › "one undo step still reverts a whole piece-editor session".
- [x] `pnpm lint`, `pnpm format:check`, `pnpm typecheck`, `pnpm test`, `pnpm build` and `pnpm docs:check` pass; the
      test count is not lower than on `main` before the change (review section 9). Evidence: CI run 42350405704 (PR #198) green on every job.
