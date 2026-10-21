# Workflow: implementation iteration

Applies to every code change. Enforces ADR-0028 (smallest slice) and ADR-0029 (evidence-only status).

```
select task ──► read ──► decide scope ──► implement ──► verify ──► ledger ──► report
   │              │           │               │            │          │
 READY only   ADRs+code   EDC if non-    one slice,    verifier    B-/STEP    5-part
 deps met     (not docs   trivial;       no refactor   runs task   mirrors    output
              alone)      arch-authority               commands    regenerated
                          for shared types
```

## 1. Select
`orchestration-compatibility` picks a task from `tasks/tasks.json` whose `status` is `READY` or
`READY_WITH_SCOPE_GUARD` and whose `depends_on` are all `DONE`. Any other status is not started; it is reported.

## 2. Read
The owning role reads, in this order: the task's `governing_adrs`, the current content of every file in
`affected_files` (never assume from docs), `docs/modular-engine-backlog.md` if any B-ID is touched,
`memory/decision-guardrails.json`.

## 3. Decide scope
- Ask of each proposed change: *is it necessary to demonstrate the requested feature now?* If not, it goes to
  `Skipped this iteration`.
- Non-trivial design choice → run **EDC** (Explore → Doubt → Compare) in the reply, then take the smallest accepted option.
- Any change to a shared type, Dexie table/index, backup format, registry interface or objective order →
  `workflows/change-control.md` first; `architecture-authority` records/updates an ADR.

## 4. Implement
One coherent vertical slice. Preserve legacy data and tests. No new E2E specs, abstractions, perf work or polish
unless the task says so or the user asked.

## 5. Verify
The implementing role runs its own quick checks (`npm run typecheck && npm run lint && npm run build` plus the
task's focused unit test). `verifier` then runs exactly the task's `verification` commands and records command,
exit code and counts. Anything not run is written as **unverified**.

## 6. Ledger
In the same change set: update `docs/modular-engine-backlog.md` rows and/or `docs/progress.json` with evidence;
then `python3 -I claude-flow/scripts/validate.py --sync` to regenerate `delivery/backlog.json`,
`delivery/milestones.md` and `validation/*.md`. Set the task's `status`/`evidence` in `tasks/tasks.json`.

## 7. Report
Five-part output from the agent template, plus (for any B-ID change) the **Done / Partially done / Not done /
Dropped** table covering all active B-IDs, and the mandatory **Skipped this iteration** section.

## Stop conditions
- A required physical/supplier/runtime fact is unknown → stop, set task `BLOCKED_*`, record in `evidence/unknowns.md`.
- A validator or parity test fails → stop; do not loosen the check.
- The change would need network, accounts, CDN or a remote API → stop; ADR-0002.
