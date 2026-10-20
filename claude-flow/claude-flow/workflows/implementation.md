# Evidence-first implementation

1. Load source inventory + unresolved decisions and rank applicable authority.
2. Select `READY` or `READY_WITH_SCOPE_GUARD` task with all prerequisites satisfied.
3. If shared schema changes are needed, architecture-authority settles them in a tracked decision.
4. Make smallest vertical implementation slice, preserve user data and backwards compatibility.
5. Execute relevant commands from `AGENTS.md`; capture commit, environment and real logs.
6. Independent verifier checks geometry, data safety, cutlist/model parity and acceptance conditions.
7. Update task state, source/decision/requirement/test links and handoff. On unverified work, leave blocked/partial.
8. Release/compliance role reconciles STEP ledger before any release claim.
