# Functional requirements

Every requirement is **Accepted** only because the cited repository path implements or enforces it. IDs are stable; new ones append. FR-036–039 were added in the 2026-10-21 rebuild for behaviour that existed in code but had no requirement.

| ID | Requirement | Evidence (repo path) | ADR |
|---|---|---|---|
| FR-001 | Create and edit cutting projects with persistent IDs | `src/engine/types.ts (Project), src/db/repository.ts` | ADR-0003 |
| FR-002 | Declare materials with type and integer thickness | `src/engine/types.ts (Material), src/engine/schema.ts` | ADR-0007 |
| FR-003 | Record parts with exact cut width/height, quantity and material | `src/engine/types.ts (Part)` | ADR-0007 |
| FR-004 | Persist project state across browser restarts | `src/db/database.ts` | ADR-0003 |
| FR-005 | Multiple named materials with separate stock sheets and offcuts | `src/engine/types.ts` (StockSheet, Offcut) | ADR-0009 |
| FR-006 | Duplicate/insert parts and presets without losing identities | `src/presets/origin.ts, src/presets/duplicate.ts` | ADR-0023 |
| FR-007 | Stock sheet sizes, quantity (or unlimited) and four trim margins | `src/engine/types.ts (StockSheet.trim/quantity)` | ADR-0009 |
| FR-008 | Per-part grain requirement and rotation permission | `src/engine/geometry.ts (grainFits), src/engine/optimize.ts` | ADR-0009 |
| FR-009 | Edge banding on four distinct sides | `src/engine/types.ts (EdgeBanding)` | ADR-0010 |
| FR-010 | Edge-band annotations never alter cut dimensions | `docs/architecture.md, src/engine/guillotine.ts (no abs read)` | ADR-0010 |
| FR-011 | Deterministic seeded multi-restart guillotine heuristic | `src/engine/optimize.ts` (makeRng, runAttempt) | ADR-0011 |
| FR-012 | Placement constrained by material, thickness, eligible stock and kerf | `src/engine/optimize.ts (consider), src/engine/guillotine.ts` | ADR-0008, ADR-0009 |
| FR-013 | Report unplaced instances, offcuts and area statistics | `src/engine/optimize.ts (calculateStatistics)` | ADR-0011 |
| FR-014 | Result statistics carry no global-optimum guarantee | `docs/algorithm.md` | ADR-0011 |
| FR-015 | Independently validate every cut tree | `src/engine/validate.ts` | ADR-0012 |
| FR-016 | Reject invalid dimensions, overlaps, stock escapes, grain and kerf mismatches | `src/engine/validate.ts` | ADR-0012 |
| FR-017 | Invalid results are blocked from render and export | `src/engine/optimize.ts (valid flag), src/db/migration.ts` | ADR-0012 |
| FR-018 | Import/export generic CSV | `src/import-export/csv.ts, docs/data-format.md` | ADR-0014 |
| FR-019 | Import/export generic XLSX (lazy ExcelJS) | `src/import-export/excel.ts` | ADR-0026, ADR-0027 |
| FR-020 | Export SVG and print/PDF cutting views derived from the cut tree | `src/import-export/svg.ts` | ADR-0014 |
| FR-021 | Versioned JSON project/preset backups stay interoperable | `src/db/backup.ts, docs/data-format.md` | ADR-0006 |
| FR-022 | Persist projects, categories, presets, kits, materials, revisions in Dexie | `src/db/database.ts` | ADR-0003 |
| FR-023 | One-time legacy migration inside an atomic transaction | `src/db/migration.ts` | ADR-0004 |
| FR-024 | Never delete legacy keys or overwrite newer indexed records | `src/db/migration.ts` | ADR-0004 |
| FR-025 | Merge full-database JSON backup without destructive replacement | `src/db/backup.ts, docs/storage-migration.md` | ADR-0006 |
| FR-026 | Compose furniture from typed, versioned, registered components | `src/furniture/component-engine.ts` | ADR-0015 |
| FR-027 | Parameter binding, named slots and compatibility validation | `src/furniture/component-engine.ts (resolveComponentTree)` | ADR-0016 |
| FR-028 | Specialist structural roots for non-cabinet furniture | `src/furniture/templates.ts, src/furniture/surface.ts` | ADR-0017 |
| FR-029 | Saved configurations are independently editable instances with source pins | `src/presets/origin.ts, src/presets/customize.ts` | ADR-0023 |
| FR-030 | One FurnitureModel feeds 3D, cutlist rows, BOM and Fusion export | `src/furniture/furniture-model.ts` | ADR-0018 |
| FR-031 | Edit per-instance integer-mm position and integer-degree rotation | `src/assembly/model.ts, src/engine/schema.ts` | ADR-0024 |
| FR-032 | Exploded/positioned 3D preview with accessible non-WebGL fallback | `src/components/Panel3DPreview.tsx, src/components/PositionedFurniturePreview.tsx` | ADR-0024 |
| FR-033 | Fusion Python snapshot export labelled unverified in Fusion | `src/assembly/fusion.ts` | ADR-0025 |
| FR-034 | Operate as an offline static PWA | `vite.config.ts (VitePWA)` | ADR-0001 |
| FR-035 | Deploy via GitHub Pages at /furniture-builder/ | `vite.config.ts, .github/workflows/deploy.yml` | ADR-0001 |
| FR-036 | Only ready templates generate parts; planned ones are visible but inert | `src/furniture/templates.ts` | ADR-0020 |
| FR-037 | Hardware listed as a requirement schedule separate from cut panels | `src/furniture/furniture-model.ts, src/furniture/drawer.ts` | ADR-0019 |
| FR-038 | Legacy component trees adapted read-only in memory | `src/furniture/legacy-adapter.ts` | ADR-0022 |
| FR-039 | Reorder cut parts by touch/keyboard without changing IDs or quantities | `src/components/reorderParts.ts, src/components/PartOrderBoard.tsx` | ADR-0024 |
