# Resumable implementation handoff — Dexie milestone

## Current milestone
Target repo `chiriacsergiucs-v2/furniture-builder` on `main`. Legacy localStorage records must never be deleted. New `src/db` contains Dexie schema v1/v2, migration, repositories and JSON backup. UI project/preset storage has been converted to async operations. A change to package dependencies requires refreshing `package-lock.json` via GitHub Actions.

## Key recovery checks
1. Inspect `docs/progress.json` and the HEAD commit SHA.
2. Verify lockfile matches `package.json` before running `npm ci`.
3. Run lint, typecheck, Vitest, kernel tests, Playwright (mobile, presets, offline, migration) and build.
4. Do not mark Pages or offline accepted until workflow and live site evidence exists.
5. Validate browser migration with existing real localStorage without removing keys.

## Data safety
Dexie database `mobila-cutlist-build-kit`; `migration:localStorage:v1` commits atomically with data; no legacy deletion. Original project/preset backup formats stay readable. Full DB JSON export/import is a non-destructive merge. Schema upgrades keep v1 + v2 declarations.

## Remaining watch-outs
Unknown third-party device browser quota/eviction; kit editing UI and full category trees not yet present. Regency sheet template still unavailable. No remote sync.

## Verified Dexie release checkpoint
- Latest tested application commit: `f7f38e7` (2026-10-10).
- CI: https://github.com/chiriacsergiucs-v2/furniture-builder/actions/runs/38028499465 — 25 kernel, 10 Vitest, 8 Playwright, lint, typecheck, build all PASS.
- Deployment: https://github.com/chiriacsergiucs-v2/furniture-builder/actions/runs/38028499287 — GitHub Pages publish PASS.
- Old localStorage v1 project/preset keys are never deleted. Backup formats preserved.
- Real-user upgrade should be tested with exported backup available; cross-origin/browser clearing may erase local data.
