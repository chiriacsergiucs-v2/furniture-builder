# Resumption handoff — 2026-10-10

## Repository
`chiriacsergiucs-v2/furniture-builder`, private, initially empty. Owner confirmed by the user. Default branch `main` and write access confirmed; a README and initial agent files were committed through the GitHub connector. **Do not push to `mobila-cutlist` or `ai-config`.**

## Local source
Application prototype in this project. See root `CUTLIST_OPTIMIZER_RESUMABLE_BUILD_PROMPT_v2.md` for original requirements and checkpoint protocol.

## Evidence
- Node 22.16 available; no npm packages installed locally.
- `node --experimental-strip-types --test tests/engine.node.test.mjs` passed 12/12 (including 200 fuzz cases) after validation fixes.
- Full dependency install timed out because sandbox cannot access npm registry.
- Full TypeScript/Vite build, Vitest, Playwright and live Pages deployment have **not** been run or verified.
- Generic XLSX parser/serializer written but untested against actual workbook due missing ExcelJS install.
- Regency adapter is deliberately not fabricated; original workbook unavailable.

## Changes during last batch
- Updated Vite base, PWA manifest scope, Playwright URL and HTML favicon to `/furniture-builder/`.
- Added hash route with project ID to restore selected saved project after browser refresh.
- Made theme storage initialization resilient to disabled localStorage.
- Hardened sheet trim and source ID validation, plus stored corrupted-result recovery.
- Expanded independent cut-tree validator to check aggregate area/statistic consistency and offcut shapes.
- Temporarily used `npm install` in CI pending a lockfile; revert to `npm ci` when generated.

## Immediate next tasks
1. Ensure all local source files are committed to `furniture-builder` as individual files (not just documentation); compare manifests before marking sync done.
2. Fetch dependencies on network-enabled environment. Generate and commit `package-lock.json` using `npm install`, switch CI to `npm ci`.
3. Run complete verification sequence and fix errors; don't claim unrun tests passed.
4. Inspect GitHub Pages settings for private repository eligibility and enable Actions deploy if allowed.
5. Import real `SABLON DEBITARE NOU.xlsx` when provided; implement Regency mapping only after inspection.
