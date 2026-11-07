# ADR-237: Declare the browser test dependency and tidy test hygiene

- Status: Implemented
- Date: 2026-11-07
- Implemented: 2026-11-07
- Depends on: none
- Design: n/a
- Backlog: N242

## Context

User, 2026-11-07 (the architecture review request): "current code structure/architecture modularity and overall
design analysis ... complete code quality critique and suggest architectural improvements ... No regressions shall
be introduced, ensure before and after testing tdd style". User, 2026-11-07: "full autopilot and ownership grant to
run in parallel as you see fit agents to cover the entire i1 to i20, draft adrs in 1 pr then do batches. Goal is to
have them all done and merged with no regressions introduced then stop".

This ADR is improvement **I-19** of `docs/retros/2026-11-07-architecture-review.md` (sections 7 and 8). The
choices below were decided by Claude under the user's ownership grant, 2026-11-07; no question is left open.

Fifty-nine `tools/*/find-it.mjs` browser scripts import `playwright`, which is in neither `package.json` nor the
lockfile, and each repeats ~40 lines of setup. `tools/catalog/test_extract_pdf.py` runs nowhere: `extract_pdf.py`
imports `pdfplumber` at module top (line 21), so the tests cannot run without installing it. `tests/roomfill.test.ts`
holds a 4.7 s seeded-random test ("seeded random rooms never throw…") in the regular suite, and `tests/persist.test.ts`
shares one fake IndexedDB across tests (`find-it/setup.tsx` already resets it per test).

## Decision

Decided by Claude under the user's ownership grant, 2026-11-07.

- `playwright-core` (Apache-2.0, no telemetry, downloads no browser) at an exact version as a devDependency, lockfile
  updated. `tools/lib/harness.mjs` holds the shared setup (launch, the two widths, the preview URL) and launches with
  `executablePath` from `CHROMIUM_PATH`, else the system Chromium, else Playwright's own install if present. Every
  `tools/*/find-it.mjs` imports it.
- `test_extract_pdf.py` stays out of CI (G-501).
- The roomfill seeded-random test moves to `tests/fuzz.test.ts` under the `FUZZ_N` contract (default N as today's
  count, so the default run checks the same rooms).
- `tests/persist.test.ts` gets a `beforeEach` with `globalThis.indexedDB = new IDBFactory()` as `setup.tsx` does.

## Alternatives considered

- **`playwright` (full)** — its install step downloads browsers; `playwright-core` with the system Chromium does not.
- **A separate `tools/package.json`** — a second lockfile to keep current.
- **Install `pdfplumber` in CI** — a Python dependency the app does not use; kept in G-501.

## Scope

- In scope: the dependency, the harness, the moved test, the per-test database.
- Out of scope: running the PDF extractor tests in CI (G-501).

## Consequences

- Positive: the browser scripts run from a clean clone; `pnpm test` about −4.7 s (measured by the review).
- Negative / risks: the dependency install needs the registry once (lockfile change); a persist test that relied on
  data from an earlier test (it then sets up its own).
- Harder to change later: nothing.

## Done when

TDD (review section 9): every item starts from a test written first that pins today's behaviour and passes on
`main` before the change; the change keeps it green (or turns the stated red test green).

- [x] (test first) a Vitest test parses every `tools/*/find-it.mjs` and asserts each bare import specifier is declared
      in `package.json` (red before: `playwright`), green after.
- [x] `node tools/move-3d/find-it.mjs` passes against `pnpm build && pnpm preview` with the system Chromium.
- [x] (test first) the seeded rooms are counted before the move; `tests/fuzz.test.ts` checks the same count at the
      default `FUZZ_N`, and `FUZZ_N=30000` passes.
- [x] `tests/persist.test.ts` passes in any order (`--sequence.shuffle`).
- [x] `pnpm lint`, `pnpm format:check`, `pnpm typecheck`, `pnpm test`, `pnpm build` and `pnpm docs:check` pass; the
      test count is not lower than on `main` before the change (review section 9).

## Evidence (2026-11-07, run locally on branch `wip/b1c`)

- Dependency: `playwright-core` 1.63.0 (the version of the preinstalled Playwright, browser revision chromium-1243),
  exact, devDependency, lockfile updated; `pnpm install --frozen-lockfile` passes. Licence Apache-2.0 (its
  `package.json`); it has no install script and no dependencies, so an install downloads no browser whatever
  `PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD` says; no telemetry (the only match in its code is a Firefox pref that turns
  telemetry off).
- `tests/tool-deps.test.ts` › "every package a find-it script or the harness imports is declared in package.json": red
  before (76 scripts: `playwright`), green after; "the scripts share tools/lib/harness.mjs" likewise.
- `tools/lib/harness.mjs` (`launchBrowser`, `previewUrl`, `outDir`, `PREVIEW_URL`, `WIDTHS`); the 76
  `tools/*/find-it*.mjs` changed mechanically (import, launch, URL and folder defaults kept per script, widths
  untouched). Against `pnpm build && pnpm preview --port 4391`: `tools/move-3d/find-it.mjs` 32/32 with Playwright's own
  Chromium and 32/32 with `CHROMIUM_PATH=/opt/pw-browsers/chromium`; `tools/home/find-it.mjs` 63/63;
  `tools/start-new/find-it.mjs` 48 checks passed.
- The seeded rooms: a count pinned in `tests/roomfill.test.ts` first (20 at the default), then moved to
  `tests/fuzz.test.ts` › "seeded random rooms never throw and never offer a mix with an error (ADR-173, ADR-237)" with
  the same assertions and count; it yields between rooms so a deep run does not stall vitest's worker.
  `FUZZ_N=30000 pnpm exec vitest run tests/fuzz.test.ts`: 9/9 passed.
- `tests/persist.test.ts`: red with `--sequence.shuffle --sequence.seed=3` before, green with seeds 1 to 4 after (a new
  `IDBFactory`, handed to Dexie too, and a fresh `src/persist/db` per test).
