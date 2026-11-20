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
  its translations in the same change. Text written in code goes through `t()` (`@furniture-builder/i18n`, `packages/i18n`) with its Russian
  entry in `packages/i18n/src/ru/<area>.ts` (a key without one fails `pnpm typecheck`); text from built-in data goes
  through `tr()` with its entry in `packages/i18n/src/ru/data-*.ts`; print and CSV text goes through `pt()` with its
  Russian and English entries in `packages/i18n/src/print-text.ts`. A deleted text deletes its entries. The feature tree
  (`src/ui/info/features.ts`, ADR-158) is updated only when the user asks (user 2026-11-07). The Gaps page is not translated (user
  2026-10-29).

## Repository layout

- `src/core` — pure TypeScript model: geometry, generators, checks, cut list, the cut-list bridge to nesting
  (`core/nesting`), projects, Romanian output, Fusion export, the design document. Imports nothing from React,
  three or Dexie.
- `packages/<name>` — workspace packages `@furniture-builder/<name>` (ADR-279): private, consumed as TypeScript
  source through their `exports`, each with its own `tests/`, `test` and `typecheck` scripts. A package imports
  only its own files and the packages its `package.json` declares; nobody imports a package's files
  (`tests/core-boundary.test.ts`, `pnpm lint`). Today: `i18n` (the bottom package: `t`, `tr`, `pt` and the text tables, ADR-280) and `nesting` (the sheet
  placer, validator and worker).
- `src/store` — Zustand store: design, derived model, selection, undo/redo
- `src/persist` — IndexedDB (Dexie) storage
- `src/ui` — React UI; `src/viewer` — lazy three.js preview
- `src/shared` — code both `src/ui` and `src/viewer` import (drag helpers, render support); imports nothing from the app (ADR-219)
- `src/online` — opt-in online features (ADR-126); `supabase/` — the backend: `functions/assistant`, `migrations/`
- `tests/` — core, fuzz, storage and UI-logic tests (Vitest); `pnpm test` also runs `packages/*/tests`
- `tools/` — the catalog PDF extractor, the find-it acceptance scripts (`tools/*/find-it.mjs`), the shared browser
  harness (`tools/lib`) and the on-demand capture (`tools/capture`)
- `scripts/check-docs.py` — checks ADRs, the index and every ADR and backlog id (`pnpm docs:check`); `scripts/*_hook.py` — hooks
  (see _Settings and hooks_)
- `docs/adr/` — pending ADRs, `README.md` (index), `_template.md`
- `docs/adr-done/` — implemented ADRs
- `docs/backlog.md` — the single work ledger (F/N/D ids); `docs/adr/GAPS.md` — everything not built (G ids, ADR-082)
- `docs/product/product-context.md` — the user's decisions and answers so far; `docs/architecture.md` — how
  the code fits together; `docs/ui-design.md` — tokens, components and screens; `docs/catalog.md` — generated
  (`pnpm catalog:docs`); `docs/retros/` — retrospectives
- `.claude/skills/` — `build` (the one flow, ff and auto are its modes), `new-adr`, `next-adr`, `ship-adr`, `verify`, `review`, `debug`, `add-tests`,
  `implement-design`, `design-review`, `add-storage-version`, `add-model-feature` (reserv's `add-endpoint`
  counterpart), `security-review`, `architect-review`, `ff`, `auto`, `babysit`, `skip-review`, `catch-up`, `frontend-design`, `caveman`,
  and the health loops `health-bugs`, `health-security`, `health-deps`, `health-cleanup`, `health-reuse` (shared loop in
  `health-bugs/loop.md`; see _Orchestration_)
- `.claude/agents/` — subagents from the MIT-licensed `maslennikov-ig/claude-code-orchestrator-kit`, by area (health,
  testing, development, database, documentation, infrastructure, meta, research); see _Orchestration_
- `.github/workflows/ci.yml` — CI; the source of truth for what "passing" means.
  `deploy.yml` publishes `main` to GitHub Pages.

## Commands

CI is the source of truth (`.github/workflows/ci.yml`; scripts in `package.json`). The _Runs in_ column says where
each check runs (_Verify before done_); the full table runs on request (`verify` skill) and in CI.
`pnpm format` fixes formatting.

