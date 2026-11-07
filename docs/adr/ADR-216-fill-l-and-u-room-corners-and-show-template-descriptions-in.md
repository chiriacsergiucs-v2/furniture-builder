# ADR-216: Fill L and U room corners and show template descriptions in Start from

- Status: Pending
- Date: 2026-11-07
- Depends on: ADR-032, ADR-173, ADR-177, ADR-193, ADR-196
- Design: n/a
- Backlog: N221

## Context

The user asked to cover two open gaps (2026-11-07, "Cover these too") and answered both questions with the interactive
question tool:

- **G-461**: the default L room (3600 × 3000, cut 1500 × 1500) and U room (offset 600) give no Fill the room mix. A probe
  of `suggestRoomMixes` found every mix rejected: a 1500 mm wall gets a corner cabinet at both of its inside corners
  (`pieces-overlap`, 78 mm); in the U, a corner cabinet longer than the 600 mm wall it stands on pokes through a wall
  (`outside-room`), and tall cabinets, top boxes and base units on the 600 mm arm's two walls overlap each other and the
  corner cabinets. Answer: **"One corner per short wall"**: keep the corner cabinet at one end, leave the other corner
  empty, try both ends and let the fewest-warnings ranking pick; corner cabinets only at inside corners; tall cabinets
  and top boxes out of the corner zones.
- **G-470**: the built-in templates' descriptions (`templates` in `src/core/design.ts`) are shown nowhere, and
  `TemplateButton` is unused. Answer: **"Show them in Start from"**.

## Decision

1. **Corner plans** (`cornerPlans`, `src/core/roomfill.ts`). A corner cabinet stands at an inside corner (`insideCorner`,
   unchanged) only when its own footprint fits both walls: its length (`cornerTake().along`, measured from the placed
   template) on the wall holding it and its depth (`across`) on the next wall. Two corner cabinets whose footprints share
   floor never stand together. The plans are the largest conflict-free sets, the one keeping earlier corners first, at
   most 4 (a bound on work, not a size). No magic length: "too short" is the footprints' own overlap.
2. **Each plan is filled** as before (stretches, candidates, tall side, combinations); an empty corner is reserved as
   corner kind `none` reserves it (the first wall's run reaches it). The mixes of all plans are ranked together by the
   existing order (fewest warnings, then fewest pieces). A rectangle has one plan, so its mixes, keys and problems are
   unchanged.
3. **Runs stay off taken floor** (`trimStretches`): a stretch loses the part whose run (a run's depth, fronts included)
   would stand on a kept corner cabinet's footprint or on an earlier wall's run, so tall cabinets, top boxes and base
   units stay out of the corner zones and out of a narrow U arm already filled from its other side.
4. A wall left empty is named by its existing "Wall n has no stretch" note and left off the card (no "Wall n: " line).
5. **Start from** (`StartFrom`, `src/ui/Catalog.tsx`): a row whose variant id is a built-in template's id shows that
   template's description under its summary, through `tr()` (Russian entries already in `ru/data-catalog.ts`); other rows
   show nothing new. `TemplateButton` is deleted.

Problems stay diagnostics (ADR-008); every offered mix is still built and checked as a project.

## Alternatives considered

- **Shorter corner cabinets on short walls**: invents sizes the catalog does not have (ADR-010); not chosen by the user.
- **Drop both corners of a short wall**: loses a corner cabinet the wall can hold.
- **Show descriptions in Fill the room or remove them**: the user picked Start from.

## Scope

- In scope: corner plans, stretch trimming, card text for empty walls, Start from descriptions, feature lines.
- Out of scope: the three template texts that give 720 mm under catalog rows that build 820 mm (G-484, found while
  building; asks the user which height to state).

## Consequences

- Positive: the default L and U rooms give error-free mixes; Start from says what each built-in template is.
- Negative / risks: an L or U call fills up to 4 plans, so it does more work than a rectangle (the rectangle's timing
  test is unchanged).

## Done when

- [ ] The default L room (3600 × 3000, cut 1500 × 1500) gives 4 mixes with no error for every corner kind
      (`tests/roomfill.test.ts`, ADR-216).
- [ ] The default U room (offset 600) gives 4 mixes with no error for every corner kind (same test).
- [ ] `cornerPlans` keeps one corner per 1500 mm wall (both ends tried), never a corner longer than its wall, and all
      four corners of a rectangle; every corner cabinet in a mix stands at an inside corner (tests).
- [ ] An ordinary rectangle behaves as before: the existing roomfill tests stay green, the 4-wall default under 100 ms.
- [ ] `FUZZ_N=30000 pnpm exec vitest run tests/fuzz.test.ts` passes.
- [ ] Find-it at 390 and 1280 px: More → New… → Start from shows "1000 × 720 × 560, 610 mm blind section on the left,
      one door" under the Blind corner row (`tests/find-it/start-from-descriptions.test.tsx`).
- [ ] `TemplateButton` is deleted; feature lines added; G-461 and G-470 set to ADR-216.
