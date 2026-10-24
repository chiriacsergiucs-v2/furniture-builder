# ADR-077: Each board names its edge band: material, thickness and width, on the cut list and shopping list

- Status: Pending
- Date: 2026-10-24
- Depends on: ADR-009, ADR-010, ADR-049, ADR-064
- Design: docs/ui-design.md (Materials, Output › Parts, Shopping list)
- Backlog: N72

## Context

The user, 2026-10-24: "Check the europe standarts for abs apply them accordingly" (asked which: "ABS edge
banding").

What the search found (search-engine summaries of supplier datasheets; the PDFs themselves could not be opened
from the session, so treat these as document evidence, not checked values):

- **No European (EN) or DIN standard sets ABS edge band sizes or tolerances.** Thickness, width and tolerance
  tables come from each manufacturer (EGGER, REHAU, Hranipex) and differ between them; the EN/ISO/DIN numbers
  quoted on the datasheets are test methods (for example EN 438-2 for light fastness, DIN EN ISO 2039 for ball
  indentation hardness), not product dimensions. A German guideline, VDI 3412, covers specifying and checking
  edge banding; it is not an EN standard either.
- Supplier ranges quoted: thicknesses from 0.4 mm to 3 mm; widths from about 12 to 54 mm; tolerances such as
  ±0.45 mm on width (EGGER) or ±0.2–0.5 mm by width band (REHAU).
- No source confirmed a rule for how much wider the band must be than the board.

Today ([ADR-009](../adr-done/ADR-009-cut-list-lists-finished-sizes-banded-edges-are-annotated-gra.md)) the cut list
gives finished sizes with L/W banded-edge counts and edge-band metres per board; the user confirmed that sizes are
never reduced by the band thickness, because the panel shop applies its own allowance. The shopping list
([ADR-064](../adr-done/ADR-064-one-shopping-list-for-a-project-including-what-is-still-to-ch.md)) shows "Edge band for
<board>" with metres only, so the band itself (ABS or PVC, how thick, how wide) is never written down.

## Decision

- **Applying the finding:** since no standard fixes the values, the app does not fill them in
  ([ADR-010](../adr-done/ADR-010-hardware-is-a-schedule-with-labelled-guidance-never-invented.md)); the user names the band
  per board, as on the supplier's datasheet.
- `Material` gains an optional `band`: `kind` (`abs` · `pvc` · `pp` · `melamine` · `veneer` · `other`),
  `thickness` in tenths of a millimetre (whole numbers, so 0.4 mm is stored as 4; ADR-003 stays whole numbers),
  `width` in whole mm, and an optional `code` (the supplier's decor or article code). Optional `frontBand` with the
  same fields for doors and drawer fronts, which shops often band thicker.
- **Materials dialog:** _Edge band_: type, thickness (choices 0.4 · 0.8 · 1 · 2 · 3 mm, labelled "common
  supplier sizes", plus a typed value), width, code; and _Fronts banded differently_ for `frontBand`.
- **Cut list, CSV and print:** the edge counts stay as today; each board's header names its band ("ABS 1 × 22 mm,
  H1145"). **Sizes are not reduced** (ADR-009 confirmation stands).
- **Shopping list:** one banding line per band spec with its metres ("ABS 2 × 22 mm — 14.6 m"); boards that use
  the same band combine. Without a band spec the line moves to _to choose before buying_. An optional per-edge
  length allowance in mm (for trimming on the edgebander) adds to the metres; default 0, as today.
- **Check:** a band narrower than the board it covers is an **error** ("ABS 19 mm is narrower than the 22 mm
  board"); nothing else is judged, because sources disagree on the overhang.
- A new design shape: `schemaVersion` goes up by one and older files load unchanged (ADR-011).

## Alternatives considered

- **Ship an "EN standard" band table** — none exists; it would invent values (ADR-010).
- **Use one supplier's table (EGGER or REHAU) as defaults** — supplier-specific; offered later as an
  import, like the decor list (ADR-049).
- **Subtract the band thickness from cut sizes** — rejected by the user in ADR-009.

## Scope

- In scope: band fields per board and for fronts, Materials controls, cut list/CSV/print labels, shopping list
  lines, per-edge allowance, the too-narrow error.
- Out of scope: tolerances, edgebander settings, colour matching to the board, importing a supplier band list.

## Consequences

- Positive: the shop and the buyer see exactly which band to order, per board, in metres.
- Harder to change later: band fields are saved in designs (schema bump).

## Done when

- [ ] Band fields validate (kind list, thickness 1–100 tenths, width 1–100 mm) and round-trip; older files load
      (unit tests)
- [ ] Cut sizes are identical with and without a band spec (unit test, ADR-009)
- [ ] Shopping list groups metres by band spec, adds the allowance, and lists boards without a spec under
      _to choose_ (unit tests)
- [ ] A band narrower than its board is an error (unit test)
- [ ] _Edge band_ in Materials and the band label on the parts list are found (find-it at 390 px and 1280 px)
- [ ] All CI checks pass

## Open questions

- Fronts banded differently — default: off (one band per board) until you switch it on.
- Per-edge allowance — default 0 mm (metres as today); give your edgebander's trim if you want it counted.
- The band spec of the boards you use most (for example "ABS 0.8 × 22 carcass, ABS 2 × 22 fronts") — no
  default; you enter them.
