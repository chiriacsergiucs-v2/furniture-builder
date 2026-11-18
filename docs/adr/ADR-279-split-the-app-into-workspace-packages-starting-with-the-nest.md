# ADR-279: Split the app into workspace packages, starting with the nesting engine

- Status: Pending
- Date: 2026-11-19
- Depends on: ADR-053, ADR-219
- Design: n/a
- Backlog: N346
- Acceptance: browser

## Context

User, 2026-11-17: "This repo and architecture structure seems to be way too interdependent. Suggest a way to have
multiple packages, each managed on its own, which are then reused / used, integrated into the main app with the full
functionality." User, 2026-11-19, picked option 2: pnpm workspace with internal (unpublished) packages.

Today the repo is one package. `src` holds 303 files (~93k lines); `src/core` has 151 (94 at its top level). ADR-219 enforces
layer direction (ui → store → core) by lint and `tests/core-boundary.test.ts`, but inside core there are 7 import
cycles (the largest has 15 files, G-485) and three hubs: `i18n/index.ts` (163 importers), `types.ts` (141) and
`project.ts` (83). `docs/architecture.md` "Domains" left open: folders vs slices vs packages (N282).

ADR-053 says `pnpm-workspace.yaml` "holds only pnpm settings". This ADR changes that sentence only; the rest of
ADR-053 stands.

## Decision

User answers, 2026-11-19 (all the recommended picks):

- **Layout.** The app stays at the repo root. Packages live in `packages/<name>`; `pnpm-workspace.yaml` gains
  `packages: ['packages/*']`. CI, deploy, `tools/` and `tests/` paths do not move.
- **Scope.** Packages are named `@furniture-builder/<name>`, `private: true`, never published. The root
  `package.json` depends on them as `workspace:*`.
- **i18n.** `@furniture-builder/i18n` will be the bottom package: it depends on no other package, and every
  package may import it. G-491 (codes instead of text in the model) stays open.

Decided by Claude:

- **Source packages.** Each `package.json` has `exports` pointing at `.ts` source; no build step. Vite and Vitest
  read the source; `tsc -b` gets one project reference per package.
- **Own test, lint and typecheck per package.** Each package has `tests/`, a `tsconfig.json` and the scripts
  `test` and `typecheck`; `pnpm -r test` runs them. The root `pnpm test` still runs everything.
- **Boundaries by declaration.** A package imports only packages listed in its `dependencies`. A lint block and
  `tests/core-boundary.test.ts` forbid deep imports (`@furniture-builder/*/src/*`) and relative imports out of a
  package folder.
- **Pilot: the nesting engine.** `place.ts`, `validate.ts`, `types.ts` and `worker.ts` (921 lines) move from
  `src/core/nesting/` to `packages/nesting/src/`. ADR-219 already keeps them free of other imports. The package
  exports `.` (`nest`, `validateNest`, the types) and `./client` (`createNestWorker()`, which builds the worker URL
  inside the package; `src/ui/useNesting.ts` uses it). `src/core/nesting` keeps the cut-list bridge (`index.ts`
  re-exports the package, `fromDesign.ts`). `tests/nesting.test.ts` moves to the package, except its
  `jobsFromCutlist` case (`tests/nesting-jobs.test.ts`); `nesting-golden.test.ts` stays, its jobs come from the
  sample projects.
- **Order of later packages** (one ADR each, G-549): i18n, kernel (geometry and the split of `types.ts`, G-548),
  catalog, model (design, cabinet, desk, build), cutlist, hardware, room, shopping, then persist, online and viewer.

## Alternatives considered

- **Domain folders in one package** — boundaries stay lint rules only; the user picked packages.
- **Published, versioned packages (Changesets, a registry)** — release and version-drift cost for one app; the user
  picked option 2.
- **Move the app to `apps/web`** — rewrites CI, deploy, `tools/` and 180 test files for no behaviour gain.
- **Compiled packages (`dist/`)** — an extra build and watch step; Vite already compiles TypeScript source.

## Scope

- In scope: workspace setup, package conventions, the nesting package, boundary rules, docs.
- Out of scope: breaking the core cycles (G-485); splitting `types.ts` and `project.ts` (G-548); the other
  packages (G-549); model diagnostics as codes (G-491).

## Consequences

- Positive: a package cannot reach code it does not declare; each package is tested and type-checked alone;
  later extractions follow one recipe.
- Negative / risks: one more `package.json` and `tsconfig.json` per package; the worker URL from a package must be
  checked in the built app, not only in jsdom.
- Harder to change later: the package names and the bottom position of i18n.

## Done when

- [ ] `pnpm-workspace.yaml` lists `packages/*` and keeps its pnpm settings; `pnpm install --frozen-lockfile` passes
- [ ] `packages/nesting` holds the four engine files and its test; no file under `src/` imports them by path
- [ ] `pnpm --filter @furniture-builder/nesting test` and `typecheck` pass with nothing outside the package
- [ ] Lint and `tests/core-boundary.test.ts` fail on a deep import and on an undeclared package import (tests)
- [ ] `pnpm lint`, `format:check`, `typecheck`, `test`, `build` and `docs:check` pass; CI and the Pages deploy pass
- [ ] The production build lays out a Sideboard's sheets in the package worker (`tools/nesting-package/find-it.mjs`)
- [ ] `tests/bundle-boundary.test.ts` passes unchanged: the `index` chunk gains no module
- [ ] `CLAUDE.md` repository layout, `docs/architecture.md` (Domains: decided, packages) and the GAPS rows G-548,
      G-549 are updated in the same change
