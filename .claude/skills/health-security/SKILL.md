---
name: health-security
description: Scan the codebase for security and privacy problems with the security-scanner agent, show the report, then fix only the priorities the user approves with the vulnerability-fixer agent, verifying each round with the repo's checks. Use when the user says "health security", "/health-security", "security health check", or "scan and fix vulnerabilities". Do not use when reviewing one change or area read-only (use security-review).
---

# Security health check

Follow `.claude/skills/health-bugs/loop.md` with:

- `FINDER`: `security-scanner` · `FIXER`: `vulnerability-fixer`
- `REPORT`: `security-scan-report.md` · `CHANGES`: `vulnerability-changes.json`
- `SCOPE`: the threat model in `.claude/skills/security-review/SKILL.md` (pass its path to the scanner): untrusted design,
  project, picture and CSV files; user text rendered as HTML (`dangerouslySetInnerHTML`, `innerHTML`); formula injection in
  exported CSV; any request outside `src/online` or to an origin not in `src/online/origins.ts`; static imports of
  `src/online`; the service worker's caching; secrets or keys in the repo; `supabase/functions` input validation and
  `supabase/migrations` RLS policies; `pnpm audit` findings.
- Extra rules: a fix that touches the network boundary or `src/online/origins.ts` needs an ADR (ADR-002) — record it as a
  gap, never fix it in the loop. Never commit a secret to a report; name the file and line only.
