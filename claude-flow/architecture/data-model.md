# Domain and persistence model

**Cutting:** Project → Parts (dimensions, quantity, grain/rotation, material, edge flags) + stock sheets (size/count/trim) + settings (kerf) → guillotine tree, placed/unplaced pieces, validated statistics.

**Dexie v2:** `projects`, `presetCategories`, `presets`, `kits`, `materials`, `revisions`, `metadata`. Existing IDs win in migration; schema and JSON-backup versioning are independent. User revisions are append-only snapshots per source README.

**Furniture:** typed component definitions, parameter/dependency graph, attachment slots and recipe roots; `FurnitureModel` normalises solids, manufacturing rows, hardware requirements and diagnostics. Do not turn missing hardware spec into drilled-hole coordinates.
