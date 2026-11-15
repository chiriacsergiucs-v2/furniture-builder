---
name: auto
description: Full-autopilot workflow — implement the request, check it locally (typecheck, format, related tests, build, docs), and push straight to main with no approval step. No ADR, no branch, no pull request, no questions unless a stop condition applies. Use only when the user says "auto", "autopilot" or "/auto" for a request. Do not use when the user did not say it (use build), when they said "ff" (use ff, which asks before pushing), or when the work is a pending ADR (use next-adr).
---

# auto — implement, check locally, push to main

User rule 2026-11-14: "force quick: implement, test locally, push to main, full autopilot". Saying `auto` for a
request is the user's explicit instruction to push that request to `main` without asking again. It is the faster
sibling of `ff`: same path, plus related tests, and no approval step. Every hard rule in `CLAUDE.md` (Engineering
conventions, the translation rule) still holds.

## Steps

1. **Understand.** Write the request down in the user's words. Do not ask: decide the obvious and list it under
   **Decided**. Low confidence on something that changes what gets built, or an unknown physical fact (ADR-010),
   is a stop condition below.
2. **Start from main.** `git fetch origin main`, then `git checkout -B <session branch> origin/main`.
3. **Implement** the smallest change that does what was asked. No refactors or polish beyond it. Every changed
   text updates its translations in the same change.
4. **Bookkeeping, same change:** one row in `docs/backlog.md` (next free `N` id). Status `Done` only for what the
   checks below prove; otherwise `Partially done` with the gap named. Write evidence as what ran, not as a claim.
5. **Check locally**, all must exit 0:
   `pnpm format`, `pnpm typecheck`, `pnpm exec vitest related --run <changed files>`, `pnpm build`,
   `pnpm docs:check`. After any geometry change also `FUZZ_N=30000 pnpm exec vitest run tests/fuzz.test.ts`.
   For anything visible, add or update the jsdom find-it test when it is cheap (`tests/find-it/<area>.test.tsx`).
   The full suite and lint run in CI. Fix the cause of a failure; never skip or weaken a check.
6. **Commit** with a clear message and the attribution lines the session gives.
7. **Push:** `git push origin HEAD:main`, fast-forward only. If main moved, rebase the local commit on
   `origin/main`, re-run step 5, and push again. Never force-push main. If the push is refused, stop (below).
8. **Report:** the commit sha on main and the `CI` and `Deploy GitHub Pages` run ids once they appear. Pushed ≠
   deployed ≠ live-verified; say which is true. Open with where to click and whether it is live (R4). End with
   **Decided** and **Skipped this iteration**.
9. **After the push**, watch `CI` on main once. If it is red, fix forward with the same flow, or say it is red and
   what blocks you. Never leave main red silently.

## Burst mode

While the `burst` toggle in `CLAUDE.md` is **on** (user rule 2026-11-15), step 5 skips local `pnpm format:check`, lint and
the full suite (run `pnpm format`), and the reply skips pick cards and the Picks list. Writing and running find-it
tests, `skip-review` stage 03, live-verify and `ship-adr` are skipped too. Every skip is appended to the backlog row's
gap text as `burst-skipped: <item> (burst, YYYY-MM-DD)` and listed under **Skipped this iteration**. typecheck, build,
docs check, related tests, fuzz after geometry and every stop condition still run. "Burst off" or "catch up" runs the
`catch-up` skill.

## Stop conditions (stop and tell the user; do not push)

- The change needs an ADR: `src/core/types.ts`, the design document or model shape, the Dexie schema, or the
  network boundary (ADR-011, ADR-012, ADR-002). Say so and use `new-adr`.
- It deletes or rewrites saved designs, or would need the network.
- An unknown physical fact (hardware spec, load, drilling depth, supplier value): ask; put it under _Open
  questions_ in `docs/backlog.md`.
- A check fails and its cause is not yours to fix, or the push is refused (branch protection, permission).
  Do not work around a refusal.
- Low confidence on what to build.
