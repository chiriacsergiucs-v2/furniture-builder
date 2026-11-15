# ADR-268: Show the piece as a structure tree that follows the selection

- Status: Pending
- Date: 2026-11-16
- Depends on: ADR-267
- Design: docs/ui-design.md (section 4, editor screen and phone bottom sheet)
- Backlog: N286

## Context

User, 2026-11-15: "drawer too dynamic in real life working, keeps changing since we select inner containers on click,
and hard to keep track what and where." The research (report `wf-19a02fae-9db1-8ebd-843b-31f3c76542e5`) ranked a
structure tree synced with the canvas second: Figma Layers, Webflow Navigator, Onshape and PRO100 all pair the canvas
with an element tree. Mobila has only the one-line path (ADR-267): it shows the ancestors of the selection but not its
siblings or what is inside. The user asked for all ten ideas over several ADRs; this is the second of four (ADR-267,
268, 269, 270).

Selection is one level per tap (ADR-083), so reaching a deep space takes several taps, and a tap in the wrong bay
changes the whole drawer. A tree reaches any space in one step and shows where it sits among its neighbours.

No change to `src/core/types.ts`, the design document or the Dexie schema (ADR-011, ADR-012).

## Decision

1. **Rows from the model.** New pure `src/core/spaceTree.ts`: `structureRows(prod, expanded)` returns the rows in
   reading order: the whole piece (`id: null`), then each product root's spaces depth first, each with `id`, `depth`,
   `label` (the ADR-267 `spaceName`), `kind`, `hasChildren` and `open`. Children show only under an expanded split.
   Desks and corners list every root. The rows are a projection of the design, never separate state (ADR-004).
2. **Structure group.** `StructureTree` in `src/ui/StructureTree.tsx`, a `Group` titled `t('Structure')` at the top of
   the compose drawer, under the head from ADR-267. Open by default on desktop, closed in the phone sheet; its
   open state uses the ADR-267 remembered group state.
3. **Follows the selection.** Selecting a space by any route (tap on the drawing or 3D, crumb, Esc, Up one level)
   expands its ancestors and marks its row selected; the row scrolls into view (`block: 'nearest'`) without moving
   the page. Expanded ids live in `useUi` (memory only).
4. **Tree keyboard model (W3C APG).** `role="tree"`, rows `role="treeitem"` with `aria-level`, `aria-selected`,
   `aria-expanded`; roving tabindex. Up/Down move focus; Right opens a closed row or moves to its first child; Left
   closes an open row or moves to its parent; Home/End; Enter or Space selects. Moving focus never selects: the
   APG warns that selection following focus degrades accessibility.
5. **Click.** A row click selects that space (`select(id)`, `null` for the whole piece) and the drawer updates; the
   drawing outline follows as for any selection (ADR-087). Row text is the name from ADR-267, size in mm after it.
6. Texts: `Structure`, `Whole piece tree` (the tree's accessible name) and the row text pattern have Russian entries
   in `src/core/i18n/ru/inspector.ts` (ADR-153).

## Alternatives considered

- **Tree beside the drawer in its own column** — takes canvas width on a laptop and does not fit a phone.
- **Tree in a separate dialog** — hides the thing that is meant to stay visible.
- **Tab inside the drawer** — a tab that switches the drawer body is another way of "the drawer changed".

## Scope

- In scope: `spaceTree.ts` with tests, the `Structure` group, expand and scroll follow, keyboard model, find-it test.
- Out of scope: hover highlight from rows (ADR-269), drag to reorder or move spaces, rename, a tree of project pieces
  (the project panel already lists them, ADR-160).

## Consequences

- Positive: any space is one click away; siblings and children are visible; keyboard and screen-reader users get a
  real tree.
- Negative / risks: more height in the drawer (closed by default on phones); the tree must stay a projection of the
  design or it drifts from the drawing.
- Harder to change later: row labels follow ADR-267's place names.

## Done when

- [ ] `structureRows` lists the whole piece first, then spaces depth first, hides children of a closed split, and
      lists every root of a desk (unit tests).
- [ ] Tapping a nested space on the drawing marks its row selected and expands its ancestors (find-it).
- [ ] Clicking a row selects that space and the drawer title and path change to it; the whole-piece row selects the
      piece (find-it).
- [ ] Arrow, Home, End, Enter and Space behave as in item 4 and arrows alone never change the selection (test).
- [ ] The group is open at 1280 px and closed at 390 px on a bare start (find-it).
- [ ] Every new text has a Russian entry (`pnpm typecheck`); `pnpm docs:check` passes.