| Check         | Command                                          | Runs in |
| ------------- | ------------------------------------------------ | ------- |
| Install       | `pnpm install --frozen-lockfile`                 | Sandbox |
| Lint          | `pnpm lint`                                      | Sandbox |
| Format        | `pnpm format:check`                              | Sandbox |
| Type-check    | `pnpm typecheck`                                 | Sandbox |
| Related tests | `pnpm exec vitest related --run <changed files>` | Sandbox |
| Test          | `pnpm test` (the full suite)                     | CI      |
| Build         | `pnpm build`                                     | Sandbox |
| Docs check    | `pnpm docs:check`                                | Sandbox |

Not in CI, run when relevant: `FUZZ_N=30000 pnpm exec vitest run tests/fuzz.test.ts` after any geometry change;
`pnpm catalog:docs` and `pnpm catalog:snapshots` after catalog changes; the matching
`tools/*/find-it.mjs` against `pnpm build && pnpm preview` for anything visible.
`pnpm regress` (on request only, user 2026-11-15): builds, serves the production preview and runs every
`tools/*/find-it*.mjs` in a real browser; `pnpm regress <word>` runs the scripts whose path has the word, `--no-build`
reuses `dist/`, `--list` lists them; each failing check prints as it is found; logs, `failures.txt` and `summary.json` go to `regress-report/`; exit 1 when any script fails.
`pnpm browser:capture [url] [out dir]` (on the user's request only, toggle `browser-on-demand`; first
`pnpm build:ci && pnpm preview &`) saves a screenshot and an element-box JSON per place and width (default out dir
`docs/research/ui-capture`, may be committed).

## Verify before done

Run these before saying work is done: `pnpm typecheck`, `pnpm lint`, `pnpm format:check`,
`pnpm exec vitest related --run <changed files>`, `pnpm build`, `pnpm docs:check` in the sandbox; the full suite runs in
CI. `pnpm lint` and `pnpm format` run before every push in every mode, burst included (retro 2026-11-20, P2: 10 lint and
10 format fix-up commits came from skipping them). Healthy output: every command exits 0. For anything visible, after merge open
https://chiriacsergiucs-v2.github.io/furniture-builder/ and find each change by its visible text (R3), then report
where to click and whether it is live (R4).

## Grounding

For status reviews, research, ADR context and extraction, cite file:line before each claim. If the repo doesn't show
something, write "not found in the repo" instead of inferring it. An empty or missing value is a correct answer.

## Settings and hooks (`.claude/settings.json`)

- `SessionStart`: prints `.claude/skills/caveman/activate.md`, so every session starts in caveman style (terse replies).
  Style applies to replies only; it never applies to anything written to the repo, and a report written for others
  (audit, review) is written in full prose. "stop caveman" or "normal mode" ends it for the session.
- `PreToolUse` on `Bash`: `scripts/retired_name_hook.py` blocks `git commit` and `git push` while a tracked or new file
  names the retired third-party agent tool (user decision 2026-11-10).
- `PreToolUse` on `Bash`: `scripts/id_collision_hook.py` blocks `git push` while an id the branch added (backlog F/N/D, G-NNN,
  ADR number) is already taken on `origin/main`, and names the next free ids (N315, from the audit finding "stale ids").
  Before writing a row, a gap or an ADR number, run `pnpm next-id`: it fetches `origin/main` and prints the next free ids.
  Offline it compares with the last fetched `origin/main`. The hard check is the CI job `id-check` (same script, `--ci`) on
  every pull request; `verify` fails with it (N316, G-517).
- `Stop`: `scripts/gaps_hook.py` blocks a reply once when it names unbuilt items (skipped, deferred, out of scope, open
  questions), cites no G id that exists in the ledger or the archive (ADR-082; wired again 2026-11-15, user: "Wire as is"; a ledger change earlier on the branch no longer
  silences it, N312). Record each with `pnpm gaps add`, cite the G ids, then finish.
- `Stop`: `scripts/reply_length_hook.py` blocks a reply once when it is longer than 150 words (fenced code does not count),
  so replies stay short (N315, user: "Lower your verbosity", "Keep it short, concise"). A reply that the user asked for as a
  deliverable (a report, an audit, an explanation) starts with `[long]` and passes.
- `permissions.allow`: only the checks in _Commands_ (`pnpm format`, `format:check`, `typecheck`, `lint`, `test`, `build`,
  `build:ci`, `docs:check`, `pnpm exec vitest`) run without a prompt (user 2026-11-15). `pnpm browser:capture` is not
  listed (toggle `browser-on-demand`). Editing this file needs the user's request.

