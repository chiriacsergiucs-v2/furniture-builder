# Project memory (read first, every session)

**Project:** Mobila Cutlist Optimizer — `chiriacsergiucs-v2/furniture-builder`, package `mobila-cutlist` 0.3.0-dev.
Offline static PWA (React 19, TS, Vite 7) on GitHub Pages at `/furniture-builder/`. No backend, accounts, cloud or
remote AI (ADR-0001/0002).

**Data:** Dexie IndexedDB `mobila-cutlist-build-kit` v2, seven tables; legacy localStorage keys are read-only
forever; migrations atomic + idempotent + missing-only; three JSON backup formats kept readable (ADR-0003–0006,
0022, 0023).

**Manufacturing truth:** integer mm; kerf is a full stripe; grain/rotation/quantity/trim enforced; ABS is an
annotation; heuristic seeded search, never "optimal"; an independent validator gates every result; the cut tree is
canonical (ADR-0007–0014).

**Furniture engine:** versioned component registry; stable-ID instance trees with one-way parent→child binding;
specialist roots (`core/carcass`, `core/surface`); one `FurnitureModel` feeds 3D/cutlist/BOM/Fusion; hardware is a
schedule; only `ready` templates generate parts; B24 stays Partial (ADR-0015–0021).

**Outputs:** 3D is non-authoritative; Fusion export is a Python script, unverified in Fusion (ADR-0024/0025).
Vendor adapters only from inspected originals; the Regency workbook is not in the repo (ADR-0026).

**Process:** smallest vertical slice, light verification, `Skipped this iteration` every time (ADR-0028);
B-/STEP-ledger status only with evidence; full sequence + Pages run = release (ADR-0029). Orchestration files are
runtime-neutral until a Claude Flow version is pinned (ADR-0030, TSK-001).

**Known drift to fix (TSK-012):** `templates.ts` = 54 ready + 2 planned, ledger says 54; `docs/architecture.md`
still mentions localStorage autosave; `docs/licences.md` provisional.

**Missing ⇒ BLOCKED/UNKNOWN, never invented:** physical loads, hardware part numbers, drilling, supplier column
mapping, ABS-inclusive policy, Fusion/Android runtime results, runtime version.
