---
name: build
description: Default implementation flow — ask only low-confidence questions in one batch, build the smallest slice on a branch, run typecheck, format and related tests, add one backlog row, push. No ADR unless the change touches the model, design document, Dexie schema or network boundary. Use when a feature, fix or change request is not "ff" and needs no ADR. Do not use when the user says "ff" (use ff) or when the work is the next pending ADR (use next-adr).
---

# Build (user rule 2026-11-07)

1. **Read the request** in the user's words. Read only the code it touches.
2. **ADR needed?** Only for `src/core/types.ts`, the design document or model shape, the Dexie schema or the network
   boundary, or when the user asks. If so, use `new-adr` instead.
3. **Questions — only when confidence is low.** One `AskUserQuestion` batch, at most ~4, only on choices that change
   what gets built; short options, recommended one first (closest to the request), no estimates. Decide everything
   obvious yourself and list it under **Decided** in the reply. Never invent physical or supplier facts (ADR-010).
4. **Build** on the session branch, smallest slice. Hard rules in `CLAUDE.md` still apply (i18n `t()`/`tr()`/`pt()`
   with Russian entries, `buildModel()` projections, offline core, no silent clamping).
   Anything visible gets or extends a jsdom find-it test (`tests/find-it/<area>.test.tsx`, R3).
5. **Check:** `pnpm typecheck`, `pnpm format`, `pnpm exec vitest related --run <changed files>`; plus
   `FUZZ_N=30000 pnpm exec vitest run tests/fuzz.test.ts` after geometry changes and `pnpm docs:check` if docs changed.
   Fix causes, never checks.
6. **Backlog:** one row in `docs/backlog.md` (next free `N` id) with the evidence you ran.
7. **Commit and push** the branch (`git push -u origin <branch>`), then open the pull request (toggle `auto-open-pr`;
   while off, ask first). No babysit or merge unless asked.
8. **Reply:** where to click and whether it is live (pushed ≠ merged ≠ deployed), **Decided**, **Skipped this
   iteration**.
