# ADR-080: Show the drawing and 3D side by side from the view switch

- Status: Pending
- Date: 2026-10-25
- Depends on: ADR-014, ADR-079
- Design: docs/ui-design.md (§4 Screens: editor, stage tools)
- Backlog: N75

## Context

The user, 2026-10-25: "New adr to have 2d and 3d on the same screen, with the old 2d 3d tabs component. Also add
the combined to that tabs component."

Today (`src/ui/App.tsx`, `src/styles.css`):

- Between 760 and 1500 px the stage has a segmented _View_ switch, **Front · 3D** (**Plan · 3D** in a project),
  and shows one of the two.
- From 1500 px both are shown side by side automatically and the switch is hidden (`.stage-tools .segmented
{ display: none }`), so the user cannot choose.
- On a phone there is no switch; the mode decides (3D only in Build & Preview, ADR-079).

[ADR-014](../adr-done/ADR-014-the-front-elevation-is-the-editing-surface-3d-is-a-non-autho.md) is kept: the
drawing is where you edit, and 3D only selects, stays lazy and mounts only when visible.

## Decision

1. The _View_ switch gets a third option: **Front · 3D · Both** (**Plan · 3D · Both** in a project). It is the
   same `.segmented.small` radiogroup, labelled _View_.
2. **Both** shows the drawing and the 3D view in the stage at the same time, split in two halves (side by side
   when the stage is wider than tall, stacked otherwise). Selecting in either one selects in the other, as today.
3. The switch is shown at every width from 760 px, including ≥ 1500 px. The automatic split at ≥ 1500 px is
   replaced by **Both** being the default there; below 1500 px the default stays as today (by mode).
4. The 3D canvas is mounted only when the shown view is 3D or Both (ADR-014). Without WebGL, 3D and Both are
   disabled with the reason _3D preview is not available in this browser_.
5. The 3D tools (Exploded 3D, Reset view, Look, Render) show when 3D or Both is shown.
6. The chosen view is kept while the mode stays the same; changing mode resets it to the mode's default, as now.
   Tap-to-place, room drawing and a tapped project check still bring the drawing forward: from 3D they switch to
   Front/Plan; from Both they stay in Both (the drawing is already visible).
7. Phone (< 760 px): unchanged (see Open questions).

## Alternatives considered

- **Keep the automatic split at ≥ 1500 px only.** Not what was asked: the user wants it chosen from the switch.
- **A separate "Split view" toggle next to the switch.** Two controls for one choice; the user asked for it inside
  the tabs component.
- **Picture-in-picture 3D over the drawing.** Covers part of the drawing where you edit (ADR-014).

## Scope

- In scope: the _View_ switch and `view`/`shown`/`mount3d` logic in `src/ui/App.tsx`; `.views` split CSS in
  `src/styles.css`; `docs/ui-design.md` §4; `tools/view-both/find-it.mjs`; a UI-logic test for the view rules.
- Out of scope: phone layout, the 3D viewer's internals, `src/core`, store and storage (the choice is not saved).

## Consequences

- Positive: drawing and 3D side by side at any desktop width, chosen by the user; one control for the view.
- Negative / risks: two renderers at once cost more on weak laptops; at 760–1000 px each half is narrow.
- Harder to change later: the label **Both**, which people will learn.

## Done when

- [ ] At 1280 px the stage shows the _View_ switch with **Front**, **3D** and **Both**; choosing **Both** shows the
      elevation and a `canvas` in the stage at once (find-it).
- [ ] In a project the switch reads **Plan**, **3D**, **Both**; **Both** shows the plan and the 3D view (find-it).
- [ ] At 1500 px and wider the switch is visible and **Both** is selected by default; choosing **Front** removes the
      `canvas` from the DOM (find-it; ADR-014).
- [ ] Tapping a space in the drawing while in **Both** selects it, and the selection stays **Both** (find-it).
- [ ] Without WebGL, **3D** and **Both** are disabled with the reason shown (UI-logic test).
- [ ] At 390 px nothing changes: no _View_ switch, no `canvas` outside Build & Preview; no horizontal page scroll at
      360 and 390 px (find-it).
- [ ] `tools/view-both/find-it.mjs` passes on the production build at 390, 1280 and 1600 px. All CI checks pass.

## Open questions

- V1: Label of the third option — default **Both**. (Alternatives: _Split_, _Front + 3D_.)
- V2: Phone — default unchanged (no switch; mode decides). Alternative: add the switch on phones in Build &
  Preview with Both stacked (drawing over 3D).
- V3: Default view at ≥ 1500 px — default **Both** (keeps today's look). Below 1500 px: default by mode, as today.
- V4: Remember the chosen view per device (`localStorage`)? Default no; it resets with the mode, as today.
- V5: Acceptance — default full (find-it). Say "light" to skip the browser run (ADR-066).
