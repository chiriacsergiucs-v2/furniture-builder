# ADR-303: Drop a catalog item from the piece list onto the 3D view

- Status: Implemented
- Date: 2026-11-27
- Implemented: 2026-11-27
- Depends on: ADR-014, ADR-093, ADR-094
- Design: docs/ui-design.md (Plan view, 3D view)
- Backlog: N432
- Acceptance: browser

## Context

The user, 2026-11-27: "Also do the medium work" and "Auto-accept if confidence > 85%", for gap G-079 (from
[ADR-094](../adr-done/ADR-094-drag-a-catalog-item-from-a-piece-list-onto-the-plan.md), whose scope left out "dropping
into the 3D view"). The gap's suggested pick, taken: "Drop onto the 3D floor plane with ADR-093's projection".

[ADR-014](../adr-done/ADR-014-the-front-elevation-is-the-editing-surface-3d-is-a-non-autho.md) keeps the 3D view
select-only. [ADR-093](../adr-done/ADR-093-move-and-turn-project-pieces-in-the-3d-view.md) narrowed that for moving
and turning project pieces only, "not adding them" (G-079's conflict line). Adding a piece from 3D is a new exception,
so it gets this ADR.

## Decision

- **Overrides ADR-014 for one more thing only:** a catalog item dragged from the piece list (ADR-094, the same drag:
  press and drag with a mouse, long-press on touch) may be released over the project's 3D view; it is added there.
  Nothing else in 3D edits a design.
- **Floor plane:** the pointer becomes a ray through the 3D camera and the ray a point on the floor plane (height 0)
  with ADR-093's `floorPoint`; that room point goes through the plan's drop unchanged (`dropNewPiece`): the item's
  left-back corner at the point, whole mm, snapped with the **Snap** toggle unless Alt is held (ADR-070). Height comes
  from placement, as on the plan. One undo step; Esc or a release off both the plan and the 3D view adds nothing.
- **Preview:** while the pointer is over the 3D view (or the plan) a translucent box shows where the piece would land,
  green when it snaps; the plan's dashed outline and its "From left … · From back …" label follow the same point.
- **Only the canvas counts:** a toolbar, note or sheet drawn over the 3D view is not a drop point. The 3D view
  registers its drop point only while it is mounted in a project and not exploded, rendered or in AR; it stays lazy
  and mounts only when visible (ADR-014).
- **No geometry in UI code (ADR-004):** the viewer only converts the pointer to a room point; the drop, snapping and
  the preview box come from `src/core`.
- The piece list's tip reads "Drag an item onto the plan or the 3D view (on a phone, hold it first), or tap it and
  then tap the plan." (Russian entry updated).

## Alternatives considered

- **Drop onto the surface under the pointer (a piece top, a wall)** — needs stacking and wall-hanging rules for a new
  piece in 3D; the gap asks for the floor plane only.
- **Keep the plan as the only drop target** — the gap exists because the research asked for drag into the scene.

## Scope

- In scope: the drop point over the 3D view, the 3D preview box, the same document change and undo as ADR-094.
- Out of scope: dropping onto a surface other than the floor (no gap: not asked); a phone layout that shows the 3D
  view while the piece list is open (the list brings the plan forward on a phone, ADR-094; Both still works).

## Consequences

- Positive: placing from the catalog works in whichever view the user is looking at.
- Negative / risks: near the horizon the floor point runs away; past `MAX_REACH` there is no point and nothing drops.
- Harder to change later: the 3D view now also adds pieces; ADR-014's rule is narrowed again, not removed.

## Done when

- [x] A pure function maps a screen point over the 3D canvas to the floor point, null off the canvas or above the
      horizon, and that point gives the same piece and position as a release on the plan there (unit tests,
      `tests/catalog-drop-3d.test.ts`)
- [x] The piece list's drag drops at the 3D view's point with one undo step and adds nothing off both views (unit test)
- [x] Find-it at 1440 px (`tools/catalog-drop-3d/find-it.mjs`, production build): Compose → **Add a piece** → drag
      "Base cabinet" onto the 3D view → a new piece appears on the plan; Undo removes it; no page errors
