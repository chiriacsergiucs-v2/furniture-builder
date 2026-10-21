# Scope

## In scope and implemented (evidence in `requirements/functional.md`)
Projects, materials, stock sheets/offcuts with trim and quantity, exact parts with grain/rotation/ABS, deterministic
guillotine heuristic with independent validation, SVG/print/CSV/XLSX outputs, Dexie IndexedDB with non-destructive
legacy migration and JSON backups, preset/kit/category library with revisions, typed modular furniture engine with
55 ready templates (2 planned), positioned 3D preview and assembly editor, Fusion Python snapshot, offline PWA on
GitHub Pages.

## In scope, partially implemented
- B22 general create/edit/save flow for every registered root (TSK-003).
- B24 18 families / 90 mechanisms — ready recipes ≠ complete families (ADR-0021; TSK-004/005 specify next roots).

## Deferred by decision
- B26 joinery/hardware-grade rules (blocked on physical validation, TSK-007).
- B27 photorealistic finishes.
- Vendor-specific Regency/SALICE adapters until originals are in the repo (ADR-0026, TSK-010).

## Out of scope by architecture
Remote database, backend, accounts, cloud sync, customer-data upload, remote AI, paid services, CDN assets
(ADR-0002, ADR-0027).

Sources: `README.md`, `docs/modular-engine-backlog.md` ledger, `AGENTS.md`.
