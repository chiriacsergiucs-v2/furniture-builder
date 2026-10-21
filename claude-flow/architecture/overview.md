# Architecture overview

```
 React UI (src/app, src/components)  ── lazy ──►  three.js / R3F viewer, dnd-kit reorder, ExcelJS
        │ configurators, validators
        ▼
 Furniture engine (src/furniture)  ──►  FurnitureModel ──► cut rows ─┐
   registry · instance tree · templates            │                 │
                                                   ▼                 ▼
 Assembly (src/assembly)  positions/rotations   Fusion .py      Project.parts
                                                                     │
 Engine (src/engine)  ◄─ Web Worker ─  optimize ─► CutTree ─► validate ─► SVG/CSV/XLSX
        ▲ integer mm, kerf, grain, trim                       (independent)
 Persistence (src/db, src/storage)  Dexie v2 · migration · backups · legacy adapter
 Platform  Vite + PWA (vite.config.ts) · GitHub Actions ci/deploy/lockfile · Pages /furniture-builder/
```

Boundaries: engine has no DOM/storage imports (ADR-0013); validator shares no placement code with the generator
(ADR-0012); all geometry consumers read `FurnitureModel` (ADR-0018); storage never deletes legacy data (ADR-0004);
nothing leaves the device (ADR-0002).
