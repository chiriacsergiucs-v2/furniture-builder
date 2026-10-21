# Security and privacy posture

- Threat model: a static site; no server-side trust boundary. Risks are local-data loss, malicious import files and
  supply-chain dependencies.
- Data never leaves the browser origin (ADR-0002); the Pages site receives no customer data (`docs/deployment.md`).
- Imports are validated before any write (`validateProject`, `validatePreset`, backup validation); malformed legacy
  records are skipped and reported, never executed or deleted (ADR-0004, ADR-0006).
- No `eval`/dynamic code from data: component generators live in code, not in persisted trees (ADR-0015).
- Dependencies pinned in `package-lock.json`, refreshed only by `lockfile.yml`; licence inventory in
  `docs/licences.md` is provisional until TSK-011 closes.
- Workbook bytes are never stored in localStorage/IndexedDB (`src/import-export/excel.ts`).
- Browser site-data clearing deletes IndexedDB; the UI tells users to export backups first.
