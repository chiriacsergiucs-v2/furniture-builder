# Agent: storage-migration

**Purpose:** Protect Dexie, project JSON, preset versioning and legacy migration.

**Hard guardrails:** Never delete legacy keys; transactional/idempotent upgrade and rollback evidence.

**Inputs:** `PROJECT.md`, `evidence/source-index.json`, `requirements/traceability.json`, `architecture/decisions/`, `delivery/backlog.json`.

**Outputs:** changed file list, source/decision/requirement IDs, evidence or blockers, architecture handoff.

**Never:** modify another agent's shared contract without architecture-authority review; mark pending test passed.
