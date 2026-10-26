# ADR-094: Drag a catalog item from a piece list onto the plan

- Status: Pending
- Date: 2026-10-26
- Depends on: ADR-056, ADR-065, ADR-078
- Design: docs/ui-design.md (Plan view)
- Backlog: N92
- Agreed: not yet

## Context

The user, 2026-10-26: "New adr 6". Item 6 of the fit review: _Drag-and-drop placement_ (value 4.5, In Progress,
missing "dragging a catalog item into the plan"). [ADR-056](../adr-done/ADR-056-place-a-chosen-catalog-item-where-the-user-taps-on-the-plan.md) built tap-to-place after the simplest option was
auto-accepted; the 2026-10-26 retro records that the research asked for "drag a template into the scene". The app
shell ([ADR-078](../adr-done/ADR-078-rebuild-the-app-shell-projects-catalog-and-editor-as-separat.md)) puts the Catalog in its own place, so no list sits next to the plan today.

## Decision

- **Piece list beside the plan:** in the project editor (Compose), an **Add a piece** button opens a list of catalog
  items, with search, Room/Type grouping and the catalog pictures (ADR-042), as in Start from. Desktop: a side panel
  next to the plan. Phone: a bottom sheet.
- **Drag from the list:** desktop — press an item and drag it onto the plan; phone — long-press (300 ms) an item,
  the sheet folds away and the drag continues over the plan. Pointer Events throughout (HTML drag-and-drop does not
  work on touch).
- **Over the plan:** the item's footprint follows the pointer as a dashed outline, snapped as in [ADR-070](../adr-done/ADR-070-snap-a-dragged-piece-to-neighbours-and-walls-with-a-preview.md)
  (Snap toggle, Alt), whole mm, with the "From left … · From back …" label. Release on the plan adds the piece there
  (same document change as ADR-056: a copy with its catalog origin) — one undo step. Release outside the plan or
  Esc adds nothing.
- **Tap still works:** tapping an item keeps ADR-056's "Tap the plan to place".
- The core keeps the geometry: the outline comes from the item's built model (ADR-004) and the same snap function.

## Alternatives considered

- **Keep tap-to-place only** — the research and the retro ask for drag.
- **Drag from the separate Catalog place** — the plan is not on screen there.

## Scope

- In scope: the list in the project editor, drag on desktop and phone, preview, snapping, undo.
- Out of scope: dropping into the 3D view (G-079).

## Consequences

- Positive: placing matches the research's catalogue-led workflow.
- Negative / risks: the list takes width on desktop; on phones the long-press must not fight scrolling the list.

## Done when

- [ ] Dropping an item at a room point gives the same piece and position as tap-to-place there (unit test)
- [ ] Find-it at 1440 px: Compose → **Add a piece** → drag "Base cabinet" onto the plan → the piece appears there;
      Undo removes it; Esc during a drag adds nothing
- [ ] Find-it at 390 px: long-press an item → the sheet folds → drop on the plan → the piece appears; tap-to-place
      still works

## Open questions

1. Is the list open by default on desktop? Used until answered: closed, opened with **Add a piece** (G-080).
