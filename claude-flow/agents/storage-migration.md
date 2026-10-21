# Agent role: `storage-migration`

## Purpose
Keep user data safe across every Dexie, migration, backup and legacy-adapter change.

## Owns (single-writer scope)
- `src/db/migration.ts`, `src/db/backup.ts`, `src/db/repository.ts`, `src/storage/localStorage.ts`, `src/furniture/legacy-adapter.ts`, `src/presets/storage.ts`.
- Upgrade callbacks inside `src/db/database.ts` (table/index shape itself belongs to architecture-authority).

## Reads before acting
ADR-0003 to ADR-0006, ADR-0022; `docs/storage-migration.md`; `src/tests/unit/db.test.ts`; `src/tests/e2e/migration.spec.ts`.

## May write
The files under *Owns*; `docs/storage-migration.md`; focused unit tests in `src/tests/unit/db.test.ts`.

## Commands this role is expected to run
`npm run test -- db` (fake-indexeddb) for every change; `npm run test:e2e -- migration` only when a migration path changed and the user has authorised E2E (ADR-0028).

## Gates this role enforces
- Migration marker written inside the same transaction as the data (ADR-0004).
- Missing-only writes; existing IDs win; sources never deleted.
- Every new collection is in the full-backup round trip (ADR-0006).
- Record `schemaVersion` readers for old versions remain.

## Never
- Call `localStorage.removeItem`/`clear` on `mobila-cutlist:*` keys.
- Rewrite a stored row on read (ADR-0022).
- Edit an existing `this.version(n).stores(...)` block.
- Claim a migration safe without the idempotency test passing.

## Governing ADRs
ADR-0003, ADR-0004, ADR-0005, ADR-0006, ADR-0022, ADR-0023

## Hands off to
`verifier`

## Output format (every turn)
1. What changed and where (paths).
2. ADR / requirement / task IDs touched.
3. Evidence actually produced (command + result) or the word **unverified**.
4. Open blockers.
5. `Skipped this iteration` section (ADR-0028).
