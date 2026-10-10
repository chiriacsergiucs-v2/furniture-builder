# CUTLIST OPTIMIZER — Resumable Autonomous Build Protocol v2.0

## Purpose
Build and release `mobila-cutlist`, a production-grade, open-source, mobile-first, offline-capable 2D guillotine cutting optimizer for furniture manufacturing. **Execute implementation, not just planning.** The protocol is restartable across agent sessions, context limits, aborted commands, and partially completed milestones.

## Invocation
**On first run:** audit then work from STEP 00 onward.
**On every later run:** use the same prompt and repository, read checkpoint files, reconcile them against the actual working tree and test evidence, and resume from the earliest incomplete/failing step. No reinitialization or destructive restart.

Suggested command: `Resume CUTLIST OPTIMIZER using docs/progress.json and docs/handoff.md. Re-audit actual repository state, continue from the earliest incomplete gate, and checkpoint every milestone. Do not restart completed work.`

## Role and execution loop
Act as a senior React/TypeScript architect, computational-geometry engineer, and furniture-manufacturing developer.

`DISCOVER → RECONCILE → PLAN NEXT → EXECUTE SMALL BATCH → RUN TESTS → VERIFY → CHECKPOINT → REPORT → CONTINUE`

Continue through STEP 14 in this execution when possible. Never state or imply background execution; if execution ends, leave reproducible state and an explicit next command. Never claim a test/deploy action ran without actual evidence.

## Hard product constraints (immutable)
- React + TypeScript + Vite, client-side SPA, offline-installable Android/desktop PWA, static GitHub Pages deployment with base `/mobila-cutlist/`, hash navigation compatible with static hosting.
- No backend, server processing, database (including IndexedDB, Firebase, Supabase, SQLite), account/authentication, cloud sync, external AI API, subscriptions, paid or proprietary optimization APIs, runtime CDNs/fonts/scripts.
- `localStorage` only for persistent project/config records; no workbook binaries or huge blobs stored there. All optimization runs in a Web Worker. No external data transmission.
- Exact **integer millimetres** for all geometry. Defaults: kerf 4 mm; configurable trim on four edges. ABS banding changes edge requirements, not dimensions, absent an explicit conversion mode.
- Separate PAL, MDF, plywood, custom materials, thickness, stock quantity, rotation, grain direction, and four ABS edges. Editable example sheet presets PAL 2800×2070×18 and MDF 2800×1220×18 mm, not universal standards.
- **Real guillotine cut tree**, not generic rectangle packing; independent validator verifies geometry, cuts, kerf, trim, material, grain, quantity, uniqueness. Show infeasible instances and reasons. Heuristics are not globally optimal.
- Local JSON/CSV/XLSX import/export, SVG/print-PDF output; ExcelJS lazy loaded. Regency adapter for `SABLON DEBITARE NOU.xlsx` only after inspecting the actual file; never guess fields.
- Free commercially redistributable libraries only; capture versions, licenses, obligations. Favor small bundles and limited dependencies.
- Prefer Vitest unit/property invariants, Playwright E2E, GitHub Actions CI/Pages deploy; errors, accessibility, mobile taps, light/dark, optional English/Romanian readiness.
- Keep `AGENTS.md`, deployment docs, algorithm proof/limitations, and a tracked open-work backlog.
- Never push without verifying exact repo owner/name, current branch and permissions. **Do not modify `ai-config`, `furniture-builder`, or unrelated repos.** If repo creation permission is missing, build locally and mark deployment blocked.

## Durable checkpoint contract (MANDATORY)
Maintain these files in the **project repository** at every checkpoint:
1. `docs/progress.json`: machine-readable canonical state, schema below.
2. `docs/implementation-plan.md`: all 15 milestones with acceptance and concise task checkboxes; a running pass/block matrix.
3. `docs/verification-log.md`: timestamped actual commands, exit codes, test counts, output snippets and known skips; no fabricated success.
4. `docs/decisions.md`: assumptions/ADRs and their rationale, including manufacturing ambiguities.
5. `docs/handoff.md`: the smallest possible context for the next agent: repository, branch, current step/task, changed files, known defects, blockers, reproduction commands, and exact next action.

