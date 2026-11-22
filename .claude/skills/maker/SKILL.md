---
name: maker
description: Pick the right subagent(s) from .claude/agents/ for a task, write each one a full brief, run it, and verify its result in the main session. Use when the user says "maker", "/maker", "pick an agent for X", "delegate X to an agent" or "brief the agents". Do not use when the work is one file, a typo, a config line or a lookup (do it directly), or when a health-* skill already covers the task (use that skill).
---

# Maker — pick and brief subagents

Source: user request 2026-11-22 ("save it as a skill named maker"), compiled with APL from the _Orchestration_ rules in
CLAUDE.md. Test question and PR notice added on user request 2026-11-22 ("ask the user if tests are to be done, or
skipped and tell you when pr is open"). CLAUDE.md wins over this file and over any agent file.

## Objective

Pick the right subagent(s) from `.claude/agents/` for the task, write each one a full brief, run it, and verify its
result yourself. You are the orchestrator; the agent does the multi-file work.

Inputs:

- `<task>`: the user's request.
- `<mode>`: normal, `ff` or `auto` (the user's mode word for this request; normal when none).

## Context

Repo: `chiriacsergiucs-v2/furniture-builder`, a phone-first offline PWA (React 19, TypeScript strict, Zustand, three.js
lazy, Dexie, no backend except the opt-in `supabase/`). The agent files come from another stack
(`maslennikov-ig/claude-code-orchestrator-kit`).

## Agent map (pick by task; 26 agents)

- Bugs: `bug-hunter` (find) → `bug-fixer` (fix approved priorities), via the `health-bugs` skill
- Security: `security-scanner` → `vulnerability-fixer`, via `health-security`
- Dependencies: `dependency-auditor` → `dependency-updater`, via `health-deps`
- Dead code: `dead-code-hunter` → `dead-code-remover`, via `health-cleanup`
- Duplicates: `reuse-hunter` → `reuse-fixer`, via `health-reuse`
- Tests: `test-writer`
- UI quality: `accessibility-tester`; `mobile-responsiveness-tester` → `mobile-fixes-implementer`; `performance-optimizer`
- Review and diagnosis: `code-reviewer`; `problem-investigator`
- Types: `typescript-types-specialist`
- Docs: `technical-writer`
- CI/CD (GitHub Actions only): `deployment-engineer`
- Backend (`supabase/` only): `supabase-auditor`, `supabase-fixer`, `database-architect`
- Refactor (only when the user asked for one, ADR-016): `code-structure-refactorer`
- New agents or skills: `meta-agent-v3`, `skill-builder-v2`

Health pairs: run the hunter, show its report to the user, run the fixer only on the priorities the user approves.

## Procedure

1. Gather context: read the related code, search for the existing pattern, read the ADRs and `docs/backlog.md` rows
   that apply, check recent commits in the area.
2. Decide: if the work is one file, a typo, a config line or a lookup, do it yourself and use no agent. Otherwise pick
   from the map. If no agent fits, use `general-purpose`.
3. Brief each agent with:
   - exact file paths and the pattern to follow (file:line of an example)
   - the hard rules that apply: offline core, no network outside `src/online` (ADR-002, ADR-126); integer millimetres
     (ADR-003); geometry only from `buildModel()` (ADR-004); never invent hardware or physical facts (ADR-010);
     translation rule — every UI text through `t()`/`tr()`/`pt()` with its Russian (and for `pt()` English) entry in
     `packages/i18n`; no new dependency with an unknown licence or telemetry
   - skip any step naming a tool not in this repo (Beads, Gastown, Context7, Next.js, tRPC, `setup-knip`,
     `run-quality-gate`)
   - the exact output expected and the checks it must run
4. Run independent agents in parallel; run dependent ones in order.
5. Ask about tests (every request, once, before any check): one question with the interactive question tool, options
   "Run full checks and related tests (Recommended)", "Related tests only", "Skip tests". Record the answer under
   **Decided**. A skip is logged as debt per _Skips and proof_ in CLAUDE.md (blocker: user choice, cost S) and listed
   under **Skipped this iteration**. Typecheck, lint, format and build still run; only tests follow the answer.
6. Verify every delegation yourself: read the changed files and run, in the sandbox:

   ```
   pnpm typecheck
   pnpm lint
   pnpm format:check   # pnpm format fixes it
   pnpm exec vitest related --run <changed files>
   pnpm build
   pnpm docs:check
   ```

   After a geometry change also `FUZZ_N=30000 pnpm exec vitest run tests/fuzz.test.ts`. The full suite (`pnpm test`)
   runs in CI. Step 5's answer decides which tests run. In `ff` mode run only `pnpm typecheck`, `pnpm lint`, `pnpm build`, `pnpm format`, `pnpm docs:check`.

7. If the result is wrong, re-delegate once with the error; then fix it yourself or stop and report.
8. Track each step as a task; mark it done only after step 6 passes.
9. When the pull request is open, tell the user: put the PR link on the first line of the reply and send a
   `PushNotification` ("PR open: <title>"). Never claim it merged or deployed (pushed ≠ merged ≠ deployed).

## Stop conditions

Stop and tell the user; do not land: the change needs an ADR (`src/core/types.ts`, design document, Dexie schema,
network boundary); it deletes or rewrites saved designs; a physical fact is unknown; a check fails and the cause is not
yours to fix.

## Output

1. Plan: one line per agent — agent, why, files.
2. After the run: per agent — what changed (file paths), checks run with exit status, verdict (verified /
   re-delegated / fixed by you / stopped).

Never report an agent's summary as checked; only tool results you ran count (_General conduct_ 3).

Defaults (change if needed):

- Plan line format: `<agent> — <reason> — <files>`
- No agent fits → `general-purpose`
- Parallel limit: none beyond what the task needs

Done when every delegated change passes step 6 with tool output shown, or a stop condition is reported with what is
built and what is not.
