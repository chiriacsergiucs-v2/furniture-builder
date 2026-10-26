# Retrospective — quick-count stepper (2026-10-25)

ADR-084 (card over the drawing), ADR-085 (card over 3D), ADR-086 (bug fix). PRs #61 and #62, deployed by runs
40211995174 and 40216016125. Nobody opened the live URL.

## What the user asked (their words)

1. "Divider(horizontal and vertical)/drawer/shelf/all other applicable pleces based on configuration + currentNuber -"
2. "Placement: above the selected piece"; later "Right above the selected item in the rendering container" and
   "INside the rendered view container!"
3. "Usage - quick increment/decremebt number of structural configuration based on the selected
   item/piece/subpiece"
4. Answers: "Full", "Not now", "Yes - create new", "Write and build both"
5. "Do it, ship it", then "Merge and ship it", then "Merge it, ship it"
6. Bug: "Click middle one, add divider results in divider aplied on the entire piece of furniture, but should be
   applie to that middle section only, also applies to shelvds and everything else. Fix it"

## What went wrong

| #   | What happened                                                                                                                                                                                                                      | User's words                                                       | Cause           |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ | --------------- |
| 1   | The agent invented "a bay counts its parent's dividers" and put it under _Decision_, never asked. The request said "based on the selected … subpiece". Shipped; the user found the bug live; it cost ADR-086, PR #62 and a deploy. | "should be applie to that middle section only … Fix it"            | rule-ignored    |
| 2   | The find-it script asserted that invented rule ("Fewer vertical dividers" on the drawer bank removes a cabinet bay) and passed 38/38. The acceptance test protected the bug.                                                       | —                                                                  | rule-missing    |
| 3   | G-053 (where `+` adds a bay) was built and shipped with an unconfirmed default. The user's answer to that question was about placement; the question stayed unanswered.                                                            | "Right above the selected item in the rendering container"         | rule-ignored    |
| 4   | The agent wrote "Q1 … stays at its default" without restating the question. The user had to stop the work and ask.                                                                                                                 | "Stop / What do you mean by "leave Q1 at its default placement" ?" | rule-missing    |
| 5   | ADR number clash: this work was ADR-083 while another session shipped a different ADR-083; renumbered at merge (ADR-083/084 → 084/085, N78/79 → N79/80, G-051–054 → G-054–057).                                                    | —                                                                  | tooling         |
| 6   | At that merge the agent decided, without asking, that a whole-piece selection shows the interior's counts.                                                                                                                         | —                                                                  | rule-ignored    |
| 7   | `pnpm build` was piped through `grep`; the build failed (unused import) and the pipe hid it. The find-it script ran twice against a stale build and the agent first blamed the preview server.                                     | —                                                                  | rule-missing    |
| 8   | The agent tried a force-push to its own branch; refused by the permission check; a plain push fast-forwarded.                                                                                                                      | —                                                                  | rule-missing    |
| 9   | First 3D overlay used drei `Html`, which rendered an empty node in the production build. One extra cycle; caught by find-it.                                                                                                       | —                                                                  | context-missing |
| 10  | First phone layout covered the piece with the card. Caught by the 390 px find-it run before shipping.                                                                                                                              | —                                                                  | —               |

Rule cited for #1 and #6: `CLAUDE.md` "An ADR is agreed by the user. Unconfirmed defaults stay under _Open
questions_ in the ADR." For #3: "Never auto-accept a recommended or default option. Treat it as accepted only when
the user says so explicitly … otherwise ask (user rule 2026-10-25)."

## Root causes

- **#1, #6 (rule-ignored):** behaviour the user's words did not fix was treated as a design detail and written as a
  decision. The rule exists; text did not hold, so the fix moves to a workflow step where it was missed (`new-adr`).
- **#3 (rule-ignored):** the "Never auto-accept" rule exists and was broken on the day it was written. The ensemble
  retro (2026-10-26) noted it "has not recurred since" — it had, here. A check is needed.
