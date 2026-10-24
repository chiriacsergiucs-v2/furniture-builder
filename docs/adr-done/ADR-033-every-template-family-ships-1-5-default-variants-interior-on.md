# ADR-033: Every template family ships 1–5 default variants; interior-only variants double as layout presets

- Status: Implemented
- Date: 2026-10-22
- Implemented: 2026-10-23
- Decided by: user request; defaults below await confirmation
- Depends on: none
- Design: n/a
- Related: ADR-005, ADR-010, ADR-023, ADR-031, ADR-032, ADR-034
- Backlog: N23

## Context

The user asked for default variants on every template: at least one and at most five, few for simple pieces (a
bookcase with a back panel) and the most for kitchen cabinets. Research (2026-10-22, unverified): IKEA sells kitchen
and PAX set-ups as ready "combination" articles; professional libraries keep variants as sibling saved items;
Tylko's category pages are one engine with different starting configurations.

## Decision

- **Count rule.** A variant ships only when it is not an obvious two-click edit of another variant or when its
  construction differs. Limits: 1 ≤ variants ≤ 5. Guide: simple open storage 1–2, other furniture 2–4, kitchen
  cabinets 3–5. The exact list per family is `docs/catalog.md`.
- **Variant record:** `{ id, name, summary, kind, requires[], design }`.
  - `kind` = `interior` (only the space tree, sizes or materials differ — builds on an existing root) or
    `construction` (needs a capability listed in `requires[]`, e.g. `front:sliding`, `top:rails`, `root:frame`).
  - `requires[]` names ADR capabilities. A variant whose requirements are not built is shown greyed with the ADR it
    waits for; it cannot be inserted. Hardware-dependent variants carry `requires: ['hardware:user']` and insert only
    with a diagnostic asking for the datasheet (ADR-010).
  - The first variant is the family default and must be `ready`/`interior` when the family is `ready`.
- **Layout presets.** Every `interior` variant's space tree is also offered as **Apply layout…** on any space of a
  compatible product (cabinet interior, corner wing, desk pedestal): it replaces the selected space's tree, keeps
  the root id (like `makeBays`, ADR-031), is one undo step, and never changes outer size or materials.
- **Names** describe use, not sizes ("Hanging + shelves", "3 drawers, deep bottom"), in English and Romanian
  (`src/core/ro.ts`).
- Variant defaults are guidance from catalogs and are labelled so on the card ("typical — check your room and
  hardware"); they are never presented as standards compliance.

## Alternatives considered

- **Variants as parameter overrides** — rejected (ADR-032): no generator to apply them, and Tylko-style regeneration
  loses user edits.
- **Unlimited variants** — rejected: retail planners carry dozens because their fronts are fixed SKUs; in Mobila the
  editor covers the long tail.

## Consequences

- 112 variants across 42 families (`docs/catalog.md`); 57 are `interior` and build on today's roots.
- Presets make chest, nightstand and drawer-base layouts reusable across families.

## Evidence (repository files)

- Today: `src/core/design.ts` — `makeBays`/`bayLayoutOf` already apply a layout to a space keeping ids (ADR-031);
  `templates` holds 10 single-variant entries.

## Compliance check

When accepted: tests check variant counts against the limits, that every `interior` variant builds with zero errors
at its default size and at the family's `dims.min`/`dims.max`, that _Apply layout_ keeps the root id and outer
bounds, and that a variant with unmet `requires[]` cannot be inserted.

## Open questions (defaults used until answered)

1. Show the variant count on Start from rows ("4 variants")? Default: yes.

## Implementation (2026-10-23)

112 variants: kitchen 38 (most families 5), storage 28, tables 17, seating 20, sleeping 9; the bookcase has one.
57 are interior-only; 96 can be inserted today, 16 wait (⏳) for a construction that is not built (`shape`,
`front:fixed`, `front:lid`, `frame:arms`, `frame:modules`, `frame:under-storage`) or for safety values.
`hardware:user` variants insert with `catalog.hardwareToChoose` set, which raises a warning until the user marks it
chosen. _Apply layout_ offers the inside of every insertable interior cabinet variant on any space (keeps the
space id, one undo step).

Differences from the text above: variant names are English only (families have a Romanian name, `nameRo`);
the compliance test builds each variant at its default size only — at `dims.min/max` many layouts are not meant to fit
and report diagnostics; presets come from cabinet variants only. Open question 1 (variant count on Start from rows):
the chevron shows the number of further variants.

Evidence: `src/core/catalog/types.ts` (`insertable`, capabilities), `src/core/catalog/presets.ts`,
`src/ui/Editors.tsx` (`LayoutPicker`); `tests/catalog.test.ts`, `tests/templates-local.test.ts` (presets keep id and
outer size).

Verification 2026-10-23 (branch `feat/catalog-templates`): `npm run lint`, `npm run typecheck`, `npm test` (157 passed), `npm run build` passed; `FUZZ_N=30000` fuzz passed (cabinets with the new fronts and flags, and frames); scripted headless Chromium against the production build at 1280 and 390 px, 18/18 checks, no page errors, no sideways scroll. Six code mutations each fail a test. Not checked on a real phone, with a screen reader, or on the deployed site.

## Answers (2026-10-23, from the user)

1. Superseded: _Start from_ lists every item individually, with the item count in its heading.
