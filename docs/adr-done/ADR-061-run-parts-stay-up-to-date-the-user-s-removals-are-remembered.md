# ADR-061: Run parts stay up to date by themselves; the user's removals are remembered

- Status: Implemented
- Date: 2026-10-24
- Implemented: 2026-10-24
- Decided by: user, 2026-10-24: "create the ADRs … auto-accept the recommended suggestion" (answers below)
- Depends on: ADR-036, ADR-051, ADR-054
- Design: docs/ui-design.md (project panel → Run parts)
- Backlog: N58

## Context

Research feature _Derived-component dependency regeneration_ (rank 23, value 4.2, P1 internal; Roomle, Coohom).
Run parts are stored with their room position when suggested (`RunPart` in `src/core/project.ts`). When a piece
moves or is resized they become wrong; the app then reports `run-part-overlap` ("suggest the run parts again after
moving pieces") and the user must press _Suggest again_, which also brings back parts they had removed.

## Decision

- **Each run part records its sources:** `from: string[]` (item ids of the run) and a stable `key` = kind + the
  sorted source ids + end/gap position (e.g. `filler|a,b`, `cover-left|a`).
- **Automatic refresh:** project setting _Keep run parts up to date_ (on once run parts were suggested). After every
  project change that touches pieces (move, resize via _Back to project_, add, remove, turn, merge), run parts are
  suggested again **inside the same commit**, so it is one undo step (ADR-051).
- **User removals are overrides:** removing a run part stores its `key` in `runPartsRemoved`; refresh never brings
  it back while its sources exist. _Suggest again_ clears the removals after a confirmation.
- **Only affected runs change:** parts whose `key` and box are unchanged keep their id; the list says
  "Worktop updated: 2400 → 3000 mm" for parts that changed, once.
- Turning the setting off keeps today's behaviour (stored parts, overlap error, manual _Suggest again_).

## Alternatives considered

- **Full dependency graph for every derived value** — the only derived parts today are run parts; a graph is
  premature.
- **Recompute run parts on every render, never store them** — loses user removals and the stored board copy.

## Scope

- In scope: automatic refresh of run parts, remembered removals.
- Out of scope: a general dependency graph for other derived values.

## Consequences

- `run-part-overlap` disappears in normal use; it stays for the "off" setting.

## Done when

- [x] Moving a piece updates worktop and filler in the same step; undo restores pieces and run parts together (`tests/run-parts.test.ts`)
- [x] A removed filler stays removed after a real move; removing the piece it came from drops the override (`tests/run-parts.test.ts`)
- [x] _Suggest again_ keeps automatic refresh off when the user turned it off; with refresh off, a run part for a removed piece or a run plinth of the wrong length is an error (`run-part-stale`) (`tests/run-parts.test.ts`)
- [x] find-it `tools/ensemble/find-it-adrs.mjs` (80/80, 1440 and 375 px): changing the gap shows a **Filler** (40 mm + 20 mm scribe) without pressing _Suggest again_; _Keep run parts up to date_ is on

## Answers

1. _Automatic by default?_ — **Yes, once run parts were suggested; a setting turns it off.**
2. _Keep the user's removals?_ — **Yes, until _Suggest again_ (with confirmation).**
3. _One undo step for a change and its refresh?_ — **Yes.**

## Implementation notes

`RunPart.key`/`from`/`changed`, `Project.runSettings`/`runPartsRemoved`, `refreshRunParts` inside `commitProject` (one undo step), store `suggestRunParts`/`removeRunPart`/`setRunSettings`; UI _Keep run parts up to date_, "updated: 2400 → 3000 mm", removed count, notes. Tests: `tests/run-parts.test.ts`. find-it `tools/ensemble/find-it-adrs.mjs` (production build, bare app, visible text, 1440 and 375 px): 60/60: filler appears after a gap change without _Suggest again_. After review: _Suggest again_ keeps the user's refresh setting; stale run parts are an error while refresh is off.
