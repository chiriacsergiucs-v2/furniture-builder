# Health loop (shared by the five `health-*` skills)

Adapted from the inline health workflows of the MIT-licensed `maslennikov-ig/claude-code-orchestrator-kit`, for this
repo. You are the orchestrator: you run these phases yourself and use the Agent tool only for the two workers the calling
skill names (a **finder** and a **fixer**). Beads (`bd`), Gastown, Context7 and the kit's helper skills
(`setup-knip`, `run-quality-gate`, `validate-report-file`, `rollback-changes`, …) are not installed here; skip any step of
an agent that needs them.

The calling skill gives: `FINDER`, `FIXER`, `REPORT` (file name), `CHANGES` (file name), `SCOPE` (what to look for) and
any extra rules.

## Rules for every phase

- CLAUDE.md wins over the agent files. Pass the hard rules that matter to each worker prompt: offline core and network
  boundary (ADR-002, ADR-126, ADR-239), integer millimetres (ADR-003), no geometry in UI code (ADR-004), never hide or
  soften an error diagnostic (ADR-008), never invent physical facts (ADR-010), never edit a shipped Dexie version and
  never delete or rewrite saved designs (ADR-012), the translation rule (_Language_), no refactors or polish unless the
  user asked (ADR-016), no new dependency with an unknown licence or telemetry.
- A finding whose fix needs an ADR (`src/core/types.ts`, the design document, the Dexie schema, the network boundary) is
  reported, never fixed by the loop: it goes to the gaps ledger.
- Reports and change logs live in `.tmp/current/` (git-ignored); never write them to the repo root.
- **Fixing waits for the user (user pick 2026-11-17).** After detection, stop and show the report; fix only the
  priorities the user approves.
- Claims need evidence: counts and pass/fail come from tool results in this session.

## Phase 1 — Pre-flight

1. `mkdir -p .tmp/current/{changes,backups}`
2. Run the quality gate (below). If it fails before any fix, report it and stop: the loop never starts from red.
3. Create one task per phase with the task tools.

## Phase 2 — Detect

Invoke `FINDER` with: the `SCOPE`, the hard rules above, "Write the report to `.tmp/current/REPORT`, grouping findings
by priority (critical, high, medium, low), each with file:line, the evidence and a proposed fix. Do not edit source
files. Return the count per priority."

Read the report yourself. Drop or downgrade findings that contradict CLAUDE.md or an implemented ADR
(`docs/adr-done/`), and say which and why. Zero findings → Phase 5.

## Phase 3 — Ask

Show the user the counts per priority and the top findings (file:line, one line each), then ask with the question tool
which priorities to fix (multi-select: critical, high, medium, low, none). Nothing is edited before the answer.

## Phase 4 — Fix by priority (approved priorities only, critical → low)

For each approved priority:

1. Invoke `FIXER`: "Read `.tmp/current/REPORT` and fix the PRIORITY findings only. Back up each file to
   `.tmp/current/backups/` before editing and log each change to `.tmp/current/changes/CHANGES`. Skip a finding whose fix
   needs an ADR or breaks a hard rule, and say why. Return fixed ids, skipped ids with reasons, and changed files."
2. Read every changed file (verify, never trust the summary). Check the translation rule for any changed UI text.
3. Run the quality gate. On failure, re-delegate once with the error; if it still fails, restore from
   `.tmp/current/backups/`, report and stop.

After the last approved priority, invoke `FINDER` once more in verification mode ("compare with the previous report:
fixed, remaining, new") — at most 3 detect-fix rounds in total.

## Phase 5 — Record and report

1. One row in `docs/backlog.md` for the run (`pnpm next-id` for the id), with the counts and the evidence you ran.
2. Each finding left unfixed (not approved, skipped, or needs an ADR) is recorded with `pnpm gaps add` and its G id
   cited.
3. Commit and push on the session branch (_Git_ in CLAUDE.md).
4. Reply in the repo shape (R4, **Decided**, **Skipped this iteration** with the G ids).

## Quality gate

```bash
pnpm typecheck
pnpm build
pnpm exec vitest related --run <changed files>   # after fixes only
pnpm format && pnpm format:check
pnpm docs:check
```

Fuzz after any geometry change: `FUZZ_N=30000 pnpm exec vitest run tests/fuzz.test.ts`.
