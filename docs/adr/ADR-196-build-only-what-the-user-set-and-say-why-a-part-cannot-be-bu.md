# ADR-196: Build only what the user set, and say why a part cannot be built

- Status: Pending
- Date: 2026-11-05
- Depends on: ADR-003, ADR-008, ADR-010, ADR-023, ADR-024, ADR-025, ADR-037, ADR-038, ADR-040
- Design: docs/ui-design.md (4. Screens — Inspector, problem banner, cut list)
- Backlog: N201

## Context

Domain 5, the furniture model (`src/core/{cabinet,corner,frame,desk,panel,panelset,build,geometry,design}.ts`): the
generators and every diagnostic text were read and probed with scratch vitest builds (diagonal corner with a handle and
adjustable shelves, chair with 10 back slats, fixed splits, flaps with bar handles, a 120 mm cabinet with a 150 mm gap,
100 mm drawer fronts, an L-corner with adjustable shelves). No layout changes, so no screenshots. User's request: "Split
the entire app into domains or flows … critique of design … 1 adr with high and medium issues and fixes per flow".

## Decision

1. **Diagonal corner drops the handle and the adjustable flag (High).** `corner.ts` `buildDiagonal` never calls
   `placeHandle`/`handleHw` and always builds fixed shelves ("Shelf support, 4 per shelf"), while the Inspector offers
   both for that space: no handle in the schedule, no holes, no diagnostic. Fix: drill and schedule the handle on the
   diagonal door(s) with the cabinet's `placeHandle` rule, and add an error `diagonal-adjustable` "A diagonal corner has
   no straight sides for shelf pins; make the shelves fixed". Chosen over silently clearing the flag (ADR-008).
2. **Back slat count is clamped silently (High, ADR-008).** `frame.ts` `n = max(1, min(back.count, floor(bw/(w+20))))`:
   a chair set to 10 back slats (Inspector allows 12) builds 6, a 1200 bench set to 12 builds 11, no warning. Fix:
   build the asked count and add an error `back-slats-crowded` "{n} back slats of {w} mm do not fit between the posts
   ({bw} mm); at most {max} fit". Chosen over a warning (the parts would overlap).
3. **Lift-up flap handle lands at the hinge (High).** `cabinet.ts` builds a flap with `placeHandle(…, 'drawer', …)`:
   bar holes 40 mm from the top edge for both directions, but a lift-up flap hinges at its top (ADR-037), so the holes
   sit beside the hinge; the Inspector shows the default position as "Middle" for a flap while the model drills near the
   top. Fix (user answer 2026-11-05: 40 mm from the free edge, centred): a flap's default follows its direction
   (`up` → bottom edge, `down` → top edge), the Inspector shows that
   default, an explicit `position` is kept. Chosen over always "centre" (not where a flap is pulled).
4. **A gap wider than the front zone builds negative fronts (Medium).** 120×200×150 cabinet, `frontGap` 150: "Door
   −30×50 mm is too small", "Door has no size (50×−30 mm)" and a cut-list row of width −30. Fix: when a zone is ≤ 0 on
   either axis, one error `front-gap` "The {g} mm gap leaves no room for fronts on {w}×{h} mm" and no front (doors,
   drawers, sliding, flaps). Chosen over clamping the gap (ADR-008) or printing absolute values.
5. **`split-fit` blames "fixed sizes" and hides the dividers (Medium).** 382 + 382 mm in an 800 cabinet says "Fixed
   sizes do not fit in 764 mm" (they add up to 764; the 18 mm divider does not fit), and two shares (0.01 + 1000) get
   the same text though nothing is fixed. Fix: "Parts need {asked} mm but {room} mm is left after {k−1} dividers of
   {t} mm ({along} mm inside)" and, for a share rounding to 0, "Part {i}'s share is too small to give it any width".
6. **Adjustable shelves in an L-corner's open wing: warned, then built anyway (Medium).** Wing B omits its corner side;
   `addPinRows` warns "No side panel found for shelf pins on one side…", still builds the loose shelf and schedules 4
   pins per shelf, while the same result on a short space is an error (`pin-rows-short`). Fix: error
   `pin-rows-no-panel` naming the wing ("The side-wall wing has no side at the corner, so its shelves cannot rest on
   pins; make them fixed") and no pins scheduled. Chosen over a silent fixed-shelf fallback.
7. **Blind corner template promises a 400 mm blind section but builds 610 (Medium).** `design.ts` `templates`
   "corner-blind": "400 mm blind section on the left"; `cornerDefaults('blind').blindWidth` is 610. Fix: the description
   reads the defaults. Chosen over changing the default, which ADR-025 set (neighbour depth + 50).
8. **The too-low drawer error does not say what front would do (Medium).** 3 × 100 mm fronts: a "bottom drawer was
   adjusted" warning, then "Drawer 1 box would be only 54 mm high", nothing linking 100 mm front → 84 mm slot − 30 mm
   clearance. Fix: "Drawer {i} box would be only {bh} mm high (front {fh}, slot {slot}, clearance {vc} mm); give it a
   front of at least {min} mm", and no resize warning when this error follows. Chosen over lowering the 60 mm minimum.
   Every text added or changed gets its Russian entry (ADR-153).

## Alternatives considered

- **Clear the diagonal's handle/adjustable in the store (finding 1)** — edits the saved design behind the user's back.
- **Warn and keep the clamp (finding 2)** — still builds a piece the user did not ask for; ADR-008 forbids clamping.
- **Always centre flap handles (finding 3)** — avoids the direction rule but is not where a flap is pulled.
- **Validate `frontGap` ≤ 50 in `validateDesign` (finding 4)** — rejects whole files and still leaves tiny cabinets
  with ordinary gaps building negative doors.
- **Fixed-shelf fallback in the open wing (finding 6)** — silently changes what the user set.

## Scope

- In scope: the fixes above, their tests (core, constructions, shapes; fuzz re-run FUZZ_N=30000), a jsdom find-it test
  (tests/find-it/model-diagnostics.test.tsx, 390 and 1280 px) finding the new texts and the flap default.
- Out of scope: pin rows on five-sided boards (adjustable shelves in a diagonal corner) (G-364).
- Out of scope: which edge "left" means for handle holes on a turned wing-B front (not verified here) (G-365).
- Out of scope: hardware notes assembled from English fragments (`hingeBand`) — the i18n domain (G-366).

## Consequences

- Positive: no part is built from an option the user cannot see; every refusal names the number that would work.
- Negative / risks: designs that built clean (clamped slats, diagonal with a handle) now show errors until edited;
  catalog snapshots of flaps with handles change (`pnpm catalog:snapshots`).

## Done when

- [ ] A diagonal corner with a bar handle drills and schedules it; `adjustable` there gives `diagonal-adjustable`.
- [ ] A chair with 10 back slats gives `back-slats-crowded` and no overlap; 4 slats build as before.
- [ ] A lift-up flap drills its bar 40 mm from its bottom edge, a drop-down flap from its top; the Inspector shows the
      same default; an explicit position wins.
- [ ] No negative box or cut-list size for any gap; `front-gap` names gap and zone; fuzz FUZZ_N=30000 passes.
- [ ] `split-fit` names asked, room, dividers and inside width; a 0 mm share names the part.
- [ ] An L-corner wing without a corner side makes adjustable shelves an error and schedules no pins.
- [ ] The blind corner template description matches `cornerDefaults('blind')`.
- [ ] `drawer-low` names front, slot, clearance and the smallest front that fits; Russian entries for every new text.
