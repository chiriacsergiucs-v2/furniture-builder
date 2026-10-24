# ADR-056: Place a chosen catalog item where the user taps on the plan

- Status: Pending
- Date: 2026-10-24
- Decided by: user, 2026-10-24: "create the ADRs … auto-accept the recommended suggestion" (answers below)
- Depends on: ADR-022, ADR-032, ADR-051
- Design: docs/ui-design.md (project Plan view)
- Backlog: N53

## Context

Research feature _Catalogue-led ensemble workspace_ (value 4.5, P0; IKEA). The paper's workflow: open the
workspace, choose a category, **drag a template into the scene** to create an instance. The app already has the
catalog part: _Add a piece_ lists every catalog item grouped by room or type with search, and the Catalog page adds
items to the open project (`src/ui/Catalog.tsx`, `addPiece`). What is missing is choosing **where**: `makeItem`
always places the new piece to the right of the existing ones (`src/core/project.ts`), and it is then moved with
mm fields.

## Decision

- After choosing an item in _Add a piece_ (or _Add_ on the Catalog page with a project open), the project opens on the
  **Plan** with a banner **"Tap the plan to place <name>"** and buttons _Place to the right_ (today's behaviour) and
  _Cancel_.
- A tap/click on the plan places the piece's left-back corner at that point, in whole mm, on the floor (or the
  wall-height for wall-hung pieces, ADR-031), clamped to x ≥ 0 and z ≥ 0. While the pointer moves, an outline of the
  piece's footprint follows it (desktop).
- If the piece would overlap another, it is placed anyway and the existing `pieces-overlap` error shows, as with a
  typed position (ADR-008).
- One placement = one undo step (ADR-051).

## Alternatives considered

- **Drag and drop from the dialog onto the plan** — does not work well on phones (dialog covers the plan) and needs
  a drag library or custom pointer handling across two surfaces; tap-to-place gives the same result on every width.
- **Brand facet** (the earlier gap of N14) — belongs to ADR-029's feed, not to this feature.

## Scope

- In scope: tap-to-place on the plan, outline while moving.
- Out of scope: drag and drop, snapping to neighbours.

## Consequences

- Precise numbers remain available after placing (_From left_, _From back_).
- Snapping to neighbours is not part of this ADR (connector work, not scheduled).

## Done when

- [ ] Unit test: placing at plan point (1234, 456) stores position x 1234, z 456, y 0 (or the wall height).
- [ ] Find-it at 1440 and 375 px: create a project → **Add a piece** → choose an item → banner text **Tap the plan to place** visible → tap the plan → _From left_ shows the tapped value (± 1 mm of the scale).
- [ ] Find-it test passes from the bare app at phone and desktop widths (`tools/ensemble/find-it-adrs.mjs`)

## Answers

1. _Drag-and-drop or tap-to-place?_ — **Tap-to-place (works on phone and desktop); drag not built.**
2. _Keep the old automatic "to the right" placement?_ — **Yes, as the _Place to the right_ button.**
3. _Allow placing on top of another piece?_ — **Yes; the overlap error shows, as with typed numbers.**

## Implementation notes

Store `placingItemId` set by `addPiece`; `placeAt`/`stopPlacing`; banner **Tap the plan to place …** with _Place to the right_ and _Cancel_ (Cancel = undo of the add, ADR-051); the plan maps the tap to room mm via the SVG matrix and shows the footprint outline while the pointer moves; the view switches to Plan. Tests: `tests/project-undo.test.ts` (tap-to-place). find-it `tools/ensemble/find-it-adrs.mjs` (production build, bare app, visible text, 1440 and 375 px): 60/60: tapped piece at From left ≈ 2000.
