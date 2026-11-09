# ADR-242: Restore the room-fill 100 ms timing check

- Status: Deferred (temporary: the timing check is skipped since 2026-11-09)
- Date: 2026-11-09
- Depends on: ADR-193
- Design: n/a
- Backlog: N251

## Context

[ADR-193](../adr-done/ADR-193-fix-the-start-something-new-fill-a-wall-and-fill-the-room-fl.md) requires the 4-wall
Fill the room default to stay under 100 ms, checked by `tests/roomfill.test.ts` ("the 4-wall default stays under
100 ms": fastest of 5 warm runs, retried twice). On 2026-11-09, CI on main (run 42720885890, merge of PR #207,
which changed nothing in `src`) failed it three times with 118.8, 123.2 and 129.6 ms; a re-run of the same commit
passed. The check depends on the speed of the CI machine, not only on the code.

The user decided on 2026-11-09 to suppress the check for now and record the temporary deferred state here.
ADR-193 is Implemented and is not edited; this ADR records the change.

## Decision

- Now: the timing test is skipped (`it.skip`, comment pointing here). Every other room-fill test still runs.
- The 100 ms budget of ADR-193 still stands as a target; only its automatic check is off.
- Later (this ADR, when built): bring the check back in a form that does not depend on the machine's speed, then
  remove the skip.

## Alternatives considered

- **Raise the limit** — rejected for now: it would loosen ADR-193's budget without a decision on a new number.
- **Optimise `suggestRoomMixes` first** — not chosen now: no profile yet shows a slowdown in the code; the miss
  appeared on a commit that did not touch it.

## Scope

- In scope: the skipped timing test and its return.
- Out of scope: changing what Fill the room suggests.

## Consequences

- Positive: CI on main no longer fails on machine speed.
- Negative / risks: a real slowdown of Fill the room is not caught while the check is skipped.

## Done when

- [ ] The timing check runs again (no skip) in a form that does not fail on machine speed alone
- [ ] It passes in CI on three consecutive runs

## Open questions

- How should the check come back? Options: a work counter (number of candidate builds) instead of milliseconds;
  a budget relative to a reference run on the same machine; or 100 ms kept with more warm runs. Suggested pick: the
  work counter. Not applied until the user picks.
