# ADR-058: The project has a room: walls, doors, windows and obstacles, checked against the pieces

- Status: Implemented
- Date: 2026-10-24
- Implemented: 2026-10-24
- Decided by: user, 2026-10-24: "create the ADRs … auto-accept the recommended suggestion" (answers below)
- Depends on: ADR-022, ADR-031, ADR-057
- Design: docs/ui-design.md (project panel → Room; Plan view; 3D)
- Backlog: N55

## Context

Research feature _Room/wall geometry, windows, doors and obstacles_ (rank 16, value 4.5, P0; Roomle, Planner 5D,
HomeByMe, IKEA Kitchen). Today a project has an implicit back wall at z = 0 and side wall at x = 0; the plan draws
"Back wall" and measures the pieces' overall size (`RoomPlan`, `RoomFront` in `src/ui/Project.tsx`). There is no
room size, no openings and no obstacles, so a run that is wider than the wall, or a tall unit in front of a window,
is not noticed.

## Decision

- **Optional `room` on `Project`** (absent = today's behaviour; no schema bump):
  `{ width, depth, height, features: RoomFeature[] }`, whole mm, x along the back wall, z away from it (ADR-003).
- **RoomFeature** = `{ id, kind: 'door' | 'window' | 'obstacle', wall: 'back' | 'left' | 'right' | 'front' | 'floor',
from, width, sill, height, depth? , label }`:
  - door: opening in a wall from the floor; its swing zone (door width deep, into the room) must stay free;
  - window: opening with a sill height; pieces taller than the sill in front of it get a warning;
  - obstacle: a box (pipe, radiator, socket zone, column) on a wall or the floor.
- **Checks** (diagnostics in the project problem list):
  - piece outside the room → **error** `outside-room`;
  - piece overlapping an obstacle → **error** `hits-obstacle`;
  - piece in a door's swing zone → **warning** `blocks-door`;
  - piece above the sill in front of a window → **warning** `covers-window`;
  - ADR-057's opening clearances also check walls and obstacles.
- **UI:** Project → **Room** section: width, depth, height; _Add door / window / obstacle_ rows with mm fields. The
  plan and front views draw the walls, openings (gaps in the wall line, door swing as a quarter outline) and
  obstacles (hatched).
- Rectangular room only here; other shapes are ADR-059.

## Alternatives considered

- **Free-angle walls** — break the axis-aligned model (ADR-004) and every check built on boxes.
- **Room drawn only, not checked** — the research value is the validation against the room.

## Scope

- In scope: room outline, height, doors, windows, obstacles and their checks.
- Out of scope: angled walls, sockets and pipes as separate kinds.

## Consequences

- Old projects open without a room and behave as today; adding a room may reveal errors, which block export until
  fixed (ADR-008) — the message says which piece and by how much.
- The 3D view shows the floor and the walls as thin translucent boxes, openings as gaps.

## Done when

- [x] Piece past a wall → `outside-room`; obstacle hit → `hits-obstacle`; tall unit against a window wall above the sill → `covers-window`; piece in a door swing → `blocks-door`; feature past its wall → `room-feature`; no room → no new diagnostics (`tests/room.test.ts`)
- [x] find-it `tools/ensemble/find-it-adrs.mjs` (80/80, 1440 and 375 px): **Add the room** → walls and _Room height_ listed, the plan draws the outline; **Add obstacle** → _runs into Obstacle 1_; **Add window** (sill 500) → the plan shows it and Checks say the cabinets _cover the window_

## Answers

1. _Room shape in this step?_ — **Rectangle; other shapes in ADR-059.**
2. _Which severities?_ — **Outside the room and hitting an obstacle = error; blocking a door or covering a window =
   warning.**
3. _Required for every project?_ — **No, optional; old projects unchanged.**
4. _Show walls in 3D?_ — **Yes, thin translucent walls and floor.**

## Implementation notes

`src/core/room.ts` (`Room` with an **outline** from the start, so ADR-059 needs no second model; `roomChecks`, `featureBox`, `roomDisplayBoxes`), `Project.room`, checks in `buildProjectModel`; Project → **Room** (_Add the room_ / _Draw the room_, shape, height _Measure your ceiling_ — starting value 2500 mm, walls, _Add door / window / obstacle_, _Remove the room_); plan draws walls, door swings, windows, obstacles; 3D shows translucent walls with openings, the floor inside the outline and obstacles (`src/viewer/Viewer3D.tsx`). Features sit on a wall by number (or free-standing for obstacles). "Covers the window" applies to pieces standing against that wall (within 50 mm). Tests: `tests/room.test.ts`. find-it `tools/ensemble/find-it-adrs.mjs` (production build, bare app, visible text, 1440 and 375 px): 60/60: room added, _runs into Obstacle 1_. After review: a feature past its wall is an error (`room-feature`); the window warning says _covers the window_; door swings are drawn as quarter circles; the front view outlines the room height and the back-wall doors, windows and obstacles.
