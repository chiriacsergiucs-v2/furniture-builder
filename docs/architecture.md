# Architecture

Mobile-first React/TypeScript/Vite static SPA; hash URL routing for GitHub Pages. Project editor controls localStorage autosave and JSON backups. A Web Worker imports the deterministic seeded heuristic engine. The independent validator checks cut trees, dimensions, materials, grain, kerf, and conservation before the React view/export path can use results. SVG diagrams derive cut lines from the cut tree, rather than arbitrary rectangle outlines. ExcelJS is imported dynamically. No server, database, auth or external runtime API. Browser exports stay local.

Local browser project storage is not cross-device and can be cleared by browser settings. All four ABS edges are annotations on cut dimensions, not dimensional allowances. Part width/height are exact cut sizes in millimetres.

## IndexedDB/Dexie data layer (2026-10-10)
- Dexie schema version 1 -> 2; versioned collections: `projects`, `presetCategories`, `presets`, `kits`, `materials`, `revisions`, plus `metadata`.
- IndexedDB is device-local and persistent as long as site storage is retained. Browser cleanup can still remove it; JSON backups remain required.
- Atomic, one-time, non-destructive legacy migration with marker `migration:localStorage:v1`. Existing Dexie IDs are never overwritten.
- Project and preset JSON v1 kept compatible. New complete Build-Kit JSON v1 backs up all six collections.
- No IndexedDB outside the browser; no remote synchronization or credentials.
