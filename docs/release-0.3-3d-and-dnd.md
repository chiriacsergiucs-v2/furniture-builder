# v0.3: Three.js, React Three Fiber and dnd-kit

Status: implementation merged; release verification is required against the refreshed dependency lockfile.

## Acceptance checklist

- [x] `npm ci` using regenerated `package-lock.json`
- [x] `npm run lint` and `npm run typecheck`
- [x] Kernel, Vitest and Playwright tests
- [x] Production build and GitHub Pages deployment
- [ ] Physical Android/Chrome WebGL orbit and selection
- [x] WebGL-unavailable fallback provided in UI, browser test runs
- [x] Part order persistence and keyboard/touch controls (Playwright persistence; physical touch not tested)
- [x] Project backups, Dexie schema, and 2D geometry unchanged

3D view renders a limited exploded inventory of individual rectangular panel rows. It is **not** an assembly design or a guillotine cutting layout. The 2D validated cut-tree remains authoritative for manufacturing.

## Verified run evidence
CI 38038577231: 25 kernel, 15 Vitest, 10 Playwright; build, lint and TS PASS. Pages 38038577305 PASS.
