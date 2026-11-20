# ADR-281: Raise the family variant cap to 12 and add six variants to six families

- Status: Implemented
- Date: 2026-11-20
- Implemented: 2026-11-20 (Cap 12, 36 variants in six families, symmetric outer reveal (G-558))
- Depends on: ADR-033
- Design: n/a
- Backlog: N364

## Context

User, 2026-11-20, on the Catalog after the tile grid (N352): "focus on all the items that have more than six
configurations, we need to show variations a lot, not just one more column but actual significantly different
implementations"; then "all 9 families, 6 each, carefully crafted, unique by design and functionality" and "raise to
12 for all". On 2026-11-20 the user then cut sink-base, desk and chest ("Cut those families from this ADR"), because six truly
different designs do not exist there; the other six families stay at six each. The data: 9 of 43 families have 4 or 5 variants (base-doors, base-drawers, sink-base, wall-cabinet,
tall-cabinet, wardrobe, chest, media-console, desk); no family has more than 4 configurations.

[ADR-033](../adr-done/ADR-033-every-template-family-ships-1-5-default-variants-interior-on.md) says: "Limits: 1 ≤
variants ≤ 5." and "A variant ships only when it is not an obvious two-click edit of another variant or when its
construction differs." This ADR replaces the limit (not the second sentence). ADR-033 is not edited.

## Decision

- **Cap 12** for shipped families and for the user's own templates: `validateLocalTemplate`
  (`src/core/catalog/local.ts`), the Catalog editor label `Variants (1–12; the first is the default)`, and
  `tests/catalog.test.ts`. Saved templates with 1–5 variants stay valid. No Dexie or document-shape change.
- **Six new variants in each of six families** (base-doors, base-drawers, wall-cabinet, tall-cabinet, wardrobe,
  media-console; 5 + 6 = 11 for the first five, 4 + 6 = 10 for media-console; the first stays the default). Each is built only
  from what the generators already do (`cab`, `splitX`/`splitY`, `door`, `sliding`, `flap`, `shelves`, `drawers`,
  `hanging`, `empty`, `desk` supports and pedestal spaces), with sizes inside the family's own `dims` range. No new
  hardware spec, load, drilling value or ergonomic number (ADR-010).
- **Proposed list** (Claude's draft; the user can strike or swap any row):
  - wardrobe: 1-door narrow hanging; open walk-in (no doors); 3 sliding doors; drawer tower + hanging; long hanging over
    shoe shelves; hanging with lift-up top boxes.
  - base-doors: narrow 300 + shelves; 2 doors, 3 shelves; drawer over 2 doors; open niche beside a door; 2 doors with a
    divider and inner drawers; bin cabinet (one door, empty).
  - base-drawers: one deep pot drawer; 5 equal drawers; shallow cutlery drawer over 2 deep; 1200 three-drawer bank;
    two side-by-side stacks; drawers beside an open cookbook niche.
  - wall-cabinet: 1 door, 900 high; 3 doors; open over 1 door; double flap; corner-width shelf unit with
    one door; narrow spice 300.
  - tall-cabinet: pantry with open shelves; fridge-top pantry; broom + shelves split; two stacked doors over shelves only;
    drawers tower; open shelves tower.
  - media-console: 3 doors; open niche row; drawers only; centre open with 2 flaps; floating with 2 drawers; low row
    of doors.
- **Check each by the ADR-033 sentence.** A row that turns out to be a two-click edit of another is replaced or
  dropped and listed under Skipped with its gap, not relabelled (R2). If a family turns out to have fewer than six, ship fewer and say so rather than pad.
- Per variant: id, `VARIANT_RO` entry, Russian `tr()` entries (`packages/i18n/src/ru/data-*.ts`), picture
  (`pnpm catalog:snapshots`, doors off), `pnpm catalog:docs`, no error diagnostic, a distinct cut list.
- **Wall rows keep the five original wall variants** (`WALL_VARIANTS` in `wallfill.ts`, ids by name): a suggested row
  resizes a piece by width only, so flaps, hardware choices and fixed-mm parts would be stretched out of their design.
  ADR-104 said "then the rest of the family"; this replaces that sentence.
- The ADR-124 fuzz test draws from its own random sequence (as the edge bands do), so catalog edits no longer reseed
  the tests after it. That exposed a latent mirror rounding bug (G-558). User decision 2026-11-20 ("Symmetric outer
  limit"): a half-style cabinet's right outer reveal is its left one reflected (`x1 = W - lo(t) - hi(g)`, was
  `W - hi(t) - lo(g)`), so a mirrored copy matches the original to the mm. With an odd board or gap the right outer
  front is 1 mm wider; saved designs keep their parameters and rebuild with that size. Replaces ADR-024's right-hand rounding.
- One ADR, one pull request, built family by family in separate commits.

## Alternatives considered

- **Cap 12 for shipped only** — two rules for one concept; the editor would reject a copy of a shipped family.
- **Replace weak variants, keep 5** — contradicts the user's "show variations a lot".
- **One ADR per family, stacked** — nine reviews of the same cap change; needs the user's approval (CLAUDE.md).

## Scope

- In scope: the cap, 36 variants, their text, pictures, docs and tests.
- Out of scope: sink-base, desk and chest get no new variants (user's cut, G-557).
- Out of scope: new generator capabilities, new hardware (G-NNN if any variant needs one), filters or grouping inside a
  family (the tile grid copes with 11 tiles).

## Consequences

- Positive: families look different at a glance; more starting points; the cut list differs per variant.
- Negative / risks: 36 designs to review; Catalog grows from 118 to about 154 items, so pages get longer.
- Harder to change later: shipped variant ids are referenced by saved projects (origin kept, ADR-028).

## Done when

- [x] A template with 12 variants validates and one with 13 gives the `variant-count` problem, worded `A template has 1 to 12 variants.` in English and Russian (tests).
- [x] Each of the six families has 10 or 11 variants, or fewer with each missing one listed as a gap with its reason.
- [x] Every new variant builds with no error diagnostic and a cut list different from its siblings (tests).
- [x] Every new variant has `VARIANT_RO`, a Russian entry and a committed picture (`tests/snapshots.test.ts`).
- [x] `docs/catalog.md` regenerated; `pnpm typecheck`, `pnpm build`, `pnpm docs:check` pass; fuzz run once.
- [x] Find-it (jsdom, 390 and 1280 px): the Wardrobe family shows 11 tiles; the editor says `Variants (1–12; …)`.
- [x] A half-style cabinet with an odd board and its mirror have equal front sizes (`FUZZ_N=30000` mirror fuzz passes).

## Open questions

- None. Decided by the user 2026-11-20: cut sink-base, desk and chest; build on the PR #301 branch.
