# ADR-121: Research batch 1: render 3D on demand, review pack, typed rotation, mirror a selection

- Status: Pending
- Date: 2026-10-27
- Depends on: ADR-069, ADR-093, ADR-097
- Design: docs/ui-design.md (project editor, selected-piece card, 3D toolbar)
- Backlog: N122
- Acceptance: browser
- Agreed: 2026-10-27 "Accept default" (G-149: exact rotated-box checks; G-150: .zip plus the Share sheet where
  offered, the app making no request)

## Context

The user (2026-10-27): "Check which features are left in the features reasearch, and that we dont have, for all
missing sorted by complexity, low to medium-high (including), create 1 ADR per batch of 4 features, and ship it as
1 big change, 1 Pr, 1 run of the tests, 1 ship, 4 features."

The research records (`src/core/research/ensemble-2026-10-23.app.ts`, ADR-092) were checked against ADR-093…120.
This is the first batch of the 18 features left, lowest complexity first (research ratings, not this repo's):

| Research feature (id)                                                        | Complexity | What is missing here                              |
| ---------------------------------------------------------------------------- | ---------- | ------------------------------------------------- |
| On-demand rendering (`on-demand-rendering`)                                  | Low        | the 3D canvas renders every frame, even when idle |
| Hand a plan to a professional (`professional-review`)                        | Low-medium | no single package to hand over                    |
| Precise numeric / numeric transform (`precise-numeric`, `numeric-transform`) | Medium     | typed rotation; turns are 90° steps (G-077)       |
| Multi-select and whole-ensemble transforms (`multi-select-groups`)           | Medium     | mirroring a selection (G-085)                     |

Not in the batches: features rated High or Very high (e.g. `compatibility-engine`, mostly built by ADR-100);
`live-price` (needs the network, ADR-002); parts of `independent-selection`, `versioned-save`,
`ensemble-templates` and `transactional-undo` that need persistent connections (`assembly-graph`, High, G-091);
`family-presets`, `no-silent-moves` and `inspectable-rules`, judged built (ADR-007, ADR-095/071, ADR-100).

Typed rotation is rated Medium by the research, but here every check, snap and drawing assumes axis-aligned boxes
(`src/core/project.ts`: "rotations quarter turns … every panel stays an axis-aligned box", ADR-022/ADR-004). It is
the largest part of this batch and changes the project document (ADR-011).

## Decision

1. **Render on demand.** The 3D `Canvas` draws only when something changes (`frameloop="demand"`): orbiting, store
   changes that reach the scene, Move-mode drags, pictures and the realistic look's light arriving (`invalidate()`).
   Idle = no frames. Viewer-only; nothing in `src/core` changes.
2. **Review pack (G-150).** **Hand to a professional…** in the project ⋯ menu opens a dialog listing the pack:
   a printable summary (`-rezumat.html`: pieces with size, place and turn, every problem the app found), the parts
   CSV (`-piese.csv`, ADR-020), the plan seen from above and the 3D view (`.svg`) and the project file
   (`-proiect.json`, pictures included as in the Project file). **Download .zip** saves one store-only .zip
   (`src/core/zip.ts`, no dependency); **Share…** shows where the device can share files and hands the .zip to the
   operating system. Built from `buildProjectModel()` only (ADR-004, `src/core/reviewPack.ts`); the app sends
   nothing (ADR-002). The summary is in Romanian (ADR-020); the problems keep the app's own words.
3. **Typed rotation (G-149).** The selected-piece card gets **Rotation (°)**, whole degrees 0–359, under the quarter
   Turn; Turn 90° keeps working. The item keeps its quarter turn in `rotationY` and stores the rest as `angle`
   (1–89, absent = 0), so quarter-turned projects are unchanged; project `schemaVersion` 10, older versions load.
   The piece turns about the centre of its quarter-turned outline; `position` stays that outline's corner. Placed
   panels, opening clearances and envelopes of an angled piece carry the turn (`Box.yaw`), and overlap, room
   (walls, obstacles, doors), opening and envelope checks test the turned boxes exactly (separating axes on the
   floor outline). Plan, front view, 3D, exploded view and pictures draw the piece turned. A number outside 0–359
   or a locked piece is refused with the reason, never clamped (ADR-008, ADR-095). One undo step per edit.
   Built with limits recorded as gaps: snapping and the mm amounts in messages use the box around an angled piece
   (G-170); an angled piece is not part of a run (G-171); the 3D selection outline and Move ghost are unturned
   (G-172).
4. **Mirror a selection.** **Mirror** on two or more selected pieces: positions mirror about the selection's
   centre line (left–right), each piece's design mirrors as **Mirror the run** does (ADR-069 `mirrorDesign`) and its
   turn θ becomes −θ. Pieces resting on them follow. A locked piece refuses the whole action with its name
   (ADR-095); pieces with nothing to mirror only move and are named. One undo step. `mirrorItems` in
   `src/core/selection.ts` over the shared `mirrorSet` that **Mirror the run** now uses too.

Built as one change, one pull request, one test run and one ship (the user's request).

## Alternatives considered

- **One ADR per feature** — rejected by the user ("1 ADR per batch of 4 features").
- **Leave typed rotation out because this repo rates it higher** — would drop a requirement (R2); the cost is
  stated instead and the user picks the form (G-149).

## Scope

- In scope: the four features above, core and UI-logic tests, fuzz for rotation, browser find-it.
- Out of scope: nothing; the undecided parts were the open questions (G-149, G-150, answered 2026-10-27).
- Skipped while building: snapping along turned faces and exact amounts (G-170); angled pieces in runs (G-171);
  turned 3D outlines (G-172).

## Consequences

- Positive: idle 3D costs no battery; projects can be handed over; any angle can be typed; selections mirror.
- Negative / risks: rotation touches checks, snapping, plan and room drawings, 3D and exports; fuzz must cover it.
- Harder to change later: degrees in the project document (ADR-011).

## Done when

- [ ] Idle 3D renders no frames after it settles, and orbit, selection and Move still update it (browser find-it).
- [ ] The review pack holds the project file, parts CSV, drawings and summary, each from `buildProjectModel()` (tests).
- [ ] A project saved with quarter turns loads with 0/90/180/270 degrees; old readers keep working (storage tests).
- [ ] Rotation 45° on a piece: overlap, room and clearance checks report what the turned piece touches (tests, fuzz).
- [ ] "Rotation (°)" on the selected-piece card, typed 30, shows the piece turned in Plan and 3D (browser find-it).
- [ ] Mirror on three selected pieces mirrors positions and designs in one undo step; a locked one refuses (tests).
- [ ] Find-it at 390 and 1280 px: "Hand to a professional…", "Rotation (°)", "Mirror" on a selection.

## Open questions

None open. Answered 2026-10-27 ("Accept default"): G-149 exact rotated-box checks; G-150 .zip plus the Share sheet
where offered.