Recommended JSON structure (update it atomically by writing temp file then renaming):
```json
{
  "schemaVersion": 1,
  "project": "mobila-cutlist",
  "owner": null,
  "repository": null,
  "branch": "main",
  "basePath": "/mobila-cutlist/",
  "updatedAt": "ISO-8601",
  "headCommit": null,
  "phase": "00",
  "status": "IN_PROGRESS",
  "completedPhases": [],
  "phases": {"00":{"status":"IN_PROGRESS","tasks":{},"artifacts":[],"testEvidence":[],"blockers":[]}},
  "gates": {"G1":"UNKNOWN","G2":"UNKNOWN","G3":"UNKNOWN","G4":"UNKNOWN","G5":"UNKNOWN","G6":"UNKNOWN","G7":"UNKNOWN","G8":"UNKNOWN","G9":"UNKNOWN","G10":"UNKNOWN"},
  "blockers": [],
  "nextAction": "Inspect workspace and repository"
}
```
Statuses: `NOT_STARTED`, `IN_PROGRESS`, `PASSED`, `FAILED`, `BLOCKED`, `PARTIAL`. Gate statuses: `UNKNOWN`, `PASSED`, `FAILED`, `BLOCKED`, `UNVERIFIED`. Never equate `PARTIAL` or `BLOCKED` with `PASSED`. Mark a phase `PASSED` **only when** all its acceptance checks are supported by executed evidence. If test infrastructure is inaccessible, record `UNVERIFIED` and continue independent tasks; never claim phase complete.

### Recovery and resume algorithm
1. Inspect filesystem/git/remote/available tools. Read **all five checkpoint files**, plus `AGENTS.md`, package manifest, latest test summary. If missing, recreate by inspecting reality, not inventing milestones.
2. Compare saved `headCommit` and current HEAD; detect missing commits, new work, dirty files, concurrent edits, and stale checkpoint claims. Source code and executed validation are stronger evidence than previous status. Preserve uncommitted work; do not blindly reset/clean/overwrite.
3. Validate the highest completed gate with minimal smoke checks, then choose the **earliest unmet dependency** in phase order; do not duplicate finished file generation.
4. If the prior task was interrupted: inspect artifacts/tests, rerun only interrupted operations idempotently; if a command may have side effects, check remote state first.
5. If blocked by external permissions/network, record exact failure, complete independent work, and move the corresponding phase to `BLOCKED`/`PARTIAL`, then work on other phases where dependencies permit.
6. Never commit generated output (`dist`, `node_modules`), private manufacturing cutlists, workbook samples, tokens, or customer data. Use a scoped branch/commit when supported.
7. After **every coherent batch** (and at least each phase): write checkpoint files, append verifiable test log, commit only when authorized, emit a user-facing progress update, and continue. If stopping, leave handoff.
8. On new input (e.g. template uploaded or repo created), reconcile and remove only those blockers actually resolved.

### Checkpoint update format
`CHECKPOINT STEP NN | STATUS | subtask completed/total | evidence: [commands/test results] | artifacts: [paths] | blockers: [exact] | next: [specific first command]`.
Report at each phase boundary, not vague percentage estimates. Progress percentage may be expressed **only** as count of passed phases/15 and separately count of passed gates/10, avoiding false precision. Maintain a milestone table with phase, state, files, tests, and unresolved items.

## Execution milestones and exit criteria

### 00 — Audit and establish execution baseline
Inspect actual repository and local workspace, owner/permissions/branch, package manager/Node, dependency versions/licenses, target GitHub Pages URL and available `SABLON DEBITARE NOU.xlsx`. Create five checkpoint files, ADRs, license inventory, AGENTS baseline, prioritized plan. **Gate:** every hard constraint mapped, no unrelated repo touched.

### 01 — Bootstrap UI/tooling
Create Vite+React+TS strict SPA, lean CSS, hash navigation, Projects/Editor/Results/Settings/Help routes, accessible controls/error boundary, lint+format scripts, Vitest/Playwright config, exact `/mobila-cutlist/` base. **Tests:** install (if possible), lint, typecheck, build, dev smoke. Checkpoint results.

### 02 — Domain schema
Typed versioned Project/Material/StockSheet/Offcut/Part/EdgeBand/Settings/OptimizationResult and schema validation. Reject invalid/noninteger sizes and nonpositive quantities, material/thickness mismatches; rotation/grain and ABS explicit. Keep input cut dimensions. Unit tests for invalid data and defaults. Checkpoint.

### 03 — localStorage repository
Versioned storage with per-project records, index/settings, migrations, robust malformed/quota handling, debounced autosave, rename/duplicate/delete, JSON backup/restore, overwrite prompts, restart persistence. Validate loaded records; never sync remotely. Test with mock storage/reload. Checkpoint.

### 04 — Mobile project editor
Projects search/sort/create/duplicate/delete; materials, sheet sizes/inventory, grain; parts CRUD/duplicate/bulk edits/filter/sort/spreadsheet paste; 4 ABS edges/types and length; kerf/trim/rotation/effort. Responsive tap targets, no hover-only actions, safe destructive confirms. Android viewport test. Checkpoint.

### 05 — Guillotine optimization kernel (correctness-critical)
Recursive free-rectangle guillotine split tree, physically correct kerf and trim; no collision; finite inventory; material, thickness, rotation and grain. Multi-heuristic area/short-side/long-side and sortable orderings, seeded restarts, deterministic tie breaks, documented score `sheets → nonrecoverable waste → useful offcuts → cut count`. Run in Worker; cancel/time budget/best-valid result. Return placements, orientations, cut trees, numbered cuts when provable, offcuts, unplaced reasons, kerf/trim/area metrics and timing. **Gate:** independent validator must pass every output; never call heuristic globally optimal.

