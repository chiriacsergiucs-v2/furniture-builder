# Architecture Decision Records

One decision per file, MADR-style. Every ADR cites repository files (`src/`, `docs/`, `AGENTS.md`, workflows) as
evidence; nothing here rests on a prior research report or on uploads that are not in the repository.

## Status semantics

| Status | Meaning |
|---|---|
| **Accepted** | Decision is implemented or enforced in the repository; evidence section points at the code/doc that proves it. |
| **Proposed** | Decision is recorded but not yet enforceable (missing prerequisite). Cannot be cited as a hard guard. |
| **Superseded** | Replaced by a later ADR named in the header; kept for lineage. |
| **Deprecated** | No longer applies and nothing replaces it. |

Authority order when ADRs conflict with other inputs is in `../../memory/decision-guardrails.json`.

## Writing a new ADR

1. Copy the header table and six sections from any existing file (Context, Decision, Alternatives considered,
   Consequences, Evidence, Compliance check).
2. Number sequentially; never reuse or renumber.
3. Only `architecture-authority` creates or supersedes an ADR; other roles propose via `workflows/change-control.md`.
4. "Evidence" must list concrete paths. "Compliance check" must be something a verifier can run or grep.

## Index

### Platform and boundaries
| ID | Title | Status |
|---|---|---|
| [ADR-0001](ADR-0001.md) | Static client-only PWA hosted on GitHub Pages | Accepted |
| [ADR-0002](ADR-0002.md) | No backend, accounts, cloud sync, remote AI or runtime external API | Accepted |
| [ADR-0027](ADR-0027.md) | Heavy optional modules are code-split and lazy-loaded; no CDN | Accepted |

### Persistence and data safety
| ID | Title | Status |
|---|---|---|
| [ADR-0003](ADR-0003.md) | Dexie IndexedDB is the primary client-side store (supersedes localStorage-only) | Accepted |
| [ADR-0004](ADR-0004.md) | Legacy localStorage migration is atomic, idempotent and non-destructive | Accepted |
| [ADR-0005](ADR-0005.md) | Versioned Dexie schema that retains every historical version declaration | Accepted |
| [ADR-0006](ADR-0006.md) | Backward-compatible JSON backups plus complete database export/import | Accepted |
| [ADR-0022](ADR-0022.md) | Legacy component trees are reconstructed read-only in memory | Accepted |
| [ADR-0023](ADR-0023.md) | Preset source pins, explicit-Save revisions, copy-on-write inserts | Accepted |

### Manufacturing semantics and optimiser
| ID | Title | Status |
|---|---|---|
| [ADR-0007](ADR-0007.md) | All manufacturing dimensions are validated integer millimetres | Accepted |
| [ADR-0008](ADR-0008.md) | Kerf is a full-length destroyed stripe; sub-kerf residuals rejected | Accepted |
| [ADR-0009](ADR-0009.md) | Grain, rotation permission, stock quantity and trim constrain every placement | Accepted |
| [ADR-0010](ADR-0010.md) | Edge banding (ABS) is an annotation, not a dimensional allowance | Accepted |
| [ADR-0011](ADR-0011.md) | Deterministic seeded heuristic with lexicographic objective; never "optimal" | Accepted |
| [ADR-0012](ADR-0012.md) | Independent validator gates every result | Accepted |
| [ADR-0013](ADR-0013.md) | Optimiser runs in a Web Worker | Accepted |
| [ADR-0014](ADR-0014.md) | Guillotine cut tree is the canonical layout; SVG/CSV derived from it | Accepted |
| [ADR-0026](ADR-0026.md) | Vendor workbook adapters only from an inspected original file | Accepted |

### Modular furniture engine
| ID | Title | Status |
|---|---|---|
| [ADR-0015](ADR-0015.md) | Typed, versioned component registry; generators never persisted | Accepted |
| [ADR-0016](ADR-0016.md) | Component-instance tree with stable IDs, slots and one-way binding | Accepted |
| [ADR-0017](ADR-0017.md) | Specialist structural roots per family | Accepted |
| [ADR-0018](ADR-0018.md) | One normalised FurnitureModel for 3D, cutlist, BOM and Fusion | Accepted |
| [ADR-0019](ADR-0019.md) | Hardware is a requirement schedule, never cut panels | Accepted |
| [ADR-0020](ADR-0020.md) | Only `ready` templates generate parts | Accepted |
| [ADR-0021](ADR-0021.md) | Template readiness is not family completion | Accepted |

### 3D and CAD outputs
| ID | Title | Status |
|---|---|---|
| [ADR-0024](ADR-0024.md) | 3D views are non-authoritative; 3D drag never changes cut data | Accepted |
| [ADR-0025](ADR-0025.md) | Fusion export is a Python direct-model script; in-Fusion execution unverified | Accepted |

### Process and orchestration
| ID | Title | Status |
|---|---|---|
| [ADR-0028](ADR-0028.md) | Pre-MVP smallest vertical slice; lightweight verification | Accepted |
| [ADR-0029](ADR-0029.md) | Evidence-only ledger status; full verification sequence is the release gate | Accepted |
| [ADR-0030](ADR-0030.md) | Orchestration contracts are runtime-neutral until a Claude Flow version is pinned | Proposed |

## Lineage

- ADR-0003 supersedes the original build prompt clause "no database / all data in localStorage" for client-side storage only; ADR-0002 keeps the no-remote-database rule.
- ADR-0030 will be re-issued as Accepted when TSK-001 records a pinned runtime version.
