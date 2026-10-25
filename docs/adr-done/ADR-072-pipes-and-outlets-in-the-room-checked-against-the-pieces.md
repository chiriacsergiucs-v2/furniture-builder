# ADR-072: Pipes and outlets in the room, checked against the pieces

- Status: Implemented
- Date: 2026-10-24
- Implemented: 2026-10-25 (Merged to main; CI run 40170561018 and Deploy GitHub Pages run 40170561007 green on 895eb54)
- Depends on: ADR-058
- Design: docs/ui-design.md (Room panel, Plan view)
- Backlog: N67

## Context

The user, 2026-10-24, on the Feature Research & Catalog selection: "Identify the features and subfeatures
necessary for the following items from research. Import 3D models and model libraries · Duplicate, mirror and
predictable rotate operations · Also for these: [14 features marked Interested]", then "Draft adrs for each".

Research row: _Pipes and outlets_ (sub-feature of room geometry, P1 assessed). The room already has walls, doors,
windows and obstacles checked against the pieces ([ADR-058](../adr-done/ADR-058-the-project-has-a-room-walls-doors-windows-and-obstacles-chec.md)); pipes and outlets are missing.

## Decision

- `RoomFeature.kind` gains `'pipe' | 'outlet'`, placed on a wall like a window: `wall`, `from`, `sill` (height
  above the floor), `width` and `height` (the zone), `depth` 0. Older app versions reject unknown kinds, so
  the project `schemaVersion` goes up by one (the next free number when this ships; projects are at 1 today) and older files still load (ADR-011).
- **Room panel:** _Add pipe_ and _Add outlet_ next to _Add window_; shown on the plan and in the room front view as
  a small marked zone.
- **Checks (warnings, never errors):**
  - a cabinet back, plinth or worktop covering a pipe or outlet zone → warning "Pipe behind Base 600: cut the
    back or move the piece"; a sink base over a pipe is expected and gives no warning;
  - an outlet hidden behind a tall unit → warning.
- Nothing is cut automatically; the cut-out is the user's decision (ADR-010).

## Alternatives considered

- **Model pipes as obstacles** — an obstacle is an error zone; a pipe behind a sink base is normal.

## Scope

- In scope: two feature kinds, panel buttons, drawing, two warnings.
- Out of scope: automatic back cut-outs, electrical rules, pipe routing.

## Consequences

- Positive: kitchens are planned against the services that are really on the wall.
- Harder to change later: the two kinds are saved in projects.

## Done when

- [x] Pipe and outlet validate and round-trip in project files; the project `schemaVersion` is bumped and older
      files load (unit tests)
- [x] A base unit over a pipe warns; a sink base does not (unit tests)
- [x] _Add pipe_ and _Add outlet_ are found and drawn on the plan (find-it at 390 px and 1280 px)
- [x] All CI checks pass

## Open questions

- Default zone sizes — default pipe 100 × 100 mm, outlet 80 × 80 mm; edit as needed.
- What counts as a tall unit for the hidden-outlet warning — default: a piece at least 1,600 mm high (the smallest
  tall cabinet in the catalog, ADR-036) standing in front of the whole outlet zone; a lower piece whose back covers
  an outlet gets the "cut the back or move the piece" warning instead.
- How far into the room a pipe or outlet zone reaches for the checks — default 50 mm from the wall (the same strip
  the window check uses); a back, plinth or worktop panel inside that strip covers the zone.
