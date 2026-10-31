# ADR-170: Neighbours share one side panel

- Status: Pending
- Date: 2026-10-31
- Depends on: ADR-165
- Design: docs/ui-design.md (§4 Screens: project selected-items card)
- Backlog: N172
- Agreed: 2026-10-31, every question answered by the user (see Context)

## Context

User 2026-10-31: "ADR for G-317, G-318, G-320, G-321, G-322, same pr". G-321 (from ADR-165): items keep their own
two sides; no shared side between neighbours.

Answers (2026-10-31): **outside sizes stay**: the left item drops its right side and the right item's left side
serves both, so the left item's inside grows by one board thickness and nothing moves; **each front covers half the
shared side**; its own toggle **Shared sides**, with or without a common top or bottom; **pin rows on both faces**;
**cabinets only** (corner units and desks keep both sides, with the reason).

Change control: a project field (ADR-011): `Project.sharedSides`, project schemaVersion **18**; older files load.

## Decision

- **`Project.sharedSides?: { id: string; itemIds: string[] }[]`** (schemaVersion 18): the selected cabinets, left to
  right, share a side at each joint. Validation as `common` (ADR-165); `pruneShared` drops removed items.
- **Check** (`sharedSideCheck`): cabinets, counted once, turned the same way, no extra angle, same height, depth,
  plinth, back and side board thickness, touching with no gap. Otherwise refused with the reason.
- **Build** (while linked): the left member is built with `omitSide: 'right'` (the generator option the corner
  units use), so its inside spans to its outline edge; the right member's left side stands there. Fronts: the left
  member's fronts end half a side thickness short of its edge, the right member's left fronts start half a side
  thickness in, each minus half the front gap, so the joint reads like a door gap. Pin rows: the shared side gets
  rows on its left face for the left member's adjustable shelves, at that member's row positions.
- A link that no longer fits is not built (warning `shared-side-broken` with the reason); the members get both sides
  back.
- **UI:** the selected-pieces card gets a third toggle **Shared sides** (info tip, disabled with the reason).

## Alternatives considered

- **Items slide together** — moves pieces and run parts; the user chose outside sizes stay.
- **Right item's front covers it all** — uneven reveal; the user chose half each.

## Scope

- In scope: field, validation, check, build, fronts, pins, warning, store, toggle, tests, find-it.
- Takes over G-321.
- Out of scope: corner units and desks sharing a side (G-328, the user's pick); sliding and inset fronts at a shared
  side keep their own rule: an inset front never covers a side, a sliding door runs in its own track (G-329).

## Consequences

- Positive: one board less per joint; a cleaner joint line.
- Negative / risks: a member moved alone breaks the link until moved back; the left member's inside is wider than
  its own sides imply.
- Harder to change later: which member owns the shared side (the right one).

## Done when

- [ ] Two linked 600 mm cabinets: 3 sides, not 4; the outlines and places are unchanged; no overlaps; the left
      inside is one thickness wider (`tests/shared-sides.test.ts`).
- [ ] Fronts meet over the middle of the shared side with the front gap; full-overlay fronts elsewhere unchanged
      (`tests/shared-sides.test.ts`).
- [ ] The shared side has pin rows on both faces when both have adjustable shelves (`tests/shared-sides.test.ts`).
- [ ] Refusals and `shared-side-broken`; a v17 project with the field is invalid (`tests/shared-sides.test.ts`).
- [ ] Find-it `tests/find-it/shared-sides.test.tsx` at 390 and 1280 px: two cabinets selected → Shared sides → Parts
      shows 3 sides; a wardrobe in the selection disables it with the reason.

## Open questions

None. All answered by the user on 2026-10-31 (see Context).
