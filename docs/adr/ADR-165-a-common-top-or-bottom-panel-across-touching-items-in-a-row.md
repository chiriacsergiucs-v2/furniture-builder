# ADR-165: A common top or bottom panel across touching items in a row

- Status: Pending
- Date: 2026-10-30
- Depends on: ADR-105, ADR-163
- Design: docs/ui-design.md (§4 Screens: project selected-items card)
- Backlog: N167

## Context

User 2026-10-30: "Add the possibility to have a common bottom or top between multiple items."

Answers (2026-10-30): the items are **touching items in a row with the same height and depth**; **each item keeps
its own two sides**; the common panel is switched on and off on the **selected-items card in Project**; its board
is the **leftmost item's carcass board**, changed with the Material dialog (ADR-163, role Top or Bottom, scope Group
or Part); with doubled tops (ADR-105) it is **doubled when every item has a doubled top, else single with a
warning**; items whose top is between the sides (or bottom between the sides) are **built over/under while the
common panel is on**, their own setting kept.

Change control: a new project field (ADR-011): project schemaVersion **16**; older files load unchanged.
`placeItem`'s `noPlinth` (ADR-054: a run plinth replaces the pieces' plinths) is the pattern followed.

## Decision

- **`Project.common?: { id: string; kind: 'top' | 'bottom'; itemIds: string[] }[]`** (schemaVersion 16).
  Validation: 2+ ids of this project, an item in at most one common top and one common bottom; the field in a file
  older than 16 is invalid. A removed item leaves its list; a list with fewer than 2 items is dropped (`pruneCommon`).
- **`commonPanelCheck(project, itemIds, kind)`** → `null` or the reason: every item a cabinet; same quarter turn,
  height, depth, plinth height and floor level; sorted along their width they touch with no gap; same angle.
- **Build** (`buildProjectModel`): for a valid common panel every member is placed with `noTop` (built as
  `top: 'over'`, its `top` panels left out) or `noBottom` (built as `bottom: 'under'`, its `bottom` panels left
  out); one panel `common:<id>` of role `top` / `bottom`, label **Common top** / **Common bottom** (Romanian print
  entries), from the first item's left to the last item's right, the carcass depth, at the members' top (`H − t`)
  or bottom (plinth height), board = the leftmost item's effective top / bottom board (`roleMaterials`, else
  `bodyMaterialId`), banded like a top over the sides / a bottom under the sides. Doubled: two layers when every
  member has `topLayers: 2`; otherwise one and the warning `common-top-layers`. The cut list shows one row
  "Common top" × 1 (× 2 doubled) under its board; the project outline, plinth and worktop rules see the members
  as before.
- **Broken:** when the check fails later (an item moved, resized, turned or removed), the common panel is not
  built, the members get their own tops back and the warning `common-panel-broken` names the reason; the record
  stays until the user switches it off.
- **UI:** Project → the selected-items card (2+ selected) shows toggles **Common top** and **Common bottom**;
  disabled with the reason when the check fails. On = one undo step "common top" / "common bottom"; off removes
  the record. The 3D view and parts list select the common panel like a run part.

## Alternatives considered

- **Any selection, gaps bridged** — more geometry; the user chose touching items (G-320).
- **One shared side between neighbours** — the user chose own sides (G-321).
- **Refuse items with a top between the sides** — the user chose building them over/under while linked.

## Scope

- In scope: field, validation, check, build, diagnostics, cut-list label, store actions, toggles, i18n, tests.
- Out of scope: gaps bridged (G-320), shared sides (G-321), corner and desk members (G-322).

## Consequences

- Positive: one long top or bottom across a run, cut as one part, no extra setting per item.
- Negative / risks: a member built over/under while linked has one board thickness less inside; moving one
  member breaks the link with a warning until it is moved back.
- Harder to change later: the field shape in saved projects.

## Done when

- [ ] Two touching 800 mm cabinets with a common top build one `top` panel 1600 mm wide and no item tops; no
      overlaps; a common bottom likewise (`tests/common-panel.test.ts`).
- [ ] A member with `top: 'between'` is built over the sides while linked; a doubled-top mix gives
      `common-top-layers`; moving a member gives `common-panel-broken` and both own tops (`tests/common-panel.test.ts`).
- [ ] `commonPanelCheck` refuses different heights, depths, plinths, a gap, a turned item and a desk with the reason
      (`tests/common-panel.test.ts`).
- [ ] A version-15 project with `common` is invalid; a version-16 one loads; `pruneCommon` drops a 1-item list
      (`tests/common-panel.test.ts`).
- [ ] Find-it `tests/find-it/common-panel.test.tsx` at 390 and 1280 px: two cabinets selected → "Common top" →
      parts list shows "Common top" once; a wardrobe selected with them → the toggle is disabled with the reason.

## Open questions

None. All answered by the user on 2026-10-30 (see Context).
