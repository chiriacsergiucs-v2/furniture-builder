---
name: auto
description: Full-autopilot mode of the build flow — implement the request, check it locally (typecheck, format, related tests, build, docs), and land on main with no approval step (push where allowed, else pull request with auto-merge). No ADR, no questions unless a stop condition applies. Use only when the user says "auto", "autopilot" or "/auto" for a request. Do not use when the user did not say it (use build), when they said "ff" (use ff, which asks before landing), or when the work is a pending ADR (use next-adr).
---

# auto — implement, check locally, land on main

User rule 2026-11-14: "force quick: implement, test locally, push to main, full autopilot". Saying `auto` is the user's
explicit instruction to land that request on `main` without asking again; it applies to that request only (mode rules
2026-11-15). Run the `build` skill in mode `auto`. Gates: no questions (a stop condition instead); all checks;
automatic landing. Steps, landing and stop conditions are in `build` and in _Flow modes_ in `CLAUDE.md`; every hard rule
there still holds. End with **Decided** and **Skipped this iteration**.

## Burst mode

While the `burst` toggle in `CLAUDE.md` is **on** (user rule 2026-11-15), the Check step skips local `pnpm format:check`
and the full suite (run `pnpm format` and `pnpm lint`), and the reply skips pick cards and the Picks list. Writing and running find-it
tests, `skip-review` stage 03, live-verify and `ship-adr` are skipped too. Every skip is appended to the backlog row's
gap text as `burst-skipped: <item> (burst, YYYY-MM-DD; blocker: <what blocks it>; cost: S|M|L)` and listed under **Skipped this iteration**. typecheck, build,
docs check, related tests, fuzz after geometry and every stop condition still run. "Burst off" or "catch up" runs the
`catch-up` skill.
