# ADR-272: Repair browser find-it scripts, batch 1 of 7

- Status: Implemented
- Date: 2026-11-16
- Implemented: 2026-11-16 (Find-it batch repaired; evidence in backlog N304)
- Depends on: none
- Design: n/a
- Backlog: N304
- Acceptance: browser

## Context

`pnpm regress` ([N289](../backlog.md)) ran every browser acceptance script on the production build on 2026-11-16. The
baseline run at `--jobs=1` passed 45 of 77 scripts; the scripts below failed or timed out in it, and again in a second
run at `--jobs=6` (or, for the ones that were not in the baseline, again when re-run alone at `--jobs=1`). Runs at
`--jobs=6` produce extra load failures, so only `--jobs=1` results count as evidence.

The user asked: "For all failures, no skipping, all, create a fixing plan of batches of adrs" and then "Create adrs group
by 6 per adr all adrs created in 1 pr, merged". The seven ADRs of this plan (38 failing scripts, 6 per ADR) are
independent of each other and share one pull request (an exception to one ADR, one pull request, approved by the user).
Causes are not triaged yet; nothing below says whether the app or the script is wrong.

This batch, with the first failing check printed in the `--jobs=6` run:

| Script                              | First failing check                                                  |
| ----------------------------------- | -------------------------------------------------------------------- |
| `tools/arrange/find-it.mjs`         | locator.scrollIntoViewIfNeeded: Timeout 30000ms exceeded.            |
| `tools/catalog-compact/find-it.mjs` | 1280px Catalog page under 15000 px tall — 15128 px                   |
| `tools/catch-up/find-it.mjs`        | locator.click: Timeout 30000ms exceeded.                             |
| `tools/clearances/find-it.mjs`      | 1440px the selected desk has "Clearance zones" › "Chair space depth" |
| `tools/count-stepper/find-it.mjs`   | locator.waitFor: Timeout 20000ms exceeded.                           |
| `tools/critique-bugs/find-it.mjs`   | 390px the wizard Name input ≥ 44 px tall under touch — not found     |

## Decision

For each of the 6 scripts, find the cause from `regress-report/<script>.log`, then fix it where it lives:

- If the app is wrong, fix the app and keep the script's check.
- If the script is stale (it looks for text or layout that a later ADR changed on purpose), update the script to the
  current visible text and keep the same requirement it proves.
- A script is retired only when its every check is already proven by a jsdom find-it test (`tests/find-it/`, ADR-108);
  the ADR then names that test. No script is dropped to make the list shorter (R2).
- A fix that touches `src/core/types.ts`, the design document, the Dexie schema or the network boundary stops and gets
  its own ADR first.

Each script is verified alone with `pnpm regress <script-dir>/ --no-build` at `--jobs=1` on a fresh `pnpm build:ci`.

## Alternatives considered

- **Retire every failing script** — loses the real-browser coverage the user asked for (R2).
- **One ADR for all 38 scripts** — the user asked for 6 per ADR; one batch also cannot be built or reviewed alone.
- **Group by area instead of alphabetically** — causes are not triaged, so an area grouping would be a guess; batches can be regrouped once the causes are known.

## Scope

- In scope: `arrange`, `catalog-compact`, `catch-up`, `clearances`, `count-stepper`, `critique-bugs`.
- Out of scope: the other 32 failing scripts (the sibling ADRs of this plan); making `pnpm regress` part of CI (user: local on request only, N289); a flaky-script retry (a script that fails only under load is reported, not retried).

## Consequences

- Positive: each script gives a pass/fail that can be trusted again; failures that are real app bugs get found and fixed.
- Negative / risks: some failures may be real regressions from recent ADRs, so a fix can touch app code; scripts take 5 s to 100 s each, so the check takes minutes.
- Harder to change later: a retired script cannot be brought back without rewriting it.

## Done when

- [x] `pnpm regress tools/arrange/ --no-build` at `--jobs=1` passes, or the script is retired with the jsdom test that proves it named in the backlog row
- [x] `pnpm regress tools/catalog-compact/ --no-build` at `--jobs=1` passes, or the script is retired with the jsdom test that proves it named in the backlog row
- [x] `pnpm regress tools/catch-up/ --no-build` at `--jobs=1` passes, or the script is retired with the jsdom test that proves it named in the backlog row
- [x] `pnpm regress tools/clearances/ --no-build` at `--jobs=1` passes, or the script is retired with the jsdom test that proves it named in the backlog row
- [x] `pnpm regress tools/count-stepper/ --no-build` at `--jobs=1` passes, or the script is retired with the jsdom test that proves it named in the backlog row
- [x] `pnpm regress tools/critique-bugs/ --no-build` at `--jobs=1` passes, or the script is retired with the jsdom test that proves it named in the backlog row
- [x] `pnpm typecheck`, `pnpm build` and `pnpm docs:check` exit 0
