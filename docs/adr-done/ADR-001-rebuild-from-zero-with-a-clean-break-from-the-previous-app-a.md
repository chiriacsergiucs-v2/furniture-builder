# ADR-001: Rebuild from zero with a clean break from the previous app and its data

- Status: Implemented
- Date: 2026-10-21
- Implemented: 2026-10-21
- Decided by: explicit user decision
- Depends on: none
- Design: n/a

## Context

The previous implementation (pre-`rebuild/v1`) was judged low quality by the user, who asked to drop it and rebuild
"as if there was never any", not caring about routes, visuals or UX. Asked about scope and data, the user chose:
rebuild everything; **clean break** with old browser data and backups; first slice = parametric furniture + 3D
preview; stack and delivery at the architect's discretion on a new branch.

## Decision

All application code, tests and docs from the previous app are removed. Nothing reads the old Dexie database
(`mobila-cutlist-build-kit`), old localStorage keys or old JSON backups, and nothing deletes them either: the new
app uses a new database name. Product _constraints_ the user stated earlier (offline, no backend, exact millimetres,
honest claims, pre-MVP process rules) are re-adopted as fresh ADRs; product _code_ is not.

## Alternatives considered

- **Incremental refactor** — rejected by the user.
- **Keep the optimiser/validator** — offered; user chose to rebuild everything.
- **Import old JSON backups** — offered; user chose a clean break.

## Consequences

- Old designs are not visible in the new app. They stay untouched in the browser until the user clears site data.
- The previous ADR set and ledgers survive only in git history (`main` before the rebuild merge).
- The live site keeps the old app until the rebuild branch is merged.

## Evidence (repository files)

- `src/persist/db.ts` — database name `furniture-builder` and comment on the clean break.
- Git history: commit removing `src/`, `docs/`, old `claude-flow/` on branch `rebuild/v1`.

## Compliance check

`grep -rn "mobila-cutlist" src/` returns nothing; `src/persist/db.ts` opens only `furniture-builder`.
