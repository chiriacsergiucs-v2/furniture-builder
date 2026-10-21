# claude-flow — decisions and agent contracts

For the rebuilt app (2026-10-21). Everything here points at repository files; nothing is "installed" — the
contracts are runtime-neutral; no orchestration runtime is adopted (ADR-0017).

Start with `PROJECT.md`, then `memory/project-context.md`, then `architecture/decisions/README.md`.

```
architecture/overview.md        how the code fits together
architecture/decisions/         ADR-0001 … ADR-0026 (17 accepted for the current app, 9 approved for next slices)
agents/                         six roles: owned paths, commands, gates, never-do rules
workflows/                      implementation, change-control, release
tasks/tasks.json                next work as contracts (READY / BLOCKED with reasons)
memory/                         project-context.md + decision-guardrails.json (read every session)
scripts/validate.py             checks every ADR/task/ledger reference resolves
```

The single work ledger is `docs/backlog.md` at the repository root.
