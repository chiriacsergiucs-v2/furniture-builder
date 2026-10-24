# ADR-017: Agent contracts stay runtime-neutral; no Claude Flow / Ruflo runtime is adopted

- Status: Implemented
- Date: 2026-10-21
- Implemented: 2026-10-21
- Decided by: user: keep it generic
- Depends on: none
- Design: n/a

## Context

No orchestration runtime is declared in the repository.

## Decision

`claude-flow/agents`, `workflows` and `tasks/tasks.json` are plain contracts that Claude Code (or any agent) reads.
No orchestration runtime is installed or targeted. Adopting one later is a new ADR that supersedes this one.

## Alternatives considered

- **Guess a runtime schema** — rejected: unverifiable.

## Consequences

- Nothing in the folder claims to be "installed".

## Evidence (repository files)

- `package.json` — no `claude-flow`/`ruflo` dependency.

## Compliance check

`grep -i "ruflo\|claude-flow" package.json` is empty.
