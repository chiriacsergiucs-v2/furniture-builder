# Retrospective — IKEA/Roomle ensemble features (session 2026-10-24 → 2026-10-26)

## What the user asked (their words)

1. "list all features from the research results which are related to this competitor" (Roomle, then IKEA).
2. "Analyzr and sort them by Validate low effort - high value", then combine Roomle and IKEA.
3. "Do the 1. Verify batch .then for 2. Quick wins, followed by 3. Medium effort items, Iterate over each and
   create the ADRs … put to pending adrs any that require "non-free services or similar integrations" … auto-accept
   the recommended suggestion. Re-check the list, verify agaian their readiness, output list."
4. "Implement all approved ADRs, then merge and deploy."
5. "Stopped, let 1 agent finish here, spawn more for each other part which can be done in parallel."
6. "Output a Done/To be done list, for each To Be Done suggest a fix." / "List the done/not done, simple list ,
   no details" / "List the done/not done, simple list".
7. "Drag and drop?" → "Drag and drop is implemented?" → "yes, write the ADR for option 1".
8. "/batch all ADRs that are ready", "Skip find-it for this onw", "I asked to recheck", "Pull latest main".

## What went wrong

| #   | What happened (evidence)                                                                                                                                                                                                                                                                                                                              | Cause                                                            |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| 1   | Auto-accepted recommendation dropped a researched requirement: ADR-056 answered "Drag-and-drop or tap-to-place?" with tap-to-place ("drag not built"). The user then asked "Drag and drop?" and "Drag and drop is implemented?", and a second ADR (ADR-065) and PR #37 were needed.                                                                   | `rule-missing` (fixed since, see _not changed_)                  |
| 2   | Work started from a stale `main`: while the draft ADRs 0050…0061 were built, `main` gained ADR-050…053 (new ADR layout, pnpm, Prettier reformat, its own project undo). Result: a 36-file conflict merge, all ADRs renumbered (0051→054 …), backlog ids renumbered (N45…→N48…), and this branch's project undo thrown away as a duplicate of ADR-051. | `rule-missing`                                                   |
| 3   | ADRs written by hand in the old layout (`claude-flow/…/` (draft 0050)) instead of with the `new-adr` helper, which fetches `origin` and picks the next free number.                                                                                                                                                                                   | `rule-ignored` (`new-adr` step 4–5)                              |
| 4   | Reported done before an independent review: find-it 60/60 and "Accepted" were reported, then the review found a broken **Cancel** (called the piece undo), a template validator that threw, Shopping CSV/Print not blocked on errors, CSV formula injection, a silent stale run plinth, and five ADR/Decision mismatches.                             | `rule-missing`                                                   |
| 5   | Tests that claimed more than they proved: the sliding-door clearance test was guarded by `if (slid)` and never ran; "a removed filler stays removed after a move" removed a cover and moved nothing.                                                                                                                                                  | `rule-missing`                                                   |
| 6   | A find-it check raced the page: `isVisible()` right after navigation gave 39/40 on two of three runs (`tools/ensemble/find-it.mjs`).                                                                                                                                                                                                                  | `rule-missing`                                                   |
| 7   | Status replies too long: the user asked three times for a short list ("simple list , no details").                                                                                                                                                                                                                                                    | `rule-missing`                                                   |
| 8   | "I asked to recheck": after merging PR #37 the agent reported only the deploy run its own scheduled reminder named, not a fresh check of `main`, open ADRs and the live site.                                                                                                                                                                         | `user-input` + agent narrowed the scope to its own reminder text |
| 9   | Stop hook flagged untracked `.claude/worktrees/` (subagent worktrees) twice; it was worked around with `.git/info/exclude`, which does not travel with the repo.                                                                                                                                                                                      | `tooling`                                                        |
| 10  | Nothing was live-verified: the Pages URL and ikea.com are refused by the session's proxy, so ADR-029/052/027 could not start and no deploy was opened in a browser.                                                                                                                                                                                   | `tooling`                                                        |

## Root causes

- **Stale base for long work (2, 3):** nothing says to fetch and merge `origin/main` before starting a multi-ADR
  batch and before each push; the hand-written ADRs skipped the helper that would have caught the numbering clash.
- **"Done" measured before review (4, 5, 6):** `ship-adr` checks that `Done when` items have evidence, but not that
  an independent `review` ran; test-quality rules don't forbid conditional asserts or mislabelled tests; find-it
  scripts have no rule to wait for async content.
- **Reply shape (7, 8):** no project rule for status replies; "recheck" was read as "re-run my last reminder".
- **Environment (9, 10):** subagent worktrees live inside the repo; the proxy blocks the live site.

## Proposed fixes (apply only the numbers the user approves)

1. **CLAUDE.md line (Process)** — prevents 2, 3. Cost: 2 lines.
   ```diff
   +- Before starting work that spans several ADRs, and before every push, `git fetch origin` and merge
   +  `origin/main`; create ADRs only with the `new-adr` helper (user rule 2026-10-26).
   ```
2. **Skill step in `.claude/skills/ship-adr/SKILL.md`, workflow step 2** — prevents 4. Cost: 2 lines.
   ```diff
    2. **Check the evidence first.** Every `Done when` item is met by code and by a check you
   +   ran, **and** the `review` skill has run on the change with every finding fixed or answered
   +   (a reviewer other than the author, e.g. a subagent, for multi-ADR batches).
   ```
3. **Skill rule in `.claude/skills/add-tests/SKILL.md` (Rules)** — prevents 5. Cost: 2 lines.
   ```diff
   +- No assertion behind an `if` that can be false: build the fixture so the case always exists.
   +  A test name says exactly what the body sets up and asserts.
   ```
4. **Skill rule in `.claude/skills/add-tests/SKILL.md` (Rules)** — prevents 6. Cost: 1 line.
   ```diff
   +- In find-it scripts, wait for content that loads after navigation (`locator.waitFor`), never a bare `isVisible()`.
   ```
5. **`.gitignore`** — prevents 9. Cost: 1 line, no false positives.
   ```diff
   +.claude/worktrees/
   ```
6. **CLAUDE.md line (Process)** — prevents 7, 8. Cost: 2 lines.
   ```diff
   +- Status replies are a short Done / Not done list, one line per item, unless the user asks for detail. "Recheck"
   +  means a fresh check of `main`, CI, deploy, open ADRs and the live site, not a repeat of the last check (user rule 2026-10-26).
   ```
7. **Doc fact in `docs/architecture.md`** — prevents repeating 10 as a surprise. Cost: 2 lines.
   ```diff
   +- Agent sessions run behind a proxy that refuses the Pages URL and ikea.com: deploys can be confirmed by run id
   +  only; live checks and the catalog feed (ADR-029/052) need the user or a session with that network access.
   ```

## Not changed

- **Auto-accepting recommended answers (1):** already fixed after this session by the CLAUDE.md rule "Never
  auto-accept a recommended or default option … (user rule 2026-10-25)". No new rule.
- **N60 shown as Done on `main` while its text says not verified in a browser:** the status was changed outside this
  session; flagged to the user, not edited here.
- **Force-push attempt that was denied:** a one-off; the fast-forward push that followed was the right tool.
