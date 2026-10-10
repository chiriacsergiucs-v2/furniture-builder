# v0.3: Three.js, React Three Fiber and dnd-kit

Status: implementation merged; release verification is required against the refreshed dependency lockfile.

## Acceptance checklist

- [ ] `npm ci` using regenerated `package-lock.json`
- [ ] `npm run lint` and `npm run typecheck`
- [ ] Kernel, Vitest and Playwright tests
- [ ] Production build and GitHub Pages deployment
- [ ] WebGL-compatible Chrome preview with orbit and selection
- [ ] WebGL-unavailable fallback
- [ ] Touch and keyboard reordering preserves parts after browser restart
- [ ] Project backups, Dexie schema, and 2D geometry unchanged

3D view renders a limited exploded inventory of individual rectangular panel rows. It is **not** an assembly design or a guillotine cutting layout. The 2D validated cut-tree remains authoritative for manufacturing.
