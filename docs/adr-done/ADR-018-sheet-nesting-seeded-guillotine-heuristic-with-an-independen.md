# ADR-018: Sheet nesting: seeded guillotine heuristic with an independent layout validator

- Status: Implemented
- Date: 2026-10-21
- Implemented: 2026-10-21
- Decided by: open questions answered by the user
- Depends on: none
- Design: n/a
- Related: ADR-004, ADR-008, ADR-009, ADR-019, ADR-020
- Backlog: N01

## Context

The parts list tells the user what to cut but not how many sheets to buy or where to cut. The panel saw makes
guillotine cuts (edge to edge). The previous app had an optimiser; it is not reused (ADR-001), but its rules were
right and are restated here.

## Decision

Add `src/core/nesting/` with two independent modules:

- **Placer**: for each material, place every part instance from the cut list onto stock sheets using guillotine
  splits only. Kerf is a full-length stripe of material destroyed by each cut; a leftover narrower than the kerf is
  unusable and rejected, never absorbed. Grain-locked parts (material has grain) are never rotated; plain parts may
  rotate. Sheet trim margins are unusable. Search is deterministic (seeded restarts over orderings and split
  directions, bounded by time) and compares layouts lexicographically: fewest unplaced parts → fewest sheets → least
  unusable waste → largest single leftover → fewest cuts. Leftovers are reported as waste; offcuts are not tracked
  (answer below).
- **Validator**: re-walks every cut tree with no shared code from the placer and checks containment, kerf, grain,
  stock counts, that every part instance is placed exactly once or listed as unplaced, and exact area conservation.
  A layout that fails is never shown or exported.
  The placer runs in a Web Worker. Results are always called a _heuristic layout_, never optimal. Input is the cut list
  (finished sizes, ADR-009), so nesting never re-derives geometry (ADR-004).

## Alternatives considered

- **Exact solver (MIP / branch and bound)** — unbounded run time in a phone browser.
- **Free rectangle packing (not guillotine)** — produces layouts a panel saw cannot cut.
- **Send the parts list to an online optimiser** — breaks ADR-002.

## Consequences

- Needs stock sheets per material (ADR-019).
- Adds a Sheets tab and per-sheet SVG (ADR-020 covers printing it).
- The independent validator doubles the code for each constraint; that is the point.

## Evidence (repository files)

- `src/core/nesting/place.ts` — seeded guillotine placer (kerf stripe, sub-kerf rejection, grain lock, trim, stock count, lexicographic objective).
- `src/core/nesting/validate.ts` — independent validator (imports nothing from the placer); `nest()` sets `valid` from it.
- `src/core/nesting/worker.ts`, `src/ui/useNesting.ts` — runs in a Web Worker, main-thread fallback.
- `src/core/nesting/fromDesign.ts` — jobs from the cut list.
- `src/ui/Sheets.tsx` — Sheets tab: buy list, per-sheet diagrams, unplaced parts; invalid layouts never shown.
- `tests/nesting.test.ts` — 10 unit tests + seeded fuzz with mutation checks (5,000-job deep run passed); `tests/core.test.ts` — every template lays out validly.

## Compliance check

When accepted: `src/core/nesting/validate.ts` imports nothing from the placer; a seeded fuzz test asserts every
layout the placer returns passes the validator; UI copy contains "heuristic" and no "optimal".

## Answers (2026-10-21, from the user)

- **Kerf:** 4 mm default (a design setting, ADR-019).
- **Offcuts:** full sheets only for now. Leftover areas are shown as waste; no offcut inventory and no reuse across
  jobs. Offcut tracking becomes a separate ADR if wanted later.
- **Minimum offcut:** not applicable while offcuts are not tracked.

Built and accepted 2026-10-21. Built by a separate agent from this ADR, integrated and reviewed here.
