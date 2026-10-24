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
- npm, Vitest, ESLint
- Static site on GitHub Pages; no backend, accounts, cloud, telemetry, remote AI or CDN (ADR-002)
- GitHub for source control and CI/CD

## Language

- Everything written to the repo is in **English**: code, comments, commit messages, ADRs, skills,
  markdown files.
- Reply to the user in the language they write in (Romanian or English).
- Printed sheets and the parts CSV are in Romanian (ADR-020); the app UI is in English.

## Repository layout

- `src/core` — pure TypeScript model: geometry, generators, checks, cut list, nesting, projects, Romanian
  output, Fusion export, the design document. Imports nothing from React, three or Dexie.
- `src/store` — Zustand store: design, derived model, selection, undo/redo
- `src/persist` — IndexedDB (Dexie) storage
- `src/ui` — React UI; `src/viewer` — lazy three.js preview
- `tests/` — core, fuzz, storage and UI-logic tests (Vitest)
- `tools/` — the catalog PDF extractor and the find-it acceptance scripts (`tools/*/find-it.mjs`)
- `scripts/check-docs.py` — checks ADRs, the index and every ADR and backlog id (`npm run docs:check`)
- `docs/adr/` — pending ADRs, `README.md` (index), `_template.md`
- `docs/adr-done/` — implemented ADRs
- `docs/backlog.md` — the single work ledger (F/N/D ids)
- `docs/product/product-context.md` — the user's decisions and answers so far; `docs/architecture.md` — how
  the code fits together; `docs/ui-design.md` — tokens, components and screens; `docs/catalog.md` — generated
  (`npm run catalog:docs`); `docs/retros/` — retrospectives
- `.claude/skills/` — `new-adr`, `next-adr`, `ship-adr`, `verify`, `review`, `debug`, `add-tests`,
  `implement-design`, `design-review`, `add-storage-version`
- `.github/workflows/ci.yml` — CI; the source of truth for what "passing" means.
  `deploy.yml` publishes `main` to GitHub Pages.

## Commands

CI is the source of truth. Before saying work is done, run the same checks CI runs
(`.github/workflows/ci.yml`; scripts are defined in `package.json`).

| Check      | Command              |
| ---------- | -------------------- |
| Install    | `npm ci`             |
| Lint       | `npm run lint`       |
| Type-check | `npm run typecheck`  |
| Test       | `npm test`           |
| Build      | `npm run build`      |
| Docs check | `npm run docs:check` |

Not in CI, run when relevant: `FUZZ_N=30000 npx vitest run tests/fuzz.test.ts` after any geometry change;
`npm run catalog:docs` and `npm run catalog:snapshots` after catalog changes; the matching
`tools/*/find-it.mjs` against `npm run build && npm run preview` for anything visible.

## How we plan and build: ADRs

An ADR here is a self-contained unit of work: a decision plus everything needed to
implement it. Read `docs/adr/README.md` for the conventions and the index.

- File name: `ADR-NNN-short-kebab-title.md` (3-digit number).
- Status: `Pending`, `Deferred (<reason>)` or `Implemented`. Never set `Implemented` by hand.
- An ADR is agreed by the user. Unconfirmed defaults stay under *Open questions* in the ADR.
- Implemented ADRs are not edited; a changed decision gets a new ADR that links the old one.
- Check `docs/adr/` and `docs/adr-done/` before proposing an alternative to a settled choice.
- Authority: explicit user decision › implemented ADR › code and tests › earlier discussion › proposal.

Lifecycle, one skill per step:

1. `new ADR` — create and register an ADR (`new-adr` skill)
2. `next ADR` — pick and implement the next ready ADR (`next-adr` skill)
3. `ship ADR-NNN` — mark it implemented, move it, fix links (`ship-adr` skill)

## Engineering conventions (hard rules)

- Do not read, write or migrate the previous app or its data (`mobila-cutlist-build-kit`) (ADR-001).
- No backend, accounts, cloud, telemetry, remote AI, runtime third-party requests or CDN (ADR-002).
- Integer millimetres; x width, y height from floor, z depth from back; exact integer splits (ADR-003).
- Every view and list is a projection of `buildModel()`; never compute geometry in UI code (ADR-004).
- New product families reuse `buildCabinet` where a carcass exists (ADR-007).
- User input never throws and is never clamped silently; problems are diagnostics, checked independently of the
  generators; errors block export. Never hide or soften an error diagnostic (ADR-008).
- Never invent hardware specs, loads, drilling depths, screw specs or supplier values; label guidance as
  guidance (ADR-010). An unknown physical fact goes under *Open questions* in `docs/backlog.md`; ask the user.
- Validate designs before load or import; imported designs get new ids; never persist generated geometry. A
  change to `src/core/types.ts`, the design document or the model shape cites or creates an ADR, and a new
  document shape bumps `schemaVersion` and keeps old readers (ADR-011).
- Storage: never edit a shipped Dexie version; never delete rows the app cannot read (ADR-012). Use the
  `add-storage-version` skill. Nothing may delete or rewrite saved designs without the user's explicit decision.
- The 3D viewer only selects, never edits, stays lazy and mounts only when visible (ADR-014).
- Zustand selectors return stable references (no `.filter()`/`.map()` inside a selector).
- Keyboard focus visible; no horizontal page scroll at 390 px.
- No committed browser/E2E suite, refactors or polish unless the user asks (ADR-015, ADR-016).
- No dependency with an unknown licence or telemetry. Lockfile committed; base path `/furniture-builder/`.
- Never renumber ADR or F/N/D ids.

## Delivery (hard, auto-failing — user rule 2026-10-23, `docs/retros/2026-10-23-catalog.md`)

- **R1 Requirement ledger:** list every requirement in the user's own words; each needs evidence from the
  running app the user will use. Unreachable or unchecked = not done, and the whole delivery fails.
- **R2 No avoidance:** never drop or relabel a requirement ("reference", "waits", "gap", "deferred") to skip
  building it; ask instead.
- **R3 Find-it test:** UI acceptance starts from the bare app and finds features by visible text at phone and
  desktop widths (`tools/*/find-it.mjs` against the production build).
- **R4 Outcome first:** replies open with where to click and whether it is live.

## Process (standing user rules)

- Smallest functional slice; for each change ask "needed to demonstrate this now?" — if not, it goes under
  *Skipped this iteration*.
- Update `docs/backlog.md` in the same change; change a status only with evidence (command output or a CI
  run id). Label evidence from documents differently from evidence you ran.
- Pushed ≠ merged ≠ deployed ≠ live-verified. Never claim tests or deployments that did not run. "Live-verified"
  only if someone opened the published URL and checked it.
- Every implementation reply ends with the backlog status table and a **Skipped this iteration** section.
- Stop when a check fails (fix the cause, never the check) or when a change would need the network (ADR-002).

## Git

- Only modify `chiriacsergiucs-v2/furniture-builder`.
- Branch per ADR: `adr-NNN-short-title`; open a pull request for review.
- Merge to `main` only on the user's instruction; then cite the `Deploy GitHub Pages` run id. Never force-push
  `main`.
- Ship commit message: `Ship ADR-NNN: <short title> — mark implemented`.
