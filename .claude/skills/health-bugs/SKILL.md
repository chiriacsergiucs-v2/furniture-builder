---
name: health-bugs
description: Find bugs across the codebase with the bug-hunter agent, show the report, then fix only the priorities the user approves with the bug-fixer agent, verifying each round with the repo's checks. Use when the user says "health bugs", "/health-bugs", "bug health check", "scan for bugs", or "find and fix bugs across the repo". Do not use when one known bug or failing check needs its root cause (use debug) or when reviewing one change (use review).
---

# Bug health check

Follow `.claude/skills/health-bugs/loop.md` with:

- `FINDER`: `bug-hunter` · `FIXER`: `bug-fixer`
- `REPORT`: `bug-hunting-report.md` · `CHANGES`: `bug-changes.json`
- `SCOPE`: type and build errors; logic errors in `src/core` (generators, checks, cut list, nesting) such as off-by-one
  splits, lost millimetres or non-integer results (ADR-003); user input that throws or is clamped silently instead of
  becoming a diagnostic (ADR-008); geometry computed in UI code instead of `buildModel()` (ADR-004); Zustand selectors
  that return new references (`.filter()`/`.map()` inside a selector); effects and listeners that leak; the 3D viewer
  mounting when hidden (ADR-014); leftover `console.log`/`debugger`; text missing its translation (`t()`, `tr()`, `pt()`).
- Extra rule: a fix that changes a test's expected value needs the user's confirmation in Phase 3 — say which test and
  why.
