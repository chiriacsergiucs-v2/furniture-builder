# ADR-015: Verification: pure-core unit tests plus seeded fuzz invariants; screenshots for UI; no E2E suite by default

- Status: Implemented
- Date: 2026-10-21
- Implemented: 2026-10-21
- Depends on: none
- Design: n/a
- Related: ADR-008, ADR-016

## Context

Geometry bugs cost boards; UI is changing fast pre-MVP (user's standing rule against E2E suites by default).

## Decision

`npm test` runs: core unit tests (templates, gaps, runners, internal drawers, splits, desks, validation),
regressions from the independent review, a seeded fuzz test (3,000 random designs; `FUZZ_N` for deep runs) asserting
the geometric invariants, and IndexedDB persistence with fake-indexeddb. UI is checked by building and taking
Playwright screenshots at desktop, laptop and phone sizes during development; no committed browser suite until the
user asks for one. CI runs lint, typecheck, tests and build on every push.

## Alternatives considered

- **Committed Playwright suite now** — deferred per the user's pre-MVP rule.

## Consequences

- Browser flows (library dialog, undo, materials editor) are unverified by automation and listed as such.

## Evidence (repository files)

- `tests/core.test.ts`, `tests/fuzz.test.ts`, `tests/persist.test.ts`; `.github/workflows/ci.yml`.

## Compliance check

CI `verify` job green on the commit.
