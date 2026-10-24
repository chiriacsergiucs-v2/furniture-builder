# ADR-014: The front elevation is the editing surface; 3D is a non-authoritative preview

- Status: Implemented
- Date: 2026-10-21
- Implemented: 2026-10-21
- Depends on: none
- Design: n/a
- Related: ADR-004, ADR-013

## Context

Cabinetmakers sketch the front view and divide it. Editing in 3D on a phone is slow and imprecise.

## Decision

The primary canvas is an SVG front elevation drawn from the model: structure solid, fronts dashed, each leaf space
a tap target, with tape-yellow overall dimensions and the selected space's width. Tapping a space opens its editor
(contents, count, doors, divide, sizes). The 3D view renders the same panels, highlights the selection and rows
hovered in the parts list, and selects the owning space on click, but never edits geometry. On wide screens both
views show side by side; otherwise a toggle switches them. Without WebGL, the 3D view shows a message and everything
else works.

## Alternatives considered

- **3D-first editor** — rejected for precision and phone use.

## Consequences

- Split containers are selected via breadcrumb or "select the divided space around this one".

## Evidence (repository files)

- `src/ui/Elevation.tsx`, `src/ui/Inspector.tsx`, `src/viewer/Viewer3D.tsx`, `src/ui/App.tsx`.

## Addendum 2026-10-22: exploded 3D view (user request, backlog N12)

An _Exploded 3D_ toggle spreads the panels of the 3D preview: each panel's centre moves away from its piece's centre
by half their distance again, and each piece away from the room's centre; sizes never change and the lowest panel
stays on the floor. Pure function `explode()` in `src/core/explode.ts`; display only, parts/sheets/checks use the
built model. `tests/explode.test.ts` and the fuzz test check that exploded panels never overlap.

## Compliance check

Viewer has no write path: `grep -n "update" src/viewer/Viewer3D.tsx` shows only `select`.
