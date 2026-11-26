# ADR-295: Phone editor middle ground: one scrolling panel, no chip rail, no folded groups

- Status: Pending
- Date: 2026-11-26
- Depends on: ADR-283, ADR-288, ADR-289, ADR-290
- Design: this ADR (layout rules below); inventory in the pull request "UI: middle ground between original and rework + goal runner"
- Backlog: N385
- Acceptance: browser

## Context

The user (2026-11-26, on an Android phone in Chrome) rejected parts of the canvas editor rework (ADR-283 to ADR-290,
pull requests #307 to #314; rework = `main` at `ba38355`, original = `62d02f9`, the last commit before the rework code):

- The chip rail (search, Overview, Structure, Parts, Sheets, …) scrolls sideways, its chips change with the selection
  and their order changes with use (`orderByUse`, ADR-283 decision 2).
- A chip opens the lens card, and inside it the block is often a closed `<details>` group (Structure, Layouts,
  Drawers and runners, Boards, Fasteners): two levels of nesting and two taps before a control shows.
- A control (for example Hardware) is found only by knowing its chip or its name for Find.
- In the 3D view the quick-count steppers overflow the 3D view, and the 3D view itself is squeezed under the stage
  tools.
- Dragging in the 3D view lags.

The original phone sheet (`62d02f9`) showed every block of the selection in one scrolling list after one tap on the
peek row; only its `<details>` groups were folded.

## Decision

On phones (canvas editor on, ≤ 760 px):

1. **No chip rail.** The sideways chip row is removed. A fixed edit bar takes its place at the bottom of the stage:
   Find (icon), **Edit** (opens the panel; names the selection), the Checks chip when there are errors, and the
   project's Add actions. Its buttons never change order and it never scrolls.
2. **One scrolling panel.** Edit opens the card on the whole editor of the selection (the original sheet's content),
   not one block. Titled blocks have sticky headers.
3. **No folded groups on phones.** Every `Group` in the phone editor and in the Settings and Material sheets renders
   expanded with a plain heading (no `<details>`, no toggle), so an opened panel shows its controls at once.
4. **Fixed jump index.** The card head holds a "Jump to" list of every section in one fixed order that never changes
   with the selection. A section the selection does not have is listed disabled with a one-line reason. The index is
   a shortcut only: every control is also reached by scrolling.
5. **Results inside the panel.** The panel ends with a Results block (Parts, Sheets, Hardware, Assembly, Shopping)
   that opens the output card (ADR-288). The Cut List page keeps the same tabs.
6. **Find stays** (ADR-289) as a shortcut on the edit bar; nothing depends on it.
7. **Back closes the panel.** Opening the panel or the output card adds one history entry; Android back closes it.
   Its state stays right across repeated taps, rotation and a change of selection.
8. **3D view fits.** In the canvas editor the 3D view fills the stage between the ladder and the edit bar; the
   quick-count card stays inside the 3D view's box at 390×844 and 844×390.
9. **3D drag.** The drag is profiled before and after; the cause of the lag is fixed in `src/viewer`, with no change
   to what the 3D view shows (ADR-014).

Kept from the rework: the selection ladder and ↑, the card heights and re-framing, size tags, divide handles, picks,
problem pins and the Checks chip, output lenses, Find, first-run hints, the More switch back to the sheet.
Dropped: the chip rail, per-block lens filtering and tabs, chip ordering by use.

## Alternatives considered

- **Keep the chip rail, wrap it to two rows** — still changes with the selection and still needs the name.
- **Back to the original sheet** — loses the ladder, re-framing and canvas tools the user keeps.

## Scope

- In scope: the edit bar, the panel, flat groups on phones, the jump index, the Results block, back handling, the
  3D stage layout and count card, the drag fix, the browser acceptance script and the goal runner.
- Out of scope: desktop layout (≥ 761 px) except the 3D count card; a device check on a real Android phone (G-596).

## Consequences

- Positive: one tap and a scroll reach every editor control; nothing hides behind a name.
- Negative / risks: the panel is longer than one block; sticky headers and the index keep it navigable.
- Harder to change later: none (no model or storage change).

## Done when

- [ ] At 390×844 no element scrolls sideways at the bottom of the stage and no chip rail exists.
- [ ] Every control in the inventory is reached in ≤ 2 taps (script lists each with its count).
- [ ] No `<details>` inside the phone panel or the Settings and Material sheets; opened panels show controls at once.
- [ ] Hardware and every other section are found by scrolling, without Find.
- [ ] The quick-count card stays inside the 3D view at 390×844 and 844×390 (bounding boxes compared).
- [ ] 3D drag: before and after numbers recorded; target ≥ 50 fps average and no long task over 50 ms.
- [ ] Every new text has its Russian entry; `pnpm typecheck` passes.
- [ ] `tools/mobile-middle/find-it.mjs` passes from the bare app at 390×844 and 844×390.
