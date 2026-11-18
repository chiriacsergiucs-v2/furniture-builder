---
name: debug
description: Find and fix the root cause of a bug or failing check — reproduce it, isolate it, prove the cause, fix it with a regression test, and verify. Use when the user says "debug this", "this is broken", "why does X fail", "tests are failing", "fix this bug", or pastes an error or stack trace. Do not use when the task is a new feature with no failure to explain.
---

# Debug

Project: **Furniture Builder** — offline PWA; pure model in `src/core`, Zustand store,
Dexie storage, React UI, lazy three.js viewer.

## Workflow

1. **Understand the symptom.** Expected vs actual, since when, how triggered. Get the exact
   error, the steps, the width (phone or desktop) and, if possible, the design file
   (Export → design file). If too vague to reproduce, ask one specific question.
2. **Rule out the environment first:** Node version (24, `.nvmrc`; CI uses 24), `pnpm install --frozen-lockfile` clean, a stale
   service worker or old cached build (hard reload, or the update prompt), storage
   unavailable (private mode) — the save status says so.
3. **Reproduce.** Smallest reproduction: best a failing Vitest test in `tests/` built from
   the design (core and store are testable without a browser). For UI-only bugs, a
   jsdom test (as in `tests/find-it/`, ADR-108); for layout, CSS or 3D bugs, a production build
   and a scripted Chromium run (as in `tools/*/find-it.mjs`).
4. **Isolate.** Which layer: generator (`src/core`), independent checks (`build.ts`),
   store/selectors, storage, UI. Bisect with `git log` / `git bisect`. One hypothesis at a
   time, tested with evidence.
5. **Prove the root cause.** State what is wrong, where, and why it produces the symptom.
6. **Fix at the cause, minimally.** No try/catch that swallows the error, no silent clamp,
   no hidden diagnostic, no loosened validation. Saved designs must still load.
7. **Add a regression test** that fails before the fix and passes after (`add-tests`).
   Show that it failed first. Geometry fixes also run the deep fuzz.
8. **Verify** with the `verify` skill. Remove temporary logging.
9. **Report:** symptom, root cause, fix, test added, similar risks elsewhere; update the
   backlog row if the bug belongs to one.

## Flaky or order-dependent tests

Adapted from the systematic-debugging skill of the MIT-licensed `maslennikov-ig/claude-code-orchestrator-kit`.

- **A test leaves a file or folder behind** (or a test passes alone and fails in the suite because of one): run
  `.claude/skills/debug/find-polluter.sh <path> ['tests/**/*.test.ts*']`. It runs each tracked test file alone and names
  the first one that creates `<path>` (exit 1); exit 0 means none did. Fix the test to clean up (`afterEach`, a temp
  dir), never the check that noticed.
- **A test passes sometimes** and waits with a guessed delay (`await new Promise((r) => setTimeout(r, 50))`): wait for
  the condition instead — `vi.waitFor(() => expect(x).toBe(y))` in plain Vitest tests, Testing Library's
  `waitFor`/`findBy*` in jsdom tests. Keep a fixed delay only when the test is about timing itself (a debounce, a
  throttle), after first waiting for the trigger, with a comment saying where the number comes from.
- **Faked time:** prefer `vi.useFakeTimers()` and `vi.advanceTimersByTime()` over real waits; restore with
  `vi.useRealTimers()` in `afterEach`.
- Prove a flake fix: run the file 20 times before and after
  (`for i in $(seq 20); do pnpm exec vitest run <file> || break; done`). Never use `--retry` to hide a flake.

## Rules

- Change one thing at a time; re-run after each change.
- Never delete, skip or weaken a failing test or fuzz invariant to get green.
- If several attempts fail, stop and report what is known, ruled out, and next hypotheses.
