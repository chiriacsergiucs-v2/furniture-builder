# ADR-080: Show the drawing and 3D side by side from the view switch

- Status: Pending
- Date: 2026-10-25
- Depends on: ADR-014, ADR-079
- Design: docs/ui-design.md (§4 Screens: editor, stage tools)
- Backlog: N75
- Acceptance: light

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
7. Phone (< 760 px): the switch appears only in Build & Preview, with the same three options, defaulting to
   **3D** (today's view). **Both** stacks the drawing over the 3D view. Compose and Configure stay as today: no
   switch, no `canvas` (ADR-014, ADR-079).

## Alternatives considered

- **Keep the automatic split at ≥ 1500 px only.** Not what was asked: the user wants it chosen from the switch.
- **A separate "Split view" toggle next to the switch.** Two controls for one choice; the user asked for it inside
  the tabs component.
- **Picture-in-picture 3D over the drawing.** Covers part of the drawing where you edit (ADR-014).

## Scope

- In scope: the _View_ switch and `view`/`shown`/`mount3d` logic in `src/ui/App.tsx`; `.views` split CSS in
  `src/styles.css`; `docs/ui-design.md` §4; a UI-logic test for the view rules. The find-it script waits for a catch-up (ADR-066).
- Out of scope: phone Compose and Configure, the 3D viewer's internals, `src/core`, store and storage (the choice is not saved).

## Consequences

- Positive: drawing and 3D side by side at any desktop width, chosen by the user; one control for the view.
- Negative / risks: two renderers at once cost more on weak laptops; at 760–1000 px each half is narrow.
- Harder to change later: the label **Both**, which people will learn.

## Done when

- [ ] At 1280 px the stage shows the _View_ switch with **Front**, **3D** and **Both**; choosing **Both** shows the
      elevation and the 3D view at once (light — catch-up).
- [ ] In a project the switch reads **Plan**, **3D**, **Both**; **Both** shows the plan and the 3D view
      (light — catch-up).
- [ ] At 1500 px and wider the switch is visible and **Both** is selected by default; choosing **Front** removes the
      `canvas` from the DOM (light — catch-up; ADR-014).
- [ ] At 390 px in Build & Preview the switch shows **Front**, **3D**, **Both** with **3D** selected; **Both** stacks
      the drawing over 3D. Compose and Configure show no switch and no `canvas` (light — catch-up).
- [ ] Without WebGL, **3D** and **Both** are disabled with the reason shown; the view rules (default per mode and
      width, reset on mode change, placing from Both stays Both) are covered by a UI-logic test.
- [ ] No horizontal page scroll at 360 and 390 px (light — catch-up). All CI checks pass.

## Answers (user, 2026-10-25)

- V1: label **Both**. V2: phone shows the switch in Build & Preview only, Both stacked. V3: **Both** is the default
  at ≥ 1500 px, by mode below. V4: not remembered; resets with the mode. V5: light acceptance (ADR-066).
