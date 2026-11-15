---
name: ff
description: Fast-forward workflow — implement exactly what the user asked, with light acceptance and no tests, then land on main once the user approves a list of what changed (push where allowed, else pull request with auto-merge). No ADR. Use when the user says "ff", "fast forward" or "/ff" for a request, and only then. Do not use when the user did not say "ff" (use build) or when the work is a pending ADR (use next-adr).
---

# ff — fast forward

A short path for small, clear requests (user rule 2026-10-27). It replaces the ADR lifecycle and the review pull request
for that one request. The word applies to this request only. See _Flow modes_ in `CLAUDE.md`. Every hard rule in `CLAUDE.md` (Engineering conventions) still holds.

## Steps

1. **Understand.** Write the request down in the user's words. Ask only when confidence is low (one batch, `build`
   skill step 3); decide the obvious and list it under **Decided**.
2. **Start from main.** `git fetch origin main` and work on a local copy of `origin/main`
   (`git checkout -B <session branch> origin/main`).
3. **Implement** the smallest change that does what was asked. No refactors or polish beyond it.
4. **Bookkeeping, same change:**
   - one row in `docs/backlog.md` (next free `N` id), status `Partially done`, the request in the user's words,
     and the gap `find-it pending (light, ADR-066)` naming the visible text a later find-it should look for.
     No ADR or gap entry is written (gaps optional, user 2026-11-07).
5. **Checks:** run only `pnpm typecheck` and `pnpm build` (main deploys once CI on main passes, ADR-197; a broken build must not land).
   Run `pnpm format` so CI's format check passes, and `pnpm docs:check` for the bookkeeping. Do not run
   `pnpm test`, lint or any find-it. If typecheck or build fails, fix the cause; never push red.
6. **Commit** locally with a clear message. Do not land yet.
7. **Ask for approval.** List what changed: each file with a one-line summary, the visible changes (text, controls,
   layout), the backlog row and any G ids, and that tests and find-it were not run. Ask: "Land on main?"
8. **Land only on explicit approval**, as in _Flow modes_ in `CLAUDE.md`. Where pushing to main is allowed:
   `git push origin HEAD:main` (fast-forward only; if main moved, rebase the local commit on `origin/main`, re-run
   typecheck and build, and ask again). Where only the session branch is allowed (cloud): push the branch, open the
   pull request, mark it ready, enable auto-merge. Never force-push main.
9. **Report:** the commit sha on main and the `CI` and `Deploy GitHub Pages` run ids once they appear. Pushed ≠
   deployed ≠ live-verified; say which is true. End with **Decided** and **Skipped this iteration**.

## Not in ff

- Changes to `src/core/types.ts`, the design document, the model shape, the Dexie schema or the network
  boundary: these need an ADR (ADR-011, ADR-012, ADR-002). Say so and use `new-adr` instead.
- Anything that deletes or rewrites saved designs.
