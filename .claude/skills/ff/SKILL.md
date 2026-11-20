---
name: ff
description: Fast-forward mode of the build flow — implement exactly what the user asked, light checks and no tests, then land on main once the user approves a list of what changed (push where allowed, else pull request with auto-merge). No ADR. Use when the user says "ff", "fast forward" or "/ff" for a request, and only then. Do not use when the user did not say "ff" (use build) or when the work is a pending ADR (use next-adr).
---

# ff — fast forward

Run the `build` skill in mode `ff` for this request only (user rule 2026-10-27, mode rules 2026-11-15). Gates: questions
only on low confidence; light checks (`pnpm format`, `pnpm lint`, `pnpm typecheck`, `pnpm build`, `pnpm docs:check`, no tests); the
user approves the change list before landing. Steps, landing and stop conditions are in `build` and in _Flow modes_ in
`CLAUDE.md`; every hard rule there still holds. End with **Decided** and **Skipped this iteration**.

## Burst mode

`ff` already skips tests and find-it. While the `burst` toggle in `CLAUDE.md` is **on**, also log each skipped item
(related tests, full suite, fuzz, find-it, live-verify; `pnpm lint` still runs) on the backlog row as
`burst-skipped: <item> (burst, YYYY-MM-DD; blocker: <what blocks it>; cost: S|M|L)`, so the `catch-up` skill can pay it. Prefer `auto`, which keeps related
tests and fuzz.
