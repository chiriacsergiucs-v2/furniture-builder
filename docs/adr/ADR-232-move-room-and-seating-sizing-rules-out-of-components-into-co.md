# ADR-232: Move room and seating sizing rules out of components into core

- Status: Pending
- Date: 2026-11-07
- Depends on: none
- Design: n/a
- Backlog: N237

## Context

User, 2026-11-07 (the architecture review request): "current code structure/architecture modularity and overall
design analysis ... complete code quality critique and suggest architectural improvements ... No regressions shall
be introduced, ensure before and after testing tdd style". User, 2026-11-07: "full autopilot and ownership grant to
run in parallel as you see fit agents to cover the entire i1 to i20, draft adrs in 1 pr then do batches. Goal is to
have them all done and merged with no regressions introduced then stop".

This ADR is improvement **I-14** of `docs/retros/2026-11-07-architecture-review.md` (sections 7 and 8). The
choices below were decided by Claude under the user's ownership grant, 2026-11-07; no question is left open.

Sizing decisions live in components, against ADR-004 ("never compute geometry in UI code"): the room auto-size in
`RoomSection` (`src/ui/Project.tsx`, `Math.max(3000, …)` and `deep + 1000`) and seating defaults in
`src/ui/Editors.tsx` (footrest 380, arms +220, backrest `min(650, width / 3)`). The same yaw → front-edge ternary is
duplicated in `Project.tsx` and `src/viewer/Models3D.tsx`. Values stay exactly as today; no physical value is invented
(ADR-010): the constants keep their labels as defaults.

## Decision

Decided by Claude under the user's ownership grant, 2026-11-07.

- `suggestRoomSize(pieces)` in `src/core/room.ts` returns the size the component computes today.
- `seatingDefaults(width, …)` in the core module that owns seating (`src/core/desk.ts`, or the module that holds the
  seating params if it is not the desk) returns the footrest, arm and backrest defaults.
- `frontEdge(yaw)` in `src/core` replaces the duplicated ternary in `Project.tsx` and `Models3D.tsx`.
- The components call these functions; the constants 3000, 1000, 380, 220 and 650 move with them, named.

## Alternatives considered

- **Leave the display-only ternary in place** — two copies drift; one helper costs nothing.
- **Move the constants to a settings table** — invents a user setting nobody asked for.
- **Leave as is** — ADR-004 stays broken in two places.

## Scope

- In scope: the three functions, their callers, unit tests.

## Consequences

- Positive: sizing rules are tested in core; ADR-004 holds.
- Negative / risks: none beyond a moved constant; values are pinned by tests first.
- Harder to change later: nothing.

## Done when

TDD (review section 9): every item starts from a test written first that pins today's behaviour and passes on
`main` before the change; the change keeps it green (or turns the stated red test green).

- [x] (test first) unit tests pin today's results: `suggestRoomSize` for an empty room, one piece and a deep piece;
      `seatingDefaults` for three widths (backrest at the `width / 3` and 650 boundaries); `frontEdge` for 0, 90,
      180 and 270°. Evidence: `tests/sizing-defaults.test.ts` (13 tests: `suggestRoomSize (ADR-232)`,
      `seatingDefaults (ADR-232)`, `frontEdge (ADR-232)`).
- [x] (test first) jsdom find-it at 390 and 1280 px: the room section shows the same suggested room width text as
      before for a sample project. Evidence: `tests/find-it/room-suggested-size.test.tsx` (sideboard → Add the room →
      "Rectangle · 3000 × 3000 × 2500 mm", 1280 and 390 px), green on the unchanged UI and after the move.
- [x] No sizing literal (3000, 1000, 380, 220, 650) remains in those components (checked by `rg`).
      Evidence: the moved room auto-size, seating defaults and front-edge ternary are gone from `Project.tsx`,
      `Editors.tsx` and `Models3D.tsx` (grep); unrelated uses of the same numbers (field maxima, the plan's 1000 mm
      minimum span) stay.
- [x] `pnpm lint`, `pnpm format:check`, `pnpm typecheck`, `pnpm test`, `pnpm build` and `pnpm docs:check` pass; the
      test count is not lower than on `main` before the change (review section 9).
      Evidence (run 2026-11-07, local): all six pass; `pnpm test` 1761 tests, 1746 before. The failures in that run also
      fail on the base before the change, or are find-it timeouts under machine load that pass when run alone.
