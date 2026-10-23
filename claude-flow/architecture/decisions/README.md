# Architecture Decision Records

Decisions for the **rebuilt** Furniture Builder (branch `rebuild/v1`, 2026-10-21). One decision per file. Each cites
repository files as evidence and ends with a check a reviewer can run. The pre-rebuild ADR set lives in git history.

| Status | Meaning |
|---|---|
| Accepted | Implemented or enforced; evidence points at the code that proves it. |
| Approved | Decided by the user (questions answered), not yet built. Becomes Accepted when the code exists. |
| Proposed | Recorded, still has open questions. |
| Superseded | Replaced; kept for lineage. |

New ADRs: copy any file's six sections, number sequentially, never renumber. Only `architecture-authority` accepts or supersedes.

## Foundation

| ID | Decision | Status |
|---|---|---|
| [ADR-0001](ADR-0001.md) | Rebuild from zero with a clean break from the previous app and its data | Accepted |
| [ADR-0002](ADR-0002.md) | Static offline PWA on GitHub Pages; no backend, accounts, cloud or remote services | Accepted |
| [ADR-0013](ADR-0013.md) | Stack: React 19, TypeScript strict, Vite 7, Zustand, react-three-fiber (lazy), Dexie | Accepted |

## Model

| ID | Decision | Status |
|---|---|---|
| [ADR-0003](ADR-0003.md) | Integer millimetres and one coordinate system everywhere | Accepted |
| [ADR-0004](ADR-0004.md) | Every part is an axis-aligned box; one FurnitureModel feeds every view and list | Accepted |
| [ADR-0005](ADR-0005.md) | Furniture is a recursive subdivision of spaces | Accepted |
| [ADR-0006](ADR-0006.md) | Full-overlay fronts with exact gap arithmetic | Accepted |
| [ADR-0007](ADR-0007.md) | Specialist product roots share the cabinet generator; a desk pedestal is a cabinet | Accepted |
| [ADR-0008](ADR-0008.md) | Problems are diagnostics, checked independently of the generators; errors block export | Accepted |

## Outputs

| ID | Decision | Status |
|---|---|---|
| [ADR-0009](ADR-0009.md) | Cut list lists finished sizes; banded edges are annotated, grain sets length | Accepted |
| [ADR-0010](ADR-0010.md) | Hardware is a schedule with labelled guidance, never invented specifications | Accepted |

## Data

| ID | Decision | Status |
|---|---|---|
| [ADR-0011](ADR-0011.md) | A design is a self-contained, validated JSON document | Accepted |
| [ADR-0012](ADR-0012.md) | Local persistence in IndexedDB with autosave; corrupt rows are skipped, never deleted | Accepted |

## Interface

| ID | Decision | Status |
|---|---|---|
| [ADR-0014](ADR-0014.md) | The front elevation is the editing surface; 3D is a non-authoritative preview | Accepted |
| [ADR-0030](ADR-0030.md) | One token set with light and dark themes, a component layer, and a wizard-ready steps rail | Accepted |

## Process

| ID | Decision | Status |
|---|---|---|
| [ADR-0015](ADR-0015.md) | Verification: pure-core unit tests plus seeded fuzz invariants; screenshots for UI; no E2E suite by default | Accepted |
| [ADR-0016](ADR-0016.md) | Process: smallest slice, evidence-only status, explicit "Skipped this iteration" | Accepted |
| [ADR-0017](ADR-0017.md) | Agent contracts stay runtime-neutral; no Claude Flow / Ruflo runtime is adopted | Accepted |

## Approved — next slices

Questions answered by the user on 2026-10-21; each becomes Accepted when its slice is built.

| ID | Decision | Backlog | Status |
|---|---|---|---|
| [ADR-0018](ADR-0018.md) | Sheet nesting: seeded guillotine heuristic with an independent layout validator | N01 | Accepted |
| [ADR-0019](ADR-0019.md) | Stock sheets, trim and kerf live in the design document (schemaVersion 2) | N01 | Accepted |
| [ADR-0020](ADR-0020.md) | Printing and drawings: SVG from the model plus a print stylesheet, no PDF library | N02 | Accepted |
| [ADR-0021](ADR-0021.md) | Fusion 360 export: a Python script that rebuilds the model as named solid boxes, unverified until run in Fusion | N03 | Accepted |
| [ADR-0022](ADR-0022.md) | Projects: several pieces placed in one room, with combined parts and storage version 2 | N04 | Accepted |
| [ADR-0023](ADR-0023.md) | More space options: chosen drawer heights and adjustable shelves with 32 mm pin rows | N05 | Accepted |
| [ADR-0024](ADR-0024.md) | Front styles (overlay, half overlay, inset) and handles as a scheduled item with a position | N06 | Accepted |
| [ADR-0025](ADR-0025.md) | Wall and corner cabinets as new product roots built from the cabinet generator | N07 | Accepted |
| [ADR-0026](ADR-0026.md) | Desk pedestals become editable spaces | N08 | Accepted |

