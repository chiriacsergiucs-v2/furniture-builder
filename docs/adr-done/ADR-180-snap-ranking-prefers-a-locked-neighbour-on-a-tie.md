# ADR-180: Snap ranking prefers a locked neighbour on a tie

- Status: Implemented
- Date: 2026-11-05
- Implemented: 2026-11-05
- Depends on: ADR-070, ADR-171
- Design: n/a
- Backlog: N183
- Agreed: 2026-11-05 "Proceed similarly with next 5 adrs"; answer "Tie-break: locked first"

## Context

Gap G-338 (ADR-171): snap ranking does not prefer locked neighbours (research: "snap ranking considers user locks").
`snapDrag` (`src/core/snap.ts:255`) ranks candidates in range by distance, then kind (corner, wall, neighbour side,
neighbour centre, ADR-099), then id.

User, 2026-11-05: **"Tie-break: locked first"** — among candidates the ranking scores equally, a locked neighbour's
side wins; nothing else changes.

## Decision

1. The ranking becomes distance, then **locked** (a neighbour candidate whose piece has any lock — position, ADR-095;
   turn or a size, ADR-171 — before one whose piece has none), then kind, then id. Walls and corners count as not
   locked. User 2026-11-05: "Any lock".
2. Only equal distances are affected; a closer unlocked side still wins.

## Alternatives considered

- **Locked first within range** — any locked neighbour beats closer ones; can snap farther than aimed. Not chosen.

## Scope

- In scope: `snapDrag` ranking on the plan and in 3D Move mode (same function).

## Consequences

- Positive: a drag between a fixed piece and a free one lands on the fixed one.
- Negative / risks: none beyond the changed tie order.

## Done when

- [x] Two neighbour sides at the same distance: the locked piece's side wins (position, turn or size lock); unlocked first when the locked side is
      1 mm farther (tests)
- [x] Existing snap tests and the fuzz stay green (tests, fuzz)
