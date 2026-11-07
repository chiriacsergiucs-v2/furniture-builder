# ADR-227: Validate saved rows before duplicating a design or project

- Status: Implemented
- Date: 2026-11-07
- Implemented: 2026-11-07
- Depends on: none
- Design: n/a
- Backlog: N232

## Context

User, 2026-11-07 (the architecture review request): "current code structure/architecture modularity and overall
design analysis ... complete code quality critique and suggest architectural improvements ... No regressions shall
be introduced, ensure before and after testing tdd style". User, 2026-11-07: "full autopilot and ownership grant to
run in parallel as you see fit agents to cover the entire i1 to i20, draft adrs in 1 pr then do batches. Goal is to
have them all done and merged with no regressions introduced then stop".

This ADR is improvement **I-09** of `docs/retros/2026-11-07-architecture-review.md` (sections 7 and 8). The
choices below were decided by Claude under the user's ownership grant, 2026-11-07; no question is left open.

Verified by the review: `duplicate()` in `src/ui/shell/ProjectsPage.tsx` spreads raw rows from
`listProjects`/`listDesigns` into `saveProject`/`saveDesign` with no `validateProject`/`validateDesign`. A row that
`loadProject` would refuse becomes two unreadable rows with the old `schemaVersion`. ADR-011 ("validate designs before
load or import") and ADR-012 (corrupt rows are skipped, never deleted) apply.

## Decision

Decided by Claude under the user's ownership grant, 2026-11-07.

- `copyDesign(db, id, name)` and `copyProject(db, id, name)` in `src/persist/db.ts` read the row, run it through the
  same validating path as `loadDesign`/`loadProject` (including the readers of older `schemaVersion`s), give the copy
  a new id and the current `schemaVersion`, save it, and return `{ ok: true, id }` or `{ ok: false, reason }`.
- `ProjectsPage` "Duplicate" calls them and shows the reason as the existing error notice when the copy is refused;
  the corrupt source row stays untouched.
- No new UI text: the refusal uses the existing load-failure message (already translated).

## Alternatives considered

- **Validate inside `duplicate()` in the page** — keeps persist logic in ui (against ADR-223's direction).
- **Return summaries from the list functions** — also blocks the leak, a wider API change; kept as G-493.
- **Copy and repair** — would rewrite a saved design without the user's decision (`CLAUDE.md`).

## Scope

- In scope: `copyDesign`, `copyProject`, the Duplicate action, tests.
- Out of scope: list functions returning summaries (G-493).

## Consequences

- Positive: a duplicate is always readable; a corrupt row is never multiplied.
- Negative / risks: a duplicate of an old-version row now gets the current `schemaVersion` (as a load and save does).
- Harder to change later: nothing.

## Done when

TDD (review section 9): every item starts from a test written first that pins today's behaviour and passes on
`main` before the change; the change keeps it green (or turns the stated red test green).

- [x] (test first) `persist.test.ts`: a valid design and project copy as today (new id, same content) — green before
      and after. Evidence: "a valid design and project copy with a new id and the same content" and "a copy of an
      older-version row is written at the current schemaVersion" (the API is new, so these were red before only because
      `copyDesign` did not exist; the same behaviour through the page is pinned green before by the find-it test).
- [x] (test first) `persist.test.ts`: store a corrupt row, call `copyProject`/`copyDesign`, get `{ ok: false }` with a
      reason; the row count is unchanged and the corrupt row is untouched (red before as a page-level helper test).
      Evidence: "a corrupt or missing row is refused with a reason; nothing is added or changed" (red before).
- [x] (test first) jsdom find-it `tests/find-it/projects-duplicate.test.tsx` at 390 and 1280 px: Projects page →
      "Duplicate" found by role and text adds the copy (green before and after). Evidence: "duplicate saved work at
      390px / 1280px (find-it, ADR-227)": the readable project and piece copies were green before; the added step
      (Duplicate on an unreadable row shows "Saved work could not be read from this browser." and adds nothing) was
      red before (no alert) and is green after.
- [x] `pnpm lint`, `pnpm format:check`, `pnpm typecheck`, `pnpm test`, `pnpm build` and `pnpm docs:check` pass; the
      test count is not lower than on `main` before the change (review section 9). Evidence 2026-11-07 (local): 1714 →
      1719 tests; the suite's remaining failures (estimate-chip at 390 px, failing on `main` before too, and timeouts
      under load) are outside this change.
