---
name: ship-adr
description: Mark an ADR as implemented — set its status to Implemented, move it from docs/adr/ to docs/adr-done/, fix all README and cross-reference links, then commit and push. Use when the user says "ship ADR-NNN", "mark ADR-NNN done/implemented", "the ADR is ready", or asks to finalize/close out an implemented ADR.
---

# Ship an ADR

Finalizes an implemented ADR. Given an ADR number, it flips the status, relocates the
file, repairs every link that pointed at it, then commits and pushes.

Project: **Furniture Builder** — offline PWA for designing casework.

## What "shipped" means here

- ADRs live in `docs/adr/` while pending and move to `docs/adr-done/` when implemented.
  File names: `ADR-NNN-short-title.md` (3-digit number).
- A done ADR has `- Status: Implemented` and an `- Implemented: <date>` line.
- Links use folder-relative paths: pending ADRs link siblings as `](ADR-XXX-slug.md)`;
  once an ADR is in `adr-done/`, everyone links it as `](../adr-done/ADR-XXX-slug.md)`.
- `docs/adr/README.md` lists every ADR in a table whose **last column is the status**;
  a shipped row's status becomes `✅ Implemented`.
- Shipped means built and verified with evidence, not only pushed. Pushed ≠ merged ≠
  deployed ≠ live-verified; say which one is true.

## Workflow

1. **Identify the ADR.** Get the number from the user (e.g. `047`, `ADR-047`). If ambiguous, ask.
2. **Check the evidence first.** Every `Done when` item is met by code and by a check you
   ran (command output, CI run id, find-it result: jsdom test or, for `Acceptance: browser`, the
   browser script, ADR-108). The backlog row has that evidence.
   An `Acceptance: light` ADR may ship without the find-it result; its backlog row keeps
   `find-it pending (light, ADR-066)` and stays Partially done until the catch-up run (ADR-066).
   If an item is not met, stop and tell the user rather than shipping (R1, R2).
3. **Run the helper:**
   ```bash
   bash .claude/skills/ship-adr/ship-adr.sh <NUMBER> ["optional implemented note"]
   ```
   It sets the status and `Implemented:` date, moves the file with `git mv`, rewrites
   links across `docs/adr*/`, sets the README row to `✅ Implemented`, marks the gaps in
   `docs/adr/GAPS.md` that moved into this ADR `Done (ADR-NNN)` (ADR-082), and warns about
   unchecked `Done when` items and stale references elsewhere. Anything of the ADR still not
   built gets a new gap (`pnpm gaps add`) before shipping, never a silent Done.
4. **Review** `git status --short` and `git diff`; fix reported stale references by hand.
   Tick the `Done when` boxes you verified. Run `pnpm docs:check`.
5. **Commit and push:**
   ```bash
   git add -A
   git commit -m "Ship ADR-NNN: <short title> — mark implemented"
   git push -u origin <branch>
   ```
   Never push to `main` directly or force-push it; merge only on the user's instruction (or
   when green under the `babysit` skill), then cite the `Deploy GitHub Pages` run id. A ship pull
   request is merged straight after the ship commit is pushed, without waiting for CI on it
   (user rule 2026-10-29).

## Notes

- If the ADR is already in `adr-done/` the script exits without changes.
- It does **not** commit or push — you do that.
- If the user ships several ADRs at once, run the script per number, then make one commit.
