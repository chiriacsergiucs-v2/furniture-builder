# ADR-283: Edit on the canvas on phones: selection ladder, chip rail and lens card

- Status: Pending
- Date: 2026-11-22
- Depends on: ADR-078, ADR-112, ADR-144, ADR-211, ADR-241, ADR-247
- Design: https://claude.ai/artifact/HbCBLzkvgFuxRxmUKNzqF3 (design spec), https://claude.ai/artifact/XUw8WtVvpHiYiEuuLkBVUJ (prototype)
- Backlog: N366
- Acceptance: browser

## Context

The user asked (2026-11-22): "create a new approach towards increasing mobile first usability of the editor ...
something that wont even resemble the current drawer architecture, but rather enhance the 3d canvas, include
functionality within the 3d editor, maintaining all actions (hard limit, new implementation has 100% of current
flows and features and configuration-styled editor)".

On a phone the editor is a bottom sheet over the drawing (ADR-112, ADR-211, ADR-247). At half height it covers
40 % of the screen and never re-frames the drawing, so the space being edited can sit under it; at full height the
drawing is gone.

A design study compared six concepts (adaptive tool rail, radial menu, handles only, command palette, focus lens,
canvas-native layers) on weighted criteria (design spec in the Design line). Canvas-native layers won (92 % vs 76 %; today's sheet 72 %). It has
seven slices; this ADR is slice 1, the frame the others plug into. It supersedes the phone sheet of ADR-112,
ADR-211 and ADR-247 only when the flag is on, and removes the sheet only in slice 7.

## Decision

Behind a device flag `fb:canvasEditor` (off by default), at ≤ 760 px in Compose:

1. **Selection ladder.** A pill at the top-left of the stage replaces the peek row and the breadcrumb:
   `Project › Piece › Space › Part`, each crumb a button, with ↑ (up one level, same as Esc).
2. **Chip rail.** One row of labelled chips over the bottom of the stage, above the nav, scrolling sideways. The
   chips are the verbs for the current selection (today's peek actions and section names), ordered by use on this
   device. The first chip is Find (slice 7 fills it; until then it opens the lens card's tab list).
3. **Lens card.** A chip opens a card anchored to the selection that shows one group: the existing section
   (Contents, Doors and handles, Divide this space, Construction, Drawers and runners, Position, Boards, Project
   settings, Variables, Fasteners…) mounted unchanged. Tabs switch groups. Two heights: 30 dvh and 55 dvh (handle,
   tap, arrow keys), replacing the sheet stops. A canvas tap or Esc closes it.
4. **Re-framing.** The drawing and the 3D view fit into the stage area not covered by the card, rail or pill, so
   the selection stays in sight.
5. **Phones only.** Decided with the user (2026-11-22): at ≥ 1024 px the left panel stays; the canvas tags,
   handles and pins of later slices are added there too. The study's 27 % fewer taps on the top tasks (target
   30 %) was accepted by the user; the aim is that the selection stays visible.
6. **No new behaviour in the model.** Sections are split out of `Inspector.tsx`, `Editors.tsx` and `Project.tsx`
   so each mounts alone; their store calls, texts and tests do not change.

## Alternatives considered

- **Keep the sheet, add re-framing** — fixes visibility only; the brief asks for a non-drawer model.
- **Radial menu** — 274 features need deep nesting; path gestures need alternatives (WCAG 2.5.1).
- **Command palette first** — not on the canvas; the keyboard covers ~35 % of the screen.

## Scope

- In scope: the flag, ladder, chip rail, lens card, re-framing, splitting sections into mountable parts.
- Out of scope (later slices, no ADR yet, G-577): size tags and the mm bar; split bars and + divide handles;
  in-space picks; problem pins; output lenses; Find, coach marks and removing the phone sheet. Device and user
  checks of the study (30 fps, 5-user test) wait for this build (G-579).

## Consequences

- Positive: the selected part stays visible while editing; one group at a time instead of a long list.
- Negative / risks: two phone editors live side by side until the last slice; chip labels and pill texts are new text
  (Russian entries in the same change, ADR-153).
- Harder to change later: the section split; later slices depend on it.

## Done when

- [ ] With `fb:canvasEditor` on at 390 px, a space tap shows `Piece › Space N` in the pill and no sheet.
- [ ] Every section reachable from today's phone sheet opens from a chip as a lens card tab (check list in the PR).
- [ ] The selected space stays fully inside the visible stage with the card open at 30 dvh and 55 dvh.
- [ ] ↑, Esc and a canvas tap step out in the same order as today's Up one level.
- [ ] Chips are ordered by use on the device and keep 44 px targets under `pointer: coarse` (ADR-114).
- [ ] Every new text has its Russian entry; `pnpm typecheck` passes.
- [ ] Flag off: the phone sheet and every existing find-it test behave as before.
- [ ] Find-it browser script `tools/canvas-editor/find-it.mjs` passes at 360 and 390 px from the bare app.
