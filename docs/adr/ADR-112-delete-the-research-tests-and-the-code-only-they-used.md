# ADR-112: Delete the research tests and the code only they used

- Status: Pending
- Date: 2026-10-27
- Depends on: ADR-110, ADR-111
- Design: n/a
- Backlog: N110
- Agreed: 2026-10-27 "Delete any tests for research, there is no need"; answers "Remove it too", "Same PR #109"

## Context

User request 2026-10-27: "Delete any tests for research, there is no need". ADR-110 kept `coverage()` and
`auditChecks()` only for those tests. ADR-111 added a hidden `removed` list only so that audit passed.

## Decision

- Delete `tests/research.test.ts` and `tools/research/find-it.mjs`.
- Delete the code and data only they used (answer "Remove it too"): the coverage audit (`coverage`, `auditChecks`
  and their types), the bundle's `removed` list (`RemovedFeature`, its validation, `ENSEMBLE_REMOVED`).
- "Built in this app" says "Features the app has built are no longer listed (ADR-111)." without a count, since the
  count came from the `removed` list.
- Keep the storage-upgrade tests that name the research tables (`researchDocs`, `researchMarks`): they protect saved
  data (ADR-012), not the research page.
- No find-it test for this ADR: the user's decision is that research needs no tests. The only visible change is
  the panel sentence.
- A later research-page change has no research test or find-it script to update; it brings its own if it needs one.
- Supersedes the "coverage tests stay" part of ADR-110 and the traceability part (point 4) of ADR-111.

## Scope

- In scope: the two test files, the audit code, the `removed` list, the panel sentence.

## Consequences

- Positive: less code and data to keep.
- Negative / risks: nothing checks the research page or that the paper is fully extracted any more.
- Harder to change later: restoring the tests means restoring them from git history.

## Done when

- [x] No research test or research find-it script remains; nothing imports the deleted code (typecheck, lint)
- [x] `pnpm test`, lint, format, typecheck, build and docs check pass
