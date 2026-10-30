# ADR-163: One Material control everywhere: part, item, group or project scope on any part roles

- Status: Pending
- Date: 2026-10-30
- Depends on: ADR-055, ADR-124, ADR-151
- Design: docs/ui-design.md (§4 Screens: editor header bar, Material sheet)
- Backlog: N165
- Acceptance: browser
- Agreed: 2026-10-30, every question answered by the user (see Context)

## Context

User 2026-10-30: "Adjusting the material used MUST be always available. Selected material must apply to the
selected piece/item/group/project (buttons). I see we have duplicate and wrong use of material type and material
select. In the Finish group we can keep the configuration. But not only piece/carcass, but any other combination or
piece separately."

Today a board is chosen in five places: the New-piece wizard (Board), Configure → Boards (the boards themselves),
Settings → Materials and Part boards (per item, ADR-151), Project → Finish (Fronts / Carcass with a scope, ADR-055)
and Project settings → Carcass / Front / Back board (ADR-124). Answers (2026-10-30): scope words = **Part / Item /
Group / Project**; **one Material button everywhere**; duplicates to remove = Project settings boards, Settings →
Materials, the "· maker, type" suffix on board selects, the wizard list (ADR-164); parts = **checkable part roles
plus one single part**; Group = **the selected items, or the run when one item is selected**.

Change control: Project settings keep their `body` / `front` / `back` keys (ADR-124, ADR-011); the Material panel
with scope Project writes them so a piece added later still follows the project's boards. `Design.roleMaterials`
is a new design field (schemaVersion 6). ADR-055's Finish group and ADR-151's Part boards group are replaced by
this panel; their core functions stay.

## Decision

- **Material button** (icon, label "Material") in the header bar tools next to Settings, on the editor page in a
  piece, a project and Build & Preview. It opens the **Material** dialog (phone: bottom sheet; desktop: dialog).
- **Scope** segmented buttons: **Part** (one part of the selected item, chosen from a select of its parts; preset to
  the part selected in the parts list or 3D view), **Item** (the open or selected item), **Group** (the selected
  items when 2+ are selected, else the run of the selected item; disabled with "not in a run" otherwise),
  **Project** (every item). In a piece outside a project only Part and Item show.
- **Parts** (scopes Item, Group, Project): checkable chips **Fronts, Carcass, Top, Bottom, Sides, Shelves, Dividers,
  Back, Drawer boxes, Drawer bottoms, Worktop**; a chip is shown when a target item has such a part. Carcass =
  sides, top and bottom.
- **Board** select: the project's boards (every item, merged by `materialKey`) plus the user's decor list (ADR-049)
  — the list rule is ADR-164. Labels are "name, thickness mm"; the maker/type suffix (ADR-049) stays only on the
  Boards panel.
- **Apply** writes, per target item: Fronts → `frontMaterialId` (cabinet, corner, desk, panel); Carcass →
  `bodyMaterialId` (frame: `solidMaterialId`) and clears `roleMaterials.side/top/bottom`; Back → `backMaterialId`;
  Drawer boxes / bottoms → `drawers.boxMaterialId` / `bottomMaterialId`; Worktop → desk `topMaterialId`;
  Top (frame: `panelMaterialId`), Bottom, Sides, Shelves, Dividers → `roleMaterials[role]`. Scope Part →
  `partMaterials[panelId]` (ADR-151). Scope Project also writes `project.settings.body/front/back` (ADR-124).
  Items without the part are skipped and listed ("Applied to 3 items, 1 skipped: bed has no fronts"). One undo step.
- **`Design.roleMaterials?: Partial<Record<'top' | 'bottom' | 'side' | 'shelf' | 'divider', string>>`**,
  schemaVersion **6**; older files upgrade in memory; the field in a file older than 6 is invalid. `buildModel`
  swaps the board after the generator: `partMaterials` › `roleMaterials` › the group board. Another thickness
  gives the existing `thickness` error (ADR-151).
- **Removed UI:** Project → Finish group (style suggestions move into the Material dialog); Project settings →
  Carcass, Front and Back board selects (their "Follows project" rows stay); Settings → Materials group and Part
  boards group; the drawer box and bottom selects in the Drawers group; panel sets keep their per-part select.

## Alternatives considered

- **Keep the five places, dedupe labels** — the user named them as duplicates.
- **One board per role stored as part ids** — part ids change when a piece is rebuilt; roles survive.
- **Live-linked project finish** — rejected in ADR-055; pieces stay copies.

## Scope

- In scope: the dialog, scopes, roles, the field, validation, model, store, removals, i18n, feature tree, tests.
- Out of scope: run-part boards (worktop, fillers) in the dialog (G-317); edge-band choice per role (G-318).

## Consequences

- Positive: one place for every board decision, reachable from any view with the scope in view.
- Negative / risks: `roleMaterials` is one more layer the parts list must explain (the Part select shows the
  effective board).
- Harder to change later: the field name and the role list in saved designs.

## Done when

- [x] `roleMaterials` swaps the board of every part of that role; `partMaterials` wins over it; another thickness
      gives the `thickness` error; a version-5 file with the field is invalid (`tests/role-boards.test.ts`).
- [x] `applyMaterial` with scope Item/Group/Project and roles Top + Shelves changes only those parts; Carcass clears
      the role entries; Project scope writes `project.settings`; one undo step (`tests/role-boards.test.ts`).
- [x] Group = the selection when 2+ selected, else the run (`tests/role-boards.test.ts`).
- [x] Browser find-it `tools/material/find-it.mjs` at 390 and 1280 px: bare app → "Material" → scope buttons
      Part / Item / Group / Project → chips → Board → "Apply" → "Applied to …"; no Finish group, no Carcass board
      select in Project settings, no Materials group in Settings; board labels without "· maker, type"; no
      horizontal scroll.

## Implementation notes

`src/core/finish.ts` (`applyMaterial`, `putRoleBoards`, `putPartBoard`, `materialTargets`, `itemRoles`),
`src/core/boards.ts` (`boardChoices`, `boardLabel`), `Design.roleMaterials` (`src/core/types.ts`, validated in
`src/core/design.ts`, swapped in `src/core/build.ts`), store `applyMaterial` and `clearPartBoard`,
`src/ui/MaterialDialog.tsx`. Tests: `tests/role-boards.test.ts`, `tests/find-it/part-boards.test.tsx`; browser
find-it `tools/material/find-it.mjs` 30/30 at 1280 and 390 px on the production build.

## Open questions

None. All answered by the user on 2026-10-30 (see Context).
