# ADR-121: Research batch 1: render 3D on demand, review pack, typed rotation, mirror a selection

- Status: Deferred (open questions G-149, G-150)
- Date: 2026-10-27
- Depends on: ADR-069, ADR-093, ADR-097
- Design: docs/ui-design.md (project editor, selected-piece card, 3D toolbar)
- Backlog: N122
- Acceptance: browser

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

1. **Render on demand.** The 3D `Canvas` renders only when something changes (`frameloop="demand"`): camera
   moves, store changes that reach the scene, Move-mode drags and the realistic look's loading. Idle = no frames.
   Viewer-only; nothing in `src/core` changes.
2. **Review pack.** **Hand to a professional…** in the project ⋯ menu builds one package for review from the
   project's existing outputs: the project file (ADR-022), the parts CSV (ADR-020, Romanian), the SVG drawings
   and a printable summary (pieces, sizes, problems). Built from `buildProjectModel()` only (ADR-004); nothing is
   sent anywhere by the app (ADR-002). Its form and delivery wait for G-150.
3. **Typed rotation.** The selected-piece card gets **Rotation (°)**, whole degrees 0–359, beside From left / From
   back; Turn 90° keeps working. The project item stores degrees (`rotationY`), project `schemaVersion` raised to
   the next free version; older projects load (quarter turns become 0/90/180/270). Snapping, overlap, room and
   clearance checks use the turned piece; how exactly waits for G-149. Out-of-range input is a diagnostic, never
   clamped (ADR-008). One undo step per edit.
4. **Mirror a selection.** **Mirror** works on two or more selected pieces: positions mirror about the selection's
   centre line (left–right) and each piece's design mirrors as **Mirror the run** does (ADR-069 `mirrorDesign`).
   Locked pieces (ADR-095) refuse with their name; one undo step. Pure `mirrorItems` in `src/core/selection.ts`.

Built as one change, one pull request, one test run and one ship (the user's request).

## Alternatives considered

- **One ADR per feature** — rejected by the user ("1 ADR per batch of 4 features").
- **Leave typed rotation out because this repo rates it higher** — would drop a requirement (R2); the cost is
  stated instead and the user picks the form (G-149).

## Scope

- In scope: the four features above, core and UI-logic tests, fuzz for rotation, browser find-it.
- Out of scope: nothing; the undecided parts are the open questions (G-149, G-150).

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

- **G-149** Typed rotation: any whole degree with exact rotated-box checks, any whole degree checked by each turned
  piece's enclosing box, or a typed field limited to 0/90/180/270? Suggested: exact rotated-box checks (closest to
  the request; estimate +60 % work over enclosing boxes, +25 % of value: no false overlap errors).
- **G-150** Review pack: a .zip download, the device Share sheet with download fallback, or print only? Suggested:
  .zip plus Share where offered (estimate +15 % work, +20 % of value). Share hands files to the operating system;
  the app makes no request — confirm this fits ADR-002.
