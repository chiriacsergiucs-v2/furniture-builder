# claude-flow/ — project knowledge and agent operating contracts for Mobila

Rebuilt **2026-10-21** from the repository only (code, `docs/`, `AGENTS.md`, workflows). Every statement cites a
repository path; CI results quoted from docs are labelled *reported*. No prior research report, chat memory or
non-committed upload is a source.

## Start here
1. `PROJECT.md` — baseline and state.
2. `memory/project-context.md` + `memory/decision-guardrails.json` — read every session.
3. `architecture/decisions/README.md` — 30 ADRs (29 Accepted, 1 Proposed), one decision each.
4. `agents/` — nine role contracts with owned paths, commands, gates and never-do rules.
5. `workflows/` — `implementation.md`, `change-control.md`, `release.md`.
6. `tasks/README.md` → `tasks/tasks.json` — what is READY.
7. `evidence/` — source index with blob shas, conflicts, unknowns.

## Layout
```
claude-flow/
├── PROJECT.md  README.md  manifest.json
├── architecture/   overview, modules, data-model, integrations, security, decisions/ADR-00NN.md
├── agents/         architecture-authority, storage-migration, optimisation-engineer, furniture-domain,
│                   furniture-ui, requirements-analyst, verifier, release-compliance, orchestration-compatibility
├── workflows/      implementation, change-control, release
├── tasks/          README, tasks.json (TSK-001…015)
├── memory/         project-context.md, decision-guardrails.json
├── requirements/   functional (FR), non-functional (NFR), acceptance-criteria, traceability.json, specs/
├── product/        vision, scope, features, business-rules, personas, user-journeys, roadmap
├── delivery/       GENERATED mirrors of the repo ledgers (backlog.json, milestones.md) + dependencies, status
├── evidence/       source-index.json, conflicts.md, unknowns.md
├── validation/     GENERATED reports
└── scripts/        validate.py (--sync regenerates delivery/, validation/, traceability, manifest)
```

## Rules of the folder
- Runtime-neutral until a Claude Flow / Ruflo version is pinned (ADR-0030, TSK-001). Nothing here is "installed".
- `delivery/*.json|md`, `validation/*`, `requirements/traceability.json`, `manifest.json` are generated —
  edit the repo ledgers or the source files, then run `python3 -I claude-flow/scripts/validate.py --sync`.
- IDs (ADR-, FR-, NFR-, MOD-, FEAT-, TSK-, B, STEP_) are never renumbered or reused.
- Missing fact ⇒ BLOCKED/UNKNOWN in `evidence/unknowns.md`; never inferred.
