# ADR-122: Research batch 2: align heights, lock sizes, height drag in 3D, section view

- Status: Deferred (open questions G-151, G-152, G-153, G-154)
- Date: 2026-10-27
- Depends on: ADR-093, ADR-095, ADR-099
- Design: docs/ui-design.md (project editor, selected-piece card, 3D toolbar)
- Backlog: N123
- Acceptance: browser

## Context

The user (2026-10-27): "Check which features are left in the features reasearch, and that we dont have, for all
missing sorted by complexity, low to medium-high (including), create 1 ADR per batch of 4 features, and ship it as
1 big change, 1 Pr, 1 run of the tests, 1 ship, 4 features."

Second batch of the features left after ADR-093…120 (see [ADR-121](ADR-121-research-batch-1-render-3d-on-demand-review-pack-typed-rotat.md) for the list), all rated Medium:

| Research feature (id)                                        | What is missing here                                  |
| ------------------------------------------------------------ | ----------------------------------------------------- |
| Edge/face/centre alignment (`alignment-distribution`)        | aligning heights, top or bottom of wall units (G-089) |
| Lock/pin modules, preserve overrides (`locks-overrides`)     | locking a piece's sizes (G-081)                       |
| Direct manipulation in 2D/3D (`direct-manipulation`)         | changing height by dragging in 3D (G-078)             |
| Section/cutaway and visibility isolation (`section-cutaway`) | no section or isolate in the 3D view                  |

## Decision

1. **Align heights.** Align (ADR-099) gains **Top** and **Bottom** for two or more selected pieces: each moves up
   or down to the first selected piece's top or bottom, whole mm, by changing its placement height (ADR-031). Locks
   apply; skipped pieces are named (`skippedText`). One undo step. Floor pieces wait for G-151.
2. **Lock sizes.** A piece's width, height and depth can be locked: the size fields and handles are disabled with
   the hint "Size locked — unlock to change"; Fill-a-wall, Replace (ADR-098), linked-copy edits (ADR-111) and
   project-wide changes refuse to resize it and say which piece. Pure `isSizeLocked` in `src/core`; project
   `schemaVersion` raised if a new field is stored. Separate toggle or part of Lock waits for G-152.
3. **Height drag in 3D.** In Move mode (ADR-093) a selected piece that may change height shows a vertical handle;
   dragging projects the pointer onto the vertical axis, whole mm, through the same core path as the height field,
   with a "From floor … mm" label. Esc or a second finger cancels; one undo step. Which pieces waits for G-153.
4. **Section view.** The 3D toolbar gets **Section**: a cut plane with a slider hides everything in front of it
   (three.js clipping planes, viewer-only, ADR-014), and **Isolate** shows only the selected pieces. Neither
   changes the model, checks or exports. Which planes waits for G-154.

Built as one change, one pull request, one test run and one ship (the user's request).

## Alternatives considered

- **Height drag on every piece type** — floor pieces would leave the floor silently; asked instead (G-153).
- **Section by hiding whole pieces only** — does not show inside a piece, which the research asks for.

## Scope

- In scope: the four features above, core and UI-logic tests, browser find-it (3D and Move mode).
- Out of scope: nothing; the undecided parts are the open questions (G-151 to G-154).

## Consequences

- Positive: wall rows line up in one tap; agreed sizes cannot drift; heights set in 3D; insides visible.
- Negative / risks: more refusal paths to keep consistent (`skippedText`, lock hints).
- Harder to change later: a stored size-lock field (ADR-011).

## Done when

- [ ] Align Top on three wall units puts their tops on the first one's top, whole mm, one undo step (tests).
- [ ] A size-locked piece refuses resize from fields, Replace, linked edits and Fill-a-wall, naming it (tests).
- [ ] A project saved before the size lock loads unchanged (storage tests).
- [ ] Height drag on a wall unit changes its placement height in whole mm, one undo step (core tests).
- [ ] Section hides the scene in front of the plane; Isolate shows only the selection; exports unchanged (tests).
- [ ] Browser find-it at 390 and 1280 px: "Top", "Bottom", "Lock size"/"Size locked", the height handle label
      "From floor", "Section" and "Isolate".

## Open questions

- **G-151** Align Top/Bottom with floor pieces selected: skip them and say why, or resize them? Suggested: skip and
  say why (alignment moves pieces, as ADR-099).
- **G-152** A separate **Lock size** toggle, or one Lock covering position and size? Suggested: separate (the
  research names locked parameters apart from pinned positions; estimate +10 % work, +15 % of value).
- **G-153** Height drag: wall-placed pieces only, or floor pieces too (they would become raised)? Suggested: wall
  pieces only (height comes from placement, ADR-031).
- **G-154** Section: one front-to-back cut, or along any of the three axes? Suggested: any axis (closest to "cut
  through the ensemble"; estimate +15 % work, +20 % of value).
