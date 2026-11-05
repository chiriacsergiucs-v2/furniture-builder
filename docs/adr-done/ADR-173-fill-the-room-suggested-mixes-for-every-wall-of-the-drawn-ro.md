# ADR-173: Fill the room: suggested mixes for every wall of the drawn room with corner cabinets

- Status: Implemented
- Date: 2026-11-04
- Implemented: 2026-11-05
- Depends on: ADR-025, ADR-058, ADR-100, ADR-103, ADR-104
- Design: docs/ui-design.md (section 4, Fill a wall)
- Backlog: N176
- Agreed: 2026-11-04 "Now do the high appreciation features, similar way"; answer "Fill the room"

## Context

The research feature _Deterministic generation of alternative valid layouts_ (rank 26, appreciation High, P2) is
_in progress_: "alternative layouts of a whole project". Built: suggested combinations per piece (ADR-045) and
**Fill a wall** (ADR-103, ADR-104): four ranked mixes for one straight wall, each a project built through
`buildProjectModel()` and kept only without errors. Open gaps: corner and L walls (G-113), openings shaping the
mix (G-114), room presets (G-025). User (2026-11-04): fill the room.

## Decision

- **Entry:** **Fill the room** on the Projects page and in Start something new, beside Fill a wall; and in a project
  that has a drawn room (ADR-058/059), Project ⋯ → **Fill the room…** (adds to the open project). Steps: **Room**
  (pick or draw a room, ADR-059; the heights of ADR-103's Wall step) → **Walls** (tick which walls to fill; every
  wall of the outline is ticked by default) → **Suggestions** (4 cards) → **Refine** → **Use this mix**.
- **Per wall:** each ticked straight wall is filled with ADR-103/104's rules over its **free stretches**: a door
  or a window on the wall (`RoomFeature`) is left free — a door its full width plus the swing (ADR-058), a window
  only above the base height, so base units may run under a window whose sill is above them and wall cabinets
  stop at it (G-114 closes). A stretch shorter than `minWidth` stays empty and the card says so.
- **Corners:** at each inside corner where two ticked walls meet, a catalog **corner cabinet** (ADR-025, blind
  corner by default; Refine offers L corner) takes the corner, sized to the two depths; the walls' stretches start
  after it. An outside corner (an L or U room's protruding corner) ends both runs with a cover panel suggestion
  as today (ADR-036). Wall cabinets meet in the corner with the same rule (a wall corner cabinet when the catalog
  has one, else the row stops `depth` short).
- **One mix = one project:** every mix is built as a `Project` with the room, through `buildProjectModel()`
  (ADR-004), and kept only when it has no error diagnostic — overlaps, room checks (ADR-058), pipes and outlets
  (ADR-072), compatibility rules (ADR-100). Ranking as ADR-103, then fewest warnings, then fewest pieces. At most 4
  cards shown; `suggestMixes` stays bounded (each wall's candidate list is cut to the best 6 before combining).
  Deterministic: the same room and settings give the same mixes.
- **Core:** `src/core/roomfill.ts`, pure: `freeStretches(room, wall, heights)`, `cornerPlan(room, walls)`,
  `suggestRoomMixes(input)`; reuses `wallfill.ts` per stretch. **Refine** keeps ADR-103/104's fields, applied to
  every wall, plus the corner kind.
- **Use this mix:** a new project (or the pieces added to the open one, selected, one undo step), with the room.
- Research record: _Deterministic generation of alternative valid layouts_ becomes Verified when this ships;
  _Layout optimisation_ and _Budget and style filters_ (its children) stay as they are (G-341).

## Alternatives considered

- **Rearrange the existing pieces** — alternatives for placed pieces; the user chose filling the room.
- **One wall at a time, by hand, with a corner cabinet dropped in between** — possible today, but not "alternative
  layouts of a whole project".
- **Room presets (kitchen / wardrobe / desk)** — fixed layouts, not generated; stays G-025.

## Scope

- In scope: the entry points, the Walls step, free stretches around doors and windows, corner cabinets, whole-room
  mixes built and checked as projects, Refine, Use this mix, tests, fuzz on random rooms.
- Out of scope: budget and style filters and layout optimisation (G-341); islands and peninsulas (G-342); mixing
  room kinds, e.g. a kitchen run and a desk in one mix (G-025 remainder).

## Consequences

- Positive: a whole room of valid alternatives in one go; closes G-113 and G-114.
- Negative / risks: combinations grow with the number of walls; the per-wall cut keeps it bounded, at the cost of
  missing some mixes. Corner cabinets sized to two different depths need the catalog's corner rules (ADR-025).
- Harder to change later: none; mixes are ordinary projects.

## Done when

- [x] A rectangular room with a door and a window gives 4 mixes; no piece overlaps the door or its swing, base
      units run under the window, wall cabinets stop at it (tests)
- [x] An L room gets a corner cabinet at the inside corner and both runs start after it; the same input gives the
      same mixes twice (tests)
- [x] Every offered mix has no error diagnostic; seeded random rooms never throw and never offer an erroring mix
      (tests, fuzz)
- [x] Fill the room from Projects and from a project's ⋯ menu; Use this mix opens the project with the room
      (jsdom find-it, 390 and 1280 px)
- [x] Russian entries for every new text; the feature tree gains "Fill the room" (ADR-158)
