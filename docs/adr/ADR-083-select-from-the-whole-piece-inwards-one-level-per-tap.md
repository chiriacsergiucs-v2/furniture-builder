# ADR-083: Select from the whole piece inwards, one level per tap

- Status: Pending
- Date: 2026-10-25
- Depends on: ADR-014, ADR-079
- Design: docs/ui-design.md (section 4, editor screen)
- Backlog: N78

## Context

User, 2026-10-25: "The flow of selecting the furniture, then the middle (given there are 2 dividers), then having a
horizontal divider, then selecting the bottom one to adjust shelves is a painful horrible user experience. Adjust the
selecting to go from bigger to smaller. 1 click = entire furniture, second click selects the smaller frame, third
again the smaller within, iteratively."

Today a tap on the front view selects the innermost (leaf) space under the finger, a tap on a panel selects the
panel's owner, and split containers are reached only through the breadcrumb
([ADR-014](../adr-done/ADR-014-the-front-elevation-is-the-editing-surface-3d-is-a-non-autho.md), Consequences:
"Split containers are selected via breadcrumb or 'select the divided space around this one'"). In 3D, a tap selects
the owner of the hit panel, so a back or side panel jumps straight to the whole piece. This ADR replaces that
consequence of ADR-014 for taps; the breadcrumb stays (ADR-079).

## Decision

Selection follows the space tree from the outside in, one level per tap, at the tapped point.

- A pure function in `src/core/selectPath.ts`: `pathAt(model, x, y)` returns the node ids from the product root to the
  leaf whose front-view box (`model.spaces`, `view !== 'side'`) contains the point (integer mm, ADR-003);
  `nextSelection(path, current)` returns:
  - nothing selected yet (or the selection is not on this piece): the whole piece;
  - current selection on the path: its child on the path (one level smaller);
  - current selection off the path (a tap elsewhere): the deepest node on the path that is an ancestor of the current
    selection, then one level down — so a tap on a sibling bay selects that sibling, not the whole piece again;
  - current selection is the leaf: stays (G-051).
- "Nothing selected" becomes a state of its own (`selectedId: undefined`), distinct from "whole piece" (`null`), so the
  first tap is visibly the whole piece (outline round the piece, inspector shows the piece). Store change only; the
  design document and `FurnitureModel` do not change (no ADR-011 bump).
- Front view (`src/ui/Elevation.tsx`): one tap handler on the drawing converts the tap to mm and calls the store's
  `pick` with the point; spaces and panels no longer select directly. Keyboard: Enter on the focused drawing drills at
  the centre of the current selection; the breadcrumb keeps going up.
- 3D (`src/viewer/Viewer3D.tsx`): the hit point (`e.point`, converted to mm, x and y) goes through the same
  `pathAt`/`nextSelection`; a tap on empty space clears the selection (as today). Still select-only (ADR-014).
- Project view: unchanged in this ADR — a tap selects the piece (G-052).

## Alternatives considered

- **Double tap to enter a group (Figma style)** — two gestures to learn; double tap zooms on phones.
- **Keep leaf-first, add an "up one level" button** — keeps the long route the user called painful.
- **Tap cycles through all levels at the point, wrapping** — same as the decision except at the leaf; kept as G-051.

## Scope

- In scope: drill-down selection in the piece editor's front view and 3D view, `selectPath.ts` with tests, the
  "nothing selected" state, the whole-piece outline, find-it script.
- Out of scope: a gesture to step back up one level besides the breadcrumb (G-053); drilling from the project plan
  into a piece (G-052).

## Consequences

- Positive: reaching the bottom space of the middle bay is three taps at the same spot, in 2D or 3D.
- Negative / risks: reaching a deep leaf costs more taps than today's single tap; the first tap no longer edits a
  space. Every tap handler and test that assumes leaf-first must change.
- Harder to change later: `selectedId` gains a third state; code that reads `null` as "whole piece" must keep doing so.

## Done when

- [ ] `tests/select-path.test.ts`: on a piece with 2 vertical dividers and a horizontal divider in the middle bay,
      taps at one point select whole piece → middle bay → bottom space; a 4th tap stays on the bottom space.
- [ ] Same test: with the middle bay selected, a tap in the left bay selects the left bay; with nothing selected, a tap
      selects the whole piece; a point outside the piece selects nothing.
- [ ] The same sequence works from 3D hit points (unit test on the mm conversion feeding `pathAt`).
- [ ] Undo/redo, `loadDesign` and deleting a space leave a valid selection (store test).
- [ ] `tools/drill-select/find-it.mjs` on the production build, at 390 px and 1280 px: from the bare app, open a piece,
      tap the front view three times at one point and find the inspector text for the whole piece, then the bay, then
      the inner space.
- [ ] `pnpm lint`, `format:check`, `typecheck`, `test`, `build`, `docs:check` pass.

## Open questions

- Tap on the already selected innermost space: stays (default) or wraps back to the whole piece? (G-051)
- In a project, should the 2nd tap on a selected piece open it in the editor with the bay under the tap selected?
  Recommended: yes, closest to "1 click = entire furniture"; estimate +30 % work, +25 % of value. Default until
  answered: project view unchanged. (G-052)
