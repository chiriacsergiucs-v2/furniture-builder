# Retrospective — IKEA/Roomle ensemble features (session 2026-10-24 → 2026-10-26)

Earlier retros read: `2026-10-23-catalog.md` (rules R1–R4) and `2026-10-26-retro-skill.md` (its ledger: the
session-branch restart line in CLAUDE.md › Git is `Applied (PR #67)`, so the denied force-push here is not a
new finding).

## What the user asked (their words)

1. "list all features from the research results which are related to this competitor" (Roomle, then IKEA).
2. "Analyzr and sort them by Validate low effort - high value", then combine Roomle and IKEA.
3. "Do the 1. Verify batch .then for 2. Quick wins, followed by 3. Medium effort items, Iterate over each and
   create the ADRs … put to pending adrs any that require "non-free services or similar integrations" …
   auto-accept the recommended suggestion. Re-check the list, verify agaian their readiness, output list."
4. "Implement all approved ADRs, then merge and deploy."
5. "Stopped, let 1 agent finish here, spawn more for each other part which can be done in parallel."
6. "Output a Done/To be done list, for each To Be Done suggest a fix." / "List the done/not done, simple list ,
   no details" / "List the done/not done, simple list".
7. "Drag and drop?" → "Drag and drop is implemented?" → "yes, write the ADR for option 1".
8. "/batch all ADRs that are ready", "Skip find-it for this onw", "I asked to recheck", "Pull latest main",
   "Pull latest main, re-do retro".

## What went wrong

| #   | What happened (evidence)                                                                                                                                                                                                                                                                                                                                       | User had to say                                                  | Cause                                     |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- | ----------------------------------------- |
| 1   | ADR-056 asked "Drag-and-drop or tap-to-place?" and the simplest option (tap) was marked recommended and auto-accepted, dropping the research's "drag a template into the scene". A second ADR (ADR-065) and PR #37 followed.                                                                                                                                   | "Drag and drop?", "Drag and drop is implemented?"                | `rule-missing` then; fixed since (below)  |
| 2   | Long work started from a stale `main`: while the draft ADRs 0050…0061 were built, `main` gained ADR-050…053 (new ADR layout, pnpm, Prettier, its own project undo). Result: a 36-file conflict merge, every ADR and backlog id renumbered, this branch's undo thrown away. Again on 2026-10-26: G-058 was taken on `main`, so this session's gap became G-061. | — (cost a day of rework)                                         | `rule-missing` (`next-adr` never fetches) |
| 3   | Done reported before an independent review: find-it 60/60 and "Accepted" were reported; the review then found a broken **Cancel**, a validator that threw, Shopping CSV/Print not blocked on errors, CSV formula injection, a silent stale run plinth and five Decision mismatches.                                                                            | — (caught by the review the agent ran later)                     | `rule-missing`                            |
| 4   | Tests claimed more than they proved: the sliding-door clearance test sat behind `if (slid)` and never ran; "a removed filler stays removed after a move" removed a cover and moved nothing; a find-it check used `isVisible()` right after navigation and failed 2 of 3 runs.                                                                                  | —                                                                | `rule-missing`                            |
| 5   | Status replies too long, and "recheck" answered narrowly (only the deploy run the agent's own reminder named).                                                                                                                                                                                                                                                 | "List the done/not done, simple list" (×3); "I asked to recheck" | `rule-missing`                            |
| 6   | Subagent worktrees under `.claude/worktrees/` tripped the Stop hook twice ("There are untracked files"); worked around with `.git/info/exclude`, which does not travel with the repo.                                                                                                                                                                          | Stop hook                                                        | `tooling`                                 |
| 7   | Nothing could be live-verified and the catalog feed (ADR-029/052/027) could not start: the session proxy refuses the Pages URL and ikea.com.                                                                                                                                                                                                                   | —                                                                | `context-missing`                         |

## Root causes

- **#2** `next-adr` and `/batch` work never fetch `origin/main` before building or before a push; only `new-adr`
  does. Parallel sessions on `main` make this recur.
- **#3, #4** "Done" is measured by the author's own checks; `ship-adr` requires evidence per item but not an
  independent review, and `add-tests` does not forbid conditional asserts or bare `isVisible()`.
- **#5** No project rule on the shape of status replies or what "recheck" covers.
- **#6** Subagent worktrees live inside the repo and are not ignored.
- **#7** The network limits of agent sessions are not written down.

## Proposals

| #   | Finding | Fix (target file)                                                                                                                           | Status              |
| --- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------- | ------------------- |
| 1   | #2      | `next-adr` skill, new first step: `git fetch origin` and merge `origin/main` before building and again before every push                    | Applied (PR #PRNUM) |
| 2   | #3      | `ship-adr` skill step 2: the `review` skill has run on the change and every finding is fixed or answered                                    | Applied (PR #PRNUM) |
| 3   | #4      | `add-tests` skill › Rules: no assertion behind an `if` that can be false; test names match what the body sets up and asserts                | Applied (PR #PRNUM) |
| 4   | #4      | `add-tests` skill › Rules: find-it scripts wait for content loaded after navigation (`locator.waitFor`), never bare `isVisible()`           | Applied (PR #PRNUM) |
| 5   | #5      | `CLAUDE.md` › Process: status replies are a short Done / Not done list; "recheck" = fresh check of `main`, CI, deploy, open ADRs, live site | Applied (PR #PRNUM) |
| 6   | #6      | `.gitignore`: `.claude/worktrees/`                                                                                                          | Applied (PR #PRNUM) |
| 7   | #7      | `docs/architecture.md`: agent sessions cannot reach the Pages URL or ikea.com; deploys are confirmed by run id only                         | Applied (PR #PRNUM) |

Exact text:

1. `.claude/skills/next-adr/SKILL.md`, before "1. **Pick the ADR.**":
   `0. **Start from the latest main.** \`git fetch origin\` and merge \`origin/main\` into the branch; do it again before every push, so ADR, backlog and G ids do not collide with work merged meanwhile.`
2. `.claude/skills/ship-adr/SKILL.md` step 2, append: `…and the \`review\` skill has run on the change (a separate subagent for multi-ADR work) with every finding fixed or answered.`
3. `.claude/skills/add-tests/SKILL.md` › Rules: `- No assertion behind an \`if\` that can be false: build the fixture so the case always exists. A test name says exactly what the body sets up and asserts.`
4. Same file: `- In find-it scripts, wait for content that loads after navigation (\`locator.waitFor\`), never a bare \`isVisible()\`.`
5. `CLAUDE.md` › Process: `- Status replies are a short Done / Not done list, one line per item, unless the user asks for detail. "Recheck" means a fresh check of \`main\`, CI, deploy, open ADRs and the live site (user rule 2026-10-26).`
6. `.gitignore`: `.claude/worktrees/`
7. `docs/architecture.md`: `- Agent sessions run behind a proxy that refuses the Pages URL and ikea.com: deploys are confirmed by run id only; live checks and the catalog feed (ADR-029/052) need the user or a session with that access.`

## Not changed

- **#1 auto-accepted, simplest option recommended:** covered since 2026-10-25 by CLAUDE.md "Never auto-accept a
  recommended or default option" and "Recommended options … never mark an option as recommended because it is the
  simplest". It has not recurred since; no new rule.
- **Gap ids missing from a reply:** the gaps `Stop` hook caught it (G-061 recorded); the hook works.
- **N60 shown Done while its text says not verified in a browser:** changed outside this session; recorded as
  G-061 for the user.
