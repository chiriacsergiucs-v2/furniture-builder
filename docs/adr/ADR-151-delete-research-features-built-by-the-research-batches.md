# ADR-151: Delete research features built by the research batches

- Status: Pending
- Date: 2026-10-29
- Depends on: ADR-149, ADR-121, ADR-122, ADR-123, ADR-124, ADR-125
- Design: n/a
- Backlog: N153
- Agreed: 2026-10-29 "Only fix the ones you know changed, then merge"

## Context

ADR-149 deleted the research features the app had built as of 2026-10-27. The research batches ADR-121 to ADR-125
(N122–N126) then built more of them without updating the research data (G-298). The user (2026-10-29): "Only fix
the ones you know changed, then merge".

## Decision

Only features a batch ADR names as built change; nothing else is re-checked. `APP_CHECKED` becomes 2026-10-29.

1. **Delete** (built, as in ADR-149), with the feature merged into one of them:

   | Feature                                       | Built by                                       |
   | --------------------------------------------- | ---------------------------------------------- |
   | On-demand rendering                           | ADR-121 render on demand                       |
   | Hand a plan to a professional for review      | ADR-121 review pack                            |
   | Precise numeric position, dimensions and gaps | ADR-121 typed rotation (the only missing part) |
   | Numeric transform entry                       | ADR-121 typed rotation (the only missing part) |
   | Section/cutaway and visibility isolation      | ADR-122 section view and Isolate               |
   | "Paste ensemble" workflow                     | ADR-123 insert a project template              |
   | Version history and recovery                  | ADR-123 version history                        |
   | Style/material recommendations                | ADR-123 style suggestions                      |
   | Saved designs and personal codes              | ADR-124 design codes                           |
   | Existing-template instancing                  | ADR-124 template references (overrides only)   |
   | Reference copies (merged into the one above)  | ADR-124, ADR-111 linked copies                 |
   | Global parameters propagating common choices  | ADR-124 project-wide settings                  |
   | Generated sinks, handles and derived parts    | ADR-125 run sinks and handles                  |

2. **Update** what is still missing (In Progress):

   | Feature                       | Missing now                                                                   |
   | ----------------------------- | ----------------------------------------------------------------------------- |
   | Direct manipulation in 2D/3D  | rotating by dragging (typed angle and 3D height drag built, ADR-121, ADR-122) |
   | Lock/pin and manual overrides | single named parameters; Lock size locks all three sizes together (ADR-122)   |
   | Transactional undo/redo       | undo of snap and unsnap (named, compound steps built, ADR-123)                |
   | Spatial query engine (Rapier) | Not Started → In Progress: trial measured (ADR-125); adopting it needs an ADR |

3. Same rules as ADR-149: sub-features of a deleted feature become top level, links to it are removed, a
   contradiction left with no feature is removed; no edition bump. 52 features stay (32 listed, 20 merged).

Not changed because the batches do not clearly finish them: command/transaction log (the batches use labelled
snapshots), reusable ensemble templates (pieces still keep a full copy as the fallback).

## Scope

- In scope: the research data (`ensemble-2026-10-23.*.ts`) only. No UI or code change. G-298 is closed.

## Consequences

- Positive: the research list shows only what is left after the batches.
- Negative / risks: as in ADR-149, the deleted features' research is no longer shown.
- Harder to change later: restoring a deleted feature means taking it from git history.

## Done when

- [x] The 13 features above are gone and the 4 rows updated; the bundle validates (`validateBundle`, run once)
- [x] `pnpm test`, lint, format, typecheck, build and docs check pass
