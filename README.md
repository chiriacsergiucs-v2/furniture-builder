# Furniture Builder — Mobila Cutlist Optimizer

Offline-first prototype of a mobile-first, offline-oriented furniture panel cutting optimizer using React, TypeScript, Vite and a Web Worker. Source files and docs track `chiriacsergiucs-v2/furniture-builder` and GitHub Pages base `/furniture-builder/`.

## Features implemented in source

Project editor, PAL/MDF/custom materials, configurable sheets/quantities/trims, parts, grain, rotation, four-edge ABS, Dexie IndexedDB, version-1 JSON backups, CSV/XLSX generic import, SVG/print/PDF/CSV/XLSX exports, multi-restart heuristic guillotine optimizer and independent cut-tree validation.

## Offline Dexie database (v0.2)

Projects, reusable cutlist presets, preset categories, kits, library materials and revisions live in IndexedDB, using Dexie 4.2.x. No cloud service or account is required. Projects still embed material specifications so an old cutlist remains reproducible when the library changes.

On first load, valid legacy `mobila-cutlist:project:<id>` and `mobila-cutlist:presets:v1` records are copied into an atomic Dexie transaction. Existing IndexedDB records take precedence, no legacy keys are erased, malformed legacy records remain untouched, and a migration marker prevents duplicate migrations. IndexedDB open/write errors are surfaced rather than silently losing data. Project and preset JSON backup/restore remain compatible with v1; Settings adds complete database JSON export and non-destructive merge restore.

In an open project, choose **Presets** to create a named multi-part template, optionally create categories (such as Drawers), save the preset and insert it into another project. IndexedDB is still local to each browser origin: users should export backups before clearing browser storage or changing devices.

Database schema versions are declared in `src/db/database.ts`. The backup version is separate from the IndexedDB schema version, and schema upgrades must preserve old records. Revisions are append-only snapshots of meaningful project/preset/kit/category changes.

## 3D panels and touch-friendly reordering (v0.3)
The editor offers a lazy-loaded **Panel preview in 3D** based on `three` and `@react-three/fiber` (interactive orbit, zoom, selection). Geometry uses cut dimensions and material thickness without altering manufacturing data. It is an exploded panel inventory, **not a geometrically validated assembled cabinet**; quantity multiples are represented in labels, not duplicate meshes. WebGL2 is optional and an accessible list remains usable if it is unavailable. At most 40 part rows render at once to control mobile GPU usage.

The **Reorder cutlist parts** control uses dnd-kit with mouse, touch, keyboard, and explicit up/down buttons. The order persists in Dexie with the project and does not replace the optimizer's own placement heuristics. Neither feature changes the existing JSON backup schema or 2D guillotine validator.

## Positioned 3D drawer assemblies and Fusion 360 (v0.4)
The project editor supports individually movable and rotatable panel instances saved in the project JSON/IndexedDB. Use **+ 40 × 30 cm Drawer** to add 4 cutlist rows and five solid panels: two 300 × 250 mm sides, a 300 × 250 mm back, a 300 × 250 mm inner front, and a 400 × 300 mm visible Front Main. PAL 18 mm gives a 336 × 300 × 250 mm drawer body and 2 mm space before the main front. **Drawers** category and starter kit are seeded once, without overwriting user presets. Adding the starter drawer through Presets → Add to project also creates positioned assemblies; 1–20 sets are supported per insertion. No bottom panel, slides, fixings or joinery are specified; the example does not constitute a finished production design.

A 3D transform gizmo and accessible numerical inputs edit XYZ positions (mm) and XYZ rotations (degrees) per panel instance, independently from the 2D cut plan. **Export Fusion 360 Python** creates separately editable direct-model B-rep solids from the exact transforms using Autodesk Fusion Scripts and Add-Ins. This is not an F3D or STEP file; use Fusion to save/export afterwards. Execution in Autodesk Fusion itself is not part of browser tests.

## Development

Node >=22 required. `npm install` then `npm run dev`, `npm run lint`, `npm run typecheck`, `npm run test:kernel`, `npm test`, `npm run build`, `npm run test:e2e`. Use the committed package-lock.json; update it whenever dependencies change.

Without dependencies the engine test can run with `npm run test:kernel` (Node built-in test runner and strip-types).

## State and resumption

Read `docs/progress.json`, `docs/handoff.md`, `docs/verification-log.md`, `AGENTS.md` and `CUTLIST_OPTIMIZER_RESUMABLE_BUILD_PROMPT_v2.md`. **Release acceptance depends on current GitHub Actions and browser tests.** Check actual run URLs before claiming success.

## Privacy and licensing

MIT-licensed application source. No backend/server database/accounts/remote optimization, and no data leaves the browser during application use. Validate exact fabrication constraints and dimensions before cutting. Third-party licence inventory pending dependency audit.
