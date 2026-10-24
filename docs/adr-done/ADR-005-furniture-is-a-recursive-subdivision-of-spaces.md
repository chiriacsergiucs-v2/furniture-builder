# ADR-005: Furniture is a recursive subdivision of spaces

- Status: Implemented
- Date: 2026-10-21
- Implemented: 2026-10-21
- Depends on: none
- Design: n/a
- Related: ADR-006, ADR-007

## Context

Cabinetmakers design casework by dividing the inside of a box: split this bay, put drawers here, shelves there,
doors over that. Established cabinet software works the same way. A fixed menu of templates cannot express that.

## Decision

A cabinet's interior is a tree of `Space` nodes. A space is `empty`, `shelves(count)`, `drawers(count)`,
`hanging(railDrop)`, or `split(axis, sizes[], children[])`; any space may also carry `doors(1|2)`. Split sizes are
`mm` (fixed) or `fr` (share of the remainder). Dividers between split parts are real panels. Doors over a space that
contains drawers make those drawers _internal_ (no applied fronts, set back for hinge clearance). Tree edits are pure
functions (`mapSpace`, `changeKind`, `splitSpace`, `unsplit`) that preserve node ids.

## Alternatives considered

- **Template catalogue with parameters** — rejected as the core: templates are kept only as starting points.
- **Free-form 3D placement of panels** — rejected: loses the structural meaning needed for gaps, fronts and checks.

## Consequences

- Children read only their parent's opening; there are no sibling references.
- Unequal drawer heights, adjustable shelves and corner units are future node options, not new engines.

## Evidence (repository files)

- `src/core/types.ts` — `Space`, `SplitSpace`, `DoorsFront`.
- `src/core/cabinet.ts` — `visit()` handles each kind.
- `src/core/design.ts` — tree operations and templates built from spaces.
- `tests/core.test.ts` — splits, internal drawers, doors-inside-doors.

## Compliance check

Every template in `templates` is a cabinet space tree or a desk; no template contains geometry of its own.
