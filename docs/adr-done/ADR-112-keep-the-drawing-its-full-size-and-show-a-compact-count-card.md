# ADR-112: Keep the drawing its full size and show a compact count card inside it

- Status: Implemented
- Date: 2026-10-27
- Implemented: 2026-10-27
- Depends on: ADR-109
- Design: docs/ui-design.md (section 4, editor screen: stage, quick-count card, bottom sheet)
- Backlog: N111
- Acceptance: browser
- Agreed: 2026-10-27 "Remove from the drawing and 3d card, keep only in drawer", "Compact, keep 44 px (Recommended)",
  "Full free height (Recommended)", "Shorter labels"

## Context

The user, 2026-10-27, with a phone screenshot of a project piece selected in Compose: "Increment/decrement card must be
inside the rendered 2d view, not over. It's size should also be much smaller. Also it should not contain the
width/height, keep that only part of the side/bottom drawer." and "Force 2d view to maintain it's size, bottom cars can
cover it partially, but not push it." In the screenshot the drawing had shrunk to a strip about 180 × 50 px: the card
([ADR-109](../adr-done/ADR-109-show-the-quick-count-card-over-the-project-drawing-and-put-d.md)) takes its height from the top of
the view, and the bottom sheet takes the rest. This replaces, for the card, the ADR-106 decision to show Width and
Depth "in the quick-count card over the drawing and the 3D view"
([ADR-106](../adr-done/ADR-106-change-a-whole-piece-s-width-and-depth-where-it-is-selected.md)); Width and Depth stay in
the side panel and the bottom sheet.

## Decision

- **No Width and Depth in the card:** the quick-count card over a single piece's drawing, over the project front view
  and over the 3D view shows counts only. Width and Depth stay in the side panel (desktop) and the bottom sheet (phone).
- **Compact card inside the view:** the card is laid over the drawing, inside the stage's frame, in the corner farthest
  from the selected part; it no longer takes height from the view. One row per count: short label, then − N +. No
  group heading, minimal padding. Buttons stay at least 44 × 44 px under `pointer: coarse` (ui-design N82).
- **The stage keeps its size:** on a phone the stage fills the free height between the toolbars and the bottom nav.
  The bottom sheet, collapsed or open, overlays its lower part and never resizes it. The card and the sheet never
  change the drawing's scale.
- **Plan toolbar on one row (takes over G-134):** visible labels "Fronts" (was "Doors and fronts") and "Clear." (was
  "Clearances"); accessible names keep the full words. The nested `.plan-tools` row goes. User answer 2026-10-27
  "Shorter labels".
- No model, store or document change.

## Alternatives considered

- **Keep Width/Depth in the card over the single piece and 3D** — not chosen by the user.
- **Shrink the card's buttons to ~32 px** — breaks the N82 touch-target rule; not chosen.
- **Fixed share of the screen for the stage** — not chosen; full free height chosen.

## Scope

- In scope: the card's content, size and place over the drawing, project front view and 3D view; the phone stage
  height with the bottom sheet; the find-it script.

## Consequences

- Positive: the drawing stays readable while a piece is selected; one place for Width and Depth.
- Negative / risks: the card can cover part of the drawing that is not the selected part.
- Harder to change later: nothing; no stored shape changes.

## Done when

- [x] With a piece or a project piece selected, the card over the drawing and the 3D view shows no "Width" or "Depth";
      the side panel / bottom sheet still shows both and typing a width resizes the piece.
- [x] The card lies inside the stage's box and does not cover the selected part, at 390 and 1280 px.
- [x] Each card row is at most 52 px tall and its buttons at least 44 × 44 px at 390 px with touch.
- [x] At 390 px the stage's height and the drawing's scale are the same with nothing selected, with a piece selected
      and with the bottom sheet open.
- [x] At 390 px "Fronts", "Snap", "Select" and "Clear." sit on one row of the plan toolbar.
- [x] Find-it passes from the bare app at phone and desktop widths (`tools/stage-card/find-it.mjs`, production build).
