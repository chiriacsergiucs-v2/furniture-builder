# ADR-197: Speed up CI: parallel jobs, test shards, docs-only runs, caches and a deploy that waits on CI

- Status: Implemented
- Date: 2026-11-05
- Implemented: 2026-11-06 (Built and merged before shipping; CI run 42126747931 and Deploy run 42127180665 verified 2026-11-06)
- Depends on: none
- Design: n/a
- Backlog: N202

## Context

User 2026-11-05: "Suggest improvements. Triggering less often the ci optimisations? Tests running by domain of
change? Do all parts of the app need tests? Gaps/features/docs/unnecessary overcovering tests?", then, choosing from
the suggestions: "all of these 4 + Suggestions A(all) and B(all)". This ADR covers the workflows; the
cheaper find-it runs were a second unit, stopped by the user before it was built (G-371).

Baseline, CI run 42105129310 (main, 2026-11-05): 3 min 15 s wall. The one `verify` job took 182 s: setup 7 s,
checkout 3 s, lint 16 s, format:check 14 s, typecheck 12 s, test 106 s (143 files, 1169 passed, 1 skipped), build
22 s (`tsc -b && vite build`, so tsc ran twice), docs:check 1 s. Every merge ran the whole suite three times: CI on
the pull request, CI on the push to main, and `deploy.yml` (lint, typecheck and test again).

## Decision

The user's answers (2026-11-05, interactive), which are the approval:

1. **Deploy waits on CI.** `deploy.yml` starts on `workflow_run` of CI (completed, branch main) and builds only when
   that run succeeded on a push; it runs `pnpm build:ci` and publishes, with no lint, typecheck or test. It checks
   out the commit CI verified (`workflow_run.head_sha`). CI runs on main finish in any order, so a `latest` job
   deploys only the run for main's newest commit (an older run would put an older tree back on the site).
   `workflow_dispatch` stays, for main only.
2. **Parallel jobs and 3 test shards.** CI runs `checks` (lint, format:check, typecheck, docs:check), `test` as a
   matrix of 3 (`pnpm test --shard=N/3`) and `build`, side by side. A last job named `verify` needs them all and
   fails unless each passed, so the check name that merge rules and the babysit skill wait on is unchanged.
3. **Docs-only runs.** The `ship-check` job lists the changed files (GitHub compare API, no new action) and sets
   `docs_only` when every file is one of: `docs/adr/ADR-*.md`, `docs/adr/README.md`, `docs/adr/_template.md`,
   `docs/backlog.md`, `docs/retros/**`, `docs/product/**`, `docs/architecture.md`, `docs/ui-design.md`,
   `CLAUDE.md`, `.claude/**`. Then only format:check and docs:check run. Anything else gets the full run,
   including `docs/adr/GAPS.md` and `docs/research/**` (bundled into the app), `docs/catalog.md` and
   `docs/samples/**` (read by tests), `docs/adr-done/**`, and any deleted or renamed file (the sync-pending test
   reads the file names in `docs/adr`); so do 300 or more files and an API error. Docs-only applies to pull
   requests only: a push to main always gets the full run, because its deploy builds the whole tree, which may
   hold an earlier commit whose own CI is still running (found in review). The `Ship ADR-` skip is unchanged.
4. **Prettier cache, full scope.** `format:check` is `prettier --check --cache --cache-strategy content .`; the
   checked files do not change.
5. **tsc once.** New script `build:ci` = `vite build`, used by CI and the deploy; type errors are caught by
   `pnpm typecheck`. Local `pnpm build` keeps `tsc -b && vite build`.
6. **Cancel stale pull request runs.** A newer push to a pull request cancels its older CI run. Runs on main are
   never cancelled: each main commit has its own concurrency group, because a group per ref would still replace a
   queued main run, and the deploy waits on each one.
