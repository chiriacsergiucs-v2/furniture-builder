# Phone editor inventory: original, rework, middle ground (ADR-295)

Date: 2026-11-26. Original = `62d02f9` (last commit before the canvas editor code, PR #307). Rework = `ba38355`
(`main`, canvas editor on by default since ADR-290). Middle ground = ADR-295.

Measured at 390×844 in headless Chromium on a new Chest of drawers (piece, then its space selected), with the scripts
in the scratchpad of the session and `tools/mobile-middle/find-it.mjs` (middle ground, taps per control in
`mobile-middle-taps.json`). "Taps" counts taps from the editor with the selection made; scrolling is not a tap.

## Controls

| Control (block) | Original: where · taps | Rework: where · taps | Middle ground: where · taps |
| --- | --- | --- | --- |
| Structure tree | Compose sheet, folded group · 2 | Chip "Structure" → card, folded group · 2 (+ sideways scroll) | Edit → panel, flat · 1 |
| Divide this space (Side by side, Stacked) | Compose sheet · 1 | Chip → card · 1 (+ sideways scroll) | Edit → panel · 1 |
| Contents (Empty, Shelves, Drawers, Hanging, −/+ drawers, Equal, Choose, sink options) | Compose sheet · 1 | Chip → card · 1 | Edit → panel · 1 |
| Doors and handles (None, Door, Pair, Sliding, Flap; handle None, Bar, Knob, Push to open) | Compose sheet · 1 | Chip → card · 1 (+ sideways scroll) | Edit → panel · 1 |
| Layouts (Apply a layout from the catalog) | Compose sheet, folded group · 2 | Chip → card, folded group · 2 (+ sideways scroll) | Edit → panel, flat · 1 |
| Title, path, notes (Overview) | Compose sheet · 1 | Chip "Overview" → card · 1 | Edit → panel · 1 |
| Bays and shelves, Construction | Settings (top bar) sheet · 1 | Settings sheet · 1 | Settings sheet · 1 |
| Drawers and runners, Checks, Boards, sheets and saw cut, Fasteners, Structure | Settings sheet, folded groups · 2 | Settings sheet, folded groups · 2 | Settings sheet, flat · 1 |
| Material | Material (top bar) sheet · 1 | Material sheet · 1 | Material sheet · 1 |
| Parts, Sheets, Hardware, Assembly, Shopping (results) | Cut List (bottom nav) → tab · 2 | Rail chips after the blocks · 1 (+ sideways scroll, name must be known) | Edit → Results block → button · 2; Cut List → tab · 2 |
| Checks list | Cut List → Checks tab · 2 | Checks chip (errors only) · 1; Cut List → tab · 2 | Checks chip on the edit bar · 1; Cut List → tab · 2 |
| Find an action | none | Rail search icon · 1 | Edit bar search icon · 1 (shortcut only) |
| Up one level, path | Breadcrumb in the sheet · 1 | Ladder pill · 1 | Ladder pill · 1 |
| View 2D / 3D / Both, Fronts, Options | Stage tools · 1 | Stage tools (float mid-stage in 3D) · 1 | Stage tools at the top of the stage · 1 |
| Quick counts (−/+ dividers, drawers) in 3D | Count card under the 3D view · 1–2 | Count card, overflows the squeezed 3D view · 1–2 | Count card inside the 3D view · 1–2 |

## Rework items

| Rework item (ADR) | Mark | Why |
| --- | --- | --- |
| Selection ladder and ↑ (283) | KEEP | Shows where the selection is; one tap up |
| Chip rail (283) | DROP | Scrolls sideways, changes with the selection, hides controls behind names |
| Chips ordered by use (283) | DROP | Order changes between visits |
| Lens card shows one block, tab row (283) | DROP | Two levels of nesting; the tab row scrolls sideways too |
| Card heights 30/55 dvh and re-framing (283) | KEEP | Selection stays in sight |
| Card pointer to the selection (283) | KEEP | Harmless, helps orientation |
| Keyboard inset (284) | KEEP | Card sits on the keyboard |
| Size tags open the field (284) | KEEP | Direct manipulation |
| Divide handles (285) | KEEP | Direct manipulation |
| Picks in an empty space (286) | KEEP | Direct manipulation |
| Problem pins and Checks chip (287) | KEEP | Errors one tap away; the chip moves to the edit bar |
| Output lenses (288) | KEEP | Opened from the Results block |
| Find an action (289) | KEEP | Shortcut only |
| First-run hints (289) | KEEP | Pointed at the edit bar |
| On by default, More switch (290) | KEEP | The sheet stays one switch away |
