# Implementation checklist and checkpoints

Target: `chiriacsergiucs-v2/furniture-builder` — app base `/furniture-builder/`.

Statuses: `verified_partial` is not a completed milestone; each milestone requires test evidence and its acceptance gate. Resume from the first unmet acceptance criterion, not from the numerical step alone.

| Step | Milestone | Status | Next verification |
|---|---|---|---|
| 00 | Repository and dependency audit | pending | See progress.json and handoff.md |
| 01 | Bootstrap application | implemented_unverified | See progress.json and handoff.md |
| 02 | Manufacturing data model | verified_partial | See progress.json and handoff.md |
| 03 | localStorage persistence | implemented_unverified | See progress.json and handoff.md |
| 04 | Project editor | implemented_unverified | See progress.json and handoff.md |
| 05 | Guillotine optimization engine | verified_partial | See progress.json and handoff.md |
| 06 | Cutting validation and test suite | verified_partial | See progress.json and handoff.md |
| 07 | Interactive cutting diagrams | implemented_unverified | See progress.json and handoff.md |
| 08 | Statistics and material calculations | implemented_unverified | See progress.json and handoff.md |
| 09 | Import and export | implemented_unverified | See progress.json and handoff.md |
| 10 | PWA and offline functionality | implemented_unverified | See progress.json and handoff.md |
| 11 | GitHub Pages and CI/CD | implemented_unverified | See progress.json and handoff.md |
| 12 | User experience and resilience | implemented_unverified | See progress.json and handoff.md |
| 13 | End-to-end verification | pending | See progress.json and handoff.md |
| 14 | Release and documentation | pending | See progress.json and handoff.md |

## Run sequence (resume-safe)

1. Verify active git repository/branch/working tree and read these checkpoint files.
2. Reconcile code and commit history with `docs/progress.json`; set stale `complete` statuses back to `pending` when evidence is missing.
3. Install dependencies with an allowed registry, create a lockfile and change CI/deploy from `npm install` to `npm ci`.
4. Run `npm run test:kernel`, `npm run lint`, `npm run typecheck`, `npm run test`, `npm run build`, `npm run test:e2e` and correct actual failures.
5. Verify origin/path and project privacy before deployment; do not change visibility without explicit approval.
6. Verify browser project import/export, cross-reload saved result, offline PWA, Android viewport.
7. Commit functional stages, update progress.json and verification-log.md with exact command outcomes and UTC time.

Never mark a gate as passed based on code inspection or assumptions.


## Dexie storage milestone (requested 2026-10-10)
- [x] D00 audit localStorage keys, refs and constraints
- [x] D01 implement Dexie schema v1/v2 and named collections
- [x] D02 atomic read-only legacy migration and metadata marker
- [x] D03 replace project and preset persistence with async Dexie calls
- [x] D04 preserve project/preset JSON + full database backup
- [x] D05 add categories and revision/kit/material repository APIs
- [x] D06 install Dexie + fake-indexeddb with committed lockfile (lockfile action 38028331504)
- [x] D07 run Vitest/Playwright/CI and correct failures (25 kernel + 10 Vitest + 8 E2E)
- [x] D08 deploy via GitHub Pages and verify (workflow 38028499287; HTTP independently unavailable)
