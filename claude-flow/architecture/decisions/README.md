# Architecture Decision Records

Decisions for the **rebuilt** Furniture Builder (branch `rebuild/v1`, 2026-10-21). One decision per file. Each cites
repository files as evidence and ends with a check a reviewer can run. The pre-rebuild ADR set lives in git history.

| Status | Meaning |
|---|---|
| Accepted | Implemented or enforced; evidence points at the code that proves it. |
| Proposed | Recorded but not yet enforceable. |
| Superseded | Replaced; kept for lineage. |

New ADRs: copy any file's six sections, number sequentially, never renumber. Only `architecture-authority` accepts or supersedes.

## Foundation

| ID | Decision | Status |
|---|---|---|
| [ADR-0001](ADR-0001.md) | Rebuild from zero with a clean break from the previous app and its data | Accepted |
| [ADR-0002](ADR-0002.md) | Static offline PWA on GitHub Pages; no backend, accounts, cloud or remote services | Accepted |
| [ADR-0013](ADR-0013.md) | Stack: React 19, TypeScript strict, Vite 7, Zustand, react-three-fiber (lazy), Dexie | Accepted |

## Model

| ID | Decision | Status |
|---|---|---|
| [ADR-0003](ADR-0003.md) | Integer millimetres and one coordinate system everywhere | Accepted |
| [ADR-0004](ADR-0004.md) | Every part is an axis-aligned box; one FurnitureModel feeds every view and list | Accepted |
| [ADR-0005](ADR-0005.md) | Furniture is a recursive subdivision of spaces | Accepted |
| [ADR-0006](ADR-0006.md) | Full-overlay fronts with exact gap arithmetic | Accepted |
| [ADR-0007](ADR-0007.md) | Specialist product roots share the cabinet generator; a desk pedestal is a cabinet | Accepted |
| [ADR-0008](ADR-0008.md) | Problems are diagnostics, checked independently of the generators; errors block export | Accepted |

## Outputs

| ID | Decision | Status |
|---|---|---|
| [ADR-0009](ADR-0009.md) | Cut list lists finished sizes; banded edges are annotated, grain sets length | Accepted |
| [ADR-0010](ADR-0010.md) | Hardware is a schedule with labelled guidance, never invented specifications | Accepted |

## Data

| ID | Decision | Status |
|---|---|---|
| [ADR-0011](ADR-0011.md) | A design is a self-contained, validated JSON document | Accepted |
| [ADR-0012](ADR-0012.md) | Local persistence in IndexedDB with autosave; corrupt rows are skipped, never deleted | Accepted |

## Interface

| ID | Decision | Status |
|---|---|---|
| [ADR-0014](ADR-0014.md) | The front elevation is the editing surface; 3D is a non-authoritative preview | Accepted |

## Process

| ID | Decision | Status |
|---|---|---|
| [ADR-0015](ADR-0015.md) | Verification: pure-core unit tests plus seeded fuzz invariants; screenshots for UI; no E2E suite by default | Accepted |
| [ADR-0016](ADR-0016.md) | Process: smallest slice, evidence-only status, explicit "Skipped this iteration" | Accepted |
| [ADR-0017](ADR-0017.md) | Agent contracts stay runtime-neutral until a Claude Flow / Ruflo version is pinned | Proposed |
