# Known conflicts and reconciliations

1. **LocalStorage vs Dexie:** opening `docs/architecture.md` remains stale; current explicit AGENTS decision makes Dexie authoritative. Historical wording remains documented.
2. **Old repo/base URL:** historical `/mobila-cutlist/` versus current `/furniture-builder/`; current `docs/progress.json` and README govern.
3. **Semantic versions:** package `0.3.0-dev` versus newer product milestones in handoff; not equivalent to release state.
4. **B24 counting:** number of recipes is not proof that full 18-family/90-construction initiative is complete.
5. **SALICE format:** supplier says **final dimensions including ABS**; app says edge annotations do not change exact cut size. These need explicit mathematical adapter policy, not automatic reinterpretation.
6. **XLSX availability:** prior Deep Research said workbook inaccessible; four `SABLON DEBITARE NOU` files actually exist here. The distinct missing *Regency* template in repository is still not proven available.
7. **CI/STEP discrepancy:** newer release tests versus original pending STEP_13 and STEP_14. Reconcile gate by gate.
