# Data model (from `src/engine/types.ts`, `src/db/database.ts`, `src/assembly/model.ts`)

## Project (record `schemaVersion: 1`)
`Project { id, name, description, createdAt, updatedAt, materials[], sheets[], offcuts[], parts[], assemblies?[], settings, lastResult? }`

- `Material { id, name, type: PAL|MDF|plywood|custom, thickness: Mm, finish? }`
- `StockSheet { id, materialId, thickness, width, height, quantity: number|null, grain: none|x|y, trim{top,right,bottom,left}, cost? }`
- `Offcut { id, materialId, thickness, width, height, grain, quantity ≥ 1 }`
- `Part { id, label, width, height, quantity, materialId, rotationAllowed, grain, abs{top,right,bottom,left: string|null}, group?, notes?, sourcePreset? }`
- `OptimizationSettings { kerf, rotationAllowed, maxDurationMs, maxRestarts, minOffcutWidth, minOffcutHeight, minOffcutArea, seed }`
- `ProjectAssembly { id, label, pieces[{id, partId, instanceIndex, positionMm[3], rotationDeg[3]}], cabinetSpec?, drawerSpec?, surfaceSpec?, componentTree?, sourcePreset? }`

## Optimisation result (derived, re-validated on load)
`OptimizationResult { projectId, createdAt, boards[], unplaced[], offcuts[], stats, search{attempts, elapsedMs, seed, strategy}, valid, errors[] }`
`BoardLayout { id, stockId, source: stock|offcut, materialId, thickness, grain, width, height, trim, usable, tree: CutTree, placements[] }`
`CutTree = part{rect, instanceId} | waste{rect, id} | cut{rect, orientation, at, kerf, first, second}`

## Dexie `mobila-cutlist-build-kit` (schema v2)
| Table | Key | Indexes | Record |
|---|---|---|---|
| projects | id | updatedAt, name | Project |
| presetCategories | id | name, parentId, sortOrder | PresetCategory |
| presets | id | categoryId, label, updatedAt | StoredPreset (CutlistPreset + categoryId) |
| kits | id | categoryId, label, updatedAt | BuildKit |
| materials | libraryId | type, thickness, name, sourceProjectId | LibraryMaterial |
| revisions | id | [entityType+entityId], createdAt | LibraryRevision (append-only snapshots) |
| metadata | key | — | migration marker, starter-seed markers |

## Component tree (persisted on assemblies/presets)
`StoredComponentTree` — shallow serialisable `{ definitionId, definitionVersion, parameters, slot, children[] }`;
generator bodies never persisted (ADR-0015).

Invariants: all dimensions integer mm (ADR-0007); three independent version numbers — Dexie schema (2), record
`schemaVersion` (1), backup `schemaVersion` (1) (ADR-0005).
