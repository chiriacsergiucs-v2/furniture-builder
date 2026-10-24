# ADR-065: Drag a piece on the plan to move it

- Status: Pending
- Date: 2026-10-24
- Depends on: ADR-051, ADR-056
- Design: docs/ui-design.md (project Plan view)
- Backlog: N60

## Context

The user asked "Drag and drop is implemented?" and, offered two options, chose option 1: dragging a
piece on the plan to move it (pointer and touch, whole mm, one undo step per drag).

Today a piece already in a project moves only through numbers: _From left_ / _From back_, the gap to
its left neighbour, or its placement (ADR-031). [ADR-056](../adr-done/ADR-056-place-a-chosen-catalog-item-where-the-user-taps-on-the-plan.md)
places a newly added piece with a tap and recorded "drag not built". This ADR does not change
ADR-056: adding stays tap-to-place; this adds moving by dragging.

## Decision

- **Where:** the project **Plan** (top view, `RoomPlan`). The front view and 3D stay select-only
  (ADR-014).
- **How:** Pointer Events with pointer capture, so mouse, pen and touch behave the same. Pressing
  a piece and moving it more than 4 screen px starts a drag; less than that is a tap and selects
  the piece as today. Piece shapes use `touch-action: none` so a touch drag does not scroll the
  page; the rest of the plan still scrolls.
- **While dragging:** the piece's footprint follows the pointer as an outline, with a label
  "From left 1240 · From back 0 mm". Nothing is committed yet; **Esc** (or a second finger) cancels.
- **On release:** one `updateItem` with the new `position.x` / `position.z`, rounded to whole mm
  and to a **10 mm step**. One drag is one undo step (ADR-051); run parts refresh in that step
  (ADR-061).
- **No clamping, no snapping:** the piece goes exactly where it is dropped (ADR-008). Overlaps,
  outside-the-room and opening problems show as the usual diagnostics (ADR-057, ADR-058). Snapping
  to neighbours and walls is left to the connector work.
- **Placement:** floor and wall-hung pieces move in x and z; their height stays. A piece placed
  **on or above another piece** is not dragged: its base is dragged and it follows (ADR-031); a
  hint says so.
- **Keyboard:** with a piece focused on the plan, arrow keys move it 10 mm (Shift: 100 mm), one
  undo step per key press, so the feature does not depend on a pointer.

## Alternatives considered

- **Drag from the Add-a-piece dialog onto the plan (option 2)** — not asked for now; the dialog
  covers the plan on phones.
- **A drag-and-drop library** — Pointer Events cover mouse and touch in a few lines; no new
  dependency.
- **Commit the position on every pointer move** — would make one drag hundreds of undo steps.

## Scope

- In scope: dragging pieces on the Plan with mouse, pen and touch; arrow-key moves; the live
  outline and label; one undo step per move.
- Out of scope: snapping, rotating by dragging, dragging in the front view or 3D, dragging catalog
  items in (option 2), multi-select.

## Consequences

- Positive: moving pieces matches the way people expect a planner to work, on phone and desktop.
- Negative / risks: a drag that starts on a small piece on a phone may be mistaken for a scroll;
  the 4 px threshold and `touch-action` keep that small.
- Harder to change later: nothing stored changes; positions stay whole mm in the project document.

## Done when

- [ ] A pure helper turns a pointer move in plan mm into a new position on the 10 mm step, with no
      clamping (unit test)
- [ ] One drag is one undo step; Esc cancels with no step; a move under 4 px is a tap that selects
      (unit tests on the store and the helper)
- [ ] A piece placed on another piece is not dragged and shows the hint (unit test)
- [ ] Arrow keys move the focused piece 10 mm, Shift 100 mm, one undo step each (unit test)
- [ ] Find-it at 1440 px: a mouse drag of a piece changes _From left_ by the dragged distance
      (± 10 mm); **Undo** puts it back
- [ ] Find-it at 375 px: a touch drag moves the piece and the page does not scroll sideways
- [ ] `FUZZ_N=30000` fuzz still passes (no geometry change expected)

## Open questions

- Step while dragging: **10 mm** (typed values stay exact to 1 mm). Finer or coarser?
- Should a dragged piece snap to touch its neighbour or a wall when dropped within a few mm?
  Default: **no snapping** in this ADR.
- Pieces placed on another piece: default **not draggable** (drag the base). Should dragging them
  move them off their base instead?
