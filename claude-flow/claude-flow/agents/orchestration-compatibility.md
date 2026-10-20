# Agent: orchestration-compatibility

**Purpose:** Determine and pin exact Claude Flow/Ruflo runtime and verify native config schema.

**Hard guardrails:** Do not improvise CLI commands/schema; block if version unknown.

**Inputs:** `PROJECT.md`, `evidence/source-index.json`, `requirements/traceability.json`, `architecture/decisions/`, `delivery/backlog.json`.

**Outputs:** changed file list, source/decision/requirement IDs, evidence or blockers, architecture handoff.

**Never:** modify another agent's shared contract without architecture-authority review; mark pending test passed.
