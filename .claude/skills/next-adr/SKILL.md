---
name: next-adr
description: Find the next ADR ready for implementation in docs/adr/ and implement it. Picks the lowest-numbered pending ADR whose dependencies are all done, then reads it, its Depends-on ADRs, and the design reference it names before building. Use when the user says "next ADR", "implement the next ADR", "what's next", or asks which ADR to do next.
---

# Implement the next ADR

Finds the next unit of work in this repo's ADR plan and implements it. Pending
ADRs live in `docs/adr/`; implemented ones move to `docs/adr-done/` (see the
`ship-adr` skill).

Project: **Furniture Builder** — offline PWA, React 19, TypeScript strict, Vite, Zustand,
Dexie, three.js (lazy). No backend (ADR-002).

## Expected ADR shape

The picker script reads these lines near the top of each ADR file
(`docs/adr/ADR-NNN-short-title.md`, 3-digit number):

```md
# ADR-NNN: <title>

- Status: Pending | Deferred (<reason>) | Implemented
- Date: YYYY-MM-DD
- Depends on: ADR-XXX, ADR-YYY (or "none")
- Design: <docs/ui-design.md section, or n/a>
- Backlog: <ids in docs/backlog.md>

## Done when

- [ ] <verifiable item>
```

ADR-001 to ADR-049 predate this layout and have no `Done when` list. If the picked ADR has
none, write one from its Decision and open questions (same rules as `new-adr`) before
building, and show it to the user.

## What "next" means

The **lowest-numbered** ADR in `docs/adr/` that is not deferred and whose `Depends on:`
ADRs are all in `docs/adr-done/`.

## Workflow

0. **Start from the latest main.** `git fetch origin` and merge `origin/main` into the branch;
   do it again before every push, so ADR, backlog and G ids do not collide with work merged meanwhile
   (retro 2026-10-26).
1. **Pick the ADR.**
   ```bash
   bash .claude/skills/next-adr/next-adr.sh
   ```
   It prints skipped ADRs and why, the chosen ADR's header, a `Size:` line, an
   `OVERSIZED=` flag, and `NEXT=<path>`. If `NEXT=` is empty, tell the user nothing is
   ready (list the deferred ones and their open questions) and stop.
2. **Size gate.** If `OVERSIZED=1`, or the ADR bundles several loosely coupled deliverables,
   propose a split before building: carve pieces into new ADRs at the next free numbers,
   keep the original number for the core, update `docs/adr/README.md`, re-run the picker.
   Skip the split only if the user asks.
3. **Agreement gate (retro 2026-10-26).** If the ADR says `- Agreed: not yet`, do not build. Ask with
   `AskUserQuestion`: one question per decision in _Decision_, _Scope_ (each out-of-scope item) and
   _Open questions_. Put the option closest to the request first, marked `(Recommended)`, with the
   effort/value estimate (`CLAUDE.md`). Write the answers into the ADR and set
   `- Agreed: YYYY-MM-DD "<the user's words>"`. A general "go" or "proceed" agrees only to what it
   was asked about.
   **Then start building — do not ask for permission again.** Announce the number and title in one
   line. Stop and ask only when a dependency is blocked, or when a physical or supplier
   fact is unknown (record it under _Open questions_ in `docs/backlog.md`; never invent it).
4. **Read only what the ADR points to:** the ADR, its `Depends on` ADRs, the design
   reference, and the current code it touches (not docs alone).
5. **Scope.** For each change ask "needed to demonstrate this now?" — if not, it goes under
   _Skipped this iteration_, and every skipped item gets a gap in `docs/adr/GAPS.md`
   (`pnpm gaps add`, ADR-082) in the same change, cited by its G id. Non-trivial choices get a short Explore → Doubt → Compare.
6. **Implement** one vertical slice that meets the `Done when` list. Keep `src/core` pure;
   add a test for every new rule. Use the matching skill:
   - saved data or a new Dexie table → `add-storage-version`
   - a screen or component → `implement-design`
   - tests → `add-tests`
7. **Verify.** Run the `verify` skill. Geometry changes also run
   `FUZZ_N=30000 pnpm exec vitest run tests/fuzz.test.ts`. Anything visible: write or extend
   `tests/find-it/<feature>.test.tsx` (jsdom, `renderApp` from `tests/find-it/setup.tsx`, both
   `WIDTHS`), run by `pnpm test` (R3, ADR-108). If the header says `- Acceptance: browser`, write
   `tools/<feature>/find-it.mjs` instead and run it on the production build from the bare app at
   phone (375–390 px) and desktop (1280–1440 px) widths. If the ADR header says
   `- Acceptance: light`, skip the script, preview and browser; the backlog row stays
   Partially done with the gap `find-it pending (light, ADR-066)` and the visible text to find (ADR-066).
8. **Ledger.** Update the backlog row in `docs/backlog.md` in the same change, with the
   evidence you ran. Write the requirement ledger (R1): every requirement in the user's
   words → evidence in the running app. Any requirement without evidence fails the delivery;
   for a light ADR, visible requirements are marked _not checked in a browser_.
9. **Do not ship in this skill.** When the checklist is met, report (outcome first: where to
   click, whether it is merged and deployed), end with the backlog table and
   **Skipped this iteration**, and suggest `ship ADR-NNN` once it is merged.

## Notes

- Picking is read-only — the script never edits or moves anything.
- A dependency still in `docs/adr/` counts as blocked even if its code exists. Ship it first
  (or the user can override).
