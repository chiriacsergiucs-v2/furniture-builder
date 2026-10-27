# UI critique, 2026-10-27

User request: "Run a critique for listings, headers, text, button sizes, gaps, groupings." Measured on the production
build (local, branch `ccr-f59485c7-l9ci3p`, commit 5a0c220 code) with Playwright at 390 × 844 (touch, `pointer: coarse`)
and 1280 × 800. Nothing here is built yet; ADR-110 and ADR-111 cover the first two sections.

## Editor stage and count card (ADR-110)

| Case                                     | Drawing, no card | With card          | Card    |
| ---------------------------------------- | ---------------- | ------------------ | ------- |
| Single piece, 390, whole cabinet         | 358 × 350        | 271 × 265 (−43 %)  | 378×261 |
| Single piece, 1280, whole cabinet        | 488 × 476        | 391 × 382 (−36 %)  | 416×229 |
| Project front view, 390, piece           | 358 × 133        | 242 × 90 (−54 %)   | 378×186 |
| Project, 390, piece selected, sheet open | —                | front view 358 × 0 | 378×186 |

- High: the card takes its height from the drawing (`src/ui/Elevation.tsx:143`, `src/ui/Project.tsx:1676`).
- High: the open sheet shrinks the stage from 609 to 327 px (`src/styles.css:4663-4668`, `:5259-5264`); in a project the
  front view drops to 0 px (the user's screenshot).
- High: the card covers the front view's ⓘ button and the selected piece's top size label.
- Medium: the plan toolbar takes 2 rows at 390 (nested `.plan-tools`, `src/ui/Clearances.tsx:165`; G-134).
- Medium: on desktop Width/Depth and counts show three times (side panel, panel counters, card).
- Low: checkboxes (Doors and fronts, Clearances) and pressed buttons (Snap, Select) mixed in one row.

## Intro text (ADR-111)

- `InfoTip` exists (`src/ui/controls.tsx:307`, ADR-080): hover/focus with a mouse, tap with touch, Esc closes.
  Needs: `align="start"` (clips off the left beside a left heading), a z-index above the count card, Esc must not also
  close a `<dialog>`.
- Inventory: about 23 move whole, 7 split (keep the live part), 12 ADR-010 guidance lines, 1 warning and 37 live
  values / empty states / diagnostics stay. Plus Projects, Catalog, wizard step help and Settings dialogs (≈14).

## Button sizes and wrapping

- High: New dialog rows overlap at 390 with touch (`.row-btn{min-height:44px}` in a height-limited grid,
  `src/styles.css:5280`, `:1141`).
- High: Settings › Run parts spills 29 px past its card ("Suggest worktop, plinth, fillers and covers", nowrap).
- Medium: "Build & Preview" wraps to 2 lines (`.modes .segmented` still 3 columns for 2 buttons, `src/styles.css:4498`).
- Medium: "Merge with Base cabinet, 1 door on the right" wraps (`src/styles.css:1910`).
- Medium: result tabs need ≈406 px, get ≈358; Checks wraps alone.
- Medium: Settings head "Whole cabinet" wraps (`.dialog header` also styles `.insp-head`, `src/styles.css:1127`).
- Medium: under 44 px with touch: ask-text input 322 × 28, wizard step buttons 106 × 33, wizard Name 322 × 38,
  template-editor inputs 28–38 px tall, trash button 42 × 44 with no accessible name (`src/ui/Catalog.tsx:1089`).
- Medium: seven control heights on desktop (28–47 px); `--touch: 40px` unused and contradicts N82.
- Low: lone full-width buttons (Lock, Print shopping list); Arrange buttons wrap raggedly.

## Listings, headers, text, gaps, groupings

- High: Catalog sticky filter row hides under the phone app bar (both `top:0`, `src/styles.css:2836`, `:2283`).
- High: Catalog page is ≈74 000 px tall at 390 (≈1 060 px per family).
- High: the Selected piece card runs ≈1 900 px on desktop; the pieces list sits below it.
- Medium: heading scale: Catalog h2 and h3 both 17/600; Settings dialog has two h2; Projects shows three headings in
  a row; uppercase `.card-title` mixed with sentence-case h4.
- Medium: spacing: 192 ad hoc values vs 229 tokens (6 px × 23 off-scale); `.bar` defined five times.
- Medium: Catalog controls take ≈360 px before the first family at 390.
- Medium: wizard on phone: preview first, form starts at y ≈ 540; Back, Cancel, Skip, Next in three styles.
- Low: Catalog tags push to a 2nd line in 72 of 183 cards; Projects row names wrap beside three icon buttons; editor
  name field cut with no ellipsis; "Back to the editor" chevron points right; ADR numbers in UI text (Editors.tsx:374).
