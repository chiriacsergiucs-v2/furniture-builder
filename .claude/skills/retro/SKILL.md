---
name: retro
description: Run a retrospective on the current session — what went wrong, what could have been avoided, root causes — and propose lasting fixes (CLAUDE.md rules, skill edits, hooks, personal preferences) for the user to approve. Use when the user says "retro", "retrospective", "what did we do wrong", "lessons learned", or "before archiving".
---

# Retro

Project: **Furniture Builder**. Earlier retros: `docs/retros/` (format: `2026-10-23-catalog.md`).

Cloud sessions keep no memory between sessions. A lesson lasts only if it is **merged to `main`** (new
sessions clone `main`), or lands in the user's claude.ai preferences, which only the user can edit.

## 1. Source: this session only

Use the conversation already in context, plus this session's git record (its branch, commits, PRs, review
threads and CI runs). Do not ask which session, list sessions, or read other sessions' transcripts. Start
right away; no questions before the report.

## 2. Read the earlier retros

Read every file in `docs/retros/`, above all its _Proposals_ ledger (see step 6). Use it to:

- drop a finding whose fix is already `Applied`, unless it happened again; then the fix failed, so propose
  a stronger form of it (step 5) and cite the earlier retro
- not re-propose a `Not chosen` item unless the problem happened again in this session; then cite the
  earlier retro and say how often it has now happened

## 3. Find the friction (evidence first)

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

## 4. Root causes

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

## 5. Propose fixes (strongest first)

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

When the cause is `rule-ignored`, never propose another CLAUDE.md line or a reworded one: the rule exists
and text did not hold. Move it up the list instead (doc → CLAUDE.md → skill step → check → hook), to the
strongest form that can check it. If nothing can check it by machine, say so and propose a skill step at the
exact point in the workflow where it was missed.

For a fix that builds a mechanism (a skill, hook or check), state the user's goal in their words and show
the fix reaches it end to end (for a lesson: saved, merged, read back next time). Leave out every part the
goal does not need; offer it as a separate proposal instead.

Write each proposal as an exact diff or exact text, not as advice. Mark each one with what it prevents
(the finding) and its cost (lines added, false positives a hook might give).

## 6. Write and propose in the same turn

- Write `docs/retros/YYYY-MM-DD-<topic>.md` with these sections: what the user asked (their words),
  what went wrong (table), root causes, _Proposals_, and _not changed_.
- _Proposals_ is a ledger table read by later retros:

  | #   | Finding | Fix (target file)               | Status   |
  | --- | ------- | ------------------------------- | -------- |
  | 1   | …       | hook in `.claude/settings.json` | Proposed |

  Status is `Proposed`, then `Applied (PR #N)` or `Not chosen (YYYY-MM-DD)`.

- Commit the retro file and push it to the session's branch right away (the Stop hook flags untracked files).
- Reply briefly with the top findings, then go straight to step 7 in the same turn.

## 7. Choose in a dialog, then apply and merge (user rule 2026-10-26)

Call `AskUserQuestion` right after the findings; never wait for the user to type "apply".

- **One multi-select question per group of up to 4 proposals** (header `Apply`; at most 4 questions, so at
  most 16 proposals; merge or drop the weakest beyond that). Each option: label `N. <short fix>` (1–5 words),
  description = the finding it prevents, the target file and the cost. The question text says that selected
  proposals are applied and merged, and unselected ones are recorded as not chosen.
- **Every option must be seen.** The question text names every proposal number it holds ("Proposals 2, 3
  and 4 — select the ones to apply"), and the reply before the dialog lists every proposal by number.
- **Never record an unselected proposal as `Not chosen` silently.** After the dialog, name the unselected
  ones in one line and ask once whether to skip them; only a confirmed skip is `Not chosen`.
- **A proposal that needs a decision** (two ways to do it) gets its own single-select question, with the
  option closest to the user's request first and marked `(Recommended)` per the CLAUDE.md rule.
- **Selecting is the instruction to apply and merge** (user rule 2026-10-26: "on selecting and hitting next
  they are applied"). Selecting nothing still merges the retro file with every row `Not chosen`. Text the
  user types under "Other" overrides the selection for that question.

Then, without asking again:

1. Branch `retro/YYYY-MM-DD-<topic>` from the latest `origin/main` plus the retro file commit, not from the
   session's other work, so no unmerged work rides along (user decision 2026-10-26).
2. Apply the selected fixes. Set each ledger row to `Applied (PR #N)` or `Not chosen (YYYY-MM-DD)`.
3. Run the CI checks from CLAUDE.md (at least `pnpm lint`, `pnpm format:check`, `pnpm docs:check`; add
   `pnpm typecheck`, `pnpm test` and `pnpm build` if a script, a hook or code changed). Check that a new hook
   runs and does not block a clean session.
4. Commit `Retro <date>: <topic>`, push, open a PR, and subscribe to its activity. When the `verify` check
   passes, merge it (merge commit) and cite the `Deploy GitHub Pages` run id. If CI is red, fix it and push;
   never merge red.
5. Reply with the PR number, the merge commit, and which proposals were applied or not chosen. Claude.ai
   preference texts (item 6 in step 5) can't be merged; list them for the user to paste.

## Rules

- Quote; don't paraphrase the user's complaints into softer words.
- Name the agent's mistakes plainly. No hedging, no blaming the user for unclear input unless the
  transcript shows it.
- Never edit an implemented ADR as a fix. A changed decision gets a new ADR (`new-adr`).
- No rule for a one-off. Propose a rule only if the problem can recur.
