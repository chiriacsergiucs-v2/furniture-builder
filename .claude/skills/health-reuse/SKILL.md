---
name: health-reuse
description: Find duplicated types, constants and helper functions with the reuse-hunter agent, show the report, then consolidate only what the user approves with the reuse-fixer agent, verifying each round with the repo's checks. Use when the user says "health reuse", "/health-reuse", "find duplicates", "duplicated code", or "single source of truth". Do not use when the user wants a broader refactor (ask first, ADR-016).
---

# Duplication health check

Follow `.claude/skills/health-bugs/loop.md` with:

- `FINDER`: `reuse-hunter` · `FIXER`: `reuse-fixer`
- `REPORT`: `reuse-hunting-report.md` · `CHANGES`: `reuse-changes.json`
- `SCOPE`: duplicated types, constants, translation keys and helper functions across `src/`, `tests/`, `tools/` and
  `supabase/functions`.
- Extra rules: the layer boundaries decide where a shared copy lives (`docs/architecture.md`): `src/core` imports
  nothing from React, three or Dexie; `src/shared` imports nothing from the app (ADR-219); `src/online` is imported only
  dynamically (ADR-126). A duplicate that crosses a boundary stays duplicated and is reported. Judge duplicates segment
  by segment and check each difference against the code before calling it intentional (_Process_ › Skips and proof).
