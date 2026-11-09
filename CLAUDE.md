# Furniture Builder — project guide for Claude

Furniture Builder is a phone-first, offline PWA (`chiriacsergiucs-v2/furniture-builder`, live at
https://chiriacsergiucs-v2.github.io/furniture-builder/). You design casework by dividing a front
elevation into spaces, see it in 3D, and get a grouped cut list with edge-band notation, sheet layouts and a
hardware schedule. There is no backend. Prefer the smallest slice that works.

Read first: `docs/backlog.md`, `docs/adr/README.md`, `docs/product/product-context.md`.

## Stack (fixed constraints — do not re-debate)

- React 19, TypeScript 5.9 strict, Vite 7, Zustand 5 (ADR-013)
- three + @react-three/fiber + drei, lazy-loaded (ADR-013, ADR-014)
- Dexie 4 (IndexedDB), vite-plugin-pwa (ADR-012)
- Node 24, pnpm 12, Vitest, ESLint + Prettier (ADR-053, the same tooling as reserv)
- Static site on GitHub Pages; offline core with no request until the user opts in to an online feature; no
  telemetry, analytics, remote AI or CDN (ADR-002, network rule replaced by ADR-126; the opt-in assistant reaches an AI model
  only through the backend, ADR-239)
- GitHub for source control and CI/CD

## Language

- Everything written to the repo is in **English**: code, comments, commit messages, ADRs, skills,
  markdown files.
- Reply to the user in the language they write in (Romanian or English).
- The app UI is in English by default, Russian on request (More → Language, ADR-153). Printed sheets and the parts
  CSV are in Romanian by default, Russian or English on request (More → Print language, ADR-157).
- **Translation rule (hard, user rule 2026-10-29, ADR-153):** every text added, changed or deleted in the app updates
  its translations in the same change. Text written in code goes through `t()` (`src/core/i18n`) with its Russian
  entry in `src/core/i18n/ru/<area>.ts` (a key without one fails `pnpm typecheck`); text from built-in data goes
  through `tr()` with its entry in `src/core/i18n/ru/data-*.ts`; print and CSV text goes through `pt()` with its
  Russian and English entries in `src/core/i18n/print-text.ts`. A deleted text deletes its entries. The feature tree
  (`src/ui/info/features.ts`, ADR-158) is updated only when the user asks (user 2026-11-07). The Gaps page is not translated (user
  2026-10-29).

## Repository layout

- `src/core` — pure TypeScript model: geometry, generators, checks, cut list, nesting, projects, Romanian
  output, Fusion export, the design document. Imports nothing from React, three or Dexie.
- `src/store` — Zustand store: design, derived model, selection, undo/redo
- `src/persist` — IndexedDB (Dexie) storage
- `src/ui` — React UI; `src/viewer` — lazy three.js preview
- `tests/` — core, fuzz, storage and UI-logic tests (Vitest)
- `tools/` — the catalog PDF extractor and the find-it acceptance scripts (`tools/*/find-it.mjs`)
- `scripts/check-docs.py` — checks ADRs, the index and every ADR and backlog id (`pnpm docs:check`)
- `docs/adr/` — pending ADRs, `README.md` (index), `_template.md`
- `docs/adr-done/` — implemented ADRs
- `docs/backlog.md` — the single work ledger (F/N/D ids); `docs/adr/GAPS.md` — everything not built (G ids, ADR-082)
- `docs/product/product-context.md` — the user's decisions and answers so far; `docs/architecture.md` — how
  the code fits together; `docs/ui-design.md` — tokens, components and screens; `docs/catalog.md` — generated
  (`pnpm catalog:docs`); `docs/retros/` — retrospectives
- `.claude/skills/` — `new-adr`, `next-adr`, `ship-adr`, `verify`, `review`, `debug`, `add-tests`,
  `implement-design`, `design-review`, `add-storage-version`, `add-model-feature` (reserv's `add-endpoint`
  counterpart), `security-review`, `ff`, `babysit`
- `.github/workflows/ci.yml` — CI; the source of truth for what "passing" means.
  `deploy.yml` publishes `main` to GitHub Pages.

## Commands

CI is the source of truth (`.github/workflows/ci.yml`; scripts in `package.json`). Locally, run only typecheck,
format and the related tests (_How we build_, step 3); the full table runs on request (`verify` skill) and in CI.
`pnpm format` fixes formatting.

| Check      | Command                          |
| ---------- | -------------------------------- |
| Install    | `pnpm install --frozen-lockfile` |
| Lint       | `pnpm lint`                      |
| Format     | `pnpm format:check`              |
| Type-check | `pnpm typecheck`                 |
| Test       | `pnpm test`                      |
| Build      | `pnpm build`                     |
| Docs check | `pnpm docs:check`                |

Not in CI, run when relevant: `FUZZ_N=30000 pnpm exec vitest run tests/fuzz.test.ts` after any geometry change;
`pnpm catalog:docs` and `pnpm catalog:snapshots` after catalog changes; the matching
`tools/*/find-it.mjs` against `pnpm build && pnpm preview` for anything visible.

## How we build (user rule 2026-11-07, replaces the 2026-10-27/29 flow)

Default flow for every request (`build` skill):

1. **Questions — only when confidence is low.** One batch up front with the interactive question tool, at most ~4,
   only on choices that change what gets built. Short options, no +N % estimates. Decide the obvious ones yourself
   and list them under **Decided** in the reply so the user can override. Never invent physical facts (ADR-010).
2. **Build** on the session branch (or `<short-title>`), smallest slice that does what was asked.
3. **Check locally:** `pnpm typecheck`, `pnpm format`, and the tests related to the touched files
   (`pnpm exec vitest related --run <files>`); fuzz after geometry changes. CI runs the full suite.
4. **Bookkeeping:** one row in `docs/backlog.md`. Nothing else is mandatory: no ADR, no gap entry, no feature-tree
   line, no research-record update, no requirement ledger.
5. **Push** the branch and open the pull request automatically (toggle `auto-open-pr`). Merge only when the user asks.
6. **Reply:** where to click and whether it is live (R4), **Decided**, **Skipped this iteration**.

### ADRs — only for model, data and network changes

An ADR is required only for a change to `src/core/types.ts`, the design document or model shape (ADR-011), the Dexie
schema (ADR-012) or the network boundary (ADR-002), or when the user asks for one. Then:

- File name `ADR-NNN-short-kebab-title.md`; Status `Pending`, `Deferred (<reason>)`, `Rejected` or `Implemented`.
  Read `docs/adr/README.md` for the conventions and the index.
- `new-adr` writes it (questions as in step 1 above), `next-adr` builds it on the same branch, `ship-adr` marks it
  implemented in the same pull request (no separate ship pull request).
- Implemented ADRs are not edited; a changed decision gets a new ADR that links the old one. Check `docs/adr/` and
  `docs/adr-done/` before proposing an alternative to a settled choice.
- Authority: explicit user decision › implemented ADR › code and tests › earlier discussion › proposal.

Fast forward, `ff` (`ff` skill): on "ff" the request is built without a branch or pull request, only `pnpm typecheck`
and `pnpm build`, and pushed straight to `main` after the user approves the list of changes.

## Engineering conventions (hard rules)

- Do not read, write or migrate the previous app or its data (`mobila-cutlist-build-kit`) (ADR-001).
- Offline core (ADR-002, ADR-126): every feature works signed out and offline with no request. Online features
  (accounts, account storage, share links) are opt-in, live only in `src/online`, are imported only dynamically,
  and contact only the origins in `src/online/origins.ts`. Never telemetry, analytics, remote AI, CDN or remote fonts;
  the one exception is the opt-in, signed-in assistant, which reaches an AI model only through the backend's
  `assistant` function (ADR-239).
- Integer millimetres; x width, y height from floor, z depth from back; exact integer splits (ADR-003).
- Every view and list is a projection of `buildModel()`; never compute geometry in UI code (ADR-004).
- New product families reuse `buildCabinet` where a carcass exists (ADR-007).
- User input never throws and is never clamped silently; problems are diagnostics, checked independently of the
  generators; errors block export. Never hide or soften an error diagnostic (ADR-008).
- Never invent hardware specs, loads, drilling depths, screw specs or supplier values; label guidance as
  guidance (ADR-010). An unknown physical fact goes under _Open questions_ in `docs/backlog.md`; ask the user.
- Validate designs before load or import; imported designs get new ids; never persist generated geometry. A
  change to `src/core/types.ts`, the design document or the model shape cites or creates an ADR, and a new
  document shape bumps `schemaVersion` and keeps old readers (ADR-011).
- Storage: never edit a shipped Dexie version; never delete rows the app cannot read (ADR-012). Use the
  `add-storage-version` skill. Nothing may delete or rewrite saved designs without the user's explicit decision.
- The 3D viewer only selects, never edits, stays lazy and mounts only when visible (ADR-014). Exceptions: the
  quick-count card over the 3D view (ADR-085), moving and turning project pieces in Move mode (ADR-093), resizing an
  imported 3D model (ADR-102), the height drag (ADR-122), fitting a wall picture (ADR-146) and the turn handle
  (ADR-169).
- Zustand selectors return stable references (no `.filter()`/`.map()` inside a selector).
- Keyboard focus visible; no horizontal page scroll at 390 px.
- No committed browser/E2E suite, refactors or polish unless the user asks (ADR-015, ADR-016).
- No dependency with an unknown licence or telemetry. Lockfile committed; base path `/furniture-builder/`.
- Never renumber ADR or F/N/D ids.

## Delivery (user rule 2026-10-23; R1 requirement ledger dropped by the user 2026-11-07)

- **R2 No avoidance:** never drop or relabel a requirement to skip building it; if one cannot be built, say so
  under **Skipped this iteration**.
- **R3 Find-it test:** UI acceptance starts from the bare app and finds features by role and visible text at
  phone and desktop widths. Default find-it mode (toggle `find-it-jsdom-default`; while it is off the default is the
  browser script): **jsdom** (ADR-108) — `tests/find-it/<area>.test.tsx` with the
  `tests/find-it/setup.tsx` helper (390 and 1280 px), run by `pnpm test` and CI. An ADR that changes layout or CSS,
  or touches the 3D view or Move mode, sets `- Acceptance: browser`: `tools/<area>/find-it.mjs` against the
  production build in Chromium (the rule before ADR-108). To revert every ADR to the browser script, change the
  default above to **browser**. Exception (ADR-066): an ADR whose header the user set to `- Acceptance: light`
  skips the find-it test; its backlog rows stay Partially done with the gap `find-it pending (light, ADR-066)`,
  naming the visible text to find, until the user says "catch up acceptance", which writes and runs the missing
  tests (jsdom, or the browser script for layout/CSS or 3D work, on the production build of `main` or the live URL).
- **R4 Outcome first:** replies open with where to click and whether it is live.

## Toggleable rules

A rule listed here applies only while its state is **on**. The user turns a rule off or back on by name (e.g. "turn
on snapshot-before-tests"); the change updates this table with the date and the user's words. A rule that is off is
skipped everywhere it is referenced (this file and the skills); the rule text stays where it is, so turning it back
on restores it unchanged.

| Toggle                  | Rule                                                                                  | State | Changed                                                                                                               |
| ----------------------- | ------------------------------------------------------------------------------------- | ----- | --------------------------------------------------------------------------------------------------------------------- |
| `snapshot-before-tests` | Process › Snapshot before tests: screenshots approved before checks                   | off   | 2026-11-05, user: "set screenshots validation rule as inactive until further notice with possibility to turn back on" |
| `find-it-jsdom-default` | Delivery › R3: find-it tests default to jsdom; off = the browser script for every ADR | on    | 2026-11-05, user: "Do 2 and 3" (listed, state unchanged)                                                              |
| `auto-open-pr`          | Git › Open the pull request automatically once an implementation is done and pushed   | on    | 2026-11-07, user: "Autocreate autopush" (turned back on)                                                              |

## Process (standing user rules)

- Snapshot before tests (user rule 2026-10-27; toggle `snapshot-before-tests`, see _Toggleable rules_ — applies only
  while that toggle is **on**): for a UI change, before running any tests or checks, show the user a
  screenshot of the fix attempt (dev or production build, phone and desktop width where relevant) and wait. Proceed
  to tests and the next steps only on their confirmation; otherwise fix the new requirements and show a new
  screenshot for confirmation again. The screenshots for approval come last in the reply, right above the
  questions if there are any (user rule 2026-10-29).
- Smallest functional slice; for each change ask "needed to demonstrate this now?" — if not, it goes under
  _Skipped this iteration_.
- Update `docs/backlog.md` in the same change; change a status only with evidence (command output or a CI
  run id). Label evidence from documents differently from evidence you ran.
- Pushed ≠ merged ≠ deployed ≠ live-verified. Never claim tests or deployments that did not run. "Live-verified"
  only if someone opened the published URL and checked it.
- Every implementation reply ends with **Decided** and **Skipped this iteration** (no backlog status table, user
  2026-11-07).
- Sync only what is pending (user rule 2026-11-05): a gap or feature sync checks only what `pnpm sync:pending` lists, and
  sets `checked` (the date) on the feature lines it verifies (`src/ui/info/features.ts`); Done gaps live in
  `docs/adr/GAPS-archive.md` and are never re-checked.
- Gaps ledger (ADR-082): optional since 2026-11-07. Record a gap with `pnpm gaps add` only when the user asks;
  skipped items are listed in the reply.
- Stop when a check fails (fix the cause, never the check) or when a change would need the network (ADR-002).
- Recommended options: recommend the option closest to what the user asked, not the simplest. Never build a
  recommended option the user has not picked when the question was asked; obvious choices are decided, not asked
  (step 1 of _How we build_).

## Git

- Only modify `chiriacsergiucs-v2/furniture-builder`.
- Work on the session branch (or `<short-title>`); an ADR shares the branch and pull request of its build.
- Open the pull request automatically once the checks pass and the branch is pushed (toggle `auto-open-pr`, on;
  while off, ask first). Never auto-babysit.
- Merge to `main` only on the user's instruction; then cite the `Deploy GitHub Pages` run id. Never force-push
  `main`.
- Ship commit message (ADRs only): `Ship ADR-NNN: <short title> — mark implemented`.
