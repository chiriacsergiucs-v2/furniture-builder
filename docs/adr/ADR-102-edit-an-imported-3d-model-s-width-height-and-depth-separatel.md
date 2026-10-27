# ADR-102: Edit an imported 3D model's width, height and depth separately

- Status: Pending
- Date: 2026-10-27
- Depends on: ADR-076, ADR-093
- Design: docs/ui-design.md (section 3, components; section 4, editor screen)
- Backlog: N100
- Agreed: 2026-10-27 "Width, height and depth (Recommended)", "Stretch to fill the box (Recommended)", "Yes, on by default", "Yes, a \"Reset size\" button", "Screen only, on each time (Recommended)", "Add 3D handles too", "In Move mode (Recommended)", "Right, top, front faces (Recommended)", "Whole mm, Keep proportions applies"

## Context

The user, 2026-10-27: "Width and height of an item must be editable". Asked which item, they chose the imported
3D model. Today the selected model shows one field, **Width**, and height and depth follow it with the
proportions kept ([ADR-076](../adr-done/ADR-076-import-3d-models-from-the-device-as-display-only-items.md):
"size in mm (from the model's bounds, editable with locked proportions)"). This ADR replaces that sentence:
each side can be typed on its own, and dragged in 3D. ADR-076 is implemented and is not edited.

It also widens [ADR-093](../adr-done/ADR-093-move-and-turn-project-pieces-in-the-3d-view.md)'s exception to
ADR-014 ("placing project pieces from the 3D view … A piece's own design is still edited on the front
elevation"): in Move mode, a selected 3D model's size can be dragged too. Cabinets and other pieces are unchanged.

User answers, 2026-10-27: width, height and depth all editable; the model stretches to fill the typed box; a
**Keep proportions** switch, on by default, screen state only; a **Reset size** button; resize handles in 3D,
in Move mode, on the right, top and front faces, whole mm, Keep proportions applies.

## Decision

- **Fields:** the selected model's panel (`ModelFields`, `src/ui/Models3D.tsx`) shows **Width**, **Height** and
  **Depth** in whole mm (1 to 10 000, as today), replacing the single Width field and its hint.
- **Keep proportions** (`Toggle`), on each time a model is selected: typing one side scales the other two by the
  same factor from the size before the edit (as `scaleToWidth` does now, generalised to any side in
  `src/core/model3d.ts`). Off: only the typed side changes.
- **Reset size** sets the size back to the stored model's own size (its bounds at import); shown only when the
  model is on this device and the size differs.
- **3D:** the model is scaled per axis to fill its box exactly (`Viewer3D.tsx`, now one uniform scale along
  the longest side), so the drawing, checks and 3D agree. Rendered pictures use the same scene.
- **No schema change:** `ModelItem.size` already holds `{ w, h, d }`; old projects load unchanged (ADR-011).
- **3D handles:** in Move mode (ADR-093), a selected model shows three handles: right face (width), top face
  (height), front face (depth); left, bottom and back stay put. Dragging projects the pointer onto the handle's
  axis; the new size is whole mm, 1 to 10 000, and goes through the same core resize as the fields, so Keep
  proportions applies. A label shows "W × H × D mm" while dragging; Esc or a second finger cancels; one undo step on
  release. Pressing a handle never starts a move or an orbit. Outside Move mode the 3D view stays select-only.
- No geometry in UI code (ADR-004): the viewer converts the pointer to a millimetre distance along an axis; the
  resize rule lives in `src/core/model3d.ts`.
- Each field edit is one project undo step (the existing `patch`).

## Alternatives considered

- **Keep shape, fit inside the box** — the user chose stretching; the box could look larger than the model.
- **Width and height only** — the user chose depth too; the model is a box with three sides.
- **No switch** — the user chose a switch, on by default, to keep today's behaviour one tap away.
- **Handles on every face, a corner handle, or a separate Resize mode** — the user chose three faces in Move mode.

## Scope

- In scope: the three fields, the switch, Reset size, per-axis scale in 3D, the three 3D handles in Move mode
  (G-112), core and UI-logic tests, find-it.
- Out of scope: saving the switch per model (G-111, user answer: screen only); handles on cabinets and pieces (G-078).

## Consequences

- Positive: a model can match the real object's size (e.g. a fridge of a different height than the file).
- Negative / risks: a stretched model can look distorted; that is the user's choice and Reset size undoes it.
- Harder to change later: nothing; no stored shape changes.

## Done when

- [x] Core: resizing with proportions kept scales the other two sides from any edited side; off changes one side
      only; every side stays at least 1 mm (covered by tests).
- [x] Selecting a model shows Width, Height, Depth, Keep proportions (on) and, after a change, Reset size.
- [x] With Keep proportions off, typing a height changes only the height on the plan box and in the front view.
- [x] The 3D model fills its box on each axis after an independent change.
- [x] Reset size returns the imported size; each field change is one undo step.
- [x] In Move mode, dragging the top handle of a selected model changes only its height with Keep proportions off,
      and all three sides with it on; one undo step per drag (covered by tests of the core resize).
- [x] Find-it test passes from the bare app at phone and desktop widths
      (`tools/model-size/find-it.mjs`, production build), including a handle drag in 3D at desktop width.
