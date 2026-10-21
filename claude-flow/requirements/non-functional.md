# Non-functional requirements

Constraints the whole codebase must satisfy. NFR-014–016 added in the 2026-10-21 rebuild.

| ID | Requirement | Evidence (repo path) | ADR |
|---|---|---|---|
| NFR-001 | No backend, accounts, remote sync or runtime cloud/AI APIs | `AGENTS.md, docs/architecture.md` | ADR-0002 |
| NFR-002 | Exact integer millimetres and stable geometric constraints | `src/engine/schema.ts (integer)` | ADR-0007 |
| NFR-003 | Never claim globally optimal packing | `docs/algorithm.md` | ADR-0011 |
| NFR-004 | Fail closed when a result violates validator invariants | `src/engine/validate.ts` | ADR-0012 |
| NFR-005 | Legacy data is never deleted during migration | `src/db/migration.ts` | ADR-0004 |
| NFR-006 | Migration is atomic and idempotent | `src/db/migration.ts` | ADR-0004 |
| NFR-007 | Backward-compatible JSON backups across schema changes | `src/db/backup.ts` | ADR-0005, ADR-0006 |
| NFR-008 | Static PWA preserves core use offline | `vite.config.ts, src/tests/e2e/offline.spec.ts` | ADR-0001 |
| NFR-009 | Viewer degrades gracefully without WebGL | `src/components/Panel3DPreview.tsx` | ADR-0024 |
| NFR-010 | Touch and keyboard access for reorder controls | `src/components/PartOrderBoard.tsx` | ADR-0024 |
| NFR-011 | No release claims without executed CI and deploy evidence | `AGENTS.md, docs/progress.json` | ADR-0029 |
| NFR-012 | No fabricated joinery, fitting, drilling or structural certification | `src/furniture/furniture-model.ts comment` | ADR-0019 |
| NFR-013 | New templates reuse the typed component engine; no duplicate engines | `docs/modular-engine-backlog.md (B15 rule)` | ADR-0015 |
| NFR-014 | Heavy modules lazy-loaded; no CDN; all assets bundled | `src/import-export/excel.ts, docs/licences.md` | ADR-0027 |
| NFR-015 | Pre-MVP: smallest vertical slice, light verification, explicit skipped list | `AGENTS.md (2026-10-11)` | ADR-0028 |
| NFR-016 | Orchestration assets runtime-neutral until a version is pinned | `package.json (no runtime dependency)` | ADR-0030 |
