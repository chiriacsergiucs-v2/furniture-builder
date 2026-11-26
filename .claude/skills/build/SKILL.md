---
name: build
description: Default implementation flow, one flow for all three modes (normal, ff, auto) — read the request, ask only low-confidence questions, build the smallest slice on the session branch, check, add one backlog row, commit, land. No ADR unless the change touches the model, design document, Dexie schema or network boundary. Use when a feature, fix or change request is not "ff" or "auto" and needs no ADR. Do not use when the user says "ff" (use ff), says "auto" (use auto) or when the work is the next pending ADR (use next-adr).
---

# Build — one flow, three modes (user rules 2026-11-07, 2026-11-15)

The steps below are the same in every mode. A mode only changes the **gates** in the table (_Flow modes_ in `CLAUDE.md`).
The mode word (`ff`, `auto`) applies to one request; the next request is `normal` again. The `ff` and `auto` skills
only set the mode and point here.

| Gate             | normal              | ff                                      | auto               |
| ---------------- | ------------------- | --------------------------------------- | ------------------ |
| Step 3 questions | low confidence only | low confidence only                     | none; stop instead |
| Step 5 checks    | all checks          | light checks                            | all checks         |
| Step 8 landing   | draft pull request  | after the user approves the change list | automatic          |

1. **Read the request** in the user's words. Read only the code it touches.
2. **ADR needed?** Only for `src/core/types.ts`, the design document or model shape, the Dexie schema or the network
   boundary, or when the user asks. If so, stop and use `new-adr` instead (this is also a stop condition for `ff` and `auto`).
3. **Questions.** `normal`, `ff`: only when confidence is low. One `AskUserQuestion` batch, at most ~4, only on choices
   that change what gets built; short options, recommended one first (closest to the request), no estimates. `auto`: do
   not ask; low confidence is a stop condition. Decide everything obvious yourself and list it under **Decided**. Never
   invent physical or supplier facts (ADR-010); an unknown one is a stop condition for `ff` and `auto`.
4. **Build** on the session branch, smallest slice. Start `ff` and `auto` from `origin/main`
   (`git fetch origin main`, `git checkout -B <session branch> origin/main`). Hard rules in `CLAUDE.md` still apply
   (i18n `t()`/`tr()`/`pt()` with Russian entries, `buildModel()` projections, offline core, no silent clamping).
5. **Check.**
   - All checks (`normal`, `auto`): `pnpm format`, `pnpm lint`, `pnpm typecheck`, `pnpm exec vitest related --run <changed files>`,
     `pnpm build`, `pnpm docs:check`; plus `FUZZ_N=30000 pnpm exec vitest run tests/fuzz.test.ts` after geometry changes.
     Anything visible gets or extends a jsdom find-it test (`tests/find-it/<area>.test.tsx`, R3).
   - Light checks (`ff`): `pnpm format`, `pnpm lint`, `pnpm typecheck`, `pnpm build`, `pnpm docs:check`. No tests or find-it, so
     the backlog row is `Partially done` with the gap `find-it pending (light, ADR-066)` naming the visible text to find.
   - Fix causes, never checks. Never land red.
6. **Backlog:** one row in `docs/backlog.md` (next free `N` id) with the evidence you ran. Status `Done` only for what
   the checks prove.
7. **Commit** with a clear message and the attribution lines the session gives.
8. **Land** as the mode says.
   - `normal`: push the branch (`git push -u origin <branch>`), open a draft pull request (toggle `auto-open-pr`; while
     off, ask first). No babysit or merge unless asked.
   - `ff`: list what changed (each file with a one-line summary, visible changes, the backlog row, that tests and find-it
     were not run) and ask "Land on main?". Land only on explicit approval.
   - `auto`: land at once.
   - Landing (`ff`, `auto`): where pushing to `main` is allowed, `git push origin HEAD:main`, fast-forward only; if
     main moved, rebase the local commit on `origin/main`, re-run step 5, push again. Where only the session branch is
     allowed (cloud), push the branch, open the pull request, mark it ready, enable auto-merge. Never force-push main. If
     landing is refused or auto-merge is unavailable, stop; the pull request stays open.
9. **Reply:** where to click and whether it is live (pushed ≠ merged ≠ deployed ≠ live-verified); after landing, the commit
   sha and the `CI` and `Deploy GitHub Pages` run ids; **Decided**; **Skipped this iteration**. `auto` watches `CI` on
   main once after landing and fixes forward or says it is red.
   When **Skipped this iteration** is not empty, run the `skip-review` skill's stage 03 on it first: each skip
   states its blocker, what unblocks it and its cost, and a premature or avoidance skip is built instead.
   Then build every remaining item sized S or lower without asking (CLAUDE.md, _Process_, "Cover small leftovers"); only
   larger or externally blocked items stay listed.

## Stop conditions (`ff` and `auto`; stop, tell the user, do not land)

An ADR is needed; it deletes or rewrites saved designs or needs the network; a physical fact is unknown; a check fails
and its cause is not yours to fix; the push is refused; low confidence on what to build (`auto`).

## Burst mode

While the `burst` toggle in `CLAUDE.md` is **on**, follow `CLAUDE.md` › Process › Burst mode in every mode: skip the find-it
test, local `pnpm format:check` and the full suite (still run `pnpm format` and `pnpm lint`), and log each skip as `burst-skipped: <item> (burst, YYYY-MM-DD; blocker: <what blocks it>; cost: S|M|L)`
on the backlog row. `ff` and `auto` have their own short notes.
