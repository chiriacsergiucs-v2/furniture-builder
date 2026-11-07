# ADR-237: Declare the browser test dependency and tidy test hygiene

- Status: Pending
- Date: 2026-11-07
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

- [ ] (test first) a Vitest test parses every `tools/*/find-it.mjs` and asserts each bare import specifier is declared
      in `package.json` (red before: `playwright`), green after.
- [ ] `node tools/move-3d/find-it.mjs` passes against `pnpm build && pnpm preview` with the system Chromium.
- [ ] (test first) the seeded rooms are counted before the move; `tests/fuzz.test.ts` checks the same count at the
      default `FUZZ_N`, and `FUZZ_N=30000` passes.
- [ ] `tests/persist.test.ts` passes in any order (`--sequence.shuffle`).
- [ ] `pnpm lint`, `pnpm format:check`, `pnpm typecheck`, `pnpm test`, `pnpm build` and `pnpm docs:check` pass; the
      test count is not lower than on `main` before the change (review section 9).