## Catalog — proposed

Requested by the user on 2026-10-22; defaults in each ADR await confirmation.

| ID | Decision | Backlog | Status |
|---|---|---|---|
| [ADR-0027](ADR-0027.md) | Catalog page: browse by category, brand and "Saved on this device"; shipped entries open as local copies | N14 | Approved |
| [ADR-0028](ADR-0028.md) | Catalog metadata and origin link live in the design document (optional field, no schema bump) | N15 | Accepted |
| [ADR-0029](ADR-0029.md) | The catalog is fed by a scheduled search → extract (`tools/catalog/extract_pdf.py`) → reconstruct → PR job; native products only, evidence per value | N16, N17 | Approved |

## Placement — proposed

Requested by the user on 2026-10-22; defaults in the ADR await confirmation.

| ID | Decision | Backlog | Status |
|---|---|---|---|
| [ADR-0031](ADR-0031.md) | Pieces are placed on the floor, on the wall, or on/above another piece; cabinet bottom under the sides; bay layout | N19, N20 | Accepted |

## Template catalog — proposed

Requested by the user on 2026-10-22 (all furniture types, grouped by room with a toggle to type, editable, 1–5 default
variants each). Families and variants: `docs/catalog.md`. Defaults in each ADR await confirmation.

| ID | Decision | Backlog | Status |
|---|---|---|---|
| [ADR-0032](ADR-0032.md) | Template catalog = families of complete design snapshots, copied on insert, grouped by room (default) or type; no formula engine or inheritance | N22 | Accepted |
| [ADR-0033](ADR-0033.md) | 1–5 default variants per family (fewest for simple storage, most for kitchen); interior variants double as *Apply layout* presets | N23 | Accepted |
| [ADR-0034](ADR-0034.md) | Templates are editable: edits saved as local templates (new Dexie table), shipped ones never change, reset and compare | N24 | Accepted |
| [ADR-0035](ADR-0035.md) | Construction guidance as a rules registry keyed by role/product, labelled warnings; safety-regulated items wait for user values | N25 | Accepted |
| [ADR-0036](ADR-0036.md) | Kitchen: tall units, rails-top / no-bottom flags, user-sized appliance niches, front-only panel, run-level fillers, covers, plinth, worktop | N26 | Accepted |
| [ADR-0037](ADR-0037.md) | Sliding doors and lift-up / drop-down flaps as front kinds, hardware user-specified | N27 | Accepted |
| [ADR-0038](ADR-0038.md) | Frame root for tables, benches, stools, chairs and beds, with solid (linear) stock beside sheet stock | N28 | Accepted |
| [ADR-0039](ADR-0039.md) | Upholstered, mechanised and shaped pieces are reference entries until a shaped-part ADR | N29 | Accepted |

## Shapes — proposed

Requested by the user on 2026-10-23 (answer to ADR-0039).

| ID | Decision | Backlog | Status |
|---|---|---|---|
| [ADR-0040](ADR-0040.md) | Shaped parts: tilted members and profiled boards on whole-mm cut blanks | N30 | Proposed |

## Mobila rooms — proposed

Requested by the user on 2026-10-22.

| ID | Decision | Backlog | Status |
|---|---|---|---|
| [ADR-0041](ADR-0041.md) | Parts known only by their cut sizes are a panel set (one flat pile, never an invented assembly) | N21, N31 | Proposed |

## Catalog pictures — proposed

Requested by the user on 2026-10-23.

| ID | Decision | Backlog | Status |
|---|---|---|---|
| [ADR-0042](ADR-0042.md) | Catalog pictures are SVG snapshots of the built model, made before the app runs and shipped as files | N32 | Proposed |
