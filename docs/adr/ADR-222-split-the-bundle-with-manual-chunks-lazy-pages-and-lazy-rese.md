# ADR-222: Split the bundle with manual chunks, lazy pages and lazy research data

- Status: Pending
- Date: 2026-11-07
- Depends on: none
- Design: n/a
- Backlog: N227

## Context

User, 2026-11-07 (the architecture review request): "current code structure/architecture modularity and overall
design analysis ... complete code quality critique and suggest architectural improvements ... No regressions shall
be introduced, ensure before and after testing tdd style". User, 2026-11-07: "full autopilot and ownership grant to
run in parallel as you see fit agents to cover the entire i1 to i20, draft adrs in 1 pr then do batches. Goal is to
have them all done and merged with no regressions introduced then stop".

This ADR is improvement **I-04** of `docs/retros/2026-11-07-architecture-review.md` (sections 7 and 8). The
choices below were decided by Claude under the user's ownership grant, 2026-11-07; no question is left open.

The `index` chunk is 2 376 KB raw / 708 KB gzip (review section 1). `three` is a separate chunk only by accident of
`React.lazy(Viewer3D)`; the Research, Gaps, Info, Catalog, Account and Share pages and 6 053 lines of research data
plus a 92 KB markdown (`?raw`) ship in `index` to every user on every load. Estimate: `index` gzip → ≈ 450 KB.
ADR-002 holds: every chunk stays in the precache. The review's generated JSON for research data changes a data layout
(ADR-043 lineage); it is not chosen.

## Decision

Decided by Claude under the user's ownership grant, 2026-11-07.

- `build.rollupOptions.output.manualChunks` in `vite.config.ts`: `three`, `@react-three/*`, `dexie`, `@supabase/*`
  each in a named chunk.
- `React.lazy` with a `Suspense` fallback for the Research, Gaps, Info, Catalog, Account and Share pages, as
  `Viewer3D` is today.
- Research data (`src/core/research/*` and its `?raw` markdown) reached only through a dynamic `import()` from
  `researchStore` and the Research page, so it becomes a lazy chunk. No generated JSON, no data-layout change.
- `tests/bundle-boundary.test.ts` reads `dist/assets` after `pnpm build`: `index-*.js` contains no `WebGLRenderer`,
  no `createClient` and no `"ens-2026-10-23"`, and stays under a byte budget (measured size + 2 %). When `dist` is
  absent it skips with the message "run pnpm build first"; the CI `build` job runs it after `pnpm build:ci`.

## Alternatives considered

- **Generated `public/research/*.json`** — same saving, but a data-layout change and a generator; kept as G-488.
- **Leave chunking to Rollup** — `three` stays split only by accident; any static import undoes it.
- **Lazy pages only** — leaves the research data, the largest part, in `index`.

## Scope

- In scope: manual chunks, six lazy pages, dynamic research import, the bundle test and its CI step.
- Out of scope: research data as a generated JSON file (G-488).

## Consequences

- Positive: first-paint JavaScript about −35 % (estimate); the bundle test stops regressions.
- Negative / risks: a page missing its fallback; the research page reading before its chunk loads (a loading state).
- Harder to change later: nothing; the budget is a number in one test.

## Done when

TDD (review section 9): every item starts from a test written first that pins today's behaviour and passes on
`main` before the change; the change keeps it green (or turns the stated red test green).

- [x] (test first) `tests/bundle-boundary.test.ts` written against today's `dist` with today's figures (red for the
      `WebGLRenderer` and `"ens-2026-10-23"` assertions), green after; it skips with its message without `dist`.
      Evidence: `ADR-222 bundle boundary > reads dist/assets` red before (research data in index; `WebGLRenderer` was
      already absent from `index` on main), green after; without `dist` it reports `skipped: run pnpm build first`.
- [x] (test first) jsdom find-it `tests/find-it/lazy-pages.test.tsx` at 390 and 1280 px reaches the Research, Gaps,
      Info, Catalog, Account and Share pages from the bare app by role and visible text, through the fallback.
- [x] The research tests (`research-built-rows`, `i18n-research*`) pass unchanged.
- [x] `pnpm build` lists the named chunks; `index` gzip size before and after recorded in the backlog row.
- [x] The CI `build` job runs the bundle test after the build.
- [x] `pnpm lint`, `pnpm format:check`, `pnpm typecheck`, `pnpm test`, `pnpm build` and `pnpm docs:check` pass; the
      test count is not lower than on `main` before the change (review section 9).
