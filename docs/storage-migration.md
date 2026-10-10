# Local storage migration: localStorage -> Dexie IndexedDB

## Database and schemas
- Name: `mobila-cutlist-build-kit`
- Dexie versions 1 and 2 retained in `src/db/database.ts`. Current version 2.
- Tables: `projects`, `presetCategories`, `presets`, `kits`, `materials`, `revisions`, `metadata`.
- Internal record schema version 1 is independent of Dexie DB schema and full-JSON-backup schema version 1.
- Initial categories include `uncategorized`; migrated presets receive this category.

## Algorithm
1. Open IndexedDB, read metadata `migration:localStorage:v1`.
2. When absent, snapshot indexed projects (`mobila-cutlist:project-index`), including orphan `mobila-cutlist:project:*` keys, and preset array (`mobila-cutlist:presets:v1`).
3. Validate every record with existing project/preset validators; invalid legacy entries are skipped and reported but not deleted.
4. Run one Dexie read/write transaction covering project/preset/category/material writes **and** the migration marker.
5. If an ID exists in IndexedDB, keep IndexedDB's newer record. `put` only missing legacy IDs.
6. Commit the marker only after all import operations succeed. A rejected transaction rolls back both data and marker.
7. Legacy localStorage keys are **never deleted** in this release. Browser preference `mobila-cutlist:theme` stays in localStorage.

## Backup and restore
- Existing per-project `.backup.json` and preset-library `mobila-cutlist-presets.json` v1 formats remain readable and exportable.
- Settings adds `furniture-builder-full-backup.json` with six collections (projects/categories/presets/kits/materials/revisions).
- Full-DB imports validate before a single transactional merge; existing IDs are skipped, not overwritten.
- Export backups before clearing site data or moving devices. IndexedDB is not synced.

## Regressions and recovery
- Database-open errors show a blocking message. No silent fallback to legacy localStorage writes.
- An interrupted migration may be rerun; source keys remain intact.
- The E2E migration test injects actual v1-shaped localStorage records prior to page boot.
- Unit tests use fake-indexeddb to check idempotency, collision handling, revisions, and backup integrity.
