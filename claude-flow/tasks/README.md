# Task contracts

`tasks.json` holds every task as a contract: objective, owning role, governing ADRs, requirement IDs, dependencies,
affected files, deliverables, the exact `verification` commands the verifier runs, acceptance conditions, a
`scope_guard` (ADR-0028) and an `evidence` list that must be non-empty before `DONE`.

These are runtime-neutral (ADR-0030): they are read by agents, not loaded by a CLI.

## Start here
- **READY now:** TSK-002 (reconcile STEP/gates), TSK-011 (licence audit), TSK-012 (doc drift incl. 54 vs 55 templates).
- **Scope-guarded:** TSK-003 (B22 editor for registered roots).
- **Specify, don't code:** TSK-004 (bed root), TSK-005 (wardrobe rails/fronts).
- **Blocked on things outside the repo:** TSK-001 (runtime pin), TSK-006/007 (physical), TSK-008 (Fusion), TSK-009 (Android), TSK-010 (original vendor files not in repo).
- **Pending on others:** TSK-013 → TSK-002; TSK-014 → TSK-002, TSK-011, TSK-013.

## Lifecycle
`READY → IN_PROGRESS (owner) → IN_REVIEW (owner hands off) → DONE (verifier) | BLOCKED_* (anyone, with blocker text)`.
Blocked statuses are never promoted without the blocker being resolved in writing.
