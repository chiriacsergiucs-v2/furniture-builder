# ADR-093: Move and turn project pieces in the 3D view

- Status: Pending
- Date: 2026-10-26
- Depends on: ADR-014, ADR-065, ADR-069, ADR-070
- Design: docs/ui-design.md (Plan view, 3D view)
- Backlog: N91
- Agreed: 2026-10-26 "New adr to override the conflicts for 4 and make it ready"; answers "90° steps only", "A Move button turns on move mode", "Floor plane only; height from placement"

## Context

The user, 2026-10-26, after the fit review of the twelve highest-value research features still left to build: "New adr
to override the conflicts for 4 and make it ready". Item 4 was _Direct manipulation in 2D/3D_ (value 4.4, In
Progress): pieces move and turn on the Plan ([ADR-065](../adr-done/ADR-065-drag-a-piece-on-the-plan-to-move-it.md), [ADR-069](../adr-done/ADR-069-duplicate-mirror-and-turn-a-piece-about-its-centre-in-a-proj.md)), but not in 3D, because
[ADR-014](../adr-done/ADR-014-the-front-elevation-is-the-editing-surface-3d-is-a-non-autho.md) says the 3D view "selects the owning space on click, but never edits geometry". The second conflict
named was free rotation, which [ADR-022](../adr-done/ADR-022-projects-several-pieces-placed-in-one-room-with-combined-par.md) rejected ("Arbitrary rotations — breaks the axis-aligned box model").

User answers 2026-10-26: rotation "90° steps only" (ADR-022 and ADR-004 stay as they are); gesture "A Move button turns
on move mode"; height "Floor plane only; height from placement".

## Decision

- **Overrides ADR-014 for one thing only:** placing project pieces from the 3D view (position across the room and
  quarter turns). A piece's own design is still edited on the front elevation (ADR-014), with the quick-count
  exception of ADR-085. The 3D view stays lazy and mounts only when visible; without WebGL the Plan does everything.
- **Move button** in the 3D toolbar of the project view, shown when the project has pieces. While Move is on:
  pressing a piece selects it and dragging moves it; dragging empty space still orbits the camera. While Move is
  off, the 3D view behaves exactly as today. Esc or a second finger cancels the drag; Move stays on until tapped off.
- **Across the floor plane only:** the pointer is projected onto the horizontal plane at the piece's base height;
  the result goes through the same core path as a Plan drag: whole mm, snapping with the **Snap** toggle and **Alt**
  ([ADR-070](../adr-done/ADR-070-snap-a-dragged-piece-to-neighbours-and-walls-with-a-preview.md)), placement rules of ADR-065 (a piece on another piece is lifted off; wall units keep their
  height). Height still comes from placement.
- **Preview:** a translucent copy of the piece follows the pointer with the label "From left … · From back …" and
  the snap label; the piece commits on release. One undo step per drag ([ADR-051](../adr-done/ADR-051-add-undo-and-redo-for-project-changes.md)).
- **Turn:** with a piece selected, **Turn 90° ↺ / ↻** buttons over the 3D view and the R / Shift+R keys call the
  existing turn about the centre (ADR-069). One undo step each.
- No geometry is computed in UI code (ADR-004): the viewer only converts the pointer to a room point; snapping,
  placement and turning stay in `src/core`.

## Alternatives considered

- **Free-angle rotation** — the user chose 90° steps; it would override ADR-022/ADR-004 and every check (G-077).
- **Drag always moves the touched piece** (no mode) — the user chose a Move button; fewer accidental moves.
- **A vertical handle** — the user chose height from placement (G-078).

## Scope

- In scope: Move button, floor-plane drag with snapping and preview, turn buttons and keys in 3D, undo, phone and
  desktop.
- Out of scope: free-angle rotation (G-077), changing height by dragging (G-078).

## Consequences

- Positive: pieces are arranged where they are seen best, without switching to the Plan.
- Negative / risks: pointer projection near the horizon is unstable; a drag that leaves the floor keeps the last
  valid position. OrbitControls must be paused during a piece drag.
- Harder to change later: the 3D view now edits placement; ADR-014's rule is narrowed, not removed.

## Done when

- [ ] A pure function maps a room point to the same drag result as the Plan (whole mm, snap, Alt) (unit tests)
- [ ] Turning in 3D is one undo step and matches ADR-069's turn (unit test)
- [ ] Find-it at 1440 and 390 px: project in 3D → **Move** → drag a piece → its "From left" value changes; Undo puts
      it back; **Turn 90°** turns it; Move off → dragging orbits; no page errors, no sideways scroll
