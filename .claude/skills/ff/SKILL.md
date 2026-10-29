---
name: ff
description: Fast-forward workflow — implement exactly what the user asked, with light acceptance and no tests, then push straight to main once the user approves a list of what changed. No ADR, no branch, no pull request. Use only when the user says "ff", "fast forward" or "/ff" for a request.
---

# ff — fast forward

A short path for small, clear requests (user rule 2026-10-27). It replaces the ADR lifecycle, the branch per ADR
and the pull request for that one request. Every hard rule in `CLAUDE.md` (Engineering conventions) still holds.

## Steps

1. **Understand.** Write the request down in the user's words. If something is unclear, ask before building.
   An open question still blocks the part it affects; never build a recommended option the user has not picked.
2. **Start from main.** `git fetch origin main` and work on a local copy of `origin/main`
   (`git checkout -B <session branch> origin/main`).
3. **Implement** the smallest change that does what was asked. No refactors or polish beyond it.
4. **Bookkeeping, same change:**
   - one row in `docs/backlog.md` (next free `N` id), status `Partially done`, the request in the user's words,
     and the gap `find-it pending (light, ADR-066)` naming the visible text a later find-it should look for;
   - a gap in `docs/adr/GAPS.md` (`pnpm gaps add --id G-NNN`, claimed with `pnpm ids next G`) for anything asked but not built. No ADR is written.
5. **Checks:** run only `pnpm typecheck` and `pnpm build` (main deploys on push, so a broken build must not land).
   Run `pnpm format` so CI's format check passes, and `pnpm docs:check` for the bookkeeping. Do not run
   `pnpm test`, lint or any find-it. If typecheck or build fails, fix the cause; never push red.
6. **Commit** locally with a clear message. Do not push yet.
7. **Ask for approval.** List what changed: each file with a one-line summary, the visible changes (text, controls,
   layout), the backlog row and any G ids, and that tests and find-it were not run. Ask: "Push to main?"
8. **Push only on explicit approval:** `git push origin HEAD:main` (fast-forward only; if main moved, rebase the
   local commit on `origin/main`, re-run typecheck and build, and ask again). Never force-push main.
9. **Report:** the commit sha on main and the `CI` and `Deploy GitHub Pages` run ids once they appear. Pushed ≠
   deployed ≠ live-verified; say which is true. End with the backlog table and **Skipped this iteration**.

## Not in ff

- Changes to `src/core/types.ts`, the design document, the model shape, the Dexie schema or the network
  boundary: these need an ADR (ADR-011, ADR-012, ADR-002). Say so and use `new-adr` instead.
- Anything that deletes or rewrites saved designs.
