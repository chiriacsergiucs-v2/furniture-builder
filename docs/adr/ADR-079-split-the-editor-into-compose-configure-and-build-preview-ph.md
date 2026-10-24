# ADR-079: Split the editor into Compose, Configure and Build & Preview, phone first

- Status: Pending
- Date: 2026-10-24
- Depends on: ADR-078
- Design: docs/ui-design.md (§4 Screens: editor), docs/research/2026-10-24-ui-redesign-audit.md (§3)
- Backlog: N74

## Context

The user, 2026-10-24: "declutter composition from configuration, optimise mobile view … Improve usability of
configure and build && preview".

The audit is in `docs/research/2026-10-24-ui-redesign-audit.md` (U3, U5, U8, U9):

- One side column mixes layout work (Contents, Doors and handles, Divide) with whole-piece settings (Construction,
  Materials, Drawers and runners).
- Materials is also a separate dialog.
- On a phone the drawing is a sticky 50 vh block between wrapped bars, the editors scroll underneath it, and the
  outputs come last.
- Parts CSV and Print sit in the action bar, away from the Parts list.

Competitors split layout tools from a properties panel (PolyBoard). They also make the itemised list a view of its
own (IKEA PAX planner); see the research note §2.

[ADR-014](../adr-done/ADR-014-the-front-elevation-is-the-editing-surface-3d-is-a-non-autho.md) is kept: the
elevation (or the plan) is where you edit, and 3D only selects, stays lazy and mounts only when visible.

## Decision

The Editor gets three modes, set by a segmented control under the app bar (ADR-078). The mode is remembered per
device (`localStorage` `fb:mode`). Nothing is gated.

1. **Compose: what goes where.**
   - Item: the drawing fills the space.
   - Tapping a space opens its editor (Contents · Doors and handles · Divide · Layouts). On a phone it opens in a
     bottom sheet with a peek row, _Selected: <space>_, and drags up. On a desktop it is the left panel.
   - Breadcrumbs stay.
   - Project: the Plan (the room front view stays reachable), the piece list, placement of the selected piece,
     Add a piece, and Room drawing.
2. **Configure: what it is made of.**
   - Item: one scrolling page with the steps rail on top, then Size, Construction, Materials (inline; the
     Materials dialog is removed and its fields, Add a material, kerf and decor CSV all move here) and Drawers
     and runners. _Open in wizard_ is also here.
   - Project: the settings that apply project-wide (finish scope, Run parts, kerf).
3. **Build & Preview: what you get.**
   - Phone: 3D on top (about 40 vh, mounted only in this mode, with Look, Exploded, Doors and fronts, Reset view
     and Render), then the output tabs (Parts · Sheets · Hardware · Shopping list · Checks).
   - The Parts tab starts with **Download CSV** (the one primary button) and **Print**. Both stay disabled with
     the same reason while there are errors (ADR-008, unchanged).
   - The mode label carries the Checks state, e.g. _Build & Preview · 2 problems_ in the error colour.
4. **Desktop (≥ 1180 px).** The left panel switches between Compose and Configure. The drawing / 3D toggle stays in
   the centre. Build is always the right column. Choosing Build & Preview shows 3D in the centre. Between 760 and
   1180 px, Build sits under the drawing as it does today.
5. Steps-rail jumps follow the modes: Size, Build and Boards go to Configure; Inside goes to Compose; Cut goes to
   Build & Preview › Checks or Parts.
6. Tap-to-place (ADR-056) and room drawing (ADR-059) switch to Compose, just as they switch to the front view today.

## Alternatives considered

- **Keep one column, collapse groups.** That is ADR-030's approach. It still mixes the two concerns and scrolls
  under a sticky drawing.
- **Four modes (separate Preview and Build).** It adds a tap. The 3D view and the parts it highlights belong together.
- **A wizard for every edit.** The New-piece wizard (ADR-044) exists for starting a piece. Editing needs free order.

## Scope

- In scope: `src/ui/shell/EditorModes.tsx`, the layout parts of `Inspector.tsx` and `Project.tsx` (splitting what
  they render between modes), moving the Materials dialog body inline, CSV and Print on the Parts tab, the bottom
  sheet CSS, and updating `docs/ui-design.md` §4.
- Out of scope: new fields or options; `src/core`; store actions beyond reading the mode; the 3D viewer's internals.

## Consequences

- Positive: each mode answers one question, the drawing gets more height on phones, and output actions sit next to
  the output.
- Negative / risks: some project fields need to be assigned to a mode during the build (the mapping is listed in
  the PR). The bottom sheet must not trap focus or the page scroll.
- Harder to change later: the three mode names, which people will learn.

## Done when

- [ ] At 390 px the Editor shows _Compose · Configure · Build & Preview_. Tapping a space in Compose opens
      _Selected: …_ with Contents, Doors and handles and Divide this space, and no Construction or Materials fields
      (find-it).
- [ ] Configure shows Size, Construction, Materials (with _Add a material_) and Drawers and runners. No Materials
      button or dialog is left anywhere (find-it).
- [ ] Build & Preview shows the 3D view and the Parts tab with _Download CSV_ and _Print_. With an error both are
      disabled and Checks shows it unsoftened (find-it on a design with an error; ADR-008).
- [ ] The 3D canvas is not in the DOM in Compose or Configure at 390 px (find-it checks for no `canvas`; ADR-014).
- [ ] A project opens in Compose with the Plan and its pieces. Configure holds the project-wide settings. Tap-to-place
      and room drawing switch to Compose (find-it).
- [ ] At 1280 px, Compose/Configure is on the left, the drawing in the centre and Build on the right. No horizontal
      page scroll at 360 and 390 px.
- [ ] `tools/editor-modes/find-it.mjs` passes on the production build at 390 and 1280 px. All CI checks pass.

## Answers (user, 2026-10-24: "Proceed", every default accepted)

- M1: _Compose · Configure · Build & Preview_. M2: remembered per device. M3: a bottom sheet on phones.
  M4: full acceptance (find-it).
