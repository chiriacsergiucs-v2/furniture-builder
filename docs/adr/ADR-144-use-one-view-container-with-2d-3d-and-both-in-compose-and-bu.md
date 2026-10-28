# ADR-144: Use one view container with 2D, 3D and Both in Compose and Build & Preview

- Status: Pending
- Date: 2026-10-28
- Depends on: ADR-079, ADR-081
- Design: docs/ui-design.md (§4 Screens: editor, stage tools; Segmented)
- Backlog: N145
- Acceptance: browser

## Context

The user (2026-10-28): "ADR to have the views container same in compose and build and preview. Same 2D(rename it
to 2D from Plan), 3D and both toggle".

Today (`src/ui/viewChoice.ts`, `src/ui/App.tsx`, from ADR-079 and ADR-081, both implemented):

- The _View_ switch reads **Plan · 3D · Both** in a project and **Front · 3D · Both** in the piece editor.
- Changing mode resets the view to the mode's default: 3D in Build & Preview, the drawing in Compose; Both from
  1500 px (`defaultView`).
- On a phone (< 760 px), Compose has no switch and never mounts 3D (`shownView`, `showsSwitch`); Build &
  Preview has the switch and keeps its view tools behind an **Options** button (`ViewOptions menu`).

**Change control.** ADR-081 item 6 ("changing mode resets it to the mode's default") and item 7 ("Compose stays as
today: no switch, no `canvas`") change here. Implemented ADRs are not edited; this ADR replaces those two items.
ADR-014 stays: the 2D drawing is where you edit; 3D only selects, stays lazy and mounts only while it is shown.

## Decision

Settled by the request:

1. **One view container** (`.stage` with its `.stage-tools` and `.views`) behaves the same in Compose and in Build
   & Preview: the same _View_ switch, the same options, the same tool rules.
2. The switch reads **2D · 3D · Both**: "Plan" is renamed **2D**. (The piece editor's "Front": G-265.)
3. Without WebGL, 3D and Both stay disabled with _3D preview is not available in this browser_ in both modes.
4. Tap-to-place, room drawing and a tapped check still bring 2D forward (`bringDrawingForward`), in both modes.
5. Existing tests and find-it scripts that look for "Plan" (e.g. `tests/view-choice.test.ts`,
   `tests/find-it/inside-doors.test.tsx`, `tools/*/find-it.mjs`) are updated to the new label.

Open, not part of the Decision until you answer: whether the view is kept across modes (G-266), phone Compose
(G-267), the default view (G-268) and the phone tool row (G-269).

## Alternatives considered

- **Keep per-mode rules (today)** — the containers differ, which is what the user asked to remove.
- **Merge Compose and Build & Preview into one mode** — more than asked; the modes keep their side panels.

## Scope

- In scope: `viewOptions`, `defaultView`, `shownView`, `showsSwitch`, the `ViewOptions` menu rule, the label
  rename, `docs/ui-design.md` §4, UI-logic tests, browser find-it.
- Covered elsewhere: nothing; the 3D viewer, `src/core`, store and storage do not change.

## Consequences

- Positive: one control and one behaviour to learn; "2D" says what it is in both piece and project.
- Negative / risks: if phone Compose gets 3D (G-267), a phone may be slower while composing.
- Harder to change later: none.

## Done when

- [ ] `viewOptions` returns 2D · 3D · Both labels; no "Plan" label remains in `src/ui` (unit test, grep).
- [ ] The view rules are the same for both modes at 390, 1280 and 1600 px (`tests/view-choice.test.ts`).
- [ ] 3D mounts only while 3D or Both is shown, in both modes (UI-logic test, ADR-014).
- [ ] Browser find-it on the production build at 390 and 1280 px: in Compose and in Build & Preview the _View_
      radiogroup shows "2D", "3D", "Both"; each choice shows its view; no horizontal scroll at 390 px.
- [ ] Screenshots at 390 and 1280 px, both modes, shown to the user before tests (standing rule).

## Open questions

- Rename the piece editor's "Front" to "2D" too? Suggested: yes, one label everywhere (+2 %) (G-265).
- Keep one chosen view when switching mode, or a default per mode? Suggested: keep one view (+3 %) (G-266).
- Phone Compose: offer 2D · 3D · Both (3D mounts there when chosen), or keep it 2D only? Suggested: offer them,
  closest to "same" (+10 %; a phone may be slower) (G-267).
- Default view for both modes: 2D below 1500 px and Both from 1500 px, 3D below 1500 px, or Both everywhere?
  Suggested: 2D below 1500 px, Both from 1500 px (G-268).
- Phone view tools: the Options button in both modes, or inline in both? Suggested: Options in both (+2 %)
  (G-269).
