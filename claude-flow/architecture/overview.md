# Architecture overview

```mermaid
flowchart LR
  UI[React + TS + Vite PWA] --> LOCAL[(Dexie IndexedDB)]
  LEGACY[(localStorage)] -->|atomic copy| LOCAL
  UI --> OPT[Web Worker: heuristic guillotine]
  OPT --> VALID[Independent cut-tree validator]
  VALID --> CUT[2D cutting layouts and export]
  UI --> COMPONENTS[Typed component graph + recipes]
  COMPONENTS --> MODEL[Normalized FurnitureModel]
  MODEL --> THREED[3D / positioned assembly]
  MODEL --> BOM[Cutlist + hardware diagnostics]
  MODEL --> FUSION[Fusion Python snapshot]
  UI --> PAGES[Static GitHub Pages]
```

**Separation:** Cut-tree placement validation is not equivalent to assembled furniture stability validation. Generic supplier import/export is not a validated per-vendor adapter.
