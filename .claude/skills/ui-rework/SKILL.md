---
name: ui-rework
description: Rework a whole screen or editor flow (for example the phone editor) from findings to fixes on one branch and one pull request — inventory every feature for parity, research and compare whole-interface concepts, pick one with scores, then build it in slices behind a device flag, each slice with its own browser find-it script, and land everything as a single pull request. Use when the user asks to redesign, rework or replace a screen, flow or editor ("new approach for the editor", "rework the phone UI", "UI rework findings and fixes"). Do not use when the change is one screen tweak or one feature (use build), a review of a built screen against its design (use design-review), or the next pending ADR (use next-adr).
---

# UI rework — findings and fixes, one branch, one pull request

Born from the canvas editor rework (ADR-283 to ADR-290, backlog N366–N373, 2026-11-22). That rework shipped as eight
stacked pull requests (#307–#314): merging them took a retarget per pull request, CI skipped the full checks on the two
whose last commit was a ship commit, and a guard test broken in one slice (#312, dead-code and spacing guards) went red
only later. The user then asked for this flow "delivered through 1 single pr, 1 branch" (2026-11-22). That request is
the user's approval for the one exception below to _General conduct_ 5 in `CLAUDE.md` (one ADR, one pull request).

Everything else in `CLAUDE.md` holds: the translation rule, the offline core, ADR-004 (no geometry in UI code),
ADR-008 (never soften a diagnostic), R2 (no avoidance), R3 (find-it), R4 (outcome first), burst rules while on.

## Gates

| Step                | Stops for the user when                                                                     |
| ------------------- | ------------------------------------------------------------------------------------------- |
| 1. Findings         | never; the findings are reported, not asked                                                 |
| 2. Pick the concept | the winner beats the runner-up by less than 10 % weighted, or the user named a concept      |
| 3. Plan the slices  | never; the slice list goes in the umbrella ADR                                              |
| 4. Build each slice | a check fails and the cause is not yours, or a physical fact is unknown (ADR-010)           |
| 5. Old UI           | always: removing or defaulting away from the old UI is a consent question (AskUserQuestion) |
| 6. Land             | merge only on the user's word (_Git_), or burst automerge when `burst` is on                |

## 1. Findings (repo evidence only)

1. **Parity inventory.** Build one matrix of everything the old UI does, from the repo, never from memory:
   - every line of `src/ui/info/features.ts` (the feature tree, ADR-158), with its domain and ADRs;
   - every action in `src/store/*.ts`;
   - every shortcut in `src/ui/editorShortcuts.ts` and the `key ===` handlers;
   - the `t()` count of each component the flow renders (coverage of its texts).
     Mark each row spatial (acts on a place in the drawing) or not. Keep the matrix as a file outside the repo or in
     the design artifact; it is the checklist for step 4.
2. **Baseline.** Measure the old UI from its CSS and code: share of the screen the drawing keeps in each state, taps per
   top task (top tasks from `docs/ui-design.md`). Label these as task analysis, not timed measurement.
3. **Research** (WebSearch): 8–12 real products and patterns, each with link, date, how it works, strength, weakness.
   Mark anything not opened as "verify:".

## 2. Pick the concept

4. Write 4–6 whole-interface concepts, plus the old UI as baseline B0.
5. Score each 1–5 on weighted criteria (default: parity 25, task efficiency 20, model visibility 15, precision 15,
   accessibility 10, discoverability 10, rendering cost 5), one line of evidence per score.
6. Doubt rounds (max 5): argue against the leader, merge or drop candidates, re-score. Required challenges: is it
   better than B0 at all; camera vs edit gestures; OS edge back-swipe; keyboard covering the drawing; small-target
   precision; a single-tap alternative for every drag (WCAG 2.2 SC 2.5.1, 2.5.7); screen reader and 44 px targets;
   first-run discoverability; cost on a mid-range phone.
7. Stop when the leader wins by ≥ 10 % weighted. Publish the spec (findings, research, scores, doubt log, design,
   parity) and an interactive prototype as artifacts; their links go in the umbrella ADR's `Design:` line.

## 3. Plan the slices (one branch, one pull request)

8. Create **one branch** `<short-title>` from fresh `origin/main` (`git fetch --depth=50 origin main`).
9. Write **one umbrella ADR** with `new-adr` when the rework needs one (any visible rework of a whole flow does): the
   decision, the slice list in order, and a `Done when` of at most 8 items that the slices together prove. Slices are
   sections of that ADR, not ADRs of their own, so the work stays one ADR, one pull request. If the ADR would pass
   ~110 lines, put the slice details in the spec artifact and keep one line per slice in the ADR.
10. Slice order: (1) a device flag and the frame that re-hosts the old editor unchanged; then one slice per new
    interaction; last, the default and the old UI (step 5). The old UI stays reachable behind the flag until the user
    decides otherwise.

## 4. Build each slice on the same branch

For every slice, in order:

11. **Re-host, don't rewrite.** Mount the existing components and choose what shows (for example `data-lens-key` on
    `Section`/`Group`, ADR-283). Call the same store actions and pure functions the old controls call. A new control
    that edits a value opens or focuses the existing field instead of copying its rules (ADR-284).
12. **Flag state.** Read the flag through one hook; every new control renders only when the flag is on. Browser
    scripts set their starting flag state with `ctx.addInitScript`, so a later default change cannot invert them
    (ADR-290).
13. **Find-it per slice:** `tools/<slice-area>/find-it.mjs` against `pnpm build && pnpm preview`, at 360 and 390 px,
    from the bare app, by role and visible text, with a flag-off check. A dialog that opens once (hints) is skipped
    in every script.
14. **Checks per slice:** `pnpm typecheck`, `pnpm lint`, `pnpm format`, `pnpm build`, `pnpm docs:check`,
    `pnpm exec vitest related --run <changed files>`, the new script, and **every earlier slice's script again**
    (a later slice made an earlier script stale in the canvas rework, ADR-288).
15. **Guards before each commit:** `pnpm exec vitest run tests/dead-code.test.ts tests/spacing-tokens.test.ts` (an export
    used only in its own file and a raw CSS length broke these in #312). Unit-test every new pure rule.
16. **Commit** the slice on the branch with its own message (`<area>: <what the slice adds>`); one backlog row per
    slice or one row for the rework with a line per slice; new texts get their Russian entries in the same commit.

## 5. The old UI

17. Ask with AskUserQuestion before turning the new UI on by default or removing the old one (recommended option first:
    on by default, old UI behind the switch). Record the open choice with `pnpm gaps add` until answered. When the default
    flips, choose the old UI in `tests/find-it/setup.tsx` for the jsdom tests that cover it, and say so in the ADR.

## 6. Land as one pull request

18. Run the **full suite locally** (`pnpm exec vitest run`) and the jsdom find-it suite (`pnpm exec vitest run
tests/find-it`) on the final branch; record the counts in the backlog row.
19. Run `ship-adr` for the umbrella ADR as the **second-to-last** commit, then commit the backlog evidence last: CI skips
    build, lint and tests when the head commit starts with `Ship ADR-` (`.github/workflows/ci.yml`), so the head must
    not be the ship commit (#307 and #314 got no full CI).
20. Push the branch and open **one** pull request against `main` (toggle `auto-open-pr`); its body lists the slices and
    the evidence. Merge only on the user's word or burst automerge.

## Reply

Opens with where to click and whether it is live (R4), then **Decided** (numbered) and **Skipped this iteration** with G
ids. Pushed ≠ merged ≠ deployed ≠ live-verified.