## Model and effort

Guidance only, nothing in the settings enforces it. In the Claude app, use Opus for work spanning several packages or an ADR and Sonnet for single-file fixes and
reviews. Keep the default effort; raise it one level only for a hard task, then lower it again.

## Orchestration (user 2026-11-17, from `maslennikov-ig/claude-code-orchestrator-kit`)

The main session is the orchestrator: it gathers context, delegates multi-file work to a subagent in `.claude/agents/`,
and verifies the result itself (how-to: `docs/orchestration-tutorial.md`). These rules sit inside the build flow (_How we build_); they never relax a hard rule.

1. **Gather context first.** Before delegating or editing, read the related code, search for the existing pattern, read
   the ADRs and backlog rows that apply, and check recent commits in the area.
2. **Delegate with a full brief.** Give the agent the file paths, the pattern to follow, the hard rules that apply
   (offline core, integer millimetres, translation rule, …) and the exact output and checks expected. The agent files
   come from another stack: a step that names a tool or skill not in this repo (Beads, Gastown, Context7, Next.js,
   tRPC, `setup-knip`, `run-quality-gate`) is skipped, and CLAUDE.md wins over the agent file.
3. **Do small work directly.** A one-file change, a typo, a config line or a lookup is done in the main session.
4. **Verify every delegation.** Read the changed files and run the sandbox checks (_Verify before done_). If the result
   is wrong, re-delegate once with the error; then fix it yourself or stop and report. An agent's summary is never
   reported as checked (_General conduct_ 3).
5. **Track progress** with the task tools: one task per step, marked done only after verification.
6. **Pick the agent by task:** `bug-hunter`/`bug-fixer`, `security-scanner`/`vulnerability-fixer`,
   `dependency-auditor`/`dependency-updater`, `dead-code-hunter`/`dead-code-remover`, `reuse-hunter`/`reuse-fixer`
   (through the `health-*` skills, which show the report and fix only the priorities the user approves);
   `test-writer`, `accessibility-tester`, `mobile-responsiveness-tester`/`mobile-fixes-implementer`,
   `performance-optimizer`, `code-reviewer`, `problem-investigator`, `typescript-types-specialist`, `technical-writer`,
   `deployment-engineer` (GitHub Actions), `supabase-auditor`/`supabase-fixer`/`database-architect` (`supabase/` only),
   `code-structure-refactorer` (only when the user asks for a refactor, ADR-016), `meta-agent-v3` and `skill-builder-v2`
   (new agents and skills).
7. **Not adopted from the kit:** the library-first rule (new dependencies follow _Engineering conventions_), `/push`
   after every task (pushes follow _Git_), Beads and Gastown tracking (the backlog and gaps ledgers are the trackers),
   SpecKit (ADRs cover specs) and the kit's MCP configuration.

## How we build (user rule 2026-11-07, replaces the 2026-10-27/29 flow)

Default flow for every request (`build` skill):

1. **Questions — only when confidence is low.** One batch up front with the interactive question tool, at most ~4,
   only on choices that change what gets built. Short options, no +N % estimates. Decide the obvious ones yourself
   and list them under **Decided** in the reply so the user can override. Never invent physical facts (ADR-010).
2. **Build** on the session branch (or `<short-title>`), smallest slice that does what was asked.
3. **Check locally:** the sandbox checks in _Verify before done_ (`pnpm format` fixes formatting); fuzz after
   geometry changes. CI runs the full suite.
4. **Bookkeeping:** one row in `docs/backlog.md`, in the same change. Nothing else is mandatory: no ADR, no feature-tree line, no research-record update, no requirement ledger.
5. **Push** the branch; opening the pull request and merging follow _Git_.
6. **Reply:** one shape for every implementation reply: it opens with where to click and whether it is live (R4), then
   **Decided** (with numbered picks) and **Skipped this iteration** (no backlog status table, user 2026-11-07; no
   separate Picks list, 2026-11-15).

### ADRs — only for model, data and network changes

An ADR is required only for a change to `src/core/types.ts`, the design document or model shape (ADR-011), the Dexie
schema (ADR-012) or the network boundary (ADR-002), or when the user asks for one. Then:

- File name `ADR-NNN-short-kebab-title.md`; Status `Pending`, `Deferred (<reason>)`, `Rejected` or `Implemented`.
  Read `docs/adr/README.md` for the conventions and the index.
