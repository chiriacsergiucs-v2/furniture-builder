# ADR-219: Enforce layer boundaries with lint rules and a source-scan test

- Status: Pending
- Date: 2026-11-07
- Depends on: none
- Design: n/a
- Backlog: N224

## Context

User, 2026-11-07 (the architecture review request): "current code structure/architecture modularity and overall
design analysis ... complete code quality critique and suggest architectural improvements ... No regressions shall
be introduced, ensure before and after testing tdd style". User, 2026-11-07: "full autopilot and ownership grant to
run in parallel as you see fit agents to cover the entire i1 to i20, draft adrs in 1 pr then do batches. Goal is to
have them all done and merged with no regressions introduced then stop".

This ADR is improvement **I-01** of `docs/retros/2026-11-07-architecture-review.md` (sections 7 and 8). The
choices below were decided by Claude under the user's ownership grant, 2026-11-07; no question is left open.

Every layer rule in `CLAUDE.md` holds today by discipline only (review section 2): `eslint.config.js` has no
`no-restricted-imports`, and only `tests/network-boundary.test.ts` scans source. One static `three` import in
`src/persist` or `src/core` would pull 747 KB into the `index` chunk unnoticed. Review section 6 lists the rules that
already hold on today's graph and the two allowances that do not yet. Enforces ADR-002, ADR-004, ADR-014 and ADR-126;
no behaviour change.

## Decision

Decided by Claude under the user's ownership grant, 2026-11-07.

- `eslint.config.js` gets the `no-restricted-imports` blocks of review section 6, one `files` block per layer:
  - `src/core/**`: no `src/{store,ui,persist,viewer,online}`, `react`, `react-dom`, `three`, `@react-three/*`,
    `dexie`, `zustand`, `@supabase/*`.
  - `src/core/nesting/{place,validate,types}.ts`: nothing outside those three files.
  - the model files (`geometry, cabinet, build, panel, panelset, frame, shape, corner, desk, rules, clearance,
cutlist, materials`): no `./project`, `./catalog/*`, `./i18n/print`, `./nesting/*`, `./room`, `./wizard/*`,
    `./research/*`, `./sellers/*`. **Allowance:** `desk.ts → ./design` until diagnostics leave the model (G-491).
  - `src/{ui,store,persist,viewer,online}/**`: no `core/nesting/place` or `core/nesting/validate`.
  - `src/viewer/**`: no `../ui/*`. **Allowance:** the 14 `../ui/*` modules the viewer imports today, listed by
    name, until [ADR-230](ADR-230-keep-the-3d-viewer-free-of-ui-imports-and-dom-side-channels.md) moves them.
- `no-restricted-syntax` for `import.meta.glob` and `?raw` imports outside `src/core/catalog/brands`,
  `src/core/sellers` and `src/core/research`.
- `tests/core-boundary.test.ts`, modelled on `tests/network-boundary.test.ts`, scans `src/` for the same forbidden
  specifiers (with the same allowances) so CI fails even if the lint config changes, and self-checks its regexes.

## Alternatives considered

- **`eslint-plugin-import` / `import/no-cycle`** — a new dependency and a slow rule; cycles are a separate gap (G-485).
- **dependency-cruiser** — a new tool and config language for rules ESLint already expresses.
- **Test only, no lint rule** — catches it in CI but not in the editor; the review asks for both.

## Scope

- In scope: the lint blocks and allowances above, `tests/core-boundary.test.ts`, no file moves.
- Out of scope: breaking or linting import cycles (G-485).

## Consequences

- Positive: a wrong-way import fails `pnpm lint` and `pnpm test` at once; later ADRs (ADR-228, ADR-230, ADR-236)
  tighten the allowances instead of re-auditing.
- Negative / risks: a false positive on an allowed import; the allowances must be removed by hand when their ADR ships.
- Harder to change later: nothing; rules are config.

## Done when

TDD (review section 9): every item starts from a test written first that pins today's behaviour and passes on
`main` before the change; the change keeps it green (or turns the stated red test green).

- [x] (test first) `tests/core-boundary.test.ts` scans `src/`, passes on today's tree with the two allowances, and
      its self-check proves each regex catches a forbidden `react`, `three`, `dexie`, `../ui/x` and `?raw` import.
      Evidence: `tests/core-boundary.test.ts` › "no module in src/ imports across a layer boundary", "the scan itself
      catches each forbidden import" (a third allowance, `src/ui/Gaps.tsx` `?raw`, G-503).
- [x] A scratch file importing `three` from `src/core` fails `pnpm lint` and the test (checked by hand, file removed).
      Evidence (ran 2026-11-07): `src/core/zzScratch.ts` with `three`, `../store/designStore`, `?raw` and
      `import.meta.glob` gave 4 ESLint errors and 2 failing tests; removed.
- [x] The viewer allowance lists each `../ui/*` module by name; a new `../ui/*` import from `src/viewer` fails.
      Evidence: `VIEWER_UI` in `eslint.config.js` and the test (14 names); a scratch `src/viewer` import of
      `../ui/icons` failed lint and the test, `../ui/useSnap` passed.
- [x] `import.meta.glob` and `?raw` outside the three allowed folders fail lint and the test. Evidence: the scratch
      file above; `tests/core-boundary.test.ts` › "import.meta.glob only in the data loaders".
- [x] `pnpm lint`, `pnpm format:check`, `pnpm typecheck`, `pnpm test`, `pnpm build` and `pnpm docs:check` pass; the
      test count is not lower than on `main` before the change (review section 9).
      Evidence (ran 2026-11-07, local, branch `wip/b1a` at the ADR-220 commit): all six pass; `pnpm test` 1725 passed /
      0 failed (195 files), up from 1714 tests (192 files) before ADR-236.