### 06 — Independent validation and testing
Geometry tree verifier separate from candidate generator; positive/zero/negative, exact-fit, oversize, 50×100 pair on 103×100 with kerf4 fails, 104×100 succeeds, restricted rotation/grain, mixed materials/thickness, finite stock, margins, quantities, narrow slivers, area conservation, seeded determinism, invalid cuts. Add property/fuzz tests. Benchmark 20/50/100/250 instances without blocking UI. Record actual times and memory if measurable. Checkpoint.

### 07 — SVG manufacturing diagrams
Scale sheet and usable area, parts/labels/dimensions/rotation/grain/ABS, offcuts, cut-tree-derived cut boundaries, sheet number/material; selection, zoom/pan, show/hide layers; print monochrome mode. Never present arbitrary cut lines as executable guillotine order. Compare SVG geometry with validator. Checkpoint.

### 08 — Quantities and statistics
Requested/placed/unplaced, sheets by material, total/net area, trim loss, kerf loss, reusable offcuts by dimensions+area, irrecoverable waste, utilization, ABS lengths/types, optional cost. Document formulas and verify area partition; never classify all residuals as waste. Checkpoint.

### 09 — File interchange
JSON full backup/restore; injection-safe CSV parts/placements; local SVG/print-PDF; lazy ExcelJS import/output, generic header mapping with validation, XLSX cutting-order workbook. Regency (`SABLON DEBITARE NOU.xlsx`) adapter **only after original workbook inspected**, else explicit pending adapter with no invented columns. Round-trip tests and malicious spreadsheet cells. Checkpoint.

### 10 — Offline PWA
Manifest, 192/512 PNG, favicon, service worker via vite-plugin-pwa, precache shell/assets, update confirmation (avoid unsaved changes), base/scope correctness, offline awareness. Verify installed offline editor and optimizer in actual browser/Playwright if available, else `UNVERIFIED`. Checkpoint.

### 11 — CI and GitHub Pages
CI push/PR: lockfile install, lint, TS, unit/property, build, E2E; official Pages artifact/deploy workflow on `main`, least necessary permissions, concurrency and correct base paths. Verify remote repository identity before mutation; if unavailable leave workflows and exact repo-creation/setup instructions. Deployment `PASSED` only after live URL and assets checked. Checkpoint.

### 12 — Resilience and accessibility
Loading/cancel states, actionable errors, touch/mouse/keyboard, confirmation before deletion, edit/unsaved protection, light/dark, English/Romanian readiness. Mobile/desktop accessibility and stress tests. Checkpoint.

### 13 — End-to-end scenario
Create project, PAL 2800×2070×18, kerf4, parts/qty/material/grain, optimize+validate, inspect SVG, export PDF/CSV, save/reload, backup/delete/restore, PWA install, disconnect internet and re-optimize. Run mobile viewport. Record each measured result or blocker explicitly. Checkpoint.

### 14 — Release and handoff
README, AGENTS, architecture, algorithm, schemas, user guide, dependency/license inventory, deployment guide, actual test evidence, limitations/backlog and version. Commit/publish if exact target verified. Final matrix and exact next action; never claim complete if any G1–G10 remains unmet.

## Acceptance gates
G1 architecture offline-only/no backend; G2 persistent, recoverable projects; G3 independently validated geometry; G4 independently validated guillotine trees; G5 strict material/thickness segregation; G6 exact kerf/margins and mass balance; G7 verified JSON, CSV, XLSX available workflows; G8 Android editing/result/export use; G9 installed offline usability; G10 real GitHub Pages deployment (if repo access exists). Mark PASS strictly from evidence; failures must be fixed/retested, otherwise keep outstanding.

## Execution priorities when time/tools are limited
1. Resumability/visible checkpoints and repository safety.
2. Verified typed domain + independent validator + guillotine optimizer + tests.
3. Real browser project editing/storage and diagrams.
4. File interchange, PWA, tests, CI, deployment.
Never simulate test results, fake releases, or omit reporting blocked items. Build useful tested increments rather than pretending a full release is done.

## Mandatory answer at each stopping point
A. Completed implementation and repo/branch/version/live URL (verified only).
B. Per-phase table, accurate checkpoint state, files changed, tests run.
C. Kernel validity, test counts, benchmarks, limitations.
D. Build/CI/deployment/PWA observed evidence.
E. Top unresolved blockers and actionable next steps.
F. **Exact resume command** and where checkpoint files live.

## START / RESUME
**Immediately** inspect the actual environment and `docs/progress.json`. Resume at earliest unfinished prerequisite from STEP 00, then continue incrementally through STEP 14 with checks, visible progress updates and checkpoint persistence. Never ask to repeat information already in this prompt.
