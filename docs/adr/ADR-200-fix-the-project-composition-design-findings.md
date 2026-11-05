# ADR-200: Fix the project composition design findings

- Status: Deferred (empty placeholder)
- Date: 2026-11-05
- Depends on: ADR-022, ADR-093, ADR-107, ADR-160
- Design: docs/ui-design.md (Project composition)
- Backlog: N205

## Context

Placeholder for domain 7, **Project composition**, of the 2026-11-05 design critique. The user asked: "run a /batch for 1
through 7 with a critique of design … 1 adr with high and medium issues and fixes per flow", then "Create empty adrs
for them, not ready, add a note inside them with what prompt need to be run to finish them". Domains 2 to 5 became
ADR-193 to ADR-196. This one is not ready: it has no findings yet (G-367). The stopped run had screenshots of an empty project, Add a piece, placing, six pieces selected, Position, More, Room and the selection card at 390 and 1280 px; no findings were written.

## Note: the prompt that finishes this ADR

Run in a Claude Code session on this repository, with the production build served (`pnpm build && pnpm exec vite
preview --port 4173`):

> Critique the design of domain 7, Project composition, and fill ADR-200 with its findings. Scope: the pieces list, Add a piece, room and walls, plan drag and snap, align and distribute, arrange, Move to, group move and size, connections, merge, shared sides and common tops, clearances, compat rules, wall background and photo straightening, project settings, versions and templates. Files: src/ui/Project.tsx (read in parts), PieceList.tsx, MoveTo.tsx, Clearances.tsx, CompatRules.tsx, WallBackground.tsx, StraightenPhoto.tsx, ProjectSettings.tsx, ProjectTemplates.tsx, planDrag.ts, pieceDrag.ts, useSnap.ts, src/core/project.ts, room.ts, setRoom.ts, snap.ts, align.ts, arrange.ts, moveTo.ts, groupMove.ts, groupSize.ts, connections.ts, merge.ts, shared.ts, common.ts, clearance.ts, compat.ts, linked.ts, sets.ts, projectSettings.ts, projectTemplate.ts, projectVersion.ts.
> Implemented ADRs to respect: ADR-022, 047, 093, 107, 160, 165, 189, 190 (grep `docs/adr-done` for more). Evidence: read the code; probe with scratch
> Vitest tests (delete them after); screenshot the production build at 390 × 844 and 1280 × 900. Keep only High
> (blocks or misleads, loses work, wrong output, hard-rule breach) and Medium (clear friction a user hits in normal use)
> findings, 4 to 10, each with evidence (file:line or what you saw) and ONE fix chosen over 2–3 options. Do not repeat
> ADR-191 or ADR-193 to ADR-196. Write Context, Decision (numbered findings), Alternatives considered, Scope, Consequences
> and Done when (≤ 8 items) in this file, ≤ 100 lines; ask every open question at once; record out-of-scope items as
> gaps; set Status Pending once every question is answered; move G-367's part for this domain into it.

Earlier evidence from the stopped run, if the session still has it:
`/tmp/claude-0/-home-user-furniture-builder/ab53647a-dfb3-571a-958d-b77425e3749c/scratchpad/batch/d7/` (screenshots and
probe scripts; scratch space, may be gone).

## Decision

Not written yet; see the note above.

## Done when

- [ ] The critique has run and this ADR lists its High and Medium findings with one fix each (the prompt above).
