# ADR-201: Fix the failing and missing acceptance checks

- Status: Pending
- Date: 2026-11-06
- Depends on: ADR-008, ADR-064, ADR-093, ADR-108, ADR-122, ADR-168
- Design: n/a
- Backlog: N206
- Acceptance: browser

## Context

Eight gaps about acceptance checks that fail, retry, are missing or cost CI time. Requests, in the gaps' words:

- G-351: "Not a quote: found while running the browser find-it scripts for ADR-179" (move-3d fails at 1440 px).
- G-181: "Push, merge" (Move and Section sometimes ignore the first tap; the script taps again).
- G-347: "Not a quote: the suite is the source of truth (CLAUDE.md)" (accounts find-it is flaky at 390 px).
- G-016: "Errors block export (ADR-008) (context, not a quote)".
- G-095: "Run critique this design for the entire ui/ux; then 'Fix them directly'".
- G-346: "“ship ADR-168”" (connections in 3D Move mode never tried in a browser).
- G-370, G-368: "Suggest improvements. … Tests running by domain of change? … unnecessary overcovering tests?"

User accepted the gaps' suggested picks on 2026-11-06. No pick conflicts with an implemented ADR, needs a physical
fact (ADR-010) or touches saved designs. `ci.yml` already holds ADR-197's jobs and shards (built on `main`, ADR
still Pending); G-368 changes only its `test` job.

## Decision

1. **move-3d at 1440 px (G-351).** Debug it on `main` first (`debug` skill), then fix the cause. Code read: the
   script reads the turn from a `Turn` radiogroup the piece card no longer has (the typed "Rotation (°)" field is
   hidden, `TYPED_ROTATION`, `src/ui/Project.tsx:444`), so the check reads empty. If the turn really happens, read
   it from what the app shows (e.g. the plan piece's "W by D mm", if it follows the turn); if not, fix the app. Then trace the
   20 s canvas wait in `to3d()` the same way.
2. **Dropped first tap (G-181).** Trace and fix it in the app: the 3D toolbar (`src/viewer/Viewer3D.tsx`, Move and
   Section) after a touch drag and while the view re-renders. Then drop the `toggle` retry from
   `tools/research-batch-2/find-it.mjs` (one click per toggle). Root cause over retry: a user's tap is lost too.
3. **Accounts at 390 px (G-347).** The badge already uses `findByText` with 5 s
   (`tests/find-it/accounts.test.tsx:90`); raise that and the `.sync-status` wait to 15 s, under the 30 s test
   timeout. If it still fails, split the test after the badge.
4. **Blocked export (G-016).** Extend `tools/editor-modes/find-it.mjs` at its error step: the reason "This design
   has problems (see Checks). Fix them before cutting." shows (`src/ui/Output.tsx:149`), and the Shopping list's
   "Shopping list CSV" and "Print shopping list" are disabled with its "Fix the problems under Checks first" alert.
5. **Catalog counts (G-095).** A step in `tools/catalog-compact/find-it.mjs` at 390 and 1280 px opens "Start from"
   and compares "N ready items" (`src/ui/Catalog.tsx:236`) with the sum of the group counts. By type each item is
   in one group, so the sum must equal N; fix the app if it differs. By room a piece listed in several rooms counts
   under each (`groupFamilies`), so there the step checks the sum is at least N.
6. **Connections in 3D (G-346).** `tools/connections/find-it.mjs` adds one 3D Move drag of a connected piece (the
   set moves along, read from "From left" of both) and one Alt drag on desktop (only that piece moves), as
   `tools/move-3d/find-it.mjs` drags (mouse on desktop, CDP touch on a phone).
7. **Over-coverage (G-370).** In `tests/find-it/research-batch-4.test.tsx`, `connections.test.tsx` and
   `variables.test.tsx`, move model assertions to `tests/research-batch-4.test.ts`, `tests/connections.test.ts`
   and `tests/variables.test.ts` (where not already there) and keep one click path per file and width that finds
   every feature by visible text, ADR-179's front-view tick included. Delete `tests/rapier-trial.test.ts` (opt-in,
   always skipped; ADR-125's numbers stay in N126).
8. **Related tests on core-only pull requests (G-368).** `ship-check` gets a `core_only` output (every changed path
   is under `src/core/` or is docs-only), with matcher cases beside `scripts/test_ci_docs_only.py`. For those pull
   requests the `test` job runs `pnpm test --changed <base sha> --passWithNoTests --shard=N/3` (checkout with the
   base fetched); pushes to `main` and every other pull request run the full suite. Measure the files and time on
   one core-only pull request first; the find-it files import `App`, which imports `src/core`. If the saving is
   under 10 %, ask the user before keeping the change.

No UI text is added; a fix that adds text goes through `t()` with its Russian entry (ADR-153).

## Alternatives considered

- **Keep the retries and longer waits only** — hides a lost tap a user also meets (G-181, G-351).
- **Record the checks as jsdom find-it** — 3D, touch drags and print need Chromium (ADR-108).
- **Vitest `related` on each changed file** — the same module graph as `--changed`, more script.

## Scope

- In scope: the eight items above, their scripts, tests, the CI `test` job and N206.
- Out of scope: removing the Rapier devDependency once the trial test is gone (G-372); cheaper find-it mounts
  (G-371).

## Consequences

- Positive: every browser script passes without retries; export blocking and catalog counts are checked; core-only
  pull requests may run fewer tests.
- Negative / risks: three find-it files lose assertions (kept in core tests); `--changed` may save little.
- Harder to change later: nothing.

## Done when

- [ ] `tools/move-3d/find-it.mjs` passes at 1440 and 390 px on the production build; N206 names the cause (G-351).
- [ ] `tools/research-batch-2/find-it.mjs` passes at both widths with one click per toggle (G-181).
- [ ] `tests/find-it/accounts.test.tsx` passes in three consecutive full local `pnpm test` runs (G-347).
- [ ] `tools/editor-modes/find-it.mjs` finds the blocked reason and the disabled "Shopping list CSV" and "Print
      shopping list" at 390 and 1280 px (G-016).
- [ ] `tools/catalog-compact/find-it.mjs` checks "N ready items" against the group counts at 390 and 1280 px (G-095).
- [ ] `tools/connections/find-it.mjs` passes with the 3D Move drag and the desktop Alt drag (G-346).
- [ ] The three find-it files keep one click path each, their core tests hold the moved checks,
      `tests/rapier-trial.test.ts` is gone and `pnpm test` passes (G-370).
- [ ] A core-only pull request runs the `--changed` tests (CI run id and measured time in N206); `main` runs all
      (G-368).