- **#2 (rule-missing):** nothing says an acceptance check must prove the user's words rather than the ADR's.
- **#4 (rule-missing):** nothing says how to handle an answer that does not fit its question.
- **#7 (rule-missing):** nothing says filtered check output must keep its exit code.
- **#9 (context-missing):** the drei `Html` limitation was not written down.

## Proposals

| #   | Finding | Fix (target file)                                                                                                             | Status                  |
| --- | ------- | ----------------------------------------------------------------------------------------------------------------------------- | ----------------------- |
| 1   | #1, #6  | `new-adr` skill step 6: every _Decision_ bullet quotes the user's words that fix it, or moves to _Open questions_             | Not chosen (2026-10-26) |
| 2   | #3      | check in `ship-adr.sh`: refuse to ship while the ADR's _Open questions_ cite a gap still `Open`, unless `--accept-defaults`   | Not chosen (2026-10-26) |
| 3   | #2      | `add-tests` skill › Rules: each find-it check names the requirement it proves in the user's words; a default carries its G id | Not chosen (2026-10-26) |
| 4   | #4      | `CLAUDE.md` › Process: an answer that does not fit its question → restate the question in full and ask again                  | Applied (PR #PRNUM)     |
| 5   | #7      | `CLAUDE.md` › Commands: never filter a check's output without its exit code (`set -o pipefail`)                               | Not chosen (2026-10-26) |
| 6   | #9      | `docs/architecture.md`: the 3D overlay is a DOM element placed by projection; drei `Html` rendered empty in production        | Not chosen (2026-10-26) |

Exact text:

1. `.claude/skills/new-adr/SKILL.md` step 6, after the **Decision** bullet list item: `- Every _Decision_ bullet
names the user's words that fix it. A bullet the user's words do not fix (what a control acts on, where
something is added, what happens at a limit) moves to _Open questions_ with the value used. The same applies to
decisions made while merging or fixing conflicts.` (2 lines.)
2. `.claude/skills/ship-adr/ship-adr.sh`, before "Shipping": read the `## Open questions` section, collect its
   `G-NNN` ids, and for each one whose `- Status:` in `docs/adr/GAPS.md` is `Open` print
   `ERROR: ADR-NNN ships with unanswered open question G-NNN: ask the user, or pass --accept-defaults only if they said so`
   and exit 1; a third argument `--accept-defaults` skips it. Skill step 3 names the flag. (≈15 lines; no false
   positive: acknowledged or moved gaps are not `Open`.)
3. `.claude/skills/add-tests/SKILL.md` › Rules: `- Each find-it check's name quotes or names the user requirement it
proves. A check that asserts a default the user has not confirmed carries its G id in the name ("… (default,
G-NNN)").` (2 lines.)
4. `CLAUDE.md` › Process: `- An answer that does not fit the question it was given for is not an answer: restate the
question in full and ask again before building. Never refer to a question by number alone (user rule
2026-10-26).` (2 lines.)
5. `CLAUDE.md` › Commands, after the table: `Never filter a check's output (\`| grep\`, \`| tail\`) without keeping
   its exit code: use \`set -o pipefail\` or check \`$?\`.` (1 line.)
6. `docs/architecture.md`: `- 3D overlays (the quick-count card, ADR-085) are DOM elements beside the canvas, placed
each frame by projecting a model point; drei \`Html\` rendered an empty node in the production build.` (2 lines.)

## Not changed

- **#5:** covered since by PR #69 (`docs:check` fails on an id that `origin/main` has with a different title; Stop
  hook when `main` moved) and PR #68 (`next-adr` merges `origin/main` before every push). Not recurred since.
- **#8:** covered since by PR #67 (`CLAUDE.md` › Git: restart the session branch from `origin/main`, never
  force-push it).
- **#10:** the find-it run caught it before the user saw it; the process worked.
