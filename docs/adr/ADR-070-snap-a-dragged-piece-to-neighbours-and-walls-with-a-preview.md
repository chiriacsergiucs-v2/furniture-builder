# ADR-070: Snap a dragged piece to neighbours and walls with a preview and an override

- Status: Pending
- Date: 2026-10-24
- Depends on: ADR-058, ADR-065
- Design: docs/ui-design.md (Plan view)
- Backlog: N65

## Context

The user, 2026-10-24, on the Feature Research & Catalog selection: "Identify the features and subfeatures
necessary for the following items from research. Import 3D models and model libraries · Duplicate, mirror and
predictable rotate operations · Also for these: [14 features marked Interested]", then "Draft adrs for each".

Research row: _Guided connection snapping with live preview and orientation_ (rank 1, P0) with sub-features snap
preview, snap override, deterministic candidate ranking and "why won't this connect?". Its paper evidence says
snapping must be understandable and temporarily bypassable (Planner 5D complaints about snapping that cannot be
turned off). [ADR-065](../adr-done/ADR-065-drag-a-piece-on-the-plan-to-move-it.md) built dragging on the Plan with **no snapping** on the user's answer; this ADR adds it
as a separate, switchable layer and does not change ADR-065's drag.

## Decision

- **Connectors are derived, not stored:** from each placed piece's footprint and placement — left and right side
  faces, back face, and for wall-hung pieces the same at their height; from the room ([ADR-058](../adr-done/ADR-058-the-project-has-a-room-walls-doors-windows-and-obstacles-chec.md)) — each wall
  and inside corner. Pure function in `src/core` (`connectorsOf`).
- **Compatibility rules** (pure, listed in one table): side-to-side only between pieces with the same placement
  kind (floor with floor, wall with wall); back-to-wall for any piece; a turned piece's faces are turned with it.
  Depth or height differences are allowed but named in the preview ("depth 560 vs 600").
- **Candidates** within 60 mm of the dragged footprint, ranked by distance, then connector kind (wall corner,
  wall, neighbour side), then piece id: the same drag always picks the same snap.
- **Preview:** while dragging, the snapped footprint shows as a dashed outline with its label; the piece commits
  there on release. One undo step, as in ADR-065. Snapped positions are whole mm.
- **Override:** a **Snap** toggle in the plan toolbar (kept in `localStorage`), and holding **Alt** while
  dragging places freely. Arrow keys never snap.
- **"Why won't this snap?"**: with Snap on and no candidate, a hint names the nearest rejected connector and the
  rule ("wall unit cannot join a floor unit").
- Connections are not stored; runs stay inferred from touching pieces ([ADR-047](../adr-done/ADR-047-two-touching-cabinets-in-a-project-merge-into-one-cabinet-an.md)).

## Alternatives considered

- **Stored semantic connections** (research "persistent connections") — changes the project document and
  needs a dependency graph; not needed to snap.
- **Snap to a grid** — does not align pieces to each other or to walls.

## Scope

- In scope: derived connectors, rules, ranking, preview, toggle, Alt override, explanation.
- Out of scope: snapping in 3D or the front view, stored connections, rotation by snapping.

## Consequences

- Positive: pieces line up against walls and each other in one drag; never forced.
- Negative / risks: a 60 mm range may grab when the user wants a gap; the toggle and Alt answer that.

## Done when

- [ ] Connectors, rules and ranking are pure and deterministic (unit tests; same input → same snap)
- [ ] A floor unit dragged within 60 mm of another floor unit's side snaps flush; a wall unit does not
      (unit tests)
- [ ] Snapping to a wall and into an inside corner (unit tests on L rooms)
- [ ] Snap off or Alt held: the drop is exactly where released, as ADR-065 (unit test)
- [ ] **Snap** toggle and the dashed preview are found at 390 px and 1280 px (find-it)
- [ ] All CI checks pass; `FUZZ_N=30000` fuzz passes

## Open questions

- Snap range — default 60 mm on the plan.
- Default state of the toggle — default on.
