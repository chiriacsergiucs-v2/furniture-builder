# ADR-178: Project-level assembly order before the per-piece steps

- Status: Implemented
- Date: 2026-11-05
- Implemented: 2026-11-05
- Depends on: ADR-174
- Design: docs/ui-design.md (section 4, results tabs)
- Backlog: N181
- Agreed: 2026-11-05 "Fix, then sort by priority to implement, start 5 adrs"; answer "Corner, walls, run parts"

## Context

Gap G-345 (ADR-174): assembly steps are per piece (`assemblySteps`, `src/core/assembly.ts:155`); a project has no
order saying which piece goes in first, nor where run parts, worktops and common panels come.

User, 2026-11-05: **"Corner, walls, run parts"** — corner cabinets first, then base pieces along each wall from
the corner, then wall pieces, then run parts last (plinths, fillers, worktops, common panels). Labelled as guidance
(ADR-010).

## Decision

1. `projectAssemblyOrder(project, model)` in `src/core/assembly.ts` returns ordered stages:
   1. **Corner cabinets** — every corner piece;
   2. **Base pieces** — floor pieces per wall, in room wall order, each wall from its corner end; pieces on no wall
      by plan x then z;
   3. **Wall pieces** — wall-mounted pieces, same order;
   4. **Run parts** — plinths, fillers, cornices, worktops, common panels and sinks.
      Each stage lists piece names (linked copies once with × N). Pure, deterministic, no geometry in UI (ADR-004).
2. The Assembly tab of a project opens with a **Project order** section (stages, numbered) before the per-piece
   steps; ADR-174's guidance line (`ASSEMBLY_GUIDANCE`, ADR-010) sits under it.
3. The printed assembly sheet starts with the same section, in the print language (`pt()`, ro/ru/en, ADR-157).
4. A single design (not a project) has no Project order section.
5. A piece is on a wall when its back is within 50 mm of it and it faces into the room; a piece placed on or above
   another piece counts as a wall piece (user 2026-11-05: "Keep both").

## Alternatives considered

- **Plan order, left to right** — simpler, but ignores the corner-first rule. Not chosen.

## Scope

- In scope: the order, the Assembly tab section, the print.
- Out of scope: editing the order (G-344); per-step pictures (G-343).

## Consequences

- Positive: a fitter sees where to start in the room.
- Negative / risks: the order is guidance from geometry only.

## Done when

- [x] An L room project: corner first, then each wall's base pieces from the corner, then wall pieces, then run
      parts; same input, same order (tests)
- [x] A project without a room orders by plan x; a design alone gives no section (tests)
- [x] Assembly tab → "Project order" with numbered stages and the guidance line at 390 and 1280 px (jsdom find-it)
- [x] The printed sheet starts with the section in ro, ru and en (tests)
- [x] Russian entries for every new text; feature tree line "Project assembly order" (ADR-158)
