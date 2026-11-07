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
   line. Stop and ask only when a dependency is blocked, when an open question the build needs is
   unanswered (never build with the recommended option by default), or when a physical or supplier
   fact is unknown (record it under _Open questions_ in `docs/backlog.md`; never invent it).
4. **Read only what the ADR points to:** the ADR, its `Depends on` ADRs, the design
   reference, and the current code it touches (not docs alone).
5. **Scope.** For each change ask "needed to demonstrate this now?" — if not, it goes under
   _Skipped this iteration_ in the reply (gaps optional, user 2026-11-07).
6. **Implement** one vertical slice that meets the `Done when` list. Keep `src/core` pure;
   add a test for every new rule. Use the matching skill:
   - saved data or a new Dexie table → `add-storage-version`
   - a screen or component → `implement-design`
   - tests → `add-tests`
7. **Check:** `pnpm typecheck`, `pnpm format`, `pnpm exec vitest related --run <changed files>`, `pnpm docs:check`;
   fuzz after geometry changes. Visible changes get or extend a jsdom find-it test (R3); `Acceptance: browser` runs
   `tools/<feature>/find-it.mjs` on the production build. Full `verify` only when the user asks; CI runs it.
8. **Backlog:** update the row in `docs/backlog.md` with the evidence you ran.
9. **Ship in the same branch:** run `ship-adr` for this ADR and commit it on the same branch (no separate ship pull
   request). Push and open the pull request (toggle `auto-open-pr`). Merge only when the user asks.
10. **Reply:** where to click and whether it is live, **Decided**, **Skipped this iteration**.

## Notes

- **After `new-adr`:** build that ADR (not the lowest-numbered one) on the same branch; keep the dependency check.
  Questions that arise while building follow the low-confidence rule (`build` skill, step 3).
- Picking is read-only — the script never edits or moves anything.
- A dependency still in `docs/adr/` counts as blocked even if its code exists. Ship it first
  (or the user can override).
