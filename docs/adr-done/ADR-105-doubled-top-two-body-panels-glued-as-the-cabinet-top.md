# ADR-105: Doubled top: two body panels glued as the cabinet top

- Status: Implemented
- Date: 2026-10-27
- Implemented: 2026-10-27
- Depends on: ADR-036
- Design: docs/ui-design.md (Construction group)
- Backlog: N103
- Agreed: 2026-10-27 "2 panels"; "Option on every cabinet"; "Under the top, height stays"; "Both banded like the top"; "Full find-it"

## Context

The user asked (2026-10-27): "Add the doubled top support", and when asked what it means: "2 panels". A cabinet top
today is one body panel (or two rails, ADR-036). A doubled top is two body panels glued face to face, e.g.
2 × 18 = 36 mm, for a stiffer or thicker-looking top. Answers: an option on every cabinet; the second panel goes
under the top and the outer height the user typed stays; both layers are edge-banded like a single top; full
find-it acceptance.

This adds an optional field to `CabinetParams` (ADR-011); absent = today's single top, so no schema bump and old
designs build exactly as before. It extends ADR-036's construction flags and replaces none of them.

## Decision

- `CabinetParams.topLayers?: 1 | 2` (absent = 1). Validated in `validateDesign`; anything else is an error.
- With `topLayers: 2` and a panel top, the carcass gets two `top` panels of the body material, both the size and
  banding of today's top, stacked at `H − t` (upper, id unchanged) and `H − 2t` (lower, index 1). Outer height
  stays `H`:
  - top **on the sides**: the sides get one `t` shorter;
  - top **between the sides**: sides keep their height;
  - in both, the inside opening, an inset back and the half-overlay front line lose one `t`.
- Corner cabinets get the same `CornerParams.topLayers`: blind and L pass it to their carcasses; the diagonal
  adds a second five-sided top board under the first.
- Both layers are labelled "Top", so the cut list shows one row "Top" × 2 (Romanian "Capac").
- The two layers touch face to face, so the fastener tally (ADR-074) counts them as one carcass joint with the user's
  own fastener choice; no glue or screw spec is invented (ADR-010, G-120).
- With a rails top, `topLayers: 2` builds single rails and gives a warning `top-layers-rails` (G-119).
- Inspector › Construction: a "Top layers" control **Single · Doubled**, shown when the top is a full panel. The merge
  conflict list (`src/core/merge.ts`) names it "top layers".

## Alternatives considered

- **Second panel on top, cabinet grows** — rejected by the user ("Under the top, height stays").
- **One 36 mm board** — needs a 36 mm material; the user asked for 2 panels.
- **Support strips under the top** — not what the user meant ("2 panels").

## Scope

- In scope: the field, validation, geometry, diagnostics, Inspector control, tests, fuzz, find-it.
- Out of scope: doubled rails (G-119), glue and screw line (G-120), doubled bottom, sides or shelves (G-121).

## Consequences

- Positive: thicker tops for any cabinet with one tap; cut list and sheets follow automatically.
- Negative / risks: the inside height drops by one panel thickness; drawers and fronts are rebuilt from it.
- Harder to change later: the field name in saved designs.

## Done when

- [x] Doubled top, on the sides and between the sides: two `top` panels, no overlaps, outer height unchanged, inside
      opening one `t` lower (tests).
- [x] Cut list shows "Top" with quantity 2 for a doubled top (test).
- [x] Rails top with `topLayers: 2` warns `top-layers-rails`; an invalid `topLayers` fails validation (tests).
- [x] Fuzz picks `topLayers` and passes with `FUZZ_N=30000`.
- [x] Find-it from the bare app at phone and desktop widths: open a cabinet, Construction › "Top layers" ›
      "Doubled", the parts list shows "Top" × 2.

## Open questions

- Rails top with "Doubled": default is single rails plus a warning (G-119).
- Glue and screws between the layers: not specified until the user names them (G-120).
