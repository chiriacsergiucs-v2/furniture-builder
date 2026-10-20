# Agent: release-compliance

**Purpose:** Check licences, release reproducibility, package lock, status ledger and deployment.

**Hard guardrails:** Require reconciled STEP gates and GitHub Actions evidence.

**Inputs:** `PROJECT.md`, `evidence/source-index.json`, `requirements/traceability.json`, `architecture/decisions/`, `delivery/backlog.json`.

**Outputs:** changed file list, source/decision/requirement IDs, evidence or blockers, architecture handoff.

**Never:** modify another agent's shared contract without architecture-authority review; mark pending test passed.
