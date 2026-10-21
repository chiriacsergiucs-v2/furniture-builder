# Implementation iteration

1. **Pick** a task from `tasks/tasks.json` that is READY with every `depends_on` DONE.
2. **Read** its governing ADRs and the current code it touches (not docs alone).
3. **Scope**: for each change ask "needed to demonstrate this now?" — if not, it goes under *Skipped this iteration*.
   Non-trivial choices get a short Explore → Doubt → Compare.
4. **Shared shapes** (`types.ts`, design document, model) → `change-control.md` first.
5. **Build** one vertical slice; keep `src/core` pure; add a test for every new rule.
6. **Verify**: `npm run lint && npm run typecheck && npm test && npm run build`; geometry → deep fuzz; UI → screenshots.
7. **Ledger**: update `docs/backlog.md` and the task's `status`/`evidence` in the same change; run `scripts/validate.py`.
8. **Report**: changed paths, IDs, evidence, blockers, backlog table, *Skipped this iteration*.

Stop when a physical/supplier fact is unknown (record it under *Open questions* in the backlog), when a check fails
(fix the cause, never the check), or when a change would need the network (ADR-0002).
