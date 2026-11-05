# ADR-198: Run CI once per change: skip a main rerun of a green tree, reuse its build, split checks, cheaper find-it runs

- Status: Pending
- Date: 2026-11-05
- Depends on: ADR-197
- Design: n/a
- Backlog: N203

## Context

The user's request (2026-11-05): "Analyze the full ci run. Split into steps and %of time. Highlight most time consuming.
Suggest improvements." After [ADR-197](ADR-197-speed-up-ci-parallel-jobs-test-shards-docs-only-runs-caches.md)
(PR #167) the user asked: "Which of the following was not done in adr 192 and is not covered in adr 193? Write 1 adr
which would cover all left items." (ADR-192 there means the CI work renumbered to ADR-197; the find-it ADR planned as
ADR-193 was stopped before it was written, gap G-371.)

Left after ADR-197, from the ranked hot spots and suggestions A and B:

1. **find-it mounts**: 88 % of test CPU (192 of 217 s, run 42105129310), 8 % of tests. Not built (G-371).
2. **Double runs**: every merge runs the full CI on the pull request and again on the push to main (G-369).
3. **Deploy rebuilds** instead of reusing CI's build (suggestion A, "reuse the dist artifact").
4. **Checks job serial**: lint 22 s, format:check 20 s, typecheck 16 s in one job; at 70 s it is the slowest job
   of CI run 42116230821 (1m25s wall). The ESLint and Prettier caches were cold on that run.

Done by ADR-197 and not repeated here: deploy waits on CI, stale pull request runs cancelled, docs-only pull request
runs, `build:ci` without the second tsc, parallel checks/test/build jobs, ESLint and Prettier caches, 3 test shards.

## Decision

User answers 2026-11-05 (interactive):

- **Main rerun of a green tree:** on a push to main, `ship-check` looks up the pull request merged by that commit. If
  main's tree equals that pull request head's tree and the CI run for that head concluded `success`, `test` and `build`
  are skipped and `verify` still passes, so the deploy starts. Anything else gets the full run: ff pushes, a
  cancelled or failed pull request run (as on PR #167), a tree that differs, or an API error.
- **Reuse CI's build:** the CI `build` job on a push to main builds with the deploy's public Supabase variables and
  uploads `dist` as an artifact. The deploy downloads it from the triggering CI run and builds itself only when no
  artifact exists (a skipped main build above, or a manual run).
- **Split checks:** three parallel jobs: lint, format:check plus docs:check, typecheck. Docs-only pull requests run
  only the format/docs job. `verify` needs all of them.
- **find-it:** measure first; try (a) `userEvent.setup({ delay: null })`, (b) find-it as its own vitest project with
  jsdom and `isolate: false`, (c) a cheaper module reset found while profiling. Keep a lever only if it cuts find-it
  CPU by 10 % or more and every test still starts from the bare app (fresh modules, IndexedDB, localStorage, URL `/`).
  ADR-108 acceptance is unchanged. The ADR records a before/after table per lever.

## Alternatives considered

- **Keep both runs (G-369 as was)** — not chosen: half the CI minutes per merge re-verify an identical tree.
- **Require up-to-date pull request branches** — not chosen: a manual repo setting and a rebase before every merge.
- **Keep rebuilding in the deploy** — not chosen: about 25 s of runner time per merge for an identical build.
- **One checks job, rely on warm caches** — not chosen: the job stays the critical path.
- **Mount the app once per find-it file** — rejected earlier: 31 of 37 files hold one test per width.

## Scope

- In scope: `.github/workflows/ci.yml`, `.github/workflows/deploy.yml`, `tests/find-it/setup.tsx`, the `test` block
  of `vite.config.ts`, `scripts/` tests for any new shell matcher, `.claude/skills/babysit` and `ff` text if job
  names change. Takes over G-369 and G-371.
- Out of scope: tests selected by domain of change (G-368); moving logic out of find-it tests (G-370); any change to
  app code in `src/`.

## Consequences

- Positive: one full test run per merged pull request; deploy publishes exactly the bytes CI built; CI wall time
  bounded by the slowest test shard; less find-it CPU.
- Negative / risks: the tree comparison must never skip a tree that was not verified; it falls back to the full run
  on any doubt. Three more runner setups (~8 s each) per run.
- Harder to change later: the deploy depends on the CI artifact name.

## Done when

- [ ] A push to main whose tree equals a green pull request head skips test and build, `verify` passes, and the deploy
      runs (CI and deploy run ids cited).
- [ ] An ff push, a differing tree and a cancelled pull request run each get the full run (matcher tested in
      `scripts/`, plus one real run id).
- [ ] The deploy uses the CI `dist` artifact when present and builds only without one (run ids for both paths).
- [ ] Lint, format/docs and typecheck run as parallel jobs; `verify` needs them; wall time and per-job times cited.
- [ ] Warm-cache lint and format:check times measured on a main run and recorded here.
- [ ] find-it before/after table per lever; kept levers cut find-it CPU ≥10 % each; 1169 passed, 1 skipped, 143 files.
- [ ] `pnpm docs:check`, `pnpm format:check` and the full CI pass.
