# AGENTS — Furniture Builder / Cutlist Optimizer

Read `docs/progress.json`, `docs/handoff.md`, and `docs/storage-migration.md` first. Resume from the earliest unverified checkpoint. Never claim unrun tests or deployment success.

## Current architectural requirements
- **Explicit user-approved exception (2026-10-10):** local IndexedDB via Dexie is REQUIRED. The earlier "no database" and "all data in localStorage" clauses in the original v1 prompt are superseded **only** for client-side storage.
- No remote database, backend, cloud sync, accounts, paid service, customer data uploads, remote AI APIs, or runtime external API dependency. Static GitHub Pages PWA.
- Existing localStorage project/preset records are legacy inputs and **must never be deleted** during migration. Dexie transaction + migration marker, atomic and idempotent; never overwrite newer IndexedDB records.
- Keep backwards-compatible project JSON and preset JSON backup formats, plus complete database JSON export/import. Maintain versioned Dexie migrations and avoid data loss on browser updates.
- Exact integer millimetres; respect material, thickness, stock counts, trimming, kerf, rotation/grain and ABS. Validate every guillotine layout before rendering/export; do not claim a heuristic globally optimal.

## Verification sequence
`npm ci && npm run lint && npm run typecheck && npm run test:kernel && npm run test && npm run build && npx playwright install --with-deps chromium && npm run test:e2e`.

IndexedDB testing uses `fake-indexeddb` (test-only). GitHub CI run 38028499465 validated 25 kernel, 10 Vitest and 8 browser tests. Deployment run 38028499287 succeeded for commit `f7f38e7`. Refresh this evidence after further commits. Node-only kernel tests now also require npm dependencies.

## Git safety
Only modify `chiriacsergiucs-v2/furniture-builder`; verify target and branch. Never commit private cutlists/JSON backups/workbooks. Do not force-push or reset user data. Keep progress and verification logs current.