# ADR-177: Fill the room: wall corner cabinets and wall rows beside windows

- Status: Pending
- Date: 2026-11-05
- Depends on: ADR-173, ADR-025, ADR-011
- Design: docs/ui-design.md (section 4, Fill a wall)
- Backlog: N180
- Agreed: 2026-11-05 "Fix, then sort by priority to implement, start 5 adrs"; answers "Match; diagonal → wall L" and
  "Fill each side as a row"

## Context

Two gaps of ADR-173's Fill the room (`src/core/roomfill.ts`):

- G-350: no wall corner cabinet at an inside corner. The wall rows start after the base corner cabinet's depth and
  leave the corner above it empty. The catalog has a wall blind corner (`corner-blind-wall`) and a wall L-shaped
  corner (`corner-l-wall`), no wall diagonal corner.
- G-349: a wall cabinet that would overlap a window is left out whole, so a gap wider than the window can stay open.

User, 2026-11-05: **"Match; diagonal → wall L"** — blind base → wall blind corner, L-shape base → wall L corner,
diagonal base → wall L corner; and **"Fill each side as a row"** — the stretches left and right of a window become
their own wall rows, sized to stop at the window edge.

## Decision

1. Where the wall row is on for both walls of an inside corner with a corner cabinet, the mix adds a wall corner
   cabinet above it, from the catalog template by kind (blind → `corner-blind-wall`, l-shape and diagonal →
   `corner-l-wall`), at the wall row's height and mount, sized along each wall to the wall depth of the rows. Each
   wall row then starts where the wall corner ends on its wall. Corner kind "none" adds none.
2. A window splits the wall row's stretch: each free part (`freeStretches` already gives the window range) is filled
   as its own wall row with `wallRowFor`, so the row stops at the window edge. A part too narrow for any wall
   cabinet stays empty, as a free stretch does today.
3. Mixes are still kept only without error diagnostics; deterministic for the same input (ADR-173).
4. Corner pieces get the cabinets' stands/hangs setting (`CornerParams.mount`, `mountHeight`; absent = floor),
   offered under Stands on. A hung corner has no plinth and no automatic brackets or rail: one hardware line, "Wall
   hanging brackets: choose for this corner unit", with no count (ADR-010). The wall corner templates are hung.
   Design `schemaVersion` 7; versions 1 to 6 still load (ADR-011). User 2026-11-05: "Add wall mount to corners",
   "Note only, you choose", "Bump to 7".

## Alternatives considered

- **Diagonal base → no wall corner** — leaves one case unfilled until a wall diagonal exists. Not chosen.
- **Always a wall blind corner** — does not match an L or diagonal base below. Not chosen.
- **Keep leaving out whole cabinets at a window** — no work; the gap stays. Not chosen.

## Scope

- In scope: wall corners and window-split wall rows in `suggestRoomMixes` / `roomProject`, from New… and from a
  project's ⋯ menu.
- Out of scope: a wall diagonal corner template (not asked); openings in the New dialog stay G-348.

## Consequences

- Positive: the wall row is continuous round corners and up to each window.
- Negative / risks: more pieces per mix; the 60-build bound of ADR-173 may drop low-ranked mixes sooner.

## Done when

- [ ] An L room with a blind corner gets a wall blind corner above it; an L-shape or diagonal corner gets a wall L
      corner; corner "none" gets none (tests)
- [ ] A wall with a centred window gets wall cabinets on both sides, none overlapping the window, the nearest within
      one cabinet step of each window edge (tests)
- [ ] A hung corner has no plinth, no `placement-not-hung` warning and one "choose brackets" line; a v6 design still
      loads (tests)
- [ ] Seeded random rooms never throw and never offer an erroring mix; same input, same mixes (tests, fuzz)
- [ ] Fill the room → a mix with a corner lists a wall corner piece (the wall L or wall blind corner) in its piece list at 390 and
      1280 px (jsdom find-it)
