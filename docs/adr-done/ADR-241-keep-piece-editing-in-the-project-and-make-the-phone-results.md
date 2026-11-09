# ADR-241: Keep piece editing in the project and make the phone results a Cut list place

- Status: Implemented
- Date: 2026-11-09
- Implemented: 2026-11-09
- Depends on: ADR-079, ADR-080, ADR-088, ADR-091
- Design: docs/ui-design.md (§4, _Phone editor (ADR-241)_)
- Backlog: N250
- Acceptance: browser

## Context

The user (2026-11-09) on the phone UI: "The ui structure is hard to accept", "editing a piece should not kick you
out", and pains "Too many taps, Can't find settings, Drawing covered, Mode/view switching". They asked for the
proposal to be reviewed, criticised, run through EDC twice with a consensus after each run, and the most
app-beneficial choice enforced and built ("AP AF review … edc twice … pick most app-beneficial choice, ensure it is
enforced and implemented").

Measured on the production build at 390 × 844 (2026-11-09): three bars above the drawing took about 120 px; Edit
this piece switched to the piece alone (room, other pieces and the plan gone) behind a `‹ E › V` breadcrumb.
In code, the Compose · Build & Preview mode changes layout only at ≤ 760 px (`src/styles.css`); on a desktop the
results column is always shown.

This replaces, for phones and for project pieces only:

- [ADR-079](../adr-done/ADR-079-split-the-editor-into-compose-configure-and-build-preview-ph.md) /
  [ADR-080](../adr-done/ADR-080-move-configure-into-a-settings-modal-and-view-captions-behind.md): the mode
  segmented control under the app bar, on phones.
- [ADR-088](../adr-done/ADR-088-drill-into-a-piece-without-leaving-the-project-editor.md): "'Edit this piece' stays
  the only way into the piece editor."
- [ADR-091](../adr-done/ADR-091-keep-the-results-tabs-collapsed-until-tapped-so-the-views-st.md): the results open
  collapsed; entering Cut list opens them.

## Decision

- **Edit this piece stays in the project.** In a project, Edit this piece (the card button and the peek row's
  pencil) selects the piece, loads it for edits in place (ADR-088's drill), opens the phone sheet full and brings
  **Inside this piece** into view. The plan, the other pieces and the project stay open. The piece editor screen is
  one step away: **More actions › Open in the piece editor**.
- **Cut list place (phones).** With a piece or project open, the bottom nav reads **Projects · Catalog · Editor ·
  Cut list**. Cut list shows the results (Parts, Sheets, Hardware, Assembly, Shopping, Checks), opening Checks when
  there are errors, else Parts; its badge counts errors (red) or warnings. Editor shows the drawing. The mode row
  under the app bar is not shown on phones; the running estimate heads the Cut list place.
- **Desktop unchanged** (≥ 761 px): the mode row, the results column and the three places stay as they are.
- Kept: the 2D · 3D · Both switch (ADR-144), the sheet stops (ADR-211), the Settings and Material dialogs
  (ADR-080, ADR-163), 44 px targets and 13 px text (N82), one yellow button per screen (N87).
- The PR #203 change stays: choosing a piece or space no longer opens the sheet past its peek row (it replaced N82's
  "a piece chosen in a project opens the sheet"), so a second tap drills deeper.

## Alternatives considered

EDC run 1 (options: keep · targeted fixes · full redesign · hybrid). Consensus: **hybrid**. The full redesign
(Settings and Material into the sheet, one ⋯ menu, a new shell) fixes "can't find settings" best but rewrites the
two largest dialogs and most of the 63 find-it files for the least extra gain; keeping today's layout fixes none of
the four pains; targeted fixes alone leave mode switching.

EDC run 2 (hybrid vs its strongest challenger, targeted fixes only; and the N82 override). Consensus: **hybrid,
phone only, keep the override**. The mode only changes the phone layout, so moving it into the bottom nav is low
risk and frees about 70 px; keeping the hidden radios in the page keeps the jsdom tests valid. Reverting the override
would bring back the second-tap-hits-the-sheet bug.

- **Full redesign now** — deferred: highest cost and regression risk; Settings at full sheet height is what the
  full-screen dialog already is.
- **Rename Build & Preview to Cut list everywhere** — not chosen: desktop shows both views at once, the label still
  fits there.

## Scope

- In scope: Edit this piece in place, Open in the piece editor, the phone Cut list place, the phone mode row hidden,
  the estimate moved, tests.
- Out of scope: Settings and Material in the sheet; one ⋯ menu; the desktop layout; browser scripts in `tools/` that
  click Edit this piece to reach the piece editor (updated when next run).

## Consequences

- Positive: editing a piece never loses the project; about 70 px more drawing on a phone; one fewer switch.
- Negative / risks: the piece editor screen is one tap deeper; the phone has no in-app mode control other than the
  two places.
- Harder to change later: the Cut list place becomes where phone users expect the results.

## Done when

- [x] Edit this piece keeps the project open (its name field, its pieces) and shows Inside this piece (find-it,
      `tests/find-it/phone-editor.test.tsx`, 390 and 1280 px).
- [x] More actions › Open in the piece editor opens the piece editor (same test; `editor-nav`, `room-surfaces`).
- [x] At 390 px the Places nav has **Cut list**, which opens a results tab and is the current place; Editor brings the
      drawing back; at 1280 px there is no Cut list (same test).
- [x] Browser (production build, Chromium, 390 × 844): the Editor mode row is not visible, the stage starts under
      the app bar, Edit this piece keeps the project and opens the sheet full, Cut list opens Parts; at 1280 px the
      mode row is visible and there is no Cut list; no horizontal scroll.
- [x] The estimate chip still opens the Shopping list at both widths (`estimate-chip` find-it).
