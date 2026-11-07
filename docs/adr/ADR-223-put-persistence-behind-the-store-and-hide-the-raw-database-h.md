# ADR-223: Put persistence behind the store and hide the raw database handle

- Status: Pending
- Date: 2026-11-07
- Depends on: none
- Design: n/a
- Backlog: N228

## Context

User, 2026-11-07 (the architecture review request): "current code structure/architecture modularity and overall
design analysis ... complete code quality critique and suggest architectural improvements ... No regressions shall
be introduced, ensure before and after testing tdd style". User, 2026-11-07: "full autopilot and ownership grant to
run in parallel as you see fit agents to cover the entire i1 to i20, draft adrs in 1 pr then do batches. Goal is to
have them all done and merged with no regressions introduced then stop".

This ADR is improvement **I-05** of `docs/retros/2026-11-07-architecture-review.md` (sections 7 and 8). The
choices below were decided by Claude under the user's ownership grant, 2026-11-07; no question is left open.

Eight `saveProject(` call sites live in `src/ui` (review I-05), 27 ui files import `src/persist` statically, the raw
`db` handle is used from `SavedData.tsx`, `online/client.ts` and `store/versions.ts`, and `persist/images.ts` imports
React for `useImageUrls`. ADR-012 is unchanged: same tables, same versions, corrupt rows still skipped and kept.

## Decision

Decided by Claude under the user's ownership grant, 2026-11-07.

- One owner of saving and listing: `src/store/libraryStore.ts` with `saveProject`, `listProjects`, `listDesigns`,
  `loadProject`, `loadDesign` and `remove*` actions that call the `db.ts` functions; the eight ui call sites call it.
- The raw `db` is not used outside `src/persist`: persist functions keep their `db` parameter, defaulting to the
  module's instance, and `db` is no longer exported. `SavedData.tsx`, `online/client.ts` and `store/versions.ts` call
  named persist functions instead.
- `useImageUrls` moves from `src/persist/images.ts` to `src/ui/useImageUrls.ts`; persist imports no React.
- An allowlist test fails on any `src/ui` import of `persist/db` (the allowlist starts empty) and on any import of
  the `db` symbol outside `src/persist`.

## Alternatives considered

- **Only hide `db`, leave ui saving** — removes one leak but keeps eight save paths to keep in step.
- **A repository class per table** — a larger rewrite for the same boundary.
- **Leave as is** — the review's weight-12 finding stays.

## Scope

- In scope: `libraryStore`, the eight save sites, the three raw `db` users, `useImageUrls`, the allowlist test.
- Out of scope: making `restoreFiles` one transaction (G-489).

## Consequences

- Positive: one place to change saving; persist is framework-free.
- Negative / risks: a save path that no longer fires the saved-change listeners (backup, account upload).
- Harder to change later: nothing; the store API is internal.

## Done when

TDD (review section 9): every item starts from a test written first that pins today's behaviour and passes on
`main` before the change; the change keeps it green (or turns the stated red test green).

- [x] (test first) `tests/layering.test.ts`: no `src/ui` import of `persist/db` and no `db` import outside
      `src/persist` (offenders printed on failure); red before, green after. Evidence: "no src/ui import of
      persist/db, no raw db outside src/persist, no React in src/persist" listed 27 offenders before the change and
      none after; the allowlist `UI_PERSIST_DB_ALLOWED` is empty.
- [x] (test first) `persist.test.ts` with a spy on `emitSavedChange`: each library action fires it exactly as the old
      direct call did. Evidence: "library writes report their changes like the direct calls (ADR-223)" (a
      `onSavedChange` listener, the module's public spy; each of the 20 library writes run directly and through the
      library from an empty database, same changes); red before (no `libraryStore`), green after.
- [x] (test first) jsdom find-it at 390 and 1280 px: history, variables, wall-fill, room-fill and the projects page
      still save (the saved name is listed after a reload of the store). Evidence:
      `tests/find-it/library-saves.test.tsx`, 10 tests, green before and after the change.
- [x] `src/persist` imports no `react`; `useImageUrls` lives in `src/ui`. Evidence: `tests/layering.test.ts`
      "useImageUrls lives in src/ui" and the React rule of the scan.
- [ ] `pnpm lint`, `pnpm format:check`, `pnpm typecheck`, `pnpm test`, `pnpm build` and `pnpm docs:check` pass; the
      test count is not lower than on `main` before the change (review section 9).
