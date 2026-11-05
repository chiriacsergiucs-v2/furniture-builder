# ADR-184: Delete the built research rows from the research data

- Status: Pending
- Date: 2026-11-05
- Depends on: ADR-149, ADR-168
- Design: n/a
- Backlog: N187
- Agreed: 2026-11-05 "Proceed similarly with next 5 adrs"; answer "Both, delete all 9"

## Context

Gap G-336 (ADR-168): built research rows stay listed although ADR-149's rule deletes them
(`src/core/research/ensemble-2026-10-23.app.ts`: "Built features (Verified, Implemented) are deleted from the data").
Re-checked 2026-11-05: 9 rows are Verified — transactional-undo, assembly-sequence, ensemble-templates, live-price,
independent-selection, direct-manipulation, versioned-save, deterministic-alternatives, locks-overrides.

User, 2026-11-05: **delete all 9**.

## Decision

1. The 9 Verified features are deleted from the research data the way ADR-149 and ADR-152 did it (feature rows, app
   statuses and any merged-children references), so the research page no longer lists them as left to build.
2. Rows that are In Progress stay, with their `missing` text.

## Alternatives considered

- **Delete only the 3 rows of ADR-168** — leaves 6 built rows listed. Not chosen.

## Scope

- In scope: research data and its tests.

## Consequences

- Positive: the research page lists only what is left.
- Harder to change later: deleted rows come back only from git history.

## Done when

- [ ] No feature in the research data has status Verified or Implemented (tests)
- [ ] Research tests and `pnpm typecheck` pass; the research page renders (tests)
