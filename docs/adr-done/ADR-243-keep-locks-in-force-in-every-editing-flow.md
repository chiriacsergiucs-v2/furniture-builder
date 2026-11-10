# ADR-243: Keep locks in force in every editing flow

- Status: Implemented
- Date: 2026-11-10
- Implemented: 2026-11-10
- Depends on: none
- Design: n/a
- Backlog: N253

## Context

The user asked (2026-11-10) to map "all the possible actions a user can do when he is in the piece modifying or item
modifying process", then to "combine, 1 PR to cover it all", fixing everything found. The map (15 sub-flows) found
flows where a lock set with ADR-095, ADR-122, ADR-171 or ADR-211 did not hold:

- `removeItem` and `deleteSelection` removed a placement-locked piece (no lock check, `src/store/designStore.ts`).
- `mergeItems` made a new piece with a new id, so the size, turn, boards and construction checks never saw it
  (`src/core/merge.ts`).
- "Mirror the run" checked only the placement lock (`mirrorSet`, `src/core/arrange.ts`), while mirroring one piece
  also refuses a turn lock.

## Decision

- **Remove:** a placement-locked piece is not removed, alone or in a selection. New `removeBlocked` in
  `src/core/project.ts` names it: "{name} is locked — unlock it to remove it." (decided by Claude: the placement
  lock is the one that means "leave this piece where it is").
- **Merge:** a size, turn, boards or construction lock on either piece is a merge issue ("One of them has its size,
  turn, boards or construction locked; unlock it first."). The placement lock keeps carrying over (ADR-047).
- **Mirror the run:** `mirrorSet` checks `turnBlocked` after `moveBlocked`, as `mirrorItem` does.

## Alternatives considered

- **Let Remove ignore locks** (status quo) — a lock that a tap on Remove undoes is not a lock.
- **Drop the locks onto the merged piece** — would silently change what the user locked (a width lock on a
  600 mm piece would hold a 1200 mm one).

## Scope

- In scope: Remove, Delete of a selection, Merge, Mirror the run.
- Out of scope: new pieces dropped or tapped onto the plan (`addPieceAt`, `placeAt`) have no lock or group yet, so
  there is nothing to check.

## Consequences

- Positive: every lock the user sets holds in every flow that changes the piece.
- Negative / risks: removing a locked piece takes one more step (unlock first).

## Done when

- [x] A placement-locked piece is not removed by Remove or by Delete of a selection; the notice names it
      (`tests/editing-flows.test.ts`)
- [x] Merge refuses a size-, turn-, boards- or construction-locked piece (`tests/editing-flows.test.ts`)
- [x] Mirror the run refuses a turn-locked piece (`tests/editing-flows.test.ts`)
- [x] Find-it: Lock → Remove from project shows "is locked — unlock it to remove it" at 390 and 1280 px
      (`tests/find-it/editing-flows.test.tsx`)
