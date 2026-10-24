# ADR-055: Apply a board to this piece, this run or the whole project (finish scope)

- Status: Pending
- Date: 2026-10-24
- Decided by: user, 2026-10-24: "create the ADRs … auto-accept the recommended suggestion" (answers below)
- Depends on: ADR-022, ADR-036, ADR-049
- Design: docs/ui-design.md (project panel → Selected piece → Finish)
- Backlog: N52

## Context

Research features _Shared material/finish propagation_ (rank 12, value 4.6, P1) and its child _Global parameters_
(value 3.2), both Roomle. The paper recommends a scope selector — _This item / Connected run / Entire ensemble_ —
instead of an abstract "global parameter". Today each project piece is an embedded copy with its own `materials`
(ADR-022); changing a finish means editing every piece. The Materials button is hidden in project view
(`{!inProject && …}` in `src/ui/App.tsx`).

## Decision

- **Project → Selected piece → "Finish"**: two choices, _Fronts_ and _Carcass_, each a board picker (the boards of
  all pieces in the project, merged by `materialKey`, plus the user's decor list from ADR-049), and a scope:
  **This piece / This run / Whole project**.
- **This run** = the run the selected piece belongs to, by the same rule as `suggestRunParts` (floor base units side
  by side). Pieces not in a run offer only _This piece_ and _Whole project_.
- **Applying** copies the chosen board into each target piece's `materials` (reusing it when the same `materialKey`
  is already there) and sets the root's matching board id (`frontMaterialId` / `bodyMaterialId` on cabinet, corner
  and desk roots, the front board of a `panel` root; wardrobes are cabinets). Roots without that role (frame, panel
  set) are skipped and counted in the result line "Applied to 5 pieces, 1 skipped: bed has no fronts".
  Fillers and covers of affected runs take the new front board; the worktop is not changed.
- **One-time, not linked.** Pieces stay independent copies; a later per-piece change is allowed. Applying is one
  undo step (ADR-051).

## Alternatives considered

- **Live global parameter** (pieces follow a project-level finish until detached) — needs a link model in every
  piece and a "detached" state; the paper itself says the scope selector is easier to understand.
- **Project-level Materials dialog editing a shared board** — boards are per piece today; sharing would change the
  design document format.

## Scope

- In scope: fronts and carcass boards by scope.
- Out of scope: live-linked finishes, edge-band colour.

## Consequences

- The project cut list merges boards by `materialKey`, so one finish across pieces becomes one row group as before.
- Picture finishes (ADR-048) travel with the board copy.

## Done when

- [ ] Unit tests: whole-project apply sets every cabinet's front board and skips a bed with a reason; run scope changes only the run; fillers/covers follow; one undo restores all pieces.
- [ ] Find-it at 1440 and 375 px: project with two base cabinets and a wardrobe → select a cabinet → **Finish** → _Fronts_ → pick another board → **This run** → **Apply** → the wardrobe keeps its fronts, both cabinets change (3D colour and Parts CSV material column).
- [ ] Find-it test passes from the bare app at phone and desktop widths (`tools/ensemble/find-it-adrs.mjs`)

## Answers

1. _Linked (live) or one-time apply?_ — **One-time apply; pieces stay copies.**
2. _Which roles?_ — **Fronts and carcass, chosen separately.**
3. _What is a "run"?_ — **The same run as the run parts (base units side by side).**
4. _Do run parts follow?_ — **Fillers and covers follow the front board; the worktop does not.**

## Implementation notes

`src/core/finish.ts` (`applyFinish`, `finishTargets`, `projectBoards`, `roleBoard`), store `applyFinish`, Project → Selected piece → **Finish** (_Fronts / Carcass_, _Board_ incl. the user's decor list, _This piece / This run / Whole project_, **Apply finish**). Decor boards keep the grain and sheet of the board they replace. Tests: `tests/finish.test.ts`. find-it `tools/ensemble/find-it-adrs.mjs` (production build, bare app, visible text, 1440 and 375 px): 60/60: _Applied to 3 pieces_.
