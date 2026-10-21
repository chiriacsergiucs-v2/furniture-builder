# Conflicts register

| # | Sources in tension | Resolution | Status |
|---|---|---|---|
| C-01 | Build prompt v2 §"Hard product constraints": "No … database (including IndexedDB…)" vs `AGENTS.md` 2026-10-10 exception, `src/db/database.ts` | Explicit user decision 2026-10-10 supersedes for client-side storage only — ADR-0003; remote-DB ban kept — ADR-0002 | RESOLVED |
| C-02 | Build prompt v2: base `/mobila-cutlist/` and "Do not modify … `furniture-builder`" vs `vite.config.ts` base `/furniture-builder/`, repo name, `docs/deployment.md` | The repository itself is the target; prompt references are stale — ADR-0001 | RESOLVED (prompt file not edited; historical) |
| C-03 | `docs/architecture.md` first paragraph: "Project editor controls localStorage autosave" vs its own §"IndexedDB/Dexie data layer" and `src/db` | Dexie is primary; sentence corrected 2026-10-21 | RESOLVED (TSK-012) |
| C-04 | `docs/modular-engine-backlog.md` B24 "54 ready" / README "54 working templates" vs `src/furniture/templates.ts` 54 `ready` + 2 `planned` | Code is state; docs need the current count and the rule from ADR-0021 | OPEN → TSK-012 |
| C-05 | `docs/licences.md` "(provisional)" vs STEP_00 pending | Audit outstanding | OPEN → TSK-011 |
| C-06 | `docs/progress.json` STEP_01/04/07–09/12 `implemented_unverified` vs later CI runs cited in `docs/handoff.md` (e.g. 38117222030, 39316987912) | Reconcile with run IDs per STEP; do not bulk-promote | OPEN → TSK-002 |
| C-07 | Supplier ABS-inclusive finished sizes vs exact cut sizes (`docs/architecture.md`) | Needs explicit user policy before any adapter — ADR-0010, ADR-0026 | OPEN → TSK-010 |
| C-08 | `src/import-export/excel.ts` references `SABLON DEBITARE NOU.xlsx` as required; file not in repo | Keep PENDING; add file (or redacted copy) with sha before mapping | OPEN → TSK-010 |
