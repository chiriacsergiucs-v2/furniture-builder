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
3. **Start building — do not ask for permission.** Announce the number and title in one
   line. Stop and ask only when a dependency is blocked, or when a physical or supplier
   fact is unknown (record it under *Open questions* in `docs/backlog.md`; never invent it).
4. **Read only what the ADR points to:** the ADR, its `Depends on` ADRs, the design
   reference, and the current code it touches (not docs alone).
5. **Scope.** For each change ask "needed to demonstrate this now?" — if not, it goes under
   *Skipped this iteration*. Non-trivial choices get a short Explore → Doubt → Compare.
6. **Implement** one vertical slice that meets the `Done when` list. Keep `src/core` pure;
   add a test for every new rule. Use the matching skill:
   - saved data or a new Dexie table → `add-storage-version`
   - a screen or component → `implement-design`
   - tests → `add-tests`
7. **Verify.** Run the `verify` skill. Geometry changes also run
   `FUZZ_N=30000 pnpm exec vitest run tests/fuzz.test.ts`. Anything visible: write or extend
   `tools/<feature>/find-it.mjs` and run it on the production build from the bare app at
   phone (375–390 px) and desktop (1280–1440 px) widths (R3).
8. **Ledger.** Update the backlog row in `docs/backlog.md` in the same change, with the
   evidence you ran. Write the requirement ledger (R1): every requirement in the user's
   words → evidence in the running app. Any requirement without evidence fails the delivery.
9. **Do not ship in this skill.** When the checklist is met, report (outcome first: where to
   click, whether it is merged and deployed), end with the backlog table and
   **Skipped this iteration**, and suggest `ship ADR-NNN` once it is merged.

## Notes

- Picking is read-only — the script never edits or moves anything.
- A dependency still in `docs/adr/` counts as blocked even if its code exists. Ship it first
  (or the user can override).