7. **Lint and Prettier caches between runs.** `lint` is `eslint . --cache --cache-strategy content`; `.eslintcache`
   and `node_modules/.cache/prettier` are restored in `checks` by `actions/cache` (keyed on the lockfile and the
   ESLint and Prettier configs) and saved only by runs on main, so pull requests do not fill the cache store. The content strategy is needed because a fresh checkout gives every file a
   new modification time, which the default metadata strategy would treat as changed.

## Alternatives considered

- **Keep one job and only add caches** — saves about 25 s of 182 s; the tests (106 s) stay serial.
- **A path-filter action for docs-only** — a new third-party dependency; the compare API in `ship-check` does it.
- **Narrow Prettier to source files** — rejected by the user: full scope stays.
- **Deploy on push and keep its own checks** — runs the suite a third time per merge.

## Scope

- In scope: `.github/workflows/ci.yml`, `.github/workflows/deploy.yml`, `package.json` scripts, `.gitignore`
  (`.eslintcache`), `scripts/test_ci_docs_only.py` (runs the matcher text from `ci.yml`, and fails when code
  reads a docs-only file), the deploy wording in the `ff` and `babysit` skills, and a 5 s wait for the
  account badge in `tests/find-it/accounts.test.tsx` (the status reads "In your account" before the first sync, so
  only the badge marks the sync done; under a test shard it took more than the default 1 s).
- Out of scope (left out by the user's pick, ADR-082): tests by domain of change (G-368), dropping the push-to-main
  CI run (G-369), the find-it over-coverage review (G-370); cheaper find-it runs were stopped by the user (G-371).

## Consequences

- Positive: wall time is the slowest shard plus setup instead of the sum of all steps; docs-only pull requests
  finish in seconds (main still runs everything); each merge runs the tests twice (pull request and main), not three times.
- Negative / risks: four runners per run instead of one; a shard can be slower than a third when slow files land
  together. The deploy now depends on the CI workflow's name `CI`; renaming it stops deploys. A
  failed or flaky main run deploys nothing until it is re-run (a re-run that passes deploys).
- Harder to change later: the docs-only list must grow whenever the app or tests start reading another doc.

## Done when

- [x] `pnpm lint` and `pnpm format:check` use their caches (second local run faster; `.eslintcache` ignored by git)
- [x] `pnpm build:ci` builds; `pnpm build` is unchanged
- [x] The three shards together run every test file once (passed counts add up to the unsharded run)
- [x] `scripts/test_ci_docs_only.py` (run by `pnpm docs:check`) passes: docs-only and full-run fixture lists
- [x] The pull request's CI run shows `checks`, `test (1)`, `test (2)`, `test (3)`, `build` and `verify` green,
      with its wall time compared to the 3 min 15 s baseline (run id in N197)
- [x] After merge: the push-to-main CI run triggers `Deploy GitHub Pages` through `workflow_run`, which builds
      and publishes without lint, typecheck or test (not verifiable before the merge; run id in N197)

## Shipping evidence (2026-11-06)

Executed on main `dca2ad8`: `pnpm lint` 90 s cold, 3 s cached; `pnpm format:check` 13 s, then 8 s; `.eslintcache` in
`.gitignore`; `pnpm build:ci` builds, and `pnpm build` is still `tsc -b && vite build`. Shards 1/2/3: 50 + 50 + 50 test
files (150 in `tests/`), 359 + 457 + 388 = 1,204 passed, 1 skipped, which matches the 1,204 + 1 of the unsharded
run reported on PR #169. `scripts/test_ci_docs_only.py`: 4 tests pass, also inside `pnpm docs:check`.
Read from GitHub: PR #169 CI run 42126747931 had `ship-check`, `checks` (31 s), `test (1)` (69 s), `test (2)`
(64 s), `test (3)` (71 s), `build` (23 s) and `verify` all green. Wall time was 1 min 24 s against the 3 min 15 s
baseline. `Deploy GitHub Pages` run 42127180665 ran with event `workflow_run` on head `353108e`, after the CI on
main, and succeeded.
