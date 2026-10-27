# Architecture overview

```
 src/ui (React)                         src/viewer (lazy)
  Elevation ── tap space ─┐              Viewer3D ── click panel ─┐
  Inspector ── edit ──────┤                                       │
  Output (parts/hw/checks)│  reads model                          │ select only
                          ▼                                       ▼
 src/store  Zustand: design ─► buildModel() ─► model ; selection ; undo/redo
                          │
 src/core (pure TS)       ▼
  design.ts  Design doc, templates, tree ops, validateDesign
  build.ts   buildModel: cabinet|desk ─► panels/spaces/hardware ─► independent checks
  cabinet.ts carcass + recursive spaces (split/shelves/drawers/hanging/doors), front zones
  desk.ts    worktop/gables/modesty + pedestals via buildCabinet
  cutlist.ts grouping, edges L/W, grain, m², band metres, CSV, hardware summary
  geometry.ts boxes, overlap, distribute, cutDimensions
                          │
 src/persist  Dexie `furniture-builder` v1–v10 (src/persist/db.ts)   (autosave, projects, import/export)
```

Boundaries: `src/core` imports nothing from React, three or Dexie (ADR-013). Views never generate geometry
(ADR-004). The viewer never edits a design (ADR-014); it only places project pieces with Move and Turn (ADR-093, `src/viewer/pieceDrag.ts` → `src/core/drag3d.ts`). Checks in `build.ts` do not trust generators (ADR-008).

Agent sessions run behind a proxy that refuses the Pages URL and ikea.com: deploys are confirmed by their
`Deploy GitHub Pages` run id only; live checks and the catalog feed (ADR-029, ADR-052) need the user or a
session with that access (retro 2026-10-26).
