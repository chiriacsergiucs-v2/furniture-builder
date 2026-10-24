# ADR-065: Drag a piece on the plan to move it

- Status: Pending
- Date: 2026-10-24
- Depends on: ADR-051, ADR-056
- Design: docs/ui-design.md (project Plan view)
- Backlog: N60
- Acceptance: light

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
- **On release:** one store action (`moveItemBy`) with the new `position.x` / `position.z`: the
  move is rounded to a **10 mm step** (`dragPosition` in `src/core/project.ts`), so the piece keeps
  its own whole millimetres and moves by multiples of 10 mm. One drag is one undo step (ADR-051); run parts refresh in that step
  (ADR-061).
- **No clamping, no snapping:** the piece goes exactly where it is dropped (ADR-008). Overlaps,
  outside-the-room and opening problems show as the usual diagnostics (ADR-057, ADR-058). Snapping
  to neighbours and walls is left to the connector work.
- **Placement:** floor and wall-hung pieces move in x and z; their height stays. Pieces on a
  dragged base follow it (ADR-031). A piece placed **on or above another piece** is **lifted off**
  when it is dragged itself (`liftOff`): a wall-hung piece becomes hung on the wall at its current
  height, anything else stands on the floor (height 0).
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

- [x] A pure helper turns a pointer move in plan mm into a new position on the 10 mm step, with no
      clamping (unit test)
- [x] One drag is one undo step; Esc cancels with no step; a move under 4 px is a tap that selects
      (unit tests on the store and the helper)
- [x] A piece placed on another piece is lifted off when dragged (floor, or wall at its height if
      wall-hung) (unit test)
- [x] Arrow keys move the focused piece 10 mm, Shift 100 mm, one undo step each (unit test)
- Evidence (ran locally 2026-10-24): `tests/drag.test.ts` (14 tests), `pnpm test` 372 tests,
  `FUZZ_N=30000` fuzz.
- Note: Find-it skipped for this ADR on the user's instruction (2026-10-24); not verified in a
  browser.
- [x] `FUZZ_N=30000` fuzz still passes (no geometry change expected)

## Answers

User answers, 2026-10-24:

- Step while dragging: **10 mm** (typed values stay exact to 1 mm). Arrow keys move 10 mm, Shift
  100 mm.
- **No snapping** to neighbours or walls.
- A piece standing on another piece is **lifted off** when dragged: wall-hung (`isWallHung`) →
  `wall` at its current height, otherwise `floor` (height 0). This replaces the default "not
  draggable, drag the base".
- Find-it: skipped for this ADR ("Skip find-it for this one").
