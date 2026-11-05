# ADR-175: Set duplicates keep set 1's run requests, run handles and sinks in step

- Status: Pending
- Date: 2026-11-05
- Depends on: ADR-167, ADR-036, ADR-075, ADR-125
- Design: n/a
- Backlog: N178
- Agreed: 2026-11-05 "Fix, then sort by priority to implement, start 5 adrs"; answer "Copy, keep in step"

## Context

Gap G-326 (ADR-167): run requests (plinths, fillers, worktops, cornices, ADR-036), run handles (ADR-075) and sinks
(ADR-125) on set-1 pieces are not copied to the set-N duplicates inside the project. `syncSets`
(`src/core/sets.ts:180`) keeps designs and bindings in step but never touches them; only "save a set as a separate
project" (`projectFromSet`) carries them over. A project with two sets therefore prices and cuts the worktop and
plinth of set 1 only.

User, 2026-11-05, answering how duplicates should carry them: **"Copy, keep in step"** — copied onto each duplicate
and re-synced on every edit, the same one-way rule as designs (ADR-167: a duplicate is edited through its original).

## Decision

1. `syncSets` also syncs, for every complete set N, the run requests, run handles and sinks of set 1:
   - a set-1 entry whose `from` (or `baseId`) names set members is copied with each member id replaced by that
     member's set-N duplicate; ids that are not members are dropped; an entry left with no ids is not copied;
   - a run entry is a set-N copy when every id in its `from` (or its `baseId`) is a set-N duplicate. Copies that no
     longer match a set-1 entry are removed; matching copies are updated; new ones are added (new ids, as
     `projectFromSet` does). Entries the user made on non-duplicate pieces are never touched.
2. No new field on the document: the copy is recognised from its ids, so `schemaVersion` stays (ADR-011).
3. The same project comes back when nothing changes (the `syncSets` contract), so undo history stays clean.
4. An incomplete set keeps what it has, as for designs today.

## Alternatives considered

- **Copy once when the set is completed** — less work, but edits to set 1 would no longer reach the duplicates,
  breaking ADR-167's one-way rule. Not chosen by the user.
- **Mark copies with a `set` field** — explicit, but changes the document shape and needs a schema bump for no
  behaviour the id rule cannot give.

## Scope

- In scope: run requests, run handles and sinks in `syncSets`; the cut list, shopping list and 3D of a project with
  sets then include them for every set.
- Out of scope: variables on run parts (G-325, unchanged).

## Consequences

- Positive: every set gets its worktop, plinth, handles and sink; prices and cut lists count them.
- Negative / risks: a run request that spans set-1 pieces and non-member pieces is copied with the members only.
- Harder to change later: nothing new is saved.

## Done when

- [ ] A project with 2 sets, a worktop and a plinth over set 1 and a sink on a set-1 base: after `syncSets` set 2
      has its own worktop, plinth and sink on its duplicates (tests)
- [ ] Changing or deleting the set-1 run request changes or deletes the set-2 copy; `syncSets` twice returns the same
      project (tests)
- [ ] A run request on non-duplicate pieces is left alone; an incomplete set gets no copies (tests)
- [ ] The project's cut list counts two worktops (tests)
