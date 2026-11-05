# ADR-198: Fix the piece editor design findings

- Status: Deferred (empty placeholder)
- Date: 2026-11-05
- Depends on: ADR-079, ADR-080, ADR-112, ADR-117
- Design: docs/ui-design.md (Piece editor (Compose and Configure))
- Backlog: N203

## Context

Placeholder for domain 6, **Piece editor (Compose and Configure)**, of the 2026-11-05 design critique. The user asked: "run a /batch for 1
through 7 with a critique of design … 1 adr with high and medium issues and fixes per flow", then "Create empty adrs
for them, not ready, add a note inside them with what prompt need to be run to finish them". Domains 2 to 5 became
ADR-193 to ADR-196. This one is not ready: it has no findings yet (G-367). The stopped run had screenshots of Compose start, the space and split editors, the whole-piece view and Settings at 390 and 1280 px; no findings were written.

## Note: the prompt that finishes this ADR

Run in a Claude Code session on this repository, with the production build served (`pnpm build && pnpm exec vite
preview --port 4173`):

> Critique the design of domain 6, Piece editor (Compose and Configure), and fill ADR-198 with its findings. Scope: selecting spaces and parts, the inspector, per-space editors (shelves, drawers, doors, hanging, splits), piece size and size locks, parameter locks, count stepper, Replace, inside doors, undo/redo history, the problem banner. Files: src/ui/Inspector.tsx, Editors.tsx, Selection.tsx, PieceSize.tsx, Replace.tsx, History.tsx, CountStepper.tsx, ProblemBanner.tsx, keepProportions.ts, src/core/selection.ts, selectPath.ts, sizeLock.ts, pieceSize.ts, replace.ts, history.ts, src/store/designStore.ts.
> Implemented ADRs to respect: ADR-079, 080, 112, 113, 117 (grep `docs/adr-done` for more). Evidence: read the code; probe with scratch
> Vitest tests (delete them after); screenshot the production build at 390 × 844 and 1280 × 900. Keep only High
> (blocks or misleads, loses work, wrong output, hard-rule breach) and Medium (clear friction a user hits in normal use)
> findings, 4 to 10, each with evidence (file:line or what you saw) and ONE fix chosen over 2–3 options. Do not repeat
> ADR-191 or ADR-193 to ADR-196. Write Context, Decision (numbered findings), Alternatives considered, Scope, Consequences
> and Done when (≤ 8 items) in this file, ≤ 100 lines; ask every open question at once; record out-of-scope items as
> gaps; set Status Pending once every question is answered; move G-367's part for this domain into it.

Earlier evidence from the stopped run, if the session still has it:
`/tmp/claude-0/-home-user-furniture-builder/ab53647a-dfb3-571a-958d-b77425e3749c/scratchpad/batch/d6/` (screenshots and
probe scripts; scratch space, may be gone).

## Decision

Not written yet; see the note above.

## Done when

- [ ] The critique has run and this ADR lists its High and Medium findings with one fix each (the prompt above).
