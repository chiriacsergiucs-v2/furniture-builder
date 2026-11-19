# ADR-280: Extract the i18n package

- Status: Implemented
- Date: 2026-11-19
- Implemented: 2026-11-19 (Built and verified 2026-11-19 in the sandbox: pnpm typecheck, lint, format:check, docs:check, build and the full pnpm test (281 files, 2171 passed) passed; package test (6 passed) and typecheck pass alone)
- Depends on: ADR-279
- Design: n/a
- Backlog: N351

## Context

ADR-279 split the app into workspace packages, starting with the nesting engine, and fixed the order of the later
packages, one ADR each (G-549): "i18n, kernel (...), catalog, model (...)". It also decided that
"`@furniture-builder/i18n` will be the bottom package: it depends on no other package, and every package may import
it". User, 2026-11-19: "Continue ADR-279 split".

Today `src/core/i18n` (index, print, print-text, warning-text and the `ru/` tables) is the largest hub of the repo:
114 files under `src`, `tests` and `tools` import it. It imports one file outside itself: `print.ts` takes `partRo`
from `src/core/ro.ts` for `warningText`, and `ro.ts` imports `getPrintLang` and `pt` back from `i18n/print`. That
cycle keeps i18n from being a bottom package.

## Decision

User answers, 2026-11-19 (both recommended picks):

- **Break the cycle in core.** `warningText` (and its helper `isMessageParam`) moves from `src/core/i18n/print.ts`
  to `src/core/ro.ts`, next to `partRo`. The package keeps `t`, `tr`, `pt`, the language state, `WARNING_RO` and the
  text tables; it imports nothing outside its own folder.
- **Rewrite every import.** Every importer uses `@furniture-builder/i18n` or `@furniture-builder/i18n/print`;
  `src/core/i18n` is deleted, with no re-export shim.

Decided by Claude, following the ADR-279 recipe:

- `packages/i18n` holds `src/` (the five files and `ru/` moved with `git mv`), `tests/`, `tsconfig.json` and the
  scripts `test` and `typecheck`. `exports`: `.` (`src/index.ts`) and `./print` (`src/print.ts`). The root
  `package.json` adds `"@furniture-builder/i18n": "workspace:*"`; `tsconfig.json` adds a reference.
- Boundaries: the package's lint block allows only relative imports (like nesting); the model files may import
  `@furniture-builder/i18n` but not `@furniture-builder/i18n/print` (the rule that today forbids `./i18n/print`);
  `tests/core-boundary.test.ts` mirrors both.
- The translation rule keeps working: a `t()` key with no Russian entry still fails `pnpm typecheck`. The paths in
  `CLAUDE.md`, `docs/architecture.md` and the scripts that name `src/core/i18n` are updated.
- Tests that test only i18n (`tests/i18n-print.test.ts` if it imports nothing else) move to `packages/i18n/tests`.

## Alternatives considered

- **Inject `partRo` through a setter** — keeps `warningText` in i18n but adds a startup hook that a test or a worker
  can forget to call; not picked.
- **Leave print text in core** — only `t`/`tr` move; the print half stays a core hub and the cycle stays; not
  picked.
- **Keep a re-export shim at `src/core/i18n`** — small diff, but two paths to the same code; not picked.

## Scope

- In scope: the package, the `warningText` move, every import rewritten, boundaries, docs paths, backlog row N351.
- Out of scope: the later packages (kernel, catalog, model, …, G-549); codes instead of text in the model (G-491);
  the `types.ts` and `project.ts` hubs (G-548).

## Consequences

- Positive: i18n is a bottom package checked by declaration; the i18n↔ro cycle is gone.
- Negative / risks: a large mechanical diff (about 114 files); open branches that add text must use the new paths.
- Harder to change later: the package name and its two entry points.

## Done when

- [x] `packages/i18n` exists with `src/`, `tests/`, `package.json` (`exports` `.` and `./print`) and `tsconfig.json`;
      `src/core/i18n` no longer exists.
- [x] No file under `packages/i18n/src` imports anything outside its own folder (lint block and
      `tests/core-boundary.test.ts`).
- [x] `warningText` lives in `src/core/ro.ts`; `tests/warning-print.test.tsx` passes.
- [x] `pnpm --filter @furniture-builder/i18n test` and `typecheck` pass alone.
- [x] A `t()` key with no Russian entry still fails `pnpm typecheck` (checked by adding one).
- [x] `pnpm typecheck`, `pnpm build`, `pnpm docs:check`, `pnpm lint` and `pnpm test` pass.
- [x] The production build has the same chunks as before (no i18n text moved into another chunk).

  Evidence (ran 2026-11-19): same 71 asset names as `main` 1160fe8; the print, warning and Russian texts sit in the
  same chunks; the entry chunk is 33 KB smaller because `ro.ts` and the model files it imports (`cutlist`, `geometry`,
  `materials`, `shape`) no longer load with it (they now load with `App`). A `t()` key with no Russian entry failed
  `pnpm typecheck` with TS2345.
