# ADR-234: Keep offline before first use and put a budget on the precache

- Status: Pending
- Date: 2026-11-07
- Depends on: ADR-222
- Design: n/a
- Backlog: N239

## Context

User, 2026-11-07 (the architecture review request): "current code structure/architecture modularity and overall
design analysis ... complete code quality critique and suggest architectural improvements ... No regressions shall
be introduced, ensure before and after testing tdd style". User, 2026-11-07: "full autopilot and ownership grant to
run in parallel as you see fit agents to cover the entire i1 to i20, draft adrs in 1 pr then do batches. Goal is to
have them all done and merged with no regressions introduced then stop".

This ADR is improvement **I-16** of `docs/retros/2026-11-07-architecture-review.md` (sections 7 and 8). The
choices below were decided by Claude under the user's ownership grant, 2026-11-07; no question is left open.

The service worker precaches 146 entries, 7.28 MB (review section 1), 2.7 MB of it the seller catalog that only the
product picker loads, plus the path tracer. The review offered precaching the shell only. ADR-002 (offline core) and
ADR-161 (the seller catalog is "an offline snapshot") promise that features work offline, and the app is used in
workshops without signal, so offline before first use is kept: the precache list does not change. What is missing is
a guard so the precache only grows on purpose. Depends on
[ADR-222](ADR-222-split-the-bundle-with-manual-chunks-lazy-pages-and-lazy-rese.md), whose chunk names it checks.

## Decision

Decided by Claude under the user's ownership grant, 2026-11-07.

- Keep offline before first use: `vite.config.ts` `globPatterns` and `maximumFileSizeToCacheInBytes` unchanged.
- `tests/precache.test.ts` parses the precache manifest in `dist/sw.js` after `pnpm build` and asserts:
  `index.html`, the `index` chunk and the CSS are listed; the seller catalog chunk (`regency-*`) is listed; the viewer
  chunks (`Viewer3D-*`, `three`, `@react-three` from ADR-222) are listed; the total of listed sizes is under a budget
  of the size measured when this ADR is built + 10 %, written in the test as a number with the date.
- Without `dist` the test skips with the message "run pnpm build first"; the CI `build` job runs it.

## Alternatives considered

- **Precache the shell, runtime-cache the rest** — first visit −40 %, but the picker and 3D view are empty offline
  until opened once online; kept as G-499.
- **No test** — the precache grows with every chunk and nobody notices until the first visit is slow.
- **A per-file budget** — brittle against legitimate chunk splits; the total is what a first visit pays.

## Scope

- In scope: the precache test and its CI step; no change to what is precached.
- Out of scope: precaching the shell only and caching feature chunks on first use (G-499).

## Consequences

- Positive: offline before first use is now a tested promise; growth past the budget fails CI and asks for a decision.
- Negative / risks: the first visit stays ≈ 7.3 MB.
- Harder to change later: raising the budget is a reviewed one-line change.

## Done when

TDD (review section 9): every item starts from a test written first that pins today's behaviour and passes on
`main` before the change; the change keeps it green (or turns the stated red test green).

- [x] (test first) `tests/precache.test.ts` written against today's build: the shell, `regency-*` and the viewer
      chunks are listed, total under the budget; green before and after ADR-222's chunk names land. Evidence: green on
      the main build (150 entries, 8 630 852 bytes) and on the ADR-222 build (160 entries, 8 625 254 bytes); the
      `react-three-*` check was added with ADR-222's chunk name.
- [x] Removing `js` from `globPatterns` makes the test fail (checked by hand, reverted).
- [x] The CI `build` job runs the test after `pnpm build:ci`; the measured total is in the backlog row.
- [x] `pnpm lint`, `pnpm format:check`, `pnpm typecheck`, `pnpm test`, `pnpm build` and `pnpm docs:check` pass; the
      test count is not lower than on `main` before the change (review section 9).
