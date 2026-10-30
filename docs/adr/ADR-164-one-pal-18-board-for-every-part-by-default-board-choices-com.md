# ADR-164: One PAL 18 board for every part by default; board choices come from the project's boards

- Status: Pending
- Date: 2026-10-30
- Depends on: ADR-049, ADR-163
- Design: docs/ui-design.md (§4 Screens: New piece wizard, Material sheet)
- Backlog: N166
- Agreed: 2026-10-30, every question answered by the user (see Context)

## Context

User 2026-10-30: "By default front and everything will use 18mm same type of pal." and "The pal chosen at the
beginning should be the same one from the Materials section, not a temporary unless overriden."

Today `cabinetDefaults` puts PAL 18 on the carcass, MDF 18 on the fronts, HDF 3 on the back and drawer bottoms and
PAL 16 on drawer boxes; a desk top is PAL 18 oak. The wizard's **Board** choice is a fixed list built from
`defaultMaterials()` (the built-in boards) and sets only the carcass (or the desk top, or the frame panel) board.
Answers (2026-10-30): the one PAL 18 goes on **everything, literally** (backs and drawer bottoms too); board
choices come from **the project's boards plus the user's decor list**, the default being the project's carcass
board; the built-in boards appear only when there is nothing else.

Change control: defaults only; no implemented ADR fixed the front, back or drawer boards. Catalog snapshots
(`pnpm catalog:snapshots`) and template tests that read the default boards are regenerated.

## Decision

- **Defaults.** `cabinetDefaults`, `cornerDefaults`, `deskDefaults`, `defaultDrawers`, the frame panel board and
  the wizard registry put `pal18` (PAL 18 white) on the carcass, fronts, back, drawer boxes, drawer bottoms, desk top
  and frame panels. Frame solid members keep the solid-wood material (ADR-038). The built-in list
  (`defaultMaterials()`) keeps its other boards as choices. Geometry follows the board thickness as before (an
  18 mm applied back adds 18 mm behind the carcass, ADR-003).
- **Board lists.** One function `boardChoices(project | null, design)` gives every board select its options, in
  this order: the project's boards (every item, merged by `materialKey`; outside a project the design's own boards),
  then the user's decor list (ADR-049) as "name, thickness mm (your list)". The built-in boards are offered only
  when the list would otherwise be empty (a new piece outside a project). Used by the Material dialog (ADR-163),
  the New-piece wizard and the panel-set per-part select.
- **Wizard.** The Board step's default is the project's carcass board (`project.settings.body`, else the carcass
  board of the first item, else PAL 18 white); its answer goes to every board key of the new piece (carcass,
  fronts, back, drawer boxes, drawer bottoms, desk top, frame panels). A decor pick becomes a board of the piece
  (`decorPatch`, ADR-049); a project board is copied in with a new id (ADR-055 rule).
- Pieces keep full copies of their boards (ADR-022); nothing is linked.

## Alternatives considered

- **Everything except backs and drawer bottoms** — the user chose "everything, literally".
- **Decor list only, once imported** — hides the project's own boards.
- **An app-wide Materials list in storage** — new table and migration; not asked (G-319).

## Scope

- In scope: defaults, `boardChoices`, wizard default and apply, panel-set select, snapshot and template updates,
  tests.
- Out of scope: an app-wide board list (G-319); run-part board selects (G-317).

## Consequences

- Positive: a new piece is one board, one sheet type; the wizard offers what the project already uses.
- Negative / risks: an 18 mm back and 18 mm drawer bottoms are heavier than the usual 3 mm; the user overrides per
  role with the Material dialog.
- Harder to change later: catalog templates store the boards they were made with (ADR-046).

## Done when

- [ ] A new cabinet, corner, desk and drawer use `pal18` for every board key; the samples and catalog snapshots
      build without new diagnostics (`tests/defaults.test.ts`, existing template tests).
- [ ] `boardChoices` lists project boards then decors, built-ins only when empty (`tests/defaults.test.ts`).
- [ ] The wizard's board answer sets every board key and defaults to the project's carcass board
      (`tests/defaults.test.ts`).
- [ ] Find-it `tests/find-it/board-choices.test.tsx` at 390 and 1280 px: in a project whose carcass is "PAL 18
      oak", New piece → Board shows "PAL 18 oak" selected and the decor list entries; the new piece's parts list shows
      the fronts and back on PAL 18 oak.

## Open questions

None. All answered by the user on 2026-10-30 (see Context).
