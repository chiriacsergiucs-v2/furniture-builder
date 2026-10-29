# ADR-144: Use one view container with 2D, 3D and Both in Compose and Build & Preview

- Status: Implemented
- Date: 2026-10-28
- Implemented: 2026-10-28 (2026-10-28 (light acceptance; find-it pending (ADR-066)))
- Depends on: ADR-079, ADR-081
- Design: docs/ui-design.md (§4 Screens: editor, stage tools; Segmented)
- Backlog: N145
- Acceptance: light
- Answers: 2026-10-28 "265 yes, 266, stay 267, yes 268, Suggested: 2D below 1500 px, Both from 1500 px. 269, in
  options all except Fronts, Select, Move, Turn 90 both of them." Light acceptance: "update all adrs te be light"

## Context

The user (2026-10-28): "ADR to have the views container same in compose and build and preview. Same 2D(rename it
to 2D from Plan), 3D and both toggle".

Today (`src/ui/viewChoice.ts`, `src/ui/App.tsx`, from ADR-079 and ADR-081, both implemented):

- The _View_ switch reads **Plan · 3D · Both** in a project and **Front · 3D · Both** in the piece editor.
- Changing mode resets the view to the mode's default: 3D in Build & Preview, the drawing in Compose; Both from
  1500 px (`defaultView`).
- On a phone (< 760 px), Compose has no switch and never mounts 3D (`shownView`, `showsSwitch`); Build &
  Preview has the switch and puts all its view tools behind an **Options** button (`ViewOptions menu`).

**Change control.** ADR-081 item 6 ("changing mode resets it to the mode's default") and item 7 ("Compose stays as
today: no switch, no `canvas`") change here. Implemented ADRs are not edited; this ADR replaces those two items.
ADR-014 stays: the 2D drawing is where you edit; 3D only selects, stays lazy and mounts only while it is shown.

## Decision

1. **One view container** (`.stage` with its `.stage-tools` and `.views`) behaves the same in Compose and in Build
   & Preview: the same _View_ switch, the same options, the same tool rules, at every width.
2. The switch reads **2D · 3D · Both** in a project and in the piece editor: "Plan" and "Front" are renamed
   **2D** (G-265).
3. **The chosen view stays** when the mode changes (G-266). Only crossing 1500 px resets it to the default.
4. **Phone Compose** has the switch too, with 2D · 3D · Both; the 3D canvas mounts there only while 3D or Both is
   shown (G-267, ADR-014).
5. **Default view**, both modes: 2D below 1500 px, Both from 1500 px (G-268). Without WebGL: 2D, with 3D and Both
   disabled and _3D preview is not available in this browser_.
6. **Phone tools**, both modes (G-269): **Fronts**, **Select**, **Move** and **Turn 90° ↺ / ↻** stay in the row,
   visible; every other view tool (Snap, Clearances, Exploded 3D, Reset view, Look, Render) sits behind
   **Options**. From 760 px the tools stay inline as today.
7. Tap-to-place, room drawing and a tapped check still bring 2D forward (`bringDrawingForward`), in both modes;
   they no longer switch a phone from Build & Preview to Compose.
8. Tests and find-it scripts that look for "Plan" or "Front" as a view label (e.g. `tests/view-choice.test.ts`,
   `tests/find-it/inside-doors.test.tsx`, `tools/*/find-it.mjs`) are updated to "2D".

## Alternatives considered

- **Keep per-mode rules (today)** — the containers differ, which is what the user asked to remove.
- **Merge Compose and Build & Preview into one mode** — more than asked; the modes keep their side panels.

## Scope

- In scope: `viewOptions`, `defaultView`, `shownView`, `showsSwitch`, the `ViewOptions` menu rule, the label
  rename, `docs/ui-design.md` §4, UI-logic tests; find-it by catch-up (light, ADR-066).
- Covered elsewhere: nothing; the 3D viewer, `src/core`, store and storage do not change.

## Consequences

- Positive: one control and one behaviour to learn; "2D" says what it is in both piece and project.
- Negative / risks: 3D in phone Compose can be slower on older phones.
- Harder to change later: none.

## Done when

- [x] `viewOptions` returns 2D · 3D · Both in piece and project; no "Plan" or "Front" view label remains (unit test).
- [x] View rules are the same for both modes at 390, 1280 and 1600 px; the view stays on a mode change; defaults
      2D / Both (`tests/view-choice.test.ts`).
- [x] 3D mounts only while 3D or Both is shown, in both modes, phone included (UI-logic test, ADR-014).
- [x] Phone tool rule: Fronts, Select, Move, Turn 90° inline; the rest behind Options, in both modes (UI-logic test).
- [ ] Browser find-it on the production build at 390 and 1280 px: in Compose and Build & Preview the _View_
      radiogroup shows "2D", "3D", "Both"; on a phone "Options" holds the other tools; no horizontal scroll
      (light — catch-up).
- [x] Screenshots at 390 and 1280 px, both modes, shown to the user before tests (standing rule).

## Implementation (2026-10-28)

`src/ui/viewChoice.ts` (`viewOptions(has3d)`, `defaultView(wide, has3d)`, `PHONE_INLINE`, `inOptions`),
`src/ui/ViewOptions.tsx`; App keeps the view across modes; phone Compose shows the switch and mounts 3D only for 3D
or Both; on a phone Options holds Exploded 3D, Reset view, Look, Render and, on the plan, Snap and Clearances;
"Doors and fronts" reads "Fronts" on a phone. Find-it scripts in `tools/` use "2D". Tests:
`tests/view-choice.test.ts`; screenshots (production build, 390 and 1280 px, both modes) sent to the user without
waiting ("Full auto-mode").

## Open questions

- None open. Answered 2026-10-28: G-265 yes; G-266 stay; G-267 yes; G-268 2D below 1500 px, Both from 1500 px;
  G-269 Options holds all but Fronts, Select, Move and Turn 90°, in both modes.
