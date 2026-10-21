# Project baseline — Mobila Cutlist Optimizer

**Repository:** `chiriacsergiucs-v2/furniture-builder` · package `mobila-cutlist` `0.3.0-dev` · MIT · Pages base `/furniture-builder/`
**Stack:** React 19, TypeScript 5.9, Vite 7, vite-plugin-pwa, Dexie 4.2.1, three 0.186 + @react-three/fiber 9.8, dnd-kit, ExcelJS 4.4; Vitest, Playwright, Node 22 kernel tests; GitHub Actions `ci.yml` / `deploy.yml` / `lockfile.yml`.

**What it is:** an offline, phone-first furniture panel cutting optimiser with an exact guillotine engine and an
independent validator, a Dexie-backed preset/kit library, a typed modular furniture engine (55 ready templates),
positioned 3D previews and a Fusion 360 Python snapshot. No backend, accounts or cloud.

**State (code at the commit in `evidence/source-index.json`):** engine, storage, migration, backups, component
engine B01–B21/B23/B28–B31 Done; B22 and B24 Partial; B25 Dropped; B26/B27 Not done. STEP ledger: STEP_03 and
STEP_11 verified, several `implemented_unverified`, STEP_13/14 pending. CI/Pages runs cited in `docs/handoff.md`
are **reported**, not re-executed by this folder.

**Authority order:** explicit user decision › Accepted ADR consensus › ADR/spec › code+tests on main › history › proposal
(`memory/decision-guardrails.json`). Code is evidence of state, not permission to overrule intent.

**Where to look:** decisions → `architecture/decisions/README.md`; who does what → `agents/`; how work runs →
`workflows/`; what to do next → `tasks/README.md`; what is unknown → `evidence/unknowns.md`.
