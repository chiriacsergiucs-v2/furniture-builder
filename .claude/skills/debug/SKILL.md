---
name: debug
description: Find and fix the root cause of a bug or failing check — reproduce it, isolate it, prove the cause, fix it with a regression test, and verify. Use when the user says "debug this", "this is broken", "why does X fail", "tests are failing", "fix this bug", or pastes an error or stack trace.
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
   production build and a scripted Chromium run (as in `tools/*/find-it.mjs`).
4. **Isolate.** Which layer: generator (`src/core`), independent checks (`build.ts`),
   store/selectors, storage, UI. Bisect with `git log` / `git bisect`. Find similar code that
   works (another template, front style or product kind going through the same path), read it
   completely and list every difference from the broken case, however small. Trace the bad
   value backwards from where it shows up to where it is first wrong. One hypothesis at a
   time, tested with evidence.
5. **Prove the root cause.** State what is wrong, where, and why it produces the symptom.
6. **Fix at the cause, minimally.** No try/catch that swallows the error, no silent clamp,
   no hidden diagnostic, no loosened validation. Saved designs must still load.
7. **Add a regression test** that fails before the fix and passes after (`add-tests`).
   Show that it failed first. Geometry fixes also run the deep fuzz.
8. **Verify** with the `verify` skill. Remove temporary logging.
9. **Report:** symptom, root cause, fix, test added, similar risks elsewhere; update the
   backlog row if the bug belongs to one.

## Rules

- Change one thing at a time; re-run after each change.
- Never delete, skip or weaken a failing test or fuzz invariant to get green.
- Count the fixes you tried. After 3 failed fixes, do not try a fourth: stop, report what is known,
  ruled out and next hypotheses, and ask the user whether the design itself is wrong (each fix
  exposing a new problem elsewhere is the sign). Adapted from obra/superpowers
  `systematic-debugging` (MIT, skill-finder review 2026-10-26).
