# ADR-022: Projects: several pieces placed in one room, with combined parts and storage version 2

- Status: Implemented
- Date: 2026-10-21
- Implemented: 2026-10-21
- Decided by: open questions answered by the user
- Depends on: none
- Design: n/a
- Related: ADR-004, ADR-011, ADR-012, ADR-018
- Backlog: N04

## Context

A kitchen or a bedroom is several pieces that are bought and cut together. Today each design is one cabinet or
one desk (ADR-011) and the library is a flat list (ADR-012).

## Decision

Add a `Project { schemaVersion: 1, id, name, items: [{ designId | embedded design, quantity, position {x,y,z},
rotationY: 0|90|180|270 }] }`. Pieces keep their own design documents; a project references or embeds them, so a
design is still usable alone. The project model is the union of each item's `FurnitureModel` translated/rotated in
whole millimetres and quarter turns, then checked for overlaps between pieces. The parts list, hardware and nesting
(ADR-018) aggregate across items. Storage adds a `projects` table in **Dexie version 2**; version 1 stays untouched
(ADR-012).

## Alternatives considered

- **One giant design with several roots** — loses reuse of a piece across projects.
- **Arbitrary rotations** — breaks the axis-aligned box model (ADR-004); quarter turns cover rooms.

## Consequences

- A quarter-turn rotation must keep integer coordinates (rotate about the piece origin, then translate).
- The 3D view shows the whole room; the elevation stays per piece.

## Evidence (repository files)

- `src/core/project.ts` — `Project`, `ProjectItem` (embedded copy, quantity, position, quarter turn, `libraryId`), `placeItem`/`rotateBox`, `buildProjectModel` (pieces' errors and piece-to-piece overlaps), `projectCutlist`, `projectHardware`, `projectNestingJobs`, `validateProject`.
- `src/persist/db.ts` — Dexie `version(1)` unchanged, `version(2)` adds `projects`; save/list/load/delete.
- `src/store/designStore.ts` — open/close project, add/update/remove pieces, edit a piece (changes written to the embedded copy, undo/redo included), back to project.
- `src/ui/Project.tsx` — pieces panel, top-down plan, add-piece list; `src/ui/useView.ts` — one view for piece or project used by parts, sheets, hardware, checks, 3D and print.
- `tests/project.test.ts` — quarter turns, placement, overlap, combined parts × quantity, nesting, storage v2; browser run: import, plan, edit piece, reload, project print.

## Addendum 2026-10-22: gaps between pieces (user request, backlog N13)

The selected piece shows _Gap to <piece> on the left_: the nearest piece on its left in the same run (height and
depth ranges overlap, so wall cabinets are their own run). Changing it moves the piece along the wall and, by
default, the pieces on its right in the same run by the same amount. The gap is derived from positions, never
stored, so the project format is unchanged. `leftNeighbour`, `setGapLeft` in `src/core/project.ts`; tests in
`tests/explode.test.ts`.

## Compliance check

When accepted: `db.ts` declares `version(1)` unchanged and `version(2)` adding `projects`; a test asserts combined
parts equal the sum of each piece's parts times quantity.

## Answers (2026-10-21, from the user)

- **Library edits do not flow into projects.** A project embeds a copy of each piece; an explicit
  _Update from library_ action pulls the current saved version on request.

Built and accepted 2026-10-21. Projects embed copies; “Update from saved piece” pulls library changes on request (user answer).
