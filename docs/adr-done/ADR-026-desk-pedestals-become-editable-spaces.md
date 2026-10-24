# ADR-026: Desk pedestals become editable spaces

- Status: Implemented
- Date: 2026-10-21
- Implemented: 2026-10-21
- Decided by: open questions answered by the user
- Depends on: none
- Design: n/a
- Related: ADR-005, ADR-007, ADR-014
- Backlog: N08

## Context

Desk pedestals are built by the cabinet generator (ADR-007), but their spaces are hidden, so the user can only
change the drawer count, not divide or mix contents.

## Decision

Store a full `Space` tree per pedestal in `DeskParams.pedestal.interior` (default: today's drawers), pass it to
`buildCabinet` and expose its openings in `model.spaces` with real node ids instead of mapping everything to the desk.
The elevation then lets the user tap a pedestal space like any cabinet space. `drawerCount` stays readable for old
designs and is converted in memory.

## Alternatives considered

- **Keep pedestals fixed** — simpler, but users ask for a file drawer or an open shelf.

## Consequences

- Selection, breadcrumbs and the inspector already work on spaces; no new UI concept.

## Evidence (repository files)

- `src/core/types.ts` — `DeskParams.pedestal.left/right?: Space`.
- `src/core/design.ts` — `pedestalRoot`, `productRoots`, `findInProduct`, `mapProductSpace`; validation of pedestal trees.
- `src/core/desk.ts` — pedestals built from their own trees; spaces exposed in the model.
- `src/store/designStore.ts`, `src/ui/Inspector.tsx`, `src/ui/Elevation.tsx` — pedestal spaces selectable and editable.
- `tests/core.test.ts` — "editable desk pedestals (ADR-026)".

## Compliance check

When accepted: a desk test selects a pedestal space id from `model.spaces` and changes it to shelves.

## Answers (2026-10-21, from the user)

- **Pedestals are independent:** left and right drawer units each have their own space tree.

Built and accepted 2026-10-21.
