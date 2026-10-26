# Retro 2026-10-26: selection look, drilling in the project, empty new parts (ADR-087 to ADR-090)

Session branch `claude/project-editor-selection-dividers-4mezsz`, PR #64 (merged as `4609257`, CI run
40352667549, Deploy GitHub Pages run 40352667547).

## What the user asked (their words)

- "New adr for: The highlight of the selected item need to be more obvious, suggest 5 designs …", "one more ADR,
  which would keep the project editor open while we click on the item second time …", "Third bug: … adds the
  divider, but somehow it decided to add also two shells in it. This is not wanted behavior."
- "Also do the 060 065 066 067 clean gaps from what was implemented.", "Go 068"
- "open a PR and ship ADR-087, 088, 089", "Fix them, watch for ci, notify me when ci is green, otherwise keep
  fixing until green, if any other gaps are discovered, fix them too", "merge it when green"
- "Pull laterst, fix conflicts", "Merged, pull main, run retro skill"

Earlier retros read: `2026-10-23-catalog.md`, `2026-10-26-retro-skill.md`, `2026-10-26-ensemble-research.md`.

## What went wrong

| #   | Where                       | What happened                                                                                                                                                                                                                                                  | User had to say                                                   |
| --- | --------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| 1   | Merges `a498e00`, `faf620a` | Backlog and gap ids collided with work merged to `main` during the session: N82 and G-058 to G-060, then G-061. This branch's ids were renumbered twice (N82–N85 → N83–N86, G-058–G-068 → G-061–G-071 → G-062–G-072), across code comments, scripts and 4 ADRs | — (found by the merge conflicts)                                  |
| 2   | After pushing `2ad3c28`     | Replied "Waiting for CI on this head; I'll merge when it's green" without checking that the PR still merged cleanly; `main` had moved again (PR #67, #68) and the PR was conflicted                                                                            | "Pull laterst, fix conflicts"                                     |
| 3   | Twice while checks ran      | Ended a turn with uncommitted edits while background find-it runs were going                                                                                                                                                                                   | Stop hook: "There are uncommitted changes in the repository" (×2) |
| 4   | Every find-it run           | `node tools/*/find-it.mjs` failed with `ERR_MODULE_NOT_FOUND: playwright` (ES modules do not see the global install); fixed each time by hand with a `node_modules/playwright` link                                                                            | —                                                                 |
| 5   | ADR-089 evidence            | The CLAUDE.md command `FUZZ_N=30000 pnpm exec vitest run tests/fuzz.test.ts` times out (5 s default per test) on `main` too; it passed only with `--testTimeout=120000`                                                                                        | —                                                                 |
| 6   | Regression runs             | 8 find-it scripts fail identically on `main` (out of date since ADR-080); already recorded as G-060 by another session                                                                                                                                         | —                                                                 |
| 7   | ADR-087 phone card          | Own rework, caught by own tests: a card heading cut (it covered the phone tap point) and rebuilt on request; the first phone dock sat inside the 3D view and shrank the canvas to 128 px                                                                       | "Also do the 060 065 066 067"                                     |

## Root causes

- **#1 `rule-ignored`, happened again.** `next-adr` step 0 (ensemble-research retro, proposal 1, PR #68) says to
  merge `origin/main` before building and before every push. It landed mid-session, and this work did not go
  through `next-adr`; ids were allocated from a `main` that later moved. A text step did not hold for the second
  retro running, so it needs a machine check.
- **#2 `rule-ignored`.** The PR-driving rules say to check merge state on every event and that a conflicted head
  is never "waiting on CI". GitHub sends no event for a new conflict, so nothing reminded the agent. Checkable.
- **#3 `tooling`.** The Stop hook caught it each time; it works. No change.
- **#4 `context-missing`.** Nothing in the repo says how to run the find-it scripts in a cloud session.
- **#5 `context-missing`.** The documented deep-fuzz command cannot pass as written.
- **#6** Recorded on `main` as G-060; not this session's to re-propose.
- **#7** One-off design iteration, caught before shipping. No rule.

## Proposals

| #   | Finding | Fix (target file)                                                                                                          | Status           |
| --- | ------- | -------------------------------------------------------------------------------------------------------------------------- | ---------------- |
| 1   | #1      | check in `scripts/check-docs.py`: an ADR, N or G id that `origin/main` already has with a different title fails docs:check | Applied (PR #69) |
| 2   | #2      | `Stop` hook `scripts/main_moved_hook.py`: warn when the branch has its own commits and `origin/main` has new ones          | Applied (PR #69) |
| 3   | #4      | `CLAUDE.md` › Commands: how to run find-it scripts where Playwright is installed globally                                  | Applied (PR #69) |
| 4   | #5      | `tests/fuzz.test.ts`: per-test timeout scaled to `FUZZ_N`, so the documented command passes                                | Applied (PR #69) |

Exact text:

1. `scripts/check-docs.py`: if `git rev-parse --verify origin/main` succeeds, read `docs/adr/GAPS.md`,
   `docs/backlog.md` and `docs/adr/README.md` from `origin/main` (`git show`); for every `### G-NNN: title`,
   `| NNN |` backlog row and `[ADR-NNN]` row present in both with a different title, report
   `ERROR <id> is "<title on main>" on origin/main but "<title here>" here: renumber this branch's id` (≈30 lines;
   no false positive when the branch only adds ids after main's highest).
2. `scripts/main_moved_hook.py` (`Stop`, timeout 15): `git fetch -q origin main` (10 s cap, silent on failure);
   if `git rev-list --count origin/main..HEAD` > 0 and `git rev-list --count HEAD..origin/main` > 0, block once
   with `origin/main has N new commit(s) since this branch: merge it, resolve conflicts and re-run the checks
before saying CI or the PR is waiting` (≈20 lines; silent on a branch reset to main or with no own commits).
3. `CLAUDE.md` › Commands, after the find-it sentence: `In a cloud session Playwright is installed globally and
ES modules cannot see it: link it once with \`ln -s "$(npm root -g)/playwright" node_modules/playwright\`
   before \`node tools/*/find-it.mjs\`.`
4. `tests/fuzz.test.ts`: pass `{ timeout: Math.max(5000, N * 4) }` to both seeded fuzz `it(...)` calls.

## Not changed

- **#3:** the Stop hook enforced it; it works.
- **#6:** recorded on `main` as G-060 (out-of-date find-it scripts), waiting on the user.
- **#7:** one-off, caught by the agent's own find-it runs before shipping.
