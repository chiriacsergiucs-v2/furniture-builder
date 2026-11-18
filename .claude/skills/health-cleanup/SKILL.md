---
name: health-cleanup
description: Find dead code (unused files, exports, dependencies, commented-out blocks, debug leftovers) with the dead-code-hunter agent, show the report, then remove only what the user approves with the dead-code-remover agent, verifying each round with the repo's checks. Use when the user says "health cleanup", "/health-cleanup", "dead code", "find unused code", or "clean up unused exports". Do not use when the user wants a refactor or restructuring (ask first, ADR-016).
---

# Dead-code health check

Follow `.claude/skills/health-bugs/loop.md` with:

- `FINDER`: `dead-code-hunter` · `FIXER`: `dead-code-remover`
- `REPORT`: `dead-code-report.md` · `CHANGES`: `dead-code-changes.json`
- `SCOPE`: `pnpm dlx knip --reporter json` (no knip config committed, knip not added to `package.json`; give it the entry
  points `src/main.tsx`, `tests/**`, `tools/**/*.mjs`, `scripts/**`, `vite.config.ts`, `supabase/functions/**`);
  commented-out code blocks; `console.log`/`debugger` leftovers.
- Extra rules: never remove an export used by `tests/`, `tools/` or `scripts/`; never remove a Dexie version, a migration
  or a reader of an old `schemaVersion` (ADR-011, ADR-012); removed UI text deletes its translation entries (_Language_);
  no `knip --fix` across the repo — the remover deletes item by item.
