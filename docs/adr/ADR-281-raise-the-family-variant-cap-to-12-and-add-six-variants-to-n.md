# ADR-281: Raise the family variant cap to 12 and add six variants to nine families

- Status: Pending
- Date: 2026-11-20
- Depends on: ADR-033
- Design: n/a
- Backlog: N360

## Context

User, 2026-11-20, on the Catalog after the tile grid (N352): "focus on all the items that have more than six
configurations, we need to show variations a lot, not just one more column but actual significantly different
implementations"; then "all 9 families, 6 each, carefully crafted, unique by design and functionality" and "raise to
12 for all". The data: 9 of 43 families have 4 or 5 variants (base-doors, base-drawers, sink-base, wall-cabinet,
tall-cabinet, wardrobe, chest, media-console, desk); no family has more than 4 configurations.

[ADR-033](../adr-done/ADR-033-every-template-family-ships-1-5-default-variants-interior-on.md) says: "Limits: 1 ≤
variants ≤ 5." and "A variant ships only when it is not an obvious two-click edit of another variant or when its
construction differs." This ADR replaces the limit (not the second sentence). ADR-033 is not edited.

## Decision

- **Cap 12** for shipped families and for the user's own templates: `validateLocalTemplate`
  (`src/core/catalog/local.ts`), the Catalog editor label `Variants (1–12; the first is the default)`, and
  `tests/catalog.test.ts`. Saved templates with 1–5 variants stay valid. No Dexie or document-shape change.
- **Six new variants in each of the nine families** (5 + 6 = 11; the first stays the default). Each is built only
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
  - sink-base: 800 two doors; 1000 with open end shelf; 1200 false front over 2 doors; U-cut drawer over a door;
    1200 with waste pull-out beside a door; open-front for a freestanding sink.
  - wall-cabinet: 1 door, 900 high; 3 doors; open over 1 door; double flap; corner-width shelf unit with
    one door; narrow spice 300.
  - tall-cabinet: pantry with open shelves; fridge-top pantry; broom + shelves split; two stacked doors over shelves only;
    drawers tower; open shelves tower.
  - chest: 3 deep drawers; 6 equal; wide 2-over-2; one door with 2 drawers; nightstand-width 4 drawers; low 3.
  - media-console: 3 doors; open niche row; drawers only; centre open with 2 flaps; floating with 2 drawers; low row
    of doors.
  - desk: two pedestals, drawers left and door right; pedestal with shallow drawer over open niche; compact gable desk
    without modesty; pedestal right with deep drawers; wide two-pedestal workstation; gable desk with side shelves.
- **Check each by the ADR-033 sentence.** A row that turns out to be a two-click edit of another is replaced or
  dropped and listed under Skipped with its gap, not relabelled (R2). I expect this for sink-base, desk and chest, whose
  generators leave little room: say so in the reply rather than pad.
- Per variant: id, `VARIANT_RO` entry, Russian `tr()` entries (`packages/i18n/src/ru/data-*.ts`), picture
  (`pnpm catalog:snapshots`, doors off), `pnpm catalog:docs`, no error diagnostic, a distinct cut list.
- One ADR, one pull request, built family by family in separate commits.

## Alternatives considered

- **Cap 12 for shipped only** — two rules for one concept; the editor would reject a copy of a shipped family.
- **Replace weak variants, keep 5** — contradicts the user's "show variations a lot".
- **One ADR per family, stacked** — nine reviews of the same cap change; needs the user's approval (CLAUDE.md).

## Scope

- In scope: the cap, 54 variants, their text, pictures, docs and tests.
- Out of scope: new generator capabilities, new hardware (G-NNN if any variant needs one), filters or grouping inside a
  family (the tile grid copes with 11 tiles).

## Consequences

- Positive: families look different at a glance; more starting points; the cut list differs per variant.
- Negative / risks: about 54 designs to review; Catalog grows from 118 to about 172 items, so pages get longer.
- Harder to change later: shipped variant ids are referenced by saved projects (origin kept, ADR-028).

## Done when

- [ ] A template with 6 to 12 variants validates; 13 and 0 give a user sentence; 1–5 still pass (tests).
- [ ] Each of the nine families has 11 variants, or fewer with each missing one listed as a gap with its reason.
- [ ] Every new variant builds with no error diagnostic and a cut list different from its siblings (tests).
- [ ] Every new variant has `VARIANT_RO`, a Russian entry and a committed picture (`tests/snapshots.test.ts`).
- [ ] `docs/catalog.md` regenerated; `pnpm typecheck`, `pnpm build`, `pnpm docs:check` pass; fuzz run once.
- [ ] Find-it (jsdom, 390 and 1280 px): the Wardrobe family shows 11 tiles; the editor says `Variants (1–12; …)`.

## Open questions

- Is the proposed list right, and may I ship fewer where six truly different designs do not exist (sink-base, desk,
  chest)? Suggested pick: ship fewer and list the rest (not applied until you pick it).
