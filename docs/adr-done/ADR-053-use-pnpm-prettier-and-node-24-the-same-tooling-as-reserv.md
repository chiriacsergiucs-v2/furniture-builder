# ADR-053: Use pnpm, Prettier and Node 24, the same tooling as reserv

- Status: Implemented
- Date: 2026-10-24
- Implemented: 2026-10-24
- Decided by: user, 2026-10-24: "Lets cover all skipped" (the skipped list named moving to pnpm, Prettier and Node 24)
- Depends on: ADR-050
- Design: n/a
- Backlog: N47

## Context

ADR-050 aligned this repository's ADR layout, skills and CI with `alin-obedea/reserv` but kept npm, Node 22
and no formatter, because the stacks differ. The user then asked to cover everything that was skipped. reserv
uses pnpm 12.6.0 (`packageManager`), Node 24 (`.nvmrc`, `engines`), Prettier with `singleQuote`,
`trailingComma: all` and `printWidth: 100`, `.editorconfig`, and `pnpm/setup@v3` in CI with a
`format:check` step. ADR-013 fixed the app stack (React, Vite, Zustand, Dexie); it named no package manager,
so the app stack does not change. `workbox-window` (a peer of vite-plugin-pwa that npm hoisted) is now declared.

## Decision

- **pnpm 12.6.0** replaces npm: `pnpm-lock.yaml` imported from `package-lock.json` with the same resolved
  versions (`pnpm import`), `package-lock.json` removed, `packageManager` set. `pnpm-workspace.yaml` holds only
  pnpm settings: `esbuild` may run its install script (Vite's bundler), as in reserv.
- **Node 24** (`.nvmrc`, `engines: >=24.15 <25`), in CI and in the Pages deploy.
- **Prettier 3.9.10**, pinned like every other dependency here, with reserv's `.prettierrc.json` and
  `.editorconfig`. `pnpm format` / `pnpm format:check`; CI runs `format:check` after lint, like reserv. Files
  compared byte-for-byte by tests (`docs/catalog.md`, `docs/samples/*.project.json`, `public/catalog/`) and the
  research papers whose lines `tests/research.test.ts` audits are ignored. The first run reformats the repository
  in one commit that changes formatting only.
- **CI and deploy** use `pnpm/setup@v3` with `runtime: node@24`, cache and `require-lockfile`, and
  `actions/checkout@v6`, like reserv. The Commands table in `CLAUDE.md` gains the Format row.
- Docs, skills and the find-it script headers use pnpm commands. Implemented ADRs and the backlog keep the npm
  commands they record, because those are what ran.
- ESLint stays (reserv uses oxlint); the user named only pnpm, Prettier and Node 24.

## Alternatives considered

- **Keep npm and Node 22** — rejected by the user ("cover all skipped").
- **Prettier `latest` like reserv** — rejected: this repository pins exact versions; a floating formatter
  would turn CI red when a new release changes output.
- **Format Markdown by hand to avoid a large diff** — rejected: the check would fail on the next edit.

## Scope

- In scope: package manager, lockfile, Node version, formatter, CI and deploy setup, command docs.
- Out of scope: oxlint, app dependencies' versions, the app's behaviour.

## Consequences

- Positive: the same commands and checks in both repositories; formatting is never a review topic.
- Negative: one large formatting-only commit; `git blame` should skip it
  (`git config blame.ignoreRevsFile .git-blame-ignore-revs`).
- Contributors need Node 24 and pnpm 12 (`corepack enable` picks the pinned pnpm).

## Done when

- [x] `pnpm install --frozen-lockfile` installs from `pnpm-lock.yaml` with the versions npm resolved
- [x] `pnpm lint`, `pnpm format:check`, `pnpm typecheck`, `pnpm test`, `pnpm build`, `pnpm docs:check` pass on Node 24
- [x] The production build passes every find-it test on Node 24 (home, materials, merge, project-undo, research,
      shapes, wizard)
- [x] CI passes with `pnpm/setup@v3` on GitHub (PR #33, CI run 370)
- [x] The Pages deploy passes with `pnpm/setup@v3` (merge commit 9e03969: CI run 372, Deploy GitHub Pages run 121)
