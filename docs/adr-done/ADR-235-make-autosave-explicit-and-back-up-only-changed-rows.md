# ADR-235: Make autosave explicit and back up only changed rows

- Status: Implemented
- Date: 2026-11-07
- Implemented: 2026-11-07
- Depends on: none
- Design: n/a
- Backlog: N240

## Context

User, 2026-11-07 (the architecture review request): "current code structure/architecture modularity and overall
design analysis ... complete code quality critique and suggest architectural improvements ... No regressions shall
be introduced, ensure before and after testing tdd style". User, 2026-11-07: "full autopilot and ownership grant to
run in parallel as you see fit agents to cover the entire i1 to i20, draft adrs in 1 pr then do batches. Goal is to
have them all done and merged with no regressions introduced then stop".

This ADR is improvement **I-17** of `docs/retros/2026-11-07-architecture-review.md` (sections 7 and 8). The
choices below were decided by Claude under the user's ownership grant, 2026-11-07; no question is left open.

Verified by the review: the Dexie `creating`/`updating` hooks in `src/persist/db.ts` call `emitSavedChange` after
every write, and an `updating` hook makes Dexie read the full row before each `put`. Each save also makes three
settings operations; the backup folder lookup never caches `undefined`; and with a folder, `backupNow` reads and
base64-encodes all 12 tables, image and model bytes included, before diffing. ADR-012 (autosave, corrupt rows kept)
and ADR-133 (persistent storage, folder backup) are unchanged: the same data is backed up, faster.

## Decision

Decided by Claude under the user's ownership grant, 2026-11-07.

- Remove the `creating`, `updating` and `deleting` hooks; every save, put and delete function in `src/persist`
  calls `emitSavedChange({ table, key, deleted })` itself after its write succeeds. A test lists every write
  function and proves each emits.
- Cache the backup folder lookup per session, including "no folder" (`undefined`), invalidated when the user picks or
  clears a folder; cache the persist-asked flag per session the same way.
- Keep a dirty set of `{ table, key }` filled by `emitSavedChange`; `backupNow` with a folder writes only dirty rows
  (and deletions), with a per-row text cache, and falls back to the full backup on first run or a missing file.

## Alternatives considered

- **Keep the hooks, add caches only** — the read-before-write per save stays.
- **Debounce the backup** — fewer runs, but each still reads every table.
- **Back up only on demand** — weakens ADR-133's automatic folder backup.

## Scope

- In scope: explicit emits, the two session caches, dirty-row backup.

## Consequences

- Positive: IndexedDB operations per save about 5 → 2; folder backup O(changed rows) instead of O(library) (estimates).
- Negative / risks: a new write function that forgets to emit (the listing test catches it); a missed dirty row
  (the full backup on first run and a missing file corrects it).
- Harder to change later: write functions own their notification.

## Done when

TDD (review section 9): every item starts from a test written first that pins today's behaviour and passes on
`main` before the change; the change keeps it green (or turns the stated red test green).

- [x] (test first) `persist.test.ts` with an `emitSavedChange` spy: every save, put and delete function emits once
      with the right table and key (green with hooks before, green with explicit calls after). Evidence: "every write
      reports its change (ADR-235)": a listener on `onSavedChange` checks each of the 31 write functions of
      `src/persist/db.ts` (and `restoreFiles`); a second test fails when a new write function is not in the list.
      Green with the hooks before and with `savedRows` after.
- [x] (test first) fake-indexeddb: three saves call `settings.get` for the folder once; with no folder, too.
      Evidence: `tests/backup-session.test.ts` "three saves read the backup folder and the persist-asked flag once;
      with no folder, too" (red before: 3 reads of each).
- [x] (test first) with a folder: after saving one project, `backupNow` does not read `models` or `images`
      (`toArray` spies), and the folder holds the same files as a full backup. Evidence: "with a folder: after saving
      one project, a backup reads no models or images and matches a full backup" (red before: every table read) and
      "a file of its own missing from the folder is written again" (red before).
- [x] `find-it/account-ui` upload spy and the backup tests pass unchanged. Evidence: `tests/account-ui.test.tsx`
      15/15 and `tests/backup.test.ts` 16/16, unchanged.
- [x] `pnpm lint`, `pnpm format:check`, `pnpm typecheck`, `pnpm test`, `pnpm build` and `pnpm docs:check` pass; the
      test count is not lower than on `main` before the change (review section 9). Evidence 2026-11-07 (local):
      `pnpm test` 194 files, 1724/1724 passed (1714 on `main` before).
