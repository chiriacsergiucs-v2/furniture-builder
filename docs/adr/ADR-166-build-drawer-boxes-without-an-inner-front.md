# ADR-166: Build drawer boxes without an inner front

- Status: Pending
- Date: 2026-10-30
- Depends on: none
- Design: docs/ui-design.md (Inspector, Drawers and runners group)
- Backlog: N165

## Context

The user is designing a chest of drawers (810 × 785 × 430 mm, four drawers) and builds drawers the way their photo
shows: two sides, a back and a bottom, closed at the front by the drawer front itself. In their words: "No front to
the box of drawer, just the box itself". Today every drawer box gets a `drawer-inner-front` part
(`src/core/cabinet.ts`), so the cut list has one board per drawer the user will not cut.

Answers (2026-10-30, interactive questions): the setting lives on the whole piece ("Whole piece"), next to the other
drawer settings; drawers behind doors have no front of their own, so they keep their inner front and a warning says
so ("Keep it + warn").

This adds an optional field to `DrawerSettings` in `src/core/types.ts` (ADR-011). Absent = today's box with an inner
front, so no schema bump and old readers and saved designs are unchanged.

## Decision

- `DrawerSettings.innerFront?: boolean`. `false` = the drawer front closes the box: no `drawer-inner-front` part.
  Absent or `true` = today's box. Sides, back, bottom and runner length are unchanged.
- Drawers behind doors (internal drawers) keep their inner front when the setting is `false`, with the warning
  `inner-front-internal`: "Drawers behind doors have no front of their own, so they keep their inner front."
- A sink false front (ADR-054) has no box, so nothing changes there.
- `validateDesign` rejects a non-boolean `innerFront`.
- Inspector, **Drawers and runners** group: a checkbox **Box has an inner front** (on by default); off sets
  `innerFront: false`. Info tip: "Off: the drawer front closes the box, as on many flat-pack drawers." Russian entries in
  the same change; feature tree line in `src/core/features.ts`.

## Alternatives considered

- **Per drawers space** — lets one piece mix both kinds; not asked for (user picked the whole piece).
- **Error behind doors** — blocks export for a setting that has a safe meaning; the user picked keep + warn.

## Scope

- In scope: the field, the generator, the check, validation, the Inspector checkbox, translations, tests.

## Consequences

- Positive: cut list, sheet layouts, 3D and Fusion export lose the inner front with no other change.
- Negative / risks: the box is open at the front until the drawer front is fixed; how it is fixed is the user's
  (no screw or fitting is named, ADR-010).

## Done when

- [ ] A cabinet with `innerFront: false` has no `drawer-inner-front` parts; sides, back and bottom are unchanged (test).
- [ ] Absent `innerFront` gives today's parts (test).
- [ ] Drawers behind doors keep their inner front and get the `inner-front-internal` warning (test).
- [ ] `validateDesign` rejects `innerFront: 'no'` (test).
- [ ] Find-it (jsdom, 390 and 1280 px): the **Box has an inner front** checkbox is found in Drawers and runners;
      unticking it removes "Drawer 1 inner front" from the parts.
