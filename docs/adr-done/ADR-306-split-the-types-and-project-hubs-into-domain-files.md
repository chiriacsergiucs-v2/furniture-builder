# ADR-306: Split the types and project hubs into domain files

- Status: Implemented
- Date: 2026-11-27
- Implemented: 2026-11-27
- Depends on: ADR-279
- Design: n/a
- Backlog: N449, N450

## Context

ADR-279 left G-548 open: `src/core/types.ts` (925 lines, 141 importers) and `src/core/project.ts` (2730 lines, 83
importers) are hubs, so no kernel package can be cut while every domain imports them. The user's request: "This repo
and architecture structure seems to be way too interdependent"; on 2026-11-27 the user picked "Split as picked": types
into kernel types plus one type file per domain, project along its existing `projectX` siblings. G-613 (the cycle
guard's allowed type-only cycle `types.ts` ↔ `diagnosticCodes.ts` ↔ `catalog/types.ts`) is broken in the same split.
This ADR is needed because the change touches `src/core/types.ts` (CLAUDE.md, ADR-011); the document shape does not
change.

## Decision

Pure moves, no behaviour or shape change and no `schemaVersion` change (ADR-011 holds):

- `types.ts` becomes a re-export barrel of the same 59 names. Kernel: `kernelTypes.ts` (`Mm`, `Axis`, `Box`, `Yaw`,
  `Face`). Domains: `materialTypes.ts` (boards, bands, seller products), `modelTypes.ts` (panels, hardware, openings,
  `FurnitureModel`), `productTypes.ts` (spaces, fronts, the product params, `Product`), `designTypes.ts` (the design
  document, `CatalogMeta`, assembly steps, wizard answers).
- G-613: `Severity` and `Diagnostic` move next to their codes in `diagnosticCodes.ts`; the catalog's `Room` type moves
  to `designTypes.ts` and `catalog/types.ts` re-exports it. No type file is in an import cycle.
- `project.ts` becomes a re-export barrel (`export *`) of `projectDoc` (types, schema versions, `newProject`,
  pruning), `projectPlace` (quarter turns, `placeItem`, outlines, `makeItem`), `projectMove` (placement, drag, turn,
  locks, removal, `boundsOf`), `projectRuns` (gaps, run parts, handles, sinks, cut-outs), `projectModel`
  (`buildProjectModel`, clearances, opening checks) and the existing `projectValidate`, `projectProfiles`,
  `projectWorktops`. The parts import each other one way: Doc ← Place ← Move ← Runs ← Model.
- Code outside `src/core` keeps its imports (fewer conflicts). Inside `src/core` every file imports the file that
  defines a name, never the project barrel, so `project.ts` and `projectValidate.ts` leave the project cycle group.
- The model rule (ADR-219) covers every `project*` file: `MODEL_UP` in `eslint.config.js` and
  `tests/core-boundary.test.ts` match `project\w*`, so the split opens no path around it.

## Alternatives considered

- **Move every importer to the new files now**: touches 141 + 83 files across ui, store and tests and conflicts with
  every open branch; the barrels let each later package ADR (G-549) move its own importers.
- **A `src/core/types/` folder**: `./types` would name both the barrel file and the folder; flat names keep one
  meaning per path.
- **Break the project cycle group too**: it needs the `Connection`, `ProjectVariable` and `CommonPanel` types moved
  out of their behaviour files, beyond the pick; the group stays one unit as G-485 picked.

## Scope

- In scope: the two splits, the G-613 cycle, the barrels, core imports pointed at the defining files, the cycle
  guard and the model rule, `docs/architecture.md`.
- Out of scope: extracting the kernel and other packages (G-549); the project cycle group, kept as one unit (G-485).

## Consequences

- Positive: each domain file reads alone; the kernel types import nothing; no type file is in a cycle.
- Negative / risks: three helpers became exports of their part (`PIECE_WARNINGS`, `followUpPanel`, `cutoutChecks`)
  and so of the project barrel.
- Harder to change later: nothing; the barrels can go once their importers move.

## Done when

- [x] `types.ts` re-exports exactly its 59 former names from the kernel and domain files; `pnpm typecheck` exits 0
- [x] `project.ts` only re-exports; every former export is defined in exactly one part file
- [x] Moved code is line for line the original apart from file headers and `export` keywords (multiset compare)
- [x] The `types.ts` ↔ `diagnosticCodes.ts` ↔ `catalog/types.ts` group is gone from `ALLOWED_CYCLES`, and
      `tests/core-boundary.test.ts` asserts no type file is in a cycle and no core file imports `project.ts`
- [x] `tests/dead-code.test.ts`, `tests/core-boundary.test.ts`, `tests/layering.test.ts` and the related tests pass;
      `FUZZ_N=30000` fuzz passes
- [x] `docs/architecture.md` names the new files
