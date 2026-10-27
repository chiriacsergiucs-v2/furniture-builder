# ADR-103: Fill a wall width with a suggested mix of pieces (reverse build wizard)

- Status: Implemented
- Date: 2026-10-27
- Implemented: 2026-10-27
- Depends on: ADR-022, ADR-035, ADR-042, ADR-044, ADR-046
- Design: docs/ui-design.md (section 4, screens; wizard and catalog cards)
- Backlog: N101
- Agreed: 2026-10-27 "400–1200 mm", "Warn above the entered height (Recommended)", "Tall cabinet, Base with shelves, Base with drawers, Wall cabinets above", "A door over shelves", "Add a centre divider (Recommended)", "Second ADR right after (Recommended)", "Separate tall depth", "Catalog base height, changeable in Refine", "4 mixes (Recommended)", "Min piece width, Number of pieces, Tall cabinets: count + position, Drawer / door / shelf counts, 6 equal front panels, what's behind is to be configured", "Equal fronts, any carcass widths", "Any width in whole mm", "Equal per kind, exact split (Recommended)", "Catalog SVG snapshot (Recommended)", "Closest to your example first", "Full find-it test (Recommended)"

## Context

The user, 2026-10-27: "a reverse furniture building, total width, to the mix of furniture pieces that fill that
space, example: livingroom is 300cm, 1 tall cabinet, 4 base cabinet, each of 60cm width, 2 base cabinets with
shelves, 1 with drawers, one with a front. So basically a mix and match. The app must have a wizard, which would
ask the width/depth, height (allow with a warning items like tall cabinets, above this height). Then suggest a good
width per piece, going for 2m wide pieces is usually avoided, and extra wide shelves sag and so on, so optimal width
would range between x and y, resulting in a few pieces of furniture mixed. Suggest that layout as a 3d rendered image
(just like in the catalog), suggest at least a few at first, then based on user's additional info (like max cabinet
width input, suggest further optimised mixes)."

Nothing goes from a wall to several pieces today: the New-piece wizard (ADR-044) builds one piece; projects
(ADR-022) hold placed pieces; rules (ADR-035) hold the shelf-span guidance; catalog pictures are SVG snapshots
(ADR-042). Wall cabinets above are [ADR-104](../adr-done/ADR-104-add-a-row-of-wall-cabinets-to-the-fill-a-wall-mixes.md).

Requirement ledger (R1): (1) a mix of pieces fills the width; (2) the wizard asks width, depth, height; (3) tall
items above that height are allowed with a warning; (4) piece widths stay in a range [x, y], no sagging shelves;
(5) each layout is a 3D picture like the catalog; (6) a few suggestions first; (7) better mixes after more input.

## Decision

- **Entry:** **Fill a wall** on Projects and in Start something new. Steps: **Wall** (width, depth, height, tall depth prefilled with
  the depth) → **Suggestions** (4 cards) → **Refine** → **Use this mix**.
- **Kinds:** tall cabinet, base with open shelves, base with drawers, base with a door over shelves (the user's
  "with a front"). Each uses its kitchen catalog variant (ADR-007, ADR-032), resized.
- **Widths:** any whole mm in [min, max], default **400–1200** (the user's values). Pieces of one kind share one
  width (all base kinds share one width in this slice, G-118); the wall remainder is spread 1 mm at a time from the left (exact split, ADR-003). Widths in steps of
  50 mm are tried first. The sum is always exactly the wall width.
- **Sag:** a shelf piece whose inner width exceeds `settings.rules.shelfSpan` (guidance, 900 mm for 18 mm board)
  gets a centre divider, two bays, so no shelf exceeds the span.
- **Height:** base height = catalog base height (Refine field). A piece taller than the entered height gets a
  warning on its card and stays offered; nothing is clamped (ADR-008).
- **Core:** `src/core/wallfill.ts`, pure. `suggestMixes(input)` enumerates kind counts and widths, builds each mix
  as a `Project` through `buildProjectModel()` (ADR-004), drops mixes with an error, and ranks them: closest to
  the example first (fewest distinct widths, round widths, one tall cabinet, widths near 600 mm, then no odd
  millimetre, symmetry, fewest pieces). Deterministic and bounded. Tall cabinets keep the catalog height (G-117).
- **Picture:** `snapshotSvg` of the project model (the placed panels of the whole mix), drawn on each card, with its widths ("600 · 600 · 600 · 600 · 600").
- **Refine:** min and max piece width, number of pieces, tall cabinets (count; left, right, both ends or centre),
  at least N drawer / door / shelf bases, and **Equal fronts: N**. Equal fronts gives every door the same width
  (W / N, exact split); a carcass holds 1 or 2 fronts (G-116), so carcass widths may differ; the insides start empty, to
  be configured in the editor. **Suggest again** recomputes.
- **Use this mix** saves and opens an ordinary project, pieces side by side on the floor (ADR-046). No new stored
  shape and no Dexie change.

## Alternatives considered

- **Grid widths only** (150–1200 catalog grid): the user chose any width in whole mm.
- **A filler panel for the remainder**: the user chose whole-mm widths instead.
- **Live 3D per card**: heavy on a phone, and against ADR-014; the user chose the catalog snapshot.

## Scope

- In scope: the wizard, `suggestMixes`, the centre divider, the project picture, Refine with equal fronts, Use this
  mix, core, fuzz and UI-logic tests, find-it.
- Out of scope: corner and L walls (G-113); room windows, doors and outlets shaping the mix (G-114).
- Skipped while building: 3+ fronts per carcass (G-116); a tall-height field (G-117); a width per base kind (G-118); at most 40 pieces per mix (G-122, review).

## Consequences

- Positive: a first layout for a whole wall in a few taps, from pieces the app already builds.
- Negative / risks: combinations grow with the wall width; the search is bounded and has a time test.
- Doors under equal fronts match within 1 mm: the 3 mm front gap has integer half reveals at carcass edges
  (ADR-006), so a 2-door carcass's leaves can be 1 mm narrower than a 1-door carcass's door.
- Harder to change later: nothing stored beyond an ordinary project.

## Done when

- [x] Core: for 3000 mm, 400–1200, every mix sums to 3000, has no error and stays in range; "5 × 600: 1 tall, 2
      shelves, 1 drawers, 1 door over shelves" is first (tests).
- [x] Core: max 600 drops wider pieces; 0 tall drops tall pieces; 3017 mm splits exactly in whole mm (tests).
- [x] Core: a shelf piece wider than the shelf span gets a centre divider; no shelf exceeds the span (tests).
- [x] Core: Equal fronts 6 on 3000 mm gives six doors, one per 500 mm front width, equal within 1 mm, on
      carcasses in range, insides empty (tests).
- [x] Fuzz: random walls and Refine inputs never throw; an empty result gives a diagnostic that says why.
- [x] A tall piece above the entered height shows a warning on its card and is still offered.
- [x] Refine → Max piece width → Suggest again changes the cards; Use this mix opens a saved project.
- [x] Find-it passes from the bare app at phone and desktop widths (`tools/wall-fill/find-it.mjs`, production build).
