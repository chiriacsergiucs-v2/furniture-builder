# ADR-204: Complete templates and the Fill a wall and Fill the room wizards

- Status: Pending
- Date: 2026-11-06
- Depends on: ADR-011, ADR-060, ADR-071, ADR-100, ADR-103, ADR-104, ADR-125, ADR-153, ADR-170, ADR-173, ADR-193
- Design: docs/ui-design.md (section 4, Screens: dialogs and wizards)
- Backlog: N209

## Context

Seven gaps left by ADR-060/125, ADR-103/104, ADR-173 and ADR-100. User: "in groups of 7-10 gaps create adrs, no
implementation". User accepted the gaps' suggested picks on 2026-11-06. Requests (gap Request fields):
G-210 "Accept default, /batch all ready (ADR-125: run sinks and handles)"; G-348 "Fill the room"; G-117 "allow with
a warning items like tall cabinets, above this height"; G-123 "Wall cabinets above"; G-118 "So basically a mix and
match"; G-116 "6 equal front panels, what's behind is to be configured"; G-104 "New adr 3". No gap conflicts with an
implemented ADR. Pending [ADR-193](../adr-done/ADR-193-fix-the-start-something-new-fill-a-wall-and-fill-the-room-fl.md) rewrites
the same wizard steps (forms, Walls-step depths, the Room hint); this ADR builds on it and does not repeat its fixes.

## Decision

1. **Templates keep run handles and sinks (G-210).** `ProjectTemplate` gains `runHandles` and `sinks` over template
   refs (a handle's `from` and `own`, a sink's `baseId`; gone pieces dropped). A template with either is written at
   `TEMPLATE_SCHEMA` 3 (ADR-011); without, it stays 1 or 2. Versions 1 and 2 load unchanged; `validateProjectTemplate`
   refuses them below version 3 and checks every ref. `projectFromTemplate` and `insertTemplate` (ADR-123) remap
   them like run-part keys, with new ids, at the project schema that stores them (ADR-125). No Dexie version; no
   saved design or template is rewritten.
2. **Tall cabinet height (G-117).** `WallInput.tallHeight` (absent = `TALL_HEIGHT`) sets every tall cabinet and the
   top-box gap. Refine gets "Tall cabinet height", prefilled 2200; the above-the-height warning stays.
3. **Wall cabinet depth (G-123).** `WallInput.wallDepth` (absent = catalog 320) sets `wallPiece` and, in Fill the
   room, `wallRowDepth()`, so the wall corner cabinet (ADR-177) matches. Refine gets "Wall cabinet depth",
   prefilled 320. `checkWall` names a wrong value of either field (ADR-008). Fill the room's Refine shows both
   fields too (`RoomInput` extends `WallInput`).
4. **A width per base kind (G-118).** `candidates()` also tries one round width (50 mm steps, min–max) per base
   kind, the last kind taking the exact rest; ranked after the shared width by `scoreOf` (more distinct widths). The
   signature names each kind's width, so "800 drawers + 600 shelves" and "800 shelves + 600 drawers" are separate
   cards. Tried with tall cabinets at a round width or none; capped by a new `MAX_CANDIDATES`, reported like
   `MAX_PIECES`.
5. **3–4 equal fronts per carcass (G-116).** `frontGroups` adds carcasses of 3 and 4 fronts, after the 1-and-2
   groups. `piece()` builds them as `splitX(even(k))` bays, a divider between, one empty door each (tall: both
   halves). ADR-103's 1 mm door match still holds; a group that breaks it is not offered.
6. **Doors and windows in the New dialog's Room step (G-348).** The room editor's feature list (`RoomSection`,
   `src/ui/Project.tsx`) moves to `src/ui/RoomFeatures.tsx` (`room`, `onChange`), used by both. `roomOf(form)` keeps
   the features; the mix project's room has them. The hint becomes "A ready shape and its sizes, in mm, with its
   doors, windows and other features." (the old key and its Russian entry go).
7. **Match-the-neighbour repairs (G-104).** `compat-depth-match` and `compat-height-match` join `REPAIRABLE`; each
   offers "Make {name} {mm} mm deep like {other}" (or "high"), both ways, sorted by the change in mm. A size-locked
   piece (ADR-122, ADR-171) gets none; a size bound to a variable (ADR-166) is listed refused, "The size follows a
   project variable; change the variable instead."; linked copies follow (ADR-111). Previewed and applied as one undo
   step (ADR-071). Both rules list the repair id in `repairs`.
8. **Text (ADR-153, ADR-158).** New `t()` keys with Russian entries: the two field labels and the hint in
   `src/core/i18n/ru/viewer.ts`, the repair labels and reason in `ru/core2.ts`. Feature tree lines "Fill a wall",
   "Fill the room", "Previewed repairs" and "Create a project from a project template" cite ADR-204.

## Alternatives considered

- **Tall cabinets follow the entered height (G-117)** — a lower wall would shrink every tall cabinet unasked.
- **Per-kind widths replace the shared width (G-118)** — loses the even mixes ranked first today.
- **Duplicate the feature list in the dialog (G-348)** — two copies to keep translated and in step.
- **Move the piece instead of resizing (G-104)** — a move never fixes a depth or height mismatch.

## Scope

- In scope: Decisions 1–8, tests in `tests/template-keeps.test.ts`, `wallfill.test.ts`, `roomfill.test.ts`,
  `repairs.test.ts`, and jsdom find-it tests `tests/find-it/fill-wizards.test.tsx` and `compat-repairs.test.tsx`.
- Out of scope: a repair for the family warning, such as moving a piece away (G-396).

## Consequences

- Positive: kitchen templates keep handles and sinks; more mixes fit; typed rooms get openings; two warnings get fixes.
- Negative / risks: more candidates per wall (capped); older apps refuse version-3 template files.

## Done when

- [ ] A template from a project with a run handle and a sink is version 3; projects made from it and inserts of it
      have both, ids remapped and new; versions 1 and 2 still load; a template without them stays 1 or 2 (tests).
- [ ] `tallHeight` 2000: tall cabinets and top boxes use it, no above-height warning on a 2100 wall; `wallDepth`
      350: every wall cabinet and wall corner cabinet is 350 deep; "abc" in either is a `checkWall` error (tests).
- [ ] 2000 mm wall, 3 pieces, no tall: a mix with an 800 drawer base beside 600 bases, ranked after the shared-width
      mixes; the first 4 mixes of the 3000 mm default are unchanged; a 6000 mm wall stays capped (tests).
- [ ] Equal fronts 6 on 1000 mm gives two 3-front carcasses of 3 bays with one door each, doors within 1 mm (tests).
- [ ] Depth and height warnings offer both match repairs; applying one clears it in one undo step; size-locked
      gets none; a bound size is listed refused; the family warning still has none (tests).
- [ ] Find-it (390 and 1280 px): New… → Fill a wall → Refine shows "Tall cabinet height" and "Wall cabinet depth";
      Fill the room → Room → "Add door" adds a door kept free in the suggestions.
- [ ] Find-it (390 and 1280 px): Checks on a depth warning shows "Make … mm deep like …"; applying it clears it.
- [ ] Russian entries for every new text; old hint entry removed; feature tree updated; typecheck, lint, test,
      build and docs:check pass.
