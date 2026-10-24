# ADR-016: Process: smallest slice, evidence-only status, explicit "Skipped this iteration"

- Status: Implemented
- Date: 2026-10-11
- Implemented: 2026-10-21
- Decided by: re-adopted 2026-10-21
- Depends on: none
- Design: n/a
- Related: ADR-015

## Context

Standing user rules from before the rebuild govern how work is done, independent of the code.

## Decision

Build the smallest functional slice; default verification is lint + typecheck + tests + build. `docs/backlog.md` is
the single ledger; statuses Done / Partially done / Not done / Dropped change only with cited evidence; IDs are never
reused. Pushed ≠ merged ≠ deployed ≠ verified live. Every implementation reply ends with the backlog status table
and a **Skipped this iteration** section.

## Alternatives considered

- **Multiple TODO files** — rejected by the user.

## Consequences

- `claude-flow/scripts/validate.py` checks that ledger IDs referenced across docs exist.

## Evidence (repository files)

- `AGENTS.md`; `docs/backlog.md`.

## Compliance check

Implementation replies end with "Skipped this iteration"; backlog rows cite evidence.
