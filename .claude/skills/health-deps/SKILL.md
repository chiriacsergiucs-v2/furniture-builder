---
name: health-deps
description: Audit dependencies with the dependency-auditor agent (vulnerabilities, outdated and unused packages, licences), show the report, then update only what the user approves with the dependency-updater agent, one package at a time with the repo's checks after each. Use when the user says "health deps", "/health-deps", "dependency health check", "update dependencies", or "audit packages". Do not use when adding one new dependency for a feature (use build).
---

# Dependency health check

Follow `.claude/skills/health-bugs/loop.md` with:

- `FINDER`: `dependency-auditor` · `FIXER`: `dependency-updater`
- `REPORT`: `dependency-report.md` · `CHANGES`: `dependency-changes.json`
- `SCOPE`: `pnpm audit`; `pnpm outdated`; unused packages (`pnpm dlx knip --dependencies --reporter json`, no config file
  committed and knip not added to `package.json`); each package's licence and whether it sends telemetry.
- Extra rules:
  - One package per fixer step; `pnpm install` keeps `pnpm-lock.yaml` committed; the quality gate runs after each.
  - The stack is fixed (CLAUDE.md _Stack_): no major upgrade of React, TypeScript, Vite, Zustand, three, Dexie,
    vite-plugin-pwa, Node or pnpm without the user's explicit yes in Phase 3, naming the package and versions.
  - Never add a package with an unknown licence or telemetry. A Dexie upgrade also reads ADR-012.
