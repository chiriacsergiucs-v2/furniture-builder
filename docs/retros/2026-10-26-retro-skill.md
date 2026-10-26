# Retrospective — retro skill (2026-10-26)

Session: building the `retro` skill (PRs #63 and #66, branch `ccr-4254e05f-dr6cqr`).

## What the user asked (their words)

1. "Before archiving a session, i want to run some kind of retro of what we did wrong, what could've been
   avoided, learn from it and suggest memory items or other kind of improvement."
2. "Any, on-demand, i am looking for info on how to achieve that"
3. "yes, write the retro skill, but where"
4. "This is suboptimal. Retro call should write read and propose straight away. No new session calls or similar"
5. "Merge"
6. "After i run retro skill, how to keep selected ones memorized/saved and not repeat them in the future?"
7. "yes, apply all three, apply means merge"
8. "Pull main"

Earlier retros read: `2026-10-23-catalog.md` (no _Proposals_ ledger; its rules R1–R4 concern visible
features and were not in play here).

## What went wrong

| #   | Where                  | What happened                                                                                                                                                                                                    | User had to say                                                                                  |
| --- | ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| 1   | First reply            | Read "before archiving a session" as "retro one past session" and asked which session, listing four                                                                                                              | "Any, on-demand, i am looking for info on how to achieve that"                                   |
| 2   | First version of skill | Built a second mode that reads other sessions' transcripts (`list_sessions`, `list_events`) and an "ask which session" step. Not asked for                                                                       | "This is suboptimal … No new session calls or similar"                                           |
| 3   | First version of skill | The agent itself said "a lesson only sticks if it's in the repo", yet the skill committed approved fixes to the session branch with no merge and kept no record of past proposals. The skill missed its own goal | "how to keep selected ones memorized/saved and not repeat them in the future?" → second PR (#66) |
| 4   | PR #66                 | Picked a new `retro/<date>-<topic>` branch for applied fixes (instead of the session branch), flagged it as "say if you'd rather…", then merged it without an answer. An unconfirmed default treated as accepted | — (not caught yet)                                                                               |
| 5   | Restarting the branch  | `git push -f` after resetting the session branch onto `main`; the auto-mode classifier denied it. The old tip was already in `main`, so a normal push fast-forwarded                                             | — (cost one denied call)                                                                         |
| 6   | "Pull main"            | Pulled, then reported "1 commit ahead, not pushed" instead of pushing the session branch                                                                                                                         | Stop hook: "There are 1 unpushed commit(s) … Please push"                                        |

## Root causes

- **#1 `user-input`.** The request did not say "one session" or "a mechanism"; the session was empty, so
  asking was right. The question offered only past sessions, not "a reusable mechanism". One-off.
- **#2 `rule-ignored`.** CLAUDE.md › Process: "Smallest functional slice; for each change ask 'needed to
  demonstrate this now?'". Cross-session reading was offered as an option and then built without asking
  whether it was wanted.
- **#3 `rule-ignored`.** Same rule's other half: the slice must be _functional_. The goal ("not repeat them")
  needed persistence (merge) and a ledger; the first version stopped at "commit on the current branch".
- **#4 `rule-ignored`.** CLAUDE.md › ADRs: "Never auto-accept a recommended or default option … otherwise
  ask (user rule 2026-10-25)", and › Process › Gaps ledger: a defaulted open question goes into
  `docs/adr/GAPS.md`. Neither was done.
- **#5, #6 `rule-missing`.** Nothing in the repo says how to restart a session branch after its PR merged,
  or that the session branch is pushed after a pull. The harness covers it (Stop hook, classifier) only
  after the mistake.

## Proposals

| #   | Finding | Fix (target file)                                                         | Status   |
| --- | ------- | ------------------------------------------------------------------------- | -------- |
| 1   | #4      | Decision on the retro branch + gap record (`GAPS.md`, retro skill step 7) | Proposed |
| 2   | #5, #6  | `CLAUDE.md` › Git line                                                    | Proposed |
| 3   | #2, #3  | Retro skill step 5: functional-slice check on proposals                   | Proposed |

**1. Retro branch (finding #4).** Needs your answer first: applied fixes go to

- (a) a new `retro/<date>-<topic>` branch from `main` (current, merged unconfirmed). Keeps a session's
  unmerged work out of the retro PR. Closest to "apply means merge" without side effects.
- (b) the session's own branch. No new branch, but merges whatever else is unmerged on it.

Then record the answer in the skill (step 7.1) and as an acknowledged gap via `pnpm gaps add`. Cost: 1–2 lines.

**2. Git hygiene (findings #5, #6).** Add to `CLAUDE.md` › Git:

```diff
+- Session branch: after its PR merged, restart it with `git checkout -B <branch> origin/main` and push
+  normally (it fast-forwards); never force-push it. After pulling or merging into it, push it in the same
+  turn.
```

Cost: 3 lines. Prevents a denied call and a Stop-hook round-trip.

**3. Proposals must reach the goal (findings #2, #3).** Not machine-checkable, so a skill step at the point
where it was missed. Add to retro skill step 5, before "Write each proposal…":

```diff
+For a fix that builds a mechanism (a skill, hook or check), state the user's goal in their words and show
+the fix reaches it end to end (for a lesson: saved, merged, read back next time). Leave out every part the
+goal does not need; offer it as a separate proposal instead.
```

Cost: 3 lines. Generic to any tooling the user asks for, but the retro skill is the only workflow that
builds such mechanisms today.

## Not changed

- #1: one-off; asking was correct.
- No new `CLAUDE.md` line for #2–#4: the rules exist (smallest functional slice, never auto-accept), so
  per the retro skill no reworded line is proposed.
