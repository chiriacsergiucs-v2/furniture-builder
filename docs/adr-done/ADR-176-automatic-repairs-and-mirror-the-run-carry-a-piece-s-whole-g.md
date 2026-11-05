# ADR-176: Automatic repairs and Mirror the run carry a piece's whole group

- Status: Implemented
- Date: 2026-11-05
- Implemented: 2026-11-05
- Depends on: ADR-148
- Design: docs/ui-design.md (section 3, problem banner)
- Backlog: N179
- Agreed: 2026-11-05 "Fix, then sort by priority to implement, start 5 adrs"; answer "Carry group, refuse"

## Context

Gap G-293 (ADR-148): automatic repairs from the problem banner and Mirror the run can still move one grouped piece
without its group. Repairs move a single piece (`moveItem`, `src/core/repairs.ts:63`) and the banner applies them
with a plain `updateProject` (`src/ui/ProblemBanner.tsx:53`). The store's `mirrorRun`
(`src/store/designStore.ts:1112`) mirrors the touching run only; mirroring one piece already carries its group
(`designStore.ts:1097`).

User, 2026-11-05: **"Carry group, refuse"** — the whole group moves together; a repair the group cannot follow is
refused, with the reason shown.

## Decision

1. Each repair that moves pieces is passed through `carryUnits(before, after, lead)` (`src/core/connections.ts`),
   the same carry drag uses (groups, and connected pieces per ADR-168). A repair whose carry gives a reason stays in
   the list, disabled, with "Refused: {reason}" under it; it cannot be applied.
2. Mirror the run widens the run with `withGroups` before `mirrorSet`, so every member of a group touching the run
   mirrors with it. A group that cannot mirror refuses the whole action with the reason (`refused`), as today.
3. Repairs and the mirror stay one undo step each.
4. The banner lists up to 4 working repairs and up to 4 refused ones; a move is listed as refused only when it
   would work for the piece alone (user 2026-11-05: "4 working + 4 refused").

## Alternatives considered

- **Carry the group, else move the piece alone with a warning** — the repair always applies, but the group can still
  break, which is the bug. Not chosen.
- **Ungroup, then repair** — silently changes the user's grouping. Not chosen.

## Scope

- In scope: problem-banner repairs, Mirror the run.
- Out of scope: none new; group width for pieces not in columns stays G-290.

## Consequences

- Positive: a group never splits by an automatic action.
- Negative / risks: fewer repairs apply in crowded rooms; each refusal says why.

## Done when

- [x] A repair on a grouped piece moves every member by the same offset (tests)
- [x] A repair the group cannot follow is offered disabled with "Refused:" and its reason; applying is impossible
      (tests)
- [x] Mirror the run on a run with a grouped piece mirrors the whole group (tests)
- [x] Problem banner → a refused repair shows its reason at 390 and 1280 px (jsdom find-it)
- [x] Russian entries for every new text
