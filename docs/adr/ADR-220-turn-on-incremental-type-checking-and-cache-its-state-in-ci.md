# ADR-220: Turn on incremental type-checking and cache its state in CI

- Status: Pending
- Date: 2026-11-07
- Depends on: ADR-197
- Design: n/a
- Backlog: N225

## Context

User, 2026-11-07 (the architecture review request): "current code structure/architecture modularity and overall
design analysis ... complete code quality critique and suggest architectural improvements ... No regressions shall
be introduced, ensure before and after testing tdd style". User, 2026-11-07: "full autopilot and ownership grant to
run in parallel as you see fit agents to cover the entire i1 to i20, draft adrs in 1 pr then do batches. Goal is to
have them all done and merged with no regressions introduced then stop".

This ADR is improvement **I-02** of `docs/retros/2026-11-07-architecture-review.md` (sections 7 and 8). The
choices below were decided by Claude under the user's ownership grant, 2026-11-07; no question is left open.

Most of I-02 is already on `main`: ADR-197 split CI into `ship-check`, `checks`, `test` (3 shards) and `build` jobs
behind one `verify` status, added the ESLint and Prettier caches, and made `deploy.yml` deploy only after CI passed;
ADR-201 added the core-only `--changed` test run. What remains from the review: `tsc -b` writes a 12 KB buildinfo
with no incremental state (`tsconfig.app.json` and `tsconfig.node.json` have no `"incremental": true`), so every
`pnpm typecheck` in CI and locally is a cold check (17 s measured).

## Decision

Decided by Claude under the user's ownership grant, 2026-11-07.

- `"incremental": true` in `tsconfig.app.json` and `tsconfig.node.json`; `tsBuildInfoFile` stays under
  `node_modules/.tmp/`, so `tsc -b` keeps its state between runs.
- In the `checks` job of `ci.yml`, `actions/cache/restore` and (on pushes to `main` only, like the lint cache)
  `actions/cache/save` of `node_modules/.tmp`, keyed on the lockfile, both tsconfigs and `github.sha`, with a
  restore key without the sha.
- No job, shard, check or command changes; `pnpm typecheck` stays the command in `CLAUDE.md`.

## Alternatives considered

- **Four shards instead of three** — ADR-197 already balanced the shards; not part of what remains.
- **`tsc --noEmit` without `-b`** — loses project references and does not keep state.
- **No CI cache, local incremental only** — CI is where the 17 s is paid on every run.

## Scope

- In scope: the two tsconfig flags, the `node_modules/.tmp` cache steps in `checks`.
- Out of scope: caching the Vite build output or Vitest results (G-486).

## Consequences

- Positive: a warm `pnpm typecheck` re-checks only changed files locally and in CI.
- Negative / risks: a stale buildinfo hiding an error. `tsc -b` re-checks every file whose inputs changed, and the cache
  key includes the lockfile and configs, so a version or config change starts cold.
- Harder to change later: nothing.

## Done when

TDD (review section 9): every item starts from a test written first that pins today's behaviour and passes on
`main` before the change; the change keeps it green (or turns the stated red test green).

- [ ] (test first) a Vitest test reads both tsconfigs and `ci.yml` and asserts `incremental: true` and the cache
      steps for `node_modules/.tmp` in `checks` (red before the change, green after).
- [ ] A second local `pnpm typecheck` after one edited file is faster than the first, and an introduced type error
      still fails it (checked by hand, timings in the backlog row).
- [ ] A CI run on the branch restores or saves the cache; its run id is cited in the backlog row.
- [ ] `pnpm lint`, `pnpm format:check`, `pnpm typecheck`, `pnpm test`, `pnpm build` and `pnpm docs:check` pass; the
      test count is not lower than on `main` before the change (review section 9).
