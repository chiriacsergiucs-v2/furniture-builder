---
name: catch-up
description: Pay the debt logged while the `burst` toggle was on — find every `burst-skipped:` marker in docs/backlog.md, run each skipped step (ship, find-it, fuzz, skip-review, live-verify, full verify) in dependency order, and turn rows Done only with evidence. Use when the user says "burst off", "catch up", "catch up burst" or "pay the burst debt". Do not use for find-it items alone (the user said "catch up acceptance", ADR-066) or when `burst` was never on.
---

# Catch up after a burst

Project: **Furniture Builder**. User rule 2026-11-15 (`CLAUDE.md` › Process › Burst mode). While `burst` is on, the
`auto` path skips slow steps and logs each one as `burst-skipped: <item> (burst, YYYY-MM-DD; blocker: <what blocks it>; cost: S|M|L)` on the backlog row it
touched. This skill runs every logged item. Nothing logged may be dropped or relabelled (R2).

## Steps

1. **Toggle off.** If the user said "burst off", set `burst` to **off** in _Toggleable rules_ with the date and the
   user's words. "Catch up" alone leaves the state as it is.
2. **List the debt.** `grep -n "burst-skipped" docs/backlog.md`. Show a table: row id, item, date. The first and last
   dates are the burst window. Then add every backlog row touched in that window (`git log --since --until` on
   `docs/backlog.md`) that is not Done, and every Open G id those rows cite: each gets a verdict too (CLAUDE.md, Burst
   mode, Paying the debt; user pick 2026-11-26: N352, N364 and N365 had unmarked live-verify debt that was never paid).
   No markers and no such rows: say "no burst debt" and stop.
3. **Branch** `catch-up-<date>` from `origin/main`. All fixes ride one pull request (`auto-open-pr`).
4. **Pay in dependency order** (a prerequisite first; never cite a blocker a later step removes):
   1. `ship-adr` for each logged `ship ADR-NNN` (the ADR's build is already on `main`; check each `Done when` item
      has evidence before shipping).
   2. Geometry rows: `FUZZ_N=30000 pnpm exec vitest run tests/fuzz.test.ts` if a logged row changed `src/core` and no
      fuzz ran.
   3. Find-it items: write and run the missing tests (`tests/find-it/<area>.test.tsx`, jsdom; the browser script for
      layout/CSS or 3D work), naming the visible text from the debt line.
   4. `skip-review` stages 01–05 over the **Skipped this iteration** lists of the burst window.
   5. Live-verify: open https://chiriacsergiucs-v2.github.io/furniture-builder/ and find each logged change by its
      visible text; record what was found.
   6. Full `verify` skill run (format check, lint, full suite, build, docs check) on the catch-up branch.
5. **Per item:** done → remove its `burst-skipped:` marker and write the evidence that ran (command output, test
   file, CI run id), close the G id it paid and rewrite row text it made stale (CLAUDE.md, Paying closes). Fails → fix the cause, never the check. Cannot be done → the marker stays and the item goes under
   **Skipped this iteration** with blocker, what unblocks it, and cost (S/M/L).
6. **Rows:** a row turns **Done** only when none of its gaps remain and the evidence ran. Pushed ≠ merged ≠ deployed ≠
   live-verified; say which is true.
7. **Close-out check:** `grep -c "burst-skipped" docs/backlog.md` is 0, or every remaining marker is listed in the
   reply with its blocker. Run `pnpm docs:check`.
8. **Reply:** open with the count paid and the count remaining, where to click, and whether it is live (R4); end
   with **Decided** and **Skipped this iteration**.

## Notes

- Never run this while `burst` is on and the user is still pushing; ask to turn it off first.
- Order inside a step: oldest debt first.
