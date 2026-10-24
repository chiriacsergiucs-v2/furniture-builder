# ADR-003: Integer millimetres and one coordinate system everywhere

- Status: Implemented
- Date: 2026-10-21
- Implemented: 2026-10-21
- Depends on: none
- Design: n/a
- Related: ADR-006, ADR-008

## Context

Panel saws and suppliers work in whole millimetres; fractional values break exact gap arithmetic and make cut
lists disagree with drawings.

## Decision

Every dimension and position is a safe integer number of millimetres. Axes: **x** width (left→right), **y** height
(floor = 0, up), **z** depth (back = 0 → front). Conversion to metres happens only inside the 3D viewer. Integer
splits (`distribute`, `equalParts`) give rounding remainders to a defined part, so parts always sum exactly. Odd
gaps/thicknesses are split as `floor(n/2)` + `ceil(n/2)`.

## Alternatives considered

- **Floating point with tolerance** — rejected: epsilon comparisons everywhere, inexact cut lists.

## Consequences

- Inputs reject non-integers (`MmField`, `validateDesign`); the model re-checks (`non-integer` diagnostic).
- Two equal drawers may differ by 1 mm when the space is odd; the cut list shows both sizes honestly.

## Evidence (repository files)

- `src/core/types.ts` — coordinate comment, `Mm`.
- `src/core/geometry.ts` — `isMm`, `distribute`, `equalParts`.
- `src/core/cabinet.ts` — `lo`/`hi` half-gap helpers.
- `tests/core.test.ts` — "distributes integer millimetres exactly".

## Compliance check

Fuzz test asserts every panel box value is a safe integer on all buildable random designs.
