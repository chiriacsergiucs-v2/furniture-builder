# ADR-035: Construction guidance is a rules registry keyed by part role and product, producing labelled warnings

- Status: Implemented
- Date: 2026-10-22
- Implemented: 2026-10-23
- Decided by: user request; defaults below await confirmation
- Depends on: none
- Design: n/a
- Related: ADR-008, ADR-010, ADR-032, ADR-036, ADR-037, ADR-038
- Backlog: N25

## Context

The catalog must make sure variations stay buildable. Professional tools keep such limits in hardware and
construction libraries, not in product templates, and warn rather than block (research 2026-10-22, unverified).
Mobila already runs independent checks in `build.ts` (ADR-008) and hinge bands in `cabinet.ts` (ADR-010).

## Decision

- `src/core/rules.ts` holds a list of rules `{ code, appliesTo: role | product kind | family function, check(model,
design, settings) → Diagnostic[] }`, run by `buildModel` after the generators, for **every** design (catalog or
  hand-built).
- Thresholds are **settings with defaults**, stored per design under `settings.rules` only when changed, labelled
  "typical — confirm for your board and hardware". First set (values unverified, from research; confirm before
  accepting):
  - shelf span over 700 mm in 18 mm particleboard / 750 MDF / 900 plywood → warning `shelf-span`;
  - single hinged door wider than 600 mm → warning `door-width`; hinge count stays the ADR-010 bands;
  - drawer box and runner fit (existing) — no new numbers;
  - storage taller than 1000 mm without a wall-fixing note → warning `anti-tip` (hardware line "wall fixing — choose
    for your wall"); clothing storage 686 mm+ tall adds the same note;
  - part larger than the stock sheet minus trim → error (existing nesting rule, ADR-019);
  - wardrobe interior depth under 530 mm with a hanging rail → warning `hanger-depth`;
  - tilt-up: √(H² + D²) above the project room height, when a room height is set → warning `tilt-up`.
- **Safety-regulated families** (bunk bed, cradle/crib, children's furniture — EN 747, EN 716 and similar) are not
  validated against numbers Mobila cannot verify; their variants stay `requires: ['safety:user-confirmed']` until the
  user supplies the standard values, and every such design carries a permanent warning that it is not a compliance
  check.
- Warnings never block export; errors do (ADR-008).

## Alternatives considered

- **Validation expressions in each template** — rejected (ADR-032): misses hand-built designs and duplicates
  rules across families.
- **Hard errors for spans and door widths** — rejected: they depend on load and material; guidance only.

## Consequences

- New rules are code + a test; changing a threshold is a setting, not a release.

## Evidence (repository files)

- `src/core/build.ts` (independent checks), `src/core/cabinet.ts` (`hingeCount`, runner fit), `src/core/nesting/validate.ts`.

## Compliance check

When accepted: each rule has a test that fires on a minimal design and stays silent on every shipped variant at its
default size (or the variant documents why it warns); no rule message omits "typical".

## Open questions (defaults used until answered)

1. Confirm the first threshold set above, or supply your own shop values.

## Implementation (2026-10-23)

`src/core/rules.ts` runs after the generators and the independent checks for every design. The shelf-span,
wide-door and hanging-depth checks moved there from `cabinet.ts` (same codes).

Thresholds used (open question 1 not answered yet): shelf span **900 mm for 18 mm board, scaled by thickness,
×1.2 for plywood** — the app's earlier 50 × thickness rule, kept so existing designs do not start warning; the 700 /
750 / 900 values above were not adopted without the user's confirmation. Door 600, hanger depth 530, tilt-up when a
room height is set (uses the smaller of width and depth). Anti-tip is a hardware line on floor storage over 1000 mm
("Anti-tip wall fixing"), not a warning, so tall pieces do not carry a permanent warning. Bunk beds and cradles carry
a permanent _not a compliance check_ warning and their catalog variants cannot be inserted. Settings are editable
per piece in the _Checks_ group.

Evidence: `src/core/rules.ts`, `src/core/build.ts`, `src/ui/Editors.tsx` (`ChecksGroup`);
`tests/constructions.test.ts` (rules registry block, 6 tests), `tests/catalog.test.ts` (shipped variants only carry
documented warnings).

Verification 2026-10-23 (branch `feat/catalog-templates`): `npm run lint`, `npm run typecheck`, `npm test` (157 passed), `npm run build` passed; `FUZZ_N=30000` fuzz passed (cabinets with the new fronts and flags, and frames); scripted headless Chromium against the production build at 1280 and 390 px, 18/18 checks, no page errors, no sideways scroll. Six code mutations each fail a test. Not checked on a real phone, with a screen reader, or on the deployed site.

## Amendment (2026-10-23)

Safety-regulated items (bunk bed, cradle) open once the user ticks _I check safety-regulated items against the
standards myself_ on the Catalog page (stored on this device); their _not a compliance check_ warning stays.

## Answers (2026-10-23, from the user)

1. Thresholds confirmed: shelf span **900 mm** for 18 mm board (scaled by thickness, ×1.2 plywood), widest single door **600 mm**, hanger depth **530 mm**, anti-tip line above **1000 mm** — all editable per piece.
