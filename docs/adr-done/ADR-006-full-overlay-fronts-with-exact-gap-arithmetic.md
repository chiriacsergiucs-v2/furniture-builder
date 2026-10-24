# ADR-006: Full-overlay fronts with exact gap arithmetic

- Status: Implemented
- Date: 2026-10-21
- Implemented: 2026-10-21
- Depends on: none
- Design: n/a
- Related: ADR-003, ADR-005

## Context

Door and drawer-front gaps are the most visible quality signal in finished furniture and the easiest to get
wrong across nested dividers.

## Decision

Fronts sit in front of the carcass (`z ∈ [depth, depth + front thickness]`) and overlay it. Each space carries a
*front zone*: at outer carcass edges a front stops `floor(gap/2)` short of the edge; across an inner divider the
neighbouring fronts meet at the divider's centre line minus `floor(gap/2)` and `ceil(gap/2)`, so the gap between any
two neighbouring fronts is exactly `frontGap`. Drawer fronts in a space are separated by `frontGap`.

## Alternatives considered

- **Inset fronts** — deferred: needs per-edge reveal settings; can be added as a cabinet option later.
- **Half-overlay** — deferred for the same reason.

## Consequences

- The fuzz test checks exact gaps and outer reveals on every buildable random design.
- Gap 0 is allowed (fronts touching), with no special case.

## Evidence (repository files)

- `src/core/cabinet.ts` — `FrontZone`, split front-zone propagation, door and drawer-front placement.
- `tests/core.test.ts` — chest and sideboard gap tests; `tests/fuzz.test.ts`.

## Compliance check

`npx vitest run` passes the sideboard gap test and the fuzz test.
