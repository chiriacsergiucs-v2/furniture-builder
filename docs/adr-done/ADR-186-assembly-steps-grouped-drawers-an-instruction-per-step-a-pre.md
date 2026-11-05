# ADR-186: Assembly steps: grouped drawers, an instruction per step, a preparation step and a square check

- Status: Implemented
- Date: 2026-11-05
- Implemented: 2026-11-05
- Depends on: ADR-174, ADR-185
- Design: docs/ui-design.md (section 4, results tabs; print sheets)
- Backlog: N189
- Agreed: 2026-11-05 "Re-check assembly steps, both ui and pdf, they seem to not have the expected assembly relevant info and steps."
  Answers: "Group identical drawers", "One instruction per step", "Preparation step first", "Square check before back"

## Context

Same re-check as [ADR-185](../adr-done/ADR-185-assembly-steps-print-language-drawings-fasteners-and-hardwar.md): the chest's Drawer
boxes step lists 16 rows for 4 identical drawers; a step is a title and a parts list with no sentence saying what to
do; nothing prepares the parts (edge banding, hinge cups, shelf-pin rows) before assembly; nothing says to check the
carcass is square before the back.

## Decision

1. **Grouped drawers.** Identical drawer boxes (same parts and sizes) are one entry "Drawer box × N" with one box's
   parts; different drawers keep their own entry. The same for identical fronts.
2. **One instruction per step.** Each step has one short sentence of what to do, built from the step and its parts,
   e.g. "Fix the left and right side to the bottom (2 joints)." In the app language (`t()`) and the print language
   (`pt()`, ro/ru/en); the guidance line stays (ADR-010).
3. **Preparation first.** A first step **Prepare the parts** lists only what the model already holds: the edges to band
   per part (from each panel's banded edges, ADR-077), hinge cups to drill (count, with the hinge's own label, e.g.
   "35 mm cup"), shelf-pin rows (count of sides with rows). No drilling depths or positions are added (ADR-010).
   A piece with nothing to prepare has no such step.
4. **Square check.** The Back step's instruction adds: "Check the carcass is square (equal diagonals) before fixing
   the back."

## Alternatives considered

- **Keep one row per drawer part** — 16 rows for 4 drawers. Not chosen.

## Scope

- In scope: `assemblySteps`, the Assembly tab, `PrintAssembly`.
- Out of scope: per-step 3D pictures (G-343); editing steps (G-344).

## Consequences

- Positive: a fitter reads what to do at each step; repeated drawers read once.
- Negative / risks: longer sheets for pieces with many banded parts.

## Done when

- [x] A chest of 4 equal drawers shows "Drawer box × 4" with its 5 parts in 4 rows (the two sides in one row; user 2026-11-05: "4 rows, sides combined"); unequal drawers stay apart (tests)
- [x] Every step has an instruction in en, ro and ru; the Back step's includes the square check (tests)
- [x] A base cabinet starts with Prepare the parts listing banded edges and its hinge cups; a plain panel set has no
      preparation step (tests)
- [x] Assembly tab → "Prepare the parts" and "Drawer box × 4" at 390 and 1280 px (jsdom find-it)
- [x] Russian entries for every new text; print texts in ro, ru and en
