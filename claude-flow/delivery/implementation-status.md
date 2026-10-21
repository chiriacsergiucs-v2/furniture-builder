# Implementation status (hand-written summary; tables are generated in backlog.json / milestones.md)

Code at the commit in `evidence/source-index.json`:

- **Engine, validation, exports, PWA, CI:** implemented; STEP_03/STEP_11 verified, other STEPs partially verified
  or `implemented_unverified` per `docs/progress.json` — reconciliation is TSK-002.
- **Storage:** Dexie v2, atomic migration, three backup formats; unit + E2E tests exist (`db.test.ts`, `migration.spec.ts`).
- **Modular engine:** B01–B21, B23, B28–B31 Done; B22 Partial (general editor); B24 Partial (55 ready + 2 planned
  templates in code; families incomplete per ADR-0021); B25 Dropped; B26/B27 Not done.
- **3D / Fusion:** positioned assemblies and Fusion Python export implemented; in-Fusion and real-device checks external.
- **Latest reported CI counts** (`docs/handoff.md`, not re-run here): 25 kernel / 67 Vitest / 12 Playwright.

Open drift: see `evidence/conflicts.md` C-03…C-06.
