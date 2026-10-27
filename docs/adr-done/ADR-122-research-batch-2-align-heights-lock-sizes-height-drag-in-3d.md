# ADR-122: Research batch 2: align heights, lock sizes, height drag in 3D, section view

- Status: Implemented
- Date: 2026-10-27
- Implemented: 2026-10-27
- Depends on: ADR-093, ADR-095, ADR-099
- Design: docs/ui-design.md (project editor, selected-piece card, 3D toolbar)
- Backlog: N123
- Acceptance: browser
- Agreed: 2026-10-27: "Accept default" (G-151 skip floor pieces and say why; G-152 a separate Lock size; G-153
  wall-placed pieces only; G-154 any of the three axes)

## Context

The user (2026-10-27): "Check which features are left in the features reasearch, and that we dont have, for all
missing sorted by complexity, low to medium-high (including), create 1 ADR per batch of 4 features, and ship it as
1 big change, 1 Pr, 1 run of the tests, 1 ship, 4 features."

Second batch of the features left after ADR-093…120 (see [ADR-121](../adr-done/ADR-121-research-batch-1-render-3d-on-demand-review-pack-typed-rotat.md) for the list), all rated Medium:

| Research feature (id)                                        | What is missing here                                  |
| ------------------------------------------------------------ | ----------------------------------------------------- |
| Edge/face/centre alignment (`alignment-distribution`)        | aligning heights, top or bottom of wall units (G-089) |
| Lock/pin modules, preserve overrides (`locks-overrides`)     | locking a piece's sizes (G-081)                       |
| Direct manipulation in 2D/3D (`direct-manipulation`)         | changing height by dragging in 3D (G-078)             |
| Section/cutaway and visibility isolation (`section-cutaway`) | no section or isolate in the 3D view                  |

## Decision

1. **Align heights.** Align (ADR-099) gains **Top** and **Bottom** for two or more selected pieces: each moves up
   or down to the first selected piece's top or bottom, whole mm, by changing its placement height (ADR-031): a wall
   unit's hanging height, a stacked piece's gap over its base. Locks apply; skipped pieces are named (`skippedText`).
   A piece standing on the floor is skipped and the result says why; it is never resized (G-151). One undo step.
2. **Lock sizes.** A separate **Lock size** / **Unlock size** button on the selected-piece card (G-152), apart from
   Lock (placement, ADR-095), with a "Size locked" chip. A size-locked piece's width, height and depth do not change:
   its size fields are disabled with the hint "Size locked — unlock to change"; any change that would give it a
   different outside size (an edit in the editor, a linked copy's change (ADR-111), Replace (ADR-098), and later
   project-wide changes) is refused as a whole and the reason names the piece. Its boards, insides and place still
   change. Pure `src/core/sizeLock.ts` (`isSizeLocked`, `sizeLockBlocked`, sizes from the built model, ADR-004); the
   store's project commit applies it. Stored as `ProjectItem.sizeLocked: true`, project `schemaVersion` 11 (10 is
   [ADR-121](../adr-done/ADR-121-research-batch-1-render-3d-on-demand-review-pack-typed-rotat.md)'s); older projects load unchanged (ADR-011). Fill-a-wall only makes new projects, so it has no locked piece to refuse.
3. **Height drag in 3D.** In Move mode (ADR-093) a selected **wall-placed** piece (G-153) shows a **Change height**
   handle on its top front edge; dragging projects the pointer onto the vertical axis (`axisPoint`), whole mm, with
   a translucent copy where it would hang and the label "From floor … mm". Release calls `setWallHeight` (core,
   `src/core/height.ts`): below the floor or a locked piece is refused with the reason, never clamped (ADR-008). Esc
   or a second finger cancels; one undo step. Floor pieces stay on the floor.
4. **Section view.** The project's 3D toolbar gets **Section**: a cut across **Width**, **Height** or **Depth** (any
   axis, G-154) with a slider "Cut at … mm" hides everything past it (the renderer's clipping planes; kept: the side
   toward the left, the floor or the back wall). **Isolate** (with a selection) shows only the selected pieces.
   Viewer-only (ADR-014); neither changes the model, checks or exports, and a rendered picture never uses them.

Built as one change, one pull request, one test run and one ship (the user's request).

## Alternatives considered

- **Height drag on every piece type** — floor pieces would leave the floor silently (G-153: wall pieces only).
- **One Lock for position and size** — the research names locked parameters apart from pinned positions (G-152).
- **Section by hiding whole pieces only** — does not show inside a piece, which the research asks for.

## Scope

- In scope: the four features above, core and UI-logic tests, browser find-it (3D and Move mode).
- Out of scope: locking parameters other than size (G-180); the open questions were answered (G-151 to G-154,
  "Accept default").

## Consequences

- Positive: wall rows line up in one tap; agreed sizes cannot drift; heights set in 3D; insides visible.
- Negative / risks: more refusal paths to keep consistent (`skippedText`, lock hints).
- Harder to change later: a stored size-lock field (ADR-011).

## Done when

- [x] Align Top on three wall units puts their tops on the first one's top, whole mm, one undo step (tests).
- [x] A size-locked piece refuses resize from fields, the editor, Replace and linked edits, naming it (tests).
- [x] A project saved before the size lock loads unchanged (storage tests).
- [x] Height drag on a wall unit changes its placement height in whole mm, one undo step (core tests).
- [x] Section hides the scene in front of the plane; Isolate shows only the selection; exports unchanged (tests).
- [x] Browser find-it at 390 and 1280 px: "Top", "Bottom", "Lock size"/"Size locked", the height handle label
      "From floor", "Section" and "Isolate".

## Open questions

None. G-151 to G-154 were answered on 2026-10-27 with the suggested picks ("Accept default").
