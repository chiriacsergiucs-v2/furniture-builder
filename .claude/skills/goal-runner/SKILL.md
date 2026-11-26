---
name: goal-runner
description: Drive a goal file (goals/<name>.md) to verified completion — run its checks, brief the fix agents on every failure, verify their work yourself, loop up to the limit, and write a report with evidence. Use when the user says "goal-runner goals/<name>.md", "run the goal", "drive this to verified completion" or points at a goal file. Do not use when the work is one file, a typo or a lookup (do it directly), when there is no goal file yet and the user did not ask for one, or when a health-* skill already covers the task.
---

# Goal runner — drive a goal file to verified completion

Source: user request 2026-11-26 ("Create a reusable goal runner that drives this task, and later tasks, to verified
completion"). Built on the _Orchestration_ rules, _General conduct_ 3 and _Skips and proof_ in `CLAUDE.md`, and the
`maker` skill. CLAUDE.md wins over this file and over any agent file.

## Input

`goals/<name>.md`, written by the user or by you at their request. Format (no front matter):

```markdown
# Goal: <title>

## Context

Why the goal exists, the files involved, the hard rules that apply.

## Agents

| Step      | Agent         | Why                              |
| --------- | ------------- | -------------------------------- |
| Implement | bug-fixer     | multi-file fix                   |
| Review    | code-reviewer | independent of the writing agent |

## Checks

1. C1: Types pass.
   - Command: `pnpm typecheck`
   - Fix agent: typescript-types-specialist
2. C2: No open review issues.
   - Evidence: the reviewer's findings list is empty, or every finding is fixed and re-reviewed.
   - Fix agent: bug-fixer

## Limits

Max loops: 5

## Report

goals/reports/<name>-<YYYY-MM-DD>.md
```

Rules for the file:

- Each check has an id (`C1`, `C2`, …), a one-line statement, then `- Command:` (the exact shell command; exit code 0
  means pass) or `- Evidence:` (a manual or agent verdict, used only when no command can prove it), and `- Fix agent:`
  (an agent from `.claude/agents/`, or `general-purpose`).
- `## Limits`: `Max loops: N`, default 5. `## Report`: a path, default `goals/reports/<name>-<YYYY-MM-DD>.md`.
- Agent names that are not in `.claude/agents/` are a defect in the goal file: say so and ask one question.

## Procedure

1. **Read.** Read the goal file, `CLAUDE.md` (_Commands_, _Verify before done_, _Orchestration_, _General conduct_),
   and the files named under Context. List every ask of the goal (request ledger, _General conduct_ 1).
2. **Run the checks (loop N).** Run `node .claude/skills/goal-runner/run-checks.mjs goals/<name>.md` (or each
   `- Command:` yourself). Record pass/fail per id with the last ~20 lines of output. `- Evidence:` checks are `manual`:
   you decide them in step 4 from what you read and ran.
3. **Stop on green.** All command checks pass and every manual check has evidence → go to step 7.
4. **Brief and fix.** Group the failing checks by fix agent. Brief each agent with the Agent tool
   (`subagent_type` = the agent name): the failing check (id, statement, command), its output, the files involved, the
   hard rules from CLAUDE.md (offline core, integer millimetres, geometry only from `buildModel()`, never invent
   physical facts, translation rule, no new dependency with unknown licence), and the checks it must run. Skip any step
   in an agent file that names a tool not in this repo. Run independent agents in parallel, dependent ones in order.
5. **Verify yourself.** Read the diffs and re-run the failing checks. An agent's summary never counts as a pass
   (_General conduct_ 3). If an agent's result is wrong, re-delegate once with the error; then fix it yourself or leave
   the check failing.
6. **Next loop.** Back to step 2. Review checks use a different agent than the one that wrote the code (default
   `code-reviewer`). "No open issues" means the reviewer's findings list is empty, or every finding is fixed and
   re-reviewed by a reviewer run. Stop at the limit even if checks fail.
7. **Report.** Write the report file (below). Record each unbuilt item with `pnpm gaps add` and cite its G id.
8. **Reply.** Open with the outcome (R4). If any check fails, open with `PARTIAL: X of Y checks pass, blocked by Z`
   (_General conduct_ 2). Do not commit, push or merge unless the user asked (_Git_).

## Output

The report file, with:

- Header: goal title, date, loops used of the limit, result (all pass / PARTIAL).
- Per check id: statement, PASS / FAIL / MANUAL, evidence (command, exit code, key lines of output), and the loop
  number where it last changed.
- **Still failing** (only when something fails): per check the blocker, what unblocks it, and cost S / M / L
  (_Skips and proof_), plus the G id from `pnpm gaps add`.
- **Changed files** and the agents used per loop.

## Done when

- [ ] Every command check ran in the last loop and its exit code is in the report.
- [ ] Every manual check has evidence from a tool result, or is listed under Still failing.
- [ ] The review check was done by an agent other than the writer, and its findings list is empty or fixed and
      re-reviewed.
- [ ] The report file exists at the path from `## Report`.
- [ ] Every unbuilt item has a G id (`pnpm gaps add`).

## Helper

`.claude/skills/goal-runner/run-checks.mjs <goal.md> [--timeout <minutes>] [--out <file>]` runs each `- Command:`
in order (default timeout 15 minutes each), writes JSON `{id, statement, command, exitCode, pass, tail}` to
`goals/reports/<name>-checks.json` (or `--out`), and prints a markdown table. Exit code 0 only when every command
check passes; `manual` checks do not affect it.
