# Modules

| ID | Module | Paths | Owning role | Key ADRs |
|---|---|---|---|---|
| MOD-001 | Project editor and inputs | `src/app`, `src/components/*Configurator.tsx` | furniture-ui | ADR-0023, ADR-0028 |
| MOD-002 | Optimisation engine | `src/engine/optimize.ts`, `guillotine.ts`, `geometry.ts`, `optimizer.worker.ts` | optimisation-engineer | ADR-0007–0011, ADR-0013 |
| MOD-003 | Independent validation | `src/engine/validate.ts`, `schema.ts` | verifier (+engineer) | ADR-0012 |
| MOD-004 | Cutting views and statistics | `src/components/CabinetPreview.tsx`, stats UI | furniture-ui | ADR-0014 |
| MOD-005 | Import/export | `src/import-export/*` | optimisation-engineer | ADR-0014, ADR-0026, ADR-0027 |
| MOD-006 | Dexie database, migration, backups | `src/db/*`, `src/storage/localStorage.ts` | storage-migration | ADR-0003–0006 |
| MOD-007 | Preset/kit library | `src/presets/*` | furniture-ui | ADR-0023 |
| MOD-008 | 3D viewer, assembly editor, reorder | `src/assembly/model.ts`, `starter.ts`, `src/components/*3D*.tsx`, `PartOrderBoard.tsx` | furniture-ui | ADR-0024, ADR-0027 |
| MOD-009 | Fusion exporter | `src/assembly/fusion.ts` | release-compliance | ADR-0025 |
| MOD-010 | Component/recipe engine | `src/furniture/component-engine.ts`, `templates.ts`, `cabinet.ts`, `drawer.ts`, `surface.ts` | furniture-domain | ADR-0015–0017, ADR-0020, ADR-0021 |
| MOD-011 | Manufacturing model, BOM, diagnostics | `src/furniture/furniture-model.ts`, `geometry-diagnostics.ts`, `legacy-adapter.ts` | furniture-domain | ADR-0018, ADR-0019, ADR-0022 |
| MOD-012 | PWA, CI, release | `vite.config.ts`, `.github/workflows/*`, `docs/deployment.md`, `docs/licences.md` | release-compliance | ADR-0001, ADR-0002, ADR-0029 |
