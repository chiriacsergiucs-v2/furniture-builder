# Goals

A goal file is a markdown file that states one task and the checks that prove it is done. The `goal-runner` skill
(`.claude/skills/goal-runner/SKILL.md`) drives it to verified completion: it runs the checks, briefs the fix agents on
every failure, verifies their work itself and loops (default 5 times) until all checks pass or the limit is reached.

Format: `# Goal: <title>`, then `## Context`, `## Agents`, `## Checks`, `## Limits`, `## Report`. The full format is in
the skill.

## Run

- In a session, say: `goal-runner goals/<name>.md`
- Checks only, no agents: `node .claude/skills/goal-runner/run-checks.mjs goals/<name>.md`
  (options `--timeout <minutes>`, `--out <file>`; writes `goals/reports/<name>-checks.json`; exit 0 only when every
  command check passes).

Reports go to `goals/reports/<name>-<YYYY-MM-DD>.md`.
