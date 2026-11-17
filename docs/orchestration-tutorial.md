# Orchestration tutorial

How to use the subagents and health loops adapted from the MIT-licensed
[`maslennikov-ig/claude-code-orchestrator-kit`](https://github.com/maslennikov-ig/claude-code-orchestrator-kit) in
Furniture Builder. The rules themselves live in `CLAUDE.md` › _Orchestration_; this page shows how to drive them.

## 1. What you have

| Piece               | Where                                | What it does                                                                  |
| ------------------- | ------------------------------------ | ----------------------------------------------------------------------------- |
| 26 subagents        | `.claude/agents/<area>/workers/*.md` | Specialists the main session delegates to (finders, fixers, testers, writers) |
| 5 health loops      | `.claude/skills/health-*/SKILL.md`   | Slash commands that run a finder → you choose → fixer → verify cycle          |
| Shared loop         | `.claude/skills/health-bugs/loop.md` | The phases, rules and quality gate every health loop follows                  |
| Orchestration rules | `CLAUDE.md` › _Orchestration_        | Gather context → delegate with a full brief → verify                          |
| Scratch output      | `.tmp/current/` (git-ignored)        | Reports, change logs and backups from the loops                               |

**Mental model.** You talk to one Claude session: the _orchestrator_. It reads the code, decides whether a job is small
enough to do itself, and otherwise hands it to a subagent with a written brief. The subagent works in its own context
and returns a summary. The orchestrator then reads the changed files and runs the checks itself; the subagent's summary
is never taken as proof (`CLAUDE.md` › _General conduct_ 3).

Why bother: the main session's context stays small, so long sessions stay sharp, and each specialist carries a long,
focused instruction file you do not have to repeat.

## 2. Before you start

1. **Use a session on a branch that has the files.** Agents and skills load when a session starts. After PR #286 merges,
   any new session on `main` (or a branch made from it) has them. An older session does not see them until restarted.
2. **Check they loaded.** In a terminal session, `/agents` lists the agents. In any session, type `/health` and the five
   `health-*` commands should be offered.
3. **Pick a model.** Several agents pin `model: sonnet` in their header (for example `code-reviewer`, `test-writer`,
   `reuse-hunter`); the rest inherit the session's model. Run the orchestrator on Opus for multi-file work
   (`CLAUDE.md` › _Model and effort_).
4. **Burst mode matters.** While the `burst` toggle is on, a pull request opened by a loop is merged automatically once
   CI is green (`CLAUDE.md` › _Burst mode_). Say "burst off" first if you want to review each pull request yourself.

## 3. Health loops, step by step

The five loops share one shape. `/health-bugs` is the worked example; the others differ only in their agents and scope.

### 3.1 Start it

```
/health-bugs
```

You can narrow it: `/health-bugs src/core/cutlist` or `/health-bugs only the nesting code`.

### 3.2 What happens

| Phase        | Who          | What you see                                                                                       |
| ------------ | ------------ | -------------------------------------------------------------------------------------------------- |
| 1 Pre-flight | orchestrator | `pnpm typecheck`, `pnpm build`, … run first. If they are already red, the loop stops and says so.  |
| 2 Detect     | `bug-hunter` | A report at `.tmp/current/bug-hunting-report.md`, findings grouped critical / high / medium / low. |
| 2b Filter    | orchestrator | Findings that contradict `CLAUDE.md` or an implemented ADR are dropped, each with the reason.      |
| 3 Ask        | you          | A question: which priorities to fix (multi-select, or none). **Nothing is edited before this.**    |
| 4 Fix        | `bug-fixer`  | Fixes one priority at a time; backs files up to `.tmp/current/backups/`; logs every change.        |
| 4b Verify    | orchestrator | Reads every changed file, checks translations, reruns the gate. Red → one retry, then restore.     |
| 4c Re-scan   | `bug-hunter` | Fixed / remaining / new counts. At most 3 detect-fix rounds.                                       |
| 5 Record     | orchestrator | One backlog row; every unfixed finding goes to `pnpm gaps add`; commit, push, pull request.        |

### 3.3 Answering the question in phase 3

- **Pick by risk.** Critical and high are usually worth it. Medium and low findings are often style; choosing "none"
  still records them as gaps, so nothing is lost.
- **Read the top findings first.** Each line has file:line. If one looks wrong, say so ("drop finding H3, the clamp is
  intended") before choosing; the orchestrator removes it.
- **Test expectations.** A fix that would change an expected value in a test is flagged in the question. Approve it only
  if the test was wrong.

### 3.4 What you get at the end

- A pull request on the session branch with the fixes, one backlog row (`N…`) and the gap ids (`G-…`) of everything left.
- A reply in the usual shape: where to look, **Decided**, **Skipped this iteration** with G ids.
- `.tmp/current/` keeps the report, `changes/*.json` and `backups/` until you delete it. To undo one fix by hand, copy
  its backup over the file, or revert the commit.

### 3.5 The five loops

| Command            | Finder → fixer                              | Looks for                                                                                                                                                                                         | Never does                                                                                                                     |
| ------------------ | ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `/health-bugs`     | `bug-hunter` → `bug-fixer`                  | Type and build errors; lost or non-integer millimetres; input that throws or is clamped silently; geometry in UI code; unstable selectors; leaks; leftover `console.log`; missing translations    | Change a test's expected value without your yes                                                                                |
| `/health-security` | `security-scanner` → `vulnerability-fixer`  | The `security-review` threat model: untrusted files, HTML injection, CSV formula injection, requests outside `src/online`, service worker, secrets, Supabase function input and RLS, `pnpm audit` | Touch the network boundary or `src/online/origins.ts` (needs an ADR → gap); paste a secret in a report                         |
| `/health-deps`     | `dependency-auditor` → `dependency-updater` | `pnpm audit`, `pnpm outdated`, unused packages (Knip via `pnpm dlx`), licences, telemetry                                                                                                         | Major-upgrade the fixed stack without your named yes; add knip to `package.json`; batch updates                                |
| `/health-cleanup`  | `dead-code-hunter` → `dead-code-remover`    | Unused files, exports and packages (Knip via `pnpm dlx`), commented-out blocks, debug leftovers                                                                                                   | Remove exports used by `tests/`, `tools/`, `scripts/`; remove Dexie versions or old-schema readers; run `knip --fix` repo-wide |
| `/health-reuse`    | `reuse-hunter` → `reuse-fixer`              | Duplicated types, constants, translation keys, helpers                                                                                                                                            | Merge a duplicate across a layer boundary (`src/core`, `src/shared`, `src/online`)                                             |

`/health-deps` and `/health-cleanup` download Knip with `pnpm dlx` on first use, so they need network access in the
session; the app's own network rule (ADR-002) is about the shipped app, not dev tools.

### 3.6 When a loop stops early

| Message                   | Meaning and what to do                                                                                                                             |
| ------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| "Gate red before any fix" | `main` or the branch is already broken. Run `/debug` on the failing check first, then rerun the loop.                                              |
| "Needs an ADR"            | The fix touches `src/core/types.ts`, the design document, the Dexie schema or the network boundary. It is a gap; ask for `new-adr` if you want it. |
| "Restored from backup"    | The fixer's change broke a check twice. Nothing of that priority is applied; the gap records why.                                                  |
| "Physical fact unknown"   | A fix would need a hardware or material value (ADR-010). Answer the question or leave the gap open.                                                |

## 4. Calling an agent directly

You do not need a loop to use an agent. Name it in a normal request and the orchestrator briefs it, waits, and verifies:

```
Use test-writer to add unit tests for src/core/cutlist/group.ts. Cover empty input and one-part groups.
```

```
Ask problem-investigator why the nesting test is slow on CI. Report only, no edits.
```

```
Run accessibility-tester on the More screen at 390 px. Report only.
```

Good habits:

- **Say "report only"** when you want analysis without edits. Fixer and tester agents have every tool, including edit.
- **Name the files or area.** The brief is the agent's only context; a precise target gets a precise answer.
- **One agent per job.** "Use X, then Y on X's report" works; the orchestrator runs them in order and checks between.
- Claude may also pick an agent by itself when a task matches its description (many say "use proactively"). It still
  follows `CLAUDE.md` › _Orchestration_ 3: small work stays in the main session.

### 4.1 Which agent for what

| You want to…                          | Agent                                                       | Notes                                                                                  |
| ------------------------------------- | ----------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| Find the cause of a confusing failure | `problem-investigator`                                      | Pair with the `debug` skill, which owns the fix and regression test                    |
| Write unit tests                      | `test-writer`                                               | Vitest; the `add-tests` skill sets this repo's test conventions — mention it           |
| Review a change                       | `code-reviewer`                                             | The `review` skill checks it against the ADR and hard rules; use both for a big change |
| Check accessibility                   | `accessibility-tester`                                      | WCAG; keyboard focus and contrast are hard rules here                                  |
| Check phone layout                    | `mobile-responsiveness-tester` → `mobile-fixes-implementer` | No horizontal scroll at 390 px is a hard rule; browser runs only on request            |
| Speed up load or rendering            | `performance-optimizer`                                     | The 3D viewer must stay lazy (ADR-014)                                                 |
| Tighten TypeScript types              | `typescript-types-specialist`                               | Changes to `src/core/types.ts` need an ADR                                             |
| Write or fix docs                     | `technical-writer`                                          | Docs are English; ADR files follow `docs/adr/_template.md`                             |
| Change CI or deploy                   | `deployment-engineer`                                       | GitHub Actions only; there is no Docker or server                                      |
| Audit the Supabase backend            | `supabase-auditor` → `supabase-fixer`, `database-architect` | `supabase/` only; schema or network changes need an ADR                                |
| Restructure code                      | `code-structure-refactorer`                                 | Only when you explicitly ask for a refactor (ADR-016)                                  |
| Make a new agent or skill             | `meta-agent-v3`, `skill-builder-v2`                         | New files land in `.claude/agents/` or `.claude/skills/`; list them in `CLAUDE.md`     |

## 5. Worked examples

### 5.1 A pre-release sweep

```
/health-security
```

Answer "critical, high". When it finishes:

```
/health-bugs
```

Then `/verify` for the full check table. Each loop opens its own pull request with its own backlog row.

### 5.2 A focused bug hunt

```
/health-bugs src/core/nesting — report only, I will choose later
```

Choose "none" in phase 3. You get the report in `.tmp/current/bug-hunting-report.md` and a G id per finding; later,
`fix G-NNN` (the ids it printed) picks them up.

### 5.3 Dependency upkeep

```
/health-deps
```

The report lists each package with current → wanted → latest, licence and audit status. Approve "critical, high" for
security updates; a major upgrade of a stack package (React, TypeScript, Vite, Zustand, three, Dexie, vite-plugin-pwa)
is asked separately, by name and version.

### 5.4 Adding your own agent

```
Use meta-agent-v3 to create a catalog-checker agent that compares docs/catalog.md with the catalog data and reports
drift. Report only, no edits.
```

The orchestrator reviews the new file, adds it to `CLAUDE.md` › _Orchestration_ 6, and a backlog row. Start a new
session to load it.

## 6. What was left out of the kit, and why

| Kit feature                  | Status here                                                                       |
| ---------------------------- | --------------------------------------------------------------------------------- |
| Beads (`bd`) issue tracking  | Replaced by `docs/backlog.md` and the gaps ledger (`pnpm gaps`)                   |
| Gastown parallel workers     | Not set up; needs the `gt` and `bd` binaries on your own machine                  |
| SpecKit (`/speckit.*`)       | ADRs (`new-adr`, `next-adr`, `ship-adr`) cover specifications                     |
| Kit MCP config (`.mcp.json`) | Not copied; agents skip steps that name Context7 or other missing MCP servers     |
| Library-first rule           | New dependencies follow `CLAUDE.md` › _Engineering conventions_ instead           |
| `/push` after every task     | Pushes follow `CLAUDE.md` › _Git_                                                 |
| 23 stack-specific agents     | Removed (BullMQ, Qdrant, RAG, LangGraph, Next.js, tRPC, LMS, server hardening, …) |

## 7. Troubleshooting

- **A command or agent is missing.** The session started before the files existed on its branch. Start a new session.
- **An agent mentions `bd`, Context7, `setup-knip` or `run-quality-gate`.** These come from the kit and are not installed;
  the agent should skip that step. If it stalls on one, tell it to skip.
- **A report appeared in the repo root.** Some agent files name the root as the report location; the loop tells them to
  use `.tmp/current/`. Root report files are git-ignored as a safety net; move or delete them.
- **An agent's summary and the code disagree.** Trust the code. The orchestrator should already have caught it; if not,
  say "verify the files X changed" and it rereads them.
- **Too many findings.** Narrow the scope (`/health-bugs src/core/cutlist`) or choose only critical and high.
