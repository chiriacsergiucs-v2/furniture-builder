# ADR-230: Keep the 3D viewer free of ui imports and DOM side channels

- Status: Pending
- Date: 2026-11-07
- Depends on: none
- Design: n/a
- Backlog: N235
- Acceptance: browser

## Context

User, 2026-11-07 (the architecture review request): "current code structure/architecture modularity and overall
design analysis ... complete code quality critique and suggest architectural improvements ... No regressions shall
be introduced, ensure before and after testing tdd style". User, 2026-11-07: "full autopilot and ownership grant to
run in parallel as you see fit agents to cover the entire i1 to i20, draft adrs in 1 pr then do batches. Goal is to
have them all done and merged with no regressions introduced then stop".

This ADR is improvement **I-12** of `docs/retros/2026-11-07-architecture-review.md` (sections 7 and 8). The
choices below were decided by Claude under the user's ownership grant, 2026-11-07; no question is left open.

The viewer imports 14 modules from `src/ui` (`Clearances`, `CountStepper`, `MoveTo`, `ProblemBanner`,
`keepProportions`, `planDrag`, `renderSupport`, `useLook`, `useMediaQuery`, `useSnap`, `useSolidWalls`, `useTheme`,
`useView`, `wallPictures`; the review counted 11) and talks to the page through DOM side channels:
`document.body.dataset.seams` and `.lit`, a `'fb:fit'` window event, CSS variables and `#count-dock`. ADR-014 (3D is
a non-authoritative preview, lazy, only selects) and ADR-093 (Move mode) are unchanged.

## Decision

Decided by Claude under the user's ownership grant, 2026-11-07.

- Hooks and pure helpers the viewer uses move to `src/store` (state hooks) or `src/shared` (pure helpers, no React
  state); `src/ui` re-imports them from there.
- `CountStepper` and `MoveTo` (ui components) are passed to `Viewer3D` as render props from `App`; `Clearances` and
  `ProblemBanner` likewise if they are components, or move if they are helpers.
- `seams`, `lit` and the fit request become fields of the existing view store; the dataset writes, the `'fb:fit'`
  event and the `#count-dock` lookup are removed. CSS variables read for colours stay only if they are theme tokens.
- The ADR-219 viewer allowance list is emptied; `src/viewer` imports nothing from `src/ui`.

## Alternatives considered

- **Allow the imports and document them** — keeps the viewer tied to ui; the boundary stays partial.
- **Move the viewer into `src/ui`** — hides the problem and loses the lazy-chunk boundary.
- **A context object passed down** — same decoupling as render props with more indirection.

## Scope

- In scope: the module moves, render props, the store fields, the emptied allowance.
- Out of scope: the viewer's direct `src/persist` imports (G-497).

## Consequences

- Positive: the viewer is a clean lazy unit; side channels become testable state.
- Negative / risks: Move-mode and drill paths (ADR-093) are browser-acceptance only; a missed side channel breaks the
  fit button or seams toggle silently.
- Harder to change later: nothing.

## Done when

TDD (review section 9): every item starts from a test written first that pins today's behaviour and passes on
`main` before the change; the change keeps it green (or turns the stated red test green).

- [ ] (test first) browser find-it `tools/move-3d/find-it.mjs` and `tools/drill-select/find-it.mjs` pass on the
      production build at 390 and 1280 px before the change; the same scripts pass after.
- [ ] (test first) a store test: setting `seams`, `lit` and the fit request changes the store fields the viewer reads.
- [ ] `tests/core-boundary.test.ts` (ADR-219) has no viewer allowance and passes; `rg "from '../ui" src/viewer` is
      empty.
- [ ] No `document.body.dataset`, `'fb:fit'` or `#count-dock` remains in `src/viewer` or `src/ui` (checked by `rg`).
- [ ] `pnpm lint`, `pnpm format:check`, `pnpm typecheck`, `pnpm test`, `pnpm build` and `pnpm docs:check` pass; the
      test count is not lower than on `main` before the change (review section 9).
