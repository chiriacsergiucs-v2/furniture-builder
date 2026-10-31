# ADR-168: Material dialog reaches run parts and sets an edge band per role

- Status: Pending
- Date: 2026-10-31
- Depends on: ADR-077, ADR-163
- Design: docs/ui-design.md (§4 Screens: Material sheet)
- Backlog: N170
- Acceptance: browser
- Agreed: 2026-10-31, every question answered by the user (see Context)

## Context

User 2026-10-31: "ADR for G-317, G-318, G-320, G-321, G-322, same pr". G-317 (from ADR-163): run-part boards are not
in the Material dialog; G-318: the dialog changes boards only, the band stays the board's (ADR-077). The request
behind both: "Adjusting the material used MUST be always available" and "any other combination or piece separately".

Answers (2026-10-31): **all run parts** (worktop, fillers and covers, run plinth, trims); a scope reaches a run part
when it reaches **one of the items it was made from**; a band is stored **per role on the piece** (new field), and
**per part** too; band choices are **project bands + seller bands + your own**; the band is a **select under Board**.

Change control: `Design.roleBands` and `Design.partBands` are new design fields (ADR-011): design schemaVersion **7**.
ADR-077's rule "a band belongs to a board" stays the default; a role or part band wins over it.

## Decision

- **Run parts.** New chips in the Material dialog: **Run worktop, Fillers and covers, Run plinth, Trims**, shown in a
  project when a reached item is in such a run part's `from` list (Item, Group, Project), or as entries of the Part
  select (scope Part lists the item's run parts after its own parts). Applying copies the board into the run part's
  `material` (keeping its id). A trim keeps its board in its request (ADR-075): the request's board changes too, so a
  refresh (ADR-061) keeps it.
- **Band per role and per part.** `Design.roleBands?: Partial<Record<BandRole, EdgeBand>>` with `BandRole` = the
  ADR-163 roles plus `front`, `back`, `drawer-box`, `drawer-bottom`, `worktop`; `Design.partBands?: Record<panelId,
EdgeBand>`. `buildModel` keeps each panel's board; the band used for a panel is `partBands` › `roleBands` › the
  board's band (`bandFor`). Cut list, band check (`band-narrow`), shopping and print follow it. A lost part warns
  (`part-band-lost`) and keeps its entry, as part boards do (ADR-151). Run parts get a band on their own copy of the
  board (`material.band`).
- **Edge band select** under Board: **Keep the board's band** (default; Apply then changes boards only), the bands
  named on boards in the project, the bundled seller bands matching the chosen board (ADR-161), and **Your own
  band…** (type, thickness, width, code; validated by `bandProblems`). With a band chosen, Apply sets board and band;
  a board-only choice "Keep the board's band" leaves bands untouched.
- Validation: every band passes `bandProblems`; keys are known roles; at most 2000 part entries; the fields in a file
  older than 7 are invalid; never throws.

## Alternatives considered

- **A board copy per band** — duplicates decors in every board list; the user named duplicates as a problem.
- **Run parts only from Group and Project** — the user chose any scope that reaches one of their items.

## Scope

- In scope: chips and Part entries for run parts, the two fields, validation, model, select, store, tests, find-it.
- Takes over G-317 and G-318.

## Consequences

- Positive: every board and band of a project is reachable from one dialog.
- Negative / risks: a band can now differ from its board's; the parts list shows the effective band per row.
- Harder to change later: the field names and role keys in saved designs.

## Done when

- [ ] `roleBands` and `partBands` give the band used in the cut list, `band-narrow` and shopping, part › role ›
      board; a lost part warns; v6 files with the fields are invalid (`tests/role-bands.test.ts`).
- [ ] `applyMaterial` with Run worktop on Item reaches the worktop made from it; Trims change the request's board too
      and survive a refresh (`tests/role-bands.test.ts`).
- [ ] Browser find-it `tools/material/find-it-bands.mjs` at 390 and 1280 px: a project with a run worktop → Material →
      Run worktop chip → board → Apply → the worktop row in Parts uses it; Edge band → Your own band… → 2 mm → Apply →
      the Fronts' band shows "2 mm" in Parts; no horizontal scroll.

## Open questions

None. All answered by the user on 2026-10-31 (see Context).
