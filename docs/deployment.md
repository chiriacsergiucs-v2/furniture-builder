# GitHub Pages deployment

- Repository: https://github.com/chiriacsergiucs-v2/furniture-builder
- Published URL: https://chiriacsergiucs-v2.github.io/furniture-builder/
- Vite base: `/furniture-builder/`; PWA scope and hash routing match.
- GitHub Actions 38028499287: Pages build and deployment succeeded at `f7f38e7`.
- GitHub Actions 38028499465: lint, TypeScript, 25 kernel tests, 10 Vitest tests, 8 Playwright tests and production build passed.
- Independent external HTTP verification could not run in current tool; GitHub Pages deployment reported success.
- Project, library, kit and revision data remain local in **IndexedDB via Dexie**. Legacy localStorage project and preset data is preserved. The static site receives no customer data.
- On new releases, users may need to activate the installed PWA's **Update app** notification. Never clear site data to force an update. Export complete JSON database backup before clearing data or changing devices.