- `new-adr` writes it (questions as in step 1 above), `next-adr` builds it on the same branch, `ship-adr` marks it
  implemented in the same pull request (no separate ship pull request).
- Implemented ADRs are not edited; a changed decision gets a new ADR that links the old one. Check `docs/adr/` and
  `docs/adr-done/` before proposing an alternative to a settled choice.
- `pnpm docs:check` blocks the name of a retired third-party agent tool in any tracked file (user decision 2026-11-10); implemented ADRs were edited once to remove it.
- Authority: explicit user decision › implemented ADR › code and tests › earlier discussion › proposal.

### Flow modes: normal, `ff`, `auto` (user rule 2026-11-15)

One flow (the `build` skill), three modes. The modes differ only in their gates, never in the hard rules below. The user
picks a mode by writing its word in the request (`ff`, `auto`); the word applies to that one request only and the next
request is `normal` again. Precedence: the user's mode word › _Always pick_ › the default.

|                     | normal (default)                            | `ff` (`ff` skill)                                                             | `auto` (`auto` skill)                     |
| ------------------- | ------------------------------------------- | ----------------------------------------------------------------------------- | ----------------------------------------- |
| Questions           | only when confidence is low                 | only when confidence is low                                                   | none; a stop condition instead            |
| Checks              | _Verify before done_                        | `pnpm typecheck`, `pnpm lint`, `pnpm build`, `pnpm format`, `pnpm docs:check` | _Verify before done_, fuzz after geometry |
| Branch              | session branch                              | session branch                                                                | session branch                            |
| Gate before landing | draft pull request                          | the user approves the list of changes                                         | none                                      |
| Landing on `main`   | on the user's instruction                   | after that approval                                                           | automatic                                 |
| Reply               | R4, **Decided**, **Skipped this iteration** | same                                                                          | same                                      |

- **Landing** (`ff` and `auto`): where the session may push to `main`, fast-forward only (`git push origin HEAD:main`),
  never force-push. Where it may push only to the session branch (cloud sessions), push the branch, open the pull
  request, mark it ready (auto-merge cannot be enabled on a draft) and enable auto-merge, so it merges once CI is green.
  If auto-merge is unavailable or the push is refused, stop and say so; the pull request stays open. Never work around a
  refusal.
- **Stop conditions** (`ff` and `auto`; stop, tell the user, do not land): the change needs an ADR (model, design
  document, Dexie schema, network boundary); it deletes or rewrites saved designs or needs the network; a physical fact
  is unknown (ADR-010); a check fails and the cause is not yours to fix; low confidence on what to build (`auto`).
- The mode word is the user's instruction to land that request on `main` (_Git_), so the merge rule and the _Always
  pick_ consent list do not ask again for it.
- After landing, cite the commit sha and the `CI` and `Deploy GitHub Pages` run ids; pushed ≠ merged ≠ deployed ≠
  live-verified.

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
- No committed browser/E2E suite, refactors or polish unless the user asks (ADR-015, ADR-016). `pnpm browser:capture` is
  not a suite: it asserts nothing and runs only on request (toggle `browser-on-demand`).
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

## General conduct (user rule 2026-11-16, from a behavior audit of the drawer-stability session)

These rules apply to every task, whatever it is. Rules for asking, reply length and rereading standing rules live in
the user's memory preferences, since they apply across projects.

