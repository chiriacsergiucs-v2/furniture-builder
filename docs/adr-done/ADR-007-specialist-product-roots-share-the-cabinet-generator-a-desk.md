# ADR-007: Specialist product roots share the cabinet generator; a desk pedestal is a cabinet

- Status: Implemented
- Date: 2026-10-21
- Implemented: 2026-10-21
- Depends on: none
- Design: n/a
- Related: ADR-004, ADR-005

## Context

A desk is not a cabinet with extra panels, but its drawer unit is exactly a cabinet. Duplicating drawer logic for
desks would drift.

## Decision

`Product` is `cabinet` or `desk`. A desk builds its worktop, gables and modesty panel itself and builds each
pedestal by calling `buildCabinet` with an id prefix, an origin offset and node ids mapped to the desk. New families
(beds, wardrobes with sliding doors, kitchens) get their own root and reuse `buildCabinet` where a carcass exists.

## Alternatives considered

- **One universal root** — rejected: forces fake panels on non-casework furniture.

## Consequences

- Pedestal internals are editable spaces (ADR-026).
- Desk checks cover knee space, clear height and fronts standing proud of the worktop.

## Evidence (repository files)

- `src/core/desk.ts` — `pedestalParams`, `buildDesk` calling `buildCabinet`.
- `tests/core.test.ts` — "pedestal desk reuses the cabinet generator".

## Compliance check

`grep -n "buildCabinet" src/core/desk.ts` shows the reuse; there is no drawer code in `desk.ts`.
