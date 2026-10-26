---
name: retro
description: Run a retrospective on the current session — what went wrong, what could have been avoided, root causes — and propose lasting fixes (CLAUDE.md rules, skill edits, hooks, personal preferences) for the user to approve. Use when the user says "retro", "retrospective", "what did we do wrong", "lessons learned", or "before archiving".
---

# Retro

Project: **Furniture Builder**. Earlier retros: `docs/retros/` (format: `2026-10-23-catalog.md`).

Cloud sessions keep no memory between sessions. A lesson lasts only if it lands in a file in the repo
(or in the user's claude.ai preferences, which only the user can edit).

## 1. Source: this session only

Use the conversation already in context, plus this session's git record (its branch, commits, PRs, review
threads and CI runs). Do not ask which session, list sessions, or read other sessions' transcripts. Start
right away; no questions before the report.

## 2. Find the friction (evidence first)

List every point where the user had to step in, quoting their exact words, with the turn or commit it
came from:

- a correction, rejection, "no", "I said…", or a repeated request
- a question the agent should have asked but didn't, or asked when the answer was already in the repo
- a default or recommended option the agent treated as accepted without the user saying so
- a claim of done, tested, merged, deployed or live without evidence
- rework: a commit undone or replaced, an ADR renumbered, a PR reopened, CI red after a push
- something built that wasn't asked for, or something asked for that was dropped or relabelled
- wasted effort: long dead ends, a check that was run again and again, an over-long reply

Count only what the transcript shows. Don't invent problems to fill sections. "Nothing found" is a valid answer.

## 3. Root causes

For each item, give one cause:

| Cause             | Meaning                                                                        |
| ----------------- | ------------------------------------------------------------------------------ |
| `rule-ignored`    | CLAUDE.md or a skill already covered it (cite the line)                        |
| `rule-missing`    | nothing in the repo covers it                                                  |
| `rule-unclear`    | a rule exists but can be read two ways                                         |
| `context-missing` | a fact the agent needed wasn't in the repo or the docs                         |
| `tooling`         | the environment, a tool or CI got in the way                                   |
| `user-input`      | the request was ambiguous and no one asked about it (say so plainly, no blame) |

Group items that share a cause. Three instances of one cause are one finding.

## 4. Propose fixes (strongest first)

For each finding, pick the cheapest fix that actually prevents a repeat:

1. **Hook** in `.claude/settings.json`. Use this for `rule-ignored` items that can be checked by machine
   (as with the gaps `Stop` hook). It is enforced, not just remembered.
2. **Check** in `scripts/` or CI, if the repo can verify it.
3. **Skill step** in the relevant `.claude/skills/*/SKILL.md`, if the lesson belongs to one workflow.
4. **CLAUDE.md line** for a project-wide rule. Date it (`user rule YYYY-MM-DD`). First look for an existing
   rule to sharpen; don't add a near-duplicate. CLAUDE.md is long, so every added line has to earn its place.
5. **Doc fact** in `docs/product/product-context.md` or `docs/architecture.md`, for `context-missing`.
6. **Personal preference** for the user's claude.ai profile (cross-project habits such as reply style). Give
   the exact text for the user to paste.

Write each proposal as an exact diff or exact text, not as advice. Mark each one with what it prevents
(the finding) and its cost (lines added, false positives a hook might give).

## 5. Write and propose in the same turn

- Write `docs/retros/YYYY-MM-DD-<topic>.md` with these sections: what the user asked (their words),
  what went wrong (table), root causes, proposed fixes, and _not changed_.
- Reply briefly: the top findings, then the proposals, numbered so the user can answer "apply 1, 3".
- **Apply nothing beyond the retro file until the user approves each proposal by number** (user rule
  2026-10-25: never auto-accept). After approval, apply the changes, run `pnpm docs:check` and
  `pnpm format:check`, then commit on the current branch with the message `Retro <date>: <topic>`.

## Rules

- Quote; don't paraphrase the user's complaints into softer words.
- Name the agent's mistakes plainly. No hedging, no blaming the user for unclear input unless the
  transcript shows it.
- Never edit an implemented ADR as a fix. A changed decision gets a new ADR (`new-adr`).
- No rule for a one-off. Propose a rule only if the problem can recur.