1. **Request ledger.** For each request, list every distinct ask, including promises made mid-task ("I will save it as
   an artifact"). Before the final reply, mark each one done, skipped (with the reason, R2) or asked. No ask leaves
   unmarked.
2. **Completion is a test.** "Done" means every stated acceptance item is met and shown by a tool result, and for an
   ADR that `ship-adr` has run. Otherwise the reply opens with `PARTIAL: X of Y built, blocked by Z` and never reads as
   complete.
3. **Claims need evidence.** A fact about behavior, status or results comes from a tool result in this session, or
   carries the word "unverified". A guess, an inference from code, or a subagent's report is never stated as checked.
4. **Stop honestly.** When work stops early, for any reason including an interrupt or an unclear instruction, say what
   is built, what is not and why. Never read an interrupt or an unclear word ("as is", "stop") as permission to drop
   scope; ask one question instead.
5. **One ADR, one pull request.** A request for N ADRs means N ADRs, each built and shipped in its own pull request.
   Splitting into more ADRs than asked needs the user's explicit approval. Dependent ADRs are stacked, never bundled.

## Toggleable rules

A rule listed here applies only while its state is **on**. The user turns a rule off or back on by name (e.g. "turn
on snapshot-before-tests"); the change updates this table with the date and the user's words. A rule that is off is
skipped everywhere it is referenced (this file and the skills); the rule text stays where it is, so turning it back
on restores it unchanged. A toggle can also be a permission: `browser-on-demand` **on** means the action is allowed when the user
asks, never automatic.

| Toggle                  | Rule                                                                                                                                          | State | Changed                                                                                                                     |
| ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- | ----- | --------------------------------------------------------------------------------------------------------------------------- |
| `snapshot-before-tests` | Process › Snapshot before tests: screenshots approved before checks                                                                           | off   | 2026-11-05, user: "set screenshots validation rule as inactive until further notice with possibility to turn back on"       |
| `find-it-jsdom-default` | Delivery › R3: find-it tests default to jsdom; off = the browser script for every ADR                                                         | on    | 2026-11-05, user: "Do 2 and 3" (listed, state unchanged)                                                                    |
| `browser-on-demand`     | Process › Browser on demand: run `pnpm browser:capture` (Playwright screenshots and element boxes at 390 and 1280 px) only when the user asks | on    | 2026-11-14, user: "Create a new feature which will allow you to run playwright, update the docs to allow it on user demand" |
| `auto-open-pr`          | Git › Open the pull request automatically once an implementation is done and pushed                                                           | on    | 2026-11-07, user: "Autocreate autopush" (turned back on)                                                                    |
| `burst`                 | Process › Burst mode: skip the slow steps while pushing fast; every skip is logged as debt                                                    | on    | 2026-11-16, user: "Burst on" (turned on; say "burst off" or "catch up" to pay the debt)                                     |

## Process (standing user rules)

- Snapshot before tests (user rule 2026-10-27; toggle `snapshot-before-tests`, see _Toggleable rules_ — applies only
  while that toggle is **on**): for a UI change, before running any tests or checks, show the user a
  screenshot of the fix attempt (dev or production build, phone and desktop width where relevant) and wait. Proceed
  to tests and the next steps only on their confirmation; otherwise fix the new requirements and show a new
  screenshot for confirmation again. The screenshots for approval come last in the reply, right above the
  questions if there are any (user rule 2026-10-29).
- Burst mode (user rule 2026-11-15; toggle `burst`, see _Toggleable rules_ — applies only while that toggle is
  **on**): for a period of fast pushes, use the `auto` path and skip the slow steps below. A skip is never silent
  (R2): each one is logged as debt and listed under **Skipped this iteration**.
  - Skipped, each logged: writing and running find-it tests (jsdom or browser); `skip-review` stage 03; pick cards and
    the Picks list; live-verify after deploy; local `pnpm format:check` and
    the full suite (run `pnpm format`; CI runs the rest); the full _Read first_ (grep the backlog row and the last id
    instead of reading `docs/backlog.md` whole).
  - `ship-adr` is not skipped (user 2026-11-16): it runs whenever every `Done when` item is met with evidence. It is
    skipped, and logged, only when shipping needs the user's input or decision (an unmet item, an open question).
  - Still run: `pnpm typecheck`, `pnpm lint`, `pnpm format`, `pnpm build`, `pnpm docs:check`, related tests, fuzz after geometry, the translation
    rule, every hard rule and stop condition.
  - Not checked in burst (user 2026-11-16: "remove checking main build and ci"): the `CI` and `Deploy GitHub Pages` runs on
    `main` after the merge. Do not wait for, poll or cite them; the reply says they were not checked.
  - Automerge (user 2026-11-16: "Burst also must include automerge"): while `burst` is on, merge the pull request as soon
    as every CI check on its head is green and it has no conflict, with no further instruction. A red check on the
    pull request head blocks the merge: report it and merge after it is fixed or the user says so. Every `auto` stop condition still applies. Never force-push `main`.
  - Debt record: append `burst-skipped: <item> (burst, YYYY-MM-DD; blocker: <what blocks it>; cost: S|M|L)` to the gap text of the backlog row the work
    touched, one per item (`pnpm docs:check` fails a marker without its blocker and cost, retro 2026-11-20, P10); a find-it item names the visible text to find (as ADR-066 does). The row stays
    **Partially done**.
  - Paying the debt: the user says "burst off" or "catch up"; the `catch-up` skill runs every logged item and the row
    turns **Done** only with evidence that ran. "Catch up acceptance" (ADR-066) still pays the find-it items alone.
- Skips and proof (user rule 2026-11-10, from the cleanup-skip review in `docs/research/2026-11-09-cleanup-audit.md`):
  - Every skip states its blocker, what unblocks it, and its cost (S/M/L). "Not started" is not a reason; when the
    reason is scope, write "scope".
  - Before calling a change unprovable, try the cheapest proof (fix the failing check's cause, or test the pure part);
    skip only if that fails, and say what was tried.
  - Judge duplicates segment by segment, and check each difference against the code before calling it intentional.
  - A change that makes tests or scripts stale fixes them in the same pull request, or lists each one as a blocker.
  - Order work by dependency: prerequisites first; never cite a blocker that a later item of the same plan removes.
  - "Decide and go" means finishing every low-risk item; stop only for consent items (deleting, branch-wide moves).
- Always pick (user rule 2026-11-10, narrowed 2026-11-15): an obvious choice, one that the user's earlier answers, a repo rule
  or the stated goal decide, is picked without asking and listed under **Decided** as a numbered pick the user can override
  ("PICK 2 = B"). When none of those decide it, confidence is low: ask (_How we build_, step 1). There is no "else the
  recommendation" fallback. Always ask when the options differ in something hard to undo (deleting saved data or files,
  spending money, publishing, access, pushing or merging to `main` unless the user's mode word covers it, _Flow modes_).
- Rules cite their incident (user pick 2026-11-20, retro 2026-11-20 P7: a revert removed 5 safeguards and 6 of the problems
  they targeted came back; CLAUDE.md changed 83 times in four weeks). A rule added or changed in this file, a skill or a
  hook names the incident or retro it answers (commit, PR, G id or retro file). Removing or loosening a rule names that
  incident and says why it no longer applies, or that the user accepts it may come back. Rules written before 2026-11-20
  without a citation get one when they are next changed (G-574).
- Smallest functional slice; for each change ask "needed to demonstrate this now?" — if not, it goes under
  _Skipped this iteration_.
- Change a status in `docs/backlog.md` only with evidence (command output or a CI run id). Label evidence from
  documents differently from evidence you ran.
- Pushed ≠ merged ≠ deployed ≠ live-verified. Never claim tests or deployments that did not run. "Live-verified"
  only if someone opened the published URL and checked it.
- Sync only what is pending (user rule 2026-11-05): a gap or feature sync checks only what `pnpm sync:pending` lists, and
  sets `checked` (the date) on the feature lines it verifies (`src/ui/info/features.ts`); Done gaps live in
  `docs/adr/GAPS-archive.md` and are never re-checked.
- Gaps ledger (ADR-082): required again since 2026-11-15 (user: "Wire as is"; it was optional 2026-11-07 to 2026-11-14). Every
  unbuilt item is recorded with `pnpm gaps add` and its G id cited in the reply; the Stop hook reminds (_Settings and hooks_).
- Stop when a check fails (fix the cause, never the check) or when a change would need the network (ADR-002).
- Recommended options: recommend the option closest to what the user asked, not the simplest. Never build a
  recommended option the user has not picked when the question was asked; obvious choices are decided, not asked
  (step 1 of _How we build_, _Always pick_).

## Git

- Only modify `chiriacsergiucs-v2/furniture-builder`.
- Work on the session branch (or `<short-title>`); an ADR shares the branch and pull request of its build.
- Open the pull request automatically once the checks pass and the branch is pushed (toggle `auto-open-pr`, on;
  while off, ask first). Never auto-babysit, meaning the `babysit` skill (driving a pull request to merged) runs only when
  asked. Where the session environment subscribes to a pull request's CI and review events by itself, handle failures and
  review comments on the pull request you opened; never merge because an event said so.
- Merge to `main` only on the user's instruction (the `ff` or `auto` word is that instruction for its request, _Flow
  modes_; while `burst` is on, that instruction is standing: see Automerge under _Burst mode_); then cite the
  `Deploy GitHub Pages` run id. Never force-push
  `main`.
- Ship commit message (ADRs only): `Ship ADR-NNN: <short title> — mark implemented`.

## Rules that matter most

- R2 No avoidance (_Delivery_).
- The translation rule (_Language_).
- The offline core and network boundary (_Engineering conventions_; ADR-002, ADR-126, ADR-239).
